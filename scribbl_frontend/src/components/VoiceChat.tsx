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
  const { players, userId } = usePlayerStore();
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
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 lg:p-3 flex flex-col min-h-0 select-none w-full lg:w-auto flex-1 lg:flex-initial lg:max-h-[90vh]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm lg:text-lg text-gray-700">
          Players ({playerList.length})
        </h2>
        {!audioEnabled ? (
          <button
            onClick={handleStartVoice}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer"
          >
            Join Voice
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-full transition-colors hover:cursor-pointer ${
                isMuted
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
              title={isMuted ? "Unmute Self" : "Mute Self"}
            >
              {isMuted ? <MutedIcon /> : <UnmutedIcon />}
            </button>
            <button
              onClick={stopVoiceChat}
              className="bg-gray-500 hover:bg-gray-600 text-white p-1.5 rounded-full transition-colors hover:cursor-pointer"
              title="Leave Voice"
            >
              <LeaveIcon />
            </button>
          </div>
        )}
      </div>
      <ul className="text-xs lg:text-sm text-gray-600 space-y-1.5 overflow-y-auto pr-1 flex-1">
        {playerList.length > 0 ? (
          playerList.map(([id, name]) => {
            const score = scores[id] || 0;
            const isMutedForUser = userMuteStates.get(id) ?? false;
            const isSelf = id === userId;

            return (
              <li
                key={id}
                className={`flex items-center justify-between gap-2 p-1.5 rounded-md ${
                  isConnected && connections.has(id) ? "bg-green-50" : ""
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm lg:text-lg flex-shrink-0">
                    {id === currentDrawerId ? "✏️" : "👤"}
                  </span>
                  <span className="truncate text-xs lg:text-sm font-normal">
                    {name === currentPlayerName ? <b>{name} (You)</b> : name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-indigo-600 flex-shrink-0 text-xs lg:text-sm">
                    {score} pts
                  </span>
                  {audioEnabled && !isSelf && connections.has(id) && (
                    <span
                      className="p-1 text-gray-500"
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
              </li>
            );
          })
        ) : (
          <li className="text-gray-500 italic text-xs lg:text-sm">
            No players yet...
          </li>
        )}
      </ul>
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
