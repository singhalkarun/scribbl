defmodule ScribblBackendWeb.RoomController do
  use ScribblBackendWeb, :controller

  alias ScribblBackend.GameState

  # List of adjectives for room ID generation
  @adjectives [
    "happy", "bright", "clever", "swift", "brave", "gentle", "kind", "wise", "strong", "calm",
    "bold", "quick", "smart", "cool", "warm", "fresh", "pure", "wild", "free", "true",
    "deep", "high", "wide", "soft", "hard", "light", "dark", "fast", "slow", "big",
    "small", "great", "grand", "fine", "nice", "good", "best", "new", "old", "young",
    "loud", "quiet", "sharp", "smooth", "rough", "round", "square", "flat", "thick", "thin",
    "heavy", "empty", "full", "open", "closed", "hot", "cold", "wet", "dry", "clean",
    "dirty", "rich", "poor", "cheap", "dear", "near", "far", "low", "tall", "short",
    "long", "wide", "narrow", "broad", "tight", "loose", "firm", "weak", "tough", "tender",
    "sweet", "sour", "bitter", "salty", "spicy", "mild", "bland", "tasty", "fresh", "stale",
    "ripe", "raw", "cooked", "frozen", "melted", "solid", "liquid", "gaseous", "clear", "cloudy",
    "bright", "dim", "shiny", "dull", "glossy", "matte", "transparent", "opaque", "visible", "hidden",
    "obvious", "secret", "public", "private", "personal", "general", "specific", "exact", "precise", "vague",
    "certain", "uncertain", "sure", "unsure", "confident", "doubtful", "hopeful", "hopeless", "cheerful", "sad",
    "joyful", "gloomy", "excited", "bored", "interested", "tired", "energetic", "lazy", "active", "passive",
    "busy", "idle", "working", "resting", "sleeping", "awake", "alert", "drowsy", "conscious", "unconscious",
    "alive", "dead", "healthy", "sick", "strong", "weak", "fit", "unfit", "normal", "abnormal",
    "regular", "irregular", "common", "rare", "usual", "unusual", "ordinary", "extraordinary", "simple", "complex",
    "easy", "difficult", "hard", "soft", "gentle", "rough", "smooth", "bumpy", "level", "uneven",
    "straight", "crooked", "curved", "angular", "pointed", "blunt", "sharp", "dull", "keen", "obtuse",
    "acute", "right", "wrong", "correct", "incorrect", "true", "false", "real", "fake", "genuine"
  ]

  # List of nouns for room ID generation
  @nouns [
    "cat", "dog", "bird", "fish", "tree", "flower", "house", "car", "book", "pen",
    "table", "chair", "window", "door", "wall", "floor", "roof", "garden", "park", "road",
    "bridge", "river", "mountain", "ocean", "lake", "forest", "desert", "island", "valley", "hill",
    "rock", "stone", "sand", "grass", "leaf", "branch", "root", "seed", "fruit", "vegetable",
    "apple", "orange", "banana", "grape", "cherry", "berry", "melon", "peach", "pear", "plum",
    "carrot", "potato", "tomato", "onion", "pepper", "corn", "bean", "pea", "rice", "wheat",
    "bread", "cake", "cookie", "pie", "pizza", "soup", "salad", "meat", "chicken", "beef",
    "pork", "fish", "cheese", "milk", "butter", "egg", "honey", "sugar", "salt", "pepper",
    "water", "juice", "coffee", "tea", "wine", "beer", "soda", "ice", "snow", "rain",
    "sun", "moon", "star", "cloud", "wind", "storm", "thunder", "lightning", "rainbow", "mist",
    "fire", "flame", "smoke", "ash", "coal", "wood", "paper", "metal", "gold", "silver",
    "copper", "iron", "steel", "glass", "plastic", "rubber", "cloth", "silk", "cotton", "wool",
    "leather", "fur", "hair", "skin", "bone", "blood", "heart", "brain", "eye", "ear",
    "nose", "mouth", "tooth", "tongue", "hand", "finger", "arm", "leg", "foot", "toe",
    "head", "neck", "shoulder", "chest", "back", "stomach", "knee", "elbow", "wrist", "ankle",
    "face", "smile", "laugh", "tear", "dream", "sleep", "wake", "thought", "idea", "plan",
    "goal", "wish", "hope", "fear", "love", "hate", "anger", "joy", "peace", "war",
    "friend", "enemy", "family", "parent", "child", "baby", "boy", "girl", "man", "woman",
    "person", "people", "crowd", "team", "group", "club", "party", "meeting", "game", "sport",
    "ball", "bat", "net", "goal", "race", "prize", "gift", "toy", "doll", "robot"
  ]

  @doc """
  API endpoint to find and return a random public room that has available slots.

  Returns:
  - 200: {room_id: "room_123"} if a room is found
  - 404: {error: "No available public rooms"} if no rooms are available
  """
  def join_random(conn, _params) do
    case GameState.find_random_public_room() do
      {:ok, room_id} ->
        conn
        |> put_status(:ok)
        |> json(%{room_id: room_id})

      {:error, reason} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: reason})
    end
  end

  @doc """
  API endpoint to generate a unique room ID using adjective-noun combination.

  Returns:
  - 200: {room_id: "happy-cat"} with a guaranteed unique room ID
  """
  def generate_room_id(conn, _params) do
    room_id = generate_unique_room_id()

    conn
    |> put_status(:ok)
    |> json(%{room_id: room_id})
  end

  # Generate a unique room ID by combining random adjective and noun
  defp generate_unique_room_id() do
    generate_room_id_candidate()
    |> ensure_unique_room_id()
  end

  # Generate a candidate room ID
  defp generate_room_id_candidate() do
    adjective = Enum.random(@adjectives)
    noun = Enum.random(@nouns)
    "#{adjective}-#{noun}"
  end

  # Ensure the room ID is unique, generate new ones if collision occurs
  defp ensure_unique_room_id(candidate_id) do
    case GameState.get_room(candidate_id) do
      {:error, "Room not found"} ->
        # Room doesn't exist, this ID is unique
        candidate_id

      {:ok, _room_info} ->
        # Room exists, generate a new candidate
        generate_room_id_candidate()
        |> ensure_unique_room_id()
    end
  end
end
