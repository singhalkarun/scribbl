defmodule ScribblBackend.GameState do
  @moduledoc """
  Handles the core game state operations for Scribbl.
  Extracts functionality from GameHelper related to room state management.
  """

  alias ScribblBackend.RedisHelper
  alias ScribblBackend.KeyManager
  alias ScribblBackend.PlayerManager

  @doc """
  Get a game room if it exists.
  If the room does not exist, it returns an error.

  ## Parameters
    - `room_id`: The ID of the room to get.

  ## Examples
      iex> ScribblBackend.GameState.get_room("room_1")
      {:ok, %{max_rounds: "3", current_round: "0", status: "waiting", current_drawer: "", admin_id: "user_123"}}

      iex> ScribblBackend.GameState.get_room("nonexistent_room")
      {:error, "Room not found"}
  """
  def get_room(room_id) do
    room_key = KeyManager.room_info(room_id)

    case RedisHelper.exists(room_key) do
      {:ok, 1} ->
        # room exists, return the room info
        {:ok, room_info} = RedisHelper.hgetall(room_key)

        room_info =
          Enum.chunk_every(room_info, 2)
          |> Enum.map(fn [k, v] -> {String.to_atom(k), v} end)
          |> Enum.into(%{})

        {:ok, room_info}

      {:ok, 0} ->
        # room does not exist
        {:error, "Room not found"}

      {:error, reason} ->
        # handle error
        {:error, reason}
    end
  end

  @doc """
  Create a new game room with specified options.
  If the room already exists, it returns an error.

  ## Parameters
    - `room_id`: The ID of the room to create.
    - `admin_id`: The ID of the user who will be the room admin.
    - `opts`: Optional parameters for room creation.

  ## Options
    - `:max_rounds`: The maximum number of rounds in the game. Default: 3.
    - `:max_players`: The maximum number of players allowed in the room. Default: 8.
    - `:turn_time`: The time in seconds for each drawing turn. Default: 80.
    - `:hints_allowed`: Whether hints (letter reveals) are allowed. Default: true.
    - `:difficulty`: The difficulty level of words ("easy", "medium", "hard"). Default: "medium".

  ## Examples
      iex> ScribblBackend.GameState.create_room("room_1", "user_123", max_rounds: 5, max_players: 6)
      {:ok, %{max_rounds: "5", current_round: "0", status: "waiting", current_drawer: "", admin_id: "user_123", max_players: "6", turn_time: "80", hints_allowed: "true", difficulty: "medium"}}
  """
  def create_room(room_id, admin_id, opts \\ []) do
    room_key = KeyManager.room_info(room_id)

    # Check if the room already exists
    case RedisHelper.exists(room_key) do
      {:ok, 1} ->
        # Room already exists
        {:error, "Room already exists"}

      {:ok, 0} ->
        # Default values
        max_rounds = Keyword.get(opts, :max_rounds, 3)
        max_players = Keyword.get(opts, :max_players, 8)
        turn_time = Keyword.get(opts, :turn_time, 60)
        hints_allowed = Keyword.get(opts, :hints_allowed, true)
        difficulty = Keyword.get(opts, :difficulty, "medium")

        # Create room with specified values
        {:ok, _} = RedisHelper.hmset(
          room_key,
          %{
            "max_rounds" => max_rounds,
            "current_round" => 0,
            "status" => "waiting",
            "current_drawer" => "",
            "admin_id" => admin_id,
            "max_players" => max_players,
            "turn_time" => turn_time,
            "hints_allowed" => hints_allowed,
            "difficulty" => difficulty
          }
        )

        # Return the room info
        {:ok, %{
          max_rounds: "#{max_rounds}",
          current_round: "0",
          status: "waiting",
          current_drawer: "",
          admin_id: "#{admin_id}",
          max_players: "#{max_players}",
          turn_time: "#{turn_time}",
          hints_allowed: "#{hints_allowed}",
          difficulty: "#{difficulty}"
        }}

      {:error, reason} ->
        # Handle error
        {:error, reason}
    end
  end

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

    # Preserve admin_id if it exists
    admin_id = case get_room_admin(room_id) do
      {:ok, id} when id != nil and id != "" -> id
      _ -> ""
    end

    # Preserve other settings if they exist
    {:ok, max_players} = RedisHelper.hget(KeyManager.room_info(room_id), "max_players") |> case do
      {:ok, value} when value != nil and value != "" -> {:ok, value}
      _ -> {:ok, "8"}
    end

    {:ok, turn_time} = RedisHelper.hget(KeyManager.room_info(room_id), "turn_time") |> case do
      {:ok, value} when value != nil and value != "" -> {:ok, value}
      _ -> {:ok, "60"}
    end

    {:ok, hints_allowed} = RedisHelper.hget(KeyManager.room_info(room_id), "hints_allowed") |> case do
      {:ok, value} when value != nil and value != "" -> {:ok, value}
      _ -> {:ok, "true"}
    end

    {:ok, difficulty} = RedisHelper.hget(KeyManager.room_info(room_id), "difficulty") |> case do
      {:ok, value} when value != nil and value != "" -> {:ok, value}
      _ -> {:ok, "medium"}
    end

    room_key = KeyManager.room_info(room_id)

    # Create room with preserved values
    {:ok, _} = RedisHelper.hmset(
      room_key,
      %{
        "max_rounds" => max_rounds,
        "current_round" => 0,
        "status" => "waiting",
        "current_drawer" => "",
        "admin_id" => admin_id,
        "max_players" => max_players,
        "turn_time" => turn_time,
        "hints_allowed" => hints_allowed,
        "difficulty" => difficulty
      }
    )

    # Return the room info
    {:ok, %{
      max_rounds: "#{max_rounds}",
      current_round: "0",
      status: "waiting",
      current_drawer: "",
      admin_id: "#{admin_id}",
      max_players: "#{max_players}",
      turn_time: "#{turn_time}",
      hints_allowed: "#{hints_allowed}",
      difficulty: "#{difficulty}"
    }}
  end

  @doc """
  Get the admin ID of a room.

  ## Parameters
    - `room_id`: The ID of the room to get the admin from.
  """
  def get_room_admin(room_id) do
    room_key = KeyManager.room_info(room_id)
    RedisHelper.hget(room_key, "admin_id")
  end

  @doc """
  Set the admin of a room.

  ## Parameters
    - `room_id`: The ID of the room to set the admin for.
    - `admin_id`: The ID of the user to set as the admin.
  """
  def set_room_admin(room_id, admin_id) do
    room_key = KeyManager.room_info(room_id)
    RedisHelper.hmset(room_key, %{"admin_id" => admin_id})
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
    # Clear all player scores first
    PlayerManager.clear_all_player_scores(room_id)

    # Delete the room info key
    room_info_key = KeyManager.room_info(room_id)
    RedisHelper.del(room_info_key)
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

  @doc """
  Update the settings of an existing room.
  Only works if the room is in the "waiting" status.

  ## Parameters
    - `room_id`: The ID of the room to update.
    - `settings`: A map containing the settings to update.

  ## Options in settings map
    - `:max_rounds`: The maximum number of rounds in the game.
    - `:max_players`: The maximum number of players allowed in the room.
    - `:turn_time`: The time in seconds for each drawing turn.
    - `:hints_allowed`: Whether hints (letter reveals) are allowed.
    - `:difficulty`: The difficulty level of words ("easy", "medium", "hard").

  ## Examples
      iex> ScribblBackend.GameState.update_room_settings("room_1", %{max_rounds: 5, max_players: 6})
      {:ok, %{max_rounds: "5", current_round: "0", status: "waiting", current_drawer: "", admin_id: "user_123", max_players: "6", turn_time: "60", hints_allowed: "true", difficulty: "medium"}}
  """
  def update_room_settings(room_id, settings) do
    room_key = KeyManager.room_info(room_id)

    # Check if the room exists
    case get_room(room_id) do
      {:ok, room_info} ->
        # Only allow updates if the room is in waiting status
        if room_info.status != "waiting" do
          {:error, "Cannot update settings for an active game"}
        else
          # Update only the specified settings
          updates = %{}

          updates = if Map.has_key?(settings, :max_rounds) do
            Map.put(updates, "max_rounds", settings.max_rounds)
          else
            updates
          end

          updates = if Map.has_key?(settings, :max_players) do
            Map.put(updates, "max_players", settings.max_players)
          else
            updates
          end

          updates = if Map.has_key?(settings, :turn_time) do
            Map.put(updates, "turn_time", settings.turn_time)
          else
            updates
          end

          updates = if Map.has_key?(settings, :hints_allowed) do
            Map.put(updates, "hints_allowed", settings.hints_allowed)
          else
            updates
          end

          updates = if Map.has_key?(settings, :difficulty) do
            Map.put(updates, "difficulty", settings.difficulty)
          else
            updates
          end

          if updates == %{} do
            # No changes
            {:ok, room_info}
          else
            # Apply updates
            {:ok, _} = RedisHelper.hmset(room_key, updates)

            # Return updated room info
            get_room(room_id)
          end
        end

      error ->
        error
    end
  end
end
