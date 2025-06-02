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
    <div className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300 ease-out">
      <div className="bg-white/95 backdrop-blur-sm p-6 rounded-2xl shadow-2xl w-full max-w-md border border-white/20 relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 hover:cursor-pointer rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-4 pr-8">
          🎨 How to Play Scribbl
        </h2>

        <div className="space-y-3 text-sm text-gray-700">
          <div className="flex items-start space-x-3">
            <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              ✏️
            </span>
            <p>One player draws a word, others try to guess it</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              💬
            </span>
            <p>Type your guesses in the chat to earn points</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              ⏰
            </span>
            <p>Faster correct guesses = more points</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              🔄
            </span>
            <p>Everyone takes turns drawing and guessing</p>
          </div>
          <div className="flex items-start space-x-3">
            <span className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              🏆
            </span>
            <p>Highest score wins the game!</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
          <p className="text-sm text-blue-800 text-center">
            💡 <strong>Tip:</strong> Share the room ID with friends to play
            together!
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition duration-200 ease-in-out shadow-md hover:shadow-lg hover:cursor-pointer"
        >
          Got it!
        </button>
      </div>
    </div>
  );
}
