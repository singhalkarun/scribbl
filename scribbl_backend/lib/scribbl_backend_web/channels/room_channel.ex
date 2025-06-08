defmodule ScribblBackendWeb.RoomChannel do
  use Phoenix.Channel
  alias ScribblBackendWeb.Presence
  alias ScribblBackend.GameState
  alias ScribblBackend.PlayerManager
  alias ScribblBackend.CanvasManager
  alias ScribblBackend.GameFlow
  alias ScribblBackend.WordManager
  alias ScribblBackend.KeyManager
  alias ScribblBackend.RedisHelper
  require Logger
  require IO

  def join("room:" <> room_id, %{"name" => name} = params, socket) do
    user_id = socket.assigns.user_id

    # Get or create the room first
    {:ok, room_info} = case GameState.get_room(room_id) do
      {:ok, info} ->
        # Room exists, return room info
        {:ok, info}
      {:error, "Room not found"} ->
        # Room doesn't exist, create a new one with specified or default settings
        # and make the first player the admin
        opts = case Map.get(params, "room_type") do
          nil -> []
          room_type -> [room_type: room_type]
        end
        GameState.create_room(room_id, user_id, opts)
    end

    # Check if the room is full BEFORE allowing join
    room_players_key = KeyManager.room_players(room_id)
    {:ok, current_player_count} = RedisHelper.scard(room_players_key)
    {:ok, is_already_member} = RedisHelper.sismember(room_players_key, user_id)

    if current_player_count >= String.to_integer(room_info.max_players) && is_already_member != 1 do
      # Room is full, reject the join completely
      {:error, %{reason: "Room is full"}}
    else
      # Room has space, allow the join
      # Track the user's presence via Phoenix Presence
      Presence.track(socket, socket.assigns.user_id, %{
        name: name,
        joined_at: :os.system_time(:milli_seconds)
      })

      # add the socket to user specific topic
      topic = "user:#{user_id}"
      Phoenix.PubSub.subscribe(ScribblBackend.PubSub, topic)

      # Schedule actions after the socket has finished joining
      send(self(), :after_join)

      {:ok, socket}
    end
  end

  def handle_info(:after_join, socket) do
    # Push presence state after join completes
    current_presences = Presence.list(socket)
    push(socket, "presence_state", current_presences)

    # get room info using game helper, only send room_id from topic
    room_id = String.split(socket.topic, ":") |> List.last()
    user_id = socket.assigns.user_id

    # Get room info (room should already exist since join/3 created it)
    {:ok, room_info} = GameState.get_room(room_id)

    # Add player to the room (capacity was already checked in join/3)
    PlayerManager.add_player(room_id, user_id)

    # Push the room info to the current socket
    push(socket, "room_info", room_info)

    # If game is active, send all players' scores and canvas data
    if room_info.status == "active" do
      # Get current drawer
      {:ok, current_drawer} = GameState.get_current_drawer(room_id)

      # Send drawer information to the joining player
      push(socket, "drawer_assigned", %{
        "round" => room_info.current_round,
        "drawer" => current_drawer
      })

      # If the user is not the drawer, send word length, revealed indices, and time remaining
      if user_id != current_drawer do
        # Get current word state (length and revealed indices)
        case WordManager.get_current_word_state(room_id) do
          {:ok, word_state} ->
            # Send turn started event with word length and time remaining
            push(socket, "turn_started", %{
              "word_length" => Integer.to_string(word_state.word_length),
              "time_remaining" => word_state.time_remaining
            })

            # Send letter reveal event with revealed word
            push(socket, "letter_reveal", %{"revealed_word" => word_state.revealed_word})

            # Send scores
            case PlayerManager.get_all_player_scores(room_id) do
              {:ok, scores} ->
                push(socket, "scores", %{"scores" => scores})
              _ -> :ok
            end

            # Send canvas data
            case CanvasManager.get_canvas(room_id) do
              {:ok, canvas} when not is_nil(canvas) ->
                push(socket, "drawing", %{"canvas" => canvas})
              _ -> :ok
            end
          _ -> :ok
        end
      end
    end

    {:noreply, socket}
  end

  def handle_info(%{event: "new_message", payload: payload}, socket) do
    push(socket, "new_message", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "start_game", payload: payload}, socket) do
    push(socket, "start_game", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "drawer_assigned", payload: payload}, socket) do
    push(socket, "drawer_assigned", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "select_word", payload: payload}, socket) do
    push(socket, "select_word", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "start_turn", payload: payload}, socket) do
    push(socket, "start_turn", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "error", payload: payload}, socket) do
    push(socket, "error", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "game_over", payload: payload}, socket) do
    push(socket, "game_over", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "turn_over", payload: payload}, socket) do
    push(socket, "turn_over", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "turn_end", payload: payload}, socket) do
    push(socket, "turn_end", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "correct_guess", payload: payload}, socket) do
    push(socket, "correct_guess", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "drawing", payload: payload}, socket) do
    push(socket, "drawing", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "turn_started", payload: payload}, socket) do
    push(socket, "turn_started", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "drawing_clear", payload: payload}, socket) do
    push(socket, "drawing_clear", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "score_updated", payload: payload}, socket) do
    push(socket, "score_updated", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "letter_reveal", payload: payload}, socket) do
    push(socket, "letter_reveal", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "room_settings_updated", payload: payload}, socket) do
    push(socket, "room_settings_updated", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "admin_changed", payload: payload}, socket) do
    push(socket, "admin_changed", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "webrtc_offer_received", payload: payload}, socket) do
    push(socket, "webrtc_offer_received", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "webrtc_answer_received", payload: payload}, socket) do
    push(socket, "webrtc_answer_received", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "webrtc_ice_candidate_received", payload: payload}, socket) do
    push(socket, "webrtc_ice_candidate_received", payload)
    {:noreply, socket}
  end

  def handle_info({:exclude_user, user_id_to_exclude, message}, socket) do
    # Only push the message to the socket if the user is not the one to exclude
    if socket.assigns.user_id != user_id_to_exclude do
      push(socket, message.event, message.payload)
    end
    {:noreply, socket}
  end

  # NEW WebRTC Signaling Handlers
  def handle_in("webrtc_offer", %{"target_user_id" => target_user_id, "offer" => offer_sdp, "from_user_id" => from_user_id}, socket) do
    Logger.debug("Received webrtc_offer from #{from_user_id} for #{target_user_id}")
    # Broadcast the offer to the target user's specific topic
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      "user:" <> target_user_id, # Target the specific user's topic
      %{
        event: "webrtc_offer_received",
        payload: %{
          "from_user_id" => from_user_id,
          "offer" => offer_sdp
        }
      }
    )
    {:noreply, socket}
  end

  def handle_in("webrtc_answer", %{"target_user_id" => target_user_id, "answer" => answer_sdp, "from_user_id" => from_user_id}, socket) do
    Logger.debug("Received webrtc_answer from #{from_user_id} for #{target_user_id}")
    # Broadcast the answer to the target user's specific topic
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      "user:" <> target_user_id, # Target the specific user's topic
      %{
        event: "webrtc_answer_received",
        payload: %{
          "from_user_id" => from_user_id,
          "answer" => answer_sdp
        }
      }
    )
    {:noreply, socket}
  end

  def handle_in("webrtc_ice_candidate", %{"target_user_id" => target_user_id, "candidate" => candidate, "from_user_id" => from_user_id}, socket) do
    Logger.debug("Received webrtc_ice_candidate from #{from_user_id} for #{target_user_id}")
    # Broadcast the ICE candidate to the target user's specific topic
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      "user:" <> target_user_id, # Target the specific user's topic
      %{
        event: "webrtc_ice_candidate_received",
        payload: %{
          "from_user_id" => from_user_id,
          "candidate" => candidate
        }
      }
    )
    {:noreply, socket}
  end
  # END NEW WebRTC Signaling Handlers

  def handle_in("drawing_clear", %{}, socket) do
    # Get the room ID from the socket topic
    room_id = String.split(socket.topic, ":") |> List.last()

    # Clear the canvas data
    CanvasManager.clear_canvas(room_id)

    # Broadcast the drawing clear event to all players in the room
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      socket.topic,
      %{
        event: "drawing_clear",
        payload: %{}
      }
    )

    {:noreply, socket}
  end

  def handle_in("new_message", %{"message" => message}, socket) do
    GameFlow.handle_guess(message, socket)
    {:noreply, socket}
  end

  # handle drawing events
  def handle_in(
        "drawing",
        %{
          "drawMode" => drawMode,
          "strokeColor" => strokeColor,
          "strokeWidth" => strokeWidth,
          "paths" => paths
        },
        socket
      ) do
    room_id = String.split(socket.topic, ":") |> List.last()

    # Create a new map with only the explicitly defined keys
    filtered_canvas_data = %{
      "drawMode" => drawMode,
      "strokeColor" => strokeColor,
      "strokeWidth" => strokeWidth,
      "paths" => paths
    }

    # save the canvas with only the filtered data
    CanvasManager.save_canvas(room_id, filtered_canvas_data)

    # broadcast the drawing to all players except sender with only the filtered data
    Phoenix.PubSub.broadcast_from!(ScribblBackend.PubSub, self(), socket.topic, %{
      event: "drawing",
      payload: %{
        "canvas" => [filtered_canvas_data]
      }
    })

    {:noreply, socket}
  end

  def handle_in("update_room_settings", %{
    "max_players" => max_players,
    "max_rounds" => max_rounds,
    "turn_time" => turn_time,
    "hints_allowed" => hints_allowed,
    "difficulty" => difficulty
  } = params, socket) do
    IO.inspect(params)
    room_id = String.split(socket.topic, ":") |> List.last()
    user_id = socket.assigns.user_id

    IO.puts("room_id: #{inspect(room_id)}")
    IO.puts("user_id: #{inspect(user_id)}")

    # Check if user is admin
    case GameState.get_room_admin(room_id) do
      {:ok, admin_id} when admin_id == user_id ->
        # User is the admin, validate and update settings
        {:ok, current_players} = PlayerManager.get_players(room_id)

        IO.puts("current_players: #{inspect(current_players)}")
        IO.puts("max_players: #{inspect(max_players)}")

        # Validate settings
        cond do
          length(current_players) > max_players ->
            # Can't set max_players less than current player count
            push(socket, "error", %{"message" => "Cannot set max players less than current player count"})

          max_rounds < 1 ->
            # Ensure at least 1 round
            push(socket, "error", %{"message" => "Must have at least 1 round"})

          turn_time < 30 ->
            # Ensure reasonable turn time (at least 30 seconds)
            push(socket, "error", %{"message" => "Turn time must be at least 30 seconds"})

          difficulty not in ["easy", "medium", "hard"] ->
            # Ensure valid difficulty level
            push(socket, "error", %{"message" => "Difficulty must be easy, medium, or hard"})

          Map.has_key?(params, "room_type") and params["room_type"] not in ["public", "private"] ->
            # Ensure valid room type if provided
            push(socket, "error", %{"message" => "Room type must be public or private"})

          true ->
            # All validations passed, update settings
            settings = %{
              max_players: max_players,
              max_rounds: max_rounds,
              turn_time: turn_time,
              hints_allowed: hints_allowed,
              difficulty: difficulty
            }

            # Add room_type if provided
            settings = if Map.has_key?(params, "room_type") do
              Map.put(settings, :room_type, params["room_type"])
            else
              settings
            end
            IO.puts("settings: #{inspect(settings)}")

            GameState.update_room_settings(room_id, settings)

            # Get updated room info
            {:ok, updated_room_info} = GameState.get_room(room_id)

            # Broadcast updated settings to all players in the room
            Phoenix.PubSub.broadcast(
              ScribblBackend.PubSub,
              socket.topic,
              %{
                event: "room_settings_updated",
                payload: updated_room_info
              }
            )
        end

      _ ->
        # User is not the admin
        push(socket, "error", %{"message" => "Only the room admin can update settings"})
    end

    {:noreply, socket}
  end

  def handle_in("start_game", _payload, socket) do
    room_id = String.split(socket.topic, ":") |> List.last()
    user_id = socket.assigns.user_id

    # Check if the user is the admin
    case GameState.get_room_admin(room_id) do
      {:ok, admin_id} when admin_id == user_id ->
        # User is the admin, start the game
        GameFlow.start(room_id)
        {:noreply, socket}

      _ ->
        # User is not the admin, send error
        push(socket, "error", %{"message" => "Only the room admin can start the game"})
        {:noreply, socket}
    end
  end

  def handle_in("start_turn", %{"word" => word}, socket) do
    room_id = String.split(socket.topic, ":") |> List.last()

    # Start the turn with the selected word
    {:ok, turn_info} = WordManager.start_turn(room_id, word)

    # Get current drawer to verify that the request is from the drawer
    {:ok, current_drawer} = GameState.get_current_drawer(room_id)

    if socket.assigns.user_id == current_drawer do
      # Broadcast turn started event to all players
      Phoenix.PubSub.broadcast(
        ScribblBackend.PubSub,
        socket.topic,
        %{
          event: "turn_started",
          payload: turn_info
        }
      )
    else
      # Send error to the user
      push(socket, "error", %{"message" => "You are not the drawer"})
    end

    {:noreply, socket}
  end

  # Catch-all to ignore any unhandled events
  def handle_in(_event, _payload, socket) do
    {:noreply, socket}
  end

  def terminate(_reason, socket) do
    # Get the room ID from the socket topic
    room_id = String.split(socket.topic, ":") |> List.last()
    user_id = socket.assigns.user_id

    # Remove the player from the room
    # PlayerManager.remove_player now handles drawer removal internally
    PlayerManager.remove_player(room_id, user_id)

    :ok
  end
end
