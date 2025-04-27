defmodule ScribblBackendWeb.RoomChannel do
  use Phoenix.Channel

  intercept ["new_message"]

  def join("room:" <> _room_id, _params, socket) do
    {:ok, socket}
  end

  def handle_in("new_message", %{"message" => message}, socket) do
    Phoenix.PubSub.broadcast_from(
      ScribblBackend.PubSub,
      self(),
      socket.topic,
      %{event: "new_message", payload: %{"message" => message}}
    )
    {:noreply, socket}
  end

  def handle_info(%{event: "new_message", payload: payload}, socket) do
    push(socket, "new_message", payload)
    {:noreply, socket}
  end
end