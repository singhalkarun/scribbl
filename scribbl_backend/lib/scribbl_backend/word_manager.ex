defmodule ScribblBackend.WordManager do
  @moduledoc """
  Handles word generation, guessing, and related operations for Scribbl.
  Extracts functionality from GameHelper related to word management.
  """

  alias ScribblBackend.RedisHelper
  alias ScribblBackend.KeyManager

  @doc """
  Generate a list of random words for drawing.

  ## Returns
    A list of 3 random words.
  """
  def generate_words do
    words = ["dog", "cat", "fish", "bird", "horse", "cow", "pig", "sheep", "lion", "tiger", "elephant", "giraffe", "monkey", "bear", "wolf", "fox", "deer", "rabbit", "mouse", "rat", "snake", "turtle", "frog", "duck", "chicken", "penguin", "whale", "dolphin", "shark", "octopus", "bee", "butterfly", "spider", "ant", "fly", "mosquito", "zebra", "kangaroo", "koala", "squirrel", "panda", "gorilla", "seal", "bat", "owl", "eagle", "hawk", "camel", "crocodile", "dinosaur", "apple", "banana", "orange", "grape", "lemon", "watermelon", "strawberry", "cherry", "pineapple", "peach", "cake", "cookie", "bread", "pizza", "hamburger", "hotdog", "sandwich", "taco", "burrito", "ice cream", "donut", "candy", "chocolate", "popcorn", "noodle", "pasta", "rice", "egg", "cheese", "butter", "milk", "coffee", "tea", "juice", "soda", "water", "wine", "beer", "pie", "cupcake", "bacon", "sausage", "steak", "chicken", "carrot", "potato", "tomato", "onion", "corn", "mushroom", "chair", "table", "bed", "couch", "desk", "door", "window", "lamp", "clock", "mirror", "tv", "computer", "phone", "camera", "radio", "book", "pen", "pencil", "paper", "notebook", "box", "bag", "bottle", "cup", "plate", "bowl", "fork", "knife", "spoon", "key", "lock", "wallet", "purse", "glasses", "hat", "shirt", "pants", "dress", "shoes", "socks", "glove", "scarf", "umbrella", "backpack", "toothbrush", "soap", "towel", "pillow", "blanket", "carpet", "car", "bus", "train", "bike", "motorcycle", "airplane", "helicopter", "boat", "ship", "truck", "tractor", "rocket", "skateboard", "scooter", "wheelchair", "ambulance", "firetruck", "police car", "taxi", "submarine", "soccer", "football", "basketball", "baseball", "tennis", "golf", "bowling", "hockey", "volleyball", "rugby", "swimming", "running", "jumping", "climbing", "skiing", "snowboard", "surfing", "chess", "cards", "dice", "darts", "pool", "puzzle", "kite", "balloon", "frisbee", "yo-yo", "sled", "skates", "swing", "tree", "flower", "grass", "bush", "forest", "mountain", "hill", "river", "lake", "ocean", "beach", "island", "desert", "cave", "sun", "moon", "star", "cloud", "rain", "snow", "rainbow", "lightning", "fire", "smoke", "rock", "stone", "mud", "sand", "leaf", "branch", "house", "apartment", "school", "hospital", "store", "mall", "restaurant", "hotel", "church", "castle", "farm", "barn", "lighthouse", "bridge", "road", "street", "park", "playground", "zoo", "museum", "library", "airport", "stadium", "theater", "factory", "office", "bank", "police station", "fire station", "jail", "baby", "child", "boy", "girl", "man", "woman", "teacher", "doctor", "nurse", "police", "firefighter", "chef", "waiter", "farmer", "soldier", "artist", "clown", "king", "queen", "knight", "wizard", "witch", "ghost", "angel", "mermaid", "pirate", "cowboy", "ninja", "robot", "alien"]

    Enum.take_random(words, 3)
  end

  @doc """
  Start a new turn with the chosen word.

  ## Parameters
    - `room_id`: The ID of the room.
    - `word`: The word chosen for the drawing round.

  ## Returns
    Information about the started turn.
  """
  def start_turn(room_id, word) do
    room_word_key = KeyManager.current_word(room_id)
    room_timer_key = KeyManager.turn_timer(room_id)
    room_canvas_key = KeyManager.canvas_data(room_id)
    room_reveal_timer_key = KeyManager.reveal_timer(room_id)

    # Reset canvas data before starting new turn
    RedisHelper.del(room_canvas_key)

    # Reset revealed indices for the new word
    revealed_key = KeyManager.revealed_indices(room_id)
    RedisHelper.del(revealed_key)

    # set the word in Redis
    RedisHelper.set(
      room_word_key,
      word
    )

    # set the turn timer with lock and expiration
    RedisHelper.setex(
      room_timer_key,
      60,
      "active"
    )

    # Set a timer for letter reveal halfway through the turn (30 seconds)
    RedisHelper.setex(
      room_reveal_timer_key,
      30,
      "reveal_letter"
    )

    {:ok, %{"word_length" => Integer.to_string(String.length(word))}}
  end

  @doc """
  Get the current word for a room.

  ## Parameters
    - `room_id`: The ID of the room.
  """
  def get_current_word(room_id) do
    room_word_key = KeyManager.current_word(room_id)
    RedisHelper.get(room_word_key)
  end

  @doc """
  Start a timer for letter reveal.

  ## Parameters
    - `room_id`: The ID of the room.
  """
  def start_reveal_timer(room_id) do
    room_reveal_timer_key = KeyManager.reveal_timer(room_id)
    RedisHelper.setex(room_reveal_timer_key, 15, "reveal_letter")
  end

  @doc """
  Reveal the next letter of the word.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    - `{:ok, revealed_word}` - A list of characters with revealed letters and underscores for hidden ones
    - `{:ok, word_graphemes}` - All letters revealed (when all have been revealed)
    - `{:error, :word_not_found}` - If no word is set for the room
    - `{:error, error}` - Other errors
  """
  def reveal_next_letter(room_id) do
    revealed_key = KeyManager.revealed_indices(room_id)

    # Get the current word
    case get_current_word(room_id) do
      {:ok, nil} ->
        # If no word is set, return an error
        {:error, :word_not_found}

      {:ok, word} ->
        # Get the current revealed indices
        revealed_indices = case RedisHelper.get(revealed_key) do
          {:ok, nil} ->
            MapSet.new()
          {:ok, revealed_json} ->
            Jason.decode!(revealed_json) |> MapSet.new()
          _ ->
            MapSet.new()
        end

        word_graphemes = String.graphemes(word)
        all_indices = 0..(length(word_graphemes) - 1)
        remaining_indices = Enum.reject(all_indices, &MapSet.member?(revealed_indices, &1))

        # If all letters are revealed, return the full word graphemes
        if remaining_indices == [] do
          {:ok, word_graphemes}
        else
          # Randomly select one index to reveal
          index = Enum.random(remaining_indices)
          updated_set = MapSet.put(revealed_indices, index)
          updated_json = Jason.encode!(MapSet.to_list(updated_set))

          # Save the updated indices
          RedisHelper.set(revealed_key, updated_json)

          # Construct the partially revealed word as a list (not a string)
          revealed_word = word_graphemes
            |> Enum.with_index()
            |> Enum.map(fn {char, i} ->
              if MapSet.member?(updated_set, i), do: char, else: "_"
            end)

          {:ok, revealed_word}
        end

      error ->
        # If there's an error getting the word, return the error
        error
    end
  end
end
