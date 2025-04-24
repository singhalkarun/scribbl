defmodule ScribbleBackendWeb.RoomChannel do
  use Phoenix.Channel

  def join("room:" <> _room_id, _params, socket) do
    {:ok, socket}
  end

  def handle_in("new_message", %{"message" => message}, socket) do
    broadcast(socket, "new_message", %{"message" => message})
    {:noreply, socket}
  end
end