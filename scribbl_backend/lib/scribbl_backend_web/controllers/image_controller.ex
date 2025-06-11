defmodule ScribblBackendWeb.ImageController do
  use ScribblBackendWeb, :controller

  def generate_game_over_image(conn, params) do
    # Extract parameters
    scores = params["scores"] || %{}
    players = params["players"] || %{}
    winner_name = params["winner_name"] || "Winner"
    winner_score = params["winner_score"] || "0"
    total_players = params["total_players"] || "0"

    # Generate SVG content
    svg_content = generate_svg(winner_name, winner_score, total_players, scores, players)

    conn
    |> put_resp_content_type("image/svg+xml")
    |> put_resp_header("cache-control", "public, max-age=3600")
    |> send_resp(200, svg_content)
  end

  defp generate_svg(winner_name, winner_score, total_players, scores, players) do
    # Get top 3 players for display
    sorted_scores =
      scores
      |> Enum.filter(fn {player_id, _score} -> Map.has_key?(players, player_id) end)
      |> Enum.sort_by(fn {_player_id, score} -> -score end)
      |> Enum.take(3)

    # Generate player list HTML
    player_list = generate_player_list(sorted_scores, players)

    """
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1e1b4b;stop-opacity:1" />
          <stop offset="50%" style="stop-color:#1e3a8a;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#312e81;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="cardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgba(255,255,255,0.2);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgba(255,255,255,0.1);stop-opacity:1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <!-- Background -->
      <rect width="800" height="600" fill="url(#bgGradient)"/>

      <!-- Glass card background -->
      <rect x="50" y="50" width="700" height="500" rx="20" fill="url(#cardGradient)"
            stroke="rgba(255,255,255,0.3)" stroke-width="1" filter="url(#glow)"/>

      <!-- Trophy icon -->
      <text x="400" y="120" text-anchor="middle" style="font-size:60px;">🏆</text>

      <!-- Title -->
      <text x="400" y="170" text-anchor="middle" fill="white"
            style="font-family:Arial,sans-serif;font-size:36px;font-weight:bold;">Game Over!</text>

      <!-- Winner section -->
      <text x="400" y="220" text-anchor="middle" fill="#22d3ee"
            style="font-family:Arial,sans-serif;font-size:28px;font-weight:bold;">🎉 #{winner_name} Wins! 🎉</text>

      <text x="400" y="260" text-anchor="middle" fill="#a5f3fc"
            style="font-family:Arial,sans-serif;font-size:20px;">#{winner_score} points</text>

      <!-- Player scores -->
      #{player_list}

      <!-- Footer -->
      <text x="400" y="480" text-anchor="middle" fill="rgba(255,255,255,0.8)"
            style="font-family:Arial,sans-serif;font-size:18px;">#{total_players} players competed</text>

      <!-- Scribbl branding -->
      <text x="400" y="520" text-anchor="middle" fill="rgba(255,255,255,0.6)"
            style="font-family:Arial,sans-serif;font-size:16px;">Play at scribbl.club</text>

      <!-- Decorative elements -->
      <text x="100" y="140" style="font-size:30px;">🎨</text>
      <text x="680" y="140" style="font-size:30px;">✏️</text>
      <text x="120" y="500" style="font-size:25px;">🖍️</text>
      <text x="660" y="500" style="font-size:25px;">🎯</text>
    </svg>
    """
  end

  defp generate_player_list(sorted_scores, players) do
    sorted_scores
    |> Enum.with_index()
    |> Enum.map(fn {{player_id, score}, index} ->
      player_name = Map.get(players, player_id, "Unknown")
      y_position = 320 + (index * 40)

      medal = case index do
        0 -> "🥇"
        1 -> "🥈"
        2 -> "🥉"
        _ -> "#{index + 1}."
      end

      color = case index do
        0 -> "#ffd700"  # Gold
        1 -> "#c0c0c0"  # Silver
        2 -> "#cd7f32"  # Bronze
        _ -> "rgba(255,255,255,0.9)"
      end

      """
      <text x="150" y="#{y_position}" fill="#{color}"
            style="font-family:Arial,sans-serif;font-size:18px;font-weight:bold;">#{medal} #{player_name}</text>
      <text x="650" y="#{y_position}" text-anchor="end" fill="#22d3ee"
            style="font-family:Arial,sans-serif;font-size:18px;font-weight:bold;">#{score} pts</text>
      """
    end)
    |> Enum.join("\n")
  end
end
