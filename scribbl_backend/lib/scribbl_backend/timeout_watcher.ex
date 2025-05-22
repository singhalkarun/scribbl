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
      {:ok, ref} ->
        IO.puts("Successfully subscribed! Ref: #{inspect(ref)}")

      {:error, reason} ->
        IO.puts("Failed to subscribe: #{inspect(reason)}")
    end

    {:ok, Map.put(state, :redix_pubsub, redix_pubsub) |> Map.put(:redis_channel, redis_channel)}
  end

  @impl true
  def handle_info(
        {:redix_pubsub, _pid, _sub, :message, %{channel: channel, payload: key}},
        %{redis_channel: channel} = state
      ) do
    IO.puts("Received message on channel #{inspect(channel)}: #{inspect(key)}")
    IO.inspect(state, label: "State")

    # Check if the channel in the message matches the redis_channel in the state
    if Regex.match?(~r/^room:\{.+\}:timer$/, key) do
      IO.puts("Channel matched! Handling expired key...")
      maybe_handle_expired_key(key)
    else
      IO.puts("Channel mismatch! Expected: #{state[:redis_channel]}, Got: #{channel}")
    end

    {:noreply, state}
  end

  # Handling subscription confirmation message
  @impl true
  def handle_info(
        {:redix_pubsub, _pid, _sub, :subscribed, %{channel: channel}},
        %{redis_channel: channel} = state
      ) do
    IO.puts("Successfully subscribed to channel: #{channel}")
    {:noreply, state}
  end

  def handle_info(msg, state) do
    IO.puts("Unexpected message: #{inspect(msg)}")
    IO.inspect(state, label: "State on Unexpected Message")
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
    IO.puts("Handling timeout logic for key: #{rest}")

    case String.trim_trailing(rest, "}:timer") do
      ^rest ->
        IO.puts("Invalid key format: #{rest}")
        :noop

      room_id ->
        IO.puts("Room ID: #{room_id}")

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
        IO.puts("Starting next turn for room: #{room_id}")
        GameHelper.start(room_id)
    end
  end

  defp handle_timeout_logic(_), do: :noop

  defp node_id, do: Atom.to_string(Node.self())
end
