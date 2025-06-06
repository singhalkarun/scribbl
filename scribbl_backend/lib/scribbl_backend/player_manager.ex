defmodule ScribblBackend.PlayerManager do
  @moduledoc """
  Handles player-related operations for Scribbl.
  Extracts functionality from GameHelper related to player management.
  """

  alias ScribblBackend.RedisHelper
  alias ScribblBackend.GameState
  alias ScribblBackend.KeyManager
  alias ScribblBackend.WordManager
  alias ScribblBackend.GameFlow

  @doc """
  Add a player to the game room.

  ## Parameters
    - `room_id`: The ID of the room to add the player to.
    - `player_id`: The ID of the player to add.

  ## Examples
      iex> ScribblBackend.PlayerManager.add_player("room_1", "player_1")
      :ok
  """
    def add_player(room_id, player_id) do
    room_key = KeyManager.room_players(room_id)

    # Use Redis set - automatically prevents duplicates
    RedisHelper.sadd(room_key, player_id)

    # Check if room is now full and remove from public rooms if needed
    check_and_update_public_room_availability(room_id)
  end

  @doc """
  Get the list of players in the game room.

  ## Parameters
    - `room_id`: The ID of the room to get the players from.

  ## Examples
      iex> ScribblBackend.PlayerManager.get_players("room_1")
      {:ok, ["player_1", "player_2"]}
  """
  def get_players(room_id) do
    room_key = KeyManager.room_players(room_id)
    RedisHelper.smembers(room_key)
  end

  @doc """
  Remove a player from the game room.

  ## Parameters
    - `room_id`: The ID of the room to remove the player from.
    - `player_id`: The ID of the player to remove.

  ## Examples
      iex> ScribblBackend.PlayerManager.remove_player("room_1", "player_1")
      :ok
  """
  def remove_player(room_id, player_id) do
    room_key = KeyManager.room_players(room_id)
    RedisHelper.srem(room_key, player_id)

    # Check if the removed player was the drawer
    {:ok, current_drawer} = GameState.get_current_drawer(room_id)
    if player_id == current_drawer do
      handle_drawer_removal(room_id)
    end

    # Check if the removed player was the admin
    {:ok, room_info} = GameState.get_room(room_id)

    # Only check for admin reassignment if the game hasn't started yet
    if room_info.status == "waiting" && player_id == room_info.admin_id do
      handle_admin_removal(room_id)
    end

    # Check if only one player remains in an active game
    {:ok, remaining_players} = get_players(room_id)
    if length(remaining_players) == 1 && room_info.status == "active" do
      # End the game since only one player remains
      GameState.set_room_status(room_id, "finished")
      GameState.set_current_drawer(room_id, "")

      # Clear all player scores before ending the game
      clear_all_player_scores(room_id)

      # send the game over event to all players
      Phoenix.PubSub.broadcast(
        ScribblBackend.PubSub,
        KeyManager.room_topic(room_id),
        %{
          event: "game_over",
          payload: %{}
        }
      )

      # Clean up the room state
      GameState.reset_game_state(room_id)
    end

    # Check if room now has available slots and add back to public rooms if needed
    check_and_update_public_room_availability(room_id)

    # Check if room is empty and clean up if needed
    GameState.check_and_cleanup_empty_room(room_id)
  end

  @doc """
  Handle the scenario when the admin leaves the game before it starts.
  Randomly selects a new admin from the remaining players.

  ## Parameters
    - `room_id`: The ID of the room where the admin left.
  """
  def handle_admin_removal(room_id) do
    # Get the list of remaining players
    case get_players(room_id) do
      {:ok, []} ->
        # No players left, no need to assign new admin
        :ok

      {:ok, players} ->
        # Choose a random player as the new admin
        new_admin = Enum.random(players)

        # Set the new admin
        GameState.set_room_admin(room_id, new_admin)

        # Broadcast the admin change to all players
        Phoenix.PubSub.broadcast(
          ScribblBackend.PubSub,
          KeyManager.room_topic(room_id),
          %{
            event: "admin_changed",
            payload: %{
              "admin_id" => new_admin
            }
          }
        )

      _ -> :ok
    end
  end

  @doc """
  Handle the scenario when the drawer leaves the game.

  ## Parameters
    - `room_id`: The ID of the room where the drawer left.
  """
  def handle_drawer_removal(room_id) do
    # Get current word (if any) to end the turn properly
    case WordManager.get_current_word(room_id) do
      {:ok, word} when not is_nil(word) ->
        # End the turn
        Phoenix.PubSub.broadcast(
          ScribblBackend.PubSub,
          KeyManager.room_topic(room_id),
          %{
            event: "turn_over",
            payload: %{
              "reason" => "drawer_left",
              "word" => word
            }
          }
        )

        # Clear any remaining timers
        RedisHelper.del(KeyManager.turn_timer(room_id))
        RedisHelper.del(KeyManager.reveal_timer(room_id))

        # clear the current word
        RedisHelper.del(KeyManager.current_word(room_id))
        RedisHelper.del(KeyManager.revealed_indices(room_id))

        # Start the next turn
        GameFlow.start(room_id)
      _ ->
        # No word was set yet or there was an error, just start the next turn
        GameFlow.start(room_id)
    end
  end

  @doc """
  Get scores for all players in a room.

  ## Parameters
    - `room_id`: The ID of the room to get scores from.

  ## Returns
    A map of player IDs to their scores.
  """
  def get_all_player_scores(room_id) do
    case get_players(room_id) do
      {:ok, players} ->
        scores = Enum.map(players, fn player_id ->
          player_score_key = KeyManager.player_score(room_id, player_id)
          case RedisHelper.get(player_score_key) do
            {:ok, score} when is_binary(score) -> {player_id, String.to_integer(score)}
            {:ok, nil} -> {player_id, 0}
            _ -> {player_id, 0}
          end
        end)
        {:ok, Map.new(scores)}
      error -> error
    end
  end

  @doc """
  Update a player's score.

  ## Parameters
    - `room_id`: The ID of the room.
    - `player_id`: The ID of the player.
    - `score`: The score to add.
  """
  def update_player_score(room_id, player_id, score) do
    player_score_key = KeyManager.player_score(room_id, player_id)

    case RedisHelper.get(player_score_key) do
      {:ok, current_score} when is_binary(current_score) ->
        new_score = String.to_integer(current_score) + score
        RedisHelper.set(player_score_key, new_score)
        {:ok, new_score}

      {:ok, nil} ->
        RedisHelper.set(player_score_key, score)
        {:ok, score}

      error ->
        error
    end
  end

  @doc """
  Mark a player as having guessed correctly in the current round.

  ## Parameters
    - `room_id`: The ID of the room.
    - `player_id`: The ID of the player who guessed correctly.
    - `round`: The current round number.
  """
  def mark_player_guessed_correctly(room_id, player_id, round) do
    non_eligible_guessers_key = KeyManager.non_eligible_guessers(room_id, round)
    RedisHelper.sadd(non_eligible_guessers_key, [player_id])
  end

  @doc """
  Check if a player has already guessed correctly in the current round.

  ## Parameters
    - `room_id`: The ID of the room.
    - `player_id`: The ID of the player to check.
    - `round`: The current round number.
  """
  def has_player_guessed_correctly?(room_id, player_id, round) do
    non_eligible_guessers_key = KeyManager.non_eligible_guessers(room_id, round)
    case RedisHelper.sismember(non_eligible_guessers_key, player_id) do
      {:ok, 1} -> true
      _ -> false
    end
  end

  @doc """
  Clear all player scores for a room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Examples
      iex> ScribblBackend.PlayerManager.clear_all_player_scores("room_1")
      :ok
  """
  def clear_all_player_scores(room_id) do
    # Get all keys matching the player score pattern for this room
    player_score_pattern = "#{KeyManager.player_score(room_id, "*")}"
    case RedisHelper.keys(player_score_pattern) do
      {:ok, keys} when is_list(keys) and length(keys) > 0 ->
        # Delete each score key
        Enum.each(keys, fn key ->
          RedisHelper.del(key)
        end)
        :ok
      _ ->
        # No keys found or error
        :ok
    end
  end

  @doc """
  Reset all player scores to 0 and broadcast them to all players in the room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Examples
      iex> ScribblBackend.PlayerManager.reset_and_broadcast_scores("room_1")
      :ok
  """
  def reset_and_broadcast_scores(room_id) do
    # First clear all existing scores
    clear_all_player_scores(room_id)

    # Get all players in the room
    case get_players(room_id) do
      {:ok, players} when is_list(players) and length(players) > 0 ->
        # Set each player's score to 0 and broadcast it
        Enum.each(players, fn player_id ->
          player_score_key = KeyManager.player_score(room_id, player_id)
          RedisHelper.set(player_score_key, 0)

          # Broadcast score update for each player
          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            KeyManager.room_topic(room_id),
            %{
              event: "score_updated",
              payload: %{
                "user_id" => player_id,
                "score" => 0
              }
            }
          )
        end)

        :ok
      _ ->
        # No players found or error
        :ok
    end
  end

    @doc """
  Check if a room's availability has changed and update the public rooms set accordingly.
  This should be called whenever players join or leave a room.

  ## Parameters
    - `room_id`: The ID of the room to check.
  """
  def check_and_update_public_room_availability(room_id) do
    case GameState.get_room(room_id) do
      {:ok, room_info} ->
        # Only manage public rooms
        if room_info.room_type == "public" do
          room_key = KeyManager.room_players(room_id)
          case RedisHelper.scard(room_key) do
            {:ok, current_players} ->
              max_players = String.to_integer(room_info.max_players)

              if current_players >= max_players do
                # Room is full, remove from public rooms
                GameState.remove_from_public_rooms(room_id)
              else
                # Room has available slots, add to public rooms
                GameState.add_to_public_rooms(room_id)
              end
            _ -> :ok
          end
        end
      _ -> :ok
    end
  end
end
