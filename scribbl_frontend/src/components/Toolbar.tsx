import React from "react";

const COLORS = [
  "#333333", "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
  "#3498db", "#9b59b6", "#FD79A8", "#8B4513", "#FFFFFF",
];

interface ToolbarProps {
  activeColor: string;
  activeTool: "draw" | "erase";
  brushSize: number;
  onColorChange: (color: string) => void;
  onToolChange: (tool: "draw" | "erase") => void;
  onBrushSizeChange: (size: number) => void;
  onUndo: () => void;
  onClear: () => void;
}

export function Toolbar({
  activeColor,
  activeTool,
  brushSize,
  onColorChange,
  onToolChange,
  onBrushSizeChange,
  onUndo,
  onClear,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0 py-1.5 flex-wrap">
      {/* Color palette */}
      <div className="flex gap-1 flex-wrap max-w-[320px]">
        {COLORS.map((color) => (
          <button
            key={color}
            onClick={() => { onColorChange(color); onToolChange("draw"); }}
            className="w-[26px] h-[26px] rounded-full border-[2.5px] border-ink transition-transform duration-150 hover:scale-[1.15] focus-visible:outline-[3px] focus-visible:outline-[var(--color-blue)] focus-visible:outline-offset-2"
            style={{
              backgroundColor: color,
              boxShadow: activeColor === color && activeTool === "draw"
                ? `0 0 0 3px var(--bg-cream), 0 0 0 5.5px #333`
                : "none",
              transform: activeColor === color && activeTool === "draw" ? "scale(1.1)" : "scale(1)",
              borderColor: color === "#FFFFFF" ? "#ccc" : "#333",
            }}
            aria-label={`Color ${color}`}
          />
        ))}
      </div>

      {/* Tool buttons */}
      <div className="flex gap-1 ml-2">
        {[
          { tool: "draw" as const, icon: "✏️", label: "Draw" },
          { tool: "erase" as const, icon: "🧽", label: "Eraser" },
        ].map(({ tool, icon, label }) => (
          <button
            key={tool}
            onClick={() => onToolChange(tool)}
            className={`border-[2.5px] border-ink rounded-scribbl-sm px-2.5 py-1 text-base shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs transition-all duration-150 focus-visible:outline-[3px] focus-visible:outline-[var(--color-blue)] focus-visible:outline-offset-2 ${
              activeTool === tool ? "bg-[var(--color-blue)]" : "bg-white"
            }`}
            aria-label={label}
          >
            {icon}
          </button>
        ))}
        <button
          onClick={onUndo}
          className="border-[2.5px] border-ink rounded-scribbl-sm px-2.5 py-1 text-base bg-white shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs transition-all duration-150 focus-visible:outline-[3px] focus-visible:outline-[var(--color-blue)] focus-visible:outline-offset-2"
          aria-label="Undo"
        >
          ↩️
        </button>
        <button
          onClick={onClear}
          className="border-[2.5px] border-ink rounded-scribbl-sm px-2.5 py-1 text-base bg-white shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs transition-all duration-150 focus-visible:outline-[3px] focus-visible:outline-[var(--color-blue)] focus-visible:outline-offset-2"
          aria-label="Clear canvas"
        >
          🗑️
        </button>
      </div>

      {/* Brush size */}
      <div className="flex items-center gap-1.5 ml-2">
        <div className="w-6 h-6 flex items-center justify-center">
          <div className="rounded-full bg-border" style={{ width: 8, height: 8 }} />
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="w-20 accent-border"
          aria-label="Brush size"
        />
        <div className="w-6 h-6 flex items-center justify-center">
          <div className="rounded-full bg-border" style={{ width: 18, height: 18 }} />
        </div>
      </div>
    </div>
  );
}
