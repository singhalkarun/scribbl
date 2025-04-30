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

        room_info =
          Enum.chunk_every(room_info, 2)
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
            "current_drawer" => ""
          }
        )

        # return the new room info
        {:ok, room_info} = RedisHelper.hgetall(room_key)

        room_info =
          Enum.chunk_every(room_info, 2)
          |> Enum.map(fn [k, v] -> {String.to_atom(k), v} end)
          |> Enum.into(%{})

        {:ok, room_info}

      {:error, reason} ->
        # handle error
        {:error, reason}
    end
  end

  # function to add player to the room
  @doc """
  Add a player to the game room.
  ## Parameters
    - `room_id`: The ID of the room to add the player to.
    - `player_id`: The ID of the player to add.
  ## Examples
      iex> ScribblBackend.GameHelper.add_player("room_1", "player_1")
      :ok
  """
  def add_player(room_id, player_id) do
    room_key = "#{@room_prefix}{#{room_id}}:players"

    # add the player to the room in the list of players
    RedisHelper.rpush(room_key, player_id)
  end

  # function to get the list of players in the room
  @doc """
  Get the list of players in the game room.
  ## Parameters
    - `room_id`: The ID of the room to get the players from.
  ## Examples
      iex> ScribblBackend.GameHelper.get_players("room_1")
      {:ok, ["player_1", "player_2"]}
  """
  def get_players(room_id) do
    room_key = "#{@room_prefix}{#{room_id}}:players"

    # get the list of players in the room
    RedisHelper.lrange(room_key)
  end

  # function to remove player from the room
  @doc """
  Remove a player from the game room.
  ## Parameters
    - `room_id`: The ID of the room to remove the player from.
    - `player_id`: The ID of the player to remove.
  ## Examples
      iex> ScribblBackend.GameHelper.remove_player("room_1", "player_1")
      :ok
  """
  def remove_player(room_id, player_id) do
    room_key = "#{@room_prefix}{#{room_id}}:players"

    # remove the player from the room in the list of players
    RedisHelper.lrem(room_key, player_id)
  end

  # start the game
  @doc """
  Start the game in the room.
  ## Parameters
    - `room_id`: The ID of the room to start the game in.
  ## Examples
      iex> ScribblBackend.GameHelper.start_game("room_1")
      :ok
  """
  def start_game(room_id) do
    room_key = "#{@room_prefix}{#{room_id}}:info"

    {:ok, current_round} = RedisHelper.hget(room_key, "current_round")

    # check if the current round is less than the max rounds

    {:ok, max_rounds} = RedisHelper.hget(room_key, "max_rounds")

    if String.to_integer(current_round) >= String.to_integer(max_rounds) do
      # end the game
      RedisHelper.hmset(
        room_key,
        %{
          "status" => "finished",
          "current_drawer" => ""
        }
      )

      {:error, "Game over"}
    else
      players_key = "#{@room_prefix}{#{room_id}}:players"

      # get the list of players in the room
      {:ok, players} = RedisHelper.lrange(players_key)

      # check if there are enough players to start the game
      if length(players) < 2 do
        {:error, "Not enough players to start the game"}
      else
        # add players to the eligible drawers set
        eligible_drawers_key = "#{@room_prefix}{#{room_id}}:round:#{String.to_integer(current_round) + 1}:eligible_drawers"

        RedisHelper.sadd(eligible_drawers_key, players)

        RedisHelper.hmset(
          room_key,
          %{
            "status" => "started",
            "current_round" => String.to_integer(current_round) + 1
          }
        )

        {:ok,
         %{
           "current_round" => String.to_integer(current_round) + 1,
           "status" => "started"
         }}
      end
    end
  end

  def allocate_drawer(room_id) do
    room_key = "#{@room_prefix}{#{room_id}}:info"

    # get the current round
    {:ok, current_round} = RedisHelper.hget(room_key, "current_round")
    # get the eligible drawers for the current round
    eligible_drawers_key = "#{@room_prefix}{#{room_id}}:round:#{current_round}:eligible_drawers"

    # check if there are eligible drawers
    {:ok, members} = RedisHelper.smembers(eligible_drawers_key)

    IO.puts("Eligible drawers: #{inspect(members)}")

    case RedisHelper.srandmember(eligible_drawers_key) do
      {:ok, nil} ->
        # No eligible drawers available
        {:error, "No eligible drawers available"}

      {:ok, drawer} ->

        # set the current drawer in the room info
        RedisHelper.hmset(
          room_key,
          %{
            "current_drawer" => drawer
          }
        )
        {:ok, drawer}
    end
  end

  def generate_word() do
    # This function should return a random word from the word list
    # For now, we will just return a placeholder word
    words = ["apple", "banana", "cherry", "date", "elderberry"]
    Enum.random(words)
  end
end
