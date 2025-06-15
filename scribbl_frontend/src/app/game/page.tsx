"use client";

import { usePlayerStore } from "@/store/usePlayerStore";
import { useEffect, useState, useMemo, useRef } from "react";
import Canvas from "@/components/Canvas";
import Chat from "@/components/Chat";
import VoiceChat from "@/components/VoiceChat";
import GameOverModal from "@/components/GameOverModal";
import { useRouter } from "next/navigation";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { useSoundEffects } from "@/utils/useSoundEffects";
import KickPlayerModal from "@/components/KickPlayerModal";
import KickedModal from "@/components/KickedModal";

export default function GamePage() {
  const {
    playerName,
    roomId,
    players,
    userId,
    adminId,
    setAdminId,
    _hasHydrated,
    scores,
    updateScore,
  } = usePlayerStore();

  const { connectionState, sendMessage, voteToKick } = useRoomChannel();
  // Use a very low volume (0.1 = 10%) for sound effects
  const { playSound } = useSoundEffects(0.1);

  const [guessed, setGuessed] = useState(false);
  const [roomStatus, setRoomStatus] = useState("waiting");
  const [gameInfo, setGameInfo] = useState({
    maxRounds: "3",
    currentDrawer: "",
    currentRound: "0",
  });
  // Room settings state
  const [roomSettings, setRoomSettings] = useState({
    maxPlayers: "8",
    maxRounds: "3",
    turnTime: "60",
    hintsAllowed: "true",
    difficulty: "medium",
    roomType: "public",
  });

  // Settings update feedback state
  const [settingsUpdateStatus, setSettingsUpdateStatus] = useState<
    "idle" | "updating" | "success"
  >("idle");

  const [wordToDraw, setWordToDraw] = useState("");
  const [wordLength, setWordLength] = useState(0);
  const [showWordSelection, setShowWordSelection] = useState(false);
  const [suggestedWords, setSuggestedWords] = useState<string[]>([]);
  const [wordSelectionCountdown, setWordSelectionCountdown] = useState(10);
  const [hasSkippedWords, setHasSkippedWords] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameJustEnded, setGameJustEnded] = useState(false);
  const [revealedLetters, setRevealedLetters] = useState<string[]>([]);
  const [specialChars, setSpecialChars] = useState<{index: number, char: string}[]>([]);
  // New states for turn over modal
  const [showTurnOverModal, setShowTurnOverModal] = useState(false);
  const [turnOverWord, setTurnOverWord] = useState("");
  const [turnOverCountdown, setTurnOverCountdown] = useState(3);
  const [turnOverReason, setTurnOverReason] = useState("");
  const [currentTurnDrawer, setCurrentTurnDrawer] = useState(""); // Track the current turn's drawer
  // Game over modal states
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [finalScores, setFinalScores] = useState<{ [key: string]: number }>({});
  const [finalPlayers, setFinalPlayers] = useState<{ [key: string]: string }>(
    {}
  );
  // New state for view-only settings modal
  const [showViewOnlySettings, setShowViewOnlySettings] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wordSelectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add kick player state
  const [showKickPlayerModal, setShowKickPlayerModal] = useState(false);
  const playerKicked = usePlayerStore((state) => state.playerKicked);

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
      if (wordSelectionTimerRef.current) {
        clearInterval(wordSelectionTimerRef.current);
        wordSelectionTimerRef.current = null;
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

  // Check if current user is the admin
  const isCurrentUserAdmin = useMemo(() => {
    const isAdmin = adminId === userId && adminId !== "";
    console.log("[GamePage] Admin check:", {
      adminId,
      userId,
      isAdmin,
    });
    return isAdmin;
  }, [adminId, userId]);

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
          console.log(
            "[GamePage] room_type from room_info:",
            payload.room_type
          );
          setRoomStatus(payload.status);
          setGameInfo({
            maxRounds: payload.max_rounds,
            currentDrawer: payload.current_drawer,
            currentRound: payload.current_round,
          });
          // Store room settings from room_info
          const newRoomSettings = {
            maxPlayers: payload.max_players || "8",
            maxRounds: payload.max_rounds || "3",
            turnTime: payload.turn_time || "60",
            hintsAllowed: payload.hints_allowed || "true",
            difficulty: payload.difficulty || "medium",
            roomType: payload.room_type || "public",
          };
          console.log("[GamePage] Setting roomSettings to:", newRoomSettings);
          setRoomSettings(newRoomSettings);
          // Store the admin_id from room_info
          if (payload.admin_id) {
            setAdminId(payload.admin_id);
          }
        });

        // Listen for admin_changed events
        const adminChangedRef = channel.on("admin_changed", (payload) => {
          console.log("[GamePage] Received admin_changed:", payload);
          // Update the admin_id when admin changes
          if (payload.admin_id) {
            setAdminId(payload.admin_id);
          }
        });

        // Listen for room_settings_updated events
        const roomSettingsUpdatedRef = channel.on(
          "room_settings_updated",
          (payload) => {
            console.log("[GamePage] Received room_settings_updated:", payload);
            // Update room settings state
            setRoomSettings({
              maxPlayers: payload.max_players || "8",
              maxRounds: payload.max_rounds || "3",
              turnTime: payload.turn_time || "60",
              hintsAllowed: payload.hints_allowed || "true",
              difficulty: payload.difficulty || "medium",
              roomType: payload.room_type || "public",
            });
            // Update gameInfo maxRounds as well
            setGameInfo((prev) => ({
              ...prev,
              maxRounds: payload.max_rounds || "3",
            }));

            // Show success feedback
            setSettingsUpdateStatus("success");

            // Reset to idle after 2 seconds
            setTimeout(() => {
              setSettingsUpdateStatus("idle");
            }, 2000);
          }
        );

        // Listen for drawer_assigned event
        const drawerAssignedRef = channel.on("drawer_assigned", (payload) => {
          console.log("[GamePage] Received drawer_assigned:", payload);
          setGameInfo((prev) => ({
            ...prev,
            currentDrawer: payload.drawer,
            currentRound: payload.round,
          }));
          setCurrentTurnDrawer(payload.drawer); // Store the drawer for this turn
          
          // Reset hasSkippedWords when a new drawer is assigned
          setHasSkippedWords(false);

          // Always hide game over modal when a new drawer is assigned (new game/turn started)
          console.log("[GamePage] Hiding GameOverModal - new drawer assigned");
          setShowGameOverModal(false);
        });

        // Listen for select_word event (only sent to the drawer)
        const selectWordRef = channel.on("select_word", (payload) => {
          console.log("[GamePage] Received select_word:", payload);
          // Set the array of suggested words
          setSuggestedWords(payload.words);
          console.log("[GamePage] Set suggestedWords to:", payload.words);
          setShowWordSelection(true);
          
          // Start 10-second countdown for auto-selection
          setWordSelectionCountdown(10);
          if (wordSelectionTimerRef.current) {
            clearInterval(wordSelectionTimerRef.current);
          }
          
          wordSelectionTimerRef.current = setInterval(() => {
            setWordSelectionCountdown((prev) => {
              if (prev <= 1) {
                // Clear the timer when it reaches 0
                if (wordSelectionTimerRef.current) {
                  clearInterval(wordSelectionTimerRef.current);
                  wordSelectionTimerRef.current = null;
                }
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          // Reset hasSkippedWords when a new drawer is assigned
          // This is important for when a new player becomes the drawer
          if (payload.is_new_drawer) {
            setHasSkippedWords(false);
          }
        });

        // Listen for word_auto_selected event (only sent to the drawer when timeout occurs)
        const wordAutoSelectedRef = channel.on("word_auto_selected", (payload) => {
          console.log("[GamePage] Received word_auto_selected:", payload);
          
          // Clear the word selection timer
          if (wordSelectionTimerRef.current) {
            clearInterval(wordSelectionTimerRef.current);
            wordSelectionTimerRef.current = null;
          }
          
          // Set the word that was automatically selected
          setWordToDraw(payload.word);
          // Hide the word selection overlay if it's still showing
          setShowWordSelection(false);
          // Show a notification about the auto-selection
          usePlayerStore.getState().addMessage({
            userId: "system",
            text: payload.message || "Word auto-selected due to timeout!",
            system: true,
          });
        });

        // Listen for words_skipped event
        const wordsSkippedRef = channel.on("words_skipped", (payload) => {
          console.log("[GamePage] Received words_skipped:", payload);
          
          // Check if the current user is the drawer who skipped
          const isCurrentUserDrawer = payload.drawer === userId;
          
          // Get the player name from the drawer ID
          const drawerName = players[payload.drawer] || "The drawer";
          
          // Show a notification about the skipped words
          usePlayerStore.getState().addMessage({
            userId: "system",
            text: isCurrentUserDrawer ? 
              "You skipped to get new words." : 
              `${drawerName} skipped to get new words.`,
            system: true,
          });
          
          // Play a sound effect for skipping words
          playSound("letterReveal");
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

          // Set special characters if provided
          if (payload.special_chars) {
            setSpecialChars(payload.special_chars);
            console.log("[GamePage] Setting special chars:", payload.special_chars);
          } else {
            setSpecialChars([]);
          }

          // Make sure room status is set to "started"
          setRoomStatus("started");

          // Reset revealed letters for new turn
          setRevealedLetters([]);

          // If the word selection overlay is showing, hide it and clear the timer
          if (showWordSelection) {
            setShowWordSelection(false);
            if (wordSelectionTimerRef.current) {
              clearInterval(wordSelectionTimerRef.current);
              wordSelectionTimerRef.current = null;
            }
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
          // If it does, use that value; otherwise, use the room's turn time setting
          const initialTimeLeft = payload.time_remaining
            ? parseInt(payload.time_remaining)
            : parseInt(roomSettings.turnTime);
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

          // Show turn over modal to everyone when turn ends
          if (payload.word) {
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
          setSpecialChars([]);
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

        // Listen for similar_word event
        const similarWordRef = channel.on("similar_word", (payload) => {
          console.log("[GamePage] Received similar_word:", payload);
          const guesserName = players[payload.user_id] || "Someone";
          const isCurrentUser = payload.user_id === userId;

          // Add a system message about the similar guess
          const messageText = isCurrentUser 
            ? `You are close!" 🔥`
            : `${guesserName} is close!" 🔥`;

          usePlayerStore.getState().addMessage({
            userId: "system",
            text: messageText,
            system: true,
          });

          // Play a different sound for similar guesses
          playSound("letterReveal");
        });

        // Listen for like/dislike events
        const drawingLikedRef = channel.on("drawing_liked", (payload) => {
          console.log("[GamePage] Received drawing_liked:", payload);
          const isCurrentUser = payload.user_id === userId;
          const playerName = isCurrentUser ? "You" : (players[payload.user_id] || "Someone");
          usePlayerStore.getState().addMessage({
            userId: "system",
            text: `👍 ${playerName} liked the drawing!`,
            system: true,
          });
        });

        const drawingDislikedRef = channel.on("drawing_disliked", (payload) => {
          console.log("[GamePage] Received drawing_disliked:", payload);
          const isCurrentUser = payload.user_id === userId;
          const playerName = isCurrentUser ? "You" : (players[payload.user_id] || "Someone");
          usePlayerStore.getState().addMessage({
            userId: "system",
            text: `👎 ${playerName} disliked the drawing!`,
            system: true,
          });
        });

        // Cleanup listeners
        return () => {
          if (channel) {
            // Clean up all event listeners
            channel.off("room_info", roomInfoRef);
            channel.off("admin_changed", adminChangedRef);
            channel.off("room_settings_updated", roomSettingsUpdatedRef);
            channel.off("drawer_assigned", drawerAssignedRef);
            channel.off("select_word", selectWordRef);
            channel.off("letter_reveal", letterRevealRef);
            channel.off("turn_started", turnStartedRef);
            channel.off("turn_over", turnOverRef);
            channel.off("game_over", gameOverRef);
            channel.off("score_updated", scoreUpdatedRef);
            channel.off("correct_guess", correctGuessRef);
            channel.off("similar_word", similarWordRef);
            channel.off("drawing_liked", drawingLikedRef);
            channel.off("drawing_disliked", drawingDislikedRef);
            channel.off("word_auto_selected", wordAutoSelectedRef);
            channel.off("words_skipped", wordsSkippedRef);

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
      // Immediately set room status to 'started' to hide the settings panel
      setRoomStatus("started");
    }
  };

  // Handle room settings update
  const handleUpdateRoomSettings = (updatedSettings: typeof roomSettings) => {
    const channel = usePlayerStore.getState().channel;
    if (channel) {
      setSettingsUpdateStatus("updating");

      console.log(
        "[GamePage] Sending update_room_settings event",
        updatedSettings
      );
      const payload: any = {
        max_players: updatedSettings.maxPlayers,
        max_rounds: updatedSettings.maxRounds,
        turn_time: updatedSettings.turnTime,
        hints_allowed: updatedSettings.hintsAllowed,
        difficulty: updatedSettings.difficulty,
      };

      // Only include room_type if it's set
      if (updatedSettings.roomType) {
        payload.room_type = updatedSettings.roomType;
      }

      channel.push("update_room_settings", payload);
    }
  };

  // Handle close game over modal
  const handleCloseGameOverModal = () => {
    setShowGameOverModal(false);
  };

  // Function to generate shareable URL with roomId parameter
  const getShareableLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join?roomId=${roomId}`;
  };

  // Functions to handle like/dislike
  const handleLikeDrawing = () => {
    const channel = usePlayerStore.getState().channel;
    if (channel) {
      console.log("[GamePage] Sending like_drawing event");
      channel.push("like_drawing", {});
    }
  };

  const handleDislikeDrawing = () => {
    const channel = usePlayerStore.getState().channel;
    if (channel) {
      console.log("[GamePage] Sending dislike_drawing event");
      channel.push("dislike_drawing", {});
    }
  };

  // Add kick player functionality
  const handleVoteToKick = (playerId: string) => {
    if (voteToKick) {
      voteToKick(playerId)
        .then((resp: any) => {
          console.log("[GamePage] Vote to kick registered:", resp);
          if (resp.kicked) {
            setShowKickPlayerModal(false);
          }
        })
        .catch((error: any) => {
          console.error("[GamePage] Vote to kick failed:", error);
          // Show error toast or message
        });
    }
  };

  // If player is kicked, show the kicked modal, clear any active timers, and redirect to join page
  useEffect(() => {
    if (playerKicked) {
      // Clear any active timers to prevent memory leaks
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      if (wordSelectionTimerRef.current) {
        clearInterval(wordSelectionTimerRef.current);
        wordSelectionTimerRef.current = null;
      }
      
      // Force redirect to join page
      router.replace('/join');
    }
  }, [playerKicked, router]);

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

  // If player is kicked, show the kicked modal
  if (playerKicked) {
    return <KickedModal />;
  }

  return (
    <main className="h-[100svh] w-screen flex flex-col lg:flex-row bg-gradient-to-br from-violet-900 via-blue-900 to-indigo-900 overflow-hidden p-0">
      {/* Game Over Modal */}
      <GameOverModal
        isOpen={showGameOverModal}
        onClose={handleCloseGameOverModal}
        scores={finalScores}
        players={finalPlayers}
        currentUserId={userId}
      />
      {/* Turn Over Modal */}
      {showTurnOverModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[1000]">
          {/* Main glass container */}
          <div className="relative max-w-md w-full mx-4">
            {/* Glass backdrop with enhanced effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent backdrop-blur-2xl rounded-3xl border border-white/30 shadow-2xl"></div>

            {/* Inner highlight border */}
            <div className="absolute inset-[1px] bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl"></div>

            {/* Content container */}
            <div className="relative p-6 rounded-3xl text-center">
              {/* Dynamic title and emoji based on reason */}
              {turnOverReason === "all_guessed" ? (
                <>
                  <div className="text-4xl mb-2">🎉</div>
                  <h2 className="text-2xl font-bold text-green-400 mb-4 text-shadow-sm">
                    Everyone Guessed!
                  </h2>
                  <p className="text-white/80 mb-6">
                    Amazing! All players figured out the word:{" "}
                    <span className="font-bold text-cyan-300 text-xl text-shadow-sm">
                      {turnOverWord}
                    </span>
                  </p>
                </>
              ) : turnOverReason === "timeout" ? (
                <>
                  <div className="text-4xl mb-2">⏰</div>
                  <h2 className="text-2xl font-bold text-amber-400 mb-4 text-shadow-sm">
                    Time's Up!
                  </h2>
                  <p className="text-white/80 mb-6">
                    The time ran out! The word was:{" "}
                    <span className="font-bold text-cyan-300 text-xl text-shadow-sm">
                      {turnOverWord}
                    </span>
                  </p>
                </>
              ) : turnOverReason === "drawer_left" ? (
                <>
                  <div className="text-4xl mb-2">🚪</div>
                  <h2 className="text-2xl font-bold text-red-400 mb-4 text-shadow-sm">
                    Drawer Left!
                  </h2>
                  <p className="text-white/80 mb-6">
                    The drawer left the game. The word was:{" "}
                    <span className="font-bold text-cyan-300 text-xl text-shadow-sm">
                      {turnOverWord}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-2">🔄</div>
                  <h2 className="text-2xl font-bold text-blue-300 mb-4 text-shadow-sm">
                    Turn Over!
                  </h2>
                  <p className="text-white/80 mb-6">
                    The word was:{" "}
                    <span className="font-bold text-cyan-300 text-xl text-shadow-sm">
                      {turnOverWord}
                    </span>
                  </p>
                </>
              )}
              <p className="text-white/70 mb-2">Next turn starting in:</p>
              <div className="text-4xl font-bold text-cyan-300 mb-6 text-shadow-sm">
                {turnOverCountdown}
              </div>
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-md border border-white/30">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-400"
                  style={{
                    width: `${(turnOverCountdown / 3) * 100}%`,
                    transition: "width 1s linear",
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Word Selection Overlay */}
      {showWordSelection && isCurrentUserDrawing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50">
          {/* Main glass container */}
          <div className="relative max-w-md w-full mx-4">
            {/* Glass backdrop with enhanced effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent backdrop-blur-2xl rounded-3xl border border-white/30 shadow-2xl"></div>

            {/* Inner highlight border */}
            <div className="absolute inset-[1px] bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl"></div>

            {/* Content container */}
            <div className="relative p-6 rounded-3xl text-center">
              <h2 className="text-2xl font-bold text-white mb-4 text-shadow-sm">
                Select Word to Draw
              </h2>
              <p className="text-white/80 mb-4">
                Click on a word to start your turn
              </p>
              
              {/* Countdown Timer */}
              <div className="mb-6">
                <p className="text-white/70 text-sm mb-2">
                  Auto-selecting in: <span className={`font-bold ${wordSelectionCountdown <= 3 ? 'text-red-300' : 'text-cyan-300'}`}>
                    {wordSelectionCountdown}s
                  </span>
                </p>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-md border border-white/30">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear ${
                      wordSelectionCountdown <= 3 
                        ? 'bg-gradient-to-r from-red-400 to-red-500' 
                        : 'bg-gradient-to-r from-cyan-400 to-blue-400'
                    }`}
                    style={{
                      width: `${(wordSelectionCountdown / 10) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="space-y-3">
                {suggestedWords.map((word, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      // Clear the word selection timer since user made a choice
                      if (wordSelectionTimerRef.current) {
                        clearInterval(wordSelectionTimerRef.current);
                        wordSelectionTimerRef.current = null;
                      }
                      
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
                    className="text-xl py-3 px-6 bg-gradient-to-r from-blue-500/80 to-indigo-500/80 hover:from-blue-600/90 hover:to-indigo-600/90 backdrop-blur-md text-white w-full rounded-lg font-semibold transition-colors hover:cursor-pointer border border-white/20 shadow-lg"
                  >
                    {word}
                  </button>
                ))}
              </div>
              
              {/* Skip Words Button - Only show if user hasn't skipped yet */}
              {!hasSkippedWords && (
                <div className="mt-4">
                  <button
                    onClick={() => {
                      // Clear the word selection timer since user is skipping
                      if (wordSelectionTimerRef.current) {
                        clearInterval(wordSelectionTimerRef.current);
                        wordSelectionTimerRef.current = null;
                      }
                      
                      const channel = usePlayerStore.getState().channel;
                      if (channel) {
                        console.log("[GamePage] Sending skip_words event");
                        channel.push("skip_words", {});
                        setHasSkippedWords(true);
                        // Reset countdown when new words are requested
                        setWordSelectionCountdown(10);
                      }
                    }}
                    className="text-sm py-2 px-4 bg-gradient-to-r from-orange-500/80 to-amber-500/80 hover:from-orange-600/90 hover:to-amber-600/90 backdrop-blur-md text-white rounded-lg font-medium transition-colors hover:cursor-pointer border border-white/20 shadow-lg"
                  >
                    Don't know these words? Skip (1 time only)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Left Sidebar - Players and Voice Chat */}
      <aside className="flex flex-row lg:flex-col gap-2 p-1 lg:p-4 min-h-0 w-full h-[20vh] lg:w-72 xl:w-80 lg:flex-none lg:h-screen lg:border-r lg:border-white/20 lg:bg-transparent">
        {/* Merged Players and Voice Chat Section */}
        <div className="w-full lg:w-auto flex-shrink-0">
          <VoiceChat
            scores={scores}
            currentDrawerId={gameInfo.currentDrawer}
            currentPlayerName={playerName}
          />
        </div>
      </aside>

      {/* Canvas area - Fixed height on mobile, grows on lg+ */}
      <div className="px-1 h-[55vh] lg:h-auto lg:flex-1 lg:p-4 relative">
        <div className="relative w-full h-full flex flex-col overflow-hidden">
          {/* Glass backdrop for canvas container */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl"></div>

          {/* Canvas content */}
          <div className="relative flex flex-col h-full">
            <Canvas
              isDrawer={isCurrentUserDrawing}
              gameStarted={roomStatus === "started"}
              onShowSettings={() => setShowViewOnlySettings(true)}
              roomStatus={roomStatus}
              gameInfo={gameInfo}
              players={players}
              playerName={playerName}
              timeLeft={timeLeft}
              showWordSelection={showWordSelection}
              wordToDraw={wordToDraw}
              guessed={guessed}
              revealedLetters={revealedLetters}
              wordLength={wordLength}
              specialChars={specialChars}
              onLikeDrawing={handleLikeDrawing}
              onDislikeDrawing={handleDislikeDrawing}
            />
            

          </div>

          {/* Room Settings Overlay - Only show to admin when game hasn't started */}
          {roomStatus === "waiting" && isCurrentUserAdmin && (
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/90 via-blue-900/90 to-indigo-900/90 backdrop-blur-xl z-10 select-none sm:border sm:border-white/20 sm:rounded-xl lg:border-none lg:rounded-none shadow-2xl flex items-center justify-center">
              <div className="relative w-full h-full max-w-md lg:max-w-none mx-auto p-2 sm:p-3 lg:p-6 flex flex-col justify-center min-h-0">
                {/* Inner highlight border for depth */}
                <div className="absolute inset-[1px] border border-white/10 rounded-xl pointer-events-none hidden lg:block"></div>

                <div className="text-center mb-2 sm:mb-3">
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white text-shadow-sm">
                    Room Settings
                  </h2>
                </div>

                {/* Mobile-optimized form with plus/minus controls */}
                <div className="space-y-2 sm:space-y-3">
                  {/* Row 1: Max Players & Max Rounds */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {/* Max Players */}
                    <div>
                      <label className="block text-xs font-medium text-white/90 mb-1">
                        Max Players
                      </label>
                      <div className="flex items-center bg-white/10 rounded-lg border border-white/20 backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() => {
                            // Haptic feedback on mobile
                            if (navigator.vibrate) {
                              navigator.vibrate(30);
                            }
                            const currentPlayers = parseInt(
                              roomSettings.maxPlayers
                            );
                            const newPlayers = Math.max(2, currentPlayers - 1);
                            if (newPlayers !== currentPlayers) {
                              setRoomSettings((prev) => ({
                                ...prev,
                                maxPlayers: newPlayers.toString(),
                              }));
                            }
                          }}
                          className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-l-lg transition-all duration-150 hover:cursor-pointer active:scale-95 active:bg-white/20"
                        >
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 12H4"
                            />
                          </svg>
                        </button>
                        <span className="flex-1 text-center py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white">
                          {roomSettings.maxPlayers}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            // Haptic feedback on mobile
                            if (navigator.vibrate) {
                              navigator.vibrate(30);
                            }
                            const currentPlayers = parseInt(
                              roomSettings.maxPlayers
                            );
                            const newPlayers = Math.min(8, currentPlayers + 1);
                            if (newPlayers !== currentPlayers) {
                              setRoomSettings((prev) => ({
                                ...prev,
                                maxPlayers: newPlayers.toString(),
                              }));
                            }
                          }}
                          className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-r-lg transition-all duration-150 hover:cursor-pointer active:scale-95 active:bg-white/20"
                        >
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Max Rounds */}
                    <div>
                      <label className="block text-xs font-medium text-white/90 mb-1">
                        Max Rounds
                      </label>
                      <div className="flex items-center bg-white/10 rounded-lg border border-white/20 backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() => {
                            // Haptic feedback on mobile
                            if (navigator.vibrate) {
                              navigator.vibrate(30);
                            }
                            const rounds = ["1", "2", "3", "5", "10"];
                            const currentIndex = rounds.indexOf(
                              roomSettings.maxRounds
                            );
                            const newIndex = Math.max(0, currentIndex - 1);
                            setRoomSettings((prev) => ({
                              ...prev,
                              maxRounds: rounds[newIndex],
                            }));
                          }}
                          className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-l-lg transition-all duration-150 hover:cursor-pointer active:scale-95 active:bg-white/20"
                        >
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 12H4"
                            />
                          </svg>
                        </button>
                        <span className="flex-1 text-center py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white">
                          {roomSettings.maxRounds}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            // Haptic feedback on mobile
                            if (navigator.vibrate) {
                              navigator.vibrate(30);
                            }
                            const rounds = ["1", "2", "3", "5", "10"];
                            const currentIndex = rounds.indexOf(
                              roomSettings.maxRounds
                            );
                            const newIndex = Math.min(
                              rounds.length - 1,
                              currentIndex + 1
                            );
                            setRoomSettings((prev) => ({
                              ...prev,
                              maxRounds: rounds[newIndex],
                            }));
                          }}
                          className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-r-lg transition-all duration-150 hover:cursor-pointer active:scale-95 active:bg-white/20"
                        >
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Turn Time & Hints */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {/* Turn Time */}
                    <div>
                      <label className="block text-xs font-medium text-white/90 mb-1">
                        Turn Time (sec)
                      </label>
                      <div className="flex items-center bg-white/10 rounded-lg border border-white/20 backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() => {
                            // Haptic feedback on mobile
                            if (navigator.vibrate) {
                              navigator.vibrate(30);
                            }
                            const times = ["30", "45", "60", "90", "120"];
                            const currentIndex = times.indexOf(
                              roomSettings.turnTime
                            );
                            const newIndex = Math.max(0, currentIndex - 1);
                            setRoomSettings((prev) => ({
                              ...prev,
                              turnTime: times[newIndex],
                            }));
                          }}
                          className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-l-lg transition-all duration-150 hover:cursor-pointer active:scale-95 active:bg-white/20"
                        >
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 12H4"
                            />
                          </svg>
                        </button>
                        <span className="flex-1 text-center py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white">
                          {roomSettings.turnTime}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            // Haptic feedback on mobile
                            if (navigator.vibrate) {
                              navigator.vibrate(30);
                            }
                            const times = ["30", "45", "60", "90", "120"];
                            const currentIndex = times.indexOf(
                              roomSettings.turnTime
                            );
                            const newIndex = Math.min(
                              times.length - 1,
                              currentIndex + 1
                            );
                            setRoomSettings((prev) => ({
                              ...prev,
                              turnTime: times[newIndex],
                            }));
                          }}
                          className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-r-lg transition-all duration-150 hover:cursor-pointer active:scale-95 active:bg-white/20"
                        >
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Hints Allowed */}
                    <div>
                      <label className="block text-xs font-medium text-white/90 mb-1">
                        Hints
                      </label>
                      <div className="flex bg-white/10 rounded-lg p-[1px] sm:p-[2px] border border-white/20 backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() =>
                            setRoomSettings((prev) => ({
                              ...prev,
                              hintsAllowed: "false",
                            }))
                          }
                          className={`flex-1 py-1.5 sm:py-2 px-1 sm:px-2 rounded-md text-xs font-medium transition-colors hover:cursor-pointer ${
                            roomSettings.hintsAllowed === "false"
                              ? "bg-red-500/80 text-white shadow-sm border border-red-400/30"
                              : "text-white/70 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          ✗ No
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRoomSettings((prev) => ({
                              ...prev,
                              hintsAllowed: "true",
                            }))
                          }
                          className={`flex-1 py-1.5 sm:py-2 px-1 sm:px-2 rounded-md text-xs font-medium transition-colors hover:cursor-pointer ${
                            roomSettings.hintsAllowed === "true"
                              ? "bg-green-500/80 text-white shadow-sm border border-green-400/30"
                              : "text-white/70 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          ✓ Yes
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Difficulty & Room Type */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {/* Difficulty */}
                    <div>
                      <label className="block text-xs font-medium text-white/90 mb-1">
                        Difficulty
                      </label>
                      <div className="flex bg-white/10 rounded-lg p-[1px] sm:p-[2px] border border-white/20 backdrop-blur-md">
                        {["easy", "medium", "hard"].map((diff) => (
                          <button
                            key={diff}
                            type="button"
                            onClick={() =>
                              setRoomSettings((prev) => ({
                                ...prev,
                                difficulty: diff,
                              }))
                            }
                            className={`flex-1 py-1.5 sm:py-2 px-0.5 sm:px-1 rounded-md text-xs font-medium transition-colors hover:cursor-pointer ${
                              roomSettings.difficulty === diff
                                ? diff === "easy"
                                  ? "bg-green-500/80 text-white shadow-sm border border-green-400/30"
                                  : diff === "medium"
                                  ? "bg-yellow-500/80 text-white shadow-sm border border-yellow-400/30"
                                  : "bg-red-500/80 text-white shadow-sm border border-red-400/30"
                                : "text-white/70 hover:text-white hover:bg-white/10"
                            }`}
                          >
                            {diff.charAt(0).toUpperCase() + diff.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Room Type */}
                    <div>
                      <label className="block text-xs font-medium text-white/90 mb-1">
                        Room Type
                      </label>
                      <div className="flex bg-white/10 rounded-lg p-[1px] sm:p-[2px] border border-white/20 backdrop-blur-md">
                        <button
                          type="button"
                          onClick={() =>
                            setRoomSettings((prev) => ({
                              ...prev,
                              roomType: "public",
                            }))
                          }
                          className={`flex-1 py-1.5 sm:py-2 px-1 sm:px-2 rounded-md text-xs font-medium transition-colors hover:cursor-pointer ${
                            roomSettings.roomType === "public"
                              ? "bg-blue-500/80 text-white shadow-sm border border-blue-400/30"
                              : "text-white/70 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          🌐 Public
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRoomSettings((prev) => ({
                              ...prev,
                              roomType: "private",
                            }))
                          }
                          className={`flex-1 py-1.5 sm:py-2 px-1 sm:px-2 rounded-md text-xs font-medium transition-colors hover:cursor-pointer ${
                            roomSettings.roomType === "private"
                              ? "bg-purple-500/80 text-white shadow-sm border border-purple-400/30"
                              : "text-white/70 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          🔒 Private
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Update Button */}
                  <div className="pt-1 sm:pt-2">
                    <button
                      type="button"
                      disabled={settingsUpdateStatus === "updating"}
                      onClick={() => handleUpdateRoomSettings(roomSettings)}
                      className={`w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-all duration-300 font-medium hover:cursor-pointer flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm border backdrop-blur-md ${
                        settingsUpdateStatus === "success"
                          ? "bg-green-600/80 text-white border-green-400/30"
                          : settingsUpdateStatus === "updating"
                          ? "bg-white/20 text-white/70 cursor-not-allowed border-white/10"
                          : "bg-gradient-to-r from-blue-500/80 to-indigo-500/80 text-white hover:from-blue-600/90 hover:to-indigo-600/90 border-white/20"
                      }`}
                    >
                      {settingsUpdateStatus === "updating" && (
                        <svg
                          className="animate-spin h-3 w-3 sm:h-4 sm:w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      )}
                      {settingsUpdateStatus === "success" && (
                        <svg
                          className="h-3 w-3 sm:h-4 sm:w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                      {settingsUpdateStatus === "updating"
                        ? "Updating..."
                        : settingsUpdateStatus === "success"
                        ? "Settings Updated!"
                        : "Update Settings"}
                    </button>
                  </div>
                </div>

                {/* Game and Invite Controls */}
                <div className="border-t border-white/20 mt-2 sm:mt-4 pt-2 sm:pt-4 space-y-2 sm:space-y-3 flex-shrink-0">
                  {/* Start Game, Copy Invite, and Vote to Kick buttons in one row */}
                  <div className="grid grid-cols-3 gap-1 sm:gap-2">
                    <button
                      className={`py-1.5 sm:py-2 px-1 sm:px-2 rounded-lg font-semibold text-white hover:cursor-pointer text-xs sm:text-sm border backdrop-blur-md shadow-md ${
                        playersList.length >= 2 && !gameInfo.currentDrawer
                          ? "bg-gradient-to-r from-green-500/80 to-emerald-500/80 hover:from-green-600/90 hover:to-emerald-600/90 border-green-400/30"
                          : "bg-white/20 cursor-not-allowed border-white/10"
                      }`}
                      disabled={
                        playersList.length < 2 || !!gameInfo.currentDrawer
                      }
                      onClick={handleStartGame}
                    >
                      Start Game
                    </button>

                    <button
                      onClick={() => {
                        const url = getShareableLink();
                        const buttonTextElement = document.getElementById(
                          "admin-copy-btn-text"
                        );
                        if (!buttonTextElement) return;
                        const originalText = buttonTextElement.innerText;

                        const showFeedback = (success: boolean) => {
                          if (buttonTextElement) {
                            buttonTextElement.innerText = success
                              ? "Copied! 👍"
                              : "Copy failed ❌";
                            setTimeout(() => {
                              buttonTextElement.innerText = originalText;
                            }, 2000);
                          }
                        };

                        const fallbackCopy = () => {
                          const textArea = document.createElement("textarea");
                          textArea.value = url;
                          textArea.style.position = "fixed";
                          textArea.style.top = "-999999px";
                          textArea.style.left = "-999999px";
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
                          showFeedback(success);
                        };

                        if (
                          navigator.clipboard &&
                          navigator.clipboard.writeText
                        ) {
                          navigator.clipboard
                            .writeText(url)
                            .then(() => showFeedback(true), fallbackCopy);
                        } else {
                          fallbackCopy();
                        }
                      }}
                      className="py-1.5 sm:py-2 px-1 sm:px-2 bg-white/10 hover:bg-white/20 rounded-md font-medium text-white backdrop-blur-md border border-white/20 transition-colors text-center hover:cursor-pointer text-xs sm:text-sm shadow-md"
                    >
                      <span id="admin-copy-btn-text">🔗 {roomId}</span>
                    </button>
                    
                    <button
                      onClick={() => setShowKickPlayerModal(true)}
                      className="py-1.5 sm:py-2 px-1 sm:px-2 bg-red-500/80 hover:bg-red-600/80 text-white rounded-lg transition-colors duration-200 flex items-center justify-center gap-1 text-xs sm:text-sm border border-white/20 backdrop-blur-md shadow-md"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3 sm:h-4 sm:w-4 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Kick
                    </button>
                  </div>
                  
                  <p className="text-xs text-center text-white/60">
                    {playersList.length < 2
                      ? "Need at least 2 players to start."
                      : gameInfo.currentDrawer
                      ? "A game is already in progress."
                      : "Ready to kick things off!"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* View-Only Room Settings Modal */}
          {showViewOnlySettings && (
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-20"
              onClick={() => setShowViewOnlySettings(false)}
            >
              {/* Main glass container */}
              <div
                className="relative max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Glass backdrop with enhanced effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent backdrop-blur-2xl rounded-3xl border border-white/30 shadow-2xl"></div>

                {/* Inner highlight border */}
                <div className="absolute inset-[1px] bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl"></div>

                {/* Content container */}
                <div className="relative p-4 md:p-6 rounded-3xl">
                  <div className="text-center mb-2 md:mb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-white text-shadow-sm">
                      Current Room Settings
                    </h2>
                  </div>

                  <div className="space-y-2 md:space-y-3">
                    {/* First row - Max Players & Max Rounds */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Max Players */}
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-white/90 mb-1">
                          Max Players
                        </label>
                        <div className="w-full px-2 py-1.5 md:px-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-white/80 backdrop-blur-md text-xs md:text-sm">
                          {roomSettings.maxPlayers} Players
                        </div>
                      </div>

                      {/* Max Rounds */}
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-white/90 mb-1">
                          Max Rounds
                        </label>
                        <div className="w-full px-2 py-1.5 md:px-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-white/80 backdrop-blur-md text-xs md:text-sm">
                          {roomSettings.maxRounds}{" "}
                          {roomSettings.maxRounds === "1" ? "Round" : "Rounds"}
                        </div>
                      </div>
                    </div>

                    {/* Second row - Turn Time & Hints */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Turn Time */}
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-white/90 mb-1">
                          Turn Time
                        </label>
                        <div className="w-full px-2 py-1.5 md:px-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-white/80 backdrop-blur-md text-xs md:text-sm">
                          {roomSettings.turnTime} sec
                        </div>
                      </div>

                      {/* Hints Allowed */}
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-white/90 mb-1">
                          Hints
                        </label>
                        <div className="w-full px-2 py-1.5 md:px-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-white/80 backdrop-blur-md text-xs md:text-sm">
                          {roomSettings.hintsAllowed === "true" ? "Yes" : "No"}
                        </div>
                      </div>
                    </div>

                    {/* Third row - Difficulty & Room Type */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* Difficulty */}
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-white/90 mb-1">
                          Difficulty
                        </label>
                        <div className="w-full px-2 py-1.5 md:px-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-white/80 backdrop-blur-md text-xs md:text-sm">
                          {roomSettings.difficulty.charAt(0).toUpperCase() +
                            roomSettings.difficulty.slice(1)}
                        </div>
                      </div>

                      {/* Room Type */}
                      <div>
                        <label className="block text-xs md:text-sm font-medium text-white/90 mb-1">
                          Room Type
                        </label>
                        <div className="w-full px-2 py-1.5 md:px-3 md:py-2 bg-white/10 border border-white/20 rounded-md text-white/80 backdrop-blur-md text-xs md:text-sm">
                          {roomSettings.roomType.charAt(0).toUpperCase() +
                            roomSettings.roomType.slice(1)}
                        </div>
                      </div>
                    </div>

                    {/* Add Vote to Kick button */}
                    <div className="mt-4 border-t border-white/20 pt-4">
                      <button
                        onClick={() => {
                          setShowViewOnlySettings(false);
                          setShowKickPlayerModal(true);
                        }}
                        className="w-full bg-red-500/80 hover:bg-red-600/80 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200 flex items-center justify-center"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Vote to Kick Player
                      </button>
                    </div>

                    {/* Copy Invite Button */}
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          const url = getShareableLink();
                          const buttonTextElement = document.getElementById(
                            "view-only-copy-btn-text"
                          );
                          if (!buttonTextElement) return;
                          const originalText = buttonTextElement.innerText;

                          const showFeedback = (success: boolean) => {
                            if (buttonTextElement) {
                              buttonTextElement.innerText = success
                                ? "Copied! 👍"
                                : "Copy failed ❌";
                              setTimeout(() => {
                                buttonTextElement.innerText = originalText;
                              }, 2000);
                            }
                          };

                          const fallbackCopy = () => {
                            const textArea = document.createElement("textarea");
                            textArea.value = url;
                            textArea.style.position = "fixed";
                            textArea.style.top = "-999999px";
                            textArea.style.left = "-999999px";
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
                            showFeedback(success);
                          };

                          if (
                            navigator.clipboard &&
                            navigator.clipboard.writeText
                          ) {
                            navigator.clipboard
                              .writeText(url)
                              .then(() => showFeedback(true), fallbackCopy);
                          } else {
                            fallbackCopy();
                          }
                        }}
                        className="w-full px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-blue-500/80 to-indigo-500/80 text-white rounded-lg hover:from-blue-600/90 hover:to-indigo-600/90 transition-colors font-medium hover:cursor-pointer flex items-center justify-center gap-1 md:gap-2 text-xs md:text-sm border border-white/20 backdrop-blur-md"
                      >
                        <span id="view-only-copy-btn-text">🔗 Copy Invite</span>
                      </button>
                    </div>

                    <div className="text-center mt-4">
                      <button
                        onClick={() => setShowViewOnlySettings(false)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar - Chat Only */}
      <aside className="flex flex-col gap-2 p-1 min-h-0 w-full h-[30vh] lg:w-72 xl:w-80 lg:flex-none lg:p-4 lg:h-screen lg:border-l lg:border-white/20 lg:bg-transparent">
        {/* Chat Section - Full height */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <Chat
            wordToGuess={isCurrentUserDrawing ? "" : wordToDraw}
            onCorrectGuess={() => setGuessed(true)}
            playerName={playerName}
            sendMessage={sendMessage}
            isDrawer={isCurrentUserDrawing}
          />
        </div>
      </aside>

      {/* Kick Player Modal */}
      <KickPlayerModal
        isOpen={showKickPlayerModal}
        onClose={() => setShowKickPlayerModal(false)}
        onVote={handleVoteToKick}
      />
    </main>
  );
}
