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
  channel: Channel | null;
  socket: Socket | null;
  players: { [userId: string]: string }; // Map of userId to playerName
  scores: { [userId: string]: number }; // Add scores state
  messages: Message[]; // Add messages state
  setPlayerName: (name: string) => void;
  setRoomId: (roomId: string) => void;
  setChannel: (channel: Channel | null) => void;
  setSocket: (socket: Socket) => void;
  setUserId: (userId: string) => void; // Added userId setter
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
      channel: null,
      socket: null,
      players: {}, // Initial state for players
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
      updatePlayers: (presenceState) =>
        set((state) => {
          let currentUserId = state.userId; // Keep existing ID if already set
          const newPlayers: { [userId: string]: string } = {};
          Object.keys(presenceState).forEach((userId) => {
            if (presenceState[userId].metas.length > 0) {
              const playerName = presenceState[userId].metas[0].name;
              newPlayers[userId] = playerName;
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
          return { players: newPlayers }; // Remove userId update from here
        }),
      applyPresenceDiff: (diff) =>
        set((state) => {
          const updatedPlayers = { ...state.players };

          // Handle joins
          Object.keys(diff.joins).forEach((userId) => {
            if (diff.joins[userId].metas.length > 0) {
              updatedPlayers[userId] = diff.joins[userId].metas[0].name;
            }
          });

          // Handle leaves
          Object.keys(diff.leaves).forEach((userId) => {
            delete updatedPlayers[userId];
          });

          console.log(
            "[Store] Applying presence diff:",
            diff,
            "New state:",
            updatedPlayers
          );
          return { players: updatedPlayers };
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
        set((state) => ({
          scores: { ...state.scores, [userId]: score },
        })),
      clearPlayerInfo: () => {
        set({ playerName: "", roomId: "", userId: "" }); // Clear userId too
      },
      _hasHydrated: false, // Flag to track hydration state
    }),
    {
      name: "player-info-storage",
      partialize: (state) => ({
        playerName: state.playerName,
        roomId: state.roomId,
        userId: state.userId, // Add userId to persisted state
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
