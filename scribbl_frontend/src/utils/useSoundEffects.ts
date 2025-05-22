"use client";

import { useRef, useEffect } from "react";

// Simplified sound effect types
export type SoundEffectType = "correctGuess" | "gameOver" | "newRound";

// Interface for our hook
export function useSoundEffects(defaultVolume = 0.2) {
  // Use refs to store audio elements so they persist between renders
  const audioRefs = useRef<Record<SoundEffectType, HTMLAudioElement | null>>({
    correctGuess: null,
    gameOver: null,
    newRound: null,
  });

  // Initialize audio elements
  useEffect(() => {
    // Define sound paths - these match the files in public/sounds
    const soundPaths: Record<SoundEffectType, string> = {
      correctGuess: "/sounds/correct-guess.mp3",
      gameOver: "/sounds/game-over.mp3",
      newRound: "/sounds/new-round.mp3",
    };

    // Create audio elements for each sound type
    Object.entries(soundPaths).forEach(([key, path]) => {
      const soundType = key as SoundEffectType;
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.volume = defaultVolume; // Set volume to the default value
      audioRefs.current[soundType] = audio;
    });

    // Cleanup function
    return () => {
      // Unload all audio elements
      Object.values(audioRefs.current).forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      });
    };
  }, []);

  // Function to play a sound effect
  const playSound = (type: SoundEffectType) => {
    const audio = audioRefs.current[type];
    if (audio) {
      // Reset audio to beginning if it's already playing
      audio.currentTime = 0;

      // Ensure volume is set to the default value every time before playing
      audio.volume = defaultVolume;

      console.log(`[SoundEffects] Playing ${type} at volume ${audio.volume}`);

      audio.play().catch((error) => {
        // Handle errors, e.g., browser requiring user interaction before audio can play
        console.error("Error playing sound:", error);
      });
    }
  };

  return { playSound };
}
