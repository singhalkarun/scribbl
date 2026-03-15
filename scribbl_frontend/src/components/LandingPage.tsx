import React from "react";

interface LandingPageProps {
  onPlayNow: () => void;
  onHostGame: () => void;
  onJoinRoom: () => void;
}

export function LandingPage({ onPlayNow, onHostGame, onJoinRoom }: LandingPageProps) {
  const doodles = ["🎨", "✏️", "🌟", "🎭", "💡", "🖍️", "🎯", "🖌️"];
  const doodlePositions = [
    "top-[8%] left-[8%]",
    "top-[15%] right-[12%]",
    "bottom-[20%] left-[5%]",
    "bottom-[15%] right-[8%]",
    "top-[40%] left-[3%]",
    "top-[35%] right-[5%]",
    "bottom-[35%] left-[15%]",
    "top-[60%] right-[15%]",
  ];

  return (
    <div className="min-h-[100svh] flex flex-col items-center justify-center text-center px-6 py-10 relative overflow-hidden">
      {/* Floating doodles */}
      {doodles.map((emoji, i) => (
        <div
          key={i}
          className={`fixed ${doodlePositions[i]} text-[28px] opacity-[0.12] pointer-events-none animate-float`}
          style={{ animationDelay: `${i * 0.5}s` }}
        >
          {emoji}
        </div>
      ))}

      {/* Logo */}
      <h1 className="font-display text-7xl md:text-8xl mb-1" style={{ textShadow: "4px 4px 0 #333" }}>
        {"Scribbl".split("").map((letter, i) => {
          const colors = ["#FF6B6B", "#FDCB6E", "#55EFC4", "#74B9FF", "#A29BFE", "#FD79A8", "#FF6B6B"];
          const rotations = [-5, 3, -2, 4, -3, 2, -4];
          return (
            <span
              key={i}
              className="inline-block"
              style={{ color: colors[i], transform: `rotate(${rotations[i]}deg)` }}
            >
              {letter}
            </span>
          );
        })}
      </h1>

      {/* Wavy underline */}
      <svg className="w-[200px] mx-auto mb-5" viewBox="0 0 200 12">
        <path
          d="M0,6 Q12,0 25,6 Q38,12 50,6 Q62,0 75,6 Q88,12 100,6 Q112,0 125,6 Q138,12 150,6 Q162,0 175,6 Q188,12 200,6"
          fill="none" stroke="#FF6B6B" strokeWidth="3" strokeLinecap="round"
        />
      </svg>

      {/* Tagline */}
      <p className="text-[22px] font-bold text-[var(--text-secondary)] mb-10">
        <span className="text-coral">Draw</span>
        <span className="text-[var(--text-placeholder)] mx-1">·</span>
        <span className="text-[var(--color-blue)]">Guess</span>
        <span className="text-[var(--text-placeholder)] mx-1">·</span>
        <span className="text-[var(--color-green)]">Laugh</span>
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap justify-center mb-12">
        <button
          onClick={onPlayNow}
          className="font-extrabold text-lg px-9 py-3.5 rounded-[16px] border-[3px] border-ink bg-[var(--color-green)] text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
        >
          Play Now ✏️
        </button>
        <button
          onClick={onHostGame}
          className="font-extrabold text-lg px-9 py-3.5 rounded-[16px] border-[3px] border-ink bg-[var(--color-blue)] text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
        >
          Host Game 🏠
        </button>
        <button
          onClick={onJoinRoom}
          className="font-extrabold text-lg px-9 py-3.5 rounded-[16px] border-[3px] border-ink bg-[var(--color-yellow)] text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
        >
          Join Room 🔗
        </button>
      </div>

      {/* How It Works */}
      <div className="flex flex-col sm:flex-row gap-6 flex-wrap justify-center max-w-[800px] mx-auto mb-12">
        {[
          { icon: "✏️", title: "Draw", desc: "It's your turn! Draw the secret word before time runs out", num: 1, rotate: "-1.5deg" },
          { icon: "💬", title: "Guess", desc: "Watch others draw and type your guesses. Faster = more points!", num: 2, rotate: "1deg" },
          { icon: "🏆", title: "Win", desc: "Top the scoreboard at the end. Bragging rights guaranteed.", num: 3, rotate: "-0.5deg" },
        ].map((step) => (
          <div
            key={step.num}
            className="bg-white border-[3px] border-ink rounded-scribbl-lg p-5 w-[220px] text-center shadow-scribbl-md relative mx-auto"
            style={{ transform: `rotate(${step.rotate})` }}
          >
            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-coral text-white font-extrabold text-base flex items-center justify-center border-[3px] border-ink">
              {step.num}
            </div>
            <div className="absolute -top-3.5 right-3 text-lg rotate-[15deg]">📌</div>
            <div className="text-[40px] mb-2">{step.icon}</div>
            <div className="text-lg font-extrabold mb-1">{step.title}</div>
            <div className="text-[13px] text-[var(--text-muted)] leading-relaxed">{step.desc}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-xs text-[var(--text-placeholder)] flex items-center gap-3">
        <span>Made with 🖍️</span>
      </div>
    </div>
  );
}
