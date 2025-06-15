import React, { useEffect } from "react";
import { usePlayerStore, KickVoteInfo } from "@/store/usePlayerStore";

interface KickPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVote: (playerId: string) => void;
}

export default function KickPlayerModal({
  isOpen,
  onClose,
  onVote,
}: KickPlayerModalProps) {
  const players = usePlayerStore((state) => state.players);
  const userId = usePlayerStore((state) => state.userId);
  const adminId = usePlayerStore((state) => state.adminId);
  const kickVoteInfoMap = usePlayerStore((state) => state.kickVoteInfoMap);
  
  // Check if any player has been kicked, and close modal if so
  useEffect(() => {
    // Look for any kicked players in the vote info map
    if (kickVoteInfoMap) {
      const kickedPlayer = Object.values(kickVoteInfoMap).find(info => info.kicked);
      if (kickedPlayer) {
        console.log("[KickPlayerModal] Player was kicked, closing modal:", kickedPlayer.target_player_id);
        onClose();
      }
    }
  }, [kickVoteInfoMap, onClose]);
  
  // Filter out current user from the list of players
  const otherPlayers = Object.entries(players).filter(
    ([playerId]) => playerId !== userId
  );
  
  // No need to update target player name anymore since we get it from local state

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-indigo-900/90 to-purple-900/90 backdrop-blur-xl p-6 rounded-xl border border-indigo-500/30 shadow-2xl max-w-md w-full mx-4 z-10">
        <h2 className="text-2xl font-bold text-white mb-4 text-center">
          Vote to Kick Player
        </h2>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-4">
          {otherPlayers.length > 0 ? (
            otherPlayers.map(([playerId, playerName]) => {
              // Get vote info for this player if it exists
              const voteInfo = kickVoteInfoMap?.[playerId];
              const isVoteActive = !!voteInfo;
              
              // Check if the current user has already voted for this player
              const hasVoted = isVoteActive && voteInfo?.voters?.includes(userId);
              
              return (
                <div
                  key={playerId}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-white font-medium">{playerName}</span>
                    {playerId === adminId && (
                      <span className="bg-yellow-500/20 text-yellow-300 text-xs px-2 py-0.5 rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center">
                    {isVoteActive && (
                      <div className="mr-3 text-sm text-white/80">
                        <span className="font-semibold text-indigo-300">
                          {voteInfo.votes_count}/{voteInfo.required_votes}
                        </span> votes
                      </div>
                    )}
                    
                    <button
                      onClick={() => onVote(playerId)}
                      className={`${
                        hasVoted 
                          ? "bg-gray-500/80 cursor-not-allowed" 
                          : "bg-red-500/80 hover:bg-red-600/80"
                      } text-white px-3 py-1 rounded-lg text-sm transition-colors duration-200 flex items-center`}
                      disabled={hasVoted}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {hasVoted ? "Voted" : "Kick"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-white/70 text-center py-4">
              No other players to kick
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-lg transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 