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
    <main className="h-screen w-screen flex flex-row bg-gray-100 overflow-hidden">
      {/* Canvas area */}
      <div className="flex-1 p-4">
        <Canvas />
      </div>

      {/* Sidebar */}
      <aside className="w-80 bg-white border-l p-4 flex flex-col gap-4 overflow-y-auto">
        {/* Players */}
        <div className="bg-gray-50 rounded shadow p-3">
          <h2 className="font-semibold text-lg mb-2">Players</h2>
          <ul className="text-sm text-gray-700 space-y-1">
            {playersList.length > 0 ? (
              playersList.map((name, index) => (
                <li key={index}>
                  👤 {name === playerName ? <b>{name} (You)</b> : name}
                </li>
              ))
            ) : (
              <li>No players yet...</li>
            )}
          </ul>
        </div>

        {/* Chat */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Chat
            wordToGuess={wordToGuess}
            onCorrectGuess={() => setGuessed(true)}
            playerName={playerName}
            sendMessage={sendMessage}
          />
        </div>

        {/* Word hint */}
        <div className="bg-gray-50 rounded shadow p-3 text-center">
          <p className="text-xl font-mono tracking-widest">
            {guessed
              ? wordToGuess.split("").join(" ")
              : wordToGuess
                  .split("")
                  .map(() => "_")
                  .join(" ")}
          </p>
        </div>
      </aside>
    </main>
  );
}
