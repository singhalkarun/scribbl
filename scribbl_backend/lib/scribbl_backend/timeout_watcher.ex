defmodule ScribblBackend.TimeoutWatcher do
  @moduledoc """
  A GenServer that listens to Redis key expiration events and handles turn timeouts.
  """

  use GenServer
  alias ScribblBackend.RedisHelper
  alias ScribblBackend.GameState
  alias ScribblBackend.GameFlow
  alias ScribblBackend.WordManager
  alias ScribblBackend.KeyManager

  @lock_ttl_ms 5000

  ## Client API

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  ## Server Callbacks

  @impl true
  def init(state) do
    # Resolve the Redis DB dynamically at runtime
    db = System.get_env("REDIS_DB") || "0"
    redis_channel = "__keyevent@#{db}__:expired"

    host = System.get_env("REDIS_HOST") || "localhost"
    port = System.get_env("REDIS_PORT") || "6379"

    opts = [
      host: host,
      port: String.to_integer(port),
      name: :redix_pubsub
    ]

    # Subscribe to Redis key expiration events
    {:ok, redix_pubsub} = Redix.PubSub.start_link(opts)

    case Redix.PubSub.subscribe(redix_pubsub, redis_channel, self()) do
      {:ok, _ref} ->
        :ok

      {:error, _reason} ->
        :ok
    end

    {:ok, Map.put(state, :redix_pubsub, redix_pubsub) |> Map.put(:redis_channel, redis_channel)}
  end

  @impl true
  def handle_info(
        {:redix_pubsub, _pid, _sub, :message, %{channel: channel, payload: key}},
        %{redis_channel: channel} = state
      ) do
    # Check if the channel in the message matches the redis_channel in the state
    cond do
      Regex.match?(~r/^room:\{.+\}:timer$/, key) ->
        maybe_handle_expired_key(key)

      Regex.match?(~r/^room:\{.+\}:reveal_timer$/, key) ->
        handle_letter_reveal(key)

      Regex.match?(~r/^room:\{.+\}:word_selection_timer$/, key) ->
        handle_word_selection_timeout(key)

      Regex.match?(~r/^room:\{.+\}:turn_transition_timer$/, key) ->
        handle_turn_transition_timeout(key)

      true ->
        :noop
    end

    {:noreply, state}
  end

  # Handling subscription confirmation message
  @impl true
  def handle_info(
        {:redix_pubsub, _pid, _sub, :subscribed, %{channel: _channel}},
        state
      ) do
    {:noreply, state}
  end

  def handle_info(_msg, state) do
    {:noreply, state}
  end

  ## Internal Helpers

  defp maybe_handle_expired_key(key) do
    # Extract room_id from the key
    case Regex.run(~r/^room:\{([^}]+)\}:timer$/, key) do
      [_, room_id] ->
        # Get current word from Redis
        case WordManager.get_current_word(room_id) do
          {:ok, nil} ->
            # If no word is set, just start the next turn
            GameFlow.start(room_id)

          {:ok, word} ->
            # Create a word-specific lock key
            lock_key = KeyManager.turn_timer_lock(room_id, word)

            case acquire_distributed_lock(lock_key) do
              {:ok, "OK"} -> handle_timeout_logic(room_id, word)
              _ -> :noop
            end

          _ ->
            :noop
        end

      _ ->
        :noop
    end
  end

  defp handle_timeout_logic(room_id, word) do
    case check_game_active(room_id) do
      {:ok, _room_info} ->
        # Game is active, proceed with timeout logic
        broadcast_turn_over(room_id, word, "timeout")
        cleanup_turn_resources(room_id)
        GameFlow.start_delayed(room_id)
      _ ->
        # Game is not active, do nothing
        :noop
    end
  end

  defp broadcast_turn_over(room_id, word, reason) do
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      KeyManager.room_topic(room_id),
      %{
        event: "turn_over",
        payload: %{
          "reason" => reason,
          "word" => word
        }
      }
    )
  end

  defp cleanup_turn_resources(room_id) do
    # Clear current word and revealed indices for the completed turn
    RedisHelper.del(KeyManager.current_word(room_id))
    RedisHelper.del(KeyManager.revealed_indices(room_id))
    # Clear the reveal timer
    RedisHelper.del(KeyManager.reveal_timer(room_id))
  end

  defp handle_letter_reveal(key) do
    # Extract room_id from the key
    case Regex.run(~r/^room:\{([^}]+)\}:reveal_timer$/, key) do
      [_, room_id] ->
        case GameState.get_room(room_id) do
          {:ok, room_info} when room_info.status == "active" ->
            # Game is active, check if hints are allowed
            hints_allowed =
              case room_info.hints_allowed do
                nil -> true
                "" -> true
                "false" -> false
                _ -> true
              end

            if hints_allowed do
              # Get current word from Redis for lock uniqueness
              case WordManager.get_current_word(room_id) do
                {:ok, nil} ->
                  # If no word is set, do nothing
                  :noop

                {:ok, word} ->
                  # Create a word-specific lock key
                  lock_key = KeyManager.reveal_timer_lock(room_id, word)

                  case acquire_distributed_lock(lock_key) do
                    {:ok, "OK"} ->
                      # Reveal a letter
                      case WordManager.reveal_next_letter(room_id) do
                        {:ok, revealed_word} ->
                          # Get the current drawer
                          case GameState.get_current_drawer(room_id) do
                            {:ok, current_drawer}
                            when is_binary(current_drawer) and current_drawer != "" ->
                              # Send the letter reveal event to all players except the drawer
                              Phoenix.PubSub.broadcast(
                                ScribblBackend.PubSub,
                                KeyManager.room_topic(room_id),
                                {:exclude_user, current_drawer,
                                 %{
                                   event: "letter_reveal",
                                   payload: %{
                                     "revealed_word" => revealed_word
                                   }
                                 }}
                              )

                              # Start the next reveal timer
                              WordManager.start_reveal_timer(room_id)

                            _ ->
                              # No valid drawer or error fetching drawer, so don't broadcast or start next timer
                              :noop
                          end

                        _ ->
                          :noop
                      end

                    _ ->
                      :noop
                  end
              end
            end

          _ ->
            :noop
        end

      _ ->
        :noop
    end
  end

  defp handle_word_selection_timeout(key) do
    with {:ok, room_id} <- extract_room_id_from_key(key, ~r/^room:\{([^}]+)\}:word_selection_timer$/),
         {:ok, _room_info} <- check_game_active(room_id) do
      # Game is active, attempt to acquire distributed lock
      lock_key = KeyManager.word_selection_timer_lock(room_id)

      case acquire_distributed_lock(lock_key) do
        {:ok, "OK"} ->
          # Successfully acquired lock, proceed with word auto-selection
          perform_word_auto_selection(room_id)
        _ ->
          # Another container is handling this, do nothing
          :noop
      end
    else
      _ ->
        # Game not active or invalid key, clean up if possible
        case extract_room_id_from_key(key, ~r/^room:\{([^}]+)\}:word_selection_timer$/) do
          {:ok, room_id} -> cleanup_timer_key(KeyManager.word_selection_timer(room_id))
          _ -> :noop
        end
    end
  end

  defp perform_word_auto_selection(room_id) do
    word_selection_timer_key = KeyManager.word_selection_timer(room_id)

    # Get stored words or generate new ones
    words = get_words_for_auto_selection(room_id, word_selection_timer_key)
    selected_word = Enum.random(words)

    case GameState.get_current_drawer(room_id) do
      {:ok, current_drawer} when is_binary(current_drawer) and current_drawer != "" ->
        start_turn_with_auto_selected_word(room_id, selected_word, current_drawer)
      _ ->
        :noop
    end

    # Clean up the timer
    cleanup_timer_key(word_selection_timer_key)
  end

  defp get_words_for_auto_selection(room_id, word_selection_timer_key) do
    case RedisHelper.get(word_selection_timer_key) do
      {:ok, words_json} when is_binary(words_json) ->
        case Jason.decode(words_json) do
          {:ok, decoded_words} -> decoded_words
          _ -> WordManager.generate_words(room_id)
        end
      _ ->
        WordManager.generate_words(room_id)
    end
  end

  defp start_turn_with_auto_selected_word(room_id, selected_word, current_drawer) do
    case WordManager.start_turn(room_id, selected_word) do
      {:ok, turn_info} ->
        broadcast_auto_selected_turn(room_id, turn_info)
        notify_drawer_of_auto_selection(current_drawer, selected_word)
      _ ->
        :noop
    end
  end

  defp broadcast_auto_selected_turn(room_id, turn_info) do
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      KeyManager.room_topic(room_id),
      %{
        event: "turn_started",
        payload: Map.put(turn_info, "auto_selected", true)
      }
    )
  end

  defp notify_drawer_of_auto_selection(current_drawer, selected_word) do
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      KeyManager.user_topic(current_drawer),
      %{
        event: "word_auto_selected",
        payload: %{
          "word" => selected_word,
          "message" => "Word auto-selected due to timeout"
        }
      }
    )
  end

  defp handle_turn_transition_timeout(key) do
    with {:ok, room_id} <- extract_room_id_from_key(key, ~r/^room:\{([^}]+)\}:turn_transition_timer$/),
         {:ok, _room_info} <- check_game_active(room_id) do
      # Game is active, attempt to acquire distributed lock
      lock_key = KeyManager.turn_transition_timer_lock(room_id)

      case acquire_distributed_lock(lock_key) do
        {:ok, "OK"} ->
          # Successfully acquired lock, proceed with starting next turn
          cleanup_timer_key(KeyManager.turn_transition_timer(room_id))
          GameFlow.start(room_id)
        _ ->
          # Another container is handling this, do nothing
          :noop
      end
    else
      _ ->
        # Game not active or invalid key, clean up if possible
        case extract_room_id_from_key(key, ~r/^room:\{([^}]+)\}:turn_transition_timer$/) do
          {:ok, room_id} -> cleanup_timer_key(KeyManager.turn_transition_timer(room_id))
          _ -> :noop
        end
    end
  end

  defp node_id, do: Atom.to_string(Node.self())

  # Helper functions to reduce code duplication

  # Extract room_id from a timer key using the provided regex pattern.
  # Returns {:ok, room_id} or :error.
  defp extract_room_id_from_key(key, regex_pattern) do
    case Regex.run(regex_pattern, key) do
      [_, room_id] -> {:ok, room_id}
      _ -> :error
    end
  end

  # Check if a game is active for the given room.
  # Returns {:ok, room_info} if active, :inactive otherwise.
  defp check_game_active(room_id) do
    case GameState.get_room(room_id) do
      {:ok, room_info} when room_info.status == "active" -> {:ok, room_info}
      _ -> :inactive
    end
  end

  # Clean up a timer key, regardless of game state.
  defp cleanup_timer_key(timer_key) do
    RedisHelper.del(timer_key)
  end

  # Attempt to acquire a distributed lock for timer handling.
  # Returns {:ok, "OK"} if lock acquired, anything else means another container got it.
  defp acquire_distributed_lock(lock_key) do
    Redix.command(:redix, [
      "SET",
      lock_key,
      node_id(),
      "NX",
      "PX",
      Integer.to_string(@lock_ttl_ms)
    ])
  end
end
