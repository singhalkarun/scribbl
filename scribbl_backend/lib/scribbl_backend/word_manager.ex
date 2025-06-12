defmodule ScribblBackend.WordManager do
  @moduledoc """
  Handles word generation, guessing, and related operations for Scribbl.
  Extracts functionality from GameHelper related to word management.
  """

  alias ScribblBackend.RedisHelper
  alias ScribblBackend.KeyManager
  alias ScribblBackend.GameState

  # Easy difficulty words - common, simple words
  @easy_words [
    "apple","ball","cat","dog","fish","tree","house","car","sun","moon","star","hat","shoe","book","bed",
    "chair","door","bird","flower","cup","pen","pencil","phone","bag","leaf","banana","egg","milk","spoon",
    "fork","plate","clock","cloud","grass","water","fire","ice","snow","hand","foot","eye","nose","ear","mouth",
    "face","shirt","pants","socks","train","bus","truck","plane","boat","bottle","box","coin","key","ring","watch",
    "bagel","toast","soap","towel","lamp","candle","pizza","cake","cookie","donut","cow","pig","horse","lion",
    "zebra","monkey","bear","snake","bee","ant","frog","rain","broom","brush","glove","sand","rope","nut","corn",
    "toy","doll","bat","balloon","map","web","net","zipper","plant","nest","shell","goal","helmet","skate","ski","sled",
    "snowball","snowflake","hockey","soccer","tennis","cricket","baseball","basketball","football","volleyball",
    "golf","run","jump","walk","dance","sing","clap","swim","dive","ride","throw","catch","kick","hit","score",
    "win","lose","team","coach","player","referee","whistle","bench","fan","cheer","game","match","trophy",
    "medal","jersey","shorts","shoes","cap","flag","streamer","parade","drum","guitar","piano","violin","trumpet",
    "flute","microphone","speaker","radio","band","singer","stage","curtain","light","show","concert","actor",
    "actress","film","ticket","popcorn","seat","screen","poster","camera","video","scene","clapboard",
    "cartoon","comic","bookstore","library","school","classroom","desk","blackboard","chalk","notebook",
    "textbook","ruler","eraser","crayon","marker","stapler","glue","tape","paperclip","folder","lunchbox",
    "waterbottle","busbell","uniform","teacher","student","homework","test","exam","grade","math","science",
    "history","geography","art","music","sports","lunch","recess","break","calendar","alarm","schedule",
    "window","floor","wall","ceiling","bulb","plug","switch","bin","bucket","cleaner","mop","sponge",
    "sink","toilet","tap","mirror","comb","hairpin","toothbrush","toothpaste","shampoo","bathroom","bedroom",
    "kitchen","hall","sofa","cushion","blanket","pillow","mat","rug","table","stool","wardrobe","drawer","shelf",
    "vase","flowerpot","painting","paint","paper","scissors","bookcase","fridge","stove","jeans","jacket","scarf",
    "boots","sneakers","slippers","gloves","necklace","earring","sunglasses","tablet","laptop","mouse","keyboard",
    "monitor","remote","television","battery","cable","ladder","hammer","nail","screw","wood","brick","cement","basket",
    "can","jar","tin","tissue","napkin","bowl","mug","glass","knife","slice","burger","hotdog","rice","beans","grape","peach",
    "pear","plum","lemon","lime","melon","carrot","onion","peas","garden","bush","rose","sunflower","tulip","daisy","fruit",
    "vegetable","mango","papaya","potato","tomato","bean","pea","pepper","radish","beetroot","spinach","lettuce","cabbage",
    "broccoli","cauliflower","brinjal","cucumber","pumpkin","cherry","guava","coconut","pineapple","watermelon","berry",
    "strawberry","blueberry","blackberry","raspberry","fig","date","olive","kiwi","apricot","mangoes","orange","tangerine","mandarin",
    "nectarine","citrus","squash","yam","turnip","mushroom","herbs","spices","salt","sugar","honey","oil","butter","cheese","cream",
    "curd","yogurt","pickle","jam","jelly","ketchup","sauce","soup","stew","noodles","pasta","eggplant","garlic","bread","juice",
    "soda","tea","coffee","pie","candy","chocolate","cracker","pretzel","sandwich","noodle","spaghetti","meat","chicken","beef","pork",
    "bacon","sausage","sushi","taco","burrito","salad","cereal","fries","mustard","mayo","pan","pot","grill","oven","microwave","freezer",
    "kettle","toaster","pastry","biscuit","nuggets","wrap","steak","gravy","cornflakes","oats","nuts","almond","peanut","cashew","walnut",
    "pistachio","raisins","dates","figs","chips","icecream","popsicle","sundae","cone","lid","tray","chopsticks","cloth","cabinet","counter",
    "dish","dustbin","duster","rabbit","duck","goat","sheep","fly","spider","butterfly","turtle","lizard","crab","shark","whale","dolphin",
    "octopus","seal","starfish","jellyfish","camel","tiger","giraffe","kangaroo","owl","eagle","parrot","penguin","seagull","wolf","deer",
    "fox","raccoon","skunk","squirrel","hedgehog","hamster","kitten","puppy","hive","feather","tail","claw","fin","wing","beak","horn",
    "hoof","fur","scales","tooth","leg","arm","finger","thumb","knee","elbow","head","hair","neck","back","belly","heart","sky","wind",
    "snowman","umbrella","rainbow","bike","ship","puzzle","block","board","card","spinner","kite","robot","xylophone","picture","scooter",
    "van","taxi","subway","ferry","yacht","jet","helicopter","rocket","wheel","tire","engine","brake","gas","road","bridge","tunnel","highway",
    "street","traffic","sign","signal","crosswalk","stoplight","compass","backpack","suitcase","purse","sock","boot","chain","belt","button",
    "pocket","dress","skirt","coat","tie","bow","vest","mask","glasses","wire","bell","photo","cord","globe","spectacles","wallet",
    "lock","charger","timer","baby","child","man","woman"
  ]

  # Medium difficulty words - moderately complex words
  @medium_words [
    "elephant", "giraffe", "monkey", "bear", "wolf", "fox", "deer", "rabbit", "mouse", "snake",
    "turtle", "frog", "duck", "chicken", "penguin", "whale", "dolphin", "shark", "octopus", "bee",
    "butterfly", "spider", "ant", "watermelon", "strawberry", "cherry", "pineapple", "hamburger",
    "sandwich", "ice cream", "donut", "chocolate", "coffee", "tea", "juice", "cheese", "computer",
    "camera", "glasses", "umbrella", "backpack", "airplane", "helicopter", "truck", "motorcycle",
    "soccer", "football", "basketball", "baseball", "tennis", "swimming", "mountain", "beach",
    "forest", "river", "bridge", "castle", "farm", "doctor", "teacher", "police", "firefighter",
    "kangaroo", "koala", "squirrel", "panda", "gorilla", "seal", "bat", "owl", "eagle", "hawk",
    "camel", "crocodile", "dinosaur", "mosquito", "zebra", "taco", "burrito", "popcorn", "noodle",
    "pasta", "sausage", "steak", "carrot", "potato", "tomato", "onion", "corn", "mushroom",
    "wallet", "purse", "scarf", "glove", "toothbrush", "soap", "towel", "pillow", "blanket",
    "carpet", "skateboard", "scooter", "wheelchair", "ambulance", "firetruck", "police car",
    "taxi", "submarine", "bowling", "hockey", "volleyball", "rugby", "climbing", "skiing",
    "snowboard", "surfing", "chess", "darts", "frisbee", "lighthouse", "stadium", "theater",
    "factory", "office", "museum", "library", "airport", "artist", "clown", "wizard", "witch",
    "ghost", "angel", "mermaid", "pirate", "cowboy", "ninja", "robot", "alien", "dog", "cat", "fish", "bird", "horse", "cow", "pig", "sheep", "lion", "tiger",
    "apple", "banana", "orange", "grape", "lemon", "cake", "cookie", "bread", "pizza",
    "car", "bus", "train", "bike", "boat", "ship", "house", "tree", "flower", "sun",
    "moon", "star", "rain", "snow", "book", "pen", "ball", "toy", "hat", "shoe",
    "chair", "table", "bed", "door", "window", "phone", "baby", "child", "man", "woman"
  ]

  # Hard difficulty words - more complex, specific, or longer words
  @hard_words [
    "kangaroo", "koala", "squirrel", "panda", "gorilla", "seal", "bat", "owl", "eagle", "hawk",
    "camel", "crocodile", "dinosaur", "mosquito", "zebra", "taco", "burrito", "popcorn", "noodle",
    "pasta", "sausage", "steak", "carrot", "potato", "tomato", "onion", "corn", "mushroom",
    "wallet", "purse", "scarf", "glove", "toothbrush", "soap", "towel", "pillow", "blanket",
    "carpet", "skateboard", "scooter", "wheelchair", "ambulance", "firetruck", "police car",
    "taxi", "submarine", "bowling", "hockey", "volleyball", "rugby", "climbing", "skiing",
    "snowboard", "surfing", "chess", "darts", "frisbee", "lighthouse", "stadium", "theater",
    "factory", "office", "museum", "library", "airport", "artist", "clown", "wizard", "witch",
    "ghost", "angel", "mermaid", "pirate", "cowboy", "ninja", "robot", "alien"
  ]

  @doc """
  Generate a list of random words for drawing based on the room's difficulty setting.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    A list of 3 random words.
  """
  def generate_words(room_id \\ nil) do
    # If no room_id is provided, default to medium difficulty
    words = if is_nil(room_id) do
      @medium_words
    else
      # Get room settings to determine difficulty
      {:ok, room_info} = GameState.get_room(room_id)

      # Get difficulty level from room settings (default "medium" if not set)
      difficulty = case room_info do
        %{difficulty: difficulty} when difficulty in ["easy", "medium", "hard"] ->
          difficulty
        _ ->
          "medium"
      end

      # Select word list based on difficulty
      case difficulty do
        "easy" -> @easy_words
        "hard" -> @hard_words
        _ -> @medium_words
      end
    end

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

    # Get room settings
    {:ok, room_info} = GameState.get_room(room_id)

    # Parse turn time from room settings (default 60 seconds if not set)
    turn_time = case room_info.turn_time do
      nil -> 60
      "" -> 60
      time -> String.to_integer(time)
    end

    # Determine if hints are allowed (default true if not set)
    hints_allowed = case room_info.hints_allowed do
      nil -> true
      "" -> true
      "false" -> false
      _ -> true
    end

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
      turn_time,
      "active"
    )

    # Set a timer for letter reveal if hints are allowed
    if hints_allowed do
      word_length = String.length(word)

      if word_length >= 2 do
        # Calculate reveal time based on word length
        # First reveal happens at half of the turn time
        initial_reveal_time = div(turn_time, 2)
        RedisHelper.setex(
          room_reveal_timer_key,
          initial_reveal_time,
          "reveal_letter"
        )
      end
    end

    {:ok, %{"word_length" => Integer.to_string(String.length(word)), "time_remaining" => turn_time}}
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
  The timer duration is calculated based on the length of the current word.
  Shorter words get longer per-letter reveal times, longer words get shorter.
  The overall goal is that roughly half the word should be revealed by the main turn timer's halfway point (30s).
  Minimum timer duration is 1 second.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    - `{:ok, "OK"}` if the timer was set successfully.
    - `{:error, :word_too_short}` if the word length is less than 2.
    - `{:error, :word_not_found}` if no word is set for the room or word is empty.
    - `{:error, reason}` for other Redis errors.
  """
  def start_reveal_timer(room_id) do
    room_reveal_timer_key = KeyManager.reveal_timer(room_id)
    word_key = KeyManager.current_word(room_id)

    {:ok, room_info} = GameState.get_room(room_id)

    # Determine if hints are allowed (default true if not set)
    hints_allowed = case room_info.hints_allowed do
      nil -> true
      "" -> true
      "false" -> false
      _ -> true
    end

    if hints_allowed do

      case RedisHelper.get(word_key) do
        {:ok, word} when is_binary(word) and word != "" ->
          word_length = String.length(word)

          if word_length < 2 do
            {:error, :word_too_short}
          else
            # Formula: trunc( (total_reveal_time / (num_letters_to_reveal_by_half_time) ) )
            # total_reveal_time = 30 (half of main turn timer)
            # num_letters_to_reveal_by_half_time = word_length / 2 (approximately)
            # So, duration_per_letter = 30 / (word_length / 2) = 60 / word_length
            # We ensure a minimum duration of 1 second.
            timer_duration = max(1, trunc(60 / word_length))
            RedisHelper.setex(room_reveal_timer_key, timer_duration, "reveal_letter")
          end

        {:ok, _} -> # Handles nil or empty word from Redis get
          {:error, :word_not_found}

        {:error, reason} -> # Handles Redis command errors
          {:error, reason}
      end
    else
      {:error, :hints_disabled}
    end
  end

  @doc """
  Reveal the next letter of the word.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    - `{:ok, revealed_word}` - A list of characters with revealed letters and underscores for hidden ones
    - `{:ok, word_graphemes}` - All letters revealed (when all have been revealed)
    - `{:error, :word_not_found}` - If no word is set for the room
    - `{:error, :hints_disabled}` - If hints are disabled for the room
    - `{:error, error}` - Other errors
  """
  def reveal_next_letter(room_id) do
    # Get room settings
    {:ok, room_info} = GameState.get_room(room_id)

    # Determine if hints are allowed (default true if not set)
    hints_allowed = case room_info.hints_allowed do
      nil -> true
      "" -> true
      "false" -> false
      _ -> true
    end

    # If hints are not allowed, return an error
    unless hints_allowed do
      {:error, :hints_disabled}
    else
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

  @doc """
  Get the current word state (word length and revealed indices) for a room.
  Used when a new player joins an active game.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    - `{:ok, %{word_length: length, revealed_word: revealed_word, time_remaining: seconds}}` - The word length, partially revealed word, and remaining time
    - `{:error, :word_not_found}` - If no word is set for the room
    - `{:error, error}` - Other errors
  """
  def get_current_word_state(room_id) do
    revealed_key = KeyManager.revealed_indices(room_id)
    turn_timer_key = KeyManager.turn_timer(room_id)

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

        # Get the time remaining for the turn
        {:ok, time_remaining} = RedisHelper.ttl(turn_timer_key)

        word_graphemes = String.graphemes(word)

        # Construct the partially revealed word as a list
        revealed_word = word_graphemes
          |> Enum.with_index()
          |> Enum.map(fn {char, i} ->
            if MapSet.member?(revealed_indices, i), do: char, else: "_"
          end)

        {:ok, %{
          word_length: String.length(word),
          revealed_word: revealed_word,
          time_remaining: time_remaining
        }}

      error ->
        # If there's an error getting the word, return the error
        error
    end
  end
end
