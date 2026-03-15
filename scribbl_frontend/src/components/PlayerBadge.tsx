import React from "react";
import { DoodleAvatar } from "@/components/DoodleAvatar";

interface PlayerBadgeProps {
  name: string;
  avatarSeed: number;
  score: number;
  isDrawing?: boolean;
  hasGuessed?: boolean;
  className?: string;
}

export function PlayerBadge({
  name,
  avatarSeed,
  score,
  isDrawing = false,
  hasGuessed = false,
  className = "",
}: PlayerBadgeProps) {
  const bgClass = isDrawing
    ? "bg-[var(--color-yellow)]"
    : hasGuessed
      ? "bg-[#D5F5E3]"
      : "bg-white";

  return (
    <div
      className={`flex items-center gap-1.5 ${bgClass} border-[2.5px] border-ink rounded-[12px] px-3 py-[5px] text-[13px] font-bold shadow-scribbl-sm whitespace-nowrap flex-shrink-0 transition-transform duration-150 odd:-rotate-[0.5deg] even:rotate-[0.5deg] ${className}`}
    >
      <DoodleAvatar name={name} seed={avatarSeed} size={28} className="rounded-[8px] border-2 border-ink flex-shrink-0" />
      <span>{name}</span>
      {isDrawing && <span className="text-xs">✏️</span>}
      {hasGuessed && <span className="text-[#27ae60] text-xs">✓</span>}
      <span className="text-[var(--text-muted)] font-semibold text-xs">{score}</span>
    </div>
  );
}
