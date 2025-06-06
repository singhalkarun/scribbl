"use client";

import { Socket } from "phoenix";

export const createSocket = (userId?: string) => {
  console.log("[Socket] Creating socket with userId:", userId);
  const socket = new Socket(
    process.env.NEXT_PUBLIC_BACKEND_URL + "/socket" || "",
    {
      params: {
        user_id: userId || "",
      },
    }
  );
  return socket;
};
