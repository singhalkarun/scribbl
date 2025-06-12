"use client";

import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import React, { useRef, useState, useEffect } from "react";
import { usePlayerStore } from "@/store/usePlayerStore";
import Image from "next/image";

const colors = [
  "black",
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "#FF69B4", // Pink
  "#8B4513", // Brown
];

// Define proper types for sketch paths
interface PathPoint {
  x: number;
  y: number;
}

interface NormalizedPathPoint {
  x: number;
  y: number;
}

interface SketchPath {
  drawMode: boolean;
  strokeColor: string;
  strokeWidth: number;
  paths: PathPoint[];
}

interface CanvasProps {
  isDrawer: boolean;
  gameStarted?: boolean;
  onShowSettings?: () => void;
  // Game state props for word/timer display
  roomStatus?: string;
  gameInfo?: {
    currentRound: string;
    maxRounds: string;
    currentDrawer: string;
  };
  players?: { [key: string]: string };
  playerName?: string;
  timeLeft?: number;
  showWordSelection?: boolean;
  wordToDraw?: string;
  guessed?: boolean;
  revealedLetters?: string[];
  wordLength?: number;
  specialChars?: {index: number, char: string}[];
  // Like/dislike functionality
  onLikeDrawing?: () => void;
  onDislikeDrawing?: () => void;
}

interface DrawingData {
  drawMode: boolean;
  strokeColor: string;
  strokeWidth: number;
  paths: NormalizedPathPoint[];
  isComplete: boolean;
}

export default function Canvas({
  isDrawer,
  gameStarted = false,
  onShowSettings,
  roomStatus,
  gameInfo,
  players,
  playerName,
  timeLeft,
  showWordSelection,
  wordToDraw,
  guessed,
  revealedLetters,
  wordLength,
  specialChars,
  onLikeDrawing,
  onDislikeDrawing,
}: CanvasProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { channel } = usePlayerStore();

  // State for drawing properties
  const [color, setColor] = useState("black");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [eraserWidth, setEraserWidth] = useState(10);
  const [isEraser, setIsEraser] = useState(false);
  const [paths, setPaths] = useState<SketchPath[]>([]);
  const [showBrushSlider, setShowBrushSlider] = useState(false);
  
  // State for like/dislike usage per turn (user can only do one action)
  const [actionTaken, setActionTaken] = useState<'like' | 'dislike' | null>(null);

  // Track drawing state
  const lastSentPointsRef = useRef<number>(0);
  const isDrawingRef = useRef<boolean>(false);
  const previousPathRef = useRef<SketchPath | null>(null);

  // Reset like/dislike state when drawer changes (new turn) or game starts
  useEffect(() => {
    setActionTaken(null);
  }, [gameInfo?.currentDrawer, roomStatus]);

  // Additional reset when round changes
  useEffect(() => {
    setActionTaken(null);
  }, [gameInfo?.currentRound]);

  // When paths state changes, update the canvas to match
  useEffect(() => {
    if (canvasRef.current && paths.length >= 0) {
      // Only update if the paths have actually changed
      const currentPaths = canvasRef.current.exportPaths();
      if (JSON.stringify(currentPaths) !== JSON.stringify(paths)) {
        // Clear first to avoid duplicating paths
        canvasRef.current.clearCanvas();

        // Only load paths if we have any
        if (paths.length > 0) {
          canvasRef.current.loadPaths(paths);
        }
      }
    }
  }, [paths]);

  // Connect to Phoenix channel for drawing events
  useEffect(() => {
    if (!channel) {
      console.log("[Canvas] No channel available yet");
      return;
    }

    console.log("[Canvas] Setting up drawing event listeners");

    // Listen for drawing events from other users
    const drawingRef = channel.on("drawing", (payload) => {
      console.log("[Canvas] Received drawing event:", payload);

      if (!isDrawer) {
        const container = canvasContainerRef.current;
        const canvasWidth = container?.clientWidth || 1;
        const canvasHeight = container?.clientHeight || 1;

        // Handle the new array format with "canvas" key
        // Server now sends an array of drawing objects in payload.canvas:
        // - New joiners receive multiple objects in the array
        // - Existing players receive one object at a time
        const drawingData = payload.canvas || [];

        // Process each drawing object in the array
        drawingData.forEach((data: DrawingData) => {
          // Denormalize the coordinates when receiving
          const denormalizedPaths = denormalizeCoordinates(
            data.paths,
            canvasWidth,
            canvasHeight
          );

          const newPath: SketchPath = {
            drawMode: data.drawMode,
            strokeColor: data.strokeColor,
            strokeWidth: data.strokeWidth,
            paths: denormalizedPaths,
          };

          if (data.isComplete === false) {
            setPaths((prevPaths) => {
              if (prevPaths.length > 0) {
                const lastPath = prevPaths[prevPaths.length - 1];
                if (
                  lastPath.drawMode === newPath.drawMode &&
                  lastPath.strokeColor === newPath.strokeColor &&
                  lastPath.strokeWidth === newPath.strokeWidth
                ) {
                  const updatedPaths = [...prevPaths];
                  updatedPaths[updatedPaths.length - 1] = {
                    ...lastPath,
                    paths: [...lastPath.paths, ...newPath.paths],
                  };
                  return updatedPaths;
                }
              }
              return [...prevPaths, newPath];
            });
          } else {
            setPaths((prevPaths) => [...prevPaths, newPath]);
          }
        });
      }
    });

    // Listen for clear canvas events - use drawing_clear to avoid conflicts
    const clearCanvasRef = channel.on("drawing_clear", () => {
      console.log("[Canvas] Received clear canvas event");

      // Reset all drawing state if we're a viewer
      if (!isDrawer) {
        lastSentPointsRef.current = 0;
        previousPathRef.current = null;
      }

      // Clear state
      setPaths([]);

      // Clear the canvas with slight delay to ensure state updates first
      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current.clearCanvas();
          console.log("[Canvas] Canvas cleared from remote event");
        }
      }, 10);
    });

    // Clear canvas when a new turn starts
    const turnStartedRef = channel.on("turn_started", () => {
      console.log("[Canvas] New turn started, clearing canvas and resetting like/dislike");
      setPaths([]);
      setShowBrushSlider(false); // Hide brush slider when turn changes
      setActionTaken(null); // Reset like/dislike state for new turn
    });

    // Cleanup listeners when component unmounts
    return () => {
      if (channel) {
        channel.off("drawing", drawingRef);
        channel.off("drawing_clear", clearCanvasRef);
        channel.off("turn_started", turnStartedRef);
      }
    };
  }, [channel, isDrawer]);

  // Apply stroke/eraser width changes to the canvas
  useEffect(() => {
    if (canvasRef.current && isDrawer) {
      if (isEraser) {
        canvasRef.current.eraseMode(true);
      } else {
        canvasRef.current.eraseMode(false);
      }
    }
  }, [isEraser, strokeWidth, eraserWidth, isDrawer]);

  // Drawing Handlers
  const handleColorChange = (newColor: string) => {
    if (!isDrawer) return; // Only drawer can change colors

    setColor(newColor);
    setIsEraser(false);
    setShowBrushSlider(true);
    canvasRef.current?.eraseMode(false);
  };

  const handleDrawModeClick = () => {
    if (!isDrawer) return; // Only drawer can change modes

    if (!isEraser) {
      // If already in Draw mode, toggle the slider
      setShowBrushSlider(!showBrushSlider);
    } else {
      // If switching to Draw mode, activate it and show slider
      setIsEraser(false);
      setShowBrushSlider(true);
      canvasRef.current?.eraseMode(false);
    }
  };

  const handleEraseModeClick = () => {
    if (!isDrawer) return; // Only drawer can change modes

    if (isEraser) {
      // If already in Erase mode, toggle the slider
      setShowBrushSlider(!showBrushSlider);
    } else {
      // If switching to Erase mode, activate it and show slider
      setIsEraser(true);
      setShowBrushSlider(true);
      canvasRef.current?.eraseMode(true);
    }
  };

  // Handle like/dislike with state management (user can only do one action)
  const handleLikeClick = () => {
    if (actionTaken || !onLikeDrawing) return;
    setActionTaken('like');
    onLikeDrawing();
  };

  const handleDislikeClick = () => {
    if (actionTaken || !onDislikeDrawing) return;
    setActionTaken('dislike');
    onDislikeDrawing();
  };

  const handleClear = () => {
    if (!isDrawer) return; // Only drawer can clear

    // Reset all drawing state
    lastSentPointsRef.current = 0;
    previousPathRef.current = null;
    isDrawingRef.current = false;

    // Clear local state
    setPaths([]);

    // Make sure to clear the canvas with a slight delay to ensure state updates first
    setTimeout(() => {
      if (canvasRef.current) {
        canvasRef.current.clearCanvas();
        console.log("[Canvas] Canvas cleared locally");
      }
    }, 10);

    // Send clear event to server - use drawing_clear to avoid conflicts
    console.log("[Canvas] Sending clear canvas event");
    if (channel) {
      channel.push("drawing_clear", {});
    }
  };

  // Effect to handle wheel event listener for stroke size adjustment
  // AND hide slider on draw start
  useEffect(() => {
    if (!isDrawer) return; // Only attach these events for the drawer

    const container = canvasContainerRef.current;

    const handleWheel = (e: WheelEvent) => {
      // Check if it's a pinch zoom gesture (Ctrl key + wheel)
      if (e.ctrlKey) {
        // Prevent browser zoom only when Ctrl is pressed
        e.preventDefault();

        if (e.deltaY !== 0) {
          const delta = e.deltaY > 0 ? -1 : 1; // Inverted scroll direction might feel more natural for size

          // Use functional updates for state based on previous state
          if (isEraser) {
            setEraserWidth((prev) => Math.max(1, Math.min(50, prev + delta)));
          } else {
            setStrokeWidth((prev) => Math.max(1, Math.min(20, prev + delta)));
          }
        }
      }
      // Do not prevent default scroll behavior if Ctrl is not pressed
    };

    const hideSliderOnDrawStart = () => {
      setShowBrushSlider(false);
    };

    if (container) {
      // Add listener with passive: false to allow preventDefault
      container.addEventListener("wheel", handleWheel, { passive: false });
      // Add listeners to hide slider on canvas interaction
      container.addEventListener("mousedown", hideSliderOnDrawStart);
      container.addEventListener("touchstart", hideSliderOnDrawStart, {
        passive: true,
      }); // Use passive: true for touchstart if not preventing default
    }

    // Cleanup function to remove the listeners
    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
        container.removeEventListener("mousedown", hideSliderOnDrawStart);
        container.removeEventListener("touchstart", hideSliderOnDrawStart);
      }
    };
    // Re-run effect if isEraser changes (for wheel handler state access)
    // No need to re-run for setShowBrushSlider as it's stable
  }, [isEraser, isDrawer]);

  // Add function to normalize coordinates
  const normalizeCoordinates = (
    paths: PathPoint[],
    canvasWidth: number,
    canvasHeight: number
  ): NormalizedPathPoint[] => {
    return paths.map((point) => ({
      x: point.x / canvasWidth,
      y: point.y / canvasHeight,
    }));
  };

  // Add function to denormalize coordinates
  const denormalizeCoordinates = (
    paths: NormalizedPathPoint[],
    canvasWidth: number,
    canvasHeight: number
  ): PathPoint[] => {
    return paths.map((point) => ({
      x: point.x * canvasWidth,
      y: point.y * canvasHeight,
    }));
  };

  // Modify handleDrawingMove to be more efficient
  const handleDrawingMove = () => {
    if (!isDrawer || !canvasRef.current || !channel) return;

    if (!isDrawingRef.current) {
      isDrawingRef.current = true;
      lastSentPointsRef.current = 0;
      previousPathRef.current = null;
      console.log("[Canvas] Starting to draw");
    }

    // Throttle the path export and sending
    if (Date.now() - lastSentPointsRef.current < 50) return; // Only send every 50ms
    lastSentPointsRef.current = Date.now();

    canvasRef.current
      .exportPaths()
      .then((exportedPaths: SketchPath[]) => {
        if (exportedPaths && exportedPaths.length > 0) {
          const latestPath = exportedPaths[exportedPaths.length - 1];
          const container = canvasContainerRef.current;
          const canvasWidth = container?.clientWidth || 1;
          const canvasHeight = container?.clientHeight || 1;

          if (
            previousPathRef.current?.paths.length !== latestPath.paths.length
          ) {
            // Normalize the coordinates before sending
            const normalizedPaths = normalizeCoordinates(
              latestPath.paths,
              canvasWidth,
              canvasHeight
            );

            channel.push("drawing", {
              drawMode: latestPath.drawMode,
              strokeColor: latestPath.strokeColor,
              strokeWidth: latestPath.strokeWidth,
              paths: normalizedPaths,
              isComplete: false,
            });

            previousPathRef.current = JSON.parse(JSON.stringify(latestPath));
          }
        }
      })
      .catch((error) => {
        console.error("[Canvas] Error exporting paths during drawing:", error);
      });
  };

  // Handle stroke completion
  const handleStroke = () => {
    if (!isDrawer || !canvasRef.current || !channel) return;

    // Only process if we were actually drawing
    if (!isDrawingRef.current) return;

    // Reset drawing state
    isDrawingRef.current = false;
    lastSentPointsRef.current = 0;
    previousPathRef.current = null;

    // Export the current paths from the canvas
    canvasRef.current
      .exportPaths()
      .then((exportedPaths: SketchPath[]) => {
        // Check if we have any paths
        if (exportedPaths && exportedPaths.length > 0) {
          // Get the latest path
          const newPath = exportedPaths[exportedPaths.length - 1];

          // Update state with all paths
          setPaths(exportedPaths);

          // Send the new path to the server with isComplete flag
          console.log("[Canvas] Sending final drawing event:", newPath);
          channel.push("drawing", {
            drawMode: newPath.drawMode,
            strokeColor: newPath.strokeColor,
            strokeWidth: newPath.strokeWidth,
            paths: newPath.paths,
            isComplete: true,
          });
        }
      })
      .catch((error) => {
        console.error("[Canvas] Error exporting paths:", error);
      });
  };

  return (
    <div className="w-full h-full flex flex-col md:gap-2 md:p-4 bg-transparent font-sans">
      {/* Game Info Display - Show for both drawer and non-drawers */}
      <div className="relative flex flex-col gap-2 md:mb-2 p-2 overflow-hidden">
        {/* Glass backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-lg"></div>

        {/* Content */}
        <div className="relative">
          {/* Game Info Display */}
          {roomStatus === "started" && gameInfo ? (
            <div className="flex items-center justify-between px-2 py-1">
              {/* Round and Timer info - stacked vertically */}
              <div className="flex flex-col text-xs lg:text-sm text-white/90 drop-shadow-md">
                <span className="font-medium">
                  Round {gameInfo.currentRound} of {gameInfo.maxRounds}
                </span>
                {timeLeft && timeLeft > 0 ? (
                  <span
                    className={`font-medium drop-shadow-md ${
                      timeLeft <= 10 ? "text-red-300" : "text-green-300"
                    }`}
                  >
                    Timer: {timeLeft}s
                  </span>
                ) : null}
              </div>

              {/* Word Display */}
              <div className="text-center flex-1 mx-4">
                <p className="text-base font-medium lg:text-md xl:text-lg tracking-widest text-cyan-300 drop-shadow-lg">
                  {(() => {
                    // Check if word selection is happening (for all players)
                    const isWordSelectionPhase =
                      gameInfo?.currentDrawer &&
                      (!timeLeft || timeLeft === 0) &&
                      (!wordLength || wordLength === 0) &&
                      !wordToDraw;

                    if (isWordSelectionPhase) {
                      return isDrawer
                        ? "Choose your word"
                        : "Waiting for word selection";
                    }

                    if (isDrawer) {
                      return wordToDraw;
                    }

                    if (guessed) {
                      return wordToDraw?.split("").join(" ");
                    }

                    if (revealedLetters && revealedLetters.length > 0) {
                      return revealedLetters
                        .map((letter, index) => {
                          // If this index is a space or hyphen, show the actual character
                          const specialChar = specialChars?.find(sc => sc.index === index);
                          if (specialChar) {
                            return specialChar.char;
                          }
                          return letter || "_";
                        })
                        .join("");
                    }

                    if (wordLength && wordLength > 0) {
                      return Array(wordLength).fill("_")
                        .map((char, index) => {
                          // If this index is a space or hyphen, show the actual character  
                          const specialChar = specialChars?.find(sc => sc.index === index);
                          if (specialChar) {
                            return specialChar.char;
                          }
                          return char;
                        })
                        .join("");
                    }

                    return "";
                  })()}
                </p>
              </div>

              {/* Settings and Feedback buttons */}
              <div className="flex flex-col gap-1">
                {/* Settings button */}
                {onShowSettings && (
                  <button
                    onClick={() => {
                      setShowBrushSlider(false);
                      onShowSettings();
                    }}
                    className="flex items-center justify-center px-2 py-1 text-white/70 hover:text-white rounded-md text-sm font-medium transition-all duration-300 hover:cursor-pointer hover:scale-110"
                    title="View room settings"
                  >
                    <svg
                      className="h-5 w-5 drop-shadow-md"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                )}

                {/* Feedback button */}
                <a
                  href="https://forms.gle/iuJVLc5qYkKrxFq38"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center px-2 py-1 text-white/70 hover:text-white rounded-md text-sm font-medium transition-all duration-300 hover:cursor-pointer hover:scale-110"
                  title="Give us feedback"
                >
                  <Image
                    src="/survey.png"
                    alt="Feedback"
                    width={20}
                    height={20}
                    className="h-5 w-5 drop-shadow-md invert"
                  />
                </a>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-center px-2 py-1">
              <div className="py-2 text-center text-cyan-300 font-medium flex-1 drop-shadow-lg">
                Game not started yet
              </div>

              {/* Settings and Feedback buttons for waiting state */}
              <div className="flex gap-1">
                {/* Settings button */}
                {onShowSettings && (
                  <button
                    onClick={() => {
                      setShowBrushSlider(false);
                      onShowSettings();
                    }}
                    className="flex items-center justify-center px-2 py-1 text-white/70 hover:text-white rounded-md text-sm font-medium transition-all duration-300 hover:cursor-pointer hover:scale-110"
                    title="View room settings"
                  >
                    <svg
                      className="h-5 w-5 drop-shadow-md"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                )}

                {/* Feedback button */}
                <a
                  href="https://forms.gle/iuJVLc5qYkKrxFq38"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center px-2 py-1 text-white/70 hover:text-white rounded-md text-sm font-medium transition-all duration-300 hover:cursor-pointer hover:scale-110"
                  title="Give us feedback"
                >
                  <Image
                    src="/survey.png"
                    alt="Feedback"
                    width={20}
                    height={20}
                    className="h-5 w-5 drop-shadow-md invert"
                  />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Drawing canvas */}
      <div
        ref={canvasContainerRef}
        className="relative flex-1 border border-white/20 rounded-lg shadow-inner overflow-hidden bg-white min-h-0"
        style={{
          cursor: isDrawer
            ? isEraser
              ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${
                  eraserWidth * 2
                }' height='${eraserWidth * 2}' viewBox='0 0 ${
                  eraserWidth * 2
                } ${
                  eraserWidth * 2
                }'%3E%3Ccircle cx='${eraserWidth}' cy='${eraserWidth}' r='${
                  eraserWidth - 1
                }' fill='none' stroke='black' stroke-width='1'/%3E%3C/svg%3E") ${eraserWidth} ${eraserWidth}, auto`
              : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${
                  strokeWidth * 2
                }' height='${strokeWidth * 2}' viewBox='0 0 ${
                  strokeWidth * 2
                } ${
                  strokeWidth * 2
                }'%3E%3Ccircle cx='${strokeWidth}' cy='${strokeWidth}' r='${strokeWidth}' fill='${encodeURIComponent(
                  color
                )}'/%3E%3C/svg%3E") ${strokeWidth} ${strokeWidth}, auto`
            : "not-allowed",
        }}
      >
        <ReactSketchCanvas
          ref={canvasRef}
          width="100%"
          height="100%"
          strokeWidth={strokeWidth}
          strokeColor={color}
          eraserWidth={eraserWidth}
          canvasColor="white"
          onStroke={isDrawer ? handleStroke : undefined}
          onChange={isDrawer ? handleDrawingMove : undefined}
          allowOnlyPointerType="all"
          style={{
            border: "none",
            borderRadius: "8px",
            display: "block",
            pointerEvents: isDrawer ? "auto" : "none",
          }}
        />
        
        {/* Like/Dislike buttons - Only show when turn has started (word selected) and user is not the drawer */}
        {gameStarted && !isDrawer && onLikeDrawing && onDislikeDrawing && timeLeft && timeLeft > 0 && (
          <div className="absolute top-2 right-2 flex gap-1 z-10">
            <button
              onClick={handleLikeClick}
              disabled={actionTaken !== null}
              className={`p-1 transition-all duration-200 rounded-full cursor-pointer ${
                actionTaken !== null
                  ? "bg-white/50 opacity-50 cursor-not-allowed" 
                  : "bg-white/80 hover:bg-white hover:scale-125"
              }`}
              title={actionTaken === 'like' ? "You liked this drawing" : actionTaken === 'dislike' ? "You disliked this drawing" : "Like this drawing"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`w-5 h-5 ${
                  actionTaken === 'like'
                    ? "text-green-600" 
                    : actionTaken !== null
                    ? "text-green-300" 
                    : "text-green-500 hover:text-green-600"
                }`}
              >
                <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
              </svg>
            </button>
            
            <button
              onClick={handleDislikeClick}
              disabled={actionTaken !== null}
              className={`p-1 transition-all duration-200 rounded-full cursor-pointer ${
                actionTaken !== null
                  ? "bg-white/50 opacity-50 cursor-not-allowed" 
                  : "bg-white/80 hover:bg-white hover:scale-125"
              }`}
              title={actionTaken === 'dislike' ? "You disliked this drawing" : actionTaken === 'like' ? "You liked this drawing" : "Dislike this drawing"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className={`w-5 h-5 transform rotate-180 ${
                  actionTaken === 'dislike'
                    ? "text-red-600" 
                    : actionTaken !== null
                    ? "text-red-300" 
                    : "text-red-500 hover:text-red-600"
                }`}
              >
                <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.375c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Drawing tools - Improved but compact */}
      {isDrawer && (
        <div className="relative flex flex-col gap-3 p-3 overflow-hidden">
          {/* Glass backdrop */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 rounded-lg"></div>

          {/* Content */}
          <div className="relative">
            {/* Mobile Layout - Single line with colors and tools */}
            <div className="flex items-center justify-center gap-0.5 sm:gap-1 md:hidden px-1 sm:px-2">
              {/* Colors - Mobile */}
              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                {colors.map((c) => (
                  <button
                    key={c}
                    aria-label={`Select color ${c}`}
                    onClick={() => handleColorChange(c)}
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border transition-all duration-150 ease-out hover:cursor-pointer flex-shrink-0 ${
                      color === c && !isEraser
                        ? "border-cyan-300 scale-110 ring-1 ring-cyan-200/50 shadow-md border-2 sm:border-2"
                        : "border-white/30 hover:border-white/50 hover:scale-105 border-1 sm:border-2"
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && !isEraser && (
                      <svg
                        className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-white drop-shadow-md mx-auto"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {/* Separator - Mobile */}
              <div className="border-l border-white/30 h-3 sm:h-4 mx-0.5 sm:mx-1 flex-shrink-0"></div>

              {/* Tools - Mobile */}
              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                <button
                  onClick={handleDrawModeClick}
                  className={`relative p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all duration-150 font-medium flex items-center justify-center hover:cursor-pointer hover:scale-105 flex-shrink-0`}
                  title="Draw Mode"
                >
                  <div
                    className={`absolute inset-0 backdrop-blur-md border rounded-md sm:rounded-lg transition-all duration-300 ${
                      !isEraser
                        ? "bg-blue-500/80 border-blue-400/50"
                        : "bg-white/10 border-white/30"
                    }`}
                  ></div>
                  <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-md sm:rounded-lg"></div>
                  <svg
                    className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 text-white drop-shadow-md"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </button>

                <button
                  onClick={handleEraseModeClick}
                  className={`relative p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all duration-150 font-medium flex items-center justify-center hover:cursor-pointer hover:scale-105 flex-shrink-0`}
                  title="Eraser Mode"
                >
                  <div
                    className={`absolute inset-0 backdrop-blur-md border rounded-md sm:rounded-lg transition-all duration-300 ${
                      isEraser
                        ? "bg-pink-500/80 border-pink-400/50"
                        : "bg-white/10 border-white/30"
                    }`}
                  ></div>
                  <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-md sm:rounded-lg"></div>
                  <svg
                    className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 text-white drop-shadow-md"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53c-.39.39-1.02.39-1.41 0L2.81 12.75c-.78-.79-.78-2.05 0-2.84L11.6 1.12c.78-.78 2.05-.78 2.83 0l1.81 1.81zm-.71 4.24L11.66 3.93c-.39-.39-1.02-.39-1.41 0L2.5 11.68c-.39.39-.39 1.02 0 1.41l7.77 7.77c.39.39 1.02.39 1.41 0l7.75-7.75c.39-.39.39-1.02 0-1.41l-3.89-3.9z" />
                  </svg>
                </button>

                <button
                  onClick={handleClear}
                  className="relative p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all duration-150 hover:cursor-pointer hover:scale-105 flex-shrink-0"
                  title="Clear All"
                >
                  <div className="absolute inset-0 bg-red-500/80 backdrop-blur-md border border-red-400/50 rounded-md sm:rounded-lg hover:bg-red-400/90 transition-all duration-300"></div>
                  <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-md sm:rounded-lg"></div>
                  <svg
                    className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 text-white drop-shadow-md"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Desktop Layout - Single centered row */}
            <div className="hidden md:flex items-center justify-center gap-3">
              {/* Colors - Desktop */}
              <div className="flex items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    aria-label={`Select color ${c}`}
                    onClick={() => handleColorChange(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all duration-150 ease-out hover:cursor-pointer ${
                      color === c && !isEraser
                        ? "border-cyan-300 scale-110 ring-2 ring-cyan-200/50 shadow-md"
                        : "border-white/30 hover:border-white/50 hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && !isEraser && (
                      <svg
                        className="w-3 h-3 text-white drop-shadow-md mx-auto"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {/* Separator - Desktop */}
              <div className="border-l border-white/30 h-6 mx-2"></div>

              {/* Tools - Desktop */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDrawModeClick}
                  className={`relative p-2 rounded-lg transition-all duration-150 font-medium flex items-center justify-center hover:cursor-pointer hover:scale-105`}
                  title="Draw Mode"
                >
                  <div
                    className={`absolute inset-0 backdrop-blur-md border rounded-lg transition-all duration-300 ${
                      !isEraser
                        ? "bg-blue-500/80 border-blue-400/50"
                        : "bg-white/10 border-white/30"
                    }`}
                  ></div>
                  <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-lg"></div>
                  <svg
                    className="relative w-5 h-5 text-white drop-shadow-md"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </button>

                <button
                  onClick={handleEraseModeClick}
                  className={`relative p-2 rounded-lg transition-all duration-150 font-medium flex items-center justify-center hover:cursor-pointer hover:scale-105`}
                  title="Eraser Mode"
                >
                  <div
                    className={`absolute inset-0 backdrop-blur-md border rounded-lg transition-all duration-300 ${
                      isEraser
                        ? "bg-pink-500/80 border-pink-400/50"
                        : "bg-white/10 border-white/30"
                    }`}
                  ></div>
                  <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-lg"></div>
                  <svg
                    className="relative w-5 h-5 text-white drop-shadow-md"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53c-.39.39-1.02.39-1.41 0L2.81 12.75c-.78-.79-.78-2.05 0-2.84L11.6 1.12c.78-.78 2.05-.78 2.83 0l1.81 1.81zm-.71 4.24L11.66 3.93c-.39-.39-1.02-.39-1.41 0L2.5 11.68c-.39.39-.39 1.02 0 1.41l7.77 7.77c.39.39 1.02.39 1.41 0l7.75-7.75c.39-.39.39-1.02 0-1.41l-3.89-3.9z" />
                  </svg>
                </button>

                <button
                  onClick={handleClear}
                  className="relative p-2 rounded-lg transition-all duration-150 hover:cursor-pointer hover:scale-105"
                  title="Clear All"
                >
                  <div className="absolute inset-0 bg-red-500/80 backdrop-blur-md border border-red-400/50 rounded-lg hover:bg-red-400/90 transition-all duration-300"></div>
                  <div className="absolute inset-[1px] bg-gradient-to-r from-white/20 to-transparent rounded-lg"></div>
                  <svg
                    className="relative w-5 h-5 text-white drop-shadow-md"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Brush size slider - improved styling */}
            {showBrushSlider && (
              <div className="fixed translate-y-[-100%] left-0 right-0 mx-auto max-w-xs sm:max-w-md z-50 p-2 sm:p-3 overflow-hidden rounded-md sm:rounded-lg">
                {/* Slider glass backdrop */}
                <div className="absolute inset-0 bg-white/20 backdrop-blur-xl border border-white/30 rounded-md sm:rounded-lg"></div>

                {/* Slider content */}
                <div className="relative flex items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                        isEraser ? "bg-red-300" : "bg-blue-300"
                      }`}
                    ></div>
                    <span className="text-xs sm:text-sm text-white/90 font-medium drop-shadow-md">
                      {isEraser ? "Eraser" : "Brush"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={isEraser ? "50" : "20"}
                    value={isEraser ? eraserWidth : strokeWidth}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isEraser) {
                        setEraserWidth(value);
                      } else {
                        setStrokeWidth(value);
                      }
                    }}
                    className="flex-1 h-1.5 sm:h-2 bg-white/20 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3 sm:[&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-3 sm:[&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-cyan-400
                      [&::-webkit-slider-thumb]:shadow-sm"
                  />
                  <span className="text-xs sm:text-sm text-white/70 w-6 sm:w-8 drop-shadow-md">
                    {isEraser ? eraserWidth : strokeWidth}px
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
