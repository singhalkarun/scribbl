"use client";

import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useState } from "react";

export default function JoinPage() {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const { setPlayerName, setRoomId } = usePlayerStore();
  const router = useRouter();

  const handleJoin = () => {
    if (!name.trim()) return;
    setPlayerName(name.trim());
    setRoomId(room.trim());
    router.push("/game");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleJoin();
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow w-full max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Join Game</h1>
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full border px-3 py-2 rounded text-sm"
        />
        <input
          type="text"
          placeholder="Enter room ID (optional)"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full border px-3 py-2 rounded text-sm"
        />
        <button
          onClick={handleJoin}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full text-sm hover:bg-blue-600 transition hover:cursor-pointer"
        >
          {room.trim() ? "Join Room" : "Join Random Room"}
        </button>
      </div>
    </div>
  );
}
