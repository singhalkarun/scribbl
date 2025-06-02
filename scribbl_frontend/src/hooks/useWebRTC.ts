import { useEffect, useRef, useState, useCallback } from "react";
import SimplePeer from "simple-peer";
import { Channel } from "phoenix";

interface PeerConnection {
  peer: SimplePeer.Instance;
  userId: string;
  isInitiator: boolean;
}

interface WebRTCState {
  isAudioEnabled: boolean;
  isMuted: boolean;
  peers: Map<string, PeerConnection>;
  localStream: MediaStream | null;
  speakingUsers: Set<string>; // Track who is currently speaking
}

export interface WebRTCSignaling {
  sendOffer: (
    targetUserId: string,
    offer: SimplePeer.SignalData,
    fromUserId: string
  ) => void;
  sendAnswer: (
    targetUserId: string,
    answer: SimplePeer.SignalData,
    fromUserId: string
  ) => void;
  sendICECandidate: (
    targetUserId: string,
    candidate: SimplePeer.SignalData,
    fromUserId: string
  ) => void;
  handleOfferReceived: (
    fromUserId: string,
    offer: SimplePeer.SignalData
  ) => void;
  handleAnswerReceived: (
    fromUserId: string,
    answer: SimplePeer.SignalData
  ) => void;
  handleICECandidateReceived: (
    fromUserId: string,
    candidate: SimplePeer.SignalData
  ) => void;
}

export function useWebRTC(
  channel: Channel | null,
  currentUserId: string,
  connectedUsers: { [userId: string]: string }, // userId -> userName mapping
  isCurrentUserDrawing: boolean = false // Add drawer status
) {
  console.log(
    `[WebRTC] 🔄 useWebRTC called - userId=${currentUserId}, isDrawing=${isCurrentUserDrawing}, connectedUsers=${
      Object.keys(connectedUsers).length
    }`
  );

  const [state, setState] = useState<WebRTCState>({
    isAudioEnabled: true, // Auto-join everyone to voice chat
    isMuted: true, // But start muted
    peers: new Map(),
    localStream: null,
    speakingUsers: new Set(),
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(
    new Map()
  );
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const isStoppingRef = useRef(false);
  const speakingTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const hasRequestedMicPermission = useRef(false);
  const userExplicitlySetMute = useRef(false); // Track if user has explicitly set mute state

  // Auto-mute when user becomes drawer, but allow manual control for non-drawers
  useEffect(() => {
    console.log(
      `[WebRTC] 🎭 Auto-mute effect triggered - isDrawing=${isCurrentUserDrawing}, hasAudio=${
        state.isAudioEnabled
      }, hasStream=${!!state.localStream}`
    );

    if (state.isAudioEnabled && state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
        if (isCurrentUserDrawing) {
          // Force mute drawers
          console.log("[WebRTC] 🎨 FORCE MUTING - User is drawer");
          audioTrack.enabled = false;
          setState((prev) => ({ ...prev, isMuted: true }));
          console.log("[WebRTC] 🎨 Auto-muted as drawer");
        } else {
          // For non-drawers, respect their manual mute preference
          // Only update audio track, don't change state unless necessary
          console.log(
            `[WebRTC] 🎭 Non-drawer: setting audio track enabled = ${!state.isMuted} (current mute state: ${
              state.isMuted
            })`
          );
          audioTrack.enabled = !state.isMuted;
          console.log(
            `[WebRTC] 🎭 Non-drawer: audio track enabled = ${!state.isMuted}`
          );
        }
      } else {
        console.log("[WebRTC] ⚠️ No audio track found in auto-mute effect");
      }
    } else {
      console.log(
        "[WebRTC] ⚠️ Auto-mute effect: no audio enabled or no stream"
      );
    }
  }, [isCurrentUserDrawing, state.isAudioEnabled, state.localStream]);

  // Auto-start voice chat on component mount
  useEffect(() => {
    // Auto-join logic moved below - will add back after function is defined
    console.log("[WebRTC] Voice chat ready");
  }, []);

  // Speaking detection function
  const setupSpeakingDetection = useCallback(
    (audioElement: HTMLAudioElement, userId: string) => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }

      try {
        const audioContext = audioContextRef.current;
        const source = audioContext.createMediaElementSource(audioElement);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);
        analyser.connect(audioContext.destination);

        const checkSpeaking = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;

          if (average > 20) {
            // Threshold for speaking detection
            setState((prev) => ({
              ...prev,
              speakingUsers: new Set(prev.speakingUsers).add(userId),
            }));

            // Clear existing timeout
            const existingTimeout = speakingTimeouts.current.get(userId);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

            // Set new timeout to remove speaking indicator
            const timeout = setTimeout(() => {
              setState((prev) => {
                const newSpeakingUsers = new Set(prev.speakingUsers);
                newSpeakingUsers.delete(userId);
                return { ...prev, speakingUsers: newSpeakingUsers };
              });
            }, 1000); // Remove indicator after 1 second of silence

            speakingTimeouts.current.set(userId, timeout);
          }

          requestAnimationFrame(checkSpeaking);
        };

        checkSpeaking();
      } catch (error) {
        console.warn(
          `[WebRTC] Could not setup speaking detection for ${userId}:`,
          error
        );
      }
    },
    []
  );

  // Initialize audio stream
  const initializeAudio = useCallback(async () => {
    try {
      console.log("[WebRTC] Initializing audio stream...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setState((prev) => ({
        ...prev,
        localStream: stream,
        isAudioEnabled: true,
      }));
      console.log("[WebRTC] Audio stream initialized successfully");
      return stream;
    } catch (error) {
      console.error("[WebRTC] Failed to initialize audio:", error);
      throw error;
    }
  }, []);

  // Helper function to add peer to both state and ref
  const addPeerConnection = useCallback(
    (userId: string, peerConnection: PeerConnection) => {
      console.log(`[WebRTC] 📌 Adding peer connection for ${userId}`);
      peersRef.current.set(userId, peerConnection);
      setState((prev) => ({
        ...prev,
        peers: new Map(prev.peers).set(userId, peerConnection),
      }));
    },
    []
  );

  // Helper function to remove peer from both state and ref
  const removePeerConnection = useCallback((userId: string) => {
    console.log(`[WebRTC] 🗑️ Removing peer connection for ${userId}`);
    peersRef.current.delete(userId);
    setState((prev) => {
      const newPeers = new Map(prev.peers);
      newPeers.delete(userId);
      return { ...prev, peers: newPeers };
    });
  }, []);

  // Create peer connection for a specific user
  const createPeerConnection = useCallback(
    (
      targetUserId: string,
      isInitiator: boolean,
      localStream: MediaStream
    ): SimplePeer.Instance => {
      console.log(
        `[WebRTC] Creating peer connection with ${targetUserId}, initiator: ${isInitiator}`
      );

      const peer = new SimplePeer({
        initiator: isInitiator,
        trickle: false, // Disable trickle ICE for simplicity
        stream: localStream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      // Handle signaling data
      peer.on("signal", (data: SimplePeer.SignalData) => {
        console.log(
          `[WebRTC] Signal event for ${targetUserId}:`,
          data.type,
          data
        );

        if (!channel || !currentUserId) {
          console.warn(
            "[WebRTC] Cannot send signal - channel or userId missing"
          );
          return;
        }

        if (data.type === "offer") {
          console.log(`[WebRTC] Sending offer to ${targetUserId}`);
          channel.push("webrtc_offer", {
            target_user_id: targetUserId,
            offer: data,
            from_user_id: currentUserId,
          });
        } else if (data.type === "answer") {
          console.log(`[WebRTC] Sending answer to ${targetUserId}`);
          channel.push("webrtc_answer", {
            target_user_id: targetUserId,
            answer: data,
            from_user_id: currentUserId,
          });
        } else {
          // ICE candidate or other signaling data
          console.log(`[WebRTC] Sending ICE candidate to ${targetUserId}`);
          channel.push("webrtc_ice_candidate", {
            target_user_id: targetUserId,
            candidate: data,
            from_user_id: currentUserId,
          });
        }
      });

      // Handle incoming stream
      peer.on("stream", (remoteStream: MediaStream) => {
        console.log(
          `[WebRTC] ✅ Received remote stream from ${targetUserId}`,
          remoteStream
        );

        // Create or get audio element for this user
        let audioElement = remoteAudioElementsRef.current.get(targetUserId);
        if (!audioElement) {
          audioElement = new Audio();
          audioElement.autoplay = true;
          // TypeScript doesn't recognize playsInline on HTMLAudioElement, but it exists
          (audioElement as any).playsInline = true;
          audioElement.volume = 1.0; // Ensure volume is at max
          remoteAudioElementsRef.current.set(targetUserId, audioElement);
          console.log(`[WebRTC] Created new audio element for ${targetUserId}`);
        }

        audioElement.srcObject = remoteStream;
        audioElement
          .play()
          .then(() => {
            console.log(
              `[WebRTC] ✅ Successfully playing audio from ${targetUserId}`
            );
            // Setup speaking detection after audio starts playing
            setupSpeakingDetection(audioElement!, targetUserId);
          })
          .catch((error) => {
            console.error(
              `[WebRTC] ❌ Failed to play audio for ${targetUserId}:`,
              error
            );
          });
      });

      // Handle connection events
      peer.on("connect", () => {
        console.log(`[WebRTC] ✅ Successfully connected to ${targetUserId}`);
      });

      peer.on("close", () => {
        console.log(
          `[WebRTC] 🔄 Connection closed with ${targetUserId} (normal cleanup)`
        );
        // Clean up audio element
        const audioElement = remoteAudioElementsRef.current.get(targetUserId);
        if (audioElement) {
          audioElement.srcObject = null;
          remoteAudioElementsRef.current.delete(targetUserId);
        }
      });

      peer.on("error", (error) => {
        // Filter out expected errors during cleanup
        const errorMessage = error.message || error.toString();
        if (
          errorMessage.includes("User-Initiated Abort") ||
          errorMessage.includes("Close called") ||
          errorMessage.includes("Connection closed")
        ) {
          console.log(
            `[WebRTC] 🔄 Peer connection with ${targetUserId} closed normally`
          );
        } else {
          console.error(
            `[WebRTC] ❌ Peer connection error with ${targetUserId}:`,
            error
          );
        }
      });

      return peer;
    },
    [channel, currentUserId]
  );

  // Create peer connection without local stream (for auto-join)
  const createPeerConnectionWithoutStream = useCallback(
    (targetUserId: string, isInitiator: boolean): SimplePeer.Instance => {
      console.log(
        `[WebRTC] Creating peer connection with ${targetUserId} (no local stream), initiator: ${isInitiator}`
      );

      const peer = new SimplePeer({
        initiator: isInitiator,
        trickle: false,
        // No stream initially - will be added when user unmutes
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      // Handle signaling data
      peer.on("signal", (data: SimplePeer.SignalData) => {
        console.log(`[WebRTC] Signal event for ${targetUserId}:`, data.type);

        if (!channel || !currentUserId) {
          console.warn(
            "[WebRTC] Cannot send signal - channel or userId missing"
          );
          return;
        }

        if (data.type === "offer") {
          console.log(`[WebRTC] Sending offer to ${targetUserId}`);
          channel.push("webrtc_offer", {
            target_user_id: targetUserId,
            offer: data,
            from_user_id: currentUserId,
          });
        } else if (data.type === "answer") {
          console.log(`[WebRTC] Sending answer to ${targetUserId}`);
          channel.push("webrtc_answer", {
            target_user_id: targetUserId,
            answer: data,
            from_user_id: currentUserId,
          });
        } else {
          console.log(`[WebRTC] Sending ICE candidate to ${targetUserId}`);
          channel.push("webrtc_ice_candidate", {
            target_user_id: targetUserId,
            candidate: data,
            from_user_id: currentUserId,
          });
        }
      });

      // Handle incoming stream
      peer.on("stream", (remoteStream: MediaStream) => {
        console.log(`[WebRTC] ✅ Received remote stream from ${targetUserId}`);

        // Create or get audio element for this user
        let audioElement = remoteAudioElementsRef.current.get(targetUserId);
        if (!audioElement) {
          audioElement = new Audio();
          audioElement.autoplay = true;
          (audioElement as any).playsInline = true;
          audioElement.volume = 1.0;
          remoteAudioElementsRef.current.set(targetUserId, audioElement);
        }

        audioElement.srcObject = remoteStream;
        audioElement
          .play()
          .then(() => {
            console.log(`[WebRTC] ✅ Playing audio from ${targetUserId}`);
            setupSpeakingDetection(audioElement!, targetUserId);
          })
          .catch((error) => {
            console.error(
              `[WebRTC] ❌ Failed to play audio for ${targetUserId}:`,
              error
            );
          });
      });

      // Handle connection events
      peer.on("connect", () => {
        console.log(`[WebRTC] ✅ Connected to ${targetUserId}`);
      });

      peer.on("close", () => {
        console.log(`[WebRTC] 🔄 Connection closed with ${targetUserId}`);
        const audioElement = remoteAudioElementsRef.current.get(targetUserId);
        if (audioElement) {
          audioElement.srcObject = null;
          remoteAudioElementsRef.current.delete(targetUserId);
        }
      });

      peer.on("error", (error) => {
        const errorMessage = error.message || error.toString();
        if (
          errorMessage.includes("User-Initiated Abort") ||
          errorMessage.includes("Close called") ||
          errorMessage.includes("Connection closed")
        ) {
          console.log(
            `[WebRTC] 🔄 Peer connection with ${targetUserId} closed normally`
          );
        } else {
          console.error(
            `[WebRTC] ❌ Peer connection error with ${targetUserId}:`,
            error
          );
        }
      });

      return peer;
    },
    [channel, currentUserId, setupSpeakingDetection]
  );

  // Stop voice chat
  const stopVoiceChat = useCallback(() => {
    console.log("[WebRTC] 🛑 Stopping voice chat...");
    isStoppingRef.current = true;

    // Close all peer connections
    peersRef.current.forEach(({ peer, userId }) => {
      console.log(`[WebRTC] 🔄 Closing connection with ${userId}`);
      peer.destroy();
    });

    // Stop local stream
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => track.stop());
      console.log("[WebRTC] 🔇 Stopped local audio stream");
    }

    // Clean up audio elements
    remoteAudioElementsRef.current.forEach((audioElement, userId) => {
      console.log(`[WebRTC] 🧹 Cleaning up audio element for ${userId}`);
      audioElement.srcObject = null;
    });
    remoteAudioElementsRef.current.clear();

    // Clear refs and state
    peersRef.current.clear();
    setState({
      isAudioEnabled: false,
      isMuted: true,
      peers: new Map(),
      localStream: null,
      speakingUsers: new Set(),
    });

    // Reset stopping flag after a brief delay
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 1000);

    console.log("[WebRTC] ✅ Voice chat stopped successfully");
  }, [state.localStream]);

  // Initialize audio and establish connections with all users
  const initializeAudioAndConnections = useCallback(async () => {
    // Auto-join without microphone permission - just mark as enabled
    console.log("[WebRTC] Auto-joining voice chat (no mic permission yet)...");

    setState((prev) => ({
      ...prev,
      isAudioEnabled: true,
      isMuted: true, // Start muted (no mic access yet)
    }));

    // Create peer connections for all other users (without local stream initially)
    Object.keys(connectedUsers).forEach((userId) => {
      if (userId !== currentUserId && !peersRef.current.has(userId)) {
        const isInitiator = currentUserId < userId;

        // Create peer connection without local stream initially
        const peer = createPeerConnectionWithoutStream(userId, isInitiator);

        const peerConnection = {
          peer,
          userId,
          isInitiator,
        };

        addPeerConnection(userId, peerConnection);
      }
    });

    console.log("[WebRTC] ✅ Auto-joined voice chat (ready for unmute)");
  }, [currentUserId, connectedUsers, addPeerConnection]);

  // Toggle mute (moved here to access initializeAudioAndConnections)
  const toggleMute = useCallback(async () => {
    console.log(
      `[WebRTC] 🔘 toggleMute called - current state: isMuted=${
        state.isMuted
      }, hasStream=${!!state.localStream}, isDrawing=${isCurrentUserDrawing}`
    );

    // Prevent drawer from unmuting
    if (isCurrentUserDrawing) {
      console.log("[WebRTC] Drawer cannot unmute - auto-muted for fairness");
      return;
    }

    // If we don't have a local stream yet, request microphone permission
    if (!state.localStream) {
      try {
        console.log(
          "[WebRTC] Requesting microphone permission for first unmute..."
        );
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        console.log(
          "[WebRTC] 🎤 Microphone permission granted, setting unmuted state..."
        );
        setState((prev) => {
          console.log(`[WebRTC] State update: ${prev.isMuted} -> false`);
          return {
            ...prev,
            localStream: stream,
            isMuted: false, // Unmute since user requested it
          };
        });

        // Mark that user has explicitly set mute state
        userExplicitlySetMute.current = true;

        // Add stream to all existing peer connections
        peersRef.current.forEach(({ peer, userId }) => {
          console.log(`[WebRTC] Adding local stream to peer ${userId}`);
          peer.addStream(stream);
        });

        console.log("[WebRTC] ✅ Microphone permission granted and unmuted");
        return;
      } catch (error) {
        console.error("[WebRTC] ❌ Microphone permission denied:", error);

        // Show user-friendly error message
        if (error instanceof Error) {
          if (error.name === "NotAllowedError") {
            alert(
              "Microphone access was denied. Please allow microphone access in your browser settings and try again."
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
        return;
      }
    }

    // Normal mute/unmute toggle if we already have a stream
    if (state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
        const newMutedState = !state.isMuted;
        audioTrack.enabled = !newMutedState; // Enable track when not muted

        console.log(
          `[WebRTC] 🔄 Toggling mute: ${state.isMuted} -> ${newMutedState}`
        );
        setState((prev) => ({ ...prev, isMuted: newMutedState }));
        console.log(`[WebRTC] Audio ${newMutedState ? "muted" : "unmuted"}`);

        // Mark that user has explicitly set mute state
        userExplicitlySetMute.current = true;
      }
    } else {
      // If no stream and no connections, try to auto-join first
      console.log("[WebRTC] No voice chat connection - auto-joining...");
      initializeAudioAndConnections();
    }
  }, [
    state.localStream,
    state.isMuted,
    isCurrentUserDrawing,
    initializeAudioAndConnections,
  ]);

  // Auto-join voice chat when users are present
  useEffect(() => {
    if (
      currentUserId &&
      Object.keys(connectedUsers).length > 1 &&
      !state.isAudioEnabled // Only auto-join if not already in voice chat
    ) {
      console.log(
        "[WebRTC] Auto-joining voice chat and establishing connections..."
      );
      initializeAudioAndConnections();
    }
  }, [
    currentUserId,
    connectedUsers,
    state.isAudioEnabled, // Changed from state.localStream
    initializeAudioAndConnections,
  ]);

  // Handle new user joining
  const handleUserJoined = useCallback(
    (userId: string) => {
      if (userId === currentUserId) {
        return;
      }

      console.log(`[WebRTC] User ${userId} joined`);

      // If we're in voice chat and have a stream, create connection with stream
      if (state.isAudioEnabled && state.localStream) {
        const isInitiator = currentUserId < userId;
        if (isInitiator && !peersRef.current.has(userId)) {
          console.log(
            `[WebRTC] Creating peer connection with ${userId} (with stream)`
          );
          const peer = createPeerConnection(userId, true, state.localStream);

          const peerConnection = {
            peer,
            userId,
            isInitiator: true,
          };

          addPeerConnection(userId, peerConnection);
        }
      }
      // If we're in voice chat but no stream yet, create connection without stream
      else if (state.isAudioEnabled && !state.localStream) {
        const isInitiator = currentUserId < userId;
        if (isInitiator && !peersRef.current.has(userId)) {
          console.log(
            `[WebRTC] Creating peer connection with ${userId} (no stream yet)`
          );
          const peer = createPeerConnectionWithoutStream(userId, true);

          const peerConnection = {
            peer,
            userId,
            isInitiator: true,
          };

          addPeerConnection(userId, peerConnection);
        }
      }
      // If not in voice chat yet, auto-join now
      else if (
        !state.isAudioEnabled &&
        Object.keys(connectedUsers).length > 1
      ) {
        console.log(`[WebRTC] User joined, auto-joining voice chat...`);
        initializeAudioAndConnections();
      }
    },
    [
      currentUserId,
      state.isAudioEnabled,
      state.localStream,
      connectedUsers,
      createPeerConnection,
      createPeerConnectionWithoutStream,
      addPeerConnection,
      initializeAudioAndConnections,
    ]
  );

  // Handle user leaving
  const handleUserLeft = useCallback(
    (userId: string) => {
      const peerConnection = peersRef.current.get(userId);
      if (peerConnection) {
        console.log(
          `[WebRTC] 👋 User ${userId} left voice chat, closing peer connection`
        );
        peerConnection.peer.destroy();

        // Clean up audio element
        const audioElement = remoteAudioElementsRef.current.get(userId);
        if (audioElement) {
          audioElement.srcObject = null;
          remoteAudioElementsRef.current.delete(userId);
          console.log(`[WebRTC] 🧹 Cleaned up audio for ${userId}`);
        }

        removePeerConnection(userId);
        console.log(
          `[WebRTC] ✅ Successfully cleaned up connection with ${userId}`
        );
      }
    },
    [removePeerConnection]
  );

  // WebRTC signaling handlers
  const signaling: WebRTCSignaling = {
    sendOffer: (targetUserId, offer, fromUserId) => {
      // This is handled automatically by the peer 'signal' event
    },
    sendAnswer: (targetUserId, answer, fromUserId) => {
      // This is handled automatically by the peer 'signal' event
    },
    sendICECandidate: (targetUserId, candidate, fromUserId) => {
      // This is handled automatically by the peer 'signal' event
    },
    handleOfferReceived: (fromUserId, offer) => {
      console.log(`[WebRTC] 📥 Received offer from ${fromUserId}`, offer);

      // First check: If user has explicitly set their mute preference, don't override it
      if (userExplicitlySetMute.current) {
        console.log(
          "[WebRTC] ✅ User has explicitly set mute preference - not updating state"
        );
      }
      // Second check: If user already has a stream, they're properly set up - don't touch state
      else if (state.localStream) {
        console.log("[WebRTC] ✅ User already has stream - not updating state");
      }
      // Third check: If not in voice chat yet, auto-join without microphone
      else if (!state.isAudioEnabled) {
        console.log(
          "[WebRTC] ⚠️ Not in voice chat when offer received - auto-joining without mic"
        );

        setState((prev) => {
          console.log(
            `[WebRTC] Auto-join state update: isAudioEnabled=${prev.isAudioEnabled} -> true, isMuted=${prev.isMuted} -> true`
          );
          return {
            ...prev,
            isAudioEnabled: true,
            isMuted: true, // Start muted (no mic access yet)
          };
        });
      }
      // Fourth check: If already in voice chat but don't have stream
      else {
        console.log(
          "[WebRTC] ⚠️ In voice chat but no stream - enabling audio without changing mute state"
        );
        setState((prev) => {
          console.log(
            `[WebRTC] Enable audio state update: keeping isMuted=${prev.isMuted}`
          );
          return {
            ...prev,
            isAudioEnabled: true,
            // Don't override isMuted - keep user's preference
          };
        });
      }

      // Create a peer connection as answerer if we don't have one
      if (!peersRef.current.has(fromUserId)) {
        console.log(
          `[WebRTC] 🔄 Creating new peer connection as answerer for ${fromUserId}`
        );

        // Use the appropriate peer creation method based on whether we have a stream
        const peer = state.localStream
          ? createPeerConnection(fromUserId, false, state.localStream)
          : createPeerConnectionWithoutStream(fromUserId, false);

        const peerConnection = {
          peer,
          userId: fromUserId,
          isInitiator: false,
        };

        addPeerConnection(fromUserId, peerConnection);

        // Signal the offer to the peer
        console.log(`[WebRTC] 📤 Signaling offer to peer for ${fromUserId}`);
        peer.signal(offer);
      } else {
        // Signal to existing peer
        console.log(
          `[WebRTC] 📤 Signaling offer to existing peer for ${fromUserId}`
        );
        const peerConnection = peersRef.current.get(fromUserId);
        if (peerConnection) {
          peerConnection.peer.signal(offer);
        }
      }
    },
    handleAnswerReceived: (fromUserId, answer) => {
      console.log(`[WebRTC] 📥 Received answer from ${fromUserId}`, answer);
      const peerConnection = peersRef.current.get(fromUserId);
      if (peerConnection) {
        console.log(`[WebRTC] 📤 Signaling answer to peer for ${fromUserId}`);
        peerConnection.peer.signal(answer);
      } else {
        console.warn(
          `[WebRTC] ❌ No peer connection found for ${fromUserId} when handling answer. Available peers:`,
          Array.from(peersRef.current.keys())
        );
      }
    },
    handleICECandidateReceived: (fromUserId, candidate) => {
      console.log(
        `[WebRTC] 📥 Received ICE candidate from ${fromUserId}`,
        candidate
      );
      const peerConnection = peersRef.current.get(fromUserId);
      if (peerConnection) {
        console.log(
          `[WebRTC] 📤 Signaling ICE candidate to peer for ${fromUserId}`
        );
        peerConnection.peer.signal(candidate);
      } else {
        console.warn(
          `[WebRTC] ❌ No peer connection found for ${fromUserId} when handling ICE candidate. Available peers:`,
          Array.from(peersRef.current.keys())
        );
      }
    },
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoiceChat();
    };
  }, []);

  return {
    isAudioEnabled: state.isAudioEnabled,
    isMuted: state.isMuted,
    connectedPeers: Array.from(peersRef.current.keys()),
    speakingUsers: Array.from(state.speakingUsers),
    stopVoiceChat,
    toggleMute,
    handleUserJoined,
    handleUserLeft,
    signaling,
  };
}
