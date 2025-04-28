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
    <main className="h-screen w-screen flex flex-col md:flex-row bg-gradient-to-br from-purple-50 via-white to-blue-100 overflow-hidden p-2 md:p-0 gap-2 md:gap-0">
      {/* Canvas area */}
      <div className="md:flex-1 md:p-4 h-[40vh] md:h-auto">
        <div className="w-full h-full bg-white rounded-xl shadow-lg flex flex-col">
          <Canvas />
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-full md:w-80 lg:w-96 bg-white md:bg-transparent md:border-l border-gray-200 p-2 md:p-4 flex flex-col gap-2 md:gap-4 overflow-y-auto flex-shrink-0 flex-1 md:flex-none md:h-screen">
        {/* Players */}
        <div className="bg-white border border-gray-200 md:rounded-lg md:shadow-sm p-3">
          <h2 className="font-bold text-lg mb-2 text-gray-700">Players</h2>
          <ul className="text-sm text-gray-600 space-y-1.5 overflow-y-auto pr-1 md:max-h-32">
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

        {/* Chat */}
        <div className="flex flex-col flex-1 overflow-hidden border border-gray-200 md:rounded-lg md:shadow-sm min-h-0">
          <Chat
            wordToGuess={wordToGuess}
            onCorrectGuess={() => setGuessed(true)}
            playerName={playerName}
            sendMessage={sendMessage}
          />
        </div>

        {/* Word hint */}
        <div className="bg-white border border-gray-200 md:rounded-lg md:shadow-sm p-3 text-center">
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
