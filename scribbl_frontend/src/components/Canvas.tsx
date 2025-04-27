"use client";

import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import React, { useRef, useState, useEffect } from "react";
import io, { Socket } from "socket.io-client";

// Configuration
const SOCKET_SERVER_URL = "";

const colors = ["black", "red", "blue", "green", "orange", "purple"];

// Define proper types for sketch paths
interface PathPoint {
  x: number;
  y: number;
}

interface SketchPath {
  drawMode: boolean;
  strokeColor: string;
  strokeWidth: number;
  paths: PathPoint[];
}

export default function Canvas() {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const socketRef = useRef<Socket | null>(null);

  // State for drawing properties
  const [color, setColor] = useState("black");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [eraserWidth, setEraserWidth] = useState(10);
  const [isEraser, setIsEraser] = useState(false);
  const [paths, setPaths] = useState<SketchPath[]>([]);

  // When paths state changes, update the canvas to match
  useEffect(() => {
    if (canvasRef.current && paths.length >= 0) {
      // Clear first to avoid duplicating paths
      canvasRef.current.clearCanvas();

      // Only load paths if we have any
      if (paths.length > 0) {
        canvasRef.current.loadPaths(paths);
      }
    }
  }, [paths]);

  // WebSocket Connection
  // useEffect(() => {
  //   // Connect to the WebSocket server only once
  //   if (!socketRef.current) {
  //     console.log("Connecting to WebSocket server...");

  //     socketRef.current = io(SOCKET_SERVER_URL, {
  //       transports: ["websocket"],
  //     });

  //     // Socket event listeners
  //     socketRef.current.on("connect", () => {
  //       console.log(
  //         "Connected to WebSocket server with ID:",
  //         socketRef.current?.id
  //       );
  //       // Request initial drawing state from server
  //       socketRef.current?.emit("get_initial_drawing");
  //     });

  //     socketRef.current.on("initial_drawing", (initialPaths: SketchPath[]) => {
  //       console.log("Received initial drawing state");
  //       if (initialPaths && initialPaths.length > 0) {
  //         // Update our state with the initial paths
  //         setPaths(initialPaths);
  //         // Canvas will update via the useEffect hook
  //       }
  //     });

  //     socketRef.current.on("new_path", (newPath: SketchPath) => {
  //       console.log("Received new path from another user");
  //       if (newPath) {
  //         // Add the new path to existing paths
  //         setPaths((prevPaths) => [...prevPaths, newPath]);
  //         // Canvas will update via the useEffect hook
  //       }
  //     });

  //     socketRef.current.on("clear_canvas", () => {
  //       console.log("Received clear canvas command");
  //       setPaths([]);
  //       // Canvas will update via the useEffect hook
  //     });

  //     socketRef.current.on("connect_error", (err) => {
  //       console.error("WebSocket connection error:", err);
  //     });

  //     socketRef.current.on("disconnect", (reason) => {
  //       console.log("Disconnected from WebSocket server:", reason);
  //     });
  //   }

  //   // Cleanup on unmount
  //   return () => {
  //     if (socketRef.current?.connected) {
  //       console.log("Disconnecting WebSocket...");
  //       socketRef.current.disconnect();
  //       socketRef.current = null;
  //     }
  //   };
  // }, []);

  // Drawing Handlers
  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    setIsEraser(false);
    canvasRef.current?.eraseMode(false);
  };

  const handleEraseToggle = (erase: boolean) => {
    setIsEraser(erase);
    canvasRef.current?.eraseMode(erase);
  };

  const handleClear = () => {
    // Clear local state
    setPaths([]);
    // Send clear event to server
    console.log("Sending clear canvas command");
    socketRef.current?.emit("clear_canvas");
    // Canvas will update via the useEffect hook
  };

  // Simpler undo handler that should work without sockets
  const handleUndo = () => {
    if (canvasRef.current) {
      // Perform the undo operation
      canvasRef.current.undo();

      // Update our state after a very brief delay
      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current
            .exportPaths()
            .then((updatedPaths) => {
              setPaths(updatedPaths);
            })
            .catch((err) =>
              console.error("Error exporting paths after undo:", err)
            );
        }
      }, 10); // Very short delay
    }
  };

  // Simpler redo handler that should work without sockets
  const handleRedo = () => {
    if (canvasRef.current) {
      // Perform the redo operation
      canvasRef.current.redo();

      // Update our state after a very brief delay
      setTimeout(() => {
        if (canvasRef.current) {
          canvasRef.current
            .exportPaths()
            .then((updatedPaths) => {
              setPaths(updatedPaths);
            })
            .catch((err) =>
              console.error("Error exporting paths after redo:", err)
            );
        }
      }, 10); // Very short delay
    }
  };

  // Handle stroke completion
  const handleStroke = () => {
    // Export the current paths from the canvas
    canvasRef.current
      ?.exportPaths()
      .then((exportedPaths: SketchPath[]) => {
        // Check if we have any paths
        if (exportedPaths && exportedPaths.length > 0) {
          // If we already have paths in our state and the length increased
          if (paths.length < exportedPaths.length) {
            // The new path is the last one
            const newPath = exportedPaths[exportedPaths.length - 1];

            // Update state with all paths
            setPaths(exportedPaths);

            // Send only the latest path to the server
            console.log("Sending new path:", newPath);
            socketRef.current?.emit("new_path", newPath);
          } else {
            // This might be a case where paths were removed (like undo)
            // or paths were modified but count stayed the same
            setPaths(exportedPaths);

            // We might want to sync the entire state in some cases
            // socketRef.current?.emit("update_paths", exportedPaths);
          }
        } else {
          // No paths - canvas was cleared
          setPaths([]);
        }
      })
      .catch((error) => {
        console.error("Error exporting paths:", error);
      });
  };

  return (
    <div className="w-full h-screen flex flex-col gap-2 p-4 bg-gray-50 font-sans">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap p-2 bg-white rounded-lg shadow">
        {/* Color buttons */}
        {colors.map((c) => (
          <button
            key={c}
            aria-label={`Select color ${c}`}
            onClick={() => handleColorChange(c)}
            className={`w-8 h-8 rounded-full border-2 transition-transform duration-150 ease-in-out ${
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
          onClick={() => handleEraseToggle(false)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:cursor-pointer ${
            !isEraser
              ? "bg-blue-500 text-white shadow-sm"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Draw
        </button>
        <button
          onClick={() => handleEraseToggle(true)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:cursor-pointer ${
            isEraser
              ? "bg-red-500 text-white shadow-sm"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Erase
        </button>

        {/* Separator */}
        {/* <div className="border-l border-gray-300 h-6 mx-2"></div> */}

        {/* Actions */}
        {/* <button
          onClick={handleUndo}
          className="px-3 py-1.5 bg-yellow-400 text-yellow-900 rounded-md text-sm font-medium hover:bg-yellow-500 transition-colors shadow-sm"
        >
          Undo
        </button>
        <button
          onClick={handleRedo}
          className="px-3 py-1.5 bg-yellow-400 text-yellow-900 rounded-md text-sm font-medium hover:bg-yellow-500 transition-colors shadow-sm"
        >
          Redo
        </button> */}
        <button
          onClick={handleClear}
          className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors shadow-sm hover:cursor-pointer"
        >
          Clear All
        </button>
      </div>

      {/* Drawing canvas */}
      <div
        className="relative flex-1 border border-gray-300 rounded-lg shadow-inner overflow-hidden bg-white"
        style={{
          cursor: "url('/pencil.png') 0 40, auto",
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
          onStroke={handleStroke}
          style={{
            border: "none",
            borderRadius: "8px",
            display: "block",
          }}
        />
      </div>
    </div>
  );
}
