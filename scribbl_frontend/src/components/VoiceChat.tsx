"use client";

import React, { useEffect, useRef } from "react";
import { useWebRTCVoice } from "@/hooks/useWebRTCVoice";
import { usePlayerStore } from "@/store/usePlayerStore";

export default function VoiceChat() {
  const { players, userId } = usePlayerStore();
  const {
    isConnected,
    isMuted,
    audioEnabled,
    connections,
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
    voiceChatUsers,
    userMuteStates,
  } = useWebRTCVoice();

  const audioRefs = useRef<{ [userId: string]: HTMLAudioElement }>({});

  // Play remote audio streams
  useEffect(() => {
    connections.forEach((connection, remoteUserId) => {
      if (connection.remoteStream) {
        let audioElement = audioRefs.current[remoteUserId];

        if (!audioElement) {
          audioElement = new Audio();
          audioElement.autoplay = true;
          audioElement.controls = false;
          audioRefs.current[remoteUserId] = audioElement;
        }

        if (audioElement.srcObject !== connection.remoteStream) {
          audioElement.srcObject = connection.remoteStream;
          console.log(
            `[VoiceChat] Playing audio from ${
              players[remoteUserId] || remoteUserId
            }`
          );
        }
      }
    });

    // Clean up audio elements for disconnected users
    Object.keys(audioRefs.current).forEach((remoteUserId) => {
      if (!connections.has(remoteUserId)) {
        const audioElement = audioRefs.current[remoteUserId];
        if (audioElement) {
          audioElement.srcObject = null;
          delete audioRefs.current[remoteUserId];
        }
      }
    });
  }, [connections, players]);

  // Clean up audio elements on unmount
  useEffect(() => {
    return () => {
      Object.values(audioRefs.current).forEach((audio) => {
        audio.srcObject = null;
      });
      audioRefs.current = {};
    };
  }, []);

  const handleStartVoice = async () => {
    try {
      await startVoiceChat();
    } catch (error) {
      console.error("[VoiceChat] Failed to start voice chat:", error);

      // More specific error messages
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

  const connectedUsers = Array.from(connections.keys()).filter(
    (id) => connections.get(id)?.remoteStream
  );
  const voiceChatUsersList = Array.from(voiceChatUsers).filter(
    (id) => id !== userId
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Voice Chat</h3>
        <div className="flex items-center space-x-1">
          {isConnected && (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          )}
          <span className="text-sm text-gray-600">
            {voiceChatUsersList.length} connected
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Voice chat controls */}
        <div className="flex space-x-2">
          {!audioEnabled ? (
            <button
              onClick={handleStartVoice}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span>Start Voice</span>
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors duration-200 flex items-center justify-center space-x-2 ${
                  isMuted
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}
              >
                {isMuted ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                )}
                <span>{isMuted ? "Unmute" : "Mute"}</span>
              </button>

              <button
                onClick={stopVoiceChat}
                className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors duration-200"
                title="Stop Voice Chat"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Connected users list */}
        {audioEnabled && voiceChatUsersList.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Voice Chat Users:
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {voiceChatUsersList.map((playerId: string) => {
                const playerName = players[playerId] || `Player ${playerId}`;
                const isConnected =
                  connections.has(playerId) &&
                  connections.get(playerId)?.remoteStream;
                const isMuted = userMuteStates.get(playerId) || false;

                return (
                  <div
                    key={playerId}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                  >
                    <span className="text-sm text-gray-700 truncate">
                      {playerName}
                    </span>
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isConnected
                            ? "bg-green-500 animate-pulse"
                            : "bg-gray-300"
                        }`}
                        title={isConnected ? "Connected" : "Connecting..."}
                      />
                      {isConnected ? (
                        <div title={isMuted ? "Muted" : "Unmuted"}>
                          {isMuted ? (
                            <svg
                              className="w-4 h-4 text-red-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
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
                          ) : (
                            <svg
                              className="w-4 h-4 text-green-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                              />
                            </svg>
                          )}
                        </div>
                      ) : (
                        <svg
                          className="w-4 h-4 text-gray-400 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No other users message */}
        {voiceChatUsersList.length === 0 && audioEnabled && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              No other users in voice chat
            </p>
          </div>
        )}

        {/* {!audioEnabled && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              Start voice chat to talk with other players
            </p>
          </div>
        )} */}
      </div>
    </div>
  );
}
