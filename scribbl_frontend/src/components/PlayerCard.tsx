import React from "react";
import { DoodleAvatar } from "@/components/DoodleAvatar";

interface PlayerCardProps {
  name: string;
  avatarSeed: number;
  isAdmin?: boolean;
  isYou?: boolean;
  isEmpty?: boolean;
}

export function PlayerCard({ name, avatarSeed, isAdmin, isYou, isEmpty }: PlayerCardProps) {
  if (isEmpty) {
    return (
      <div className="border-[2.5px] border-dashed border-[var(--text-disabled)] rounded-scribbl-md p-3.5 flex flex-col items-center justify-center gap-1.5 min-h-[100px]">
        <span className="text-2xl opacity-30">👤</span>
        <span className="text-[11px] text-[var(--text-disabled)] font-bold">Waiting...</span>
      </div>
    );
  }

  return (
    <div
      className={`border-[2.5px] border-ink rounded-scribbl-md p-3.5 flex flex-col items-center gap-1.5 shadow-scribbl-sm transition-transform duration-150 odd:-rotate-[1deg] even:rotate-[0.5deg] ${
        isYou ? "bg-[#D5F5E3] border-[#27ae60]" : "bg-cream"
      }`}
    >
      <DoodleAvatar name={name} seed={avatarSeed} size={48} className="rounded-scribbl-md border-[2.5px] border-ink" />
      <span className="text-sm font-extrabold text-center max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
        {name}
      </span>
      <div className="flex gap-1">
        {isAdmin && (
          <span className="bg-[var(--color-yellow)] border-[1.5px] border-ink rounded-[6px] px-1.5 py-px text-[9px] font-extrabold uppercase shadow-scribbl-xs">
            Admin
          </span>
        )}
        {isYou && (
          <span className="bg-[var(--color-green)] border-[1.5px] border-ink rounded-[6px] px-1.5 py-px text-[9px] font-extrabold uppercase shadow-scribbl-xs">
            You
          </span>
        )}
      </div>
    </div>
  );
}
