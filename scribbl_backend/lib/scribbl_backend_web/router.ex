defmodule ScribblBackendWeb.Router do
  use ScribblBackendWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
  end

      scope "/api", ScribblBackendWeb do
    pipe_through :api

    # Room management endpoints
    get "/rooms/join-random", RoomController, :join_random
    get "/rooms/generate-id", RoomController, :generate_room_id

    # Image generation endpoints
    post "/images/game-over", ImageController, :generate_game_over_image
  end

  # Enable LiveDashboard in development
  if Application.compile_env(:scribbl_backend, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: ScribblBackendWeb.Telemetry
    end
  end
end
