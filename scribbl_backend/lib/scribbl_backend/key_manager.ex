defmodule ScribblBackend.KeyManager do
  @moduledoc """
  Centralized management of Redis keys for the Scribbl application.

  This module provides a single source of truth for Redis key generation,
  ensuring consistency across the application and reducing errors from
  duplicated key strings.
  """

  @room_prefix "room:"

  @doc """
  Get the key for room information.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    The Redis key for room information.
  """
  def room_info(room_id), do: "#{@room_prefix}{#{room_id}}:info"

  @doc """
  Get the key for room players.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    The Redis key for room players.
  """
  def room_players(room_id), do: "#{@room_prefix}{#{room_id}}:players"

  @doc """
  Get the key for a player's score.

  ## Parameters
    - `room_id`: The ID of the room.
    - `player_id`: The ID of the player.

  ## Returns
    The Redis key for the player's score.
  """
  def player_score(room_id, player_id), do: "#{@room_prefix}{#{room_id}}:player:#{player_id}:score"

  @doc """
  Get the key for the current word in a room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    The Redis key for the current word.
  """
  def current_word(room_id), do: "#{@room_prefix}{#{room_id}}:word"

  @doc """
  Get the key for the turn timer in a room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    The Redis key for the turn timer.
  """
  def turn_timer(room_id), do: "#{@room_prefix}{#{room_id}}:timer"

  @doc """
  Get the key for the canvas data in a room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    The Redis key for the canvas data.
  """
  def canvas_data(room_id), do: "#{@room_prefix}{#{room_id}}:canvas"

  @doc """
  Get the key for the reveal timer in a room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    The Redis key for the reveal timer.
  """
  def reveal_timer(room_id), do: "#{@room_prefix}{#{room_id}}:reveal_timer"

  @doc """
  Get the key for the revealed indices in a room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    The Redis key for the revealed indices.
  """
  def revealed_indices(room_id), do: "#{@room_prefix}{#{room_id}}:revealed_indices"

  @doc """
  Get the key for the eligible drawers in a round.

  ## Parameters
    - `room_id`: The ID of the room.
    - `round`: The round number.

  ## Returns
    The Redis key for the eligible drawers.
  """
  def eligible_drawers(room_id, round), do: "#{@room_prefix}{#{room_id}}:round:#{round}:eligible_drawers"

  @doc """
  Get the key for the non-eligible guessers in a round.

  ## Parameters
    - `room_id`: The ID of the room.
    - `round`: The round number.

  ## Returns
    The Redis key for the non-eligible guessers.
  """
  def non_eligible_guessers(room_id, round), do: "#{@room_prefix}{#{room_id}}:#{round}:non_eligible_guessers"

  @doc """
  Get the lock key for a turn timer.

  ## Parameters
    - `room_id`: The ID of the room.
    - `word`: The current word.

  ## Returns
    The Redis key for the turn timer lock.
  """
  def turn_timer_lock(room_id, word), do: "lock:#{turn_timer(room_id)}:#{word}"

  @doc """
  Get the lock key for a reveal timer.

  ## Parameters
    - `room_id`: The ID of the room.
    - `word`: The current word.

  ## Returns
    The Redis key for the reveal timer lock.
  """
  def reveal_timer_lock(room_id, word), do: "lock:#{reveal_timer(room_id)}:#{word}"

  @doc """
  Get a pattern to match all keys for a room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    A pattern that matches all Redis keys for the room.
  """
  def room_keys_pattern(room_id), do: "#{@room_prefix}{#{room_id}}:*"

  @doc """
  Get the PubSub topic for a room.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    The PubSub topic for the room.
  """
  def room_topic(room_id), do: "room:#{room_id}"

  @doc """
  Get the PubSub topic for a user.

  ## Parameters
    - `user_id`: The ID of the user.

  ## Returns
    The PubSub topic for the user.
  """
  def user_topic(user_id), do: "user:#{user_id}"
end
