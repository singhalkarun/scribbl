"use client";

import { useEffect } from "react";
import { createSocket } from "@/lib/socket";
import { usePlayerStore } from "@/store/usePlayerStore";

export default function SocketInitializer() {
  const setSocket = usePlayerStore((s) => s.setSocket);
  const userId = usePlayerStore((s) => s.userId);

  useEffect(() => {
    // Get userId from localStorage if available
    let storedUserId = null;
    if (typeof window !== "undefined") {
      try {
        const playerStore = localStorage.getItem("player-info-storage");
        if (playerStore) {
          const parsedStore = JSON.parse(playerStore);
          storedUserId = parsedStore.state?.userId || null;
        }
      } catch (e) {
        console.error("Error reading userId from localStorage:", e);
      }
    }

    // Use stored userId if available, otherwise use the one from store
    const userIdToUse = storedUserId || userId;
    console.log(
      "[SocketInitializer] Using userId for socket connection:",
      userIdToUse
    );

    const socket = createSocket(userIdToUse);
    socket.connect();
    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, []);

  return null; // No UI
}
