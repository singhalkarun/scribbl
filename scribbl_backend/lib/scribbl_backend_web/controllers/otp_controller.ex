defmodule ScribblBackendWeb.OTPController do
  use ScribblBackendWeb, :controller
  require Logger

  @doc """
  Sends an OTP to the provided phone number using the 2Factor.in API.
  Phone number must be in E.164 format (e.g., +919876543210).
  """
  def send_otp(conn, %{"phone" => phone}) do
    api_key = System.get_env("TWO_FACTOR_API_KEY")

    if is_nil(api_key) do
      Logger.error("TWO_FACTOR_API_KEY environment variable is not set")
      conn
      |> put_status(:internal_server_error)
      |> json(%{error: "API key configuration error"})
    else
      # Ensure phone is in E.164 format (should start with +)
      case validate_phone_format(phone) do
        {:ok, formatted_phone} ->
          # Remove the + prefix for the API call
          phone_for_api = String.replace_prefix(formatted_phone, "+", "")

          url = "https://2factor.in/API/V1/#{api_key}/SMS/#{phone_for_api}/AUTOGEN3/OTP%20template%20v1"

          case HTTPoison.get(url) do
            {:ok, %HTTPoison.Response{status_code: 200, body: body}} ->
              response = Jason.decode!(body)

              conn
              |> put_status(:ok)
              |> json(response)

            {:ok, %HTTPoison.Response{body: body}} ->
              error_response = Jason.decode!(body)

              conn
              |> put_status(:bad_request)
              |> json(%{error: "OTP service error", details: error_response})

            {:error, %HTTPoison.Error{reason: reason}} ->
              Logger.error("Failed to send OTP: #{inspect(reason)}")

              conn
              |> put_status(:internal_server_error)
              |> json(%{error: "Failed to send OTP", details: inspect(reason)})
          end

        {:error, reason} ->
          conn
          |> put_status(:bad_request)
          |> json(%{error: reason})
      end
    end
  end

  defp validate_phone_format(phone) do
    # Basic E.164 format validation (should start with + followed by country code and number)
    if Regex.match?(~r/^\+[1-9]\d{1,14}$/, phone) do
      {:ok, phone}
    else
      {:error, "Phone number must be in E.164 format (e.g., +919876543210)"}
    end
  end
end
