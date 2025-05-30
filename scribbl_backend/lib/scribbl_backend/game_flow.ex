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

    # reset the non eligible guessers list at the start of each turn
    non_eligible_guessers_key = KeyManager.non_eligible_guessers(room_id, current_round)
    RedisHelper.del(non_eligible_guessers_key)

    # Set game status to active
    GameState.set_room_status(room_id, "active")

    case RedisHelper.spop(eligible_drawers_key) do
      {:ok, nil} ->
        # check if the current round is less than the max rounds
        if String.to_integer(current_round) >= String.to_integer(max_rounds) do
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

          # Clean up the room state
          GameState.cleanup_room(room_id)

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

          # get the list of players in the room
          {:ok, players} = RedisHelper.lrange(players_key)

          # add players to the eligible drawers set
          RedisHelper.sadd(eligible_drawers_key, players)

          RedisHelper.del(non_eligible_guessers_key)

          # trigger start function again
          start(room_id)
        end

      {:ok, drawer} ->
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
        words = WordManager.generate_words()

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
        # ignore the message if it's from the drawer
        {:noreply, socket}
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
                # broadcast the message
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
                # add user to non eligible guessers list
                PlayerManager.mark_player_guessed_correctly(room_id, user_id, round)

                # Get time remaining on the timer - this determines the score
                {:ok, time_remaining_seconds} = RedisHelper.ttl(room_timer_key)

                # Calculate the score to be awarded for this correct guess
                # Score is based on the time remaining. More time left = more points
                score_awarded_for_this_guess = max(0, time_remaining_seconds)

                # Update the guesser's score
                {:ok, guesser_new_total_score} = PlayerManager.update_player_score(room_id, user_id, score_awarded_for_this_guess)

                # Get count of players who have guessed correctly (including current one)
                non_eligible_guessers_key = KeyManager.non_eligible_guessers(room_id, round)
                {:ok, num_non_eligible_players} = RedisHelper.scard(non_eligible_guessers_key)

                # Drawer Scoring: Award points to the drawer based on how many players have guessed
                # and how quickly this particular player guessed.
                points_for_drawer_from_this_guess =
                  cond do
                    num_non_eligible_players == 1 -> score_awarded_for_this_guess # 100% for the 1st guesser
                    num_non_eligible_players == 2 -> round(score_awarded_for_this_guess * 0.5) # 50% for the 2nd
                    num_non_eligible_players == 3 -> round(score_awarded_for_this_guess * 0.25) # 25% for the 3rd
                    num_non_eligible_players >= 4 -> round(score_awarded_for_this_guess * 0.10) # 10% for 4th+
                    true -> 0 # Default case
                  end

                # Ensure points are non-negative
                actual_points_for_drawer = max(0, points_for_drawer_from_this_guess)

                if actual_points_for_drawer > 0 do
                  # Update drawer's score
                  {:ok, drawer_new_total_score} = PlayerManager.update_player_score(room_id, drawer, actual_points_for_drawer)

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

                # broadcast score update for guesser
                Phoenix.PubSub.broadcast(
                  ScribblBackend.PubSub,
                  socket.topic,
                  %{
                    event: "score_updated",
                    payload: %{
                      "user_id" => user_id,
                      "score" => guesser_new_total_score
                    }
                  }
                )

                # Check if all players have guessed correctly
                {:ok, num_players} = RedisHelper.llen(players_key)

                # Only proceed if we have at least 2 players (drawer + 1 guesser)
                if num_players >= 2 do
                  # Check if all players except the drawer have guessed correctly
                  if num_non_eligible_players == num_players - 1 do
                    check_all_guessed(room_id, drawer, round)
                  end
                end
              end
            else
              # broadcast the message
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
    {:ok, all_players} = RedisHelper.lrange(players_key)
    non_drawer_players = all_players -- [drawer]

    # Get all players who have guessed correctly
    {:ok, guessed_players} = RedisHelper.smembers(non_eligible_guessers_key)

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

      # Clear any remaining timers
      RedisHelper.del(KeyManager.turn_timer(room_id))
      RedisHelper.del(KeyManager.reveal_timer(room_id))

      # Start the next turn
      start(room_id)
    end
  end
end
