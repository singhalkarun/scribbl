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

  def start(room_id) do
    # get or initialize the room
    {:ok, room_info} = get_or_initialize_room(room_id)

    # extract room info
    current_round = room_info.current_round
    max_rounds = room_info.max_rounds

    # get eligible drawer for the current round
    eligible_drawers_key = "#{@room_prefix}{#{room_id}}:round:#{current_round}:eligible_drawers"
    room_key = "#{@room_prefix}{#{room_id}}:info"
    players_key = "#{@room_prefix}{#{room_id}}:players"

    case RedisHelper.spop(eligible_drawers_key) do
      {:ok, nil} ->
        # check if the current round is less than the max rounds
        if String.to_integer(current_round) >= String.to_integer(max_rounds) do
          # end the game
          RedisHelper.hmset(
            room_id,
            %{
              "status" => "finished",
              "current_drawer" => ""
            }
          )

          # send the game over event to all players
          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            "room:#{room_id}",
            %{
              event: "game_over",
              payload: %{}
            }
          )

          {:error, "Game over"}
        else
          # move to the next round
          RedisHelper.hmset(
            room_key,
            %{
              "current_round" => String.to_integer(current_round) + 1
            }
          )

          # set the eligible drawers for the next round
          eligible_drawers_key =
            "#{@room_prefix}{#{room_id}}:round:#{String.to_integer(current_round) + 1}:eligible_drawers"

          # get the list of players in the room
          {:ok, players} = RedisHelper.lrange(players_key)

          # add players to the eligible drawers set
          RedisHelper.sadd(eligible_drawers_key, players)

          # trigger start function again
          start(room_id)
        end

      {:ok, drawer} ->
        # set the current drawer in the room info
        RedisHelper.hmset(
          room_key,
          %{
            "current_drawer" => drawer
          }
        )

        # broadcast the drawer to all players
        Phoenix.PubSub.broadcast(
          ScribblBackend.PubSub,
          "room:#{room_id}",
          %{
            event: "drawer_assigned",
            payload: %{
              "round" => current_round,
              "drawer" => drawer
            }
          }
        )

        # generate a random word and send to the drawer
        word = generate_word()
        # send the word to the drawer
        Phoenix.PubSub.broadcast(
          ScribblBackend.PubSub,
          "user:#{drawer}",
          %{
            event: "select_word",
            payload: %{
              "word" => word
            }
          }
        )
    end
  end

  def generate_word() do
    # This function should return a random word from the word list
    # For now, we will just return a placeholder word
    words = ["apple", "banana", "cherry", "date", "elderberry"]
    Enum.random(words)
  end

  def start_turn(room_id, word) do
    room_word_key = "#{@room_prefix}{#{room_id}}:word"

    # set the word in Redis

    RedisHelper.set(
      room_word_key,
      word
    )

    room_timer_key = "#{@room_prefix}{#{room_id}}:timer"

    RedisHelper.set(
      room_word_key,
      word
    )

    # set the turn timer with lock and expiration
    RedisHelper.setex(
      room_timer_key,
      60,
      "active"
    )

    {:ok, %{"word_length" => Integer.to_string(String.length(word))}}
  end

  def get_current_drawer(room_id) do
    room_key = "#{@room_prefix}{#{room_id}}:info"

    # get the current drawer
    {:ok, current_drawer} = RedisHelper.hget(room_key, "current_drawer")

    {:ok, current_drawer}
  end

  def handle_guess(message, socket) do
    # check if the guess is correct
    room_id = String.split(socket.topic, ":") |> List.last()
    room_word_key = "#{@room_prefix}{#{room_id}}:word"
    room_key = "#{@room_prefix}{#{room_id}}:info"
    room_timer_key = "#{@room_prefix}{#{room_id}}:timer"
    user_id = socket.assigns.user_id
    players_key = "#{@room_prefix}{#{room_id}}:players"

    {:ok, drawer} = RedisHelper.hget(room_key, "current_drawer")
    {:ok, round} = RedisHelper.hget(room_key, "current_round")

    # print drawer and socket user id
    Logger.info("Drawer: #{drawer}, Socket User ID: #{user_id}")

    if drawer == socket.assigns.user_id do
      # ignore the message
      {:noreply, socket}
    else
      # get the word from Redis
      {:ok, word} = RedisHelper.get(room_word_key)

      # check if the guess is correct
      if String.downcase(message) == String.downcase(word) do
        # check if the user is not eligible to guess
        non_eligible_guessers_key = "#{@room_prefix}{#{room_id}}:#{round}::non_eligible_guessers"
        {:ok, is_non_eligible} = RedisHelper.sismember(non_eligible_guessers_key, user_id)

        if is_non_eligible == 1 do
          # ignore the message
          {:noreply, socket}
        else
          # send the correct guess event to all players and increase player score basis time when the guess was made
          # get the current time
          {:ok, current_time} = RedisHelper.ttl(room_timer_key)

          # calculate the score based on the time left and total time
          # Assuming the total time is 60 seconds
          total_time = 60
          time_left = total_time - current_time
          score = max(0, time_left)

          # increase the player score using incrby
          player_score_key = "#{@room_prefix}{#{room_id}}:player:#{user_id}:score"
          {:ok, player_score} = RedisHelper.incr(player_score_key, score)

          # add the player in non eligible guessers list, sadd takes key and list of values
          RedisHelper.sadd(non_eligible_guessers_key, List.wrap(user_id))

          # check if length of non eligible players is equal to total players
          {:ok, num_non_eligible_players} = RedisHelper.scard(non_eligible_guessers_key)
          {:ok, num_players} = RedisHelper.llen(players_key)

          if num_non_eligible_players == num_players - 1 do
            RedisHelper.expire(room_timer_key, 1)
          end

          # increase the drawer score
          drawer_score_key = "#{@room_prefix}{#{room_id}}:player:#{drawer}:score"
          {:ok, drawer_score} = RedisHelper.incr(drawer_score_key, current_time)

          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            socket.topic,
            %{
              event: "score_updated",
              payload: %{
                "user_id" => drawer,
                "score" => drawer_score
              }
            }
          )

          # send the score to all players
          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            socket.topic,
            %{
              event: "score_updated",
              payload: %{
                "user_id" => user_id,
                "score" => player_score
              }
            }
          )

          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            socket.topic,
            %{
              event: "correct_guess",
              payload: %{
                "user_id" => socket.assigns.user_id
              }
            }
          )
        end
      else
        # send the message to all players
        Phoenix.PubSub.broadcast(
          ScribblBackend.PubSub,
          socket.topic,
          %{
            event: "new_message",
            payload: %{
              "message" => message,
              "userId" => user_id
            }
          }
        )
      end
    end
  end
end
