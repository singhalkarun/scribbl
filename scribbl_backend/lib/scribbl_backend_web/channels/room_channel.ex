defmodule ScribblBackendWeb.RoomChannel do
  use Phoenix.Channel
  alias ScribblBackendWeb.Presence

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

  def terminate(_reason, socket) do
    # Notify other pods when a user disconnects
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      socket.topic,
      %{event: "presence_diff", payload: %{joined: [], left: [%{user_id: socket.assigns.user_id}]}}
    )
    {:stop, :normal, socket}
  end

  def handle_in("new_message", %{"message" => message}, socket) do
    # Broadcast the new message to all pods
    Phoenix.PubSub.broadcast(
      ScribblBackend.PubSub,
      socket.topic,
      %{event: "new_message", payload: %{"message" => message}}
    )
    {:noreply, socket}
  end
end
