defmodule ScribblBackend.GameFlow do
  @moduledoc """
  Handles game flow operations like starting the game, managing turns, and game progression.
  Extracts core game flow functionality from GameHelper.
  """

  alias ScribblBackend.RedisHelper
  alias ScribblBackend.GameState
  alias ScribblBackend.PlayerManager
  alias ScribblBackend.WordManager
  alias ScribblBackend.KeyManager
  alias ScribblBackend.WordSimilarity

  # Timer duration constants (in seconds)
  @word_selection_timeout 10
  @turn_transition_delay 3

  # Scoring constants
  @base_points 50
  @speed_bonus_max 50
  @rank_bonus_map %{1 => 30, 2 => 20, 3 => 10, 4 => 5}
  @drawer_multiplier %{1 => 0.60, 2 => 0.50, 3 => 0.40, 4 => 0.30}
  @drawer_multiplier_default 0.20
  @all_guessed_bonus 40

  @doc """
  Start the game in a room.

  ## Parameters
    - `room_id`: The ID of the room to start the game in.
  """
  def start(room_id) do
    # get or initialize the room
    {:ok, room_info} = GameState.get_or_initialize_room(room_id)

    # extract room info
    current_round = room_info.current_round
    max_rounds = room_info.max_rounds

    # get eligible drawer for the current round
    eligible_drawers_key = KeyManager.eligible_drawers(room_id, current_round)
    room_key = KeyManager.room_info(room_id)
    players_key = KeyManager.room_players(room_id)

    # If this is the first round (0), reset and broadcast all scores to 0
    if String.to_integer(current_round) == 0 do
      PlayerManager.reset_and_broadcast_scores(room_id)
    end

    # reset the non eligible guessers list at the start of each turn
    non_eligible_guessers_key = KeyManager.non_eligible_guessers(room_id, current_round)
    RedisHelper.del(non_eligible_guessers_key)

    # Set game status to active
    GameState.set_room_status(room_id, "active")

    case RedisHelper.spop(eligible_drawers_key) do
      {:ok, nil} ->
        # check if the current round is less than the max rounds
        if String.to_integer(current_round) >= String.to_integer(max_rounds) do
          # Clear all player scores before ending the game
          PlayerManager.clear_all_player_scores(room_id)
          # Clear all player streaks before ending the game
          PlayerManager.clear_all_player_streaks(room_id)

          # end the game
          GameState.set_room_status(room_id, "finished")
          GameState.set_current_drawer(room_id, "")

          # send the game over event to all players
          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            KeyManager.room_topic(room_id),
            %{
              event: "game_over",
              payload: %{}
            }
          )

          # Clean up all game-related timers before game over
          cleanup_game_timers(room_id)

          # Clean up the room state
          GameState.reset_game_state(room_id)

          {:error, "Game over"}
        else
          # move to the next round
          next_round = String.to_integer(current_round) + 1
          RedisHelper.hmset(
            room_key,
            %{
              "current_round" => next_round
            }
          )

          # set the eligible drawers for the next round
          eligible_drawers_key = KeyManager.eligible_drawers(room_id, next_round)

          # get the set of players in the room
          {:ok, players} = RedisHelper.smembers(players_key)

          # add players to the eligible drawers set
          RedisHelper.sadd(eligible_drawers_key, players)

          RedisHelper.del(non_eligible_guessers_key)

          # trigger start function again
          start(room_id)
        end

      {:ok, drawer} ->
        # Validate that the selected drawer is still in the room
        {:ok, current_players} = RedisHelper.smembers(players_key)

        if Enum.member?(current_players, drawer) do
          # Drawer is still in the room, proceed normally
          # set the current drawer in the room info
          GameState.set_current_drawer(room_id, drawer)

          # broadcast the drawer to all players
          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            KeyManager.room_topic(room_id),
            %{
              event: "drawer_assigned",
              payload: %{
                "round" => current_round,
                "drawer" => drawer
              }
            }
          )

          # generate a random word and send to the drawer
          words = WordManager.generate_words(room_id)

          # Set up word selection timer for automatic selection
          setup_word_selection_timer(room_id, words)

          # send the word to the drawer
          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            KeyManager.user_topic(drawer),
            %{
              event: "select_word",
              payload: %{
                "words" => words
              }
            }
          )
        else
          # Drawer has left the room, remove them from eligible drawers and try again
          IO.puts("[GameFlow] Selected drawer #{drawer} is no longer in room #{room_id}, removing from eligible drawers and retrying")
          RedisHelper.srem(eligible_drawers_key, drawer)
          # Recursively call start again to pick a new drawer
          start(room_id)
        end
    end
  end



  @doc """
  Handle a player's guess.

  ## Parameters
    - `message`: The message containing the guess.
    - `socket`: The socket representing the connection.
  """
  def handle_guess(message, socket) do
    # check if the guess is correct
    room_id = String.split(socket.topic, ":") |> List.last()
    room_key = KeyManager.room_info(room_id)
    user_id = socket.assigns.user_id

    # First, check game status
    {:ok, status} = RedisHelper.hget(room_key, "status")

    # If game is not active, just broadcast the message
    if status != "active" do
      Phoenix.PubSub.broadcast(
        ScribblBackend.PubSub,
        socket.topic,
        %{
          event: "new_message",
          payload: %{
            "message" => message,
            "user_id" => user_id
          }
        }
      )
      {:noreply, socket}
    else
      # Game is active, proceed with normal guess handling
      players_key = KeyManager.room_players(room_id)

      {:ok, drawer} = GameState.get_current_drawer(room_id)
      {:ok, round} = RedisHelper.hget(room_key, "current_round")
      room_timer_key = KeyManager.turn_timer(room_id)

      if drawer == socket.assigns.user_id do
        # Handle drawer messages: broadcast them except when they send the target word
        case WordManager.get_current_word(room_id) do
          {:ok, nil} ->
            # If no word is set, broadcast the drawer's message
            Phoenix.PubSub.broadcast(
              ScribblBackend.PubSub,
              socket.topic,
              %{
                event: "new_message",
                payload: %{
                  "message" => message,
                  "user_id" => user_id
                }
              }
            )
            {:noreply, socket}

          {:ok, word} ->
            # Check if the drawer is sending the target word (case insensitive)
            if String.downcase(message) == String.downcase(word) do
              # Ignore the message if drawer sends the target word
              {:noreply, socket}
            else
              # Broadcast the drawer's message since it's not the target word
              Phoenix.PubSub.broadcast(
                ScribblBackend.PubSub,
                socket.topic,
                %{
                  event: "new_message",
                  payload: %{
                    "message" => message,
                    "user_id" => user_id
                  }
                }
              )
              {:noreply, socket}
            end

          _error ->
            # If there's an error getting the word, broadcast the drawer's message
            Phoenix.PubSub.broadcast(
              ScribblBackend.PubSub,
              socket.topic,
              %{
                event: "new_message",
                payload: %{
                  "message" => message,
                  "user_id" => user_id
                }
              }
            )
            {:noreply, socket}
        end
      else
        # get the word from Redis
        case WordManager.get_current_word(room_id) do
          {:ok, nil} ->
            # If no word is set, just broadcast the message
            Phoenix.PubSub.broadcast(
              ScribblBackend.PubSub,
              socket.topic,
              %{
                event: "new_message",
                payload: %{
                  "message" => message,
                  "user_id" => user_id
                }
              }
            )
            {:noreply, socket}

          {:ok, word} ->
            # check if the guess is correct
            if String.downcase(message) == String.downcase(word) do
              # check if the user has already guessed the word
              already_guessed = PlayerManager.has_player_guessed_correctly?(room_id, user_id, round)

              if already_guessed do
                # do nothing
                {:noreply, socket}
              else
                # add user to non eligible guessers list
                PlayerManager.mark_player_guessed_correctly(room_id, user_id, round)

                # Get time remaining on the timer - this determines the score
                {:ok, time_remaining_seconds} = RedisHelper.ttl(room_timer_key)

                # Fetch turn_time from room info (default 60 if not set)
                {:ok, room_info} = GameState.get_room(room_id)
                turn_time = case room_info.turn_time do
                  nil -> 60
                  "" -> 60
                  t -> String.to_integer(t)
                end

                # Calculate speed bonus based on time remaining
                speed_bonus = round((time_remaining_seconds / turn_time) * @speed_bonus_max)

                # Get count of players who have guessed correctly (including current one)
                non_eligible_guessers_key = KeyManager.non_eligible_guessers(room_id, round)
                {:ok, num_non_eligible_players} = RedisHelper.scard(non_eligible_guessers_key)

                # Order of this guesser (1-based)
                rank = num_non_eligible_players  # already includes current guesser
                rank_bonus = Map.get(@rank_bonus_map, rank, 0)

                # When a player guesses correctly, increment their streak
                {:ok, streak} = PlayerManager.increment_player_streak(user_id)
                streak_bonus = min(streak * 10, 30)

                # Calculate guesser's points (including streak bonus)
                guesser_points = @base_points + speed_bonus + rank_bonus + streak_bonus

                # Update the guesser's score
                {:ok, guesser_new_total_score} = PlayerManager.update_player_score(room_id, user_id, guesser_points)

                # Drawer earns a fraction that decreases as more people guess
                drawer_mult = Map.get(@drawer_multiplier, rank, @drawer_multiplier_default)
                drawer_points = round(guesser_points * drawer_mult)
                # Ensure positive
                drawer_points = max(0, drawer_points)

                if drawer_points > 0 do
                  # Update drawer's score
                  {:ok, drawer_new_total_score} = PlayerManager.update_player_score(room_id, drawer, drawer_points)

                  # Broadcast score update for drawer
                  Phoenix.PubSub.broadcast(
                    ScribblBackend.PubSub,
                    socket.topic,
                    %{
                      event: "score_updated",
                      payload: %{
                        "user_id" => drawer,
                        "score" => drawer_new_total_score
                      }
                    }
                  )
                end

                # broadcast correct guess event
                Phoenix.PubSub.broadcast(
                  ScribblBackend.PubSub,
                  socket.topic,
                  %{
                    event: "correct_guess",
                    payload: %{
                      "user_id" => user_id
                    }
                  }
                )

                # broadcast score update for guesser, including streak bonus
                Phoenix.PubSub.broadcast(
                  ScribblBackend.PubSub,
                  socket.topic,
                  %{
                    event: "score_updated",
                    payload: %{
                      "user_id" => user_id,
                      "score" => guesser_new_total_score,
                      "streak_bonus" => streak_bonus,
                      "streak" => streak
                    }
                  }
                )

                # Check if all players have guessed correctly
                {:ok, num_players} = RedisHelper.scard(players_key)

                # Only proceed if we have at least 2 players (drawer + 1 guesser)
                if num_players >= 2 do
                  # Check if all players except the drawer have guessed correctly
                  if num_non_eligible_players == num_players - 1 do
                    # All players have guessed correctly, award bonus to drawer
                    {:ok, drawer_current_score} = PlayerManager.get_player_score(room_id, drawer)
                    {:ok, _} = PlayerManager.update_player_score(room_id, drawer, @all_guessed_bonus)

                    # Broadcast updated drawer score with all-guessed bonus
                    Phoenix.PubSub.broadcast(
                      ScribblBackend.PubSub,
                      socket.topic,
                      %{
                        event: "score_updated",
                        payload: %{
                          "user_id" => drawer,
                          "score" => drawer_current_score + @all_guessed_bonus
                        }
                      }
                    )

                    check_all_guessed(room_id, drawer, round)
                  end
                end

                # After turn ends, for all players who did NOT guess correctly, reset their streak to 0. (This will be handled in check_all_guessed.)
              end
            else
              # Check if the guess is similar to the actual word
              if WordSimilarity.similar?(message, word) do
                # Broadcast similar word event
                Phoenix.PubSub.broadcast(
                  ScribblBackend.PubSub,
                  socket.topic,
                  %{
                    event: "similar_word",
                    payload: %{
                      "user_id" => user_id,
                      "message" => message
                    }
                  }
                )

                # Also broadcast the regular message so it appears in chat
                Phoenix.PubSub.broadcast(
                  ScribblBackend.PubSub,
                  socket.topic,
                  %{
                    event: "new_message",
                    payload: %{
                      "message" => message,
                      "user_id" => user_id
                    }
                  }
                )
              else
                # broadcast the regular message
                Phoenix.PubSub.broadcast(
                  ScribblBackend.PubSub,
                  socket.topic,
                  %{
                    event: "new_message",
                    payload: %{
                      "message" => message,
                      "user_id" => user_id
                    }
                  }
                )
              end
            end

            {:noreply, socket}

          _error ->
            # If there's an error getting the word, just broadcast the message
            Phoenix.PubSub.broadcast(
              ScribblBackend.PubSub,
              socket.topic,
              %{
                event: "new_message",
                payload: %{
                  "message" => message,
                  "user_id" => user_id
                }
              }
            )
            {:noreply, socket}
        end
      end
    end
  end

  defp check_all_guessed(room_id, drawer, round) do
    players_key = KeyManager.room_players(room_id)
    non_eligible_guessers_key = KeyManager.non_eligible_guessers(room_id, round)

    # Get all players except the drawer
    {:ok, all_players} = RedisHelper.smembers(players_key)
    non_drawer_players = all_players -- [drawer]

    # Get all players who have guessed correctly
    {:ok, guessed_players} = RedisHelper.smembers(non_eligible_guessers_key)

    # Reset streak for all non-drawer players who did NOT guess correctly
    missed_players = non_drawer_players -- guessed_players
    # Only reset streak for missed guessers, not the drawer
    Enum.each(missed_players, fn player_id ->
      PlayerManager.reset_player_streak(player_id)
    end)

    # Check if all non-drawer players have guessed correctly
    if length(non_drawer_players) > 0 && length(guessed_players) >= length(non_drawer_players) do
      # Get the current word
      {:ok, word} = WordManager.get_current_word(room_id)

      # End the turn
      Phoenix.PubSub.broadcast(
        ScribblBackend.PubSub,
        KeyManager.room_topic(room_id),
        %{
          event: "turn_over",
          payload: %{
            "reason" => "all_guessed",
            "word" => word
          }
        }
      )

      # Clear current word and revealed indices for the completed turn
      RedisHelper.del(KeyManager.current_word(room_id))
      RedisHelper.del(KeyManager.revealed_indices(room_id))

      # Clear any remaining timers
      RedisHelper.del(KeyManager.turn_timer(room_id))
      RedisHelper.del(KeyManager.reveal_timer(room_id))

      # Start the next turn after 3 seconds to allow turn over modal to finish
      start_delayed(room_id)
    end
  end

  @doc """
  Check if all eligible players have guessed after a player leaves.
  This is called when a non-drawer player leaves during an active game.

  ## Parameters
    - `room_id`: The ID of the room.
    - `drawer`: The current drawer's ID.
    - `round`: The current round number.
  """
  def check_if_all_guessed_after_player_left(room_id, drawer, round) do
    # Simply call the existing check_all_guessed function
    # It already handles all the logic we need
    check_all_guessed(room_id, drawer, round)
  end

  @doc """
  Start the next turn after a 3-second delay.
  This allows the frontend turn over modal to complete before showing word selection.
  Uses Redis key expiration for reliability across container restarts.

  ## Parameters
    - `room_id`: The ID of the room to start the next turn in.
  """
  def start_delayed(room_id) do
    # Set a Redis key that expires after the transition delay
    # TimeoutWatcher will handle the expiration and start the next turn
    turn_transition_timer_key = KeyManager.turn_transition_timer(room_id)
    RedisHelper.setex(turn_transition_timer_key, @turn_transition_delay, "start_next_turn")
  end

    # Set up the word selection timer with the available words stored in Redis.
  defp setup_word_selection_timer(room_id, words) do
    word_selection_timer_key = KeyManager.word_selection_timer(room_id)
    words_json = Jason.encode!(words)
    RedisHelper.setex(word_selection_timer_key, @word_selection_timeout, words_json)
  end

  @doc """
  Clean up all game-related timers for a room.
  This should be called when the game ends to prevent any timers from firing after game over.

  ## Parameters
    - `room_id`: The ID of the room to clean up timers for.
  """
  def cleanup_game_timers(room_id) do
    # Clean up all possible active timers
    RedisHelper.del(KeyManager.turn_timer(room_id))
    RedisHelper.del(KeyManager.reveal_timer(room_id))
    RedisHelper.del(KeyManager.word_selection_timer(room_id))
    RedisHelper.del(KeyManager.turn_transition_timer(room_id))
  end
end
