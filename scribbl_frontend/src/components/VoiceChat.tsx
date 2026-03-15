"use client";

import React, { useEffect, useRef } from "react";
import { useWebRTCVoice } from "@/hooks/useWebRTCVoice";

interface VoiceChatProps {
  scores: { [key: string]: number };
  currentDrawerId: string;
  currentPlayerName: string;
}

export default function VoiceChat({
  scores: _scores,
  currentDrawerId: _currentDrawerId,
  currentPlayerName: _currentPlayerName,
}: VoiceChatProps) {
  const {
    isConnected: _isConnected,
    isMuted,
    audioEnabled,
    connections,
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
    userMuteStates: _userMuteStates,
  } = useWebRTCVoice();

  const audioRefs = useRef<{ [userId: string]: HTMLAudioElement }>({});

  useEffect(() => {
    connections.forEach((connection, remoteUserId) => {
      if (connection.remoteStream) {
        let audioElement = audioRefs.current[remoteUserId];
        if (!audioElement) {
          audioElement = new Audio();
          audioElement.autoplay = true;
          audioRefs.current[remoteUserId] = audioElement;
        }
        audioElement.srcObject = connection.remoteStream;
      }
    });

    Object.keys(audioRefs.current).forEach((remoteUserId) => {
      if (!connections.has(remoteUserId)) {
        const audio = audioRefs.current[remoteUserId];
        if (audio) {
          audio.srcObject = null;
          delete audioRefs.current[remoteUserId];
        }
      }
    });
  }, [connections]);

  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        audio.srcObject = null;
      });
    };
  }, []);

  const handleStartVoice = async () => {
    try {
      await startVoiceChat();
    } catch (error) {
      let errorMessage = "Failed to start voice chat.";
      if (error instanceof DOMException) {
        switch (error.name) {
          case "NotAllowedError":
            errorMessage =
              "Microphone access denied. Please allow microphone access and try again.";
            break;
          case "NotFoundError":
            errorMessage =
              "No microphone found. Please connect a microphone and try again.";
            break;
          case "NotReadableError":
            errorMessage =
              "Microphone is being used by another application. Please close other apps and try again.";
            break;
          default:
            errorMessage = `Microphone error: ${error.message}`;
        }
      }
      alert(errorMessage);
    }
  };

  if (!audioEnabled) {
    return (
      <button
        onClick={handleStartVoice}
        className="bg-[var(--color-green)] border-[2px] border-ink rounded-scribbl-xs px-3 py-1.5 text-xs font-bold shadow-scribbl-xs hover:opacity-90 hover:cursor-pointer transition-opacity"
      >
        Join Voice
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        className={`border-[2px] border-ink rounded-scribbl-xs px-3 py-1.5 text-xs font-bold shadow-scribbl-xs hover:opacity-90 hover:cursor-pointer transition-opacity ${
          isMuted
            ? "bg-[var(--color-coral)]"
            : "bg-[var(--color-blue,#4a90d9)]"
        }`}
        title={isMuted ? "Unmute Self" : "Mute Self"}
      >
        {isMuted ? <MutedIcon /> : <UnmutedIcon />}
      </button>
      <button
        onClick={stopVoiceChat}
        className="bg-[#ddd] border-[2px] border-ink rounded-scribbl-xs px-2 py-1 text-xs font-bold shadow-scribbl-xs hover:opacity-90 hover:cursor-pointer transition-opacity"
        title="Leave Voice"
      >
        Leave
      </button>
    </div>
  );
}

// SVG Icon Components
const MutedIcon = ({ small }: { small?: boolean }) => (
  <svg
    className={small ? "w-4 h-4" : "w-4 h-4"}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
    />
  </svg>
);

const UnmutedIcon = ({ small }: { small?: boolean }) => (
  <svg
    className={small ? "w-4 h-4" : "w-4 h-4"}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
    />
  </svg>
);
