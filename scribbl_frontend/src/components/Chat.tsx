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

  const isInputDisabled = isDrawer || guessedCorrectly;

  const disabledMessage = isDrawer
    ? "The drawer cannot chat during their turn"
    : guessedCorrectly
    ? "You've already guessed correctly"
    : "";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isInputDisabled) return;

    sendMessage(trimmed);

    const guess = trimmed.toLowerCase();
    const correct = guess === wordToGuess.toLowerCase();
    if (correct) {
      console.log("Guessed correctly locally, disabling input.");
      setGuessedCorrectly(true);
      onCorrectGuess();
    }

    setInput("");
  };

  return (
    <div className="flex flex-col flex-1 bg-gray-50 rounded shadow p-3 overflow-hidden">
      <h2 className="font-semibold text-lg mb-2">Chat</h2>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
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
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                isCurrentUser
                  ? "bg-blue-500 text-white self-end ml-auto"
                  : isSystemMessage
                  ? msg.text.includes("guessed correctly")
                    ? "bg-green-100 text-green-800 mx-auto text-center border border-green-200"
                    : "bg-green-200 text-green-800 mx-auto text-center"
                  : "bg-gray-200 text-gray-800 self-start"
              }`}
            >
              {!isSystemMessage && !isCurrentUser && (
                <strong className="block font-medium">{senderName}</strong>
              )}
              <p>{msg.text}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-2 flex gap-1 relative group">
        <input
          type="text"
          placeholder={isDrawer ? "You cannot chat while drawing" : "Type here"}
          className={`border px-2 py-1 rounded text-sm flex-1 min-w-0 ${
            isInputDisabled ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isInputDisabled}
          title={disabledMessage}
        />
        <button
          type="submit"
          className={`px-3 py-1 ${
            isInputDisabled
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-500 hover:bg-blue-600"
          } text-white rounded text-sm`}
          disabled={isInputDisabled}
          title={disabledMessage}
        >
          Send
        </button>

        {isInputDisabled && (
          <div className="absolute -top-10 left-0 right-0 mx-auto w-max bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
            {disabledMessage}
          </div>
        )}
      </form>
    </div>
  );
}
