defmodule ScribblBackend.WordSimilarity do
  @doc """
  Check if two words are similar using various similarity metrics.

  ## Parameters
    - `guess`: The guessed word
    - `target`: The target word

  ## Returns
    - `true` if words are similar enough, `false` otherwise
  """
  def similar?(guess, target) do
    guess_clean = String.downcase(String.trim(guess))
    target_clean = String.downcase(String.trim(target))

    # Skip similarity check if exact match or if guess is too short
    if guess_clean == target_clean or String.length(guess_clean) < 3 do
      false
    else
      # Only consider words similar if they're really close
      # Require both words to be at least 3 characters and not too different in length
      guess_len = String.length(guess_clean)
      target_len = String.length(target_clean)

      # Skip if length difference is too big (more than 2 characters difference)
      if abs(guess_len - target_len) > 2 do
        false
      else
        # Only use Levenshtein distance for very close matches
        levenshtein_similar?(guess_clean, target_clean)
      end
    end
  end

  # Check if Levenshtein distance is very small (only 1 character difference)
  defp levenshtein_similar?(guess, target) do
    distance = levenshtein_distance(guess, target)

    # Only allow 1 character difference - very strict similarity
    distance == 1
  end



  # Calculate Levenshtein distance between two strings
  defp levenshtein_distance(s1, s2) do
    s1_list = String.graphemes(s1)
    s2_list = String.graphemes(s2)
    s1_length = length(s1_list)
    s2_length = length(s2_list)

    # Create matrix
    matrix = for i <- 0..s1_length, into: %{} do
      {i, %{0 => i}}
    end

    matrix = for j <- 1..s2_length, reduce: matrix do
      acc -> put_in(acc, [0, j], j)
    end

    # Fill matrix
    matrix = for i <- 1..s1_length, j <- 1..s2_length, reduce: matrix do
      acc ->
        char1 = Enum.at(s1_list, i - 1)
        char2 = Enum.at(s2_list, j - 1)

        cost = if char1 == char2, do: 0, else: 1

        min_val = min(
          get_in(acc, [i - 1, j]) + 1,      # deletion
          min(
            get_in(acc, [i, j - 1]) + 1,    # insertion
            get_in(acc, [i - 1, j - 1]) + cost  # substitution
          )
        )

        put_in(acc, [i, j], min_val)
    end

    get_in(matrix, [s1_length, s2_length])
  end
end
