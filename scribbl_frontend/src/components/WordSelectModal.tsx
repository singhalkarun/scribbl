import React from "react";

interface WordSelectModalProps {
  words: string[];
  countdown: number;
  hasSkipped: boolean;
  onSelectWord: (word: string) => void;
  onSkip: () => void;
  difficulty?: string;
}

export function WordSelectModal({
  words,
  countdown,
  hasSkipped,
  onSelectWord,
  onSkip,
  difficulty = "Mix",
}: WordSelectModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 text-center relative max-w-[420px] w-full animate-fadeIn">
        {/* Pin */}
        <div className="absolute -top-3 left-5 text-[22px] -rotate-12">📌</div>

        <h2 className="font-display text-2xl text-coral mb-1" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>
          Pick a Word! 🎯
        </h2>
        <p className="text-[13px] text-[var(--text-placeholder)] mb-6">
          Choose wisely — you&apos;ll be drawing this!
        </p>

        {/* Timer */}
        <div className={`w-16 h-16 rounded-full border-[3px] border-ink flex items-center justify-center text-[28px] font-extrabold mx-auto mb-5 shadow-scribbl-md relative ${countdown <= 3 ? "bg-[#FFDDDD] text-[#e74c3c]" : "bg-[#FFDDDD] text-[#e74c3c]"}`}>
          {countdown}
          <div className="absolute inset-1 rounded-full border-[3px] border-transparent border-t-[#e74c3c] animate-spin" />
        </div>

        {/* Word buttons */}
        <div className="flex flex-col gap-2.5 mb-5">
          {words.map((word) => (
            <button
              key={word}
              onClick={() => onSelectWord(word)}
              className="bg-cream border-[2.5px] border-ink rounded-scribbl-md px-5 py-3.5 text-lg font-extrabold shadow-scribbl-md flex items-center justify-between hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-sm hover:bg-[var(--color-yellow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
            >
              <span>{word}</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-[6px] border-[1.5px] border-ink bg-[#E8F5E9] text-[#27ae60]">
                {difficulty}
              </span>
            </button>
          ))}
        </div>

        {/* Skip button */}
        {!hasSkipped && (
          <button
            onClick={onSkip}
            className="border-2 border-[var(--text-disabled)] rounded-scribbl-sm px-5 py-2 text-[13px] font-bold text-[var(--text-placeholder)] hover:border-[#e67e22] hover:text-[#e67e22] hover:bg-[#FFF3E0] transition-all duration-150"
          >
            Skip (1 remaining)
          </button>
        )}
      </div>
    </div>
  );
}
