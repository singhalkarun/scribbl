import React from "react";
import { PlayerCard } from "@/components/PlayerCard";

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
  };
  isAdmin: boolean;
  onStartGame: () => void;
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
}: LobbyProps) {
  const playerEntries = Object.entries(players);
  const emptySlots = Math.max(0, maxPlayers - playerEntries.length);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
  };

  const shareRoom = () => {
    const url = `${window.location.origin}/join?roomId=${roomId}`;
    if (navigator.share) {
      navigator.share({ title: "Join my Scribbl game!", url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

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

        <div className="bg-[var(--color-yellow)] border-[2.5px] border-ink rounded-scribbl-md px-5 py-3.5 flex items-center justify-between mb-6 shadow-scribbl-md">
          <div>
            <div className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wide">Room Code</div>
            <div className="text-2xl font-extrabold tracking-[6px]">{roomId}</div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={copyRoomCode}
              className="bg-white border-2 border-ink rounded-scribbl-xs px-2.5 py-1.5 text-xs font-bold shadow-scribbl-xs hover:translate-x-px hover:translate-y-px hover:shadow-none transition-all duration-150 flex items-center gap-1"
            >
              📋 Copy
            </button>
            <button
              onClick={shareRoom}
              className="bg-white border-2 border-ink rounded-scribbl-xs px-2.5 py-1.5 text-xs font-bold shadow-scribbl-xs hover:translate-x-px hover:translate-y-px hover:shadow-none transition-all duration-150 flex items-center gap-1"
            >
              🔗 Share
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          {[
            { icon: "🔄", label: "Rounds", value: roomSettings.maxRounds },
            { icon: "⏱️", label: "Time", value: `${roomSettings.turnTime}s` },
            { icon: "👥", label: "Max", value: roomSettings.maxPlayers },
            { icon: "📊", label: "Difficulty", value: roomSettings.difficulty },
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

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-extrabold text-[var(--text-secondary)] uppercase tracking-wide">Players</span>
            <span className="bg-[#E8F5E9] border-2 border-ink rounded-scribbl-xs px-2.5 py-0.5 text-xs font-extrabold shadow-scribbl-xs">
              {playerEntries.length} / {maxPlayers}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
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
