"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlayerStore } from "@/store/usePlayerStore";
import BackgroundMusic from "@/components/BackgroundMusic";
import InstructionsModal from "@/components/InstructionsModal";

// Component to handle URL parameters
function JoinPageContent() {
  const [name, setName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [joinMode, setJoinMode] = useState<"play" | "create" | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const socket = usePlayerStore((s) => s.socket);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setRoomIdGlobal = usePlayerStore((s) => s.setRoomId);

  // Check if there's a room ID in URL params (from invite link)
  const inviteRoomId = searchParams.get("roomId");

  const handleJoin = async (mode: "play" | "create", roomType?: "private") => {
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
    setJoinMode(mode);

    try {
      let finalRoomId = "";

      if (inviteRoomId) {
        // If there's a room ID in URL params (invite link), use that directly
        finalRoomId = inviteRoomId;
      } else if (mode === "play") {
        // Join a random existing room
        const response = await fetch(
          process.env.NEXT_PUBLIC_BACKEND_URL + "/api/rooms/join-random",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          finalRoomId = data.room_id;
        } else if (response.status === 404) {
          // No public rooms available, create a new one instead
          console.log("No public rooms available, creating new room...");
          const createResponse = await fetch(
            process.env.NEXT_PUBLIC_BACKEND_URL + "/api/rooms/generate-id",
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          if (createResponse.ok) {
            const data = await createResponse.json();
            finalRoomId = data.room_id;
          } else {
            console.error("Failed to create room after no public rooms found");
            setIsJoining(false);
            setJoinMode(null);
            return;
          }
        } else {
          console.error("Failed to join random room");
          setIsJoining(false);
          setJoinMode(null);
          return;
        }
      } else if (mode === "create") {
        // Generate a new room
        const response = await fetch(
          process.env.NEXT_PUBLIC_BACKEND_URL + "/api/rooms/generate-id",
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          finalRoomId = data.room_id;
        } else {
          console.error("Failed to generate room ID");
          setIsJoining(false);
          setJoinMode(null);
          return;
        }
      }

      console.log(
        `[JoinPage] Setting player name: ${name.trim()} and room ID: ${finalRoomId}`
      );
      setPlayerName(name.trim());
      setRoomIdGlobal(finalRoomId);

      // Store room type if it's private so we can pass it to the socket connection
      if (roomType === "private") {
        // Store in sessionStorage so it can be accessed when joining the room
        sessionStorage.setItem("roomType", "private");
      }

      console.log("[JoinPage] Navigating to /game");
      router.push("/game");
    } catch (error) {
      console.error("Error joining room:", error);
      setIsJoining(false);
      setJoinMode(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleJoin("play");
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
        </div>

        {inviteRoomId ? (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-blue-800 text-sm text-center">
              You've been invited to join room: <strong>{inviteRoomId}</strong>
            </p>
          </div>
        ) : null}

        <div className="mt-8 space-y-3">
          <button
            onClick={() => handleJoin("play")}
            disabled={!socket || isJoining}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-lg font-semibold transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {isJoining && joinMode === "play"
              ? "Joining..."
              : inviteRoomId
              ? `Join Room ${inviteRoomId}`
              : "Join Public Game"}
          </button>

          {!inviteRoomId && (
            <button
              onClick={() => handleJoin("create", "private")}
              disabled={!socket || isJoining}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {isJoining && joinMode === "create" ? "Creating..." : "Host Private Game"}
            </button>
          )}
        </div>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <InstructionsModal
          isOpen={showInstructions}
          onClose={() => setShowInstructions(false)}
        />
      )}

      <div className="absolute bottom-4 left-0 right-0 text-center z-10">
        <div className="flex justify-center items-center space-x-6">
          <a
            href="https://www.instagram.com/scribbl.club/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-pink-600 transition-colors duration-200 transform hover:scale-110"
            title="Follow us on Instagram"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
          <a
            href="https://x.com/scribblclub"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-blue-500 transition-colors duration-200 transform hover:scale-110"
            title="Follow us on Twitter"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
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
