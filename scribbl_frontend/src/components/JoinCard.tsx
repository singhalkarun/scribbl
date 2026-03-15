import React, { useState } from "react";
import { DoodleAvatar } from "@/components/DoodleAvatar";

interface JoinCardProps {
  variant: "play" | "host" | "join";
  initialName?: string;
  initialAvatarSeed?: number;
  inviteRoomId?: string;
  onSubmit: (data: {
    name: string;
    avatarSeed: number;
    roomCode?: string;
    settings?: { rounds: number; drawTime: number; maxPlayers: number; difficulty: string };
  }) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
}

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Mix"];

export function JoinCard({
  variant,
  initialName = "",
  initialAvatarSeed = 0,
  inviteRoomId,
  onSubmit,
  onBack,
  isLoading = false,
  error,
}: JoinCardProps) {
  const [name, setName] = useState(initialName);
  const [avatarSeed, setAvatarSeed] = useState(initialAvatarSeed);
  const [roomCode, setRoomCode] = useState(inviteRoomId || "");
  const [rounds, setRounds] = useState(3);
  const [drawTime, setDrawTime] = useState(80);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [difficultyIdx, setDifficultyIdx] = useState(3);

  const titles = { play: "Jump In! ✏️", host: "Host a Game 🏠", join: "Join a Room 🔗" };
  const subtitles = {
    play: "Pick a name and join a public game instantly",
    host: "Create a private room and invite friends",
    join: "Enter the room code shared by your friend",
  };
  const ctaLabels = { play: "Play Now ✏️", host: "Create Room 🏠", join: "Join Room 🔗" };
  const ctaColors = {
    play: "bg-[var(--color-green)]",
    host: "bg-[var(--color-blue)]",
    join: "bg-[var(--color-yellow)]",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      avatarSeed,
      roomCode: variant === "join" ? roomCode : undefined,
      settings: variant === "host" ? { rounds, drawTime, maxPlayers, difficulty: DIFFICULTIES[difficultyIdx] } : undefined,
    });
  };

  return (
    <div className="w-full max-w-[420px] mx-auto">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 bg-white border-[2.5px] border-ink rounded-scribbl-sm px-3.5 py-1.5 text-[13px] font-bold shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 mb-5"
      >
        ← Back
      </button>

      <form
        onSubmit={handleSubmit}
        className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 relative"
      >
        <div className="absolute -top-3 right-5 text-[22px] rotate-12">📌</div>

        <h2 className="font-display text-[28px] text-coral mb-1" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>
          {titles[variant]}
        </h2>
        <p className="text-[13px] text-[var(--text-placeholder)] mb-6">{subtitles[variant]}</p>

        <div className="mb-5">
          <label className="block text-[13px] font-extrabold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={20}
            className={`w-full bg-cream border-[2.5px] border-ink rounded-[12px] px-3.5 py-2.5 text-[15px] font-semibold shadow-[2px_2px_0_#ddd] outline-none transition-all duration-150 focus:border-[var(--color-blue)] focus:shadow-[2px_2px_0_var(--color-blue)] focus:bg-white placeholder:text-[var(--text-disabled)] ${error ? "border-[#e74c3c] animate-shake" : ""}`}
          />
          {error && <p className="text-[#e74c3c] text-xs font-bold mt-1">{error}</p>}
        </div>

        <div className="mb-6">
          <label className="block text-[13px] font-extrabold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide">
            Your Avatar
          </label>
          <div className="flex items-center gap-4 bg-cream border-[2.5px] border-ink rounded-scribbl-md p-3 shadow-[2px_2px_0_#ddd]">
            <DoodleAvatar
              name={name || "Player"}
              seed={avatarSeed}
              size={64}
              className="rounded-scribbl-md border-[3px] border-ink flex-shrink-0"
            />
            <div className="flex-1">
              <div className="font-extrabold text-sm">Doodle Avatar</div>
              <div className="text-[11px] text-[var(--text-placeholder)]">Auto-generated from your name</div>
            </div>
            <button
              type="button"
              onClick={() => setAvatarSeed((s) => s + 1)}
              className="bg-white border-2 border-ink rounded-scribbl-xs px-2 py-1 text-sm shadow-scribbl-xs hover:translate-x-px hover:translate-y-px hover:shadow-none transition-all duration-150"
            >
              🔄
            </button>
          </div>
        </div>

        {variant === "host" && (
          <>
            <div className="flex items-center gap-3 my-5 text-[var(--text-disabled)] text-xs font-bold">
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
              ROOM SETTINGS
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {[
                { label: "Rounds", value: rounds, set: setRounds, min: 1, max: 10, display: `${rounds}` },
                { label: "Draw Time", value: drawTime, set: setDrawTime, min: 15, max: 240, step: 5, display: `${drawTime}s` },
                { label: "Max Players", value: maxPlayers, set: setMaxPlayers, min: 2, max: 20, display: `${maxPlayers}` },
                { label: "Difficulty", value: difficultyIdx, set: setDifficultyIdx, min: 0, max: 3, display: DIFFICULTIES[difficultyIdx] },
              ].map((s) => (
                <div key={s.label} className="bg-cream border-2 border-ink rounded-scribbl-sm p-2.5 shadow-scribbl-xs">
                  <div className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase mb-1.5">{s.label}</div>
                  <div className="flex items-center gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => s.set(Math.max(s.min, s.value - (s.step || 1)) as never)}
                      className="w-7 h-7 rounded-scribbl-xs border-2 border-ink bg-white text-base font-extrabold flex items-center justify-center shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors"
                    >
                      −
                    </button>
                    <span className="text-lg font-extrabold min-w-[30px] text-center">{s.display}</span>
                    <button
                      type="button"
                      onClick={() => s.set(Math.min(s.max, s.value + (s.step || 1)) as never)}
                      className="w-7 h-7 rounded-scribbl-xs border-2 border-ink bg-white text-base font-extrabold flex items-center justify-center shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {variant === "join" && (
          <>
            <div className="flex items-center gap-3 my-5 text-[var(--text-disabled)] text-xs font-bold">
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
              ROOM CODE
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
            </div>
            {inviteRoomId && (
              <div className="bg-[#E8F5E9] border-[2.5px] border-ink rounded-[12px] px-4 py-3 flex items-center gap-2.5 mb-4 shadow-scribbl-sm">
                <span className="text-xl">🎉</span>
                <span className="text-[13px] font-semibold">
                  You&apos;ve been invited to a room
                </span>
              </div>
            )}
            <div className="mb-4">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={10}
                className="w-full bg-cream border-[2.5px] border-ink rounded-[12px] px-3.5 py-2.5 text-xl font-extrabold text-center uppercase tracking-[4px] shadow-[2px_2px_0_#ddd] outline-none transition-all duration-150 focus:border-[var(--color-blue)] focus:shadow-[2px_2px_0_var(--color-blue)] focus:bg-white placeholder:text-[var(--text-disabled)]"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className={`w-full font-extrabold text-lg py-3.5 rounded-scribbl-md border-[3px] border-ink ${ctaColors[variant]} text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2`}
        >
          {isLoading ? "Loading..." : ctaLabels[variant]}
        </button>
      </form>
    </div>
  );
}
