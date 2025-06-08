"use client";

import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import React, { useRef, useState, useEffect } from "react";
import { usePlayerStore } from "@/store/usePlayerStore";
import Image from "next/image";

const colors = ["black", "red", "blue", "green", "orange", "purple"];

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

  // Track drawing state
  const lastSentPointsRef = useRef<number>(0);
  const isDrawingRef = useRef<boolean>(false);
  const previousPathRef = useRef<SketchPath | null>(null);

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
      console.log("[Canvas] New turn started, clearing canvas");
      setPaths([]);
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
    <div className="w-full h-full flex flex-col md:gap-2 md:p-4 bg-gray-50 font-sans">
      {/* Game Info Display - Show for both drawer and non-drawers */}
      <div className="relative flex flex-col gap-2 md:mb-2 p-2 bg-white rounded-lg md:shadow">
        {/* Game Info Display */}
        {roomStatus === "started" && gameInfo ? (
          <div className="flex items-center justify-between px-2 py-1">
            {/* Round and Timer info - stacked vertically */}
            <div className="flex flex-col text-xs lg:text-sm text-gray-600">
              <span className="font-medium">
                Round {gameInfo.currentRound} of {gameInfo.maxRounds}
              </span>
              {timeLeft && timeLeft > 0 ? (
                <span
                  className={`font-medium ${
                    timeLeft <= 10 ? "text-red-500" : "text-green-600"
                  }`}
                >
                  Timer: {timeLeft}s
                </span>
              ) : null}
            </div>

            {/* Word Display */}
            <div className="text-center flex-1 mx-4">
              <p className="text-base lg:text-lg xl:text-xl font-mono tracking-widest text-indigo-600">
                {(() => {
                  // Check if word selection is happening (for all players)
                  const isWordSelectionPhase =
                    gameInfo?.currentDrawer &&
                    (!timeLeft || timeLeft === 0) &&
                    (!wordLength || wordLength === 0) &&
                    !wordToDraw;

                  if (isWordSelectionPhase) {
                    return isDrawer
                      ? "Choose your word..."
                      : "Waiting for word selection...";
                  }

                  if (isDrawer) {
                    return wordToDraw;
                  }

                  if (guessed) {
                    return wordToDraw?.split("").join(" ");
                  }

                  if (revealedLetters && revealedLetters.length > 0) {
                    return revealedLetters
                      .map((letter, index) => letter || "_")
                      .join(" ");
                  }

                  if (wordLength && wordLength > 0) {
                    return Array(wordLength).fill("_").join(" ");
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
                  onClick={onShowSettings}
                  className="flex items-center justify-center px-2 py-1 text-gray-700 hover:text-indigo-700 rounded-md text-sm font-medium transition-colors hover:cursor-pointer"
                  title="View room settings"
                >
                  <svg
                    className="h-5 w-5"
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
                className="flex items-center justify-center px-2 py-1 text-gray-700 hover:text-indigo-700 rounded-md text-sm font-medium transition-colors hover:cursor-pointer"
                title="Give us feedback"
              >
                <Image
                  src="/survey.png"
                  alt="Feedback"
                  width={20}
                  height={20}
                  className="h-5 w-5"
                />
              </a>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center px-2 py-1">
            <div className="py-2 text-center text-indigo-700 font-medium flex-1">
              Game not started yet
            </div>

            {/* Settings and Feedback buttons for waiting state */}
            <div className="flex gap-1">
              {/* Settings button */}
              {onShowSettings && (
                <button
                  onClick={onShowSettings}
                  className="flex items-center justify-center px-2 py-1 text-gray-700 hover:text-indigo-700 rounded-md text-sm font-medium transition-colors hover:cursor-pointer"
                  title="View room settings"
                >
                  <svg
                    className="h-5 w-5"
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
                className="flex items-center justify-center px-2 py-1 text-gray-700 hover:text-indigo-700 rounded-md text-sm font-medium transition-colors hover:cursor-pointer"
                title="Give us feedback"
              >
                <Image
                  src="/survey.png"
                  alt="Feedback"
                  width={20}
                  height={20}
                  className="h-5 w-5"
                />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Drawing canvas */}
      <div
        ref={canvasContainerRef}
        className="relative flex-1 border border-gray-300 rounded-lg shadow-inner overflow-hidden bg-white min-h-0"
        style={{
          cursor: isDrawer
            ? isEraser
              ? `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${
                  eraserWidth * 2
                }" height="${eraserWidth * 2}" viewBox="0 0 ${
                  eraserWidth * 2
                } ${
                  eraserWidth * 2
                }"><circle cx="${eraserWidth}" cy="${eraserWidth}" r="${
                  eraserWidth - 1
                }" fill="none" stroke="black" stroke-width="1"/></svg>') ${eraserWidth} ${eraserWidth}, auto`
              : `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${
                  strokeWidth * 2
                }" height="${strokeWidth * 2}" viewBox="0 0 ${
                  strokeWidth * 2
                } ${
                  strokeWidth * 2
                }"><circle cx="${strokeWidth}" cy="${strokeWidth}" r="${strokeWidth}" fill="${color}" /></svg>') ${strokeWidth} ${strokeWidth}, auto`
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
      </div>

      {/* Drawing tools - Moved to bottom */}
      {isDrawer && (
        <div className="relative flex flex-col gap-2 p-2 bg-white rounded-lg md:shadow">
          {/* Main controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Color buttons */}
            {colors.map((c) => (
              <button
                key={c}
                aria-label={`Select color ${c}`}
                onClick={() => handleColorChange(c)}
                className={`w-8 h-8 rounded-full border-2 transition-transform duration-150 ease-in-out hover:cursor-pointer ${
                  color === c && !isEraser
                    ? "border-blue-600 scale-110 ring-2 ring-blue-300"
                    : "border-gray-300 hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}

            {/* Separator */}
            <div className="border-l border-gray-300 h-6 mx-2"></div>

            {/* Mode toggle */}
            <button
              onClick={handleDrawModeClick}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:cursor-pointer ${
                !isEraser
                  ? "bg-blue-500 text-white shadow-sm"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Draw
            </button>
            <button
              onClick={handleEraseModeClick}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:cursor-pointer ${
                isEraser
                  ? "bg-red-500 text-white shadow-sm"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Erase
            </button>

            <button
              onClick={handleClear}
              className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors shadow-sm hover:cursor-pointer"
            >
              Clear All
            </button>
          </div>

          {/* Brush size slider - Position absolutely */}
          {showBrushSlider && (
            <div className="absolute bottom-full left-0 right-0 z-10 mb-1 p-2 bg-white rounded-t-lg shadow-md border-b border-gray-100 flex items-center gap-4 px-4">
              <span className="text-sm text-gray-600 flex-shrink-0">
                {isEraser ? "Eraser Size" : "Brush Size"}
              </span>
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
                className="w-48"
              />
              <span className="text-sm text-gray-600">
                {isEraser ? eraserWidth : strokeWidth}px
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
