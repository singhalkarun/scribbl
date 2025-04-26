"use client";

import { Socket } from "phoenix";

export const createSocket = () => {
  const socket = new Socket(process.env.NEXT_PUBLIC_SOCKET_URL || "", {
    params: {},
  });
  return socket;
};
