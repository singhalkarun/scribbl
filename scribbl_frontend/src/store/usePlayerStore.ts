import { create } from "zustand";

type PlayerState = {
  playerName: string;
  roomId: string;
  setPlayerName: (name: string) => void;
  setRoomId: (roomId: string) => void;
};

export const usePlayerStore = create<PlayerState>((set) => ({
  playerName: "",
  roomId: "",
  setPlayerName: (playerName) => set({ playerName }),
  setRoomId: (roomId) => set({ roomId }),
}));
