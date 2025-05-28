# module to manage game state

defmodule ScribblBackend.GameHelper do
  @moduledoc """
  High-level game operations interacting with Redis via RedisHelper.
  """

  alias ScribblBackend.RedisHelper

  @room_prefix "room:"

  # get the room info if exists or create a new room
  @doc """
  Get or initialize a game room.
  If the room already exists, it returns the room info.
  If the room does not exist, it creates a new room with default options.
  ## Parameters
    - `room_id`: The ID of the room to get or create.
    - `opts`: Optional parameters for room creation (e.g., max_rounds).
  ## Examples
      iex> ScribblBackend.GameHelper.get_or_initialize_room("room_1")
      {:ok, %{"max_rounds" => 3, "current_round" => 0, "status" => "waiting", "current_drawer" => ""}}
  """

  def get_or_initialize_room(room_id, opts \\ []) do
    room_key = "#{@room_prefix}{#{room_id}}:info"

    # check if the room exists
    case RedisHelper.exists(room_key) do
      {:ok, 1} ->
        # room exists, return the room info
        {:ok, room_info} = RedisHelper.hgetall(room_key)

        room_info =
          Enum.chunk_every(room_info, 2)
          |> Enum.map(fn [k, v] -> {String.to_atom(k), v} end)
          |> Enum.into(%{})

        # If room is finished, reset the game state
        if room_info.status == "finished" do
          reset_game_state(room_id, opts)
        else
          {:ok, room_info}
        end

      {:ok, 0} ->
        # room does not exist, create a new room with default options
        reset_game_state(room_id, opts)

      {:error, reason} ->
        # handle error
        {:error, reason}
    end
  end

  # function to add player to the room
  @doc """
  Add a player to the game room.
  ## Parameters
    - `room_id`: The ID of the room to add the player to.
    - `player_id`: The ID of the player to add.
  ## Examples
      iex> ScribblBackend.GameHelper.add_player("room_1", "player_1")
      :ok
  """
  def add_player(room_id, player_id) do
    room_key = "#{@room_prefix}{#{room_id}}:players"

    # add the player to the room in the list of players
    RedisHelper.rpush(room_key, player_id)
  end

  # function to get the list of players in the room
  @doc """
  Get the list of players in the game room.
  ## Parameters
    - `room_id`: The ID of the room to get the players from.
  ## Examples
      iex> ScribblBackend.GameHelper.get_players("room_1")
      {:ok, ["player_1", "player_2"]}
  """
  def get_players(room_id) do
    room_key = "#{@room_prefix}{#{room_id}}:players"

    # get the list of players in the room
    RedisHelper.lrange(room_key)
  end

  @doc """
  Get scores for all players in a room.
  ## Parameters
    - `room_id`: The ID of the room to get scores from.
  ## Returns
    A map of player IDs to their scores.
  """
  def get_all_player_scores(room_id) do
    case get_players(room_id) do
      {:ok, players} ->
        scores = Enum.map(players, fn player_id ->
          player_score_key = "#{@room_prefix}{#{room_id}}:player:#{player_id}:score"
          case RedisHelper.get(player_score_key) do
            {:ok, score} when is_binary(score) -> {player_id, String.to_integer(score)}
            {:ok, nil} -> {player_id, 0}
            _ -> {player_id, 0}
          end
        end)
        {:ok, Map.new(scores)}
      error -> error
    end
  end

  # function to remove player from the room
  @doc """
  Remove a player from the game room.
  ## Parameters
    - `room_id`: The ID of the room to remove the player from.
    - `player_id`: The ID of the player to remove.
  ## Examples
      iex> ScribblBackend.GameHelper.remove_player("room_1", "player_1")
      :ok
  """
  def remove_player(room_id, player_id) do
    room_key = "#{@room_prefix}{#{room_id}}:players"

    # remove the player from the room in the list of players
    RedisHelper.lrem(room_key, player_id)

    # Check if room is empty and clean up if needed
    check_and_cleanup_empty_room(room_id)
  end

  def start(room_id) do
    # get or initialize the room
    {:ok, room_info} = get_or_initialize_room(room_id)

    # extract room info
    current_round = room_info.current_round
    max_rounds = room_info.max_rounds

    # get eligible drawer for the current round
    eligible_drawers_key = "#{@room_prefix}{#{room_id}}:round:#{current_round}:eligible_drawers"
    room_key = "#{@room_prefix}{#{room_id}}:info"
    players_key = "#{@room_prefix}{#{room_id}}:players"

    # reset the non eligible guessers list at the start of each turn
    non_eligible_guessers_key = "#{@room_prefix}{#{room_id}}:#{current_round}:non_eligible_guessers"
    RedisHelper.del(non_eligible_guessers_key)

    # Set game status to active
    RedisHelper.hmset(
      room_key,
      %{
        "status" => "active"
      }
    )

    case RedisHelper.spop(eligible_drawers_key) do
      {:ok, nil} ->
        # check if the current round is less than the max rounds
        if String.to_integer(current_round) >= String.to_integer(max_rounds) do
          # end the game
          RedisHelper.hmset(
            room_key,
            %{
              "status" => "finished",
              "current_drawer" => ""
            }
          )

          # send the game over event to all players
          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            "room:#{room_id}",
            %{
              event: "game_over",
              payload: %{}
            }
          )

          # Clean up the room state
          cleanup_room(room_id)

          {:error, "Game over"}
        else
          # move to the next round
          RedisHelper.hmset(
            room_key,
            %{
              "current_round" => String.to_integer(current_round) + 1
            }
          )

          # set the eligible drawers for the next round
          eligible_drawers_key =
            "#{@room_prefix}{#{room_id}}:round:#{String.to_integer(current_round) + 1}:eligible_drawers"

          # get the list of players in the room
          {:ok, players} = RedisHelper.lrange(players_key)

          # add players to the eligible drawers set
          RedisHelper.sadd(eligible_drawers_key, players)

          RedisHelper.del(non_eligible_guessers_key)

          # trigger start function again
          start(room_id)
        end

      {:ok, drawer} ->
        # set the current drawer in the room info
        RedisHelper.hmset(
          room_key,
          %{
            "current_drawer" => drawer
          }
        )

        # broadcast the drawer to all players
        Phoenix.PubSub.broadcast(
          ScribblBackend.PubSub,
          "room:#{room_id}",
          %{
            event: "drawer_assigned",
            payload: %{
              "round" => current_round,
              "drawer" => drawer
            }
          }
        )

        # generate a random word and send to the drawer
        words = generate_word()
        # send the word to the drawer
        Phoenix.PubSub.broadcast(
          ScribblBackend.PubSub,
          "user:#{drawer}",
          %{
            event: "select_word",
            payload: %{
              "words" => words
            }
          }
        )
    end
  end

  def generate_word() do
    # This function should return a random word from the word list

    words = ["dog", "cat", "fish", "bird", "horse", "cow", "pig", "sheep", "lion", "tiger", "elephant", "giraffe", "monkey", "bear", "wolf", "fox", "deer", "rabbit", "mouse", "rat", "snake", "turtle", "frog", "duck", "chicken", "penguin", "whale", "dolphin", "shark", "octopus", "bee", "butterfly", "spider", "ant", "fly", "mosquito", "zebra", "kangaroo", "koala", "squirrel", "panda", "gorilla", "seal", "bat", "owl", "eagle", "hawk", "camel", "crocodile", "dinosaur", "apple", "banana", "orange", "grape", "lemon", "watermelon", "strawberry", "cherry", "pineapple", "peach", "cake", "cookie", "bread", "pizza", "hamburger", "hotdog", "sandwich", "taco", "burrito", "ice cream", "donut", "candy", "chocolate", "popcorn", "noodle", "pasta", "rice", "egg", "cheese", "butter", "milk", "coffee", "tea", "juice", "soda", "water", "wine", "beer", "pie", "cupcake", "bacon", "sausage", "steak", "chicken", "carrot", "potato", "tomato", "onion", "corn", "mushroom", "chair", "table", "bed", "couch", "desk", "door", "window", "lamp", "clock", "mirror", "tv", "computer", "phone", "camera", "radio", "book", "pen", "pencil", "paper", "notebook", "box", "bag", "bottle", "cup", "plate", "bowl", "fork", "knife", "spoon", "key", "lock", "wallet", "purse", "glasses", "hat", "shirt", "pants", "dress", "shoes", "socks", "glove", "scarf", "umbrella", "backpack", "toothbrush", "soap", "towel", "pillow", "blanket", "carpet", "car", "bus", "train", "bike", "motorcycle", "airplane", "helicopter", "boat", "ship", "truck", "tractor", "rocket", "skateboard", "scooter", "wheelchair", "ambulance", "firetruck", "police car", "taxi", "submarine", "soccer", "football", "basketball", "baseball", "tennis", "golf", "bowling", "hockey", "volleyball", "rugby", "swimming", "running", "jumping", "climbing", "skiing", "snowboard", "surfing", "chess", "cards", "dice", "darts", "pool", "puzzle", "kite", "balloon", "frisbee", "yo-yo", "sled", "skates", "swing", "tree", "flower", "grass", "bush", "forest", "mountain", "hill", "river", "lake", "ocean", "beach", "island", "desert", "cave", "sun", "moon", "star", "cloud", "rain", "snow", "rainbow", "lightning", "fire", "smoke", "rock", "stone", "mud", "sand", "leaf", "branch", "house", "apartment", "school", "hospital", "store", "mall", "restaurant", "hotel", "church", "castle", "farm", "barn", "lighthouse", "bridge", "road", "street", "park", "playground", "zoo", "museum", "library", "airport", "stadium", "theater", "factory", "office", "bank", "police station", "fire station", "jail", "baby", "child", "boy", "girl", "man", "woman", "teacher", "doctor", "nurse", "police", "firefighter", "chef", "waiter", "farmer", "soldier", "artist", "clown", "king", "queen", "knight", "wizard", "witch", "ghost", "angel", "mermaid", "pirate", "cowboy", "ninja", "robot", "alien", "eye", "ear", "nose", "mouth", "tooth", "tongue", "face", "head", "hair", "beard", "arm", "hand", "finger", "thumb", "leg", "foot", "toe", "knee", "elbow", "shoulder", "neck", "back", "heart", "brain", "bone", "blood", "belly", "chest", "mustache", "muscle", "shirt", "pants", "shorts", "skirt", "dress", "jacket", "coat", "sweater", "hat", "cap", "helmet", "crown", "mask", "glasses", "sunglasses", "tie", "bow tie", "belt", "shoe", "boot", "sock", "glove", "scarf", "ring", "necklace", "watch", "bracelet", "earring", "badge", "button", "hammer", "nail", "screw", "screwdriver", "wrench", "pliers", "saw", "axe", "shovel", "rake", "broom", "mop", "bucket", "ladder", "scissors", "knife", "fork", "spoon", "sword", "shield", "bow", "arrow", "gun", "bullet", "cannon", "bomb", "grenade", "tank", "drill", "ruler", "guitar", "piano", "drum", "trumpet", "violin", "flute", "harmonica", "saxophone", "trombone", "harp", "bell", "whistle", "microphone", "speaker", "radio", "headphones", "record", "tape", "cd", "mp3", "smile", "laugh", "cry", "angry", "sleep", "wake", "walk", "run", "jump", "dance", "sing", "talk", "yell", "whisper", "kiss", "hug", "wave", "clap", "point", "grab", "throw", "catch", "push", "pull", "kick", "punch", "fight", "fall", "climb", "hide", "sun", "moon", "star", "cloud", "rain", "snow", "storm", "wind", "tornado", "hurricane", "lightning", "thunder", "rainbow", "fog", "ice", "spring", "summer", "fall", "winter", "morning", "afternoon", "evening", "night", "cold", "hot", "warm", "cool", "wet", "dry", "freeze", "book", "notebook", "paper", "pen", "pencil", "marker", "crayon", "ruler", "eraser", "glue", "tape", "scissors", "stapler", "paperclip", "folder", "binder", "calculator", "computer", "printer", "projector", "desk", "chair", "whiteboard", "blackboard", "chalk", "teacher", "student", "classroom", "homework", "test", "circle", "square", "triangle", "rectangle", "star", "heart", "arrow", "line", "dot", "cross", "red", "blue", "green", "yellow", "orange", "purple", "pink", "brown", "black", "white", "gray", "gold", "silver", "rainbow", "light", "dark", "bright", "dull", "pattern", "spot", "bubble", "hole", "smoke", "fire", "wave", "shadow", "flag", "map", "sign", "arrow", "gift", "present", "ball", "balloon", "candle", "match", "rope", "chain", "web", "nest", "tooth", "bone", "feather", "shell", "wheel", "hook", "needle", "pin", "button", "zipper", "swim", "fish", "hunt", "hike", "camp", "ski", "sail", "cook", "bake", "clean", "paint", "draw", "write", "read", "study", "build", "fix", "grow", "plant", "dig", "cut", "sew", "knit", "drive", "ride", "fly", "shoot", "catch", "throw", "hit", "crab", "lobster", "shrimp", "snail", "worm", "beetle", "grasshopper", "ladybug", "dragonfly", "centipede", "scorpion", "lizard", "alligator", "hippo", "rhino", "ostrich", "flamingo", "peacock", "crow", "swan", "goose", "turkey", "parrot", "goat", "donkey", "bull", "buffalo", "moose", "raccoon", "skunk", "pear", "plum", "melon", "coconut", "avocado", "lime", "olive", "pepper", "cucumber", "lettuce", "celery", "broccoli", "peas", "beans", "pretzel", "pancake", "waffle", "cereal", "oatmeal", "yogurt", "honey", "jam", "jelly", "syrup", "salt", "pepper", "soup", "salad", "sauce", "ketchup", "fan", "heater", "vacuum", "broom", "dustpan", "trash", "garbage", "can", "pot", "pan", "stove", "oven", "microwave", "fridge", "freezer", "sink", "shower", "bath", "toilet", "brush", "comb", "shampoo", "razor", "tissue", "bandage", "medicine", "pill", "remote", "battery", "charger", "garden", "yard", "porch", "garage", "basement", "attic", "roof", "wall", "fence", "gate", "sidewalk", "path", "trail", "field", "meadow", "swamp", "cliff", "waterfall", "fountain", "pond", "well", "mine", "tunnel", "tent", "cabin", "hut", "igloo", "pyramid", "tower", "windmill", "doll", "teddy bear", "action figure", "robot", "car", "truck", "train", "plane", "boat", "ball", "marble", "block", "puzzle", "game", "board game", "card", "dice", "checkers", "chess", "domino", "top", "yo-yo", "kite", "sled", "skate", "bike", "tricycle", "wagon", "swing", "slide", "computer", "laptop", "tablet", "phone", "camera", "video", "movie", "tv", "screen", "keyboard", "mouse", "speaker", "headphone", "charger", "battery", "wire", "cable", "outlet", "plug", "button", "switch", "remote", "game", "console", "controller", "robot", "drone", "satellite", "antenna", "radio", "chair", "table", "desk", "bed", "couch", "sofa", "bench", "stool", "shelf", "bookcase", "cabinet", "drawer", "closet", "hanger", "mirror", "frame", "picture", "painting", "poster", "clock", "lamp", "light", "ceiling", "floor", "wall", "door", "window", "curtain", "blind", "rug", "cake", "candle", "present", "gift", "card", "balloon", "party", "birthday", "wedding", "baby", "santa", "christmas", "tree", "snowman", "easter", "egg", "bunny", "halloween", "ghost", "pumpkin", "witch", "valentine", "heart", "firework", "parade", "costume", "mask", "hat", "crown", "flag", "island", "mountain", "volcano", "tornado", "lightning", "thunder", "rainbow", "shooting star", "ufo", "rocket", "meteor", "planet", "moon", "sun", "eclipse", "constellation", "satellite", "telescope", "microscope", "compass", "map", "globe", "anchor", "mummy", "zombie", "vampire", "werewolf", "fairy", "unicorn", "dragon"]

    Enum.take_random(words, 3)

  end

  def start_turn(room_id, word) do
    room_word_key = "#{@room_prefix}{#{room_id}}:word"
    room_timer_key = "#{@room_prefix}{#{room_id}}:timer"
    room_canvas_key = "#{@room_prefix}{#{room_id}}:canvas"
    room_reveal_timer_key = "#{@room_prefix}{#{room_id}}:reveal_timer"

    # Reset canvas data before starting new turn
    RedisHelper.del(room_canvas_key)

    # Reset revealed indices for the new word
    revealed_key = "#{@room_prefix}{#{room_id}}:revealed_indices"
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
  Save canvas data for a room.
  ## Parameters
    - `room_id`: The ID of the room
    - `canvas_data`: The canvas data to save
  """
  def save_canvas(room_id, %{
    "drawMode" => _drawMode,
    "strokeColor" => _strokeColor,
    "strokeWidth" => _strokeWidth,
    "paths" => _paths
  } = canvas_data) do
    room_canvas_key = "#{@room_prefix}{#{room_id}}:canvas"

    # Get existing canvas data
    case RedisHelper.get(room_canvas_key) do
      {:ok, nil} ->
        # If no existing data, save the new data as is
        RedisHelper.set(room_canvas_key, Jason.encode!(%{
          "canvas" => [canvas_data],
          "lastUpdate" => System.system_time(:millisecond)
        }))

      {:ok, existing_data} ->
        # If there's existing data, append the new increment
        existing = Jason.decode!(existing_data)
        updated_canvas = existing["canvas"] ++ [canvas_data]

        RedisHelper.set(room_canvas_key, Jason.encode!(%{
          "canvas" => updated_canvas,
          "lastUpdate" => System.system_time(:millisecond)
        }))

      error -> error
    end
  end

  @doc """
  Get canvas data for a room.
  ## Parameters
    - `room_id`: The ID of the room
  ## Returns
    The canvas array if it exists, nil otherwise
  """
  def get_canvas(room_id) do
    room_canvas_key = "#{@room_prefix}{#{room_id}}:canvas"
    case RedisHelper.get(room_canvas_key) do
      {:ok, nil} -> {:ok, nil}
      {:ok, canvas_data} ->
        case Jason.decode!(canvas_data) do
          %{"canvas" => canvas} -> {:ok, canvas}
          _ -> {:ok, nil}
        end
      error -> error
    end
  end

  def get_current_drawer(room_id) do
    room_key = "#{@room_prefix}{#{room_id}}:info"

    # get the current drawer
    {:ok, current_drawer} = RedisHelper.hget(room_key, "current_drawer")

    {:ok, current_drawer}
  end

  def handle_guess(message, socket) do
    # check if the guess is correct
    room_id = String.split(socket.topic, ":") |> List.last()
    room_word_key = "#{@room_prefix}{#{room_id}}:word"
    room_key = "#{@room_prefix}{#{room_id}}:info"
    room_timer_key = "#{@room_prefix}{#{room_id}}:timer"
    user_id = socket.assigns.user_id
    players_key = "#{@room_prefix}{#{room_id}}:players"

    {:ok, drawer} = RedisHelper.hget(room_key, "current_drawer")
    {:ok, round} = RedisHelper.hget(room_key, "current_round")

    if drawer == socket.assigns.user_id do
      # ignore the message
      {:noreply, socket}
    else
      # get the word from Redis
      {:ok, word} = RedisHelper.get(room_word_key)

      # check if the guess is correct
      if String.downcase(message) == String.downcase(word) do
        # check if the user is not eligible to guess
        non_eligible_guessers_key = "#{@room_prefix}{#{room_id}}:#{round}:non_eligible_guessers"
        {:ok, is_non_eligible} = RedisHelper.sismember(non_eligible_guessers_key, user_id)

        if is_non_eligible == 1 do
          # ignore the message
          {:noreply, socket}
        else
          # send the correct guess event to all players and increase player score basis time when the guess was made
          # get the current time remaining on the timer
          {:ok, time_remaining_seconds} = RedisHelper.ttl(room_timer_key)

          # Calculate the score to be awarded for this correct guess.
          # Score is based on the time remaining. More time left = more points.
          # Ensure score is not negative.
          score_awarded_for_this_guess = max(0, time_remaining_seconds)

          # Increase the guesser's score.
          player_score_key = "#{@room_prefix}{#{room_id}}:player:#{user_id}:score"
          {:ok, guesser_new_total_score} = RedisHelper.incr(player_score_key, score_awarded_for_this_guess)

          # add the player in non eligible guessers list, sadd takes key and list of values
          RedisHelper.sadd(non_eligible_guessers_key, List.wrap(user_id))

          # check if length of non eligible players is equal to total players
          {:ok, num_non_eligible_players} = RedisHelper.scard(non_eligible_guessers_key)
          {:ok, num_players} = RedisHelper.llen(players_key)

          # Only proceed if we have at least 2 players (drawer + 1 guesser)
          if num_players >= 2 do
            # Check if all players except the drawer have guessed correctly
            if num_non_eligible_players == num_players - 1 do
              # Broadcast turn_over event
              Phoenix.PubSub.broadcast(
                ScribblBackend.PubSub,
                socket.topic,
                %{
                  event: "turn_over",
                  payload: %{
                    "reason" => "all_guessed",
                    "word" => word
                  }
                }
              )

              RedisHelper.del("room:{#{room_id}}:reveal_timer")

              # Start next turn
              start(room_id)
            end
          end

          # Drawer Scoring: Award points to the drawer based on how many players have guessed
          # and how quickly this particular player guessed.
          # The bonus decreases for subsequent guessers.
          # score_awarded_for_this_guess is the score the current correct guesser received.
          # num_non_eligible_players is the count of correct guessers so far in this turn (including current one).
          points_for_drawer_from_this_guess =
            cond do
              num_non_eligible_players == 1 -> score_awarded_for_this_guess # 100% for the 1st guesser
              num_non_eligible_players == 2 -> round(score_awarded_for_this_guess * 0.5) # 50% for the 2nd
              num_non_eligible_players == 3 -> round(score_awarded_for_this_guess * 0.25) # 25% for the 3rd
              num_non_eligible_players >= 4 -> round(score_awarded_for_this_guess * 0.10) # 10% for 4th+
              true -> 0 # Default case
            end

          # Ensure points are non-negative.
          actual_points_for_drawer = max(0, points_for_drawer_from_this_guess)

          if actual_points_for_drawer > 0 do
            drawer_score_key = "#{@room_prefix}{#{room_id}}:player:#{drawer}:score"
            # Increment the drawer's score by the points calculated for *this specific guess*.
            {:ok, drawer_new_total_score} = RedisHelper.incr(drawer_score_key, actual_points_for_drawer)

            Phoenix.PubSub.broadcast(
              ScribblBackend.PubSub,
              socket.topic,
              %{
                event: "score_updated",
                payload: %{
                  "user_id" => drawer,
                  "score" => drawer_new_total_score # This is the drawer's new *total* score
                }
              }
            )
          end

          # send the score to all players
          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            socket.topic,
            %{
              event: "score_updated",
              payload: %{
                "user_id" => user_id,
                "score" => guesser_new_total_score
              }
            }
          )

          Phoenix.PubSub.broadcast(
            ScribblBackend.PubSub,
            socket.topic,
            %{
              event: "correct_guess",
              payload: %{
                "user_id" => socket.assigns.user_id
              }
            }
          )
        end
      else
        # send the message to all players
        Phoenix.PubSub.broadcast(
          ScribblBackend.PubSub,
          socket.topic,
          %{
            event: "new_message",
            payload: %{
              "message" => message,
              "userId" => user_id
            }
          }
        )
      end
    end
  end

  @doc """
  Clean up all Redis keys associated with a room.
  This should be called when the game is over or all players have left.
  ## Parameters
    - `room_id`: The ID of the room to clean up.
  """
  def cleanup_room(room_id) do
    # Get all keys associated with this room
    room_pattern = "#{@room_prefix}{#{room_id}}:*"
    room_key = "#{@room_prefix}{#{room_id}}:info"

    # Set game status to waiting
    RedisHelper.hmset(
      room_key,
      %{
        "status" => "waiting"
      }
    )

    # Delete all keys matching the pattern EXCEPT the players list
    case RedisHelper.keys(room_pattern) do
      {:ok, keys} ->
        # Filter out the players key
        keys_to_delete = Enum.reject(keys, fn key ->
          String.ends_with?(key, ":players")
        end)

        Enum.each(keys_to_delete, fn key -> RedisHelper.del(key) end)
      {:error, _reason} ->
        :ok
    end
  end

  @doc """
  Check if a room is empty and clean it up if needed.
  This should be called when a player leaves the room.
  ## Parameters
    - `room_id`: The ID of the room to check.
  """
  def check_and_cleanup_empty_room(room_id) do
    players_key = "#{@room_prefix}{#{room_id}}:players"

    case RedisHelper.llen(players_key) do
      {:ok, 0} ->
        # Room is empty, clean it up
        cleanup_room(room_id)
        :ok
      {:ok, _} ->
        # Room still has players
        :ok
      {:error, _reason} ->
        {:error, "Failed to check room"}
    end
  end

  @doc """
  Reset the game state for a room while keeping the players.
  This should be called when starting a new game.
  ## Parameters
    - `room_id`: The ID of the room to reset.
    - `opts`: Optional parameters for room initialization (e.g., max_rounds).
  """
  def reset_game_state(room_id, opts \\ []) do
    room_key = "#{@room_prefix}{#{room_id}}:info"
    max_rounds = Keyword.get(opts, :max_rounds, 3)

    # Reset the room info
    RedisHelper.hmset(
      room_key,
      %{
        "max_rounds" => max_rounds,
        "current_round" => 0,
        "status" => "waiting",
        "current_drawer" => ""
      }
    )

    # Get the updated room info
    {:ok, room_info} = RedisHelper.hgetall(room_key)

    room_info =
      Enum.chunk_every(room_info, 2)
      |> Enum.map(fn [k, v] -> {String.to_atom(k), v} end)
      |> Enum.into(%{})

    {:ok, room_info}
  end

  @doc """
  Clear canvas data for a room.
  ## Parameters
    - `room_id`: The ID of the room
  """
  def clear_canvas(room_id) do
    room_canvas_key = "#{@room_prefix}{#{room_id}}:canvas"
    RedisHelper.del(room_canvas_key)
  end

  @doc """
  Start the reveal timer for a room.
  ## Parameters
    - `room_id`: The ID of the room
  """
  def start_reveal_timer(room_id) do
    room_reveal_timer_key = "#{@room_prefix}{#{room_id}}:reveal_timer"

    # Set the timer basis on the word length
    word_key = "#{@room_prefix}{#{room_id}}:word"
    case RedisHelper.get(word_key) do
      {:ok, word} ->
        word_length = String.length(word)

        if word_length < 2 do
          {:error, :word_too_short}
        else
          timer_duration = trunc(30 / (word_length / 2))
          RedisHelper.setex(room_reveal_timer_key, timer_duration, "reveal_letter")
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Reveals the next letter of the current word in the game.
  This function is used as a hint mechanism during gameplay.

  ## Parameters
    - `room_id`: The ID of the room

  ## Returns
    - `{:ok, revealed_word}` - A list of characters with revealed letters and underscores for hidden ones
    - `{:ok, word_graphemes}` - All letters revealed (when all have been revealed)
    - `{:error, :word_not_found}` - If no word is set for the room
    - `{:error, error}` - Other errors
  """
  def reveal_next_letter(room_id) do
    word_key = "#{@room_prefix}{#{room_id}}:word"
    revealed_key = "#{@room_prefix}{#{room_id}}:revealed_indices"

    with {:ok, word} when not is_nil(word) <- RedisHelper.get(word_key),
         {:ok, revealed_json} <- RedisHelper.get(revealed_key) do

      revealed_indices =
        case revealed_json do
          nil -> MapSet.new()
          _ -> Jason.decode!(revealed_json) |> MapSet.new()
        end

      word_graphemes = String.graphemes(word)
      all_indices = 0..(length(word_graphemes) - 1)
      remaining_indices = Enum.reject(all_indices, &MapSet.member?(revealed_indices, &1))

      case remaining_indices do
        [] ->
          {:ok, word_graphemes}

        _ ->
          index = Enum.random(remaining_indices)
          updated_set = MapSet.put(revealed_indices, index)
          updated_json = Jason.encode!(MapSet.to_list(updated_set))

          RedisHelper.set(revealed_key, updated_json)

          revealed_word =
            word_graphemes
            |> Enum.with_index()
            |> Enum.map(fn {ch, i} ->
              if MapSet.member?(updated_set, i), do: ch, else: "_"
            end)

          {:ok, revealed_word}
      end
    else
      {:ok, nil} -> {:error, :word_not_found}
      error -> {:error, error}
    end
  end
end
