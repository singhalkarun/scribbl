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
    <div
      className="min-h-screen w-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-indigo-50 via-white to-cyan-100 relative overflow-hidden select-none"
      style={{
        cursor: "url('/cursor.png') 16 16, auto",
      }}
    >
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-40 right-10 w-32 h-32 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-10 left-1/2 w-32 h-32 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/20 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Welcome to Scribbl
          </h1>
          <p className="text-gray-600">Join a room and start drawing!</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              className="border border-gray-300 px-4 py-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 bg-white/90 pl-10"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <span className="text-gray-400">👤</span>
            </div>
          </div>

          <div className="relative">
            <input
              className="border border-gray-300 px-4 py-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-400 transition duration-200 bg-white/90 pl-10"
              placeholder="Enter room ID (optional)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🏠</span>
            </div>
          </div>
        </div>

        <button
          onClick={handleJoin}
          disabled={!socket || isJoining}
          className="mt-8 w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
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
