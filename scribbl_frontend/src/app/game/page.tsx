"use client";

import { usePlayerStore } from "@/store/usePlayerStore";
import { useEffect, useState, useMemo } from "react";
import Canvas from "@/components/Canvas";
import Chat from "@/components/Chat";
import { useRouter } from "next/navigation";
import { useRoomChannel } from "@/hooks/useRoomChannel";

export default function GamePage() {
  const { playerName, roomId, players, userId, _hasHydrated } =
    usePlayerStore();

  const { connectionState, sendMessage } = useRoomChannel();

  const wordToGuess = "CHAT";
  const [guessed, setGuessed] = useState(false);
  const [roomStatus, setRoomStatus] = useState("waiting");
  const [gameInfo, setGameInfo] = useState({
    maxRounds: "3",
    currentDrawer: "",
    currentRound: "0",
  });
  const [wordToDraw, setWordToDraw] = useState("");

  const router = useRouter();

  // Check if current user is the drawer
  const isCurrentUserDrawing = useMemo(() => {
    return gameInfo.currentDrawer === userId;
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
          setWordToDraw(payload.word);
        });

        // Cleanup listeners
        return () => {
          if (channel) {
            channel.off("room_info", roomInfoRef);
            channel.off("game_started", gameStartedRef);
            channel.off("drawer_assigned", drawerAssignedRef);
            channel.off("select_word", selectWordRef);
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
      {/* Canvas area - Fixed height on mobile, grows on md+ */}
      <div className="px-1 h-[45vh] md:h-auto md:flex-1 md:p-4">
        <div className="w-full h-full bg-white rounded-xl md:shadow-lg flex flex-col overflow-hidden">
          <Canvas />
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
              wordToGuess={wordToGuess}
              onCorrectGuess={() => setGuessed(true)}
              playerName={playerName}
              sendMessage={sendMessage}
            />
          </div>
        </div>

        {/* Conditionally render Word hint or Start Game button */}
        {roomStatus === "waiting" ? (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm py-3 md:p-3 text-center flex-shrink-0">
            <button
              className={`w-full py-2 px-4 rounded-md font-semibold text-white ${
                playersList.length >= 2
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
              disabled={playersList.length < 2}
              onClick={handleStartGame}
            >
              Start Game
            </button>
            <p className="text-xs text-gray-500 mt-2">
              {playersList.length < 2
                ? "Need at least 2 players to start"
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

            <p className="text-xl md:text-2xl font-mono tracking-widest text-indigo-600">
              {isCurrentUserDrawing
                ? wordToDraw
                : guessed
                ? wordToGuess.split("").join(" ")
                : wordToGuess
                    .split("")
                    .map(() => "_")
                    .join(" ")}
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
