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

            case Redix.command(:redix, [
                   "SET",
                   lock_key,
                   node_id(),
                   "NX",
                   "PX",
                   Integer.to_string(@lock_ttl_ms)
                 ]) do
              {:ok, "OK"} -> handle_timeout_logic(room_id, word)
              _ -> :noop
            end

          _ -> :noop
        end
      _ -> :noop
    end
  end

  defp handle_letter_reveal(key) do
    # Extract room_id from the key
    case Regex.run(~r/^room:\{([^}]+)\}:reveal_timer$/, key) do
      [_, room_id] ->
        # Get room settings
        case GameState.get_room(room_id) do
          {:ok, room_info} ->
            # Check if hints are allowed
            hints_allowed = case room_info.hints_allowed do
              nil -> true
              "" -> true
              "false" -> false
              _ -> true
            end

            # Only proceed with letter reveal if hints are allowed
            if hints_allowed do
              # Create a lock key
              case WordManager.get_current_word(room_id) do
                {:ok, nil} -> :noop
                {:ok, word} ->
                  lock_key = KeyManager.reveal_timer_lock(room_id, word)

                  case Redix.command(:redix, [
                         "SET",
                         lock_key,
                         node_id(),
                         "NX",
                         "PX",
                         Integer.to_string(@lock_ttl_ms)
                       ]) do
                    {:ok, "OK"} ->
                      # Reveal a letter
                      case WordManager.reveal_next_letter(room_id) do
                        {:ok, revealed_word} ->
                          # Broadcast the revealed letter to all players
                          Phoenix.PubSub.broadcast(
                            ScribblBackend.PubSub,
                            KeyManager.room_topic(room_id),
                            %{
                              event: "letter_reveal",
                              payload: %{
                                "revealed_word" => revealed_word
                              }
                            }
                          )

                          # Start a new timer for the next letter reveal
                          WordManager.start_reveal_timer(room_id)
                        _ -> :noop
                      end
                    _ -> :noop
                  end
                _ -> :noop
              end
            end
          _ -> :noop
        end
      _ -> :noop
    end
  end

  defp handle_timeout_logic(room_id, word) do
    # Send turn_over event with all necessary information
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      KeyManager.room_topic(room_id),
      %{
        event: "turn_over",
        payload: %{
          "reason" => "timeout",
          "word" => word
        }
      }
    )

    # clear the reveal timer
    RedisHelper.del(KeyManager.reveal_timer(room_id))

    # Start the next turn
    GameFlow.start(room_id)
  end

  defp node_id, do: Atom.to_string(Node.self())
end
