"use client";

import { usePlayerStore } from "@/store/usePlayerStore";
import { useEffect, useState, useMemo, useRef } from "react";
import Canvas from "@/components/Canvas";
import Chat from "@/components/Chat";
import { useRouter } from "next/navigation";
import { useRoomChannel } from "@/hooks/useRoomChannel";

export default function GamePage() {
  const { playerName, roomId, players, userId, _hasHydrated } =
    usePlayerStore();

  const { connectionState, sendMessage } = useRoomChannel();

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
  const [suggestedWord, setSuggestedWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameJustEnded, setGameJustEnded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();

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

  // Handle word selection
  const handleWordSelect = () => {
    const channel = usePlayerStore.getState().channel;
    if (channel) {
      console.log(
        "[GamePage] Sending start_turn event with word:",
        suggestedWord
      );
      channel.push("start_turn", { word: suggestedWord });
      // Set the word to draw for the drawer only
      setWordToDraw(suggestedWord);
      setShowWordSelection(false);
    }
  };

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
    console.log("[GamePage] suggestedWord changed:", suggestedWord);
  }, [suggestedWord]);

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
        });

        // Listen for drawer_assigned event
        const drawerAssignedRef = channel.on("drawer_assigned", (payload) => {
          console.log("[GamePage] Received drawer_assigned:", payload);
          setGameInfo((prev) => ({
            ...prev,
            currentDrawer: payload.drawer,
          }));
        });

        // Listen for select_word event (only sent to the drawer)
        const selectWordRef = channel.on("select_word", (payload) => {
          console.log("[GamePage] Received select_word:", payload);
          // Only set the suggested word, not final yet
          setSuggestedWord(payload.word);
          console.log("[GamePage] Set suggestedWord to:", payload.word);
          setShowWordSelection(true);
        });

        // Listen for turn_started event
        const turnStartedRef = channel.on("turn_started", (payload) => {
          console.log("[GamePage] Received turn_started:", payload);
          // Reset the guessed state for the new turn
          setGuessed(false);
          // Set the word length for displaying blanks
          setWordLength(payload.word_length);
          // Make sure room status is set to "started"
          setRoomStatus("started");
          // If the word selection overlay is showing, hide it
          if (showWordSelection) {
            setShowWordSelection(false);
          }

          // Start the timer - 60 seconds
          setTimeLeft(60);

          // Clear any existing timer
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }

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
        });

        // Listen for turn_over event
        const turnOverRef = channel.on("turn_over", (payload) => {
          console.log("[GamePage] Received turn_over:", payload);
          // Clear the timer if it's still running
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // Reset states for the next turn
          setTimeLeft(0);
          setWordToDraw("");
          setWordLength(0);
        });

        // Listen for game_over event
        const gameOverRef = channel.on("game_over", (payload) => {
          console.log("[GamePage] Received game_over:", payload);

          // Clear any running timer
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // Show game over message
          setGameJustEnded(true);

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

          // Clear the game over message after a few seconds
          setTimeout(() => {
            setGameJustEnded(false);
          }, 5000);
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

            // Clear any running timer
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
        };
      }
    }
  }, [connectionState, roomId]);

  // Handle start game button click
  const handleStartGame = () => {
    const channel = usePlayerStore.getState().channel;
    if (channel) {
      console.log("[GamePage] Sending start_game event");
      channel.push("start_game", {});
    }
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
    <main className="h-screen w-screen flex flex-col md:flex-row bg-gradient-to-br from-purple-50 via-white to-blue-100 overflow-hidden p-0">
      {/* Word Selection Overlay */}
      {showWordSelection && isCurrentUserDrawing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-2xl text-center max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Select Word to Draw
            </h2>
            <p className="text-gray-600 mb-6">
              Click on the word to start your turn
            </p>

            <button
              onClick={handleWordSelect}
              className="text-2xl py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white w-full rounded-lg font-semibold transition-colors hover:cursor-pointer"
            >
              {suggestedWord || "Loading..."}
            </button>
          </div>
        </div>
      )}

      {/* Canvas area - Fixed height on mobile, grows on md+ */}
      <div className="px-1 h-[45vh] md:h-auto md:flex-1 md:p-4">
        <div className="w-full h-full bg-white rounded-xl md:shadow-lg flex flex-col overflow-hidden">
          <Canvas isDrawer={isCurrentUserDrawing} />
        </div>
      </div>

      {/* Sidebar Area - Takes remaining space on mobile, fixed width on md+ */}
      <aside className="flex-1 flex flex-col gap-2 p-1 min-h-0 md:w-80 lg:w-96 md:flex-none md:p-4 md:h-screen md:border-l md:border-gray-200 md:bg-transparent">
        {/* Players & Chat Container - Row on mobile, Col on md+ */}
        {/* Takes most of the space in aside, leaving room for Word Hint */}
        <div className="flex-1 flex flex-row gap-2 min-h-0 md:flex-col md:gap-4">
          {/* Players - Takes half width on mobile */}
          <div className="w-1/2 bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex flex-col md:w-auto min-h-0">
            <h2 className="font-bold text-lg mb-2 text-gray-700 flex-shrink-0">
              Players
            </h2>
            <ul className="text-sm text-gray-600 space-y-1.5 overflow-y-auto pr-1 flex-1">
              {playersList.length > 0 ? (
                playersList.map((name, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="text-lg">👤</span>
                    <span>
                      {name === playerName ? <b>{name} (You)</b> : name}
                    </span>
                  </li>
                ))
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
            />
          </div>
        </div>

        {/* Conditionally render Word hint or Start Game button */}
        {roomStatus === "waiting" ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm py-3 md:p-3 text-center flex-shrink-0">
            {gameJustEnded ? (
              <div className="mb-3">
                <h3 className="text-xl font-bold text-indigo-600 mb-1">
                  Game Over!
                </h3>
                <p className="text-sm text-gray-600 mb-2">The game has ended</p>
                <div className="w-full h-1 bg-indigo-100 rounded mb-4">
                  <div
                    className="h-full bg-indigo-500 rounded animate-pulse"
                    style={{ width: "100%" }}
                  ></div>
                </div>
              </div>
            ) : null}

            <button
              className={`w-full py-2 px-4 rounded-md font-semibold text-white hover:cursor-pointer ${
                playersList.length >= 2 && !gameInfo.currentDrawer
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
              disabled={playersList.length < 2 || !!gameInfo.currentDrawer}
              onClick={handleStartGame}
            >
              {gameJustEnded ? "Start New Game" : "Start Game"}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              {playersList.length < 2
                ? "Need at least 2 players to start"
                : gameInfo.currentDrawer
                ? "Game is starting..."
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
                : wordLength > 0
                ? Array(
                    typeof wordLength === "string"
                      ? parseInt(wordLength)
                      : wordLength
                  )
                    .fill("_")
                    .join(" ")
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
