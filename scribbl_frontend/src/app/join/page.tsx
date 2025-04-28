"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/store/usePlayerStore";

export default function JoinPage() {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const router = useRouter();
  const socket = usePlayerStore((s) => s.socket);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setRoomIdGlobal = usePlayerStore((s) => s.setRoomId);

  const handleJoin = () => {
    if (!socket) {
      console.error("Socket not ready");
      return;
    }
    if (!name.trim()) return;

    setIsJoining(true);

    const finalRoomId =
      roomId.trim() || Math.random().toString(36).substring(2, 8);

    console.log(
      `[JoinPage] Setting player name: ${name.trim()} and room ID: ${finalRoomId}`
    );
    setPlayerName(name.trim());
    setRoomIdGlobal(finalRoomId);

    console.log("[JoinPage] Navigating to /game");
    router.push("/game");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleJoin();
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-indigo-50 via-white to-cyan-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
          Join a Scribbl Room
        </h1>
        <div className="space-y-4">
          <input
            className="border border-gray-300 px-4 py-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <input
            className="border border-gray-300 px-4 py-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200"
            placeholder="Enter room ID (optional)"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          onClick={handleJoin}
          disabled={!socket || isJoining}
          className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:cursor-pointer"
        >
          {isJoining
            ? "Joining..."
            : roomId.trim()
            ? "Join Room"
            : "Create or Join Random Room"}
        </button>
      </div>
    </div>
  );
}
