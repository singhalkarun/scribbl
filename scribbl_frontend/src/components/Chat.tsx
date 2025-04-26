"use client";

import { getSimilarity } from "@/utils/getSimilarity";
import { useEffect, useRef, useState } from "react";

interface Message {
  sender: string;
  text: string;
  system?: boolean;
}

interface ChatProps {
  wordToGuess: string;
  onCorrectGuess: () => void;
  playerName: string;
}

export default function Chat({
  wordToGuess,
  onCorrectGuess,
  playerName,
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [guessedCorrectly, setGuessedCorrectly] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const newMessages: Message[] = [{ sender: playerName, text: trimmed }];

    const guess = trimmed.toLowerCase();
    const correct = guess === wordToGuess.toLowerCase();
    const similarity = getSimilarity(guess, wordToGuess.toLowerCase());

    if (correct) {
      newMessages.push({
        sender: "System",
        text: `${playerName} guessed it! 🎉`,
        system: true,
      });
      setGuessedCorrectly(true);
      onCorrectGuess();
    } else if (similarity > 0.5) {
      newMessages.push({
        sender: "System",
        text: "You're very close!",
        system: true,
      });
    }

    setMessages((prev) => [...prev, ...newMessages]);
    setInput("");
  };

  return (
    <div className="flex flex-col flex-1 bg-gray-50 rounded shadow p-3 overflow-hidden">
      <h2 className="font-semibold text-lg mb-2">Chat</h2>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
              msg.sender === "You"
                ? "bg-blue-500 text-white self-end ml-auto"
                : msg.sender === "System"
                ? "bg-green-200 text-green-800 mx-auto text-center"
                : "bg-gray-200 text-gray-800 self-start"
            }`}
          >
            {msg.sender !== "System" && (
              <strong className="block font-medium">{msg.sender}</strong>
            )}
            <p>{msg.text}</p>
          </div>
        ))}
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
