import { create } from "zustand";
import { Socket, Channel } from "phoenix";
import { persist } from "zustand/middleware";

// Define the structure for a single player within the presence state
interface PlayerMeta {
  name: string;
  phx_ref: string;
  joined_at: number; // Assuming timestamp
  avatar?: string; // Add avatar field
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

// Define kick vote info interface
export interface KickVoteInfo {
  target_player_id: string;
  votes_count: number;
  required_votes: number;
  kicked: boolean;
  voters?: string[]; // Array of user IDs who voted to kick
}

interface PlayerStore {
  playerName: string;
  roomId: string;
  userId: string;
  adminId: string;
  channel: Channel | null;
  socket: Socket | null;
  players: { [userId: string]: string }; // Map of userId to playerName
  playerTimestamps: { [userId: string]: number }; // Map to track joined_at timestamps
  playerAvatars: { [userId: string]: string }; // Map of userId to avatar
  scores: { [userId: string]: number }; // Add scores state
  messages: Message[]; // Add messages state
  avatar: string; // Current user's avatar
  kickVoteInfoMap: { [playerId: string]: KickVoteInfo }; // Map of player IDs to kick vote info
  playerKicked: boolean; // Whether the current player has been kicked
  setPlayerName: (name: string) => void;
  setRoomId: (roomId: string) => void;
  setChannel: (channel: Channel | null) => void;
  setSocket: (socket: Socket) => void;
  setUserId: (userId: string) => void;
  setAdminId: (adminId: string) => void;
  setAvatar: (avatar: string) => void; // Add avatar setter
  updatePlayers: (presenceState: PresenceState) => void; // Action to update players
  applyPresenceDiff: (diff: {
    joins: PresenceState;
    leaves: PresenceState;
  }) => void; // Action for diffs
  addMessage: (message: Message) => void; // Signature uses updated Message type
  updateScore: (userId: string, score: number) => void; // Add score update function
  setKickVoteInfo: (info: KickVoteInfo | null) => void; // Set kick vote info
  removeKickVoteInfo: (playerId: string) => void; // Remove kick vote info for a player
  clearAllKickVoteInfo: () => void; // Clear all kick vote info
  setPlayerKicked: (kicked: boolean) => void; // Set player kicked status
  clearPlayerInfo: () => void;
  _hasHydrated: boolean; // Flag to track hydration state
  
  // For backward compatibility with existing code
  get kickVoteInfo(): KickVoteInfo | null;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      playerName: "",
      roomId: "",
      userId: "",
      adminId: "",
      channel: null,
      socket: null,
      players: {}, // Initial state for players
      playerTimestamps: {}, // Initialize playerTimestamps
      playerAvatars: {}, // Initialize playerAvatars
      scores: {}, // Initialize scores
      messages: [], // Initial messages state
      avatar: "👤", // Default avatar
      kickVoteInfoMap: {}, // Initialize kick vote info map as empty object
      playerKicked: false, // Initialize player kicked status
      setPlayerName: (name) => set({ playerName: name }),
      setRoomId: (roomId) => set({ roomId }),
      setChannel: (channel) => set({ channel }),
      setSocket: (socket) => set({ socket }),
      setAvatar: (avatar) => set({ avatar }),
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
      setKickVoteInfo: (info) => {
        if (!info) {
          console.log(`[Store] Setting null kickVoteInfo, clearing all vote info`);
          set({ kickVoteInfoMap: {} });
          return;
        }
        
        console.log(`[Store] Setting kickVoteInfo for player ${info.target_player_id}:`, info);
        set((state) => ({
          kickVoteInfoMap: {
            ...state.kickVoteInfoMap,
            [info.target_player_id]: info
          }
        }));
      },
      removeKickVoteInfo: (playerId) => {
        console.log(`[Store] Removing kickVoteInfo for player ${playerId}`);
        set((state) => {
          const newMap = { ...state.kickVoteInfoMap };
          delete newMap[playerId];
          return { kickVoteInfoMap: newMap };
        });
      },
      clearAllKickVoteInfo: () => {
        console.log(`[Store] Clearing all kick vote info`);
        set({ kickVoteInfoMap: {} });
      },
      setPlayerKicked: (kicked) => {
        console.log(`[Store] Setting playerKicked to:`, kicked);
        set({ playerKicked: kicked });
      },
      // Define a getter for backward compatibility
      get kickVoteInfo(): KickVoteInfo | null {
        // Return the first active vote info from the map, or null if none
        const state = get();
        // Check if state is properly initialized
        if (!state || !state.kickVoteInfoMap) {
          return null;
        }
        const map = state.kickVoteInfoMap;
        const keys = Object.keys(map);
        return keys.length > 0 ? map[keys[0]] : null;
      },
      updatePlayers: (presenceState) =>
        set((state) => {
          let currentUserId = state.userId; // Keep existing ID if already set
          const newPlayers: { [userId: string]: string } = {};
          const newTimestamps: { [userId: string]: number } = {};
          const newAvatars: { [userId: string]: string } = {};

          Object.keys(presenceState).forEach((userId) => {
            if (presenceState[userId].metas.length > 0) {
              // Find the meta with the latest joined_at timestamp
              const latestMeta = presenceState[userId].metas.reduce(
                (latest, meta) =>
                  meta.joined_at > latest.joined_at ? meta : latest,
                presenceState[userId].metas[0]
              );
              const playerName = latestMeta.name;
              const joinedAt = latestMeta.joined_at;
              const avatar = latestMeta.avatar || "👤"; // Use default if not provided

              newPlayers[userId] = playerName;
              newTimestamps[userId] = joinedAt;
              newAvatars[userId] = avatar;

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
            playerAvatars: newAvatars,
          };
        }),
      applyPresenceDiff: (diff) =>
        set((state) => {
          const updatedPlayers = { ...state.players };
          const updatedTimestamps = { ...state.playerTimestamps };
          const updatedAvatars = { ...state.playerAvatars };

          // Handle joins
          Object.keys(diff.joins).forEach((userId) => {
            if (diff.joins[userId].metas.length > 0) {
              const latestNewMeta = diff.joins[userId].metas.reduce(
                (latest, meta) =>
                  meta.joined_at > latest.joined_at ? meta : latest,
                diff.joins[userId].metas[0]
              );
              const newJoinedAt = latestNewMeta.joined_at;
              const currentTimestamp = updatedTimestamps[userId] || 0;

              // Only update if this is a newer presence update (higher timestamp)
              if (newJoinedAt > currentTimestamp) {
                updatedPlayers[userId] = latestNewMeta.name;
                updatedTimestamps[userId] = newJoinedAt;
                updatedAvatars[userId] = latestNewMeta.avatar || "👤"; // Use default if not provided
                console.log(
                  `[Store] Added/Updated player ${latestNewMeta.name} with timestamp ${newJoinedAt}`
                );
              } else {
                console.log(
                  `[Store] Ignored outdated join for ${latestNewMeta.name}: ${newJoinedAt} <= ${currentTimestamp}`
                );
              }
            }
          });

          // Handle leaves - only remove if the leave event's timestamp is newer than what we have
          Object.keys(diff.leaves).forEach((userId) => {
            if (diff.leaves[userId].metas.length > 0) {
              const latestLeaveMeta = diff.leaves[userId].metas.reduce(
                (latest, meta) =>
                  meta.joined_at > latest.joined_at ? meta : latest,
                diff.leaves[userId].metas[0]
              );
              const leaveJoinedAt = latestLeaveMeta.joined_at;
              const currentTimestamp = updatedTimestamps[userId] || 0;

              // If we have a newer join timestamp, keep the player (ignore the leave)
              if (leaveJoinedAt >= currentTimestamp) {
                delete updatedPlayers[userId];
                delete updatedTimestamps[userId];
                delete updatedAvatars[userId];
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
            playerAvatars: updatedAvatars,
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
        console.log("[Store] Clearing player info to prevent auto-rejoin");
        
        // Force clear localStorage first to ensure player can't rejoin
        if (typeof window !== 'undefined') {
          localStorage.removeItem('player-info-storage');
          // Also clear session storage in case it contains any room info
          sessionStorage.removeItem('roomType');
        }
        
        // Reset all state values
        set({ 
          playerName: "", 
          roomId: "", 
          userId: "", 
          adminId: "",
          kickVoteInfoMap: {},
          playerKicked: false,
          players: {},
          playerTimestamps: {},
          playerAvatars: {},
          scores: {},
          messages: [],
          // Clear the persisted state in localStorage to prevent auto-rejoin
          _hasHydrated: true
        });
      },
      _hasHydrated: false, // Flag to track hydration state
    }),
    {
      name: "player-info-storage",
      partialize: (state) => ({
        playerName: state.playerName,
        roomId: state.roomId,
        userId: state.userId,
        adminId: state.adminId,
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
