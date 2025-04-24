defmodule ScribblBackend.Repo do
  use Ecto.Repo,
    otp_app: :scribbl_backend,
    adapter: Ecto.Adapters.Postgres
end
