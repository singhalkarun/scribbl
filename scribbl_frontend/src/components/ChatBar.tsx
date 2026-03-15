import React, { useState, useRef, useEffect } from "react";

interface Message {
  userId: string;
  text: string;
  system?: boolean;
  senderName?: string;
}

interface ChatBarProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  currentUserId: string;
}

export function ChatBar({ messages, onSendMessage, disabled, disabledReason, currentUserId }: ChatBarProps) {
  const [input, setInput] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(messages.length);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelMessagesRef = useRef<HTMLDivElement>(null);

  const unreadCount = messages.length - lastSeenCount;

  // Scroll panel to bottom when new messages arrive
  useEffect(() => {
    if (isPanelOpen && panelMessagesRef.current) {
      panelMessagesRef.current.scrollTop = panelMessagesRef.current.scrollHeight;
      setLastSeenCount(messages.length);
    }
  }, [messages.length, isPanelOpen]);

  // Close panel on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPanelOpen) {
        setIsPanelOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPanelOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const togglePanel = () => {
    const next = !isPanelOpen;
    setIsPanelOpen(next);
    if (next) setLastSeenCount(messages.length);
  };

  // Show last 5 messages as pills
  const recentMessages = messages.slice(-5);

  const getMessageStyle = (msg: Message) => {
    if (msg.system && msg.text.includes("guessed")) return "bg-[#D5F5E3] border-[#27ae60] text-[#27ae60]";
    if (msg.system) return "bg-[var(--color-yellow)] border-[#f39c12] text-[#f39c12]";
    return "bg-white border-ink";
  };

  const getMessageText = (msg: Message) => {
    if (msg.system) return msg.text;
    return `${msg.senderName || "Player"}: ${msg.text}`;
  };

  return (
    <div className="flex-shrink-0 relative">
      {/* Recent messages as pills */}
      <div className="flex gap-1.5 items-center mb-1.5 overflow-x-auto scrollbar-hide py-0.5">
        {recentMessages.map((msg, i) => (
          <div
            key={messages.length - 5 + i}
            className={`${getMessageStyle(msg)} border-2 rounded-scribbl-sm px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap flex-shrink-0 shadow-scribbl-xs max-w-[200px] overflow-hidden text-ellipsis`}
          >
            {msg.system ? (
              msg.text
            ) : (
              <>
                <span className="text-[var(--text-muted)] mr-1">{msg.senderName || "Player"}:</span>
                {msg.text}
              </>
            )}
          </div>
        ))}
        <button
          onClick={togglePanel}
          className="bg-white border-2 border-ink rounded-scribbl-xs px-2 py-0.5 text-[11px] font-bold flex-shrink-0 shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors text-[var(--text-muted)] relative"
        >
          ↑ Chat
          {unreadCount > 0 && !isPanelOpen && (
            <span className="absolute -top-2 -right-2 bg-coral text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? disabledReason || "Disabled" : "Type your guess..."}
          disabled={disabled}
          className="flex-1 bg-white border-[2.5px] border-ink rounded-scribbl-md px-4 py-2 text-sm font-semibold shadow-scribbl-sm outline-none transition-all duration-150 focus:border-[var(--color-blue)] focus:shadow-[2px_2px_0_var(--color-blue)] placeholder:text-[var(--text-disabled)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="bg-[var(--color-green)] border-[2.5px] border-ink rounded-[12px] px-3.5 py-2 text-base shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ➤
        </button>
      </form>

      {/* Expanded chat panel */}
      {isPanelOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setIsPanelOpen(false)}
          />
          <div
            ref={panelRef}
            className="absolute bottom-full right-0 mb-2 w-full lg:w-[320px] max-h-[50vh] lg:max-h-[400px] bg-white border-[3px] border-ink rounded-[16px] shadow-scribbl-md flex flex-col overflow-hidden z-50"
          >
            <div className="px-3.5 py-2.5 font-extrabold text-sm border-b-[2.5px] border-ink flex justify-between items-center bg-[var(--color-yellow)]">
              <span>💬 Chat</span>
              <button onClick={() => setIsPanelOpen(false)} className="text-base text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                ✕
              </button>
            </div>
            <div ref={panelMessagesRef} className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
              {messages.map((msg, i) => (
                <div key={i} className={`text-[13px] leading-relaxed ${msg.system && msg.text.includes("guessed") ? "text-[#27ae60] font-bold" : ""}`}>
                  {msg.system ? (
                    msg.text
                  ) : (
                    <>
                      <span className="font-extrabold mr-1" style={{ color: msg.userId === currentUserId ? "var(--color-blue)" : "var(--color-purple)" }}>
                        {msg.senderName || "Player"}:
                      </span>
                      {msg.text}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
