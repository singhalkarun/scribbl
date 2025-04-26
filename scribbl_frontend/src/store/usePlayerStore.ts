import { create } from "zustand";
import { Channel } from "phoenix";

type PlayerState = {
  playerName: string;
  roomId: string;
  channel: Channel | null;
  setPlayerName: (name: string) => void;
  setRoomId: (roomId: string) => void;
  setChannel: (channel: Channel) => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  playerName: "",
  roomId: "",
  channel: null,
  setPlayerName: (playerName) => set({ playerName }),
  setRoomId: (roomId) => set({ roomId }),
  setChannel: (channel) => set({ channel }),
}));
