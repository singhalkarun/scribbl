defmodule ScribblBackend.RedisPool do
  @moduledoc """
  Supervisor that starts a pool of Redix connections.
  Connections are named :redix_0 through :redix_{pool_size-1}.
  """

  use Supervisor

  def start_link(opts) do
    Supervisor.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(opts) do
    pool_size = Keyword.fetch!(opts, :pool_size)
    host = Keyword.fetch!(opts, :host)
    port = Keyword.fetch!(opts, :port)
    password = Keyword.get(opts, :password)
    database = Keyword.get(opts, :database, 0)

    # Store pool size in persistent term for fast access
    :persistent_term.put(:redis_pool_size, pool_size)

    children =
      for i <- 0..(pool_size - 1) do
        Supervisor.child_spec(
          {Redix,
           name: :"redix_#{i}",
           host: host,
           port: port,
           password: password,
           database: database},
          id: :"redix_#{i}"
        )
      end

    Supervisor.init(children, strategy: :one_for_one)
  end
end
