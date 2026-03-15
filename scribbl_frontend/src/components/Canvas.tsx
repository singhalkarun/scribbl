"use client";

import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import React, {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { usePlayerStore } from "@/store/usePlayerStore";

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

export interface CanvasHandle {
  undo: () => void;
  clear: () => void;
}

interface CanvasProps {
  isDrawer: boolean;
  gameStarted?: boolean;
  // Like/dislike functionality
  onLikeDrawing?: () => void;
  onDislikeDrawing?: () => void;
  // Drawing tool state (externalized)
  activeColor: string;
  activeTool: "draw" | "erase";
  brushSize: number;
  // Game state needed for like/dislike visibility
  timeLeft?: number;
  // Drawer change tracking for resetting like/dislike
  currentDrawer?: string;
  currentRound?: string;
  roomStatus?: string;
}

interface DrawingData {
  drawMode: boolean;
  strokeColor: string;
  strokeWidth: number;
  paths: NormalizedPathPoint[];
  isComplete: boolean;
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  {
    isDrawer,
    gameStarted = false,
    onLikeDrawing,
    onDislikeDrawing,
    activeColor,
    activeTool,
    brushSize,
    timeLeft,
    currentDrawer,
    currentRound,
    roomStatus,
  },
  ref
) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { channel } = usePlayerStore();

  // Derived state from props
  const isEraser = activeTool === "erase";
  const strokeWidth = isEraser ? brushSize : brushSize;
  const eraserWidth = brushSize;
  const color = activeColor;

  const [paths, setPaths] = useState<SketchPath[]>([]);

  // State for like/dislike usage per turn (user can only do one action)
  const [actionTaken, setActionTaken] = useState<"like" | "dislike" | null>(
    null
  );

  // Track drawing state
  const lastSentPointsRef = useRef<number>(0);
  const isDrawingRef = useRef<boolean>(false);
  const previousPathRef = useRef<SketchPath | null>(null);

  // Reset like/dislike state when drawer changes (new turn) or game starts
  useEffect(() => {
    setActionTaken(null);
  }, [currentDrawer, roomStatus]);

  // Additional reset when round changes
  useEffect(() => {
    setActionTaken(null);
  }, [currentRound]);

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

  // Handle like/dislike with state management (user can only do one action)
  const handleLikeClick = () => {
    if (actionTaken || !onLikeDrawing) return;
    setActionTaken("like");
    onLikeDrawing();
  };

  const handleDislikeClick = () => {
    if (actionTaken || !onDislikeDrawing) return;
    setActionTaken("dislike");
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

  const handleUndo = () => {
    if (!isDrawer || !canvasRef.current) return;
    canvasRef.current.undo();
  };

  // Expose undo and clear to parent via ref
  useImperativeHandle(ref, () => ({
    undo: handleUndo,
    clear: handleClear,
  }));

  // Effect to handle wheel event listener for stroke size adjustment
  useEffect(() => {
    if (!isDrawer) return; // Only attach these events for the drawer

    const container = canvasContainerRef.current;

    const handleWheel = (e: WheelEvent) => {
      // Check if it's a pinch zoom gesture (Ctrl key + wheel)
      if (e.ctrlKey) {
        // Prevent browser zoom only when Ctrl is pressed
        e.preventDefault();
      }
      // Note: brush size is now controlled externally via props
    };

    if (container) {
      // Add listener with passive: false to allow preventDefault
      container.addEventListener("wheel", handleWheel, { passive: false });
    }

    // Cleanup function to remove the listeners
    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel);
      }
    };
  }, [isDrawer]);

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
    <div className="bg-white border-[3px] border-ink rounded-[16px] shadow-scribbl-md relative overflow-hidden w-full h-full">
      {/* Pin decoration */}
      <div className="absolute -top-[10px] right-4 text-xl rotate-[15deg] z-[2] pointer-events-none">
        📌
      </div>

      {/* Drawing canvas */}
      <div
        ref={canvasContainerRef}
        className="relative w-full h-full overflow-hidden"
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
            borderRadius: "13px",
            display: "block",
            pointerEvents: isDrawer ? "auto" : "none",
          }}
        />

        {/* Like/Dislike buttons - Only show when turn has started (word selected) and user is not the drawer */}
        {gameStarted &&
          !isDrawer &&
          onLikeDrawing &&
          onDislikeDrawing &&
          timeLeft &&
          timeLeft > 0 && (
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={handleLikeClick}
                disabled={actionTaken !== null}
                className={`p-1 transition-all duration-200 rounded-full cursor-pointer ${
                  actionTaken !== null
                    ? "bg-white/50 opacity-50 cursor-not-allowed"
                    : "bg-white/80 hover:bg-white hover:scale-125"
                }`}
                title={
                  actionTaken === "like"
                    ? "You liked this drawing"
                    : actionTaken === "dislike"
                      ? "You disliked this drawing"
                      : "Like this drawing"
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-5 h-5 ${
                    actionTaken === "like"
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
                title={
                  actionTaken === "dislike"
                    ? "You disliked this drawing"
                    : actionTaken === "like"
                      ? "You liked this drawing"
                      : "Dislike this drawing"
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-5 h-5 transform rotate-180 ${
                    actionTaken === "dislike"
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
    </div>
  );
});

export default Canvas;
