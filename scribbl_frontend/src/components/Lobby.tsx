import React, { useState } from "react";
import { PlayerCard } from "@/components/PlayerCard";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

interface LobbyProps {
  roomId: string;
  players: { [userId: string]: string };
  playerAvatars: { [userId: string]: number };
  adminId: string;
  userId: string;
  maxPlayers: number;
  roomSettings: {
    maxRounds: string;
    turnTime: string;
    maxPlayers: string;
    difficulty: string;
    hintsAllowed: string;
    roomType: string;
  };
  isAdmin: boolean;
  onStartGame: () => void;
  onUpdateSettings?: (settings: {
    maxPlayers: string;
    maxRounds: string;
    turnTime: string;
    hintsAllowed: string;
    difficulty: string;
    roomType: string;
  }) => void;
}

export function Lobby({
  roomId,
  players,
  playerAvatars,
  adminId,
  userId,
  maxPlayers,
  roomSettings,
  isAdmin,
  onStartGame,
  onUpdateSettings,
}: LobbyProps) {
  const playerEntries = Object.entries(players);
  const emptySlots = Math.max(0, maxPlayers - playerEntries.length);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const showCopyFeedback = (text: string) => {
    setCopyFeedback(text);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId).then(
      () => showCopyFeedback("Copied!"),
      () => showCopyFeedback("Failed to copy")
    );
  };

  const shareRoom = () => {
    const url = `${window.location.origin}/join?roomId=${roomId}`;
    if (navigator.share) {
      navigator.share({ title: "Join my Scribbl game!", url });
    } else {
      navigator.clipboard.writeText(url).then(
        () => showCopyFeedback("Link copied!"),
        () => showCopyFeedback("Failed to copy")
      );
    }
  };

  const updateSetting = (key: string, value: string) => {
    if (onUpdateSettings) {
      onUpdateSettings({ ...roomSettings, [key]: value });
    }
  };

  const currentDifficultyIdx = DIFFICULTIES.indexOf(
    roomSettings.difficulty as (typeof DIFFICULTIES)[number]
  );

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-[560px] bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 relative">
        <div className="absolute -top-3 right-5 text-[22px] rotate-12">📌</div>

        <div className="text-center mb-6">
          <h2 className="font-display text-[28px] text-coral" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>
            Waiting Room <span className="inline-block animate-bounce">✏️</span>
          </h2>
          <p className="text-[13px] text-[var(--text-placeholder)] mt-0.5">Hang tight! The game will start soon</p>
        </div>

        <div className="bg-[var(--color-yellow)] border-[2.5px] border-ink rounded-scribbl-md px-5 py-3.5 flex items-center justify-between mb-8 shadow-scribbl-md relative">
          <div>
            <div className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wide">Room Code</div>
            <div className="text-2xl font-extrabold tracking-[6px]">{roomId}</div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={copyRoomCode}
              className="bg-white border-2 border-ink rounded-scribbl-xs px-2.5 py-1.5 text-xs font-bold shadow-scribbl-xs hover:translate-x-px hover:translate-y-px hover:shadow-none transition-all duration-150 flex items-center gap-1"
            >
              {copyFeedback === "Copied!" ? "✅ Copied" : "📋 Copy"}
            </button>
            <button
              onClick={shareRoom}
              className="bg-white border-2 border-ink rounded-scribbl-xs px-2.5 py-1.5 text-xs font-bold shadow-scribbl-xs hover:translate-x-px hover:translate-y-px hover:shadow-none transition-all duration-150 flex items-center gap-1"
            >
              🔗 Share
            </button>
          </div>
          {copyFeedback && (
            <div className="absolute -bottom-7 right-0 bg-ink text-white text-xs font-bold px-3 py-1 rounded-scribbl-xs shadow-scribbl-sm animate-[fadeIn_0.15s_ease-out]">
              {copyFeedback}
            </div>
          )}
        </div>

        {isAdmin && onUpdateSettings ? (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3 text-[var(--text-disabled)] text-xs font-bold">
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
              ROOM SETTINGS
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  label: "Rounds",
                  icon: "🔄",
                  value: parseInt(roomSettings.maxRounds) || 3,
                  min: 1,
                  max: 10,
                  step: 1,
                  display: roomSettings.maxRounds,
                  key: "maxRounds",
                },
                {
                  label: "Draw Time",
                  icon: "⏱️",
                  value: parseInt(roomSettings.turnTime) || 60,
                  min: 30,
                  max: 240,
                  step: 5,
                  display: `${roomSettings.turnTime}s`,
                  key: "turnTime",
                },
                {
                  label: "Max Players",
                  icon: "👥",
                  value: parseInt(roomSettings.maxPlayers) || 8,
                  min: Math.max(2, playerEntries.length),
                  max: 20,
                  step: 1,
                  display: roomSettings.maxPlayers,
                  key: "maxPlayers",
                },
              ].map((s) => (
                <div key={s.label} className="bg-cream border-2 border-ink rounded-scribbl-sm p-2.5 shadow-scribbl-xs">
                  <div className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase mb-1.5 flex items-center gap-1">
                    <span className="text-sm">{s.icon}</span> {s.label}
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        const newVal = Math.max(s.min, s.value - s.step);
                        updateSetting(s.key, String(newVal));
                      }}
                      disabled={s.value <= s.min}
                      className="w-7 h-7 rounded-scribbl-xs border-2 border-ink bg-white text-base font-extrabold flex items-center justify-center shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      −
                    </button>
                    <span className="text-lg font-extrabold min-w-[30px] text-center">{s.display}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newVal = Math.min(s.max, s.value + s.step);
                        updateSetting(s.key, String(newVal));
                      }}
                      disabled={s.value >= s.max}
                      className="w-7 h-7 rounded-scribbl-xs border-2 border-ink bg-white text-base font-extrabold flex items-center justify-center shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {/* Difficulty - cycles through options */}
              <div className="bg-cream border-2 border-ink rounded-scribbl-sm p-2.5 shadow-scribbl-xs">
                <div className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase mb-1.5 flex items-center gap-1">
                  <span className="text-sm">📊</span> Difficulty
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = currentDifficultyIdx <= 0 ? DIFFICULTIES.length - 1 : currentDifficultyIdx - 1;
                      updateSetting("difficulty", DIFFICULTIES[idx]);
                    }}
                    className="w-7 h-7 rounded-scribbl-xs border-2 border-ink bg-white text-base font-extrabold flex items-center justify-center shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors"
                  >
                    −
                  </button>
                  <span className="text-lg font-extrabold min-w-[55px] text-center capitalize">
                    {DIFFICULTY_LABELS[roomSettings.difficulty] || roomSettings.difficulty}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const idx = currentDifficultyIdx >= DIFFICULTIES.length - 1 ? 0 : currentDifficultyIdx + 1;
                      updateSetting("difficulty", DIFFICULTIES[idx]);
                    }}
                    className="w-7 h-7 rounded-scribbl-xs border-2 border-ink bg-white text-base font-extrabold flex items-center justify-center shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap mb-6">
            {[
              { icon: "🔄", label: "Rounds", value: roomSettings.maxRounds },
              { icon: "⏱️", label: "Time", value: `${roomSettings.turnTime}s` },
              { icon: "👥", label: "Max", value: roomSettings.maxPlayers },
              { icon: "📊", label: "Difficulty", value: DIFFICULTY_LABELS[roomSettings.difficulty] || roomSettings.difficulty },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white border-2 border-ink rounded-scribbl-sm px-3 py-1 text-xs font-bold shadow-scribbl-xs flex items-center gap-1"
              >
                <span className="text-sm">{s.icon}</span>
                {s.label}: <span className="text-coral">{s.value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-extrabold text-[var(--text-secondary)] uppercase tracking-wide">Players</span>
            <span className="bg-[#E8F5E9] border-2 border-ink rounded-scribbl-xs px-2.5 py-0.5 text-xs font-extrabold shadow-scribbl-xs">
              {playerEntries.length} / {maxPlayers}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
            {playerEntries.map(([uid, name]) => (
              <PlayerCard
                key={uid}
                name={name}
                avatarSeed={playerAvatars[uid] ?? 0}
                isAdmin={uid === adminId}
                isYou={uid === userId}
              />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <PlayerCard key={`empty-${i}`} name="" avatarSeed={0} isEmpty />
            ))}
          </div>
        </div>

        {isAdmin ? (
          <button
            onClick={onStartGame}
            disabled={playerEntries.length < 2}
            className="w-full font-extrabold text-xl py-4 rounded-scribbl-md border-[3px] border-ink bg-[var(--color-green)] text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Game! 🎮
          </button>
        ) : (
          <div className="text-center py-3.5 bg-cream border-[2.5px] border-dashed border-[var(--text-disabled)] rounded-scribbl-md text-sm font-bold text-[var(--text-placeholder)]">
            Waiting for the host to start...
          </div>
        )}
      </div>
    </div>
  );
}
