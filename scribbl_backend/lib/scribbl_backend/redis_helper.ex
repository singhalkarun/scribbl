# redis helper module (use redix, name : :redix)

defmodule ScribblBackend.RedisHelper do
  @moduledoc """
  A helper module for interacting with Redis using Redix.
  """

  @doc """
  Sets a key-value pair in Redis.

  ## Parameters

    - `key`: The key to set.
    - `value`: The value to set.

  ## Examples

      iex> ScribblBackend.RedisHelper.set("my_key", "my_value")
      :ok
  """
  def set(key, value) do
    Redix.command(:redix, ["SET", key, value])
  end

  @doc """
  Gets the value of a key from Redis.

  ## Parameters

    - `key`: The key to get.

  ## Examples

      iex> ScribblBackend.RedisHelper.get("my_key")
      {:ok, "my_value"}
  """
  def get(key) do
    Redix.command(:redix, ["GET", key])
  end

  @doc """
  Sets the key-value pair in Hash in Redis.
  ## Parameters

    - `key`: The key to set.
    - `field`: The field to set.
    - `value`: The value to set.

  ## Examples

      iex> ScribblBackend.RedisHelper.hset("my_key", "my_field", "my_value")
      :ok
  """
  def hset(key, field, value) do
    Redix.command(:redix, ["HSET", key, field, value])
  end

  @doc """
  Set multpile fields in a Hash in Redis.
  """
  def hmset(key, fields) do
    # Convert the map to a list of tuples
    fields_list = Enum.flat_map(fields, fn {k, v} -> [k, v] end)
    Redix.command(:redix, ["HMSET", key | fields_list])
  end

  @doc """
  Gets the value of a field from a Hash in Redis.
  ## Parameters

    - `key`: The key to get.
    - `field`: The field to get.
  ## Examples

      iex> ScribblBackend.RedisHelper.hget("my_key", "my_field")
      {:ok, "my_value"}
  """
  def hget(key, field) do
    Redix.command(:redix, ["HGET", key, field])
  end
  @doc """
  Deletes a key from Redis.
  ## Parameters

    - `key`: The key to delete.
  ## Examples

      iex> ScribblBackend.RedisHelper.delete("my_key")
      :ok
  """
  def delete(key) do
    Redix.command(:redix, ["DEL", key])
  end
  @doc """
  Deletes a field from a Hash in Redis.
  ## Parameters

    - `key`: The key to delete.
    - `field`: The field to delete.
  ## Examples

      iex> ScribblBackend.RedisHelper.hdel("my_key", "my_field")
      :ok
  """
  def hdel(key, field) do
    Redix.command(:redix, ["HDEL", key, field])
  end
  @doc """
  Gets all fields and values from a Hash in Redis.
  ## Parameters

    - `key`: The key to get.
  ## Examples

      iex> ScribblBackend.RedisHelper.hgetall("my_key")
      {:ok, %{"field1" => "value1", "field2" => "value2"}}
  """
  def hgetall(key) do
    Redix.command(:redix, ["HGETALL", key])
  end

  @doc """
  Push to a list in Redis.
  ## Parameters

    - `key`: The key to push to.
    - `value`: The value to push.
  ## Examples

      iex> ScribblBackend.RedisHelper.rpush("my_key", "my_value")
      :ok
  """
  def rpush(key, value) do
    Redix.command(:redix, ["RPUSH", key, value])
  end

  @doc """
  Pops from a list in Redis.
  ## Parameters

    - `key`: The key to pop from.
  ## Examples

      iex> ScribblBackend.RedisHelper.rpop("my_key")
      {:ok, "my_value"}
  """
  def rpop(key) do
    Redix.command(:redix, ["RPOP", key])
  end

  @doc """
  Gets all values from a list in Redis.
  ## Parameters

    - `key`: The key to get.
  ## Examples

      iex> ScribblBackend.RedisHelper.lrange("my_key")
      {:ok, ["value1", "value2"]}
  """
  def lrange(key) do
    Redix.command(:redix, ["LRANGE", key, "0", "-1"])
  end

  @doc """
  Gets the length of a list in Redis.
  ## Parameters

    - `key`: The key to get.
  ## Examples

      iex> ScribblBackend.RedisHelper.llen("my_key")
      {:ok, 2}
  """
  def llen(key) do
    Redix.command(:redix, ["LLEN", key])
  end

  @doc """
  Checks if a key exists in Redis.
  ## Parameters

    - `key`: The key to check.
  ## Examples

      iex> ScribblBackend.RedisHelper.exists("my_key")
      {:ok, 1}
  """
  def exists(key) do
    Redix.command(:redix, ["EXISTS", key])
  end
end
