import React from "react";

interface GameOverModalProps {
  isOpen: boolean;
  onStartNewGame: () => void;
  scores: { [key: string]: number };
  players: { [key: string]: string };
  currentUserId: string;
  minPlayersRequired: number;
}

export default function GameOverModal({
  isOpen,
  onStartNewGame,
  scores,
  players,
  currentUserId,
  minPlayersRequired = 2,
}: GameOverModalProps) {
  if (!isOpen) return null;

  // Get the number of players
  const playerCount = Object.keys(players).length;
  const canStartNewGame = playerCount >= minPlayersRequired;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000]">
      <div className="bg-white rounded-xl p-6 shadow-2xl text-center max-w-md w-full mx-4 animate-fadeIn relative">
        {/* Trophy icon */}
        <div className="absolute -top-6 left-0 right-0 flex justify-center">
          <div className="animate-bounce">
            <span className="text-5xl">🏆</span>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-indigo-700 mt-4 mb-2">
          Game Over!
        </h2>
        <p className="text-gray-600 mb-6">Final Results</p>

        <div className="mb-6">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {Object.entries(scores)
              .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
              .map(([playerId, score], index) => {
                // Determine medal emoji
                let medal = "";
                if (index === 0) medal = "🥇";
                else if (index === 1) medal = "🥈";
                else if (index === 2) medal = "🥉";

                return (
                  <div
                    key={playerId}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0
                        ? "bg-yellow-100 border border-yellow-300"
                        : index === 1
                        ? "bg-gray-100 border border-gray-300"
                        : index === 2
                        ? "bg-amber-50 border border-amber-200"
                        : "bg-white border border-gray-100"
                    } transition-all hover:shadow-md ${
                      index < 3 ? "animate-pulse-slow" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-700 w-8">
                        {medal || `${index + 1}.`}
                      </span>
                      <span
                        className={`font-medium ${
                          playerId === currentUserId
                            ? "text-indigo-600 font-bold"
                            : ""
                        }`}
                      >
                        {players[playerId] || "Unknown"}
                        {playerId === currentUserId ? " (You)" : ""}
                      </span>
                    </div>
                    <span className="font-bold text-indigo-600">
                      {score} pts
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-8 -top-2 text-3xl animate-spin-slow">
            🎨
          </div>
          <div className="absolute -right-8 -top-2 text-3xl animate-spin-slow">
            ✏️
          </div>
          <button
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white ${
              canStartNewGame
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-gray-400 cursor-not-allowed"
            } transition-colors`}
            onClick={onStartNewGame}
            disabled={!canStartNewGame}
          >
            Start New Game
          </button>
          {!canStartNewGame && (
            <p className="text-xs text-red-500 mt-2">
              Need at least {minPlayersRequired} players to start
            </p>
          )}

          {/* For development/preview only - remove in production */}
          {process.env.NODE_ENV === "development" && (
            <button
              className="mt-4 w-full py-2 px-4 rounded-lg font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors border border-gray-300"
              onClick={() => {
                // This is a no-op in the component - parent must handle via onStartNewGame
                console.log("[GameOverModal] Preview close button clicked");
                onStartNewGame();
              }}
            >
              Close Preview
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
