defmodule ScribblBackend.VoiceRoomManager do
  @moduledoc """
  Handles voice room operations for Scribbl.
  Manages which players are part of voice rooms within game rooms.
  """

  alias ScribblBackend.RedisHelper
  alias ScribblBackend.KeyManager

  @doc """
  Add a player to the voice room.

  ## Parameters
    - `room_id`: The ID of the room.
    - `user_id`: The ID of the user to add to voice room.

  ## Returns
    {:ok, voice_members} if successful, {:error, reason} otherwise.
  """
  def join_voice_room(room_id, user_id) do
    voice_room_key = KeyManager.voice_room_members(room_id)

    # Add user to voice room set
    case RedisHelper.sadd(voice_room_key, user_id) do
      {:ok, _} ->
        # Return current voice room members
        get_voice_room_members(room_id)

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Remove a player from the voice room.

  ## Parameters
    - `room_id`: The ID of the room.
    - `user_id`: The ID of the user to remove from voice room.

  ## Returns
    {:ok, voice_members} if successful, {:error, reason} otherwise.
  """
  def leave_voice_room(room_id, user_id) do
    voice_room_key = KeyManager.voice_room_members(room_id)

    # Remove user from voice room set
    case RedisHelper.srem(voice_room_key, user_id) do
      {:ok, _} ->
        # Return current voice room members
        get_voice_room_members(room_id)

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Get all voice room members for a room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    {:ok, voice_members} if successful, {:error, reason} otherwise.
  """
  def get_voice_room_members(room_id) do
    voice_room_key = KeyManager.voice_room_members(room_id)
    RedisHelper.smembers(voice_room_key)
  end

  @doc """
  Check if a user is in the voice room.

  ## Parameters
    - `room_id`: The ID of the room.
    - `user_id`: The ID of the user to check.

  ## Returns
    {:ok, boolean} if successful, {:error, reason} otherwise.
  """
  def is_user_in_voice_room?(room_id, user_id) do
    voice_room_key = KeyManager.voice_room_members(room_id)

    case RedisHelper.sismember(voice_room_key, user_id) do
      {:ok, 1} -> {:ok, true}
      {:ok, 0} -> {:ok, false}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Clear all voice room members when room is cleaned up.

  ## Parameters
    - `room_id`: The ID of the room.
  """
  def clear_voice_room(room_id) do
    voice_room_key = KeyManager.voice_room_members(room_id)
    RedisHelper.del(voice_room_key)
  end
end
