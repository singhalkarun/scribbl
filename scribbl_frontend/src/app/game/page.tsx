"use client";

import { usePlayerStore } from "@/store/usePlayerStore";
import { useEffect, useState, useMemo, useRef } from "react";
import Canvas, { CanvasHandle } from "@/components/Canvas";
import { Lobby } from "@/components/Lobby";
import { PlayerBadge } from "@/components/PlayerBadge";
import { ChatBar } from "@/components/ChatBar";
import { Toolbar } from "@/components/Toolbar";
import { InfoBadge } from "@/components/InfoBadge";
import { WordSelectModal } from "@/components/WordSelectModal";
import { TurnToast } from "@/components/TurnToast";
import GameOverModal from "@/components/GameOverModal";
import KickPlayerModal from "@/components/KickPlayerModal";
import KickedModal from "@/components/KickedModal";
import VoiceChat from "@/components/VoiceChat";
import { useRouter } from "next/navigation";
import { useRoomChannel } from "@/hooks/useRoomChannel";
import { useSoundEffects } from "@/utils/useSoundEffects";

export default function GamePage() {
  // Individual selectors prevent full re-render on every store change
  const playerName = usePlayerStore((s) => s.playerName);
  const roomId = usePlayerStore((s) => s.roomId);
  const players = usePlayerStore((s) => s.players);
  const userId = usePlayerStore((s) => s.userId);
  const adminId = usePlayerStore((s) => s.adminId);
  const setAdminId = usePlayerStore((s) => s.setAdminId);
  const _hasHydrated = usePlayerStore((s) => s._hasHydrated);
  const scores = usePlayerStore((s) => s.scores);
  const updateScore = usePlayerStore((s) => s.updateScore);
  const playerAvatars = usePlayerStore((s) => s.playerAvatars);
  const messages = usePlayerStore((s) => s.messages);

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
  const [isChoosingWord, setIsChoosingWord] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [revealedLetters, setRevealedLetters] = useState<string[]>([]);
  const [specialChars, setSpecialChars] = useState<
    { index: number; char: string }[]
  >([]);
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

  // Drawing tool state (externalized from Canvas)
  const [activeColor, setActiveColor] = useState("#333333");
  const [activeTool, setActiveTool] = useState<"draw" | "erase">("draw");
  const [brushSize, setBrushSize] = useState(4);
  const [guessedPlayers, setGuessedPlayers] = useState<Set<string>>(new Set());
  const canvasRef = useRef<CanvasHandle>(null);

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

  // Build the word display string for the InfoBadge
  const wordDisplay = useMemo(() => {
    // If drawer or already guessed, show the full word
    if (isCurrentUserDrawing && wordToDraw) {
      return wordToDraw;
    }
    if (guessed && wordToDraw) {
      return wordToDraw;
    }
    // Otherwise build from blanks + revealed letters + special chars
    if (wordLength > 0) {
      const display: string[] = [];
      for (let i = 0; i < wordLength; i++) {
        // Check if this position is a special char (space, hyphen, etc.)
        const special = specialChars.find((sc) => sc.index === i);
        if (special) {
          // Use non-breaking spaces so the gap is visible in HTML
          display.push(special.char === " " ? "\u00A0\u00A0" : special.char);
        } else if (revealedLetters[i] && revealedLetters[i] !== "_") {
          display.push(revealedLetters[i]);
        } else {
          display.push("_");
        }
      }
      return display.join(" ");
    }
    return "";
  }, [isCurrentUserDrawing, wordToDraw, guessed, wordLength, revealedLetters, specialChars]);

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

          // Show "choosing a word" indicator to non-drawers
          setIsChoosingWord(true);

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
        const wordAutoSelectedRef = channel.on(
          "word_auto_selected",
          (payload) => {
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
          }
        );

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
            text: isCurrentUserDrawer
              ? "You skipped to get new words."
              : `${drawerName} skipped to get new words.`,
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
          setIsChoosingWord(false);

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
            console.log(
              "[GamePage] Setting special chars:",
              payload.special_chars
            );
          } else {
            setSpecialChars([]);
          }

          // Make sure room status is set to "started"
          setRoomStatus("started");

          // Reset revealed letters for new turn
          setRevealedLetters([]);

          // Clear guessedPlayers for new turn
          setGuessedPlayers(new Set());

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

          // Clear guessedPlayers on turn over
          setGuessedPlayers(new Set());
          setIsChoosingWord(false);

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
          setIsChoosingWord(false);

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
          setGuessedPlayers(new Set());
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

          // Track guessed players
          setGuessedPlayers((prev) => new Set(prev).add(payload.user_id));

          // If the current user guessed correctly, update guessed state
          if (payload.user_id === userId) {
            setGuessed(true);
          }

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
          const playerName = isCurrentUser
            ? "You"
            : players[payload.user_id] || "Someone";
          usePlayerStore.getState().addMessage({
            userId: "system",
            text: `👍 ${playerName} liked the drawing!`,
            system: true,
          });
        });

        const drawingDislikedRef = channel.on("drawing_disliked", (payload) => {
          console.log("[GamePage] Received drawing_disliked:", payload);
          const isCurrentUser = payload.user_id === userId;
          const playerName = isCurrentUser
            ? "You"
            : players[payload.user_id] || "Someone";
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

      // Send integers for numeric fields (backend validates as numbers)
      const payload: Record<string, unknown> = {
        max_players: parseInt(updatedSettings.maxPlayers) || 8,
        max_rounds: parseInt(updatedSettings.maxRounds) || 3,
        turn_time: parseInt(updatedSettings.turnTime) || 60,
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

  // Handle word selection from the WordSelectModal
  const handleSelectWord = (word: string) => {
    // Clear the word selection timer since user made a choice
    if (wordSelectionTimerRef.current) {
      clearInterval(wordSelectionTimerRef.current);
      wordSelectionTimerRef.current = null;
    }

    const channel = usePlayerStore.getState().channel;
    if (channel) {
      console.log("[GamePage] Sending start_turn event with word:", word);
      channel.push("start_turn", { word });
      // Set the word to draw for the drawer only
      setWordToDraw(word);
      setShowWordSelection(false);
    }
  };

  // Handle word skip from the WordSelectModal
  const handleSkipWords = () => {
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
      router.replace("/join");
    }
  }, [playerKicked, router]);

  // Display loading/error based on hook state OR if not hydrated
  if (
    !_hasHydrated ||
    connectionState === "connecting" ||
    connectionState === "idle"
  ) {
    return (
      <div className="min-h-[100svh] bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4">✏️</div>
          <p className="font-bold text-[var(--text-muted)]">
            Connecting to room {roomId}...
          </p>
        </div>
      </div>
    );
  }

  if (connectionState === "error") {
    return (
      <div className="min-h-[100svh] bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">😵</div>
          <p className="font-bold text-[var(--color-coral)] mb-4">
            Oops! Failed to connect to room {roomId}.
          </p>
          <button
            onClick={() => router.push("/join")}
            className="bg-coral text-white font-bold px-6 py-2.5 rounded-scribbl-md border-[2.5px] border-ink shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs transition-all duration-150"
          >
            Return to Join Page
          </button>
        </div>
      </div>
    );
  }

  // Only render game page content if joined
  if (connectionState !== "joined") {
    // Should not happen if checks above are exhaustive, but good fallback
    return (
      <div className="min-h-[100svh] bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4">✏️</div>
          <p className="font-bold text-[var(--text-muted)]">
            Unexpected connection state: {connectionState}
          </p>
        </div>
      </div>
    );
  }

  // If player is kicked, show the kicked modal
  if (playerKicked) {
    return <KickedModal />;
  }

  // Waiting state: show Lobby
  if (roomStatus === "waiting") {
    return (
      <main className="min-h-[100svh] bg-cream flex flex-col">
        {/* Game Over Modal (can show over lobby after game ends) */}
        <GameOverModal
          isOpen={showGameOverModal}
          onClose={handleCloseGameOverModal}
          scores={finalScores}
          players={finalPlayers}
          currentUserId={userId}
        />
        <Lobby
          roomId={roomId}
          players={players}
          playerAvatars={playerAvatars}
          adminId={adminId}
          userId={userId}
          maxPlayers={parseInt(roomSettings.maxPlayers) || 8}
          roomSettings={roomSettings}
          isAdmin={isCurrentUserAdmin}
          onStartGame={handleStartGame}
          onUpdateSettings={handleUpdateRoomSettings}
        />
      </main>
    );
  }

  // Active game: Canvas Maximalist layout
  return (
    <main className="h-[100svh] bg-cream flex flex-col p-2.5 lg:p-4 gap-2">
      {/* Modals */}
      {showWordSelection && isCurrentUserDrawing && (
        <WordSelectModal
          words={suggestedWords}
          countdown={wordSelectionCountdown}
          hasSkipped={hasSkippedWords}
          onSelectWord={handleSelectWord}
          onSkip={handleSkipWords}
          difficulty={roomSettings.difficulty}
        />
      )}

      {showTurnOverModal && (
        <TurnToast
          reason={(turnOverReason || "timeout") as "all_guessed" | "timeout" | "drawer_left"}
          word={turnOverWord}
          countdown={turnOverCountdown}
        />
      )}

      <GameOverModal
        isOpen={showGameOverModal}
        onClose={handleCloseGameOverModal}
        scores={finalScores}
        players={finalPlayers}
        currentUserId={userId}
      />

      <KickPlayerModal
        isOpen={showKickPlayerModal}
        onClose={() => setShowKickPlayerModal(false)}
        onVote={handleVoteToKick}
      />

      {/* View-Only Settings Modal */}
      {showViewOnlySettings && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={() => setShowViewOnlySettings(false)}
        >
          <div
            className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-6 max-w-[420px] w-full relative animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Pin decoration */}
            <div className="absolute -top-3 right-5 text-[22px] rotate-12">📌</div>

            <h2 className="font-display text-xl text-coral text-center mb-4" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>
              Room Settings
            </h2>

            <div className="space-y-2.5">
              {/* Row 1: Max Players & Max Rounds */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Max Players</label>
                  <div className="bg-[var(--color-cream)] border-[2.5px] border-ink rounded-scribbl-sm px-3 py-1.5 text-sm font-bold text-center">
                    {roomSettings.maxPlayers}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Max Rounds</label>
                  <div className="bg-[var(--color-cream)] border-[2.5px] border-ink rounded-scribbl-sm px-3 py-1.5 text-sm font-bold text-center">
                    {roomSettings.maxRounds}
                  </div>
                </div>
              </div>

              {/* Row 2: Turn Time & Hints */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Turn Time</label>
                  <div className="bg-[var(--color-cream)] border-[2.5px] border-ink rounded-scribbl-sm px-3 py-1.5 text-sm font-bold text-center">
                    {roomSettings.turnTime}s
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Hints</label>
                  <div className="bg-[var(--color-cream)] border-[2.5px] border-ink rounded-scribbl-sm px-3 py-1.5 text-sm font-bold text-center">
                    {roomSettings.hintsAllowed === "true" ? "Yes" : "No"}
                  </div>
                </div>
              </div>

              {/* Row 3: Difficulty & Room Type */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Difficulty</label>
                  <div className="bg-[var(--color-cream)] border-[2.5px] border-ink rounded-scribbl-sm px-3 py-1.5 text-sm font-bold text-center">
                    {roomSettings.difficulty.charAt(0).toUpperCase() + roomSettings.difficulty.slice(1)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] mb-1">Room Type</label>
                  <div className="bg-[var(--color-cream)] border-[2.5px] border-ink rounded-scribbl-sm px-3 py-1.5 text-sm font-bold text-center">
                    {roomSettings.roomType.charAt(0).toUpperCase() + roomSettings.roomType.slice(1)}
                  </div>
                </div>
              </div>

              {/* Vote to Kick button */}
              <div className="pt-2 border-t-[2.5px] border-ink/10">
                <button
                  onClick={() => {
                    setShowViewOnlySettings(false);
                    setShowKickPlayerModal(true);
                  }}
                  className="w-full bg-[#FFDDDD] text-[#e74c3c] font-bold px-4 py-2 rounded-scribbl-sm border-[2.5px] border-ink shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs transition-all duration-150 text-sm flex items-center justify-center gap-1.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Vote to Kick Player
                </button>
              </div>

              {/* Copy Invite */}
              <button
                onClick={() => {
                  const url = getShareableLink();
                  const btn = document.getElementById("settings-copy-btn-text");
                  if (!btn) return;
                  const original = btn.innerText;
                  const showFeedback = (success: boolean) => {
                    if (btn) {
                      btn.innerText = success ? "Copied!" : "Copy failed";
                      setTimeout(() => { btn.innerText = original; }, 2000);
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
                    try { success = document.execCommand("copy"); } catch (err) { console.error("Fallback: Unable to copy", err); }
                    document.body.removeChild(textArea);
                    showFeedback(success);
                  };
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(url).then(() => showFeedback(true), fallbackCopy);
                  } else {
                    fallbackCopy();
                  }
                }}
                className="w-full bg-[var(--color-blue)] text-white font-bold px-4 py-2 rounded-scribbl-sm border-[2.5px] border-ink shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs transition-all duration-150 text-sm"
              >
                <span id="settings-copy-btn-text">🔗 Copy Invite Link</span>
              </button>

              {/* Close button */}
              <button
                onClick={() => setShowViewOnlySettings(false)}
                className="w-full bg-white text-ink font-bold px-4 py-2 rounded-scribbl-sm border-[2.5px] border-ink shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs transition-all duration-150 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone 1: Top Bar */}
      <div className="flex items-center justify-between gap-3 flex-shrink-0">
        <div className="font-display text-[22px] text-coral hidden lg:block" style={{ textShadow: "2px 2px 0 #333" }}>
          Scribbl
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <InfoBadge variant="round">
            Round {gameInfo.currentRound} / {roomSettings.maxRounds}
          </InfoBadge>
          {wordDisplay && (
            <InfoBadge variant="word">
              {wordDisplay}
            </InfoBadge>
          )}
          <InfoBadge variant={timeLeft <= 10 ? "timer-warning" : "timer"}>
            {timeLeft}
          </InfoBadge>
        </div>
        <button
          onClick={() => setShowViewOnlySettings(true)}
          className="bg-white border-[2.5px] border-ink rounded-scribbl-sm px-2.5 py-1 text-base shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs transition-all duration-150"
        >
          ⚙️
        </button>
      </div>

      {/* Zone 2: Players Bar */}
      <div className="flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide py-0.5 items-center">
        {Object.entries(players).map(([uid, name]) => (
          <PlayerBadge
            key={uid}
            name={name}
            avatarSeed={playerAvatars[uid] ?? 0}
            score={scores[uid] || 0}
            isDrawing={uid === gameInfo.currentDrawer}
            hasGuessed={guessedPlayers.has(uid)}
          />
        ))}
        <VoiceChat
          scores={scores}
          currentDrawerId={gameInfo.currentDrawer}
          currentPlayerName={playerName}
        />
      </div>

      {/* Zone 3: Canvas */}
      <div className="flex-1 min-h-0 relative">
        <Canvas
          ref={canvasRef}
          isDrawer={isCurrentUserDrawing}
          gameStarted={roomStatus === "started"}
          onLikeDrawing={handleLikeDrawing}
          onDislikeDrawing={handleDislikeDrawing}
          activeColor={activeColor}
          activeTool={activeTool}
          brushSize={brushSize}
          timeLeft={timeLeft}
          currentDrawer={gameInfo.currentDrawer}
          currentRound={gameInfo.currentRound}
          roomStatus={roomStatus}
        />
        {isChoosingWord && !isCurrentUserDrawing && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-scribbl-sm">
            <div className="border-[2.5px] border-ink rounded-scribbl-sm bg-white px-6 py-4 shadow-scribbl-sm text-center">
              <p className="text-lg font-bold text-ink">
                {players[gameInfo.currentDrawer] || "Someone"} is choosing a word...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Zone 4: Toolbar (drawer only) + Chat */}
      {isCurrentUserDrawing && (
        <Toolbar
          activeColor={activeColor}
          activeTool={activeTool}
          brushSize={brushSize}
          onColorChange={setActiveColor}
          onToolChange={setActiveTool}
          onBrushSizeChange={setBrushSize}
          onUndo={() => canvasRef.current?.undo()}
          onClear={() => canvasRef.current?.clear()}
        />
      )}
      <ChatBar
        messages={messages}
        onSendMessage={(text) => sendMessage(text)}
        disabled={isCurrentUserDrawing}
        disabledReason="You're drawing!"
        currentUserId={userId}
      />
    </main>
  );
}
