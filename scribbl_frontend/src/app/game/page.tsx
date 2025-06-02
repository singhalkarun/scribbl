"use client";

import { usePlayerStore } from "@/store/usePlayerStore";
import { useEffect, useState, useMemo, useRef } from "react";
import Canvas from "@/components/Canvas";
import Chat from "@/components/Chat";
import GameOverModal from "@/components/GameOverModal";
import { useRouter } from "next/navigation";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { useSoundEffects } from "@/utils/useSoundEffects";

export default function GamePage() {
  const {
    playerName,
    roomId,
    players,
    userId,
    _hasHydrated,
    scores,
    updateScore,
  } = usePlayerStore();

  const { connectionState, sendMessage } = useRoomChannel();
  // Use a very low volume (0.1 = 10%) for sound effects
  const { playSound } = useSoundEffects(0.1);

  const [guessed, setGuessed] = useState(false);
  const [roomStatus, setRoomStatus] = useState("waiting");
  const [gameInfo, setGameInfo] = useState({
    maxRounds: "3",
    currentDrawer: "",
    currentRound: "0",
  });
  const [wordToDraw, setWordToDraw] = useState("");
  const [wordLength, setWordLength] = useState(0);
  const [showWordSelection, setShowWordSelection] = useState(false);
  const [suggestedWords, setSuggestedWords] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [revealedLetters, setRevealedLetters] = useState<string[]>([]);
  // New states for turn over modal
  const [showTurnOverModal, setShowTurnOverModal] = useState(false);
  const [turnOverWord, setTurnOverWord] = useState("");
  const [turnOverCountdown, setTurnOverCountdown] = useState(3);
  const [turnOverReason, setTurnOverReason] = useState(""); // Add reason state
  const [currentTurnDrawer, setCurrentTurnDrawer] = useState(""); // Track the current turn's drawer

  // Game over modal states
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [finalScores, setFinalScores] = useState<{ [key: string]: number }>({});
  const [finalPlayers, setFinalPlayers] = useState<{ [key: string]: string }>(
    {}
  );

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

  // Clean up timers when component unmounts completely
  useEffect(() => {
    // This will only run when the component is unmounted completely
    return () => {
      console.log(
        "[GamePage] Component unmounting completely, clearing all timers"
      );
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, []);

  // Check if current user is the drawer
  const isCurrentUserDrawing = useMemo(() => {
    const isDrawer = gameInfo.currentDrawer === userId;
    console.log("[GamePage] Drawer check:", {
      currentDrawer: gameInfo.currentDrawer,
      userId,
      isDrawer,
    });
    return isDrawer;
  }, [gameInfo.currentDrawer, userId]);

  // Redirect if player info is missing *after* hydration
  useEffect(() => {
    // Wait for hydration to finish before checking
    if (!_hasHydrated) {
      console.log("[GamePage] Waiting for store hydration...");
      return;
    }

    // Now that store is hydrated, check if we have needed info
    if (!playerName || !roomId) {
      console.log(
        "[GamePage] Redirecting: No player name or room ID found after hydration."
      );
      router.replace("/join");
    }
    // Add _hasHydrated to dependencies
  }, [playerName, roomId, router, _hasHydrated]);

  // Select the players object
  const playersList = useMemo(() => Object.values(players), [players]);

  // Debug log for suggestedWord changes
  useEffect(() => {
    console.log("[GamePage] suggestedWords changed:", suggestedWords);
  }, [suggestedWords]);

  // Handle socket events for room info
  useEffect(() => {
    if (connectionState === "joined" && roomId) {
      // Listen for room_info events
      const channel = usePlayerStore.getState().channel;
      if (channel) {
        const roomInfoRef = channel.on("room_info", (payload) => {
          console.log("[GamePage] Received room_info:", payload);
          setRoomStatus(payload.status);
          setGameInfo({
            maxRounds: payload.max_rounds,
            currentDrawer: payload.current_drawer,
            currentRound: payload.current_round,
          });
        });

        // Listen for game_started event
        const gameStartedRef = channel.on("game_started", (payload) => {
          console.log("[GamePage] Received game_started:", payload);
          setRoomStatus(payload.status);
          setGameInfo((prev) => ({
            ...prev,
            currentRound: payload.current_round,
          }));
          // Play new round sound when a game starts
          playSound("newRound");
        });

        // Listen for drawer_assigned event
        const drawerAssignedRef = channel.on("drawer_assigned", (payload) => {
          console.log("[GamePage] Received drawer_assigned:", payload);
          setGameInfo((prev) => ({
            ...prev,
            currentDrawer: payload.drawer,
            currentRound: payload.round,
          }));
          setCurrentTurnDrawer(payload.drawer); // Store the drawer for this turn
        });

        // Listen for select_word event (only sent to the drawer)
        const selectWordRef = channel.on("select_word", (payload) => {
          console.log("[GamePage] Received select_word:", payload);
          // Set the array of suggested words
          setSuggestedWords(payload.words);
          console.log("[GamePage] Set suggestedWords to:", payload.words);
          setShowWordSelection(true);
        });

        // Listen for letter_reveal event
        const letterRevealRef = channel.on("letter_reveal", (payload) => {
          console.log("[GamePage] Received letter_reveal:", payload);
          if (payload.revealed_word) {
            setRevealedLetters(payload.revealed_word);
            // Play letter reveal sound effect
            playSound("letterReveal");
          }
        });

        // Listen for turn_started event
        const turnStartedRef = channel.on("turn_started", (payload) => {
          console.log("[GamePage] Received turn_started:", payload);

          // Set the word length for displaying blanks
          const wordLengthValue =
            typeof payload.word_length === "string"
              ? parseInt(payload.word_length)
              : payload.word_length;
          console.log(
            `[GamePage] Setting word length - raw: ${payload.word_length}, parsed: ${wordLengthValue}`
          );
          setWordLength(wordLengthValue);

          // Make sure room status is set to "started"
          setRoomStatus("started");

          // Reset revealed letters for new turn
          setRevealedLetters([]);

          // If the word selection overlay is showing, hide it
          if (showWordSelection) {
            setShowWordSelection(false);
          }

          // Ensure we have the correct drawer for this turn
          if (gameInfo.currentDrawer) {
            setCurrentTurnDrawer(gameInfo.currentDrawer);
          }

          // Check if the current user is not already in the game state of having guessed correctly
          // Only reset guessed state if this is a new turn starting (not a rejoin)
          if (!payload.time_remaining) {
            setGuessed(false);
          }

          // Check if time_remaining exists in the payload (for rejoining players)
          // If it does, use that value; otherwise, start with the default 60 seconds
          const initialTimeLeft = payload.time_remaining
            ? parseInt(payload.time_remaining)
            : 60;
          console.log(
            `[GamePage] Setting timer - time_remaining: ${payload.time_remaining}, initialTimeLeft: ${initialTimeLeft}`
          );

          // If timer is already running and this is just a rejoin (payload.time_remaining exists),
          // we don't need to reset the timer if the times are close
          const shouldResetTimer =
            !timerRef.current ||
            !payload.time_remaining ||
            Math.abs(timeLeft - initialTimeLeft) > 2; // Only reset if difference > 2 seconds

          if (shouldResetTimer) {
            console.log(
              `[GamePage] Resetting timer to ${initialTimeLeft} seconds`
            );
            // Clear any existing timer
            if (timerRef.current) {
              clearInterval(timerRef.current);
            }

            setTimeLeft(initialTimeLeft);

            // Set up the new timer
            timerRef.current = setInterval(() => {
              setTimeLeft((prevTime) => {
                if (prevTime <= 1) {
                  // If timer reaches 0, clear the interval
                  if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                  }
                  return 0;
                }
                return prevTime - 1;
              });
            }, 1000);

            // Only play sound if this is a new turn, not a rejoin
            if (!payload.time_remaining) {
              playSound("newRound");
            }
          } else {
            console.log(
              `[GamePage] Not resetting timer, continuing with current timer: ${timeLeft} seconds`
            );
          }
        });

        // Listen for turn_over event
        const turnOverRef = channel.on("turn_over", (payload) => {
          console.log("[GamePage] Received turn_over:", payload);
          // Clear the timer if it's still running
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // Determine who should see the modal based on the reason
          let shouldShowModal = false;

          if (payload.reason === "all_guessed") {
            // Celebratory message - show to everyone except the drawer
            shouldShowModal = currentTurnDrawer !== userId && payload.word;
          } else if (payload.reason === "timeout") {
            // Time's up - only show to players who didn't guess correctly and weren't the drawer
            shouldShowModal =
              currentTurnDrawer !== userId && !guessed && payload.word;
          } else if (payload.reason === "drawer_left") {
            // Drawer left - show to everyone except the drawer who left
            shouldShowModal = currentTurnDrawer !== userId && payload.word;
          } else {
            // Default behavior for other reasons - show to players who didn't guess
            shouldShowModal =
              currentTurnDrawer !== userId && !guessed && payload.word;
          }

          // Show turn over modal with answer based on the conditions above
          if (shouldShowModal) {
            setTurnOverWord(payload.word);
            setTurnOverReason(payload.reason || ""); // Capture the reason
            setShowTurnOverModal(true);
            setTurnOverCountdown(3);

            // Play a sound for turn over reveal
            playSound("correctGuess");

            // Start countdown timer
            if (countdownTimerRef.current) {
              clearInterval(countdownTimerRef.current);
            }

            countdownTimerRef.current = setInterval(() => {
              setTurnOverCountdown((prev) => {
                if (prev <= 1) {
                  // If countdown reaches 0, clear the interval and hide modal
                  if (countdownTimerRef.current) {
                    clearInterval(countdownTimerRef.current);
                    countdownTimerRef.current = null;
                  }
                  setShowTurnOverModal(false);
                  return 3; // Reset for next time
                }
                return prev - 1;
              });
            }, 1000);
          }

          // Reset states for the next turn
          setTimeLeft(0);
          setWordToDraw("");
          setWordLength(0);
          setRevealedLetters([]);
        });

        // Listen for game_over event
        const gameOverRef = channel.on("game_over", (payload) => {
          console.log("[GamePage] Received game_over:", payload);

          // Clear any running timer
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // Play game over sound
          playSound("gameOver");

          // Get current state directly from store
          const currentState = usePlayerStore.getState();

          // Preserve final scores and players data
          setFinalScores(currentState.scores);
          setFinalPlayers(currentState.players);

          // Show game over modal
          setShowGameOverModal(true);

          // Reset the game state to show the Start Game button again
          setRoomStatus("waiting");
          setGameInfo((prev) => ({
            ...prev,
            currentDrawer: "",
            currentRound: "0",
          }));
          setTimeLeft(0);
          setWordToDraw("");
          setWordLength(0);
          setGuessed(false);
        });

        // Listen for score_updated event
        const scoreUpdatedRef = channel.on("score_updated", (payload) => {
          console.log("[GamePage] Received score_updated:", payload);
          updateScore(payload.user_id, payload.score);
        });

        // Listen for correct_guess event
        const correctGuessRef = channel.on("correct_guess", (payload) => {
          console.log("[GamePage] Received correct_guess:", payload);
          const guesserName = players[payload.user_id] || "Someone";

          // Play correct guess sound for all correct guesses
          playSound("correctGuess");

          // Add a system message about the correct guess
          usePlayerStore.getState().addMessage({
            userId: "system",
            text: `${guesserName} guessed correctly! 🎉`,
            system: true,
          });
        });

        // Cleanup listeners
        return () => {
          if (channel) {
            channel.off("room_info", roomInfoRef);
            channel.off("game_started", gameStartedRef);
            channel.off("drawer_assigned", drawerAssignedRef);
            channel.off("select_word", selectWordRef);
            channel.off("turn_started", turnStartedRef);
            channel.off("turn_over", turnOverRef);
            channel.off("game_over", gameOverRef);
            channel.off("score_updated", scoreUpdatedRef);
            channel.off("correct_guess", correctGuessRef);
            channel.off("letter_reveal", letterRevealRef);

            // Don't clear timers on normal cleanup
            // Only clear timers when specific events trigger it
            // like turn_over or game_over
          }
        };
      }
    }
  }, [connectionState, roomId, players, updateScore]);

  // Handle start game button click
  const handleStartGame = () => {
    const channel = usePlayerStore.getState().channel;
    if (channel) {
      console.log("[GamePage] Sending start_game event");
      channel.push("start_game", {});
    }
  };

  // Handle start new game from game over modal
  const handleStartNewGame = () => {
    setShowGameOverModal(false);
    handleStartGame();
  };

  // Function to generate shareable URL with roomId parameter
  const getShareableLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join?roomId=${roomId}`;
  };

  // Display loading/error based on hook state OR if not hydrated
  if (
    !_hasHydrated ||
    connectionState === "connecting" ||
    connectionState === "idle"
  ) {
    return (
      <div className="flex justify-center items-center h-screen">
        Connecting to room {roomId}...
      </div>
    );
  }

  if (connectionState === "error") {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <p className="text-red-500">Failed to connect to room {roomId}.</p>
        <button
          onClick={() => router.push("/join")}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Return to Join Page
        </button>
      </div>
    );
  }
  // Only render game page content if joined
  if (connectionState !== "joined") {
    // Should not happen if checks above are exhaustive, but good fallback
    return (
      <div className="flex justify-center items-center h-screen">
        Unexpected connection state: {connectionState}
      </div>
    );
  }

  return (
    <main className="h-[100svh] w-screen flex flex-col md:flex-row bg-gradient-to-br from-purple-50 via-white to-blue-100 overflow-hidden p-0">
      {/* Game Over Modal */}
      <GameOverModal
        isOpen={showGameOverModal}
        onStartNewGame={handleStartNewGame}
        scores={finalScores}
        players={finalPlayers}
        currentUserId={userId}
        minPlayersRequired={2}
      />

      {/* Turn Over Modal */}
      {showTurnOverModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-xl p-6 shadow-2xl text-center max-w-md w-full mx-4">
            {/* Dynamic title and emoji based on reason */}
            {turnOverReason === "all_guessed" ? (
              <>
                <div className="text-4xl mb-2">🎉</div>
                <h2 className="text-2xl font-bold text-green-600 mb-4">
                  Everyone Guessed!
                </h2>
                <p className="text-gray-600 mb-6">
                  Amazing! All players figured out the word:{" "}
                  <span className="font-bold text-indigo-600 text-xl">
                    {turnOverWord}
                  </span>
                </p>
              </>
            ) : turnOverReason === "timeout" ? (
              <>
                <div className="text-4xl mb-2">⏰</div>
                <h2 className="text-2xl font-bold text-orange-600 mb-4">
                  Time's Up!
                </h2>
                <p className="text-gray-600 mb-6">
                  The time ran out! The word was:{" "}
                  <span className="font-bold text-indigo-600 text-xl">
                    {turnOverWord}
                  </span>
                </p>
              </>
            ) : turnOverReason === "drawer_left" ? (
              <>
                <div className="text-4xl mb-2">🚪</div>
                <h2 className="text-2xl font-bold text-red-600 mb-4">
                  Drawer Left!
                </h2>
                <p className="text-gray-600 mb-6">
                  The drawer left the game. The word was:{" "}
                  <span className="font-bold text-indigo-600 text-xl">
                    {turnOverWord}
                  </span>
                </p>
              </>
            ) : (
              <>
                <div className="text-4xl mb-2">🔄</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  Turn Over!
                </h2>
                <p className="text-gray-600 mb-6">
                  The word was:{" "}
                  <span className="font-bold text-indigo-600 text-xl">
                    {turnOverWord}
                  </span>
                </p>
              </>
            )}

            <p className="text-gray-700 mb-2">Next turn starting in:</p>
            <div className="text-4xl font-bold text-indigo-600 mb-6">
              {turnOverCountdown}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500"
                style={{
                  width: `${(turnOverCountdown / 3) * 100}%`,
                  transition: "width 1s linear",
                }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Word Selection Overlay */}
      {showWordSelection && isCurrentUserDrawing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-2xl text-center max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Select Word to Draw
            </h2>
            <p className="text-gray-600 mb-6">
              Click on a word to start your turn
            </p>

            <div className="space-y-3">
              {suggestedWords.map((word, index) => (
                <button
                  key={index}
                  onClick={() => {
                    const channel = usePlayerStore.getState().channel;
                    if (channel) {
                      console.log(
                        "[GamePage] Sending start_turn event with word:",
                        word
                      );
                      channel.push("start_turn", { word });
                      // Set the word to draw for the drawer only
                      setWordToDraw(word);
                      setShowWordSelection(false);
                    }
                  }}
                  className="text-xl py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white w-full rounded-lg font-semibold transition-colors hover:cursor-pointer"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Canvas area - Fixed height on mobile, grows on md+ */}
      <div className="px-1 h-[45vh] md:h-auto md:flex-1 md:p-4">
        <div className="w-full h-full bg-white rounded-xl md:shadow-lg flex flex-col overflow-hidden">
          <Canvas
            isDrawer={isCurrentUserDrawing}
            gameStarted={roomStatus === "started"}
          />
        </div>
      </div>

      {/* Sidebar Area - Takes remaining space on mobile, fixed width on md+ */}
      <aside className="flex-1 flex flex-col gap-2 p-1 min-h-0 md:w-80 lg:w-96 md:flex-none md:p-4 md:h-screen md:border-l md:border-gray-200 md:bg-transparent">
        {/* Players & Chat Container - Row on mobile, Col on md+ */}
        {/* Takes most of the space in aside, leaving room for Word Hint */}
        <div className="flex-1 flex flex-row gap-2 min-h-0 md:flex-col md:gap-4">
          {/* Players - Takes half width on mobile */}
          <div className="w-1/2 bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex flex-col md:w-auto min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-lg text-gray-700 flex-shrink-0">
                Players
              </h2>
              {/* <button
                onClick={() => {
                  navigator.clipboard.writeText(getShareableLink());
                }}
                className="text-gray-500 transition-colors relative group cursor-pointer"
              >
                <p className="text-sm">
                  Room ID:{" "}
                  <span className="text-sm text-indigo-600 font-mono">
                    {roomId}
                  </span>
                </p>
                <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                  Click to copy invite link
                </span>
              </button> */}
            </div>
            <ul className="text-sm text-gray-600 space-y-1.5 overflow-y-auto pr-1 flex-1">
              {playersList.length > 0 ? (
                playersList.map((name, index) => {
                  const playerId = Object.entries(players).find(
                    ([_, n]) => n === name
                  )?.[0];
                  const score = playerId ? scores[playerId] || 0 : 0;
                  return (
                    <li
                      key={index}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg flex-shrink-0">👤</span>
                        <span className="truncate">
                          {name === playerName ? <b>{name} (You)</b> : name}
                        </span>
                      </div>
                      <span className="font-medium text-indigo-600 flex-shrink-0">
                        {score} pts
                      </span>
                    </li>
                  );
                })
              ) : (
                <li className="text-gray-500 italic">No players yet...</li>
              )}
            </ul>
          </div>

          {/* Chat - Takes half width on mobile */}
          <div className="w-1/2 flex flex-col overflow-hidden border border-gray-200 rounded-lg shadow-sm min-h-0 md:w-auto md:flex-1">
            <Chat
              wordToGuess={isCurrentUserDrawing ? "" : wordToDraw}
              onCorrectGuess={() => setGuessed(true)}
              playerName={playerName}
              sendMessage={sendMessage}
              isDrawer={isCurrentUserDrawing}
            />
          </div>
        </div>

        {/* Conditionally render Word hint or Start Game button */}
        {roomStatus === "waiting" ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm py-3 md:p-3 text-center flex-shrink-0">
            {gameInfo.currentDrawer ? (
              <div className="mb-3">
                <h3 className="text-xl font-bold text-indigo-600 mb-1">
                  Game in Progress
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  Round {gameInfo.currentRound} of {gameInfo.maxRounds}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  {players[gameInfo.currentDrawer] || "Someone"} is drawing
                </p>
                <div className="w-full h-1 bg-indigo-100 rounded mb-4">
                  <div
                    className="h-full bg-indigo-500 rounded animate-pulse"
                    style={{ width: "100%" }}
                  ></div>
                </div>
              </div>
            ) : null}

            {/* Room ID with Copy Button */}
            <div className="mb-4">
              <button
                onClick={() => {
                  const url = getShareableLink();
                  // Try the clipboard API first
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard
                      .writeText(url)
                      .then(() => {
                        const btn = document.getElementById("copy-btn-text");
                        if (btn) {
                          const originalText = btn.innerText;
                          btn.innerText = "Copied! 👍";
                          setTimeout(() => {
                            btn.innerText = originalText;
                          }, 2000);
                        }
                      })
                      .catch((err) => {
                        // If clipboard API fails, try fallback method
                        fallbackCopyTextToClipboard(url);
                      });
                  } else {
                    // Fallback for browsers that don't support clipboard API
                    fallbackCopyTextToClipboard(url);
                  }

                  // Fallback copy method using textarea
                  function fallbackCopyTextToClipboard(text: string) {
                    const textArea = document.createElement("textarea");
                    textArea.value = text;

                    // Make the textarea out of viewport
                    textArea.style.position = "fixed";
                    textArea.style.left = "-999999px";
                    textArea.style.top = "-999999px";
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();

                    let success = false;
                    try {
                      success = document.execCommand("copy");
                    } catch (err) {
                      console.error("Fallback: Unable to copy", err);
                    }

                    document.body.removeChild(textArea);

                    // Show feedback
                    const btn = document.getElementById("copy-btn-text");
                    if (btn) {
                      const originalText = btn.innerText;
                      btn.innerText = success ? "Copied! 👍" : "Copy failed ❌";
                      setTimeout(() => {
                        btn.innerText = originalText;
                      }, 2000);
                    }
                  }
                }}
                id="copy-btn"
                className="w-[95%] mx-auto md:w-full relative py-2 px-4 bg-indigo-100 hover:bg-indigo-200 rounded-md font-medium text-indigo-700 transition-colors text-center hover:cursor-pointer"
              >
                <div id="copy-btn-text" className="pr-6">
                  Invite Friends: {roomId}
                </div>
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  🔗
                </div>
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Click to copy invite link
              </p>
            </div>

            <button
              className={`w-[95%] py-2 px-4 rounded-md font-semibold text-white hover:cursor-pointer md:w-full ${
                playersList.length >= 2 && !gameInfo.currentDrawer
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
              disabled={playersList.length < 2 || !!gameInfo.currentDrawer}
              onClick={handleStartGame}
            >
              Start Game
            </button>
            <p className="text-xs text-gray-500 mt-2">
              {playersList.length < 2
                ? "Need at least 2 players to start"
                : gameInfo.currentDrawer
                ? "Waiting for current game to finish..."
                : "Click to start the game!"}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm py-1 md:p-3 text-center flex-shrink-0">
            {/* Game info header - shows round and drawer */}
            <div className="mb-2 pb-2 border-b border-gray-100 text-sm text-gray-600">
              <div className="flex justify-between items-center">
                <span>Round {gameInfo.currentRound}</span>
                <span className="font-medium">
                  {gameInfo.currentDrawer && players[gameInfo.currentDrawer]
                    ? `${players[gameInfo.currentDrawer]}${
                        players[gameInfo.currentDrawer] === playerName
                          ? " (You)"
                          : ""
                      } is drawing`
                    : "Waiting for drawer..."}
                </span>
              </div>
            </div>

            {/* Timer - only show when time is running */}
            {timeLeft > 0 && (
              <div className="mb-3">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      timeLeft <= 10 ? "bg-red-500" : "bg-green-500"
                    }`}
                    style={{
                      width: `${(timeLeft / 60) * 100}%`,
                      transition: "width 1s linear",
                    }}
                  ></div>
                </div>
                <div className="text-sm mt-1 font-medium">
                  {timeLeft} seconds left
                </div>
              </div>
            )}

            <p className="text-xl md:text-2xl font-mono tracking-widest text-indigo-600">
              {isCurrentUserDrawing
                ? wordToDraw
                : guessed
                ? wordToDraw.split("").join(" ")
                : revealedLetters.length > 0
                ? revealedLetters
                    .map((letter, index) => letter || "_")
                    .join(" ")
                : wordLength > 0
                ? Array(wordLength).fill("_").join(" ")
                : ""}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {isCurrentUserDrawing ? "Draw this word!" : "Guess the word!"}
            </p>
          </div>
        )}
      </aside>
    </main>
  );
}
