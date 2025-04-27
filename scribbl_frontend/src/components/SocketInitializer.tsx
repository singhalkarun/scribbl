"use client";

import { useEffect } from "react";
import { createSocket } from "@/lib/socket";
import { usePlayerStore } from "@/store/usePlayerStore";

export default function SocketInitializer() {
  const setSocket = usePlayerStore((s) => s.setSocket);

  useEffect(() => {
    const socket = createSocket();
    socket.connect();
    setSocket(socket);

    return () => {
      socket.disconnect();
    };
  }, []);

  return null; // No UI
}
