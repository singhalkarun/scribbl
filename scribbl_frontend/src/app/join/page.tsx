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
    <div className="h-screen w-screen flex flex-col justify-center items-center gap-4 p-4">
      <h1 className="text-3xl font-bold">Join a room</h1>
      <input
        className="border px-4 py-2 rounded w-64"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <input
        className="border px-4 py-2 rounded w-64"
        placeholder="Enter room id (optional)"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        onClick={handleJoin}
        disabled={!socket || isJoining}
        className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {isJoining
          ? "Joining..."
          : roomId.trim()
          ? "Join Room"
          : "Join Random Room"}
      </button>
    </div>
  );
}
