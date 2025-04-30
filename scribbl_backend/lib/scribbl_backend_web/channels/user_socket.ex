defmodule ScribblBackendWeb.UserSocket do
  use Phoenix.Socket

  channel "room:*", ScribblBackendWeb.RoomChannel

  def connect(_params, socket, _connect_info) do
    # Assign a unique user ID to the socket
    user_id = UUID.uuid4()
    socket = assign(socket, :user_id, user_id)

    {:ok, socket}
  end

  def id(_socket), do: nil
end
