defmodule ScribblBackendWeb.RoomChannel do
  use Phoenix.Channel
  alias ScribblBackendWeb.Presence
  alias ScribblBackend.GameHelper
  alias ScribblBackend.GameState
  alias ScribblBackend.PlayerManager
  alias ScribblBackend.CanvasManager
  alias ScribblBackend.GameFlow
  alias ScribblBackend.WordManager
  require Logger
  require IO

  def join("room:" <> _room_id, %{"name" => name}, socket) do
    # Track the user's presence via Phoenix Presence
    Presence.track(socket, socket.assigns.user_id, %{
      name: name,
      joined_at: :os.system_time(:seconds)
    })

    # add the socket to user specific topic
    user_id = socket.assigns.user_id
    topic = "user:#{user_id}"
    Phoenix.PubSub.subscribe(ScribblBackend.PubSub, topic)

    # Schedule actions after the socket has finished joining
    send(self(), :after_join)

    {:ok, socket}
  end

  def handle_info(:after_join, socket) do
    # Push presence state after join completes
    current_presences = Presence.list(socket)
    push(socket, "presence_state", current_presences)

    # get room info using game helper, only send room_id from topic
    room_id = String.split(socket.topic, ":") |> List.last()

    case GameState.get_or_initialize_room(room_id) do
      {:ok, room_info} ->
        # add player to the room
        user_id = socket.assigns.user_id
        PlayerManager.add_player(room_id, user_id)

        # Push the room info to the current socket
        push(socket, "room_info", room_info)

        # If game is active, send all players' scores and canvas data
        if room_info.status == "active" do
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
        end

      {:error, _reason} ->
        :ok
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

  def handle_info(%{event: "game_started", payload: payload}, socket) do
    push(socket, "game_started", payload)
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

  def handle_info({:exclude_user, user_id_to_exclude, message}, socket) do
    # Only push the message to the socket if the user is not the one to exclude
    if socket.assigns.user_id != user_id_to_exclude do
      push(socket, message.event, message.payload)
    end
    {:noreply, socket}
  end

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

  def handle_in("start_game", _payload, socket) do
    room_id = String.split(socket.topic, ":") |> List.last()

    # Start the game
    GameFlow.start(room_id)

    {:noreply, socket}
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
    PlayerManager.remove_player(room_id, user_id)

    # Get current room info to check status
    case GameHelper.get_or_initialize_room(room_id) do
      {:ok, room_info} ->
        # If game is finished, reset the room state
        if room_info.status == "finished" do
          # Reset the room with default options
          {:ok, _} = GameHelper.get_or_initialize_room(room_id, max_rounds: 3)
        end

        # Start the game
        GameHelper.start(room_id)

      {:error, _reason} ->
        push(socket, "error", %{"message" => "Failed to start game"})
    end

    :ok
  end
end
