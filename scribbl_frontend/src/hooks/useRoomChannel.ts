import { useEffect, useState, useCallback, useRef } from "react";
import { Channel, Socket } from "phoenix";
import { usePlayerStore, Message } from "@/store/usePlayerStore";

type ConnectionState = "idle" | "connecting" | "joined" | "error" | "leaving";

// Helper function to get name from presence meta
const getUserNameFromMeta = (meta: any[] | undefined): string | null => {
  return meta?.[0]?.name;
};

export function useRoomChannel() {
  const {
    socket,
    playerName,
    roomId,
    avatar,
    setChannel,
    setUserId,
    updatePlayers,
    applyPresenceDiff,
    addMessage,
    updateScore,
    setKickVoteInfo,
    setPlayerKicked,
    clearPlayerInfo,
  } = usePlayerStore();

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const channelRef = useRef<Channel | null>(null); // Ref to hold the current channel instance

  useEffect(() => {
    // Ensure dependencies are met before attempting connection
    if (!socket || !playerName || !roomId || channelRef.current) {
      console.log(
        "[useRoomChannel] Skipping effect: Missing deps or channel already exists.",
        { socket, playerName, roomId, channelExists: !!channelRef.current }
      );
      // If already connected for this room, ensure state reflects it
      if (channelRef.current?.topic === `room:${roomId}`) {
        setConnectionState(channelRef.current.state as ConnectionState);
      } else if (channelRef.current) {
        // If ref exists but for different room, we should leave it first
        // Handled by cleanup of previous effect run
      }
      return;
    }

    // Reset kicked status when joining a new room
    setPlayerKicked(false);

    console.log(`[useRoomChannel] Attempting to join room:${roomId}`);
    setConnectionState("connecting");

    // Check if room_type is stored in sessionStorage for private rooms
    const roomType = sessionStorage.getItem("roomType");
    const channelParams: any = { 
      name: playerName,
      avatar: avatar // Include avatar in channel params
    };
    if (roomType) {
      channelParams.room_type = roomType;
      // Clear the room type from session storage after use
      sessionStorage.removeItem("roomType");
    }

    const newChannel = socket.channel(`room:${roomId}`, channelParams);
    channelRef.current = newChannel; // Store instance in ref

    // --- Setup Listeners ---
    const listeners = [
      newChannel.on("presence_state", (state) => {
        console.log("[useRoomChannel] Received presence_state:", state);
        updatePlayers(state); // Update the player list first

        // Now, try to find and set the current user ID
        const currentStoreState = usePlayerStore.getState();
        console.log(
          "[useRoomChannel] Checking presence_state to find current user ID..."
        );
        for (const id in state) {
          const name = getUserNameFromMeta(state[id]?.metas);
          // Add detailed comparison log
          console.log(
            `[useRoomChannel] Comparing presence name "${name}" with store name "${currentStoreState.playerName}" for ID ${id}`
          );
          if (name === currentStoreState.playerName) {
            console.log(
              `[useRoomChannel] Found user ID ${id} for player ${name}. Setting it.`
            );
            setUserId(id);
            break; // Found our ID, no need to continue loop
          }
        }
      }),
      newChannel.on("presence_diff", (diff) => {
        console.log("[useRoomChannel] Received presence_diff:", diff);
        applyPresenceDiff(diff);
      }),
      newChannel.on(
        "new_message",
        (payload: { 
          user_id: string; 
          message?: string; 
          message_type?: string;
          voter_id?: string;
          target_id?: string;
          votes_count?: number;
          required_votes?: number;
          system?: boolean 
        }) => {
          console.log(
            "[useRoomChannel] Received new_message payload:",
            payload
          );
          // Ensure userId is present in the payload
          if (!payload.user_id) {
            console.error(
              "[useRoomChannel] Received new_message without userId:",
              payload
            );
            return; // Don't add messages without a user ID
          }
          
          let messageText = payload.message;
          
          // Handle special message types that need frontend formatting with player names
          if (payload.message_type === "kick_vote" && payload.voter_id && payload.target_id) {
            const playerStore = usePlayerStore.getState();
            const voterName = playerStore.players[payload.voter_id] || "A player";
            const targetName = playerStore.players[payload.target_id] || "A player";
            messageText = `${voterName} voted to kick ${targetName} (${payload.votes_count}/${payload.required_votes})`;
          }
          
          const messageToAdd: Message = {
            userId: payload.user_id,
            text: messageText || "",
            system: payload.system,
          };
          
          console.log(
            "[useRoomChannel] Calling addMessage with:",
            messageToAdd
          );
          addMessage(messageToAdd);
        }
      ),
      newChannel.on("scores", (payload) => {
        console.log("[useRoomChannel] Received scores:", payload);

        // The payload should contain a scores object: { scores: { userId1: score1, userId2: score2, ... } }
        if (payload && payload.scores) {
          // Update each player's score in the store
          Object.entries(payload.scores).forEach(([userId, score]) => {
            console.log(
              `[useRoomChannel] Updating score for ${userId}: ${score}`
            );
            updateScore(userId, score as number);
          });
        }
      }),
      // Add kick vote handlers
      newChannel.on("kick_vote_update", (payload) => {
        console.log("[useRoomChannel] Received kick_vote_update:", payload);
        setKickVoteInfo(payload);
      }),
      newChannel.on("player_kicked", (payload) => {
        console.log("[useRoomChannel] Received player_kicked:", payload);
        
        const currentUserId = usePlayerStore.getState().userId;
        const playerStore = usePlayerStore.getState();
        const playerName = playerStore.players[payload.player_id] || "A player";
        
        // Check if the current user is the one being kicked
        if (payload.player_id === currentUserId) {
          console.log("[useRoomChannel] Current user was kicked from room");
          
          // Set player kicked status in store
          setPlayerKicked(true);
          
          // Add a system message about being kicked
          addMessage({
            userId: "system",
            text: "You have been kicked from the game",
            system: true
          });
          
          // Ensure channel is properly closed first
          if (channelRef.current) {
            channelRef.current.leave();
            channelRef.current = null;
            setChannel(null);
          }
          
          // Clear player info to prevent auto-reconnection AFTER leaving channel
          // This ensures we don't try to rejoin the same room
          clearPlayerInfo();
          
          // Force redirect to join page immediately
          if (typeof window !== 'undefined') {
            window.location.href = '/join';
          }
        } else {
          // Show notification that another player was kicked
          addMessage({
            userId: "system",
            text: `${playerName} was kicked from the game`,
            system: true,
          });
        }
        
        // Always reset kick vote info for the kicked player
        console.log("[useRoomChannel] Clearing all kick vote info after player kicked");
        try {
          const playerStore = usePlayerStore.getState();
          if (playerStore && playerStore.clearAllKickVoteInfo) {
            playerStore.clearAllKickVoteInfo();
          } else {
            // Fallback to old method if new method not available
            console.log("[useRoomChannel] clearAllKickVoteInfo not available, using setKickVoteInfo(null) instead");
            setKickVoteInfo(null);
          }
        } catch (error) {
          console.error("[useRoomChannel] Error clearing kick vote info:", error);
          // Fallback to old method
          setKickVoteInfo(null);
        }
      }),
    ];
    // --- End Listeners ---

    newChannel
      .join()
      .receive("ok", (resp) => {
        console.log(
          `[useRoomChannel] Joined room:${roomId} successfully`,
          resp
        );
        setConnectionState("joined");
        setChannel(newChannel); // Update channel in the global store
      })
      .receive("error", (resp) => {
        console.error(`[useRoomChannel] Unable to join room:${roomId}`, resp);
        setConnectionState("error");
        channelRef.current = null; // Clear ref on error
        setChannel(null); // Clear channel in store on error
      })
      .receive("timeout", () => {
        console.warn(`[useRoomChannel] Joining room:${roomId} timed out`);
        setConnectionState("error");
        channelRef.current = null; // Clear ref on timeout
        setChannel(null); // Clear channel in store on timeout
      });

    // --- Cleanup Function ---
    return () => {
      setConnectionState("leaving");
      console.log(`[useRoomChannel] Leaving channel ${newChannel.topic}`);
      // Turn off specific listeners using refs
      listeners.forEach((ref, index) => {
        // Check if channel still exists and has 'off' method
        if (newChannel && typeof newChannel.off === "function") {
          const eventName = [
            "presence_state",
            "presence_diff",
            "new_message",
            "scores",
            "kick_vote_update",
            "player_kicked",
          ][index]; // Map index to event name
          newChannel.off(eventName, ref);
        }
      });
      if (newChannel && typeof newChannel.leave === "function") {
        newChannel.leave();
      }
      channelRef.current = null; // Clear ref on cleanup
      setChannel(null); // Clear channel in store
      setConnectionState("idle");
      console.log(`[useRoomChannel] Left channel ${newChannel.topic}`);
    };
    // --- End Cleanup ---
  }, [
    socket,
    playerName,
    roomId,
    setChannel,
    updatePlayers,
    applyPresenceDiff,
    addMessage,
    setUserId,
    updateScore,
    setKickVoteInfo,
    setPlayerKicked,
    clearPlayerInfo,
  ]); // Dependencies for effect

  // Function to send a message
  const sendMessage = useCallback(
    (messageText: string) => {
      if (channelRef.current && connectionState === "joined") {
        console.log(`[useRoomChannel] Pushing new_message: ${messageText}`);
        channelRef.current.push("new_message", { message: messageText });
      } else {
        console.warn(
          "[useRoomChannel] Cannot send message, channel not joined.",
          { connectionState, channelExists: !!channelRef.current }
        );
      }
    },
    [connectionState] // Depends on connectionState to ensure channel is joined
  );

  // Function to vote to kick a player
  const voteToKick = useCallback(
    (targetPlayerId: string) => {
      if (channelRef.current && connectionState === "joined") {
        console.log(`[useRoomChannel] Voting to kick player: ${targetPlayerId}`);
        return new Promise((resolve, reject) => {
          channelRef.current!.push("vote_to_kick", { target_player_id: targetPlayerId })
            .receive("ok", (resp) => {
              console.log("[useRoomChannel] Vote to kick registered:", resp);
              resolve(resp);
            })
            .receive("error", (resp) => {
              console.error("[useRoomChannel] Vote to kick failed:", resp);
              reject(resp);
            });
        });
      } else {
        console.warn(
          "[useRoomChannel] Cannot vote to kick, channel not joined.",
          { connectionState, channelExists: !!channelRef.current }
        );
        return Promise.reject("Channel not joined");
      }
    },
    [connectionState] // Depends on connectionState to ensure channel is joined
  );

  // Function to get current kick votes for a player
  const getKickVotes = useCallback(
    (targetPlayerId: string) => {
      if (channelRef.current && connectionState === "joined") {
        console.log(`[useRoomChannel] Getting kick votes for player: ${targetPlayerId}`);
        return new Promise((resolve, reject) => {
          channelRef.current!.push("get_kick_votes", { target_player_id: targetPlayerId })
            .receive("ok", (resp) => {
              console.log("[useRoomChannel] Got kick votes:", resp);
              resolve(resp);
            })
            .receive("error", (resp) => {
              console.error("[useRoomChannel] Failed to get kick votes:", resp);
              reject(resp);
            });
        });
      } else {
        console.warn(
          "[useRoomChannel] Cannot get kick votes, channel not joined.",
          { connectionState, channelExists: !!channelRef.current }
        );
        return Promise.reject("Channel not joined");
      }
    },
    [connectionState] // Depends on connectionState to ensure channel is joined
  );

  return { connectionState, sendMessage, voteToKick, getKickVotes };
}
