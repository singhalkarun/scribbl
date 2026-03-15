import React, { useState } from "react";
import { shareGameOverResults } from "@/utils/imageShare";
import { usePlayerStore } from "@/store/usePlayerStore";
import { DoodleAvatar } from "@/components/DoodleAvatar";

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
  const [isSharing, setIsSharing] = useState(false);
  const { playerAvatars } = usePlayerStore();

  if (!isOpen) return null;

  // Filter scores to only include current players (avoid showing "Unknown" for players who left)
  const filteredScores = Object.fromEntries(
    Object.entries(scores).filter(([playerId]) => players[playerId])
  );

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareGameOverResults({
        scores: filteredScores,
        players,
        currentUserId,
        playerAvatars: playerAvatars as unknown as { [key: string]: string },
      });
    } catch (error) {
      console.error("Error sharing:", error);
    } finally {
      setIsSharing(false);
    }
  };

  const entryBg = (index: number) => {
    if (index === 0) return "bg-[#FFEAA7]";
    if (index === 1) return "bg-[#DFE6E9]";
    if (index === 2) return "bg-[#FFDAB9]";
    return "bg-cream";
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 max-w-md w-full animate-fadeIn relative overflow-hidden">
        {/* Rainbow confetti strip at top */}
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{
            background:
              "repeating-linear-gradient(90deg, #FF6B6B 0px 20px, #FFEAA7 20px 40px, #55EFC4 40px 60px, #74B9FF 60px 80px, #A29BFE 80px 100px, #FD79A8 100px 120px)",
          }}
        />

        {/* Bouncing trophy */}
        <div className="text-[56px] animate-bounce text-center mb-2">🏆</div>

        <h2
          className="font-display text-[32px] text-coral text-center"
          style={{ textShadow: "2px 2px 0 #FFB8B8" }}
        >
          Game Over!
        </h2>

        <p className="text-center text-ink/60 text-sm mb-6 mt-1">
          Final Results
        </p>

        <div className="mb-6">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {Object.entries(filteredScores).length > 0 ? (
              Object.entries(filteredScores)
                .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
                .map(([playerId, score], index) => {
                  let medal = "";
                  if (index === 0) medal = "🥇";
                  else if (index === 1) medal = "🥈";
                  else if (index === 2) medal = "🥉";

                  const name = players[playerId] || "Unknown";

                  return (
                    <div
                      key={playerId}
                      className={`${entryBg(index)} border-[2.5px] border-ink rounded-scribbl-md px-3.5 py-2.5 flex items-center gap-3 shadow-scribbl-sm`}
                    >
                      <span className="font-bold text-ink w-6 text-sm shrink-0">
                        {medal || `${index + 1}.`}
                      </span>
                      <DoodleAvatar
                        name={name}
                        seed={playerAvatars[playerId] ?? 0}
                        size={40}
                      />
                      <span
                        className={`font-medium flex-1 truncate text-sm ${
                          playerId === currentUserId
                            ? "text-coral font-bold"
                            : "text-ink"
                        }`}
                      >
                        {name}
                        {playerId === currentUserId ? " (You)" : ""}
                      </span>
                      <span className="text-coral font-extrabold text-sm shrink-0">
                        {score} pts
                      </span>
                    </div>
                  );
                })
            ) : (
              <div className="bg-cream border-[2px] border-ink rounded-scribbl-md text-center py-4">
                <p className="text-ink/70 text-sm">No scores to display</p>
                <p className="text-xs text-ink/50 mt-1">
                  All players may have left the game
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            className="w-full bg-[var(--color-blue)] text-[var(--text-primary)] border-[2.5px] border-ink rounded-scribbl-md py-3 px-4 font-bold shadow-scribbl-sm hover:translate-y-[-2px] hover:shadow-scribbl-md transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            onClick={handleShare}
            disabled={isSharing}
          >
            {isSharing ? "Generating Image..." : "📸 Share"}
          </button>

          <button
            className="w-full bg-[var(--color-green)] text-[var(--text-primary)] border-[2.5px] border-ink rounded-scribbl-md py-3 px-4 font-bold shadow-scribbl-sm hover:translate-y-[-2px] hover:shadow-scribbl-md transition-all duration-150 cursor-pointer"
            onClick={onClose}
          >
            Play Again 🎮
          </button>
        </div>
      </div>
    </div>
  );
}
