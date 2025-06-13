"use client";

import React, { useEffect, useRef } from "react";
import { useWebRTCVoice } from "@/hooks/useWebRTCVoice";
import { usePlayerStore } from "@/store/usePlayerStore";

interface VoiceChatProps {
  scores: { [key: string]: number };
  currentDrawerId: string;
  currentPlayerName: string;
}

export default function VoiceChat({
  scores,
  currentDrawerId,
  currentPlayerName,
}: VoiceChatProps) {
  const { players, userId, playerAvatars } = usePlayerStore();
  const {
    isConnected,
    isMuted,
    audioEnabled,
    connections,
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
    userMuteStates,
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

  const playerList = Object.entries(players);

  return (
    <div className="relative flex flex-col h-full select-none w-full lg:w-auto flex-1 lg:flex-initial lg:max-h-[90vh]">
      {/* Glass backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-lg"></div>

      {/* Content container */}
      <div className="relative p-2 lg:p-3 flex flex-col h-full">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-sm lg:text-lg text-white drop-shadow-md">
            Players ({playerList.length})
          </h2>
          {!audioEnabled ? (
            <button
              onClick={handleStartVoice}
              className="relative px-3 py-1 rounded-md text-xs font-medium transition-all duration-300 hover:scale-105 hover:cursor-pointer"
            >
              <div className="absolute inset-0 bg-green-500/80 backdrop-blur-md border border-green-400/50 rounded-md hover:bg-green-400/90 transition-all duration-300"></div>
              <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-md"></div>
              <span className="relative text-white drop-shadow-md">
                Join Voice
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className={`relative p-1.5 rounded-full transition-all duration-300 hover:scale-110 hover:cursor-pointer`}
                title={isMuted ? "Unmute Self" : "Mute Self"}
              >
                <div
                  className={`absolute inset-0 backdrop-blur-md border rounded-full transition-all duration-300 ${
                    isMuted
                      ? "bg-red-500/80 border-red-400/50 hover:bg-red-400/90"
                      : "bg-blue-500/80 border-blue-400/50 hover:bg-blue-400/90"
                  }`}
                ></div>
                <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-full"></div>
                <div className="relative text-white drop-shadow-md">
                  {isMuted ? <MutedIcon /> : <UnmutedIcon />}
                </div>
              </button>
              <button
                onClick={stopVoiceChat}
                className="relative p-1.5 rounded-full transition-all duration-300 hover:scale-110 hover:cursor-pointer"
                title="Leave Voice"
              >
                <div className="absolute inset-0 bg-gray-500/80 backdrop-blur-md border border-gray-400/50 rounded-full hover:bg-gray-400/90 transition-all duration-300"></div>
                <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-full"></div>
                <div className="relative text-white drop-shadow-md">
                  <LeaveIcon />
                </div>
              </button>
            </div>
          )}
        </div>
        <ul className="text-xs lg:text-sm text-white/90 space-y-1.5 overflow-y-auto pr-1 flex-1">
          {playerList.length > 0 ? (
            playerList.map(([id, name]) => {
              const score = scores[id] || 0;
              const isMutedForUser = userMuteStates.get(id) ?? false;
              const isSelf = id === userId;
              const avatar = playerAvatars[id] || "👤";

              return (
                <li key={id} className="relative">
                  {/* Player item glass backdrop */}
                  <div
                    className={`absolute inset-0 backdrop-blur-md border rounded-md transition-all duration-300 ${
                      isConnected && connections.has(id)
                        ? "bg-green-500/20 border-green-400/40"
                        : "bg-white/5 border-white/10"
                    }`}
                  ></div>

                  {/* Player item content */}
                  <div className="relative flex items-center justify-between gap-2 p-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm lg:text-lg flex-shrink-0">
                        {id === currentDrawerId ? "✏️" : avatar}
                      </span>
                      <span className="truncate text-xs lg:text-sm font-normal text-white/90 drop-shadow-md">
                        {name === currentPlayerName ? (
                          <b>{name} (You)</b>
                        ) : (
                          name
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-cyan-300 flex-shrink-0 text-xs lg:text-sm drop-shadow-md">
                        {score} pts
                      </span>
                      {audioEnabled && !isSelf && connections.has(id) && (
                        <span
                          className="p-1 text-white/70 drop-shadow-md"
                          title={isMutedForUser ? "Muted" : "Unmuted"}
                        >
                          {isMutedForUser ? (
                            <MutedIcon small />
                          ) : (
                            <UnmutedIcon small />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          ) : (
            <li className="text-white/60 italic text-xs lg:text-sm drop-shadow-md text-center py-4">
              No players yet...
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

// SVG Icon Components
const MutedIcon = ({ small }: { small?: boolean }) => (
  <svg
    className={small ? "w-4 h-4" : "w-5 h-5"}
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
    className={small ? "w-4 h-4" : "w-5 h-5"}
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

const LeaveIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);
