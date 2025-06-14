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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('player-info-storage');
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
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md"></div>

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-red-900/90 to-purple-900/90 backdrop-blur-xl p-8 rounded-xl border border-red-500/30 shadow-2xl max-w-md w-full mx-4 z-10 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white mb-4">
          You have been kicked from the game
        </h2>

        <p className="text-white/80 mb-6">
          The other players have voted to remove you from this game session.
        </p>

        <div className="flex flex-col items-center">
          <button
            onClick={handleGoToJoin}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg transition-colors duration-200 font-medium mb-3"
          >
            Return to Join Page
          </button>
          <p className="text-white/60 text-sm">
            Redirecting in 3 seconds...
          </p>
        </div>
      </div>
    </div>
  );
} 