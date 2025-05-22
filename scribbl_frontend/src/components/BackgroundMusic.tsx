"use client";

import { useEffect, useRef, useState } from "react";

interface BackgroundMusicProps {
  src: string;
  volume?: number;
}

export default function BackgroundMusic({
  src,
  volume = 0.2,
}: BackgroundMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const hasTriedToPlayRef = useRef(false);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    // Configure audio
    audio.loop = true;
    audio.volume = volume;
    audio.preload = "auto";

    // Setup cleanup
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, [src, volume]);

  // Setup subtle interaction listeners to trigger music
  useEffect(() => {
    if (!audioRef.current) return;

    const tryPlayMusic = () => {
      // Only try to play once to avoid spamming
      if (hasTriedToPlayRef.current || isPlaying) return;

      hasTriedToPlayRef.current = true;

      const audio = audioRef.current;
      if (!audio) return;

      audio
        .play()
        .then(() => {
          console.log(
            "[BackgroundMusic] Music started playing after user interaction"
          );
          setIsPlaying(true);
        })
        .catch((error) => {
          console.log("[BackgroundMusic] Still couldn't play music:", error);
          // Reset the flag after a shorter delay (0.5 sec) to allow for another attempt
          setTimeout(() => {
            hasTriedToPlayRef.current = false;
          }, 500);
        });
    };

    // List of subtle events to listen for
    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "focus",
    ];

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, tryPlayMusic, { once: false });
    });

    // Cleanup event listeners
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, tryPlayMusic);
      });
    };
  }, [isPlaying]);

  // No visible UI at all
  return null;
}
