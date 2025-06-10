import React from "react";

interface GameOverModalProps {
  isOpen: boolean;
  onClose: () => void;
  scores: { [key: string]: number };
  players: { [key: string]: string };
  currentUserId: string;
}

export default function GameOverModal({
  isOpen,
  onClose,
  scores,
  players,
  currentUserId,
}: GameOverModalProps) {
  if (!isOpen) return null;

  // Filter scores to only include current players (avoid showing "Unknown" for players who left)
  const filteredScores = Object.fromEntries(
    Object.entries(scores).filter(([playerId]) => players[playerId])
  );

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[1000]">
      {/* Main glass container */}
      <div className="relative w-full max-w-md mx-4">
        {/* Glass backdrop with enhanced effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent backdrop-blur-2xl rounded-3xl border border-white/30 shadow-2xl"></div>

        {/* Inner highlight border */}
        <div className="absolute inset-[1px] bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl"></div>

        {/* Content container */}
        <div className="relative p-6 rounded-3xl text-center animate-fadeIn">
          {/* Trophy icon */}
          <div className="absolute -top-6 left-0 right-0 flex justify-center">
            <div className="animate-bounce">
              <span className="text-5xl">🏆</span>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mt-4 mb-2 drop-shadow-lg">
            Game Over!
          </h2>
          <p className="text-white/80 mb-6 drop-shadow-md">Final Results</p>

          <div className="mb-6">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(filteredScores).length > 0 ? (
                Object.entries(filteredScores)
                  .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
                  .map(([playerId, score], index) => {
                    // Determine medal emoji
                    let medal = "";
                    if (index === 0) medal = "🥇";
                    else if (index === 1) medal = "🥈";
                    else if (index === 2) medal = "🥉";

                    return (
                      <div key={playerId} className="relative transition-all">
                        {/* Score item glass backdrop */}
                        <div
                          className={`absolute inset-0 backdrop-blur-md border rounded-lg transition-all duration-300 ${
                            index === 0
                              ? "bg-yellow-500/30 border-yellow-400/50"
                              : index === 1
                              ? "bg-gray-400/30 border-gray-300/50"
                              : index === 2
                              ? "bg-amber-500/30 border-amber-400/50"
                              : "bg-white/10 border-white/20"
                          } ${index < 3 ? "animate-pulse-slow" : ""}`}
                        ></div>

                        {/* Score item content */}
                        <div className="relative flex items-center justify-between p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white/90 w-8 drop-shadow-md">
                              {medal || `${index + 1}.`}
                            </span>
                            <span
                              className={`font-medium drop-shadow-md ${
                                playerId === currentUserId
                                  ? "text-cyan-300 font-bold"
                                  : "text-white/90"
                              }`}
                            >
                              {players[playerId] || "Unknown"}
                              {playerId === currentUserId ? " (You)" : ""}
                            </span>
                          </div>
                          <span className="font-bold text-cyan-300 drop-shadow-md">
                            {score} pts
                          </span>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="relative text-center py-4">
                  <div className="absolute inset-0 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg"></div>
                  <div className="relative">
                    <p className="text-white/70 drop-shadow-md">
                      No scores to display
                    </p>
                    <p className="text-sm text-white/60 drop-shadow-md">
                      All players may have left the game
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 -top-2 text-3xl animate-spin-slow">
              🎨
            </div>
            <div className="absolute -right-8 -top-2 text-3xl animate-spin-slow">
              ✏️
            </div>

            {/* Play Again button with glass effect */}
            <button
              className="relative w-full group overflow-hidden rounded-xl transition-all duration-300 hover:cursor-pointer"
              onClick={onClose}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/80 to-purple-500/80 backdrop-blur-xl border border-indigo-400/50 rounded-xl group-hover:from-indigo-400/90 group-hover:to-purple-400/90 transition-all duration-300"></div>
              <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-xl"></div>
              <div className="relative py-3 px-4 text-white font-semibold drop-shadow-lg">
                Play Again
              </div>
            </button>

            {/* For development/preview only - remove in production */}
            {process.env.NODE_ENV === "development" && (
              <button
                className="relative w-full group overflow-hidden rounded-xl transition-all duration-300 hover:cursor-pointer mt-4"
                onClick={() => {
                  // This is a no-op in the component - parent must handle via onClose
                  console.log("[GameOverModal] Preview close button clicked");
                  onClose();
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-gray-500/80 to-gray-600/80 backdrop-blur-xl border border-gray-400/50 rounded-xl group-hover:from-gray-400/90 group-hover:to-gray-500/90 transition-all duration-300"></div>
                <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-xl"></div>
                <div className="relative py-2 px-4 text-white font-semibold drop-shadow-lg">
                  Close Preview
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
