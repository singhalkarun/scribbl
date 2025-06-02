# module to manage game state

defmodule ScribblBackend.GameHelper do
  @moduledoc """
  High-level game operations interacting with various subsystems.
  Acts as a facade for the game's core functionality.

  Note: This module is being refactored to delegate to more focused modules.
  """

  alias ScribblBackend.GameState
  alias ScribblBackend.PlayerManager
  alias ScribblBackend.WordManager
  alias ScribblBackend.CanvasManager
  alias ScribblBackend.GameFlow

  # get the room info if exists or create a new room
  @spec get_or_initialize_room(any()) ::
          {:error,
           atom()
           | %{
               :__exception__ => true,
               :__struct__ => Redix.ConnectionError | Redix.Error,
               optional(:message) => binary(),
               optional(:reason) => atom()
             }}
          | {:ok, any()}
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
    GameState.get_or_initialize_room(room_id, opts)
  end

  @doc """
  Get an existing room.
  If the room does not exist, it returns an error.

  ## Parameters
    - `room_id`: The ID of the room to get.

  ## Examples
      iex> ScribblBackend.GameHelper.get_room("room_1")
      {:ok, %{max_rounds: "3", current_round: "0", status: "waiting", current_drawer: ""}}
  """
  def get_room(room_id) do
    GameState.get_room(room_id)
  end

  @doc """
  Create a new game room with specified options.
  If the room already exists, it returns an error.

  ## Parameters
    - `room_id`: The ID of the room to create.
    - `admin_id`: The ID of the user who will be the room admin.
    - `opts`: Optional parameters for room creation.

  ## Examples
      iex> ScribblBackend.GameHelper.create_room("room_1", "user_123", max_rounds: 5)
      {:ok, %{max_rounds: "5", current_round: "0", status: "waiting", current_drawer: "", admin_id: "user_123"}}
  """
  def create_room(room_id, admin_id, opts \\ []) do
    GameState.create_room(room_id, admin_id, opts)
  end

  @doc """
  Get the admin ID of a room.

  ## Parameters
    - `room_id`: The ID of the room to get the admin from.

  ## Examples
      iex> ScribblBackend.GameHelper.get_room_admin("room_1")
      {:ok, "user_123"}
  """
  def get_room_admin(room_id) do
    GameState.get_room_admin(room_id)
  end

  @doc """
  Set the admin of a room.

  ## Parameters
    - `room_id`: The ID of the room to set the admin for.
    - `admin_id`: The ID of the user to set as the admin.

  ## Examples
      iex> ScribblBackend.GameHelper.set_room_admin("room_1", "user_456")
      {:ok, "OK"}
  """
  def set_room_admin(room_id, admin_id) do
    GameState.set_room_admin(room_id, admin_id)
  end

  @doc """
  Reset the game state for a room.

  ## Parameters
    - `room_id`: The ID of the room to reset.
    - `opts`: Optional parameters for room reset.
  """
  def reset_game_state(room_id, opts \\ []) do
    GameState.reset_game_state(room_id, opts)
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
    PlayerManager.add_player(room_id, player_id)
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
    PlayerManager.get_players(room_id)
  end

  @doc """
  Get scores for all players in a room.

  ## Parameters
    - `room_id`: The ID of the room to get scores from.

  ## Returns
    A map of player IDs to their scores.
  """
  def get_all_player_scores(room_id) do
    PlayerManager.get_all_player_scores(room_id)
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
    PlayerManager.remove_player(room_id, player_id)
  end

  @doc """
  Start the game in a room.

  ## Parameters
    - `room_id`: The ID of the room to start the game in.
  """
  def start(room_id) do
    GameFlow.start(room_id)
  end

  @doc """
  Generate random words for the drawing round.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    A list of 3 random words.
  """
  def generate_word(room_id \\ nil) do
    WordManager.generate_words(room_id)
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
    WordManager.start_turn(room_id, word)
  end

  @doc """
  Save canvas data for a room.

  ## Parameters
    - `room_id`: The ID of the room
    - `canvas_data`: The canvas data to save
  """
  def save_canvas(room_id, canvas_data) do
    CanvasManager.save_canvas(room_id, canvas_data)
  end

  @doc """
  Get canvas data for a room.

  ## Parameters
    - `room_id`: The ID of the room

  ## Returns
    The canvas array if it exists, nil otherwise
  """
  def get_canvas(room_id) do
    CanvasManager.get_canvas(room_id)
  end

  @doc """
  Clear the canvas for a room.

  ## Parameters
    - `room_id`: The ID of the room
  """
  def clear_canvas(room_id) do
    CanvasManager.clear_canvas(room_id)
  end

  @doc """
  Get the current drawer for a room.

  ## Parameters
    - `room_id`: The ID of the room to get the current drawer from.
  """
  def get_current_drawer(room_id) do
    GameState.get_current_drawer(room_id)
  end

  @doc """
  Handle a player's guess.

  ## Parameters
    - `message`: The message containing the guess.
    - `socket`: The socket representing the connection.
  """
  def handle_guess(message, socket) do
    GameFlow.handle_guess(message, socket)
  end

  @doc """
  Start a timer for letter reveal.

  ## Parameters
    - `room_id`: The ID of the room.
  """
  def start_reveal_timer(room_id) do
    WordManager.start_reveal_timer(room_id)
  end

  @doc """
  Reveal the next letter of the word.

  ## Parameters
    - `room_id`: The ID of the room.

  ## Returns
    The partially revealed word.
  """
  def reveal_next_letter(room_id) do
    WordManager.reveal_next_letter(room_id)
  end

  @doc """
  Clean up a room's state. Removes all Redis keys associated with the room.

  ## Parameters
    - `room_id`: The ID of the room to clean up.
  """
  def cleanup_room(room_id) do
    GameState.cleanup_room(room_id)
  end

  @doc """
  Check if a room is empty and clean up if needed.

  ## Parameters
    - `room_id`: The ID of the room to check.
  """
  def check_and_cleanup_empty_room(room_id) do
    GameState.check_and_cleanup_empty_room(room_id)
  end

  @doc """
  Update the settings of an existing room.
  Only works if the room is in the "waiting" status.

  ## Parameters
    - `room_id`: The ID of the room to update.
    - `settings`: A map containing the settings to update.

  ## Options in settings map
    - `:max_rounds`: The maximum number of rounds in the game.
    - `:max_players`: The maximum number of players allowed in the room.
    - `:turn_time`: The time in seconds for each drawing turn.
    - `:hints_allowed`: Whether hints (letter reveals) are allowed.

  ## Examples
      iex> ScribblBackend.GameHelper.update_room_settings("room_1", %{max_rounds: 5})
      {:ok, %{max_rounds: "5", current_round: "0", status: "waiting", current_drawer: ""}}
  """
  def update_room_settings(room_id, settings) do
    GameState.update_room_settings(room_id, settings)
  end
end
