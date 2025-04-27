"use client";

import { getSimilarity } from "@/utils/getSimilarity";
import { useEffect, useRef, useState } from "react";
import { usePlayerStore, Message } from "@/store/usePlayerStore";

interface ChatProps {
  wordToGuess: string;
  onCorrectGuess: () => void;
  playerName: string;
  sendMessage: (messageText: string) => void;
}

export default function Chat({
  wordToGuess,
  onCorrectGuess,
  playerName,
  sendMessage,
}: ChatProps) {
  const messages = usePlayerStore((state) => state.messages);
  const currentUserId = usePlayerStore((state) => state.userId);
  const players = usePlayerStore((state) => state.players);
  const [input, setInput] = useState("");
  const [guessedCorrectly, setGuessedCorrectly] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || guessedCorrectly) return;

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
                  ? "bg-green-200 text-green-800 mx-auto text-center"
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

      <form onSubmit={handleSubmit} className="mt-2 flex gap-1">
        <input
          type="text"
          placeholder="Type your guess..."
          className="border px-2 py-1 rounded text-sm flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={guessedCorrectly}
        />
        <button
          type="submit"
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:cursor-pointer"
          disabled={guessedCorrectly}
        >
          Send
        </button>
      </form>
    </div>
  );
}
