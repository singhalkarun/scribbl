defmodule ScribblBackend.TimeoutWatcher do
  @moduledoc """
  A GenServer that listens to Redis key expiration events and handles turn timeouts.
  """

  use GenServer
  alias ScribblBackend.RedisHelper
  alias ScribblBackend.GameHelper

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
        word_key = "room:{#{room_id}}:word"
        case RedisHelper.get(word_key) do
          {:ok, word} ->
            # Create a word-specific lock key
            lock_key = "lock:#{key}:#{word}"

            case Redix.command(:redix, [
                   "SET",
                   lock_key,
                   node_id(),
                   "NX",
                   "PX",
                   Integer.to_string(@lock_ttl_ms)
                 ]) do
              {:ok, "OK"} -> handle_timeout_logic(key)
              _ -> :noop
            end
          _ -> :noop
        end
      _ -> :noop
    end
  end

  defp handle_timeout_logic("room:{" <> rest) do
    case String.trim_trailing(rest, "}:timer") do
      ^rest ->
        :noop

      room_id ->
        # Get the current word before starting next turn
        room_word_key = "room:{#{room_id}}:word"
        {:ok, word} = RedisHelper.get(room_word_key)

        # Send turn_over event with all necessary information
        Phoenix.PubSub.broadcast(
          ScribblBackend.PubSub,
          "room:#{room_id}",
          %{
            event: "turn_over",
            payload: %{
              "reason" => "timeout",
              "word" => word
            }
          }
        )

        # Start the next turn
        GameHelper.start(room_id)
    end
  end

  defp handle_timeout_logic(_), do: :noop

  defp handle_letter_reveal("room:{" <> rest) do
    case String.trim_trailing(rest, "}:reveal_timer") do
      ^rest ->
        :noop

      room_id ->

        # Reveal a letter
        case ScribblBackend.GameHelper.reveal_next_letter(room_id) do
          {:ok, revealed_word} ->
            # Send the letter reveal event
            Phoenix.PubSub.broadcast(
              ScribblBackend.PubSub,
              "room:#{room_id}",
              %{
                event: "letter_reveal",
                payload: %{
                  "revealed_word" => revealed_word
                }
              }
            )

            # Start the next reveal timer
            GameHelper.start_reveal_timer(room_id)
          _ ->
            :noop
        end
    end
  end

  defp handle_letter_reveal(_), do: :noop

  defp node_id, do: Atom.to_string(Node.self())
end
