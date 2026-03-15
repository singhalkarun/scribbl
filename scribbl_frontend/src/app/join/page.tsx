"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePlayerStore } from "@/store/usePlayerStore";
import { LandingPage } from "@/components/LandingPage";
import { JoinCard } from "@/components/JoinCard";

type View = "landing" | "play" | "host" | "join";

function JoinPageContent() {
  const [view, setView] = useState<View>("landing");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const router = useRouter();
  const searchParams = useSearchParams();
  const socket = usePlayerStore((s) => s.socket);
  const setPlayerName = usePlayerStore((s) => s.setPlayerName);
  const setRoomIdGlobal = usePlayerStore((s) => s.setRoomId);
  const setAvatar = usePlayerStore((s) => s.setAvatar);
  const setPlayerKicked = usePlayerStore((s) => s.setPlayerKicked);

  // Reset kicked status and ensure we have a clean state when joining page is loaded
  useEffect(() => {
    // Reset kicked status
    setPlayerKicked(false);

    // Clear any existing room ID to prevent auto-joining previous room
    const currentRoomId = usePlayerStore.getState().roomId;
    if (currentRoomId) {
      console.log("[JoinPage] Clearing previous room ID to prevent auto-join:", currentRoomId);
      usePlayerStore.getState().clearPlayerInfo();
    }
  }, [setPlayerKicked]);

  // Check if there's a room ID in URL params (from invite link)
  const inviteRoomId = searchParams.get("roomId");

  // If there's an invite room ID, go directly to the join view
  useEffect(() => {
    if (inviteRoomId) {
      setView("join");
    }
  }, [inviteRoomId]);

  const handleJoin = async (
    mode: "public" | "private" | "join",
    playerName: string,
    avatarSeed: number,
    roomId?: string
  ) => {
    if (!socket) {
      console.error("Socket not ready");
      return;
    }
    if (!playerName.trim()) {
      setError("Please enter your name");
      return;
    }

    setIsJoining(true);
    setError(undefined);

    try {
      let finalRoomId = "";

      if (mode === "public") {
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
            return;
          }
        } else {
          console.error("Failed to join random room");
          setIsJoining(false);
          return;
        }
      } else if (mode === "private") {
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
          return;
        }

        // Store room type so it can be accessed when joining the room
        sessionStorage.setItem("roomType", "private");
      } else if (mode === "join") {
        // Use the provided roomId directly
        finalRoomId = roomId || "";
      }

      if (!finalRoomId) {
        console.error("No room ID available");
        setError("No room ID provided");
        setIsJoining(false);
        return;
      }

      console.log(
        `[JoinPage] Setting player name: ${playerName.trim()}, room ID: ${finalRoomId}, and avatar seed: ${avatarSeed}`
      );
      setPlayerName(playerName.trim());
      setRoomIdGlobal(finalRoomId);
      setAvatar(avatarSeed);

      console.log("[JoinPage] Navigating to /game");
      router.push("/game");
    } catch (error) {
      console.error("Error joining room:", error);
      setIsJoining(false);
    }
  };

  const handleSubmit = (data: {
    name: string;
    avatarSeed: number;
    roomCode?: string;
  }) => {
    if (view === "play") {
      handleJoin("public", data.name, data.avatarSeed);
    } else if (view === "host") {
      handleJoin("private", data.name, data.avatarSeed);
    } else if (view === "join") {
      handleJoin("join", data.name, data.avatarSeed, data.roomCode);
    }
  };

  return (
    <div
      className="min-h-[100svh] w-screen bg-cream relative overflow-hidden select-none"
      style={{
        cursor: "url('/cursor.png') 0 0, auto",
      }}
    >
      {view === "landing" ? (
        <LandingPage
          onPlayNow={() => setView("play")}
          onHostGame={() => setView("host")}
          onJoinRoom={() => setView("join")}
        />
      ) : (
        <div className="min-h-[100svh] flex flex-col items-center justify-center px-6 py-10">
          <JoinCard
            variant={view}
            inviteRoomId={inviteRoomId || undefined}
            onSubmit={handleSubmit}
            onBack={() => setView("landing")}
            isLoading={isJoining || !socket}
            error={error}
          />
        </div>
      )}
    </div>
  );
}

// Loading fallback component
function LoadingJoinPage() {
  return (
    <div className="min-h-[100svh] w-screen flex flex-col justify-center items-center p-4 bg-cream">
      <div className="text-center">
        <h1 className="font-display text-4xl text-coral mb-4">Loading...</h1>
        <div className="w-8 h-8 border-[3px] border-ink/20 border-t-ink rounded-full animate-spin mx-auto"></div>
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
