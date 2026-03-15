# Scribbl UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the entire Scribbl frontend from dark glassmorphism to a colorful sticker/scrapbook aesthetic with a canvas maximalist game layout.

**Architecture:** Visual-only redesign. Replace all Tailwind glass-effect classes with a warm cream + chunky border + offset shadow design system. Restructure the game page from 3-column to canvas-maximalist layout. Extract large components (Canvas 1073 LOC, game page 1784 LOC) into smaller focused pieces. All game logic, WebSocket handling, state management, and hooks remain unchanged.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Zustand 5, react-sketch-canvas, Phoenix JS client

**Spec:** `docs/superpowers/specs/2026-03-15-ui-redesign-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/doodleAvatar.ts` | Pure function generating deterministic SVG avatars from name + seed |
| `src/components/DoodleAvatar.tsx` | React component wrapping `doodleAvatar()`, memoized |
| `src/components/LandingPage.tsx` | Landing/hero page with CTAs and how-it-works |
| `src/components/JoinCard.tsx` | Join form card (3 variants: play/host/join) |
| `src/components/Lobby.tsx` | Waiting room with player grid, room code, settings |
| `src/components/PlayerBadge.tsx` | Sticker-style player pill for game players bar |
| `src/components/PlayerCard.tsx` | Larger sticker card for lobby player grid |
| `src/components/ChatBar.tsx` | Horizontal message pills + input + expandable panel |
| `src/components/Toolbar.tsx` | Drawing tools: color palette, tool buttons, brush size |
| `src/components/TurnToast.tsx` | Compact turn-over notification bar |
| `src/components/InfoBadge.tsx` | Reusable styled badge (round, word, timer variants) |
| `src/components/WordSelectModal.tsx` | Restyled word selection overlay |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/layout.tsx` | Replace fonts (Outfit/Inter/JetBrains → Lilita One/Nunito), update metadata theme color |
| `src/app/globals.css` | Replace glass keyframes with scrapbook tokens + paper texture + new animations |
| `tailwind.config.ts` | Replace font family vars, update animation config |
| `src/app/join/page.tsx` | Complete rewrite → landing page + join flow |
| `src/app/game/page.tsx` | Major refactor → lobby conditional + canvas maximalist layout, extract toolbar/chat |
| `src/components/Canvas.tsx` | Restyle container + extract toolbar to separate component |
| `src/components/Chat.tsx` | Replace with new ChatBar (keep message logic, change rendering) |
| `src/components/GameOverModal.tsx` | Restyle from glass to scrapbook |
| `src/components/KickPlayerModal.tsx` | Restyle from glass to scrapbook |
| `src/components/KickedModal.tsx` | Restyle from glass to scrapbook |
| `src/components/InstructionsModal.tsx` | Remove (instructions folded into landing page) |
| `src/components/VoiceChat.tsx` | Extract player list rendering, keep voice logic |
| `src/components/BackgroundMusic.tsx` | Remove (replaced by minimal sound effects in useSoundEffects) |
| `src/store/usePlayerStore.ts` | Change `avatar` field from string (emoji) to number (seed) |

### Removed Files
| File | Reason |
|------|--------|
| `src/components/InstructionsModal.tsx` | Content moves to landing page how-it-works section |
| `src/components/BackgroundMusic.tsx` | Replaced by existing useSoundEffects hook |

---

## Chunk 1: Foundation — Design Tokens, Fonts, and Avatar System

### Task 1: Replace Font Loading

**Files:**
- Modify: `src/app/layout.tsx:8-22` (font imports)
- Modify: `src/app/layout.tsx:105-201` (body className, metadata)

- [ ] **Step 1: Update font imports in layout.tsx**

Replace the three font imports (lines 8-22) with:

```typescript
import { Lilita_One, Nunito } from "next/font/google";

const lilitaOne = Lilita_One({
  variable: "--font-lilita",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});
```

- [ ] **Step 2: Update html element className**

Replace the font variable classes on the `<html>` element (around line 126) to use the new font variables:

```typescript
<html
  lang="en"
  className={`${lilitaOne.variable} ${nunito.variable}`}
  style={{ fontFamily: "var(--font-nunito)" }}
>
```

- [ ] **Step 3: Update metadata theme color**

Change the theme color in the metadata export from `#6366f1` (indigo) to `#FF6B6B` (coral):

```typescript
themeColor: "#FF6B6B",
```

- [ ] **Step 4: Remove unused font references**

Search for and remove any remaining references to `outfit`, `inter`, or `jetbrainsMono` variables in layout.tsx (the SocketInitializer and OrientationLock should not reference fonts). Also remove the Outfit, Inter, JetBrains_Mono imports.

- [ ] **Step 5: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds. Font warnings may appear if other files reference old font vars — those will be fixed in later tasks.

- [ ] **Step 6: Commit**

```bash
git add scribbl_frontend/src/app/layout.tsx
git commit -m "feat(ui): replace fonts with Lilita One and Nunito"
```

### Task 2: Update Design Tokens and Global CSS

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Rewrite globals.css**

Replace the entire contents of `globals.css` with the new design token system:

```css
@import "tailwindcss";

:root {
  /* Backgrounds */
  --bg-cream: #FFF8E7;
  --bg-white: #FFFFFF;

  /* Primary */
  --color-coral: #FF6B6B;
  --color-yellow: #FFEAA7;
  --color-yellow-dark: #FDCB6E;
  --color-green: #55EFC4;
  --color-blue: #74B9FF;
  --color-purple: #A29BFE;
  --color-pink: #FD79A8;

  /* Text */
  --text-primary: #333;
  --text-secondary: #555;
  --text-muted: #888;
  --text-placeholder: #999;
  --text-disabled: #ccc;

  /* Borders */
  --border-color: #333;
  --border-width-lg: 3px;
  --border-width-md: 2.5px;
  --border-width-sm: 2px;

  /* Shadows */
  --shadow-lg: 6px 6px 0 #333;
  --shadow-md: 3px 3px 0 #333;
  --shadow-sm: 2px 2px 0 #333;
  --shadow-xs: 1px 1px 0 #333;

  /* Radii */
  --radius-lg: 20px;
  --radius-md: 14px;
  --radius-sm: 10px;
  --radius-xs: 8px;
  --radius-full: 9999px;

  /* Typography */
  --font-display: var(--font-lilita), cursive;
  --font-body: var(--font-nunito), sans-serif;
  --default-font-family: var(--font-nunito);
  --font-sans: var(--font-nunito);

  /* Transitions */
  --transition-fast: 150ms ease;
}

/* Paper texture background */
body {
  background: var(--bg-cream);
  background-image: radial-gradient(circle, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
  background-size: 24px 24px;
  color: var(--text-primary);
  font-family: var(--font-body);
  overscroll-behavior: none;
}

/* Animations */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

@keyframes shrink {
  from { width: 100%; }
  to { width: 0%; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.animate-float { animation: float 6s ease-in-out infinite; }
.animate-shake { animation: shake 0.5s ease-in-out; }
.animate-fadeIn { animation: fadeIn 0.5s ease-in-out; }
.animate-bounce { animation: bounce 1s ease-in-out infinite; }
.animate-pulse { animation: pulse 2s ease-in-out infinite; }
.animate-shrink { animation: shrink 3s linear forwards; }
.animate-spin { animation: spin 1s linear infinite; }

.animation-delay-500 { animation-delay: 0.5s; }
.animation-delay-1000 { animation-delay: 1s; }
.animation-delay-1500 { animation-delay: 1.5s; }
.animation-delay-2000 { animation-delay: 2s; }
.animation-delay-2500 { animation-delay: 2.5s; }
.animation-delay-3000 { animation-delay: 3s; }
.animation-delay-4000 { animation-delay: 4s; }

/* Focus-visible utility for keyboard navigation */
.focus-ring:focus-visible {
  outline: 3px solid var(--color-blue);
  outline-offset: 2px;
}
/* Hide scrollbar utility */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { scrollbar-width: none; }
```

- [ ] **Step 2: Update tailwind.config.ts**

Replace the entire config with:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        display: ["var(--font-lilita)", "cursive"],
      },
      colors: {
        cream: "#FFF8E7",
        coral: "#FF6B6B",
        "scribbl-yellow": "#FFEAA7",
        "scribbl-yellow-dark": "#FDCB6E",
        "scribbl-green": "#55EFC4",
        "scribbl-blue": "#74B9FF",
        "scribbl-purple": "#A29BFE",
        "scribbl-pink": "#FD79A8",
        ink: "#333333",
      },
      borderRadius: {
        "scribbl-lg": "20px",
        "scribbl-md": "14px",
        "scribbl-sm": "10px",
        "scribbl-xs": "8px",
      },
      boxShadow: {
        "scribbl-lg": "6px 6px 0 #333",
        "scribbl-md": "3px 3px 0 #333",
        "scribbl-sm": "2px 2px 0 #333",
        "scribbl-xs": "1px 1px 0 #333",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 3: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds. Visual regressions expected (old glass classes no longer styled) — this is intentional.

- [ ] **Step 4: Commit**

```bash
git add scribbl_frontend/src/app/globals.css scribbl_frontend/tailwind.config.ts
git commit -m "feat(ui): add scrapbook design tokens and replace glass theme"
```

### Task 3: Build the Doodle Avatar System

**Files:**
- Create: `src/lib/doodleAvatar.ts`
- Create: `src/components/DoodleAvatar.tsx`
- Modify: `src/store/usePlayerStore.ts` (avatar field type)

- [ ] **Step 1: Create the doodleAvatar utility**

Create `src/lib/doodleAvatar.ts`:

```typescript
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
  // smile
  'M19 26 Q24 30 29 26',
  // flat
  'M20 27 L28 27',
  // open smile
  'M19 25 Q24 30 29 25',
  // small smile
  'M21 26 Q24 28 27 26',
  // surprised
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
  const uid = `${hash}-${++avatarCounter}`; // Unique ID to avoid SVG gradient collisions

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
```

- [ ] **Step 2: Create the DoodleAvatar component**

Create `src/components/DoodleAvatar.tsx`:

```typescript
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
```

- [ ] **Step 3: Update the Zustand store avatar field**

In `src/store/usePlayerStore.ts`, make these specific changes:

1. In the `PlayerMeta` interface (around line 10): change `avatar?: string` to `avatar?: number`
2. In the `PlayerStore` interface: change `avatar: string` to `avatar: number`
3. Change `playerAvatars: { [userId: string]: string }` to `playerAvatars: { [userId: string]: number }`
4. Change `setAvatar: (avatar: string) => void` to `setAvatar: (avatar: number) => void`
5. Change the initial value of `avatar` from `""` to `0`
6. In `updatePlayers` function (around line 169): change the avatar fallback from `"👤"` to `0` — i.e., `meta?.avatar ?? 0`
7. In `applyPresenceDiff` function (around line 213): change the avatar fallback from `"👤"` to `0`, and parse the value with `Number(meta?.avatar ?? 0)`
8. Add a persist migration to handle existing localStorage data. In the `persist` config, add:

```typescript
version: 2,
migrate: (persisted: unknown, version: number) => {
  const state = persisted as Record<string, unknown>;
  if (version < 2 && typeof state.avatar === 'string') {
    state.avatar = 0;
  }
  return state;
},
```

- [ ] **Step 4: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Type errors in join/page.tsx (avatar emoji references), GameOverModal.tsx (avatar rendering), and VoiceChat.tsx (avatar display) are expected and will be fixed in later tasks. The store itself should compile cleanly.

- [ ] **Step 5: Commit**

```bash
git add scribbl_frontend/src/lib/doodleAvatar.ts scribbl_frontend/src/components/DoodleAvatar.tsx scribbl_frontend/src/store/usePlayerStore.ts
git commit -m "feat(ui): add doodle avatar system with deterministic SVG generation"
```

### Task 4: Create Reusable UI Components

**Files:**
- Create: `src/components/InfoBadge.tsx`
- Create: `src/components/PlayerBadge.tsx`
- Create: `src/components/PlayerCard.tsx`

- [ ] **Step 1: Create InfoBadge component**

Create `src/components/InfoBadge.tsx`:

```typescript
import React from "react";

interface InfoBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "round" | "word" | "timer" | "timer-warning";
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: "bg-white",
  round: "bg-[#E8F5E9]",
  word: "bg-[var(--color-yellow)] text-base tracking-[4px] font-extrabold px-5",
  timer: "bg-[#FFDDDD] text-[#e74c3c] min-w-[54px] text-center",
  "timer-warning": "bg-[#FFDDDD] text-[#e74c3c] min-w-[54px] text-center animate-shake",
};

export function InfoBadge({ children, variant = "default", className = "" }: InfoBadgeProps) {
  return (
    <div
      className={`border-[2.5px] border-ink rounded-scribbl-sm px-3.5 py-1 text-[13px] font-bold shadow-scribbl-sm ${variantStyles[variant]} ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create PlayerBadge component**

Create `src/components/PlayerBadge.tsx`:

```typescript
import React from "react";
import { DoodleAvatar } from "@/components/DoodleAvatar";

interface PlayerBadgeProps {
  name: string;
  avatarSeed: number;
  score: number;
  isDrawing?: boolean;
  hasGuessed?: boolean;
  className?: string;
}

export function PlayerBadge({
  name,
  avatarSeed,
  score,
  isDrawing = false,
  hasGuessed = false,
  className = "",
}: PlayerBadgeProps) {
  const bgClass = isDrawing
    ? "bg-[var(--color-yellow)]"
    : hasGuessed
      ? "bg-[#D5F5E3]"
      : "bg-white";

  return (
    <div
      className={`flex items-center gap-1.5 ${bgClass} border-[2.5px] border-ink rounded-[12px] px-3 py-[5px] text-[13px] font-bold shadow-scribbl-sm whitespace-nowrap flex-shrink-0 transition-transform duration-150 odd:-rotate-[0.5deg] even:rotate-[0.5deg] ${className}`}
    >
      <DoodleAvatar name={name} seed={avatarSeed} size={28} className="rounded-[8px] border-2 border-ink flex-shrink-0" />
      <span>{name}</span>
      {isDrawing && <span className="text-xs">✏️</span>}
      {hasGuessed && <span className="text-[#27ae60] text-xs">✓</span>}
      <span className="text-[var(--text-muted)] font-semibold text-xs">{score}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create PlayerCard component**

Create `src/components/PlayerCard.tsx`:

```typescript
import React from "react";
import { DoodleAvatar } from "@/components/DoodleAvatar";

interface PlayerCardProps {
  name: string;
  avatarSeed: number;
  isAdmin?: boolean;
  isYou?: boolean;
  isEmpty?: boolean;
}

export function PlayerCard({ name, avatarSeed, isAdmin, isYou, isEmpty }: PlayerCardProps) {
  if (isEmpty) {
    return (
      <div className="border-[2.5px] border-dashed border-[var(--text-disabled)] rounded-scribbl-md p-3.5 flex flex-col items-center justify-center gap-1.5 min-h-[100px]">
        <span className="text-2xl opacity-30">👤</span>
        <span className="text-[11px] text-[var(--text-disabled)] font-bold">Waiting...</span>
      </div>
    );
  }

  return (
    <div
      className={`border-[2.5px] border-ink rounded-scribbl-md p-3.5 flex flex-col items-center gap-1.5 shadow-scribbl-sm transition-transform duration-150 odd:-rotate-[1deg] even:rotate-[0.5deg] ${
        isYou ? "bg-[#D5F5E3] border-[#27ae60]" : "bg-cream"
      }`}
    >
      <DoodleAvatar name={name} seed={avatarSeed} size={48} className="rounded-scribbl-md border-[2.5px] border-ink" />
      <span className="text-sm font-extrabold text-center max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
        {name}
      </span>
      <div className="flex gap-1">
        {isAdmin && (
          <span className="bg-[var(--color-yellow)] border-[1.5px] border-ink rounded-[6px] px-1.5 py-px text-[9px] font-extrabold uppercase shadow-scribbl-xs">
            Admin
          </span>
        )}
        {isYou && (
          <span className="bg-[var(--color-green)] border-[1.5px] border-ink rounded-[6px] px-1.5 py-px text-[9px] font-extrabold uppercase shadow-scribbl-xs">
            You
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds. These components aren't imported anywhere yet so no integration issues.

- [ ] **Step 5: Commit**

```bash
git add scribbl_frontend/src/components/InfoBadge.tsx scribbl_frontend/src/components/PlayerBadge.tsx scribbl_frontend/src/components/PlayerCard.tsx
git commit -m "feat(ui): add InfoBadge, PlayerBadge, and PlayerCard components"
```

---

## Chunk 2: Landing Page and Join Flow

### Task 5: Build the Landing Page

**Files:**
- Create: `src/components/LandingPage.tsx`

- [ ] **Step 1: Create LandingPage component**

Create `src/components/LandingPage.tsx`. This is a presentational component that receives callbacks for the three CTAs:

```typescript
import React from "react";

interface LandingPageProps {
  onPlayNow: () => void;
  onHostGame: () => void;
  onJoinRoom: () => void;
}

export function LandingPage({ onPlayNow, onHostGame, onJoinRoom }: LandingPageProps) {
  const doodles = ["🎨", "✏️", "🌟", "🎭", "💡", "🖍️", "🎯", "🖌️"];
  const doodlePositions = [
    "top-[8%] left-[8%]",
    "top-[15%] right-[12%]",
    "bottom-[20%] left-[5%]",
    "bottom-[15%] right-[8%]",
    "top-[40%] left-[3%]",
    "top-[35%] right-[5%]",
    "bottom-[35%] left-[15%]",
    "top-[60%] right-[15%]",
  ];

  return (
    <div className="min-h-[100svh] flex flex-col items-center justify-center text-center px-6 py-10 relative overflow-hidden">
      {/* Floating doodles */}
      {doodles.map((emoji, i) => (
        <div
          key={i}
          className={`fixed ${doodlePositions[i]} text-[28px] opacity-[0.12] pointer-events-none animate-float`}
          style={{ animationDelay: `${i * 0.5}s` }}
        >
          {emoji}
        </div>
      ))}

      {/* Logo */}
      <h1 className="font-display text-7xl md:text-8xl mb-1" style={{ textShadow: "4px 4px 0 #333" }}>
        {"Scribbl".split("").map((letter, i) => {
          const colors = ["#FF6B6B", "#FDCB6E", "#55EFC4", "#74B9FF", "#A29BFE", "#FD79A8", "#FF6B6B"];
          const rotations = [-5, 3, -2, 4, -3, 2, -4];
          return (
            <span
              key={i}
              className="inline-block"
              style={{ color: colors[i], transform: `rotate(${rotations[i]}deg)` }}
            >
              {letter}
            </span>
          );
        })}
      </h1>

      {/* Wavy underline */}
      <svg className="w-[200px] mx-auto mb-5" viewBox="0 0 200 12">
        <path
          d="M0,6 Q12,0 25,6 Q38,12 50,6 Q62,0 75,6 Q88,12 100,6 Q112,0 125,6 Q138,12 150,6 Q162,0 175,6 Q188,12 200,6"
          fill="none" stroke="#FF6B6B" strokeWidth="3" strokeLinecap="round"
        />
      </svg>

      {/* Tagline */}
      <p className="text-[22px] font-bold text-[var(--text-secondary)] mb-10">
        <span className="text-coral">Draw</span>
        <span className="text-[var(--text-placeholder)] mx-1">·</span>
        <span className="text-[var(--color-blue)]">Guess</span>
        <span className="text-[var(--text-placeholder)] mx-1">·</span>
        <span className="text-[var(--color-green)]">Laugh</span>
      </p>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap justify-center mb-12">
        <button
          onClick={onPlayNow}
          className="font-extrabold text-lg px-9 py-3.5 rounded-[16px] border-[3px] border-ink bg-[var(--color-green)] text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
        >
          Play Now ✏️
        </button>
        <button
          onClick={onHostGame}
          className="font-extrabold text-lg px-9 py-3.5 rounded-[16px] border-[3px] border-ink bg-[var(--color-blue)] text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
        >
          Host Game 🏠
        </button>
        <button
          onClick={onJoinRoom}
          className="font-extrabold text-lg px-9 py-3.5 rounded-[16px] border-[3px] border-ink bg-[var(--color-yellow)] text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150"
        >
          Join Room 🔗
        </button>
      </div>

      {/* How It Works */}
      <div className="flex flex-col sm:flex-row gap-6 flex-wrap justify-center max-w-[800px] mx-auto mb-12">
        {[
          { icon: "✏️", title: "Draw", desc: "It's your turn! Draw the secret word before time runs out", num: 1, rotate: "-1.5deg" },
          { icon: "💬", title: "Guess", desc: "Watch others draw and type your guesses. Faster = more points!", num: 2, rotate: "1deg" },
          { icon: "🏆", title: "Win", desc: "Top the scoreboard at the end. Bragging rights guaranteed.", num: 3, rotate: "-0.5deg" },
        ].map((step) => (
          <div
            key={step.num}
            className="bg-white border-[3px] border-ink rounded-scribbl-lg p-5 w-[220px] text-center shadow-scribbl-md relative mx-auto"
            style={{ transform: `rotate(${step.rotate})` }}
          >
            {/* Number badge */}
            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-coral text-white font-extrabold text-base flex items-center justify-center border-[3px] border-ink">
              {step.num}
            </div>
            {/* Pin */}
            <div className="absolute -top-3.5 right-3 text-lg rotate-[15deg]">📌</div>
            <div className="text-[40px] mb-2">{step.icon}</div>
            <div className="text-lg font-extrabold mb-1">{step.title}</div>
            <div className="text-[13px] text-[var(--text-muted)] leading-relaxed">{step.desc}</div>
          </div>
        ))}
      </div>

      {/* NOTE: "Live players badge" from spec is deferred — requires backend endpoint GET /api/stats/online */}

      {/* Footer */}
      <div className="text-xs text-[var(--text-placeholder)] flex items-center gap-3">
        <span>Made with 🖍️</span>
        {/* Preserve existing social links from current join page */}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds (component not yet imported).

- [ ] **Step 3: Commit**

```bash
git add scribbl_frontend/src/components/LandingPage.tsx
git commit -m "feat(ui): add LandingPage component with scrapbook styling"
```

### Task 6: Build the JoinCard Component

**Files:**
- Create: `src/components/JoinCard.tsx`

- [ ] **Step 1: Create JoinCard component**

Create `src/components/JoinCard.tsx`. This handles all 3 join variants (play/host/join) with shared name input and avatar preview:

```typescript
import React, { useState } from "react";
import { DoodleAvatar } from "@/components/DoodleAvatar";

interface JoinCardProps {
  variant: "play" | "host" | "join";
  initialName?: string;
  initialAvatarSeed?: number;
  inviteRoomId?: string;
  onSubmit: (data: {
    name: string;
    avatarSeed: number;
    roomCode?: string;
    settings?: { rounds: number; drawTime: number; maxPlayers: number; difficulty: string };
  }) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
}

const DIFFICULTIES = ["Easy", "Medium", "Hard", "Mix"];

export function JoinCard({
  variant,
  initialName = "",
  initialAvatarSeed = 0,
  inviteRoomId,
  onSubmit,
  onBack,
  isLoading = false,
  error,
}: JoinCardProps) {
  const [name, setName] = useState(initialName);
  const [avatarSeed, setAvatarSeed] = useState(initialAvatarSeed);
  const [roomCode, setRoomCode] = useState(inviteRoomId || "");
  const [rounds, setRounds] = useState(3);
  const [drawTime, setDrawTime] = useState(80);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [difficultyIdx, setDifficultyIdx] = useState(3); // "Mix"

  const titles = { play: "Jump In! ✏️", host: "Host a Game 🏠", join: "Join a Room 🔗" };
  const subtitles = {
    play: "Pick a name and join a public game instantly",
    host: "Create a private room and invite friends",
    join: "Enter the room code shared by your friend",
  };
  const ctaLabels = { play: "Play Now ✏️", host: "Create Room 🏠", join: "Join Room 🔗" };
  const ctaColors = {
    play: "bg-[var(--color-green)]",
    host: "bg-[var(--color-blue)]",
    join: "bg-[var(--color-yellow)]",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      avatarSeed,
      roomCode: variant === "join" ? roomCode : undefined,
      settings: variant === "host" ? { rounds, drawTime, maxPlayers, difficulty: DIFFICULTIES[difficultyIdx] } : undefined,
    });
  };

  return (
    <div className="w-full max-w-[420px] mx-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 bg-white border-[2.5px] border-ink rounded-scribbl-sm px-3.5 py-1.5 text-[13px] font-bold shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 mb-5"
      >
        ← Back
      </button>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 relative"
      >
        {/* Pin */}
        <div className="absolute -top-3 right-5 text-[22px] rotate-12">📌</div>

        <h2 className="font-display text-[28px] text-coral mb-1" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>
          {titles[variant]}
        </h2>
        <p className="text-[13px] text-[var(--text-placeholder)] mb-6">{subtitles[variant]}</p>

        {/* Name input */}
        <div className="mb-5">
          <label className="block text-[13px] font-extrabold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide">
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={20}
            className={`w-full bg-cream border-[2.5px] border-ink rounded-[12px] px-3.5 py-2.5 text-[15px] font-semibold shadow-[2px_2px_0_#ddd] outline-none transition-all duration-150 focus:border-[var(--color-blue)] focus:shadow-[2px_2px_0_var(--color-blue)] focus:bg-white placeholder:text-[var(--text-disabled)] ${error ? "border-[#e74c3c] animate-shake" : ""}`}
          />
          {error && <p className="text-[#e74c3c] text-xs font-bold mt-1">{error}</p>}
        </div>

        {/* Avatar preview */}
        <div className="mb-6">
          <label className="block text-[13px] font-extrabold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wide">
            Your Avatar
          </label>
          <div className="flex items-center gap-4 bg-cream border-[2.5px] border-ink rounded-scribbl-md p-3 shadow-[2px_2px_0_#ddd]">
            <DoodleAvatar
              name={name || "Player"}
              seed={avatarSeed}
              size={64}
              className="rounded-scribbl-md border-[3px] border-ink flex-shrink-0"
            />
            <div className="flex-1">
              <div className="font-extrabold text-sm">Doodle Avatar</div>
              <div className="text-[11px] text-[var(--text-placeholder)]">Auto-generated from your name</div>
            </div>
            <button
              type="button"
              onClick={() => setAvatarSeed((s) => s + 1)}
              className="bg-white border-2 border-ink rounded-scribbl-xs px-2 py-1 text-sm shadow-scribbl-xs hover:translate-x-px hover:translate-y-px hover:shadow-none transition-all duration-150"
            >
              🔄
            </button>
          </div>
        </div>

        {/* Host: Room settings */}
        {variant === "host" && (
          <>
            <div className="flex items-center gap-3 my-5 text-[var(--text-disabled)] text-xs font-bold">
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
              ROOM SETTINGS
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
            </div>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {[
                { label: "Rounds", value: rounds, set: setRounds, min: 1, max: 10, display: `${rounds}` },
                { label: "Draw Time", value: drawTime, set: setDrawTime, min: 15, max: 240, step: 5, display: `${drawTime}s` },
                { label: "Max Players", value: maxPlayers, set: setMaxPlayers, min: 2, max: 20, display: `${maxPlayers}` },
                { label: "Difficulty", value: difficultyIdx, set: setDifficultyIdx, min: 0, max: 3, display: DIFFICULTIES[difficultyIdx] },
              ].map((s) => (
                <div key={s.label} className="bg-cream border-2 border-ink rounded-scribbl-sm p-2.5 shadow-scribbl-xs">
                  <div className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase mb-1.5">{s.label}</div>
                  <div className="flex items-center gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => s.set(Math.max(s.min, s.value - (s.step || 1)) as never)}
                      className="w-7 h-7 rounded-scribbl-xs border-2 border-ink bg-white text-base font-extrabold flex items-center justify-center shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors"
                    >
                      −
                    </button>
                    <span className="text-lg font-extrabold min-w-[30px] text-center">{s.display}</span>
                    <button
                      type="button"
                      onClick={() => s.set(Math.min(s.max, s.value + (s.step || 1)) as never)}
                      className="w-7 h-7 rounded-scribbl-xs border-2 border-ink bg-white text-base font-extrabold flex items-center justify-center shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Join: Room code */}
        {variant === "join" && (
          <>
            <div className="flex items-center gap-3 my-5 text-[var(--text-disabled)] text-xs font-bold">
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
              ROOM CODE
              <div className="flex-1 h-0.5 bg-[#eee] rounded" />
            </div>
            {inviteRoomId && (
              <div className="bg-[#E8F5E9] border-[2.5px] border-ink rounded-[12px] px-4 py-3 flex items-center gap-2.5 mb-4 shadow-scribbl-sm">
                <span className="text-xl">🎉</span>
                <span className="text-[13px] font-semibold">
                  You&apos;ve been invited to a room
                </span>
              </div>
            )}
            <div className="mb-4">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={10}
                className="w-full bg-cream border-[2.5px] border-ink rounded-[12px] px-3.5 py-2.5 text-xl font-extrabold text-center uppercase tracking-[4px] shadow-[2px_2px_0_#ddd] outline-none transition-all duration-150 focus:border-[var(--color-blue)] focus:shadow-[2px_2px_0_var(--color-blue)] focus:bg-white placeholder:text-[var(--text-disabled)]"
              />
            </div>
          </>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className={`w-full font-extrabold text-lg py-3.5 rounded-scribbl-md border-[3px] border-ink ${ctaColors[variant]} text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2`}
        >
          {isLoading ? "Loading..." : ctaLabels[variant]}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add scribbl_frontend/src/components/JoinCard.tsx
git commit -m "feat(ui): add JoinCard component with play/host/join variants"
```

### Task 7: Rewrite the Join Page

**Files:**
- Modify: `src/app/join/page.tsx` (complete rewrite)

- [ ] **Step 1: Rewrite join/page.tsx**

Replace the entire contents of `src/app/join/page.tsx` to use LandingPage and JoinCard. The page manages a `view` state that switches between "landing", "play", "host", and "join":

The page should:
1. Start with `view = "landing"` showing `<LandingPage />`
2. CTA clicks set `view` to the corresponding variant
3. Show `<JoinCard variant={view} />` for play/host/join
4. Preserve existing logic from the current `handleJoin(mode, roomType?)` function
5. Wrap in `<Suspense>` since `useSearchParams()` requires it in Next.js App Router
6. Remove the AVATARS emoji array, glass-effect classes, and blob animations
7. Use the floating doodle emoji background on all views

Key logic to preserve from the current `join/page.tsx`:
- `useSearchParams()` to read `roomId` from invite URL (line ~48) — must be wrapped in `<Suspense>` with a loading fallback
- `useEffect` cleanup on mount (lines ~34-45): calls `setPlayerKicked(false)` and `clearPlayerInfo()` to reset stale state. **Critical — omitting this causes bugs when returning from a game.**
- `handleJoin(mode, roomType?)` function (lines ~50-165): single function that handles all three flows:
  - `mode === "public"`: fetches `${backendUrl}/api/rooms/join-random`, sets roomId from response
  - `mode === "private"`: fetches `${backendUrl}/api/rooms/generate-id`, sets roomId from response, **sets `sessionStorage.setItem("roomType", "private")`** — must preserve this
  - `mode === "join"`: uses the provided roomId directly
  - All modes: call `setPlayerName()`, `setAvatar()`, `setRoomId()`, then `router.push("/game")`
- There is NO `uuid()` call or userId generation in join/page.tsx — userId is handled elsewhere
- There is NO hydration guard in join/page.tsx — that logic lives in game/page.tsx

The `JoinCard.onSubmit` callback should map to the existing `handleJoin` logic:
- variant "play" → `handleJoin("public")`
- variant "host" → `handleJoin("private")`
- variant "join" → `handleJoin("join")` with `data.roomCode` as roomId

Check socket readiness before allowing submit: disable the JoinCard with `isLoading={!socket || isJoining}`

- [ ] **Step 2: Delete InstructionsModal**

Remove `src/components/InstructionsModal.tsx` — its content is now in the landing page's How It Works section.

- [ ] **Step 3: Verify the app builds and join flow works**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds. Navigate to `/join` — should show the landing page.

- [ ] **Step 4: Commit**

```bash
git add scribbl_frontend/src/app/join/page.tsx
git rm scribbl_frontend/src/components/InstructionsModal.tsx
git commit -m "feat(ui): rewrite join page with landing page and scrapbook join flow"
```

---

## Chunk 3: Lobby and Chat Components

### Task 8: Build the Lobby Component

**Files:**
- Create: `src/components/Lobby.tsx`

- [ ] **Step 1: Create Lobby component**

Create `src/components/Lobby.tsx`. This is extracted from the game page's `roomStatus === "waiting"` branch. It receives room state as props and fires callbacks for admin actions:

```typescript
import React from "react";
import { PlayerCard } from "@/components/PlayerCard";

interface LobbyProps {
  roomId: string;
  players: { [userId: string]: string };
  playerAvatars: { [userId: string]: number };
  adminId: string;
  userId: string;
  maxPlayers: number;
  roomSettings: {
    maxRounds: string;
    turnTime: string;
    maxPlayers: string;
    difficulty: string;
  };
  isAdmin: boolean;
  onStartGame: () => void;
}

export function Lobby({
  roomId,
  players,
  playerAvatars,
  adminId,
  userId,
  maxPlayers,
  roomSettings,
  isAdmin,
  onStartGame,
}: LobbyProps) {
  const playerEntries = Object.entries(players);
  const emptySlots = Math.max(0, maxPlayers - playerEntries.length);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
  };

  const shareRoom = () => {
    const url = `${window.location.origin}/join?roomId=${roomId}`;
    if (navigator.share) {
      navigator.share({ title: "Join my Scribbl game!", url });
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-[560px] bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 relative">
        {/* Pin */}
        <div className="absolute -top-3 right-5 text-[22px] rotate-12">📌</div>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="font-display text-[28px] text-coral" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>
            Waiting Room <span className="inline-block animate-bounce">✏️</span>
          </h2>
          <p className="text-[13px] text-[var(--text-placeholder)] mt-0.5">Hang tight! The game will start soon</p>
        </div>

        {/* Room code */}
        <div className="bg-[var(--color-yellow)] border-[2.5px] border-ink rounded-scribbl-md px-5 py-3.5 flex items-center justify-between mb-6 shadow-scribbl-md">
          <div>
            <div className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wide">Room Code</div>
            <div className="text-2xl font-extrabold tracking-[6px]">{roomId}</div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={copyRoomCode}
              className="bg-white border-2 border-ink rounded-scribbl-xs px-2.5 py-1.5 text-xs font-bold shadow-scribbl-xs hover:translate-x-px hover:translate-y-px hover:shadow-none transition-all duration-150 flex items-center gap-1"
            >
              📋 Copy
            </button>
            <button
              onClick={shareRoom}
              className="bg-white border-2 border-ink rounded-scribbl-xs px-2.5 py-1.5 text-xs font-bold shadow-scribbl-xs hover:translate-x-px hover:translate-y-px hover:shadow-none transition-all duration-150 flex items-center gap-1"
            >
              🔗 Share
            </button>
          </div>
        </div>

        {/* Settings summary */}
        <div className="flex gap-2 flex-wrap mb-6">
          {[
            { icon: "🔄", label: "Rounds", value: roomSettings.maxRounds },
            { icon: "⏱️", label: "Time", value: `${roomSettings.turnTime}s` },
            { icon: "👥", label: "Max", value: roomSettings.maxPlayers },
            { icon: "📊", label: "Difficulty", value: roomSettings.difficulty },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white border-2 border-ink rounded-scribbl-sm px-3 py-1 text-xs font-bold shadow-scribbl-xs flex items-center gap-1"
            >
              <span className="text-sm">{s.icon}</span>
              {s.label}: <span className="text-coral">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Players grid */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-extrabold text-[var(--text-secondary)] uppercase tracking-wide">Players</span>
            <span className="bg-[#E8F5E9] border-2 border-ink rounded-scribbl-xs px-2.5 py-0.5 text-xs font-extrabold shadow-scribbl-xs">
              {playerEntries.length} / {maxPlayers}
            </span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
            {playerEntries.map(([uid, name]) => (
              <PlayerCard
                key={uid}
                name={name}
                avatarSeed={playerAvatars[uid] ?? 0}
                isAdmin={uid === adminId}
                isYou={uid === userId}
              />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <PlayerCard key={`empty-${i}`} name="" avatarSeed={0} isEmpty />
            ))}
          </div>
        </div>

        {/* Start / Waiting */}
        {isAdmin ? (
          <button
            onClick={onStartGame}
            disabled={playerEntries.length < 2}
            className="w-full font-extrabold text-xl py-4 rounded-scribbl-md border-[3px] border-ink bg-[var(--color-green)] text-[var(--text-primary)] shadow-scribbl-md hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-scribbl-sm active:translate-x-1 active:translate-y-1 active:shadow-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start Game! 🎮
          </button>
        ) : (
          <div className="text-center py-3.5 bg-cream border-[2.5px] border-dashed border-[var(--text-disabled)] rounded-scribbl-md text-sm font-bold text-[var(--text-placeholder)]">
            Waiting for the host to start...
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add scribbl_frontend/src/components/Lobby.tsx
git commit -m "feat(ui): add Lobby waiting room component"
```

### Task 9: Build the ChatBar Component

**Files:**
- Create: `src/components/ChatBar.tsx`

- [ ] **Step 1: Create ChatBar component**

Create `src/components/ChatBar.tsx`. This replaces the existing Chat component with horizontal pills + expandable panel:

```typescript
import React, { useState, useRef, useEffect } from "react";

interface Message {
  userId: string;
  text: string;
  system?: boolean;
  senderName?: string;
}

interface ChatBarProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  currentUserId: string;
}

export function ChatBar({ messages, onSendMessage, disabled, disabledReason, currentUserId }: ChatBarProps) {
  const [input, setInput] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(messages.length);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelMessagesRef = useRef<HTMLDivElement>(null);

  const unreadCount = messages.length - lastSeenCount;

  // Scroll panel to bottom when new messages arrive
  useEffect(() => {
    if (isPanelOpen && panelMessagesRef.current) {
      panelMessagesRef.current.scrollTop = panelMessagesRef.current.scrollHeight;
      setLastSeenCount(messages.length);
    }
  }, [messages.length, isPanelOpen]);

  // Close panel on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPanelOpen) {
        setIsPanelOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isPanelOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const togglePanel = () => {
    const next = !isPanelOpen;
    setIsPanelOpen(next);
    if (next) setLastSeenCount(messages.length);
  };

  // Show last 5 messages as pills
  const recentMessages = messages.slice(-5);

  const getMessageStyle = (msg: Message) => {
    if (msg.system && msg.text.includes("guessed")) return "bg-[#D5F5E3] border-[#27ae60] text-[#27ae60]";
    if (msg.system) return "bg-[var(--color-yellow)] border-[#f39c12] text-[#f39c12]";
    return "bg-white border-ink";
  };

  const getMessageText = (msg: Message) => {
    if (msg.system) return msg.text;
    return `${msg.senderName || "Player"}: ${msg.text}`;
  };

  return (
    <div className="flex-shrink-0 relative">
      {/* Recent messages as pills */}
      <div className="flex gap-1.5 items-center mb-1.5 overflow-x-auto scrollbar-hide py-0.5">
        {recentMessages.map((msg, i) => (
          <div
            key={messages.length - 5 + i}
            className={`${getMessageStyle(msg)} border-2 rounded-scribbl-sm px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap flex-shrink-0 shadow-scribbl-xs max-w-[200px] overflow-hidden text-ellipsis`}
          >
            {msg.system ? (
              msg.text
            ) : (
              <>
                <span className="text-[var(--text-muted)] mr-1">{msg.senderName || "Player"}:</span>
                {msg.text}
              </>
            )}
          </div>
        ))}
        <button
          onClick={togglePanel}
          className="bg-white border-2 border-ink rounded-scribbl-xs px-2 py-0.5 text-[11px] font-bold flex-shrink-0 shadow-scribbl-xs hover:bg-[#f0f0f0] transition-colors text-[var(--text-muted)] relative"
        >
          ↑ Chat
          {unreadCount > 0 && !isPanelOpen && (
            <span className="absolute -top-2 -right-2 bg-coral text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? disabledReason || "Disabled" : "Type your guess..."}
          disabled={disabled}
          className="flex-1 bg-white border-[2.5px] border-ink rounded-scribbl-md px-4 py-2 text-sm font-semibold shadow-scribbl-sm outline-none transition-all duration-150 focus:border-[var(--color-blue)] focus:shadow-[2px_2px_0_var(--color-blue)] placeholder:text-[var(--text-disabled)] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="bg-[var(--color-green)] border-[2.5px] border-ink rounded-[12px] px-3.5 py-2 text-base shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ➤
        </button>
      </form>

      {/* Expanded chat panel */}
      {isPanelOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setIsPanelOpen(false)}
          />
          <div
            ref={panelRef}
            className="absolute bottom-full right-0 mb-2 w-full lg:w-[320px] max-h-[50vh] lg:max-h-[400px] bg-white border-[3px] border-ink rounded-[16px] shadow-scribbl-md flex flex-col overflow-hidden z-50"
          >
            <div className="px-3.5 py-2.5 font-extrabold text-sm border-b-[2.5px] border-ink flex justify-between items-center bg-[var(--color-yellow)]">
              <span>💬 Chat</span>
              <button onClick={() => setIsPanelOpen(false)} className="text-base text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                ✕
              </button>
            </div>
            <div ref={panelMessagesRef} className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5">
              {messages.map((msg, i) => (
                <div key={i} className={`text-[13px] leading-relaxed ${msg.system && msg.text.includes("guessed") ? "text-[#27ae60] font-bold" : ""}`}>
                  {msg.system ? (
                    msg.text
                  ) : (
                    <>
                      <span className="font-extrabold mr-1" style={{ color: msg.userId === currentUserId ? "var(--color-blue)" : "var(--color-purple)" }}>
                        {msg.senderName || "Player"}:
                      </span>
                      {msg.text}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add scribbl_frontend/src/components/ChatBar.tsx
git commit -m "feat(ui): add ChatBar with horizontal pills and expandable panel"
```

### Task 10: Build the Toolbar Component

**Files:**
- Create: `src/components/Toolbar.tsx`

- [ ] **Step 1: Create Toolbar component**

Create `src/components/Toolbar.tsx`. This extracts drawing tools from Canvas.tsx:

```typescript
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
```

- [ ] **Step 2: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add scribbl_frontend/src/components/Toolbar.tsx
git commit -m "feat(ui): add Toolbar component for drawing tools"
```

---

## Chunk 4: Modal Components

### Task 11: Build TurnToast and Restyle WordSelectModal

**Files:**
- Create: `src/components/TurnToast.tsx`
- Create: `src/components/WordSelectModal.tsx`

- [ ] **Step 1: Create TurnToast component**

Create `src/components/TurnToast.tsx`:

```typescript
import React from "react";

interface TurnToastProps {
  reason: "all_guessed" | "timeout" | "drawer_left";
  word: string;
  countdown: number;
}

const REASON_CONFIG = {
  all_guessed: { icon: "🎉", title: "Everyone guessed it!" },
  timeout: { icon: "⏰", title: "Time's up!" },
  drawer_left: { icon: "🚪", title: "Drawer left the game" },
};

export function TurnToast({ reason, word, countdown }: TurnToastProps) {
  const config = REASON_CONFIG[reason] || REASON_CONFIG.timeout;

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-fadeIn">
      <div className="bg-white border-[3px] border-ink rounded-[16px] shadow-scribbl-md px-6 py-5 flex items-center gap-4 min-w-[300px]">
        <div className="text-4xl flex-shrink-0">{config.icon}</div>
        <div className="flex-1">
          <div className="text-base font-extrabold mb-0.5">{config.title}</div>
          <div className="text-sm text-[var(--text-muted)]">
            The word was <strong className="text-coral">{word}</strong>
          </div>
          <div className="h-1 bg-[#eee] rounded mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--color-green)] to-[var(--color-blue)] rounded animate-shrink"
              style={{ animationDuration: `${countdown}s` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WordSelectModal component**

Create `src/components/WordSelectModal.tsx`:

```typescript
import React from "react";

interface WordSelectModalProps {
  words: string[];
  countdown: number;
  hasSkipped: boolean;
  onSelectWord: (word: string) => void;
  onSkip: () => void;
  difficulty?: string;
}

export function WordSelectModal({
  words,
  countdown,
  hasSkipped,
  onSelectWord,
  onSkip,
  difficulty = "Mix",
}: WordSelectModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 text-center relative max-w-[420px] w-full animate-fadeIn">
        {/* Pin */}
        <div className="absolute -top-3 left-5 text-[22px] -rotate-12">📌</div>

        <h2 className="font-display text-2xl text-coral mb-1" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>
          Pick a Word! 🎯
        </h2>
        <p className="text-[13px] text-[var(--text-placeholder)] mb-6">
          Choose wisely — you&apos;ll be drawing this!
        </p>

        {/* Timer */}
        <div className={`w-16 h-16 rounded-full border-[3px] border-ink flex items-center justify-center text-[28px] font-extrabold mx-auto mb-5 shadow-scribbl-md relative ${countdown <= 3 ? "bg-[#FFDDDD] text-[#e74c3c]" : "bg-[#FFDDDD] text-[#e74c3c]"}`}>
          {countdown}
          <div className="absolute inset-1 rounded-full border-[3px] border-transparent border-t-[#e74c3c] animate-spin" />
        </div>

        {/* Word buttons */}
        <div className="flex flex-col gap-2.5 mb-5">
          {words.map((word) => (
            <button
              key={word}
              onClick={() => onSelectWord(word)}
              className="bg-cream border-[2.5px] border-ink rounded-scribbl-md px-5 py-3.5 text-lg font-extrabold shadow-scribbl-md flex items-center justify-between hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-sm hover:bg-[var(--color-yellow)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all duration-150"
            >
              <span>{word}</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-[6px] border-[1.5px] border-ink bg-[#E8F5E9] text-[#27ae60]">
                {difficulty}
              </span>
            </button>
          ))}
        </div>

        {/* Skip button */}
        {!hasSkipped && (
          <button
            onClick={onSkip}
            className="border-2 border-[var(--text-disabled)] rounded-scribbl-sm px-5 py-2 text-[13px] font-bold text-[var(--text-placeholder)] hover:border-[#e67e22] hover:text-[#e67e22] hover:bg-[#FFF3E0] transition-all duration-150"
          >
            Skip (1 remaining)
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add scribbl_frontend/src/components/TurnToast.tsx scribbl_frontend/src/components/WordSelectModal.tsx
git commit -m "feat(ui): add TurnToast and WordSelectModal with scrapbook styling"
```

### Task 12: Restyle GameOverModal, KickPlayerModal, KickedModal

**Files:**
- Modify: `src/components/GameOverModal.tsx`
- Modify: `src/components/KickPlayerModal.tsx`
- Modify: `src/components/KickedModal.tsx`

- [ ] **Step 1: Restyle GameOverModal**

Rewrite `src/components/GameOverModal.tsx`. The existing component receives these actual props (from the current code): `scores` (Record<string, number>), `players` (Record<string, string>), `currentUserId` (string), `onClose` (() => void), `onPlayAgain` (() => void). It reads `playerAvatars` from the Zustand store internally. Preserve all of these.

Key styling changes:
- Outer overlay: `fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4`
- Card: `bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 max-w-md w-full animate-fadeIn relative overflow-hidden`
- Rainbow confetti strip: `<div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: "repeating-linear-gradient(90deg, #FF6B6B 0 20px, #FFEAA7 20px 40px, #55EFC4 40px 60px, #74B9FF 60px 80px, #A29BFE 80px 100px, #FD79A8 100px 120px)" }} />`
- Trophy: `<div className="text-[56px] animate-bounce text-center mb-2">🏆</div>`
- Title: `<h2 className="font-display text-[32px] text-coral text-center" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>Game Over!</h2>`
- Each leaderboard entry: `border-[2.5px] border-ink rounded-scribbl-md px-3.5 py-2.5 flex items-center gap-3 shadow-scribbl-sm`
  - 1st place: `bg-[#FFEAA7]`, 2nd: `bg-[#DFE6E9]`, 3rd: `bg-[#FFDAB9]`, 4th+: `bg-cream`
  - Rank: `🥇`/`🥈`/`🥉` or numeric
  - Replace `{avatar}` emoji rendering with `<DoodleAvatar name={name} seed={playerAvatars[uid] ?? 0} size={40} />`
  - Score: `text-coral font-extrabold`
- Buttons: `"📸 Share"` (bg-scribbl-blue) + `"Play Again 🎮"` (bg-scribbl-green) with chunky border style

- [ ] **Step 2: Restyle KickPlayerModal**

Rewrite `src/components/KickPlayerModal.tsx`. Existing props: `players` (Record<string, string>), `playerAvatars` (Record<string, number>), `kickVoteInfoMap`, `userId`, `adminId`, `onVoteKick` ((targetId: string) => void), `onClose` (() => void).

Key styling:
- Overlay: `fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4`
- Card: `bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 max-w-[400px] w-full animate-fadeIn relative`
- Title: `<h2 className="font-display text-2xl text-coral mb-4" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>Vote to Kick 🗳️</h2>`
- Player rows: `bg-cream border-[2.5px] border-ink rounded-scribbl-md px-3 py-2 flex items-center gap-3 shadow-scribbl-xs`
- Admin badge: `bg-[var(--color-yellow)] border-[1.5px] border-ink rounded-[6px] px-1.5 text-[9px] font-extrabold uppercase`
- Kick button: `bg-coral text-[var(--text-primary)] border-[2px] border-ink rounded-scribbl-xs px-3 py-1 text-xs font-bold shadow-scribbl-xs`, disabled state: `bg-[#ddd] opacity-50`
- Close button: top-right `✕`
- Replace emoji avatar display with `<DoodleAvatar name={name} seed={playerAvatars[uid] ?? 0} size={32} />`

- [ ] **Step 3: Restyle KickedModal**

Rewrite `src/components/KickedModal.tsx`. Existing logic: 3s countdown via `useEffect` with `setInterval`, then `router.push("/join")` and `clearPlayerInfo()`. Preserve all of this.

Key styling:
- Full-screen: `fixed inset-0 bg-cream z-50 flex items-center justify-center p-6`
- Card: `bg-white border-[3px] border-ink rounded-scribbl-lg shadow-scribbl-lg p-8 max-w-sm w-full text-center animate-fadeIn`
- Title: `<h2 className="font-display text-2xl text-coral mb-2" style={{ textShadow: "2px 2px 0 #FFB8B8" }}>You've Been Kicked! 👋</h2>`
- Reason: `<p className="text-[var(--text-muted)] text-sm mb-4">{reason}</p>`
- Countdown: `<p className="text-[var(--text-placeholder)] text-sm mb-3">Returning to home in {countdown}...</p>`
- Progress bar: `<div className="h-1 bg-[#eee] rounded overflow-hidden"><div className="h-full bg-coral rounded animate-shrink" style={{ animationDuration: "3s" }} /></div>`

- [ ] **Step 4: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds. Type errors may appear if avatar types changed — fix them (change emoji string refs to seed number refs).

- [ ] **Step 5: Commit**

```bash
git add scribbl_frontend/src/components/GameOverModal.tsx scribbl_frontend/src/components/KickPlayerModal.tsx scribbl_frontend/src/components/KickedModal.tsx
git commit -m "feat(ui): restyle GameOverModal, KickPlayerModal, KickedModal to scrapbook"
```

---

## Chunk 5: Game Page Integration

### Task 13: Restyle Canvas Container

**Files:**
- Modify: `src/components/Canvas.tsx`

- [ ] **Step 1: Restyle Canvas container**

In `Canvas.tsx`, restyle the container and externalize toolbar state. Key changes:

1. Remove the color palette, tool buttons, and brush slider JSX (~200-300 lines of JSX). The parent renders Toolbar separately.
2. Remove the game info display from Canvas top section (word display, timer, round info — ~50 lines). These move to InfoBadge in the game page top bar.
3. Replace glass-effect classes on canvas container with: `bg-white border-[3px] border-ink rounded-[16px] shadow-scribbl-md relative overflow-hidden`
4. Add pin decoration: `<div className="absolute -top-[10px] right-4 text-xl rotate-[15deg] z-[2] pointer-events-none">📌</div>`
5. Keep all drawing logic, coordinate normalization, event listeners, and react-sketch-canvas integration exactly as-is.

**Communication pattern: declarative props + imperative ref.**

Remove internal state that moves to parent:
- Remove `const [color, setColor] = useState(...)` → use `props.activeColor`
- Remove `const [isEraser, setIsEraser] = useState(...)` → use `props.activeTool === "erase"`
- Remove `const [strokeWidth, setStrokeWidth] = useState(...)` → use `props.brushSize`
- Remove `const [eraserWidth, setEraserWidth] = useState(...)` → use `props.brushSize` when erasing
- Update all `useEffect`s that depend on these removed states to use the new props

New props interface:
```typescript
interface CanvasProps {
  // ... existing props (channel, isDrawer, etc.) ...
  activeColor: string;
  activeTool: "draw" | "erase";
  brushSize: number;
}
```

Expose undo/clear via `React.forwardRef` + `useImperativeHandle`:
```typescript
export interface CanvasHandle {
  undo: () => void;
  clear: () => void;
}
// Parent: const canvasRef = useRef<CanvasHandle>(null);
// Then: <Canvas ref={canvasRef} ... />
// Wire to Toolbar: onUndo={() => canvasRef.current?.undo()}
```

- [ ] **Step 2: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build may have errors due to game page still referencing old Canvas API. This is expected — Task 14 will fix it.

- [ ] **Step 3: Commit**

```bash
git add scribbl_frontend/src/components/Canvas.tsx
git commit -m "refactor(ui): restyle Canvas container and extract toolbar interface"
```

### Task 14: Rewrite the Game Page

**Files:**
- Modify: `src/app/game/page.tsx`

This is the largest task. The game page needs to:
1. Conditionally render Lobby (when `roomStatus === "waiting"`) or the game layout (when active)
2. Switch from 3-column layout to canvas maximalist (stacked: top bar → players bar → canvas → toolbar → chat)
3. Import and wire up all new components (Lobby, PlayerBadge, Toolbar, ChatBar, InfoBadge, WordSelectModal, TurnToast, GameOverModal, KickedModal, KickPlayerModal)
4. Remove all glass-effect Tailwind classes
5. Preserve ALL game logic, state, useEffects, event handlers, and timer management

- [ ] **Step 1: Update imports**

Replace old component imports with new ones:
```typescript
import { Lobby } from "@/components/Lobby";
import { PlayerBadge } from "@/components/PlayerBadge";
import { ChatBar } from "@/components/ChatBar";
import { Toolbar } from "@/components/Toolbar";
import { InfoBadge } from "@/components/InfoBadge";
import { WordSelectModal } from "@/components/WordSelectModal";
import { TurnToast } from "@/components/TurnToast";
import { GameOverModal } from "@/components/GameOverModal";
import { KickedModal } from "@/components/KickedModal";
import { KickPlayerModal } from "@/components/KickPlayerModal";
```

Remove imports for `Chat`, old `InstructionsModal`.

- [ ] **Step 2: Add toolbar state to game page**

Add state for the drawing toolbar that the parent now manages, plus a set to track which players have guessed correctly this turn:
```typescript
const [activeColor, setActiveColor] = useState("#333333");
const [activeTool, setActiveTool] = useState<"draw" | "erase">("draw");
const [brushSize, setBrushSize] = useState(4);
const [guessedPlayers, setGuessedPlayers] = useState<Set<string>>(new Set());
const canvasRef = useRef<CanvasHandle>(null);
```

The `guessedPlayers` set is populated from the existing `correct_guess` channel event handler (which currently sets `guessed = true` for the current user). Extend it: when any player guesses correctly, add their userId to the set. Clear the set when a new turn starts (in the `word_selected` or `turn_over` handler). The current user's `guessed` boolean state should be derived: `guessedPlayers.has(userId)`.

- [ ] **Step 3: Replace the waiting state render**

Replace the inline waiting/lobby UI (around lines 1000-1100 in the current file) with:
```typescript
if (roomStatus === "waiting") {
  return (
    <main className="min-h-[100svh] bg-cream flex flex-col">
      <Lobby
        roomId={roomId}
        players={players}
        playerAvatars={playerAvatars}
        adminId={adminId}
        userId={userId}
        maxPlayers={parseInt(roomSettings.maxPlayers) || 8}
        roomSettings={roomSettings}
        isAdmin={isCurrentUserAdmin}
        onStartGame={handleStartGame}
      />
    </main>
  );
}
```

- [ ] **Step 4: Replace the active game layout**

Replace the 3-column game layout JSX with the canvas maximalist layout:

```
<main className="h-[100svh] bg-cream flex flex-col p-2.5 lg:p-4 gap-2">
  {/* Zone 1: Top Bar */}
  <div className="flex items-center justify-between gap-3 flex-shrink-0">
    <div className="font-display text-[22px] text-coral hidden lg:block" style={{ textShadow: "2px 2px 0 #333" }}>Scribbl</div>
    <div className="flex items-center gap-2 flex-wrap justify-center">
      <InfoBadge variant="round">Round {gameInfo.currentRound} / {roomSettings.maxRounds}</InfoBadge>
      <InfoBadge variant="word">{wordDisplay}</InfoBadge>
      <InfoBadge variant={timeLeft <= 10 ? "timer-warning" : "timer"}>{timeLeft}</InfoBadge>
    </div>
    <button
      onClick={() => setShowViewOnlySettings(true)}
      className="bg-white border-[2.5px] border-ink rounded-scribbl-sm px-2.5 py-1 text-base shadow-scribbl-sm hover:translate-x-px hover:translate-y-px hover:shadow-scribbl-xs transition-all duration-150 focus-ring"
    >
      ⚙️
    </button>
  </div>

  {/* Zone 2: Players Bar */}
  <div className="flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide py-0.5">
    {Object.entries(players).map(([uid, name]) => (
      <PlayerBadge
        key={uid}
        name={name}
        avatarSeed={playerAvatars[uid] ?? 0}
        score={scores[uid] || 0}
        isDrawing={uid === gameInfo.currentDrawer}
        hasGuessed={guessedPlayers.has(uid)}
      />
    ))}
  </div>

  {/* Zone 3: Canvas */}
  <div className="flex-1 min-h-0">
    <Canvas ... activeColor={activeColor} activeTool={activeTool} brushSize={brushSize} />
  </div>

  {/* Zone 4: Toolbar + Chat (only show toolbar for drawer) */}
  {isCurrentUserDrawing && (
    <Toolbar
      activeColor={activeColor}
      activeTool={activeTool}
      brushSize={brushSize}
      onColorChange={setActiveColor}
      onToolChange={setActiveTool}
      onBrushSizeChange={setBrushSize}
      onUndo={handleUndo}
      onClear={handleClear}
    />
  )}
  <ChatBar
    messages={messages}
    onSendMessage={sendMessage}
    disabled={isCurrentUserDrawing}
    disabledReason="You're drawing!"
    currentUserId={userId}
  />
</main>
```

- [ ] **Step 5: Replace modal renders**

Replace word selection modal with `<WordSelectModal>` component.
Replace turn over modal with `<TurnToast>` component.
GameOverModal, KickedModal, KickPlayerModal are already restyled — just update their prop types if avatar fields changed.

- [ ] **Step 6: Replace connection state UI**

Replace the glass-effect connection/error state renders (lines 740-776) with scrapbook-styled versions:
- Connecting: cream bg, centered bouncing pencil + "Connecting..." text
- Error: centered white card with "Oops! 😵" title + error message + "Try Again" button

- [ ] **Step 7: Remove BackgroundMusic component**

Remove `<BackgroundMusic />` from game page if present. Remove the import. Delete `src/components/BackgroundMusic.tsx`.

- [ ] **Step 8: Remove old Chat component**

Delete `src/components/Chat.tsx` — replaced by ChatBar.

- [ ] **Step 9: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds. This is the critical integration point — resolve any type errors or missing references.

- [ ] **Step 10: Commit**

```bash
git add scribbl_frontend/src/app/game/page.tsx
git rm scribbl_frontend/src/components/Chat.tsx scribbl_frontend/src/components/BackgroundMusic.tsx
git commit -m "feat(ui): rewrite game page with canvas maximalist layout and scrapbook theme"
```

### Task 15: Update VoiceChat Component

**Files:**
- Modify: `src/components/VoiceChat.tsx`

- [ ] **Step 1: Restyle VoiceChat**

The VoiceChat component currently renders its own player list — that rendering moves to PlayerBadge in the players bar. Simplify VoiceChat to only render voice controls (Join Voice button, Mute/Unmute, Leave). Style these with scrapbook theme:
- "Join Voice" button: green bg, chunky border
- Mute toggle: blue/red toggle with chunky border
- "Leave" button: gray, small

Keep all WebRTC logic and refs unchanged.

- [ ] **Step 2: Verify the app builds**

Run: `cd scribbl_frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add scribbl_frontend/src/components/VoiceChat.tsx
git commit -m "feat(ui): restyle VoiceChat controls with scrapbook theme"
```

### Task 16: Update Remaining Files and Final Cleanup

**Files:**
- Modify: `src/app/not-found.tsx`
- Modify: `src/components/OrientationLock.tsx`
- Modify: `src/components/SocketInitializer.tsx` (no visual changes, just verify)
- Remove: unused files

- [ ] **Step 1: Restyle 404 page**

Update `not-found.tsx` to use scrapbook styling: cream bg, white card with chunky border, coral title, green "Go Home" button. Remove framer-motion animation (use CSS `animate-fadeIn` instead).

- [ ] **Step 2: Restyle OrientationLock**

Update the landscape warning overlay to use scrapbook styling: cream bg, centered white card with "Please rotate your device 📱" message.

- [ ] **Step 3: Remove socket.io-client dependency**

Run: `cd scribbl_frontend && npm uninstall socket.io-client`

Verify no imports reference `socket.io-client`.

- [ ] **Step 4: Full build verification**

Run: `cd scribbl_frontend && npm run build`
Expected: Clean build with no errors.

- [ ] **Step 5: Lint check**

Run: `cd scribbl_frontend && npm run lint`
Expected: No new lint errors.

- [ ] **Step 6: Add .superpowers/ to .gitignore**

Check if `.superpowers/` is in `.gitignore`. If not, add it.

- [ ] **Step 7: Final commit**

```bash
git add scribbl_frontend/src/app/not-found.tsx scribbl_frontend/src/components/OrientationLock.tsx scribbl_frontend/package.json scribbl_frontend/package-lock.json scribbl_frontend/.gitignore
git commit -m "feat(ui): complete scrapbook UI redesign — final cleanup and polish"
```

---

## Execution Summary

| Chunk | Tasks | What It Delivers |
|-------|-------|-----------------|
| 1: Foundation | Tasks 1-4 | Fonts, design tokens, avatar system, reusable UI primitives |
| 2: Landing + Join | Tasks 5-7 | New landing page, join cards, rewired join page |
| 3: Lobby + Chat | Tasks 8-10 | Lobby waiting room, chat bar, drawing toolbar |
| 4: Modals | Tasks 11-12 | All modal/overlay restyling |
| 5: Integration | Tasks 13-16 | Canvas restyle, game page rewrite, cleanup |

Each chunk produces a buildable (though possibly visually broken until Chunk 5 integrates everything) codebase. Chunk 5 is the critical integration point where everything comes together.
