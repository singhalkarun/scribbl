"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "@/store/usePlayerStore";

interface ChatProps {
  wordToGuess: string;
  onCorrectGuess: () => void;
  playerName: string;
  sendMessage: (messageText: string) => void;
  isDrawer?: boolean;
}

export default function Chat({
  wordToGuess,
  onCorrectGuess,
  playerName,
  sendMessage,
  isDrawer = false,
}: ChatProps) {
  const messages = usePlayerStore((state) => state.messages);
  const currentUserId = usePlayerStore((state) => state.userId);
  const players = usePlayerStore((state) => state.players);
  const [input, setInput] = useState("");
  const [guessedCorrectly, setGuessedCorrectly] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const isInputDisabled = false;

  const disabledMessage = "";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    sendMessage(trimmed);

    const guess = trimmed.toLowerCase();
    const correct = !isDrawer && guess === wordToGuess.toLowerCase();
    if (correct) {
      console.log("Correct guess detected.");
      setGuessedCorrectly(true);
      onCorrectGuess();
    }

    setInput("");
  };

  return (
    <div className="flex flex-col flex-1 relative overflow-hidden">
      {/* Glass backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-lg"></div>

      {/* Content container */}
      <div className="relative flex flex-col flex-1 p-3 overflow-hidden">
        <h2 className="font-semibold text-lg mb-2 text-white drop-shadow-md">
          Chat
        </h2>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2 flex flex-col">
          {messages.map((msg, i) => {
            const isCurrentUser = msg.userId === currentUserId;
            const senderName =
              msg.senderName || players[msg.userId] || msg.userId || "Unknown";
            const isSystemMessage = msg.system;

            console.log(
              `[Chat] Rendering msg ${i}: Text="${msg.text}", msg.userId=${msg.userId}, currentUserId=${currentUserId}, isCurrentUser=${isCurrentUser}`
            );

            return (
              <div
                key={i}
                className={`max-w-[80%] relative ${
                  isCurrentUser
                    ? "self-end"
                    : isSystemMessage
                    ? "self-center text-center"
                    : "self-start"
                }`}
              >
                {/* Message glass backdrop */}
                <div
                  className={`absolute inset-0 backdrop-blur-xl border rounded-lg shadow-sm ${
                    isCurrentUser
                      ? "bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border-indigo-400/40"
                      : isSystemMessage
                      ? msg.text.includes("guessed correctly")
                        ? "bg-gradient-to-r from-green-500/30 to-emerald-500/30 border-green-400/40"
                        : "bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-cyan-400/40"
                      : "bg-gradient-to-r from-white/15 to-white/5 border-white/25"
                  }`}
                ></div>

                {/* Inner highlight border for glass effect */}
                <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-lg"></div>

                {/* Message content */}
                <div className="relative px-3 py-2 text-sm">
                  {!isSystemMessage && !isCurrentUser && (
                    <strong className="block font-medium text-xs mb-1 text-white/80 drop-shadow-lg">
                      {senderName}
                    </strong>
                  )}
                  <p
                    className={`font-medium drop-shadow-lg ${
                      isCurrentUser
                        ? "text-white"
                        : isSystemMessage
                        ? msg.text.includes("guessed correctly")
                          ? "text-green-100"
                          : "text-cyan-100"
                        : "text-white/95"
                    }`}
                  >
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-2 flex gap-1 relative group"
        >
          {/* Input glass container */}
          <div className="relative flex-1 group">
            <div
              className={`absolute inset-0 backdrop-blur-xl rounded border transition-all duration-300 ${
                isInputDisabled
                  ? "bg-gray-500/20 border-gray-400/30"
                  : "bg-white/10 border-white/30 group-focus-within:border-white/50"
              }`}
            ></div>
            <input
              type="text"
              placeholder="Type here"
              className="relative border-0 px-3 py-1 rounded text-base flex-1 min-w-0 bg-transparent text-white placeholder-white/60 focus:outline-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={false}
              title=""
            />
          </div>

          {/* Send button with glass effect */}
          <button
            type="submit"
            className={`relative px-3 py-2 rounded text-base flex items-center justify-center transition-all duration-300 hover:scale-105 ${
              isInputDisabled ? "cursor-not-allowed" : "hover:cursor-pointer"
            }`}
            disabled={isInputDisabled}
            title={disabledMessage}
          >
            <div
              className={`absolute inset-0 backdrop-blur-xl border rounded transition-all duration-300 ${
                isInputDisabled
                  ? "bg-gray-500/60 border-gray-400/50"
                  : "bg-blue-500/80 border-blue-400/50 hover:bg-blue-400/90"
              }`}
            ></div>
            <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded"></div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="relative w-4 h-4 text-white drop-shadow-md"
            >
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>

          {isInputDisabled && (
            <div className="absolute -top-10 left-0 right-0 mx-auto w-max bg-black/80 backdrop-blur-md text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block border border-white/20">
              {disabledMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
