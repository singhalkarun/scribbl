import React, { useEffect } from "react";
import { usePlayerStore, KickVoteInfo } from "@/store/usePlayerStore";
import { DoodleAvatar } from "@/components/DoodleAvatar";

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
  const playerAvatars = usePlayerStore((state) => state.playerAvatars);

  // Check if any player has been kicked, and close modal if so
  useEffect(() => {
    // Look for any kicked players in the vote info map
    if (kickVoteInfoMap) {
      const kickedPlayer = Object.values(kickVoteInfoMap).find(
        (info) => info.kicked
      );
      if (kickedPlayer) {
        console.log(
          "[KickPlayerModal] Player was kicked, closing modal:",
          kickedPlayer.target_player_id
        );
        onClose();
      }
    }
  }, [kickVoteInfoMap, onClose]);

  // Filter out current user from the list of players
  const otherPlayers = Object.entries(players).filter(
    ([playerId]) => playerId !== userId
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal */}
      <div className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 max-w-[400px] w-full animate-fadeIn relative">
        <h2
          className="font-display text-2xl text-coral text-center mb-5"
          style={{ textShadow: "2px 2px 0 #FFB8B8" }}
        >
          Vote to Kick
        </h2>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-5">
          {otherPlayers.length > 0 ? (
            otherPlayers.map(([playerId, playerName]) => {
              const voteInfo = kickVoteInfoMap?.[playerId];
              const isVoteActive = !!voteInfo;
              const hasVoted =
                isVoteActive && voteInfo?.voters?.includes(userId);

              return (
                <div
                  key={playerId}
                  className="bg-cream border-[2.5px] border-ink rounded-scribbl-md px-3 py-2 flex items-center gap-3 shadow-scribbl-xs"
                >
                  <DoodleAvatar
                    name={playerName}
                    seed={playerAvatars[playerId] ?? 0}
                    size={36}
                  />

                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-ink font-medium text-sm truncate">
                      {playerName}
                    </span>
                    {playerId === adminId && (
                      <span className="bg-[var(--color-yellow)] border-[1.5px] border-ink rounded-[6px] px-1.5 text-[9px] font-extrabold uppercase shrink-0">
                        Admin
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isVoteActive && (
                      <span className="text-xs text-ink/70 font-semibold">
                        {voteInfo.votes_count}/{voteInfo.required_votes}
                      </span>
                    )}

                    <button
                      onClick={() => onVote(playerId)}
                      className={`bg-coral text-[var(--text-primary)] border-[2px] border-ink rounded-scribbl-xs px-3 py-1 text-xs font-bold shadow-scribbl-xs transition-opacity duration-150 ${
                        hasVoted
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer hover:opacity-90"
                      }`}
                      disabled={hasVoted}
                    >
                      {hasVoted ? "Voted" : "Kick"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-ink/60 text-center py-4 text-sm">
              No other players to kick
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="bg-cream border-[2px] border-ink rounded-scribbl-md px-5 py-2 text-ink font-bold text-sm shadow-scribbl-xs hover:translate-y-[-1px] hover:shadow-scribbl-sm transition-all duration-150 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
