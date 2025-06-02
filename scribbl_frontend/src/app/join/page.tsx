"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlayerStore } from "@/store/usePlayerStore";
import BackgroundMusic from "@/components/BackgroundMusic";
import InstructionsModal from "@/components/InstructionsModal";

// Component to handle URL parameters
function JoinPageContent() {
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const socket = usePlayerStore((s) => s.socket);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setRoomIdGlobal = usePlayerStore((s) => s.setRoomId);

  useEffect(() => {
    // Check for roomId in URL parameters
    const roomIdParam = searchParams.get("roomId");
    if (roomIdParam) {
      setRoomId(roomIdParam);
    }
  }, [searchParams]);

  const handleJoin = () => {
    if (!socket) {
      console.error("Socket not ready");
      return;
    }
    if (!name.trim()) {
      // Reset animation by clearing error state first
      setNameError(false);
      // Use setTimeout to retrigger animation
      setTimeout(() => setNameError(true), 10);
      return;
    }

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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (nameError) {
      setNameError(false);
    }
  };

  return (
    <div
      className="h-[100svh] w-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-indigo-50 via-white to-cyan-100 relative overflow-hidden select-none"
      style={{
        cursor: "url('/cursor.png') 0 0, auto",
      }}
    >
      {/* Background Music */}
      <BackgroundMusic src="/sounds/game-music-loop.mp3" volume={0.2} />
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-40 right-10 w-32 h-32 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-10 left-1/2 w-32 h-32 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/20 relative z-10">
        {/* Info Button - Top Right Corner */}
        <button
          onClick={() => setShowInstructions(true)}
          className="absolute top-4 right-4 border-2 border-gray-500 hover:cursor-pointer rounded-full transition-all duration-200 hover:scale-105"
          title="How to Play"
        >
          <div className="w-5 h-5 text-gray-500 flex items-center justify-center text-sm font-bold">
            i
          </div>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Welcome to Scribbl
          </h1>
          <p className="text-gray-600">Join a room and start drawing!</p>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <input
              className={`border px-4 py-3 rounded-lg w-full focus:outline-none focus:ring-2 transition duration-200 bg-white/90 pl-10 ${
                nameError
                  ? "border-red-500 focus:ring-red-400 animate-shake"
                  : "border-gray-300 focus:ring-blue-400"
              }`}
              placeholder="Enter your name"
              value={name}
              onChange={handleNameChange}
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

      {/* Instructions Modal */}
      {showInstructions && (
        <InstructionsModal
          isOpen={showInstructions}
          onClose={() => setShowInstructions(false)}
        />
      )}

      <div className="absolute bottom-4 left-0 right-0 text-center text-sm text-gray-600 z-10">
        Built with ❤️ by{" "}
        <a
          href="https://www.linkedin.com/in/prateek-jakhar-a64a04197"
          className="underline decoration-1 text-gray-500 hover:text-gray-800 underline-offset-4"
        >
          Prateek
        </a>{" "}
        and{" "}
        <a
          href="https://www.linkedin.com/in/singhalkarun"
          className="underline decoration-1 text-gray-500 hover:text-gray-800 underline-offset-4"
        >
          Karun
        </a>
      </div>
    </div>
  );
}

// Loading fallback component
function LoadingJoinPage() {
  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-indigo-50 via-white to-cyan-100">
      <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md border border-white/20 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Loading...</h1>
        </div>
      </div>
    </div>
  );
}

// Main export that wraps the component in Suspense
export default function JoinPage() {
  return (
    <Suspense fallback={<LoadingJoinPage />}>
      <JoinPageContent />
    </Suspense>
  );
}
