defmodule ScribblBackendWeb.RoomChannel do
  use Phoenix.Channel
  alias ScribblBackendWeb.Presence
  alias ScribblBackend.GameHelper
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

    case GameHelper.get_or_initialize_room(room_id) do
      {:ok, room_info} ->
        # add player to the room

        user_id = socket.assigns.user_id
        GameHelper.add_player(room_id, user_id)

        # Push the room info to the current socket

        push(socket, "room_info", room_info)

      {:error, reason} ->
        # Handle error (e.g., log it)
        IO.puts("Error getting room info: #{reason}")
    end

    {:noreply, socket}
  end

  def handle_info(%{event: "new_message", payload: payload}, socket) do
    # Push the message to the current socket
    push(socket, "new_message", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "start_game", payload: payload}, socket) do
    # Push the start game event to the current socket
    push(socket, "start_game", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "game_started", payload: payload}, socket) do
    # Push the game started event to the current socket
    push(socket, "game_started", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "drawer_assigned", payload: payload}, socket) do
    # Push the drawer assigned event to the current socket
    push(socket, "drawer_assigned", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "select_word", payload: payload}, socket) do
    # Push the word assigned event to the current socket
    push(socket, "select_word", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "error", payload: payload}, socket) do
    # Push the error event to the current socket
    push(socket, "error", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "game_over", payload: payload}, socket) do
    # Push the game over event to the current socket
    push(socket, "game_over", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "turn_over", payload: payload}, socket) do
    # Push the turn over event to the current socket
    push(socket, "turn_over", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "drawing", payload: payload}, socket) do
    # Push the drawing event to the current socket
    push(socket, "drawing", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "turn_started", payload: payload}, socket) do
    # Push the turn started event to the current socket
    push(socket, "turn_started", payload)
    {:noreply, socket}
  end

  def handle_in("new_message", %{"message" => message}, socket) do
    user_id = socket.assigns.user_id

    # Broadcast the new message to all pods, now including userId
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
    # Broadcast the drawing data to all players in the room

    Phoenix.PubSub.broadcast_from(
      ScribblBackend.PubSub,
      self(),
      socket.topic,
      %{
        event: "drawing",
        payload: %{
          "drawMode" => drawMode,
          "strokeColor" => strokeColor,
          "strokeWidth" => strokeWidth,
          "paths" => paths
        }
      }
    )

    # ToDO: Save the drawing data to Redis or any other storage for persistence

    {:noreply, socket}
  end

  def handle_in(
        "start_turn",
        %{
          "word" => word
        },
        socket
      ) do
    # Get the room ID from the socket topic
    room_id = String.split(socket.topic, ":") |> List.last()
    drawer_id = socket.assigns.user_id

    # Check if the user is the drawer
    # Get the current drawer from Redis
    {:ok, current_drawer} = GameHelper.get_current_drawer(room_id)

    if current_drawer != drawer_id do
      # If the user is not the drawer, send an error message
      push(socket, "error", %{"message" => "You are not the drawer"})
      {:noreply, socket}
    else
      # start the turn
      case GameHelper.start_turn(room_id, word) do
        {:ok, turn_info} ->
          # Broadcast the start event to all players
          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            socket.topic,
            %{
              event: "turn_started",
              payload: turn_info
            }
          )
      end
    end

    {:noreply, socket}
  end

  def handle_in("start_game", %{}, socket) do
    # Get the room ID from the socket topic
    room_id = String.split(socket.topic, ":") |> List.last()

    # Start the game
    GameHelper.start(room_id)

    {:noreply, socket}
  end

  def terminate(_reason, socket) do
    # Remove the user from the players list

    user_id = socket.assigns.user_id
    room_id = String.split(socket.topic, ":") |> List.last()

    # Remove the user from the players list in Redis
    GameHelper.remove_player(room_id, user_id)

    :ok
  end
end
