defmodule ScribblBackendWeb.Presence do
  use Phoenix.Presence,
    otp_app: :scribbl_backend,
    pubsub_server: ScribblBackend.PubSub
end