"use client";

import { usePlayerStore } from "@/store/usePlayerStore";
import { useEffect, useState } from "react";
import Canvas from "@/components/Canvas";
import Chat from "@/components/Chat";
import { useRouter } from "next/navigation";

export default function GamePage() {
  const { playerName, roomId } = usePlayerStore();

  const wordToGuess = "CHAT";
  const [guessed, setGuessed] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (!playerName) {
      router.replace("/join");
    }
  }, [playerName]);

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
            <li>👤 Alice</li>
            <li>👤 Bob</li>
            <li>
              👤 <b>{playerName}</b>
            </li>
          </ul>
        </div>

        {/* Chat */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Chat
            wordToGuess={wordToGuess}
            onCorrectGuess={() => setGuessed(true)}
            playerName={playerName}
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
