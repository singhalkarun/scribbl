import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/store/usePlayerStore";

export default function KickedModal() {
  const router = useRouter();
  const setPlayerKicked = usePlayerStore((state) => state.setPlayerKicked);
  const setRoomId = usePlayerStore((state) => state.setRoomId);
  const clearPlayerInfo = usePlayerStore((state) => state.clearPlayerInfo);

  // Automatically redirect to join page after 3 seconds and ensure player info is cleared
  useEffect(() => {
    // Clear player info immediately to prevent auto-rejoin
    clearPlayerInfo();

    // Force clear localStorage to ensure player can't rejoin
    if (typeof window !== "undefined") {
      localStorage.removeItem("player-info-storage");
    }

    const redirectTimer = setTimeout(() => {
      handleGoToJoin();
    }, 3000);

    return () => clearTimeout(redirectTimer);
  }, []);

  const handleGoToJoin = () => {
    // Reset the kicked status before redirecting
    setPlayerKicked(false);

    // Make sure player info is cleared to prevent auto-rejoining
    // This is a second call in case the first one in useEffect didn't work
    clearPlayerInfo();

    // Navigate to join page
    router.push("/join");
  };

  return (
    <div className="fixed inset-0 bg-cream z-50 flex items-center justify-center p-6">
      <div className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 max-w-sm w-full text-center animate-fadeIn">
        <div className="text-[56px] mb-2">👋</div>

        <h2
          className="font-display text-2xl text-coral mb-3"
          style={{ textShadow: "2px 2px 0 #FFB8B8" }}
        >
          You&apos;ve Been Kicked! 👋
        </h2>

        <p className="text-ink/70 text-sm mb-6">
          The other players have voted to remove you from this game session.
        </p>

        {/* Countdown progress bar */}
        <div className="mb-5">
          <p className="text-ink/60 text-xs mb-2">Redirecting in 3 seconds…</p>
          <div className="h-2 bg-ink/10 rounded-full overflow-hidden border border-ink/20">
            <div className="h-full bg-coral rounded-full animate-shrink origin-left" />
          </div>
        </div>

        <button
          onClick={handleGoToJoin}
          className="bg-[var(--color-green)] text-[var(--text-primary)] border-[2.5px] border-ink rounded-scribbl-md px-6 py-3 font-bold shadow-scribbl-sm hover:translate-y-[-2px] hover:shadow-scribbl-md transition-all duration-150 cursor-pointer"
        >
          Return to Join Page
        </button>
      </div>
    </div>
  );
}
