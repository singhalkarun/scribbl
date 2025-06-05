defmodule ScribblBackendWeb.RoomController do
  use ScribblBackendWeb, :controller

  alias ScribblBackend.GameState

  @doc """
  API endpoint to find and return a random public room that has available slots.

  Returns:
  - 200: {room_id: "room_123"} if a room is found
  - 404: {error: "No available public rooms"} if no rooms are available
  """
  def join_random(conn, _params) do
    case GameState.find_random_public_room() do
      {:ok, room_id} ->
        conn
        |> put_status(:ok)
        |> json(%{room_id: room_id})

      {:error, reason} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: reason})
    end
  end

end
