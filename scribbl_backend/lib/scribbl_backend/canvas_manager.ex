defmodule ScribblBackend.CanvasManager do
  @moduledoc """
  Handles drawing and canvas operations for Scribbl.
  Extracts functionality from GameHelper related to canvas management.
  """

  alias ScribblBackend.RedisHelper
  alias ScribblBackend.KeyManager

  @doc """
  Save canvas data for a room.

  ## Parameters
    - `room_id`: The ID of the room
    - `canvas_data`: The canvas data to save
  """
  def save_canvas(room_id, %{
    "drawMode" => _drawMode,
    "strokeColor" => _strokeColor,
    "strokeWidth" => _strokeWidth,
    "paths" => _paths
  } = canvas_data) do
    room_canvas_key = KeyManager.canvas_data(room_id)

    # Get existing canvas data
    case RedisHelper.get(room_canvas_key) do
      {:ok, nil} ->
        # If no existing data, save the new data as is
        RedisHelper.set(room_canvas_key, Jason.encode!(%{
          "canvas" => [canvas_data],
          "lastUpdate" => System.system_time(:millisecond)
        }))

      {:ok, existing_data} ->
        # If there's existing data, append the new increment
        existing = Jason.decode!(existing_data)
        updated_canvas = existing["canvas"] ++ [canvas_data]

        RedisHelper.set(room_canvas_key, Jason.encode!(%{
          "canvas" => updated_canvas,
          "lastUpdate" => System.system_time(:millisecond)
        }))

      error -> error
    end
  end

  @doc """
  Get canvas data for a room.

  ## Parameters
    - `room_id`: The ID of the room

  ## Returns
    The canvas array if it exists, nil otherwise
  """
  def get_canvas(room_id) do
    room_canvas_key = KeyManager.canvas_data(room_id)
    case RedisHelper.get(room_canvas_key) do
      {:ok, nil} -> {:ok, nil}
      {:ok, canvas_data} ->
        case Jason.decode!(canvas_data) do
          %{"canvas" => canvas} -> {:ok, canvas}
          _ -> {:ok, nil}
        end
      error -> error
    end
  end

  @doc """
  Clear the canvas for a room.

  ## Parameters
    - `room_id`: The ID of the room
  """
  def clear_canvas(room_id) do
    room_canvas_key = KeyManager.canvas_data(room_id)
    RedisHelper.del(room_canvas_key)
  end
end
