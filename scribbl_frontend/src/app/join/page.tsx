"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/store/usePlayerStore";
import { createSocket } from "@/lib/socket";
import { Socket } from "phoenix";

export default function JoinPage() {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);

  const router = useRouter();
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setRoomIdGlobal = usePlayerStore((s) => s.setRoomId);
  const setChannel = usePlayerStore((s) => s.setChannel);

  useEffect(() => {
    const s = createSocket();
    s.connect(); // connect ONCE inside useEffect
    setSocket(s);

    return () => {
      s.disconnect(); // Clean up socket when page unmounts
    };
  }, []);

  const handleJoin = () => {
    if (!socket) {
      console.error("Socket not ready");
      return;
    }
    if (!name.trim()) return;

    const finalRoomId =
      roomId.trim() || Math.random().toString(36).substring(2, 8);

    // Save to global store
    setPlayerName(name.trim());
    setRoomIdGlobal(finalRoomId);

    const channel = socket.channel(`room:${finalRoomId}`, {});

    channel
      .join()
      .receive("ok", (res) => {
        console.log("Joined successfully", res);
        setChannel(channel);
        router.push("/game"); // Navigate to game
      })
      .receive("error", (err) => {
        console.error("Unable to join", err);
      });
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
        disabled={!socket}
        className="bg-blue-500 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {roomId.trim() ? "Join Room" : "Join Random Room"}
      </button>
    </div>
  );
}
