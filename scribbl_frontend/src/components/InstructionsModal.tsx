"use client";

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InstructionsModal({
  isOpen,
  onClose,
}: InstructionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 ease-out">
      {/* Main glass container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Glass backdrop with enhanced effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent backdrop-blur-2xl rounded-3xl border border-white/30 shadow-2xl"></div>

        {/* Inner highlight border */}
        <div className="absolute inset-[1px] bg-gradient-to-br from-white/30 via-transparent to-transparent rounded-3xl"></div>

        {/* Content container */}
        <div className="relative p-6 rounded-3xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">
          {/* Close button with glass effect */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 rounded-full transition-all duration-300 hover:scale-110 group hover:cursor-pointer z-10"
          >
            <div className="w-full h-full text-white/80 group-hover:text-white flex items-center justify-center text-lg font-bold">
              ×
            </div>
          </button>

          <h2 className="text-2xl font-bold text-white mb-4 pr-8 drop-shadow-lg">
            🎨 How to Play Scribbl
          </h2>

          <div className="space-y-3 text-sm text-white/90">
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-gradient-to-r from-blue-500/80 to-blue-600/80 backdrop-blur-md border border-blue-400/50 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                ✏️
              </span>
              <p className="drop-shadow-md">
                One player draws a word, others try to guess it
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-gradient-to-r from-green-500/80 to-green-600/80 backdrop-blur-md border border-green-400/50 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                💬
              </span>
              <p className="drop-shadow-md">
                Type your guesses in the chat to earn points
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-gradient-to-r from-orange-500/80 to-orange-600/80 backdrop-blur-md border border-orange-400/50 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                ⏰
              </span>
              <p className="drop-shadow-md">
                Faster correct guesses = more points
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-gradient-to-r from-purple-500/80 to-purple-600/80 backdrop-blur-md border border-purple-400/50 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                🔄
              </span>
              <p className="drop-shadow-md">
                Everyone takes turns drawing and guessing
              </p>
            </div>
            <div className="flex items-start space-x-3">
              <span className="w-6 h-6 bg-gradient-to-r from-yellow-500/80 to-yellow-600/80 backdrop-blur-md border border-yellow-400/50 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                🏆
              </span>
              <p className="drop-shadow-md">Highest score wins the game!</p>
            </div>
          </div>

          {/* Tip section with glass effect */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-indigo-500/30 backdrop-blur-xl rounded-xl border border-blue-400/40"></div>
            <div className="relative p-4">
              <p className="text-sm text-white/90 text-center drop-shadow-md">
                💡 <strong className="text-cyan-300">Tip:</strong> Share the
                room ID with friends to play together!
              </p>
            </div>
          </div>

          {/* Close button with glass effect */}
          <button
            onClick={onClose}
            className="relative w-full group overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:cursor-pointer mt-6"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/80 to-purple-500/80 backdrop-blur-xl border border-blue-400/50 rounded-xl group-hover:from-blue-400/90 group-hover:to-purple-400/90 transition-all duration-300"></div>
            <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-xl"></div>
            <div className="relative px-4 py-2 text-white font-semibold drop-shadow-lg">
              Got it!
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
