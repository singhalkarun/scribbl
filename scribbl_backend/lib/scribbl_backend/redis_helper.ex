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
  Sets multiple key-value pair in Hash in Redis.
  ## Parameters

    - `key`: The key to set.
    - `fields`: A map of fields and values to set.
  ## Examples

      iex> ScribblBackend.RedisHelper.hmset("my_key", %{"field1" => "value1", "field2" => "value2"})
      :ok
  """
  def hset(key, fields) when is_map(fields) do
    # Convert the map to a list of tuples
    fields_list = Enum.flat_map(fields, fn {k, v} -> [k, v] end)
    Redix.command(:redix, ["HSET", key | fields_list])
  end

  @doc """
  Sets a single field in a Hash in Redis.
  ## Parameters

    - `key`: The key to set.
    - `field`: The field name.
    - `value`: The field value.
  ## Examples

      iex> ScribblBackend.RedisHelper.hset("my_key", "field1", "value1")
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
  Check if a field exists in a Hash in Redis.
  ## Parameters

    - `key`: The key to check.
    - `field`: The field to check.
  ## Examples

      iex> ScribblBackend.RedisHelper.hexists("my_key", "field1")
      {:ok, 1}
  """
  def hexists(key, field) do
    Redix.command(:redix, ["HEXISTS", key, field])
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

  @doc """
  Remoce an element from a list in Redis.
  ## Parameters

    - `key`: The key to remove from.
    - `value`: The value to remove.
  ## Examples

      iex> ScribblBackend.RedisHelper.lrem("my_key", "my_value")
      :ok
  """
  def lrem(key, value) do
    Redix.command(:redix, ["LREM", key, "0", value])
  end

  @doc """
  Adds one or more members to a set in Redis.
  ## Parameters

    - `key`: The key to add to.
    - `members`: The members to add (can be a single value or a list).
  ## Examples

      iex> ScribblBackend.RedisHelper.sadd("my_key", ["member1", "member2"])
      :ok

      iex> ScribblBackend.RedisHelper.sadd("my_key", "member1")
      :ok
  """
  def sadd(key, members) when is_list(members) do
    # Convert the list to a flat list of arguments
    members_list = Enum.flat_map(members, fn member -> [member] end)
    Redix.command(:redix, ["SADD", key | members_list])
  end

  def sadd(key, member) do
    Redix.command(:redix, ["SADD", key, member])
  end

  @doc """
  Removes one or more members from a set in Redis.
  ## Parameters

    - `key`: The key to remove from.
    - `members`: The members to remove (can be a single value or a list).
  ## Examples

      iex> ScribblBackend.RedisHelper.srem("my_key", ["member1", "member2"])
      :ok

      iex> ScribblBackend.RedisHelper.srem("my_key", "member1")
      :ok
  """
  def srem(key, members) when is_list(members) do
    # Convert the list to a flat list of arguments
    members_list = Enum.flat_map(members, fn member -> [member] end)
    Redix.command(:redix, ["SREM", key | members_list])
  end

  def srem(key, member) do
    Redix.command(:redix, ["SREM", key, member])
  end

  @doc """
  Checks if a member exists in a set in Redis.
  ## Parameters

    - `key`: The key to check.
    - `member`: The member to check.
  ## Examples

      iex> ScribblBackend.RedisHelper.sismember("my_key", "member1")
      {:ok, 1}
  """
  def sismember(key, member) do
    Redix.command(:redix, ["SISMEMBER", key, member])
  end


  @doc """
  Pick a random member from a set in Redis.
  ## Parameters

    - `key`: The key to pick from.
  ## Examples

      iex> ScribblBackend.RedisHelper.srandmember("my_key")
      {:ok, "member1"}
  """
  def srandmember(key) do
    Redix.command(:redix, ["SRANDMEMBER", key])
  end

  @doc """
  Pop a random member from a set in Redis.
  ## Parameters

    - `key`: The key to pop from.
  ## Examples

      iex> ScribblBackend.RedisHelper.spop("my_key")
      {:ok, "member1"}
  """
  def spop(key) do
    Redix.command(:redix, ["SPOP", key])
  end

  @doc """
  Get all members of a set in Redis.

  ## Parameters

    - `key`: The key to get.
  ## Examples

      iex> ScribblBackend.RedisHelper.smembers("my_key")
      {:ok, ["member1", "member2"]}
  """
  def smembers(key) do
    Redix.command(:redix, ["SMEMBERS", key])
  end

  @doc """
  Set a key with an expiration time in Redis.
  ## Parameters

    - `key`: The key to set.
    - `seconds`: The expiration time in seconds.
    - `value`: The value to set.
  ## Examples

      iex> ScribblBackend.RedisHelper.setex("my_key", 60, "my_value")
      :ok
  """
  def setex(key, seconds, value) do
    Redix.command(:redix, ["SETEX", key, Integer.to_string(seconds), value])
  end

  @doc """
  Increment the value of a key in Redis.
  ## Parameters

    - `key`: The key to increment.
    - `increment`: The amount to increment by.
  ## Examples

      iex> ScribblBackend.RedisHelper.incr("my_key", 1)
      {:ok, 2}
  """
  def incr(key, increment) do
    Redix.command(:redix, ["INCRBY", key, increment])
  end
  @doc """

  Decrement the value of a key in Redis.
  ## Parameters

    - `key`: The key to decrement.
    - `decrement`: The amount to decrement by.
  ## Examples

      iex> ScribblBackend.RedisHelper.decr("my_key", 1)
      {:ok, 0}
  """
  def decr(key, decrement) do
    Redix.command(:redix, ["DECRBY", key, decrement])
  end

  @doc """
  Get the ttl of a key in Redis.
  ## Parameters

    - `key`: The key to get the ttl for.
  ## Examples

      iex> ScribblBackend.RedisHelper.ttl("my_key")
      {:ok, 60}
  """
  def ttl(key) do
    Redix.command(:redix, ["TTL", key])
  end

  @doc """
  Get the number of members in redis.
  ## Parameters

    - `key`: The key to get the number of members for.
  ## Examples

      iex> ScribblBackend.RedisHelper.scard("my_key")
      {:ok, 2}
  """
  def scard(key) do
    Redix.command(:redix, ["SCARD", key])
  end

  @doc """
  Expire a key in redis manually.
  ## Parameters

    - `key`: The key to expire.
    - `ttl`: The expiration time in seconds.
  ## Examples

      iex> ScribblBackend.RedisHelper.expire("my_key", 60)
      :ok
  """
  def expire(key, ttl) do
    Redix.command(:redix, ["EXPIRE", key, ttl])
  end

  @doc """
  Delete a key in redis manually.
  ## Parameters

    - `key`: The key to delete.
  ## Examples

      iex> ScribblBackend.RedisHelper.del("my_key")
      :ok
  """
  def del(key) do
    Redix.command(:redix, ["DEL", key])
  end

  @doc """
  Get all keys matching a pattern in Redis.
  ## Parameters
    - `pattern`: The pattern to match keys against (e.g., "user:*").
  ## Examples
      iex> ScribblBackend.RedisHelper.keys("user:*")
      {:ok, ["user:1", "user:2"]}
  """
  def keys(pattern) do
    Redix.command(:redix, ["KEYS", pattern])
  end

end
