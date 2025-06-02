"use client";

import { useState } from "react";

interface WebRTCInstance {
  isAudioEnabled: boolean;
  isMuted: boolean;
  connectedPeers: string[];
  speakingUsers: string[];
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

interface VoiceChatControlsProps {
  webRTC: WebRTCInstance;
  players: { [userId: string]: string };
  isCurrentUserDrawing?: boolean;
}

export function VoiceChatControls({
  webRTC,
  players,
  isCurrentUserDrawing = false,
}: VoiceChatControlsProps) {
  return (
    <button
      onClick={webRTC.toggleMute}
      disabled={isCurrentUserDrawing}
      className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
        webRTC.isMuted
          ? "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300"
          : "bg-indigo-100 hover:bg-indigo-200 text-indigo-600 border border-indigo-300"
      } ${
        isCurrentUserDrawing
          ? "opacity-50 cursor-not-allowed"
          : "hover:cursor-pointer"
      }`}
      title={
        isCurrentUserDrawing
          ? "Auto-muted as drawer"
          : webRTC.isMuted
          ? "Click to unmute"
          : "Click to mute"
      }
    >
      <svg
        className="w-4 h-4"
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
    </button>
  );
}
