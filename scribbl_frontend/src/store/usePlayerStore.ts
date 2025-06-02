import { create } from "zustand";
import { Socket, Channel } from "phoenix";
import { persist } from "zustand/middleware";

// Define the structure for a single player within the presence state
interface PlayerMeta {
  name: string;
  phx_ref: string;
  joined_at: number; // Assuming timestamp
}

// Define the structure for the presence state object received from Phoenix
interface PresenceState {
  [userId: string]: {
    metas: PlayerMeta[];
  };
}

// Shared Message interface (uses userId now)
export interface Message {
  userId: string; // Changed from sender
  text: string;
  system?: boolean;
  senderName?: string; // Added senderName
}

interface PlayerStore {
  playerName: string;
  roomId: string;
  userId: string; // Added userId state
  adminId: string; // Add admin ID state
  channel: Channel | null;
  socket: Socket | null;
  players: { [userId: string]: string }; // Map of userId to playerName
  playerTimestamps: { [userId: string]: number }; // Map to track joined_at timestamps
  scores: { [userId: string]: number }; // Add scores state
  messages: Message[]; // Add messages state
  setPlayerName: (name: string) => void;
  setRoomId: (roomId: string) => void;
  setChannel: (channel: Channel | null) => void;
  setSocket: (socket: Socket) => void;
  setUserId: (userId: string) => void; // Added userId setter
  setAdminId: (adminId: string) => void; // Add admin ID setter
  updatePlayers: (presenceState: PresenceState) => void; // Action to update players
  applyPresenceDiff: (diff: {
    joins: PresenceState;
    leaves: PresenceState;
  }) => void; // Action for diffs
  addMessage: (message: Message) => void; // Signature uses updated Message type
  updateScore: (userId: string, score: number) => void; // Add score update function
  clearPlayerInfo: () => void;
  _hasHydrated: boolean; // Flag to track hydration state
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      playerName: "",
      roomId: "",
      userId: "", // Added userId initial state
      adminId: "", // Add admin ID initial state
      channel: null,
      socket: null,
      players: {}, // Initial state for players
      playerTimestamps: {}, // Initialize playerTimestamps
      scores: {}, // Initialize scores
      messages: [], // Initial messages state
      setPlayerName: (name) => set({ playerName: name }),
      setRoomId: (roomId) => set({ roomId }),
      setChannel: (channel) => set({ channel }),
      setSocket: (socket) => set({ socket }),
      setUserId: (userId) => {
        // Added userId setter implementation + logging
        console.log(`[Store] Setting userId to: ${userId}`);
        set({ userId });
      },
      setAdminId: (adminId) => {
        // Add admin ID setter implementation + logging
        console.log(`[Store] Setting adminId to: ${adminId}`);
        set({ adminId });
      },
      updatePlayers: (presenceState) =>
        set((state) => {
          let currentUserId = state.userId; // Keep existing ID if already set
          const newPlayers: { [userId: string]: string } = {};
          const newTimestamps: { [userId: string]: number } = {};

          Object.keys(presenceState).forEach((userId) => {
            if (presenceState[userId].metas.length > 0) {
              const playerMeta = presenceState[userId].metas[0];
              const playerName = playerMeta.name;
              const joinedAt = playerMeta.joined_at;

              newPlayers[userId] = playerName;
              newTimestamps[userId] = joinedAt;

              // If we haven't found our ID yet, check if this player is us
              if (!currentUserId && playerName === state.playerName) {
                console.log(
                  `[Store] Found current user ID: ${userId} for name: ${playerName}`
                );
                currentUserId = userId;
              }
            }
          });
          // Update players map BUT NOT the current user's ID here anymore
          // The ID should be set explicitly via setUserId or initial join response
          return {
            players: newPlayers,
            playerTimestamps: newTimestamps,
          };
        }),
      applyPresenceDiff: (diff) =>
        set((state) => {
          const updatedPlayers = { ...state.players };
          const updatedTimestamps = { ...state.playerTimestamps };

          // Handle joins
          Object.keys(diff.joins).forEach((userId) => {
            if (diff.joins[userId].metas.length > 0) {
              const newPlayerMeta = diff.joins[userId].metas[0];
              const newJoinedAt = newPlayerMeta.joined_at;
              const currentTimestamp = updatedTimestamps[userId] || 0;

              // Only update if this is a newer presence update (higher timestamp)
              if (newJoinedAt > currentTimestamp) {
                updatedPlayers[userId] = newPlayerMeta.name;
                updatedTimestamps[userId] = newJoinedAt;
                console.log(
                  `[Store] Added/Updated player ${newPlayerMeta.name} with timestamp ${newJoinedAt}`
                );
              } else {
                console.log(
                  `[Store] Ignored outdated join for ${newPlayerMeta.name}: ${newJoinedAt} <= ${currentTimestamp}`
                );
              }
            }
          });

          // Handle leaves - only remove if the leave event's timestamp is newer than what we have
          Object.keys(diff.leaves).forEach((userId) => {
            if (diff.leaves[userId].metas.length > 0) {
              const leavePlayerMeta = diff.leaves[userId].metas[0];
              const leaveJoinedAt = leavePlayerMeta.joined_at;
              const currentTimestamp = updatedTimestamps[userId] || 0;

              // If we have a newer join timestamp, keep the player (ignore the leave)
              if (leaveJoinedAt >= currentTimestamp) {
                delete updatedPlayers[userId];
                delete updatedTimestamps[userId];
                console.log(
                  `[Store] Removed player with userId ${userId}, timestamp ${leaveJoinedAt}`
                );
              } else {
                console.log(
                  `[Store] Ignored outdated leave for ${userId}: ${leaveJoinedAt} < ${currentTimestamp}`
                );
              }
            }
          });

          console.log(
            "[Store] Applying presence diff:",
            diff,
            "New state:",
            updatedPlayers
          );
          return {
            players: updatedPlayers,
            playerTimestamps: updatedTimestamps,
          };
        }),
      addMessage: (message) =>
        set((state) => {
          // Look up sender name from current state
          const senderName = message.system
            ? "System"
            : state.players[message.userId] || message.userId || "Unknown";

          // Add the senderName to the message object
          const messageWithSender: Message = {
            ...message,
            senderName: senderName,
          };

          console.log(
            `[Store] Adding message with senderName '${senderName}':`,
            messageWithSender
          );
          return { messages: [...state.messages, messageWithSender] };
        }),
      updateScore: (userId, score) =>
        set((state) => {
          const newScores = { ...state.scores, [userId]: score };
          return { scores: newScores };
        }),
      clearPlayerInfo: () => {
        set({ playerName: "", roomId: "", userId: "", adminId: "" }); // Clear adminId too
      },
      _hasHydrated: false, // Flag to track hydration state
    }),
    {
      name: "player-info-storage",
      partialize: (state) => ({
        playerName: state.playerName,
        roomId: state.roomId,
        userId: state.userId, // Add userId to persisted state
        adminId: state.adminId, // Add adminId to persisted state
      }),
      // Set hydration flag once storage is read
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("[Store] Error during hydration:", error);
        } else if (state) {
          console.log("[Store] Hydration finished.");
          state._hasHydrated = true;
        } else {
          console.warn("[Store] Hydration finished but state is undefined?");
        }
      },
    }
  )
);
