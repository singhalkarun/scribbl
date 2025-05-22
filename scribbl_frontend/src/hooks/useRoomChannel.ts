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
    setChannel,
    setUserId,
    updatePlayers,
    applyPresenceDiff,
    addMessage,
    updateScore,
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

    console.log(`[useRoomChannel] Attempting to join room:${roomId}`);
    setConnectionState("connecting");

    const newChannel = socket.channel(`room:${roomId}`, { name: playerName });
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
        (payload: { userId: string; message: string; system?: boolean }) => {
          console.log(
            "[useRoomChannel] Received new_message payload:",
            payload
          );
          // Ensure userId is present in the payload
          if (!payload.userId) {
            console.error(
              "[useRoomChannel] Received new_message without userId:",
              payload
            );
            return; // Don't add messages without a user ID
          }
          const messageToAdd: Message = {
            userId: payload.userId, // Use userId from payload
            text: payload.message,
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

  return { connectionState, sendMessage };
}
