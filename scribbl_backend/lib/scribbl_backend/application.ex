defmodule ScribblBackend.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      ScribblBackendWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:scribbl_backend, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub,
       name: ScribblBackend.PubSub,
       adapter: Phoenix.PubSub.Redis,
       host: System.get_env("REDIS_HOST") || "localhost",
       port: (System.get_env("REDIS_PORT") || "6379") |> String.to_integer(),
       database: (System.get_env("REDIS_DB") || "0") |> String.to_integer(),
       node_name: System.get_env("NODE_NAME") || "default_node"},
      {Redix,
       name: :redix,
       host: System.get_env("REDIS_HOST") || "localhost",
       port: (System.get_env("REDIS_PORT") || "6379") |> String.to_integer(),
       database: (System.get_env("REDIS_DB") || "0") |> String.to_integer()},
      ScribblBackend.TimeoutWatcher,
      ScribblBackendWeb.Presence,
      # Start to serve requests, typically the last entry
      ScribblBackendWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: ScribblBackend.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ScribblBackendWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
