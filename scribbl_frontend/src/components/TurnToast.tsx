import React from "react";

interface TurnToastProps {
  reason: "all_guessed" | "timeout" | "drawer_left";
  word: string;
  countdown: number;
}

const REASON_CONFIG = {
  all_guessed: { icon: "🎉", title: "Everyone guessed it!" },
  timeout: { icon: "⏰", title: "Time's up!" },
  drawer_left: { icon: "🚪", title: "Drawer left the game" },
};

export function TurnToast({ reason, word, countdown }: TurnToastProps) {
  const config = REASON_CONFIG[reason] || REASON_CONFIG.timeout;

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-fadeIn">
      <div className="bg-white border-[3px] border-ink rounded-[16px] shadow-scribbl-md px-6 py-5 flex items-center gap-4 min-w-[300px]">
        <div className="text-4xl flex-shrink-0">{config.icon}</div>
        <div className="flex-1">
          <div className="text-base font-extrabold mb-0.5">{config.title}</div>
          <div className="text-sm text-[var(--text-muted)]">
            The word was <strong className="text-coral">{word}</strong>
          </div>
          <div className="h-1 bg-[#eee] rounded mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-green)] to-[var(--color-blue)] rounded animate-shrink"
              style={{ animationDuration: `${countdown}s` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
