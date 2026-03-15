import React from "react";
import { doodleAvatar } from "@/lib/doodleAvatar";

interface DoodleAvatarProps {
  name: string;
  seed?: number;
  size?: number;
  className?: string;
}

export const DoodleAvatar = React.memo(function DoodleAvatar({
  name,
  seed = 0,
  size = 48,
  className = "",
}: DoodleAvatarProps) {
  const svg = doodleAvatar(name, seed);

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label={`Avatar for ${name}`}
      role="img"
    />
  );
});
