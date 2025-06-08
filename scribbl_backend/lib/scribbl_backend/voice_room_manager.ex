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
    voice_members is a map of user_id => mute_state.
  """
  def join_voice_room(room_id, user_id) do
    voice_room_key = KeyManager.voice_room_state(room_id)

    # Add user to voice room with default unmuted state
    case RedisHelper.hset(voice_room_key, user_id, "false") do
      {:ok, _} ->
        # Return current voice room state
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
    voice_members is a map of user_id => mute_state.
  """
  def leave_voice_room(room_id, user_id) do
    voice_room_key = KeyManager.voice_room_state(room_id)

    # Remove user from voice room
    case RedisHelper.hdel(voice_room_key, user_id) do
      {:ok, _} ->
        # Return current voice room state
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
    {:ok, voice_members} where voice_members is a map of user_id => mute_state.
  """
  def get_voice_room_members(room_id) do
    voice_room_key = KeyManager.voice_room_state(room_id)

    case RedisHelper.hgetall(voice_room_key) do
      {:ok, hash_data} ->
        # Convert flat list to map
        voice_members = hash_data
        |> Enum.chunk_every(2)
        |> Enum.reduce(%{}, fn [user_id, mute_str], acc ->
          Map.put(acc, user_id, mute_str == "true")
        end)

        {:ok, voice_members}

      {:error, reason} ->
        {:error, reason}
    end
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
    voice_room_key = KeyManager.voice_room_state(room_id)

    case RedisHelper.hexists(voice_room_key, user_id) do
      {:ok, 1} -> {:ok, true}
      {:ok, 0} -> {:ok, false}
      {:error, reason} -> {:error, reason}
    end
  end



    @doc """
  Set a user's mute state in the voice room.

  ## Parameters
    - `room_id`: The ID of the room.
    - `user_id`: The ID of the user.
    - `muted`: Boolean indicating if user is muted.

  ## Returns
    {:ok, voice_members} if successful, {:error, reason} otherwise.
    voice_members is a map of user_id => mute_state.
  """
  def set_user_mute_state(room_id, user_id, muted) do
    voice_room_key = KeyManager.voice_room_state(room_id)

    # Update user's mute state in the hash
    case RedisHelper.hset(voice_room_key, user_id, to_string(muted)) do
      {:ok, _} -> get_voice_room_members(room_id)
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Clear all voice room members when room is cleaned up.

  ## Parameters
    - `room_id`: The ID of the room.
  """
  def clear_voice_room(room_id) do
    voice_room_key = KeyManager.voice_room_state(room_id)
    RedisHelper.del(voice_room_key)
  end

  @doc """
  Remove user from voice room when they leave (no longer needed as separate function).

  ## Parameters
    - `room_id`: The ID of the room.
    - `user_id`: The ID of the user.
  """
  def cleanup_user_mute_state(_room_id, _user_id) do
    # No longer needed - mute state is cleaned up when user leaves voice room
    :ok
  end
end
