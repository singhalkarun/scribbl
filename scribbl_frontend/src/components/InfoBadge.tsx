import React from "react";

interface InfoBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "round" | "word" | "timer" | "timer-warning";
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: "bg-white",
  round: "bg-[#E8F5E9]",
  word: "bg-[var(--color-yellow)] text-base tracking-[4px] font-extrabold px-5",
  timer: "bg-[#FFDDDD] text-[#e74c3c] min-w-[54px] text-center",
  "timer-warning": "bg-[#FFDDDD] text-[#e74c3c] min-w-[54px] text-center animate-shake",
};

export function InfoBadge({ children, variant = "default", className = "" }: InfoBadgeProps) {
  return (
    <div
      className={`border-[2.5px] border-ink rounded-scribbl-sm px-3.5 py-1 text-[13px] font-bold shadow-scribbl-sm ${variantStyles[variant]} ${className}`}
    >
      {children}
    </div>
  );
}
