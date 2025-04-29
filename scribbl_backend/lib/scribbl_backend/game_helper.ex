# module to manage game state

defmodule ScribblBackend.GameHelper do
  @moduledoc """
  High-level game operations interacting with Redis via RedisHelper.
  """

  alias ScribblBackend.RedisHelper
  require Logger

  @room_prefix "room:"

  # get the room info if exists or create a new room
  @doc """
  Get or initialize a game room.
  If the room already exists, it returns the room info.
  If the room does not exist, it creates a new room with default options.
  ## Parameters
    - `room_id`: The ID of the room to get or create.
    - `opts`: Optional parameters for room creation (e.g., max_rounds).
  ## Examples
      iex> ScribblBackend.GameHelper.get_or_initialize_room("room_1")
      {:ok, %{"max_rounds" => 3, "current_round" => 0, "status" => "waiting", "current_drawer" => ""}}
  """

  def get_or_initialize_room(room_id, opts \\ []) do
    room_key = "#{@room_prefix}{#{room_id}}:info"

    # check if the room exists
    case RedisHelper.exists(room_key) do
      {:ok, 1} ->
        # room exists, return the room info
        {:ok, room_info} = RedisHelper.hgetall(room_key)

        room_info = Enum.chunk_every(room_info, 2)
        |> Enum.map(fn [k, v] -> {String.to_atom(k), v} end)
        |> Enum.into(%{})

        {:ok, room_info}

      {:ok, 0} ->
        # room does not exist, create a new room with default options
        max_rounds = Keyword.get(opts, :max_rounds, 3)

        RedisHelper.hmset(
          room_key,
          %{
            "max_rounds" => max_rounds,
            "current_round" => 0,
            "status" => "waiting",
            "current_drawer" => "",
          }
        )

        # return the new room info
        room_info = RedisHelper.hgetall(room_key)

        {:ok, room_key}
      {:error, reason} ->
        # handle error
        {:error, reason}
    end
  end
end
