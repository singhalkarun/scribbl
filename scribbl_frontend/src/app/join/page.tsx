"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlayerStore } from "@/store/usePlayerStore";
import BackgroundMusic from "@/components/BackgroundMusic";
import InstructionsModal from "@/components/InstructionsModal";

// Available avatars - cool options
const AVATARS = ["👽", "🤡", "🐵", "🦄", "🤖", "🦊", "🐲", "🦁"];

// Component to handle URL parameters
function JoinPageContent() {
  const [name, setName] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [joinMode, setJoinMode] = useState<"play" | "create" | null>(null);
  const [roomIdInput, setRoomIdInput] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("👽");

  const router = useRouter();
  const searchParams = useSearchParams();
  const socket = usePlayerStore((s) => s.socket);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setRoomIdGlobal = usePlayerStore((s) => s.setRoomId);
  const setAvatar = usePlayerStore((s) => s.setAvatar);

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

      if (mode === "play") {
        // If user typed a room ID, join that directly
        if (roomIdInput.trim()) {
          finalRoomId = roomIdInput.trim();
        } else if (inviteRoomId) {
          // If there's a room ID in URL params (invite link), use that directly
          finalRoomId = inviteRoomId;
        } else {
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
              console.error(
                "Failed to create room after no public rooms found"
              );
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
        `[JoinPage] Setting player name: ${name.trim()}, room ID: ${finalRoomId}, and avatar: ${selectedAvatar}`
      );
      setPlayerName(name.trim());
      setRoomIdGlobal(finalRoomId);
      setAvatar(selectedAvatar);

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

  const handleRoomIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRoomIdInput(e.target.value);
  };

  return (
    <div
      className="h-[100svh] w-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-violet-900 via-blue-900 to-indigo-900 relative overflow-hidden select-none"
      style={{
        cursor: "url('/cursor.png') 0 0, auto",
      }}
    >
      {/* Background Music */}
      <BackgroundMusic src="/sounds/game-music-loop.mp3" volume={0.2} />

      {/* Enhanced Decorative elements with glass effect */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {/* Floating glass orbs */}
        <div className="absolute top-10 left-10 w-40 h-40 bg-gradient-to-r from-cyan-400/30 to-blue-500/30 rounded-full backdrop-blur-xl border border-white/20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-32 h-32 bg-gradient-to-r from-purple-400/30 to-pink-500/30 rounded-full backdrop-blur-xl border border-white/20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-10 left-1/2 w-36 h-36 bg-gradient-to-r from-emerald-400/30 to-teal-500/30 rounded-full backdrop-blur-xl border border-white/20 animate-blob animation-delay-4000"></div>

        {/* Additional glass elements for depth */}
        <div className="absolute top-1/3 left-1/4 w-24 h-24 bg-white/10 rounded-full backdrop-blur-lg border border-white/10 animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/4 w-20 h-20 bg-white/10 rounded-full backdrop-blur-lg border border-white/10 animate-pulse animation-delay-1000"></div>
      </div>

      {/* Main glass container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Glass backdrop with enhanced effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent backdrop-blur-2xl rounded-3xl border border-white/30 shadow-2xl"></div>

        {/* Inner highlight border */}
        <div className="absolute inset-[1px] bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl"></div>

        {/* Content container */}
        <div className="relative p-8 rounded-3xl">
          {/* Info Button - Top Right Corner with glass effect */}
          <button
            onClick={() => setShowInstructions(true)}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 rounded-full transition-all duration-300 hover:scale-110 group z-10 hover:cursor-pointer"
            title="How to Play"
          >
            <div className="w-full h-full text-white/80 group-hover:text-white flex items-center justify-center text-sm font-bold">
              i
            </div>
          </button>

          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2 drop-shadow-lg">
              Welcome to Scribbl
            </h1>
            <p className="text-white/80 drop-shadow-md">
              Join a room and start drawing!
            </p>
          </div>

          <div className="space-y-4">
            {/* Name input with glass effect */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-xl rounded-xl border border-white/30 group-focus-within:border-white/50 transition-all duration-300"></div>
              <input
                className={`relative border-0 px-4 py-3 rounded-xl w-full focus:outline-none bg-transparent text-white placeholder-white/60 pl-10 ${
                  nameError ? "animate-shake" : ""
                }`}
                placeholder="Enter your name"
                value={name}
                onChange={handleNameChange}
                onKeyDown={handleKeyDown}
              />
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <span className="text-white/60">{selectedAvatar}</span>
              </div>
              {nameError && (
                <div className="absolute inset-0 bg-red-500/20 backdrop-blur-xl rounded-xl border border-red-400/50 pointer-events-none"></div>
              )}
            </div>

            {/* Avatar Selection - Fixed Layout */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-xl rounded-xl border border-white/30 group-focus-within:border-white/50 transition-all duration-300"></div>
              <div className="relative py-2 px-1">
                <div className="flex justify-center flex-wrap gap-1">
                  {AVATARS.map((avatar) => (
                    <button
                      key={avatar}
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`w-9 h-9 flex items-center justify-center text-lg rounded-lg transition-all duration-300 hover:bg-white/20 ${
                        selectedAvatar === avatar ? "bg-white/30 ring-1 ring-cyan-300" : ""
                      }`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Room ID input with glass effect - only show if no invite room ID */}
            {!inviteRoomId && (
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-xl rounded-xl border border-white/30 group-focus-within:border-white/50 transition-all duration-300"></div>
                <input
                  className="relative border-0 px-4 py-3 rounded-xl w-full focus:outline-none bg-transparent text-white placeholder-white/60 pl-10"
                  placeholder="Room ID (optional)"
                  value={roomIdInput}
                  onChange={handleRoomIdChange}
                  onKeyDown={handleKeyDown}
                />
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <span className="text-white/60">🔑</span>
                </div>
              </div>
            )}

            {inviteRoomId ? (
              <div className="mt-6 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 backdrop-blur-xl rounded-xl border border-blue-400/40"></div>
                <div className="relative p-4">
                  <p className="text-white/90 text-sm text-center drop-shadow-md">
                    You've been invited to join room:{" "}
                    <strong className="text-cyan-300">{inviteRoomId}</strong>
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-8 space-y-3">
              {/* Join button with enhanced glass effect */}
              <button
                onClick={() => handleJoin("play")}
                disabled={!socket || isJoining}
                className="relative w-full group overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/80 to-green-500/80 backdrop-blur-xl border border-emerald-400/50 rounded-xl group-hover:from-emerald-400/90 group-hover:to-green-400/90 transition-all duration-300"></div>
                <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-xl"></div>
                <div className="relative px-6 py-3 text-white font-semibold drop-shadow-lg">
                  {isJoining && joinMode === "play"
                    ? "Joining..."
                    : inviteRoomId
                    ? `Join Room ${inviteRoomId}`
                    : roomIdInput.trim()
                    ? `Join Room ${roomIdInput.trim()}`
                    : "Join Public Game"}
                </div>
              </button>

              {!inviteRoomId && (
                <button
                  onClick={() => handleJoin("create", "private")}
                  disabled={!socket || isJoining}
                  className="relative w-full group overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/80 to-purple-500/80 backdrop-blur-xl border border-blue-400/50 rounded-xl group-hover:from-blue-400/90 group-hover:to-purple-400/90 transition-all duration-300"></div>
                  <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-xl"></div>
                  <div className="relative px-6 py-3 text-white font-semibold drop-shadow-lg">
                    {isJoining && joinMode === "create"
                      ? "Creating..."
                      : "Host Private Game"}
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <InstructionsModal
          isOpen={showInstructions}
          onClose={() => setShowInstructions(false)}
        />
      )}

      {/* Enhanced social links with glass effect */}
      <div className="absolute bottom-4 left-0 right-0 text-center z-10">
        <div className="flex justify-center items-center space-x-6">
          <a
            href="https://www.instagram.com/scribbl.club/"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white/70 hover:text-white hover:bg-white/30 transition-all duration-300 transform hover:scale-110"
            title="Follow us on Instagram"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </a>
          <a
            href="https://x.com/scribblclub"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-full text-white/70 hover:text-white hover:bg-white/30 transition-all duration-300 transform hover:scale-110"
            title="Follow us on Twitter"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
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
    <div className="min-h-screen w-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-violet-900 via-blue-900 to-indigo-900">
      <div className="relative z-10 w-full max-w-md">
        {/* Glass backdrop with enhanced effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent backdrop-blur-2xl rounded-3xl border border-white/30 shadow-2xl"></div>

        {/* Inner highlight border */}
        <div className="absolute inset-[1px] bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl"></div>

        {/* Content container */}
        <div className="relative p-8 rounded-3xl flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
              Loading...
            </h1>
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
          </div>
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
