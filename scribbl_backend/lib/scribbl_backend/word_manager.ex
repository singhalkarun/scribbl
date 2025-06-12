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
    "cemetery","reindeer","raft","hook","rescue","passenger","ostrich","plumber","powerline",
    "mudslide","parade","harbor","photographer","burglar","island","mailbox","motel","pirate",
    "mosquito","robot","farmer","coach","marathon","mechanic","flood","goldmine","pickpocket","raincoat",
    "gondola","iron","compass","newspaper","cannon","cactus","chef","fog","glider","hammock","forest",
    "fountain","diver","fisherman","janitor","fence","battery","mushroom","gardener","locksmith","campfire",
    "magnet","hobo","clown","igloo","incense","moat","chimney","drain","cashier","drone","drill","dentist",
    "freight","check-in","sunset","paperback","eclipse","modem","bubbles","raccoon","jigsaw","picnic","blueprint",
    "fiction","galaxy","marbles","smartwatch","cooking","chapter","commute","platypus","stargaze","sandbox",
    "origami","founder","biography","naptime","book store","tablet","brief-case","sun beam","flamingo","rainbow",
    "errands","submarine","bruschetta","slingshot","seashell","surfboard","hailstorm","observatory","scrapbooking",
    "bluetooth","joystick","headphones","dumpling","omelette","anchor","meteor","webcam","publisher","woodworking",
    "hopscotch","lasagna","tortilla","croissant","hide and seek","puzzle","painting","gardening","back packing","hostel",
    "passport","suitcase","teddy","play dough","weekend","birthday","sippy cup","swing","nursery","invoice","startup",
    "deadline","client","contract","circuit","speaker","console","gravity","rover","nebula","asteroid","launchpad",
    "satellite","space suit","starfish","kelp","tide pool","harpoon","scuba dive","coral reef","moon light","cloud burst",
    "comet","blizzard","novel","bookmark","audiobook","playpen","story book","crayons","smoothie","casserole","toucan","meerkat",
    "koala","armadillo","mongoose","jellyfish","noodles","cupcake","headset","gaming","streamer","tripod","time zone","boarding pass",
    "tarmac","pilot","wanderlust","road trip","cabin","bunk bed","landmark","scenic route","journal","binoculars","glamping",
    "caravan","bus stop","ticket booth","souvenir shop","beach ball","sunscreen","flashlight","tent pole","map reader","keycard",
    "e-ticket","luggage","carry-on","customs agent","security line","boarding gate","speedboat","boat house","fishing rod","paddle board",
    "kayak","snorkel","reef fish","tidal wave","sandcastle","bucket","spade","sunset cruise","piñata","balloon","doodle","bouncy castle",
    "magic trick","face paint","pinwheel","rocking horse","sandbox slide","splatter paint","yo-yo","trampoline","jump rope","paper airplane",
    "sock puppet","dress up","puppet show","ball pit","finger guns","water fight","baby rattle","crib mobile","pacifier","splat mat","diaper bag",
    "sippy","bath duck","teether","play gym","blankie","night light","lullaby","rain boots","snow globe","mittens","play group","toy box",
    "building blocks","stacking cups","plushie","story book time","fairytale","hideaway","play mat","rattlesnake","doll house",
    "scooter","roller blades","training wheels","tire swing","jungle gym","monkey bars","see-saw","carousel","roundabout","climbing frame",
    "whistle","sandbox fence","zip line","tire track","skateboard","helmet hair","knee pads","elbow pads","sparklers",
    "scooter ramp","camping trip","fire starter","marshmallow stick","star count","moon phase","night owl","lantern","bug spray",
    "tent stake","bonfire","story circle","campfire song","ghost story","snuggle blanket","mess kit","trail mix","hiking boots",
    "map fold","route finder","sign post","canteen","sleeping bag","bear bell","survival kit","pocket knife","compass needle","camp stool",
    "sun hat","trekking","hiking path","critter trap","bird feeder","log cabin","trail head","picnic table","tree house",
    "leaf pile","bug jar","nature walk","animal track","wild flower","acorn cap","river rock","feather pen",
    "drift wood","shell necklace","tide chart","ocean breeze","board walk","seagull","whale tail","dolphin splash","crab walk","crayon sun",
    "beach umbrella","sandy toes","life saver","floatation ring","snorkel mask","beach hat","coconut drink","sunscreen cap","flip flop",
    "beach chair","tan lines","suntan","shell shovel","sea salt","foamy wave","beach hammock","sea side lunch","coral polyp","pebble line",
    "drift line","glass jar","tide","wave sound","sand grain","sea urchin","jelly sting","sting ray","whale eye",
    "ocean floor","sea cucumber","fishing boat","clam bucket","oyster net","ship deck","port hole","sea route","pirate flag",
    "captain wheel","sailboat dock","anchor pole","rope knot","sea map","sail sheet","coast guard","weather beacon",
    "marine biologist","kelp forest","plankton bloom","ocean lab","sunken wreck","sea sponge","water current","thermocline","oceanographer",
    "tidal graph","hydrophone","sea dragon","nautilus","ocean swell","aquamarine","pelican bill","flying fish","halibut net","bait box",
    "lobster trap","clam digging","shell ring","ocean shell","mermaid tail","coral ring","starfish hug","sand dollar","turtle hatch","surfer wave",
    "wave crash","snorkel","minecart","realtor","radiator","broomstick","helicopter","limo",
    "ranger","goblin","interview","fireplace","repairman","lighthouse","painter","merry-go-around","greenhouse","hot air balloon"
  ]

  # Hard difficulty words - more complex, specific, or longer words
  @hard_words [
    "acorn","alchemy","alias","anchor","anorak","anther","anvil","avalanche","awning","backdoor","backfire",
    "backstab","badge","badger","baluster","banner","banshee","barcode","barricade","bassoon","bastion","bellhop","betrayal",
    "billow","black-box","black-cat","blackmail","blackout","blizzard","blood-moon","bloodhound","bone-pile","booby trap",
    "border-crossing","border-line","border-patrol","boulder","bramble","brazier","broken-clock","bug-out-bag","bugle","burner-phone",
    "buzz-cut","cactus","caliper","camouflage","canteen","canyon","carafe","carapace","carver","catacomb","cavern","centaur",
    "chalice","chameleon","chapel","cheat-code","chisel","choke-point","clamp","clarinet","cleaver","clinker","cloakroom","cloche",
    "cloister","clover","clue-board","clue-hunter","cobble","codeword","codex","codger","coin-flip","cold-case","cold-trail",
    "compass","confession","coral","corset","cover-story","cracked-mask","crash-site","crash-test","crashland","crater",
    "crevice","cult","curfew","cursed","cutlass","cuttle","cyclone","damper","dapple","daydream","dealbreaker",
    "death-mask","decibel","decoy","decoy-duck","deep-freeze","dervish","desertion","detour","disguise","doomsday",
    "double agent","double cross","double-life","dowel","dragonfly","dreamboat","dreamcatcher","dry-run",
    "dungeon","echo chamber","echo-locator","eclipse","ember","enchantment","escape-plan","exile","eye-patch",
    "fallback","falling-star","ferret","final-boss","firestorm","firewall","firewatch","fjord","flame-thrower","flashbang",
    "floodgate","floodlight","fog-machine","foghorn","forbidden-door","forcefield","fortune-teller","fresco",
    "frostbite","galleon","gallop","gas-leak","gas-mask","genie","geyser","ghost-signal","ghost-town","ghostwriter",
    "gimbal","ginger","glass-cage","glass-ceiling","glider","glyph","gnarled","goblet","goggle","goggles","gravedigger",
    "graveyard","grey-zone","gristle","grommet","grotto","grout","guilt-trip","gullet","gutter","haiku","hallucination",
    "hammock","harpoon","hatchling","hatchway","haunch","haunted","heatmap","heist","helix","hideout","high-tide",
    "hitlist","hoodwink","hostage","hostel","hydra","ice-wall","iceberg","icicle","identity-crisis","identity-theft",
    "illusion","illusionist","imposter","inkblot","invisible ink","iron-curtain","jackal","keyhole","keystone","kiln",
    "knapsack","knoll","knuckle","labyrinth","ladle","landmine","lantern","latchkey","ledger","lichen","lie-detector",
    "lighthouse","lightning rod","lightning-strike","limerick","lintel","loam","lockdown","locket","lockjaw","lockpick","lookout",
    "magnifying-glass","manatee","mapmaker","maraca","marzipan","mascot","masquerade","mayhem","maze-runner","memory-hole",
    "midnight","mime","minnow","minotaur","mirage","mirror maze","mirror-image","mohawk","mole","mollusk","mood-swing",
    "mothball","musket","nectar","night-train","nozzle","nugget","old flame","omen","opal","origami","outlaw",
    "outrigger","paddle","paddock","palette","panic-room","pantry","paper-trail","paratrooper","password",
    "password-hint","pebble","pelican","petiole","phantom","phantom-limb","pin-drop","pincer","plot-hole","plummet",
    "pollen","portico","power-cut","pressure-cooker","pressure-point","prism","prophecy","puffin","puppet","puzzle-box",
    "pylon","quicksand","quicksilver","radio-silence","rafter","ransom-note","red-herring","red-zone","relic","riddler",
    "ritual","runaway-train","sachet","sacrifice","safe-cracker","safe-house","safe-word","sandglass","sandstorm","sandtrap",
    "satchel","satellite-dish","scar","scare-quotes","scare-tactic","scarecrow","sconce","scoria","scroll","scythe","second-wind",
    "secret-keeper","shadow","shapeshifter","sharp-turn","shingle","sidekick","sifter","signal-fire","signal-jammer",
    "silver-bullet","siren","sleepwalker","sleight of hand","slipstream","smoke-ring","smokescreen","smoking gun",
    "smuggler","snake-charmer","sneak-attack","snorkel","spanner","spigot","spindle","spire","splint","spume",
    "spy-cam","spyglass","squall","squib","stage-fright","stakeout","stanchion","standoff","star-map","stargate",
    "stargazer","static","static-charge","steel-trap","steeple","stilts","stoat","strange-loop","street-magic",
    "streetlight","stubble","summit","swamp","switchblade","talon","tambourine","tassel","tea-kettle","tendon",
    "thicket","thimble","thistle","thunderstorm","tickbox","ticking-clock","timebomb","timekeeper","toggle",
    "tome","tornado","trap-set","trapdoor","trickster","triple-agent","tripwire","trivet","trophy-wall","truffle",
    "tundra","twilight","twine","underpass","underworld","vanishing act","vault","vault-door","velvet","vision-board",
    "visor","volcano","vulture","warning-sign","watchlist","watchtower","weasel","whirlwind","whisker",
    "whistleblower","whorl","winch","wire-tap","wrong-turn"
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
