defmodule ScribblBackend.CanvasManager do
  @moduledoc """
  Handles drawing and canvas operations for Scribbl.
  Extracts functionality from GameHelper related to canvas management.
  """

  alias ScribblBackend.RedisHelper
  alias ScribblBackend.KeyManager

  # Max canvas entries per turn to prevent unbounded growth
  @max_canvas_entries 500

  @doc """
  Save canvas data for a room.
  Uses Redis LIST (RPUSH + LTRIM) instead of GET+decode+append+encode+SET
  to avoid O(n) JSON re-encode per stroke update (~20/sec during drawing).

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
    encoded = Jason.encode!(canvas_data)

    # RPUSH the single stroke + LTRIM to cap in one pipeline
    RedisHelper.pipeline([
      ["RPUSH", room_canvas_key, encoded],
      ["LTRIM", room_canvas_key, "-#{@max_canvas_entries}", "-1"]
    ])
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
    case RedisHelper.lrange(room_canvas_key) do
      {:ok, []} -> {:ok, nil}
      {:ok, entries} when is_list(entries) ->
        canvas = Enum.map(entries, &Jason.decode!/1)
        {:ok, canvas}
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
