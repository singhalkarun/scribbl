import Config

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :scribbl_backend, ScribblBackendWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "ncNM81CETRGY6/2M8b31QQ7jBb+iRiM90QLtpDLbLsYbDZV8hNgmKdphE3pfe2gU",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime
