"use client";

import { usePlayerStore } from "@/store/usePlayerStore";
import { useEffect, useState, useMemo } from "react";
import Canvas from "@/components/Canvas";
import Chat from "@/components/Chat";
import { useRouter } from "next/navigation";
import { useRoomChannel } from "@/hooks/useRoomChannel";

export default function GamePage() {
  const { playerName, roomId, players, _hasHydrated } = usePlayerStore();

  const { connectionState, sendMessage } = useRoomChannel();

  const wordToGuess = "CHAT";
  const [guessed, setGuessed] = useState(false);

  const router = useRouter();

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

        {/* Word hint - Sits at the bottom */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm py-1 md:p-3 text-center flex-shrink-0">
          <p className="text-xl md:text-2xl font-mono tracking-widest text-indigo-600">
            {guessed
              ? wordToGuess.split("").join(" ")
              : wordToGuess
                  .split("")
                  .map(() => "_")
                  .join(" ")}
          </p>
          <p className="text-xs text-gray-500 mt-1">Guess the word!</p>
        </div>
      </aside>
    </main>
  );
}
