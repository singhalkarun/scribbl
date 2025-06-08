import { useEffect, useState, useCallback, useRef } from "react";
import { Channel } from "phoenix";
import { usePlayerStore } from "@/store/usePlayerStore";

interface WebRTCConnection {
  peerConnection: RTCPeerConnection;
  remoteStream: MediaStream | null;
  userId: string;
}

interface WebRTCVoiceState {
  isConnected: boolean;
  isMuted: boolean;
  localStream: MediaStream | null;
  connections: Map<string, WebRTCConnection>;
  audioEnabled: boolean;
  voiceChatUsers: Set<string>; // Track which users are in voice chat
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
  });

  const connectionsRef = useRef<Map<string, WebRTCConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

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
      }
    },
    [channel, userId, createPeerConnection, state.audioEnabled]
  );

  // Handle incoming answer
  const handleAnswer = useCallback(
    async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
      const connection = connectionsRef.current.get(fromUserId);
      if (!connection) return;

      console.log(`[WebRTC] Handling answer from ${fromUserId}`);

      try {
        await connection.peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
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
      if (!connection) return;

      console.log(`[WebRTC] Handling ICE candidate from ${fromUserId}`);

      try {
        await connection.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate)
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

      // Add current user to voice chat users
      setState((prev) => ({
        ...prev,
        voiceChatUsers: new Set([...prev.voiceChatUsers, userId]),
      }));

      // Announce that this user joined voice chat
      if (channel) {
        channel.push("voice_chat_joined", { user_id: userId });
      }

      // Create offers for other users who are already in voice chat
      const otherVoiceUsers = Array.from(state.voiceChatUsers).filter(
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
  }, [initializeMedia, createOffer, channel, userId, state.voiceChatUsers]);

  // Stop voice chat
  const stopVoiceChat = useCallback(() => {
    // Announce that this user left voice chat
    if (channel) {
      channel.push("voice_chat_left", { user_id: userId });
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

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isMuted: false,
      localStream: null,
      connections: new Map(),
      audioEnabled: false,
      voiceChatUsers: new Set(
        [...prev.voiceChatUsers].filter((id) => id !== userId)
      ),
    }));

    console.log("[WebRTC] Voice chat stopped");
  }, [channel, userId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setState((prev) => ({
          ...prev,
          isMuted: !audioTrack.enabled,
        }));
        console.log(
          `[WebRTC] Audio ${audioTrack.enabled ? "unmuted" : "muted"}`
        );
      }
    }
  }, []);

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
      channel.on("voice_chat_joined", ({ user_id }) => {
        console.log(`[WebRTC] User ${user_id} joined voice chat`);
        setState((prev) => ({
          ...prev,
          voiceChatUsers: new Set([...prev.voiceChatUsers, user_id]),
        }));

        // If we're also in voice chat, create an offer to the new user
        if (state.audioEnabled && user_id !== userId) {
          createOffer(user_id);
        }
      }),
      channel.on("voice_chat_left", ({ user_id }) => {
        console.log(`[WebRTC] User ${user_id} left voice chat`);
        setState((prev) => ({
          ...prev,
          voiceChatUsers: new Set(
            [...prev.voiceChatUsers].filter((id) => id !== user_id)
          ),
        }));

        // Close connection to user who left
        const connection = connectionsRef.current.get(user_id);
        if (connection) {
          connection.peerConnection.close();
          connectionsRef.current.delete(user_id);
          setState((prev) => ({
            ...prev,
            connections: new Map(connectionsRef.current),
          }));
        }
      }),
    ];

    return () => {
      const eventNames = [
        "webrtc_offer_received",
        "webrtc_answer_received",
        "webrtc_ice_candidate_received",
        "voice_chat_joined",
        "voice_chat_left",
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
    state.audioEnabled,
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
    startVoiceChat,
    stopVoiceChat,
    toggleMute,
  };
}
