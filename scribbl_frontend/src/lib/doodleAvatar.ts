// Simple hash function for deterministic randomness
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Seeded pseudo-random number generator
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

const BG_GRADIENTS: [string, string][] = [
  ["#FF6B6B", "#FD79A8"],
  ["#74B9FF", "#A29BFE"],
  ["#55EFC4", "#00B894"],
  ["#FFEAA7", "#FDCB6E"],
  ["#FD79A8", "#e84393"],
  ["#A29BFE", "#6c5ce7"],
  ["#FF6B6B", "#e17055"],
  ["#55EFC4", "#74B9FF"],
  ["#FDCB6E", "#FF6B6B"],
  ["#74B9FF", "#55EFC4"],
];

type FaceShape = "circle" | "roundedRect" | "triangle" | "ellipse" | "squircle";

const FACE_SHAPES: FaceShape[] = ["circle", "roundedRect", "triangle", "ellipse", "squircle"];

const MOUTHS = [
  'M19 26 Q24 30 29 26',
  'M20 27 L28 27',
  'M19 25 Q24 30 29 25',
  'M21 26 Q24 28 27 26',
  'M22 26 Q24 29 26 26',
];

function renderFace(shape: FaceShape): string {
  switch (shape) {
    case "circle":
      return '<circle cx="24" cy="21" r="13" fill="white" fill-opacity="0.9"/>';
    case "roundedRect":
      return '<rect x="11" y="10" width="26" height="26" rx="7" fill="white" fill-opacity="0.9"/>';
    case "triangle":
      return '<path d="M11 30 L24 7 L37 30 Z" fill="white" fill-opacity="0.9"/>';
    case "ellipse":
      return '<ellipse cx="24" cy="22" rx="14" ry="12" fill="white" fill-opacity="0.9"/>';
    case "squircle":
      return '<rect x="10" y="10" width="28" height="28" rx="12" fill="white" fill-opacity="0.9"/>';
  }
}

function getEyePositions(shape: FaceShape): { lx: number; ly: number; rx: number; ry: number } {
  switch (shape) {
    case "circle": return { lx: 20, ly: 19, rx: 28, ry: 19 };
    case "roundedRect": return { lx: 19, ly: 20, rx: 29, ry: 20 };
    case "triangle": return { lx: 20, ly: 23, rx: 28, ry: 23 };
    case "ellipse": return { lx: 19, ly: 20, rx: 29, ry: 20 };
    case "squircle": return { lx: 19, ly: 21, rx: 29, ry: 21 };
  }
}

let avatarCounter = 0;

export function doodleAvatar(name: string, seed: number = 0): string {
  const hash = hashCode(name + seed.toString());
  const rand = seededRandom(hash);
  const uid = `${hash}-${++avatarCounter}`;

  const gradientIdx = Math.floor(rand() * BG_GRADIENTS.length);
  const [color1, color2] = BG_GRADIENTS[gradientIdx];

  const shapeIdx = Math.floor(rand() * FACE_SHAPES.length);
  const shape = FACE_SHAPES[shapeIdx];

  const mouthIdx = Math.floor(rand() * MOUTHS.length);
  const mouth = MOUTHS[mouthIdx];

  const eyes = getEyePositions(shape);
  const eyeSize = 2 + rand() * 1.5;

  const face = renderFace(shape);

  return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-${uid}" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
      <stop stop-color="${color1}"/>
      <stop offset="1" stop-color="${color2}"/>
    </linearGradient>
  </defs>
  <rect width="48" height="48" rx="12" fill="url(#bg-${uid})"/>
  ${face}
  <circle cx="${eyes.lx}" cy="${eyes.ly}" r="${eyeSize}" fill="#333"/>
  <circle cx="${eyes.rx}" cy="${eyes.ry}" r="${eyeSize}" fill="#333"/>
  <path d="${mouth}" stroke="#333" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`;
}
