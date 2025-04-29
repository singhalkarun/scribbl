defmodule ScribblBackendWeb.RoomChannel do
  use Phoenix.Channel
  alias ScribblBackendWeb.Presence
  alias ScribblBackend.GameHelper

  def join("room:" <> _room_id, %{"name" => name}, socket) do
    # Track the user's presence via Phoenix Presence
    Presence.track(socket, socket.assigns.user_id, %{
      name: name,
      joined_at: :os.system_time(:seconds)
    })

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

  def handle_info(%{event: "presence_diff", payload: payload}, socket) do
    # Push presence diff updates to the current socket
    push(socket, "presence_diff", payload)
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
end
