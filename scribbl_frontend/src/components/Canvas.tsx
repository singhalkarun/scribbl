"use client";

import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { useRef, useState } from "react";

const colors = ["black", "red", "blue", "green", "orange", "purple"];

export default function Canvas() {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [color, setColor] = useState("black");
  const [mode, setMode] = useState<"draw" | "erase">("draw");

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    setMode("draw");
    canvasRef.current?.eraseMode(false);
  };

  const handleErase = () => {
    setMode("erase");
    canvasRef.current?.eraseMode(true);
  };

  const handleDraw = () => {
    setMode("draw");
    canvasRef.current?.eraseMode(false);
  };

  const handleClear = () => {
    canvasRef.current?.clearCanvas();
  };

  const handleUndo = () => {
    canvasRef.current?.undo();
  };

  const handleRedo = () => {
    canvasRef.current?.redo();
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* Color buttons */}
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => handleColorChange(c)}
            className={`w-6 h-6 rounded-full border-2 ${
              color === c ? "border-black" : "border-gray-300"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}

        {/* Mode toggle */}
        <button
          onClick={handleDraw}
          className={`px-2 py-1 rounded ${
            mode === "draw" ? "bg-blue-500 text-white" : "bg-gray-200"
          }`}
        >
          Draw
        </button>
        <button
          onClick={handleErase}
          className={`px-2 py-1 rounded ${
            mode === "erase" ? "bg-blue-500 text-white" : "bg-gray-200"
          }`}
        >
          Erase
        </button>

        {/* Actions */}
        <button
          onClick={handleUndo}
          className="px-2 py-1 bg-yellow-200 rounded"
        >
          Undo
        </button>
        <button
          onClick={handleRedo}
          className="px-2 py-1 bg-yellow-200 rounded"
        >
          Redo
        </button>
        <button
          onClick={handleClear}
          className="px-2 py-1 bg-red-400 text-white rounded"
        >
          Clear
        </button>
      </div>

      {/* Drawing canvas */}
      <div
        className="relative flex-1"
        style={{
          cursor: "url('/pencil.png') 0 40, auto",
        }}
      >
        <ReactSketchCanvas
          ref={canvasRef}
          width="100%"
          height="100%"
          strokeWidth={4}
          strokeColor={color}
          eraserWidth={10}
          style={{
            border: "1px solid #ccc",
            borderRadius: "8px",
          }}
        />
      </div>
    </div>
  );
}
