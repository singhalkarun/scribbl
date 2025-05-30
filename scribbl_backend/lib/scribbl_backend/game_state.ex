defmodule ScribblBackend.GameState do
  @moduledoc """
  Handles the core game state operations for Scribbl.
  Extracts functionality from GameHelper related to room state management.
  """

  alias ScribblBackend.RedisHelper
  alias ScribblBackend.KeyManager

  @doc """
  Get or initialize a game room.
  If the room already exists, it returns the room info.
  If the room does not exist, it creates a new room with default options.

  ## Parameters
    - `room_id`: The ID of the room to get or create.
    - `opts`: Optional parameters for room creation (e.g., max_rounds).

  ## Examples
      iex> ScribblBackend.GameState.get_or_initialize_room("room_1")
      {:ok, %{"max_rounds" => 3, "current_round" => 0, "status" => "waiting", "current_drawer" => ""}}
  """
  def get_or_initialize_room(room_id, opts \\ []) do
    room_key = KeyManager.room_info(room_id)

    # check if the room exists
    case RedisHelper.exists(room_key) do
      {:ok, 1} ->
        # room exists, return the room info
        {:ok, room_info} = RedisHelper.hgetall(room_key)

        room_info =
          Enum.chunk_every(room_info, 2)
          |> Enum.map(fn [k, v] -> {String.to_atom(k), v} end)
          |> Enum.into(%{})

        # If room is finished, reset the game state
        if room_info.status == "finished" do
          reset_game_state(room_id, opts)
        else
          {:ok, room_info}
        end

      {:ok, 0} ->
        # room does not exist, create a new room with default options
        reset_game_state(room_id, opts)

      {:error, reason} ->
        # handle error
        {:error, reason}
    end
  end

  @doc """
  Reset the game state for a room.

  ## Parameters
    - `room_id`: The ID of the room to reset.
    - `opts`: Optional parameters for room reset.
  """
  def reset_game_state(room_id, opts \\ []) do
    # Default values
    max_rounds = Keyword.get(opts, :max_rounds, 3)

    room_key = KeyManager.room_info(room_id)

    # Create room with default values
    {:ok, _} = RedisHelper.hmset(
      room_key,
      %{
        "max_rounds" => max_rounds,
        "current_round" => 0,
        "status" => "waiting",
        "current_drawer" => ""
      }
    )

    # Return the room info
    {:ok, %{
      max_rounds: "#{max_rounds}",
      current_round: "0",
      status: "waiting",
      current_drawer: ""
    }}
  end

  @doc """
  Get the current status of a room.

  ## Parameters
    - `room_id`: The ID of the room to get the status from.
  """
  def get_room_status(room_id) do
    room_key = KeyManager.room_info(room_id)
    RedisHelper.hget(room_key, "status")
  end

  @doc """
  Set the status of a room.

  ## Parameters
    - `room_id`: The ID of the room to set the status for.
    - `status`: The status to set.
  """
  def set_room_status(room_id, status) do
    room_key = KeyManager.room_info(room_id)
    RedisHelper.hmset(room_key, %{"status" => status})
  end

  @doc """
  Get the current drawer for a room.

  ## Parameters
    - `room_id`: The ID of the room to get the current drawer from.
  """
  def get_current_drawer(room_id) do
    room_key = KeyManager.room_info(room_id)
    RedisHelper.hget(room_key, "current_drawer")
  end

  @doc """
  Set the current drawer for a room.

  ## Parameters
    - `room_id`: The ID of the room to set the current drawer for.
    - `drawer`: The ID of the player to set as the current drawer.
  """
  def set_current_drawer(room_id, drawer) do
    room_key = KeyManager.room_info(room_id)
    RedisHelper.hmset(room_key, %{"current_drawer" => drawer})
  end

  @doc """
  Clean up a room's state. Removes all Redis keys associated with the room.

  ## Parameters
    - `room_id`: The ID of the room to clean up.
  """
  def cleanup_room(room_id) do
    # In a real implementation, we'd clean up all Redis keys for this room
    room_info_key = KeyManager.room_info(room_id)
    RedisHelper.delete(room_info_key)
  end

  @doc """
  Check if a room is empty and clean up if needed.

  ## Parameters
    - `room_id`: The ID of the room to check.
  """
  def check_and_cleanup_empty_room(room_id) do
    players_key = KeyManager.room_players(room_id)

    case RedisHelper.llen(players_key) do
      {:ok, 0} ->
        # Room is empty, clean up
        cleanup_room(room_id)
        :ok
      _ ->
        :ok
    end
  end
end
