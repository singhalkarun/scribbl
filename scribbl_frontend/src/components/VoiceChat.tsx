"use client";

import { useState, useEffect } from "react";
import { usePlayerStore } from "@/store/usePlayerStore";

interface WebRTCInstance {
  isAudioEnabled: boolean;
  isMuted: boolean;
  connectedPeers: string[];
  speakingUsers: string[];
  startVoiceChat: () => Promise<void>;
  stopVoiceChat: () => void;
  toggleMute: () => void;
  handleUserJoined: (userId: string) => void;
  handleUserLeft: (userId: string) => void;
  signaling: {
    sendOffer: (targetUserId: string, offer: any, fromUserId: string) => void;
    sendAnswer: (targetUserId: string, answer: any, fromUserId: string) => void;
    sendICECandidate: (
      targetUserId: string,
      candidate: any,
      fromUserId: string
    ) => void;
    handleOfferReceived: (fromUserId: string, offer: any) => void;
    handleAnswerReceived: (fromUserId: string, answer: any) => void;
    handleICECandidateReceived: (fromUserId: string, candidate: any) => void;
  };
}

interface VoiceChatProps {
  webRTC: WebRTCInstance;
  className?: string;
}

export function VoiceChat({ webRTC, className = "" }: VoiceChatProps) {
  const { players, userId } = usePlayerStore();
  const [isPermissionRequested, setIsPermissionRequested] = useState(false);
  const [prevConnectedPeers, setPrevConnectedPeers] = useState<string[]>([]);

  // Track changes in connected peers to show notifications
  useEffect(() => {
    const currentPeers = webRTC.connectedPeers;

    // Check for newly joined peers
    const newPeers = currentPeers.filter(
      (peerId) => !prevConnectedPeers.includes(peerId)
    );
    newPeers.forEach((peerId) => {
      const userName = players[peerId] || peerId;
      console.log(`[VoiceChat] 🎤 ${userName} joined voice chat`);
    });

    // Check for left peers
    const leftPeers = prevConnectedPeers.filter(
      (peerId) => !currentPeers.includes(peerId)
    );
    leftPeers.forEach((peerId) => {
      const userName = players[peerId] || peerId;
      console.log(`[VoiceChat] 🔇 ${userName} left voice chat`);
    });

    setPrevConnectedPeers(currentPeers);
  }, [webRTC.connectedPeers, players, prevConnectedPeers]);

  const handleStartVoiceChat = async () => {
    try {
      setIsPermissionRequested(true);
      await webRTC.startVoiceChat();
    } catch (error) {
      console.error("Failed to start voice chat:", error);
      // Reset permission state if failed
      setIsPermissionRequested(false);

      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          alert(
            "Microphone access was denied. Please allow microphone access and try again."
          );
        } else if (error.name === "NotFoundError") {
          alert(
            "No microphone found. Please connect a microphone and try again."
          );
        } else {
          alert(
            "Failed to access microphone. Please check your settings and try again."
          );
        }
      }
    }
  };

  const handleStopVoiceChat = () => {
    webRTC.stopVoiceChat();
    setIsPermissionRequested(false);
  };

  const connectedPeersCount = webRTC.connectedPeers.length;
  const totalPeersCount = Object.keys(players).length - 1; // Exclude self

  return (
    <div className={`voice-chat ${className}`}>
      <div className="voice-chat-controls">
        {!webRTC.isAudioEnabled ? (
          <button
            onClick={handleStartVoiceChat}
            disabled={isPermissionRequested}
            className="voice-chat-btn start-btn"
            title="Start voice chat"
          >
            <svg
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            {isPermissionRequested ? "Requesting..." : "Start Voice Chat"}
          </button>
        ) : (
          <div className="voice-chat-active">
            <button
              onClick={webRTC.toggleMute}
              className={`voice-chat-btn mute-btn ${
                webRTC.isMuted ? "muted" : ""
              }`}
              title={webRTC.isMuted ? "Unmute" : "Mute"}
            >
              <svg
                className="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {webRTC.isMuted ? (
                  <>
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12l1.27-1.27A3 3 0 0 0 15 12V9a3 3 0 0 0-3-3a3 3 0 0 0-2.12.88L11 8" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                )}
              </svg>
              {webRTC.isMuted ? "Unmute" : "Mute"}
            </button>

            <button
              onClick={handleStopVoiceChat}
              className="voice-chat-btn stop-btn"
              title="Stop voice chat"
            >
              <svg
                className="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop Voice Chat
            </button>
          </div>
        )}
      </div>

      {webRTC.isAudioEnabled && (
        <div className="voice-chat-status">
          <div className="connection-status">
            <div className="status-indicator">
              <span
                className={`status-dot ${
                  webRTC.isAudioEnabled ? "connected" : "disconnected"
                }`}
              ></span>
              Voice Chat Active
            </div>
            {totalPeersCount > 0 && (
              <div className="peer-count">
                Connected to {connectedPeersCount} of {totalPeersCount} players
              </div>
            )}
          </div>

          {webRTC.connectedPeers.length > 0 && (
            <div className="connected-peers">
              <span className="peers-label">Talking with:</span>
              <div className="peers-list">
                {webRTC.connectedPeers.map((peerId) => (
                  <span key={peerId} className="peer-name">
                    {players[peerId] || peerId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .voice-chat {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          padding: 12px;
          margin: 8px 0;
        }

        .voice-chat-controls {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .voice-chat-active {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        .voice-chat-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .voice-chat-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .start-btn {
          background: #10b981;
          color: white;
        }

        .start-btn:hover:not(:disabled) {
          background: #059669;
        }

        .mute-btn {
          background: #6b7280;
          color: white;
        }

        .mute-btn:hover {
          background: #4b5563;
        }

        .mute-btn.muted {
          background: #ef4444;
        }

        .mute-btn.muted:hover {
          background: #dc2626;
        }

        .stop-btn {
          background: #ef4444;
          color: white;
        }

        .stop-btn:hover {
          background: #dc2626;
        }

        .icon {
          width: 16px;
          height: 16px;
        }

        .voice-chat-status {
          margin-top: 12px;
          font-size: 13px;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .status-dot.connected {
          background: #10b981;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
        }

        .status-dot.disconnected {
          background: #6b7280;
        }

        .peer-count {
          color: #6b7280;
        }

        .connected-peers {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .peers-label {
          color: #6b7280;
          font-weight: 500;
        }

        .peers-list {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .peer-name {
          background: #e5e7eb;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #374151;
        }

        @media (max-width: 640px) {
          .voice-chat-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .voice-chat-active {
            flex-direction: column;
            align-items: stretch;
          }

          .voice-chat-btn {
            justify-content: center;
          }

          .connection-status {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}
