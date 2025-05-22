defmodule ScribblBackendWeb.UserSocket do
  use Phoenix.Socket

  channel "room:*", ScribblBackendWeb.RoomChannel

  def connect(params, socket, _connect_info) do
    user_id = Map.get(params, "user_id")
    user_id = if user_id && user_id != "", do: user_id, else: UUID.uuid4()
    socket = assign(socket, :user_id, user_id)

    {:ok, socket}
  end

  def id(_socket), do: nil
end
