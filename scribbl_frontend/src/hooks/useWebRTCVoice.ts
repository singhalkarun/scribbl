import { useEffect, useState, useCallback, useRef } from "react";
import { Channel } from "phoenix";
import { usePlayerStore } from "@/store/usePlayerStore";

interface WebRTCConnection {
  peerConnection: RTCPeerConnection;
  remoteStream: MediaStream | null;
  userId: string;
  pendingIceCandidates?: RTCIceCandidateInit[];
}

interface WebRTCVoiceState {
  isConnected: boolean;
  isMuted: boolean;
  localStream: MediaStream | null;
  connections: Map<string, WebRTCConnection>;
  audioEnabled: boolean;
  voiceChatUsers: Set<string>; // Track which users are in voice chat
  userMuteStates: Map<string, boolean>; // Track mute state of each user
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:relay1.expressturn.com:3480",
      username: "000000002064736110",
      credential: "bQkxpe2zHInty7Gz5sv3zpmA97s=",
    },
  ],
};

export function useWebRTCVoice() {
  const { channel, userId, players } = usePlayerStore();
  const [state, setState] = useState<WebRTCVoiceState>({
    isConnected: false,
    isMuted: false,
    localStream: null,
    connections: new Map(),
    audioEnabled: false,
    voiceChatUsers: new Set(),
    userMuteStates: new Map(),
  });

  const connectionsRef = useRef<Map<string, WebRTCConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const voiceChatUsersRef = useRef<Set<string>>(new Set());
  const audioEnabledRef = useRef<boolean>(false);

  // Process queued ICE candidates after remote description is set
  const processQueuedIceCandidates = useCallback(
    async (connection: WebRTCConnection, fromUserId: string) => {
      if (
        connection.pendingIceCandidates &&
        connection.pendingIceCandidates.length > 0
      ) {
        console.log(
          `[WebRTC] Processing ${connection.pendingIceCandidates.length} queued ICE candidates for ${fromUserId}`
        );

        for (const candidate of connection.pendingIceCandidates) {
          try {
            await connection.peerConnection.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
            console.log(
              `[WebRTC] Added queued ICE candidate for ${fromUserId}`
            );
          } catch (error) {
            console.error(
              `[WebRTC] Failed to add queued ICE candidate for ${fromUserId}:`,
              error
            );
          }
        }

        // Clear the queue
        connection.pendingIceCandidates = [];
      }
    },
    []
  );

  // Initialize local media stream
  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      localStreamRef.current = stream;
      audioEnabledRef.current = true;
      setState((prev) => ({
        ...prev,
        localStream: stream,
        audioEnabled: true,
      }));

      console.log("[WebRTC] Local media stream initialized");
      return stream;
    } catch (error) {
      console.error("[WebRTC] Failed to get user media:", error);
      throw error;
    }
  }, []);

  // Create peer connection for a specific user
  const createPeerConnection = useCallback(
    (targetUserId: string): RTCPeerConnection => {
      const peerConnection = new RTCPeerConnection(ICE_SERVERS);

      // Add local stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStreamRef.current!);
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        console.log(`[WebRTC] Received remote stream from ${targetUserId}`);

        connectionsRef.current.set(targetUserId, {
          ...connectionsRef.current.get(targetUserId)!,
          remoteStream,
        });

        setState((prev) => ({
          ...prev,
          connections: new Map(connectionsRef.current),
        }));
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && channel) {
          console.log(`[WebRTC] Sending ICE candidate to ${targetUserId}`);
          channel.push("webrtc_ice_candidate", {
            target_user_id: targetUserId,
            candidate: event.candidate.toJSON(),
            from_user_id: userId,
          });
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        console.log(
          `[WebRTC] Connection state with ${targetUserId}: ${peerConnection.connectionState}`
        );

        if (peerConnection.connectionState === "connected") {
          setState((prev) => ({
            ...prev,
            isConnected: true,
          }));
        } else if (
          peerConnection.connectionState === "disconnected" ||
          peerConnection.connectionState === "failed"
        ) {
          // Clean up connection
          connectionsRef.current.delete(targetUserId);
          setState((prev) => ({
            ...prev,
            connections: new Map(connectionsRef.current),
          }));
        }
      };

      return peerConnection;
    },
    [channel, userId]
  );

  // Create offer for a peer
  const createOffer = useCallback(
    async (targetUserId: string) => {
      if (!channel || !userId) return;

      // Check if we already have a connection
      const existingConnection = connectionsRef.current.get(targetUserId);
      if (existingConnection) {
        console.log(
          `[WebRTC] Connection to ${targetUserId} already exists, state: ${existingConnection.peerConnection.signalingState}`
        );
        return;
      }

      console.log(`[WebRTC] Creating offer for ${targetUserId}`);

      const peerConnection = createPeerConnection(targetUserId);
      connectionsRef.current.set(targetUserId, {
        peerConnection,
        remoteStream: null,
        userId: targetUserId,
      });

      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        channel.push("webrtc_offer", {
          target_user_id: targetUserId,
          offer: offer,
          from_user_id: userId,
        });
      } catch (error) {
        console.error(
          `[WebRTC] Failed to create offer for ${targetUserId}:`,
          error
        );
        // Clean up failed connection
        connectionsRef.current.delete(targetUserId);
      }
    },
    [channel, userId, createPeerConnection]
  );

  // Handle incoming offer
  const handleOffer = useCallback(
    async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
      if (!channel || !userId || !state.audioEnabled) {
        console.log(
          `[WebRTC] Ignoring offer from ${fromUserId} - voice chat not active`
        );
        return;
      }

      console.log(`[WebRTC] Handling offer from ${fromUserId}`);

      // Check if we already have a connection
      const existingConnection = connectionsRef.current.get(fromUserId);
      if (existingConnection) {
        console.log(
          `[WebRTC] Connection to ${fromUserId} already exists, state: ${existingConnection.peerConnection.signalingState}`
        );

        // Handle glare (simultaneous offers) - use user ID comparison to decide who backs off
        if (
          existingConnection.peerConnection.signalingState ===
          "have-local-offer"
        ) {
          if (userId < fromUserId) {
            console.log(
              `[WebRTC] Glare detected with ${fromUserId}, we back off (lower ID)`
            );
            // Close existing connection and handle the incoming offer
            existingConnection.peerConnection.close();
            connectionsRef.current.delete(fromUserId);
          } else {
            console.log(
              `[WebRTC] Glare detected with ${fromUserId}, they should back off (higher ID)`
            );
            return; // Ignore their offer
          }
        } else {
          console.log(
            `[WebRTC] Ignoring offer, connection already in progress`
          );
          return;
        }
      }

      const peerConnection = createPeerConnection(fromUserId);
      connectionsRef.current.set(fromUserId, {
        peerConnection,
        remoteStream: null,
        userId: fromUserId,
      });

      try {
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer)
        );

        // Process any queued ICE candidates now that remote description is set
        const connection = connectionsRef.current.get(fromUserId);
        if (connection) {
          await processQueuedIceCandidates(connection, fromUserId);
        }

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        channel.push("webrtc_answer", {
          target_user_id: fromUserId,
          answer: answer,
          from_user_id: userId,
        });
      } catch (error) {
        console.error(
          `[WebRTC] Failed to handle offer from ${fromUserId}:`,
          error
        );
        // Clean up failed connection
        connectionsRef.current.delete(fromUserId);
      }
    },
    [
      channel,
      userId,
      createPeerConnection,
      state.audioEnabled,
      processQueuedIceCandidates,
    ]
  );

  // Handle incoming answer
  const handleAnswer = useCallback(
    async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
      const connection = connectionsRef.current.get(fromUserId);
      if (!connection) {
        console.log(
          `[WebRTC] No connection found for answer from ${fromUserId}`
        );
        return;
      }

      console.log(`[WebRTC] Handling answer from ${fromUserId}`);
      console.log(
        `[WebRTC] Current signaling state: ${connection.peerConnection.signalingState}`
      );

      // Only process answer if we're in the correct state
      if (connection.peerConnection.signalingState !== "have-local-offer") {
        console.warn(
          `[WebRTC] Ignoring answer from ${fromUserId}, wrong state: ${connection.peerConnection.signalingState}`
        );
        return;
      }

      try {
        await connection.peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
        console.log(
          `[WebRTC] Successfully set remote answer from ${fromUserId}`
        );

        // Process any queued ICE candidates now that remote description is set
        await processQueuedIceCandidates(connection, fromUserId);
      } catch (error) {
        console.error(
          `[WebRTC] Failed to handle answer from ${fromUserId}:`,
          error
        );
      }
    },
    []
  );

  // Handle incoming ICE candidate
  const handleIceCandidate = useCallback(
    async (fromUserId: string, candidate: RTCIceCandidateInit) => {
      const connection = connectionsRef.current.get(fromUserId);
      if (!connection) {
        console.log(
          `[WebRTC] No connection found for ICE candidate from ${fromUserId}`
        );
        return;
      }

      console.log(`[WebRTC] Handling ICE candidate from ${fromUserId}`);
      console.log(
        `[WebRTC] Connection state: ${connection.peerConnection.connectionState}, signaling state: ${connection.peerConnection.signalingState}`
      );

      // Check if remote description is set
      if (!connection.peerConnection.remoteDescription) {
        console.log(
          `[WebRTC] Remote description not set yet for ${fromUserId}, queueing ICE candidate`
        );

        // Queue the ICE candidate for later processing
        if (!connection.pendingIceCandidates) {
          connection.pendingIceCandidates = [];
        }
        connection.pendingIceCandidates.push(candidate);
        return;
      }

      // Check if connection is in a valid state for ICE candidates
      const validStates = ["have-remote-offer", "have-local-offer", "stable"];
      if (!validStates.includes(connection.peerConnection.signalingState)) {
        console.warn(
          `[WebRTC] Invalid signaling state for ICE candidate from ${fromUserId}: ${connection.peerConnection.signalingState}`
        );
        return;
      }

      try {
        await connection.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate)
        );
        console.log(
          `[WebRTC] Successfully added ICE candidate from ${fromUserId}`
        );
      } catch (error) {
        console.error(
          `[WebRTC] Failed to handle ICE candidate from ${fromUserId}:`,
          error
        );
      }
    },
    []
  );

  // Start voice chat
  const startVoiceChat = useCallback(async () => {
    try {
      await initializeMedia();

      // Voice chat users will be updated via voice_state_changed event from backend

      // Join the voice room
      if (channel) {
        channel.push("voice_join", {});
      }

      // Create offers for other users who are already in voice chat
      const otherVoiceUsers = Array.from(voiceChatUsersRef.current).filter(
        (id) => id !== userId
      );
      for (const targetUserId of otherVoiceUsers) {
        await createOffer(targetUserId);
      }

      console.log("[WebRTC] Voice chat started");
    } catch (error) {
      console.error("[WebRTC] Failed to start voice chat:", error);
      throw error;
    }
  }, [initializeMedia, createOffer, channel, userId]);

  // Stop voice chat
  const stopVoiceChat = useCallback(() => {
    // Leave the voice room
    if (channel) {
      channel.push("voice_leave", {});
    }

    // Close all peer connections
    connectionsRef.current.forEach((connection) => {
      connection.peerConnection.close();
    });
    connectionsRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    audioEnabledRef.current = false;
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isMuted: false,
      localStream: null,
      connections: new Map(),
      audioEnabled: false,
      userMuteStates: new Map(),
      // voiceChatUsers will be updated via voice_state_changed event from backend
    }));

    console.log("[WebRTC] Voice chat stopped");
  }, [channel, userId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current && channel) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMutedState = !audioTrack.enabled;

        setState((prev) => ({
          ...prev,
          isMuted: newMutedState,
        }));

        // Send mute state to backend
        channel.push("voice_mute", {
          muted: newMutedState,
        });

        console.log(
          `[WebRTC] Audio ${audioTrack.enabled ? "unmuted" : "muted"}`
        );
      }
    }
  }, [channel]);

  // Set up channel listeners
  useEffect(() => {
    if (!channel) return;

    const listeners = [
      channel.on("webrtc_offer_received", ({ from_user_id, offer }) => {
        handleOffer(from_user_id, offer);
      }),
      channel.on("webrtc_answer_received", ({ from_user_id, answer }) => {
        handleAnswer(from_user_id, answer);
      }),
      channel.on(
        "webrtc_ice_candidate_received",
        ({ from_user_id, candidate }) => {
          handleIceCandidate(from_user_id, candidate);
        }
      ),
      channel.on(
        "voice_state_changed",
        ({
          action,
          user_id,
          voice_members,
        }: {
          action: "joined" | "left" | "muted" | "state";
          user_id?: string;
          voice_members?: Record<string, boolean>;
        }) => {
          console.log(`[WebRTC] Voice state changed:`, {
            action,
            user_id,
            voice_members,
          });

          if (action === "joined" && user_id) {
            // Someone joined voice chat - add them to our local state
            const newVoiceChatUsers = new Set([
              ...voiceChatUsersRef.current,
              user_id,
            ]);
            voiceChatUsersRef.current = newVoiceChatUsers;
            setState((prev) => {
              const newState = {
                ...prev,
                voiceChatUsers: newVoiceChatUsers,
              };

              // If we're also in voice chat and it's not us, create an offer
              // Use ref to get current audio state immediately
              if (audioEnabledRef.current && user_id !== userId) {
                // Only create offer if we don't already have a connection in progress
                const existingConnection = connectionsRef.current.get(user_id);
                if (!existingConnection) {
                  console.log(
                    `[WebRTC] User ${user_id} joined voice chat, creating offer`
                  );
                  // Use setTimeout to avoid blocking setState
                  setTimeout(() => createOffer(user_id), 0);
                } else {
                  console.log(
                    `[WebRTC] Connection to ${user_id} already exists, skipping offer`
                  );
                }
              }

              return newState;
            });
          } else if (action === "left" && user_id) {
            // Someone left voice chat - remove them from our local state
            const newVoiceChatUsers = new Set(
              [...voiceChatUsersRef.current].filter((id) => id !== user_id)
            );
            voiceChatUsersRef.current = newVoiceChatUsers;
            setState((prev) => {
              const newUserMuteStates = new Map(prev.userMuteStates);
              newUserMuteStates.delete(user_id);

              return {
                ...prev,
                voiceChatUsers: newVoiceChatUsers,
                userMuteStates: newUserMuteStates,
              };
            });

            // Close their connection if we have one
            if (user_id !== userId) {
              console.log(
                `[WebRTC] User ${user_id} left voice chat, closing connection`
              );
              const connection = connectionsRef.current.get(user_id);
              if (connection) {
                connection.peerConnection.close();
                connectionsRef.current.delete(user_id);
                setState((prev) => ({
                  ...prev,
                  connections: new Map(connectionsRef.current),
                }));
              }
            }
          } else if (action === "muted" && user_id && voice_members) {
            // Someone changed their mute state - update our local state
            const userMuteState = voice_members[user_id];
            if (userMuteState !== undefined) {
              setState((prev) => {
                const newUserMuteStates = new Map(prev.userMuteStates);
                newUserMuteStates.set(user_id, userMuteState);

                return {
                  ...prev,
                  userMuteStates: newUserMuteStates,
                };
              });

              console.log(
                `[WebRTC] User ${user_id} ${
                  userMuteState ? "muted" : "unmuted"
                }`
              );
            }
          } else if (action === "state" && voice_members) {
            // Full state update - use authoritative voice_members object
            const newVoiceChatUsers = new Set(Object.keys(voice_members));
            const newUserMuteStates = new Map(Object.entries(voice_members));

            voiceChatUsersRef.current = newVoiceChatUsers;
            setState((prev) => {
              const newState = {
                ...prev,
                voiceChatUsers: newVoiceChatUsers,
                userMuteStates: newUserMuteStates,
              };

              // Connect to all voice chat users if we're also in voice chat
              // Use ref to get current audio state immediately
              if (audioEnabledRef.current) {
                const otherVoiceUsers = Object.keys(voice_members).filter(
                  (id) => id !== userId
                );
                console.log(
                  `[WebRTC] Voice state update, connecting to users:`,
                  otherVoiceUsers
                );
                // Use setTimeout to avoid blocking setState
                setTimeout(() => {
                  otherVoiceUsers.forEach((targetUserId) => {
                    // Only create offer if we don't already have a connection
                    if (!connectionsRef.current.has(targetUserId)) {
                      createOffer(targetUserId);
                    }
                  });
                }, 0);
              }

              return newState;
            });
          }
        }
      ),
    ];

    return () => {
      const eventNames = [
        "webrtc_offer_received",
        "webrtc_answer_received",
        "webrtc_ice_candidate_received",
        "voice_state_changed",
      ];
      listeners.forEach((listener, index) => {
        channel.off(eventNames[index], listener);
      });
    };
  }, [
    channel,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    userId,
    createOffer,
  ]);

  // This effect is no longer needed as we handle voice chat joins via channel events

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopVoiceChat();
    };
  }, [stopVoiceChat]);

  return {
    isConnected: state.isConnected,
    isMuted: state.isMuted,
    audioEnabled: state.audioEnabled,
    connections: state.connections,
    voiceChatUsers: state.voiceChatUsers,
    userMuteStates: state.userMuteStates,
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
  };
}
