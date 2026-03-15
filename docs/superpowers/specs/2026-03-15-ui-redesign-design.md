# Scribbl UI Redesign — Design Spec

## Overview

A complete visual redesign of Scribbl from dark glassmorphism to a **Colorful Sticker / Scrapbook** aesthetic with a **Canvas Maximalist** game layout. The redesign covers all screens: landing page, join flow, lobby, game, modals, and game over.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Visual direction | Casual Doodle | Reduces drawing anxiety, matches genre conventions, feels approachable |
| Aesthetic variant | Colorful Sticker / Scrapbook | Most playful and expressive. Warm cream backgrounds, sticker badges, slight rotations, doodle accents |
| Game layout | Canvas Maximalist | Full-width canvas, floating player badges, bottom chat bar. Maximum drawing space |
| Chat approach | Social with expandable history | Bottom input always visible, recent messages as horizontal scrollable pills, expandable chat panel via "↑ Chat" button |
| Player identity | Generated doodle avatars | Auto-generated from player name. Colorful gradient backgrounds with simple SVG face shapes. Refresh button to regenerate |
| Sound design | Minimal | Subtle effects for correct guess, timer warning, turn change. No background music by default |
| Lobby experience | Landing page → join flow → waiting room | Hero page hooks new visitors, then contextual join cards, then lobby with player grid |
| Target audience | Both friends & public matchmaking | Private rooms with share codes AND public quick-join |

## Visual Language

### Color Palette

**Background:** `#FFF8E7` (warm cream) with subtle paper texture:
```css
background: #FFF8E7;
/* Subtle dot grid texture */
background-image: radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px);
background-size: 24px 24px;
```

**Primary Colors:**
- Red/Coral: `#FF6B6B` — logo, primary accent, scores
- Yellow: `#FFEAA7` / `#FDCB6E` — highlights, word hint, room code
- Green: `#55EFC4` — success, CTA buttons, correct guesses
- Blue: `#74B9FF` — secondary actions, links
- Purple: `#A29BFE` — tertiary accent
- Pink: `#FD79A8` — decorative accent

**Neutral Colors:**
- Black: `#333` — borders, text, shadows (never pure `#000`)
- White: `#FFFFFF` — card backgrounds, canvas

**Text Gray Scale (semantic roles):**
- `--text-primary: #333` — headings, body text, button labels
- `--text-secondary: #555` — section labels, field labels
- `--text-muted: #888` — scores, secondary info, setting labels
- `--text-placeholder: #999` — subtitles, helper text
- `--text-disabled: #ccc` — placeholder input text, empty state text

**All button text uses `#333`** (dark text on colored backgrounds) to ensure WCAG AA contrast compliance. Never use white text on the light primary colors (#55EFC4, #FFEAA7, #74B9FF).

**Semantic Colors:**
- Easy: `#D5F5E3` bg / `#27ae60` text
- Medium: `#FFEAA7` bg / `#e67e22` text
- Hard: `#FFDDDD` bg / `#e74c3c` text
- Timer warning: `#e74c3c`

### Typography

- **Headings/Logo:** `Lilita One` (cursive) — bold, playful, used for titles and the logo
- **Body/UI:** `Nunito` (sans-serif, weights 400/600/700/800) — rounded, friendly, highly legible
- No monospace or handwriting fonts in the main UI

### Border & Shadow System

All interactive and container elements use a consistent chunky border + offset shadow style:

- **Primary containers** (cards, modals): `border: 3px solid #333`, `border-radius: 20px`, `box-shadow: 6px 6px 0 #333`
- **Secondary elements** (badges, pills, inputs): `border: 2.5px solid #333`, `border-radius: 10-14px`, `box-shadow: 2px 2px 0 #333`
- **Small elements** (setting items, code buttons): `border: 2px solid #333`, `border-radius: 8px`, `box-shadow: 1px 1px 0 #333`
- **Empty/placeholder slots**: `border: 2.5px dashed #ccc`, no shadow

### Interaction States

- **Hover:** translate shadow inward — `transform: translate(1-2px, 1-2px)`, reduce shadow by same amount
- **Active/Press:** translate fully — `transform: translate(3-4px, 3-4px)`, `box-shadow: 0 0 0 #333` (flat)
- **Focus (inputs):** border color changes to `#74B9FF`, shadow color changes to `#74B9FF`
- **Focus (buttons/interactive):** `outline: 3px solid #74B9FF; outline-offset: 2px` — visible keyboard focus ring. Only shown on `:focus-visible` (not on mouse click).
- **Disabled:** `opacity: 0.5`, `cursor: not-allowed`
- **All transitions:** `150ms ease`

### Keyboard Navigation

- All interactive elements (buttons, inputs, color dots, tool buttons) must be focusable via Tab
- Color palette: arrow keys to navigate between colors when focused
- Chat panel: `Escape` key closes the expanded panel
- Existing keyboard shortcuts preserved: `Enter` to submit guess/join, drawing shortcuts from Canvas component
- Focus order follows visual layout: top bar → players → canvas → toolbar → chat

### Decorative Elements

- **Sticker rotations:** elements get slight CSS rotations (`-2deg` to `2deg`) using `:nth-child` for variety
- **Pin emoji** (`📌`): positioned absolute on cards, rotated ~15deg
- **Floating doodle emoji:** scattered in backgrounds, `opacity: 0.12-0.15`, gentle `float` animation (6s ease-in-out, translateY -10px)
- **Wavy SVG underlines:** used under the logo (quadratic bezier path)
- **Rainbow confetti strip:** `repeating-linear-gradient` with all primary colors, used on game over modal top

## Screen Designs

### 1. Landing Page

**Purpose:** First impression, hooks new visitors, three clear entry points.

**Layout:** Full-viewport centered hero section.

**Elements (top to bottom):**
1. Floating doodle emoji (8 scattered, animated)
2. Logo — `Lilita One` 72px, each letter a different primary color, slight per-letter rotations, `text-shadow: 4px 4px 0 #333`
3. Wavy SVG underline in coral
4. Tagline — "Draw · Guess · Laugh" with color-coded words (coral/blue/green), separated by gray dots
5. Three CTA buttons in a row:
   - "Play Now ✏️" — green (`#55EFC4`)
   - "Host Game 🏠" — blue (`#74B9FF`)
   - "Join Room 🔗" — yellow (`#FFEAA7`)
6. How It Works — 3 step cards in a row:
   - "Draw" (✏️) / "Guess" (💬) / "Win" (🏆)
   - White cards with thick borders, pin decoration, numbered badges (coral circles), slight rotations
7. Live players badge — pulsing green dot + "X players online now" (requires a new lightweight backend endpoint `GET /api/stats/online` returning a count from Phoenix Presence — this is the one minor backend addition in this redesign; if deferred, hide this badge initially)
8. Footer — minimal, social links

### 2. Join Flow

**Purpose:** Name + avatar setup, contextual to entry point.

**Three variants** (each a centered card, max-width 420px):

**Play Now (Quick Join):**
- Title: "Jump In! ✏️"
- Name input (cream bg, thick border)
- Avatar preview (generated doodle avatar with refresh button)
- Single green CTA: "Play Now"

**Host Game (Create Room):**
- Title: "Host a Game 🏠"
- Name input + avatar preview
- Room settings section (divider line): 2x2 grid of setting items
  - Rounds (± buttons), Draw Time (± buttons), Max Players (± buttons), Difficulty (± buttons)
- Blue CTA: "Create Room"

**Join Room (Enter Code):**
- Title: "Join a Room 🔗"
- Name input + avatar preview
- Room code input (centered, uppercase, letter-spaced)
- Invite banner (green bg) when arriving via shared link: "You've been invited to [name]'s room"
- Yellow CTA: "Join Room"

**All variants share:** back button (top-left), cream paper background, floating doodle emoji

### 3. Lobby / Waiting Room

**Purpose:** Players gather before game starts. Share room code, see who's joined.

**Routing:** The lobby is NOT a separate route. It is a conditional render within the `/game` page when `roomStatus === "waiting"`. When the game starts, the same page transitions to the game screen layout (canvas maximalist). This preserves the existing routing and WebSocket connection lifecycle.

**Layout:** Centered card, max-width 560px (rendered inside the `/game` page container with cream bg).

**Elements:**
1. Header — "Waiting Room ✏️" (bouncing pencil animation)
2. Room code box (yellow bg) — large code display + Copy/Share buttons
3. Settings summary — horizontal pills showing round count, draw time, max players, difficulty
4. Voice chat toggle — "Join Voice" button
5. Players grid — `grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))`
   - Joined players: sticker cards with doodle avatar, name, Admin/You badges, slight rotations
   - Empty slots: dashed border outlines with "Waiting..." text
6. Start button (admin) — full-width green CTA: "Start Game! 🎮"
7. Waiting message (non-admin) — dashed border box: "Waiting for the host to start..."

### 4. Game Screen

**Purpose:** Core gameplay. Canvas-dominant with minimal chrome.

**Layout:** Full viewport, flex column, 4 zones stacked vertically:

**Zone 1 — Top Bar** (flex row, space-between):
- Left: Small Scribbl logo (`Lilita One` 22px, coral)
- Center: Info badges — Round (green bg), Word hint (yellow bg, letter-spaced), Timer (red bg)
- Right: Settings gear button

**Zone 2 — Players Bar** (horizontal scroll, no scrollbar):
- Player badges as sticker pills: avatar + name + score + status indicators
- Drawing player: yellow bg + ✏️ icon
- Guessed correctly: green bg + ✓ checkmark
- Still guessing: white bg
- Slight alternating rotations

**Zone 3 — Canvas** (flex: 1, takes remaining space):
- Full-width white canvas with thick border, chunky shadow, pin decoration
- `border-radius: 16px`

**Zone 4 — Toolbar + Chat** (flex-shrink: 0):

Toolbar row:
- Color palette: 10 color dots (black, red, orange, yellow, green, blue, purple, pink, brown, white)
  - Selected: ring indicator (`box-shadow: 0 0 0 3px bg-color, 0 0 0 5.5px #333`)
  - Hover: `scale(1.15)`
- Tool buttons: ✏️ Draw, 🧽 Erase, 🪣 Fill, ↩️ Undo, 🗑️ Clear
  - Active: blue bg (`#74B9FF`)
- Brush size: small dot — range slider — large dot

Chat section:
- Recent messages row: horizontal scrollable sticker pills
  - Shows the **last 5 messages** (older messages scroll off-screen left)
  - Maximum pill width: 200px. Text truncated with ellipsis if longer.
  - Regular guess: white bg, "Name: guess text"
  - Correct guess: green bg (`#D5F5E3`), "✓ Name guessed it!"
  - System/hint: yellow bg, "💡 Hint: _ _ a _ _"
  - "↑ Chat" expand button at end — shows unread count badge (coral circle with white number) when there are messages the user hasn't seen while panel is closed
  - New messages animate in from the right
- Input row: rounded input (thick border, focus turns blue) + green send button (➤)

Expanded chat panel (toggled by "↑ Chat"):
- Positioned absolute, above chat area
- Desktop: right-aligned, 320px wide, max-height 400px
- Mobile: centered, full-width with 16px side margins, max-height 50vh, overlays canvas with semi-transparent backdrop (`rgba(0,0,0,0.3)`)
- Yellow header "💬 Chat" with close button (✕)
- Scrollable message list with colored sender names
- Correct guesses in green
- Panel stays open when sending a message (input is in the main bar, not inside the panel)
- `Escape` key closes the panel
- Clicking outside the panel (on the backdrop) closes it on mobile

### 5. Word Selection Modal

**Purpose:** Drawer picks a word at the start of their turn.

**Layout:** Centered card overlay on game screen.

**Elements:**
1. Title: "Pick a Word! 🎯"
2. Countdown timer: 64px circle with red bg, spinning border animation, large number
3. Three word buttons (stacked):
   - Each shows word text + difficulty badge (Easy green / Medium yellow / Hard red)
   - Difficulty is derived from the room's word difficulty setting. If the room uses "Mix" difficulty, all three buttons show the same "Mix" badge. Individual per-word difficulty labels would require backend changes (the `select_word` event currently sends only word strings) — defer this to a future enhancement. For now, show the room-level difficulty on all three.
   - Hover: yellow bg, shadow shifts
4. Skip button: subtle, shows remaining skips

### 6. Turn Over Toast

**Purpose:** Brief transition between turns showing the word.

**Layout:** Horizontal toast bar, not a full modal. Appears over the game screen.

**Elements:**
- Left: emoji icon (🎉 all guessed, ⏰ time's up, 🚪 drawer left)
- Center: title text + "The word was **[word]**" + animated countdown bar
- Auto-dismisses after ~3 seconds

### 7. Game Over Screen

**Purpose:** Final results, celebration, replay option.

**Layout:** Centered card overlay.

**Elements:**
1. Rainbow confetti strip across top of card
2. Bouncing 🏆 trophy
3. Title: "Game Over!" (coral, Lilita One)
4. Leaderboard:
   - Top 3: medal emoji (🥇🥈🥉), colored card backgrounds (gold/silver/bronze tints)
   - 4th+: numeric rank, cream bg
   - Each entry: rank + doodle avatar + name (+ "YOU" badge) + score in coral
   - Slight sticker rotations
5. Action buttons: "📸 Share" (blue) + "Play Again 🎮" (green)

### 8. Kick Vote Modal

**Purpose:** Players vote to kick someone from the game.

**Layout:** Centered card overlay (max-width 400px), same card styling as other modals.

**Elements:**
1. Title: "Vote to Kick 🗳️" (coral, Lilita One)
2. Player list (scrollable, max-height 240px):
   - Each row: doodle avatar + name + Admin badge (if admin, yellow pill) + vote count ("3/4") + "Kick" button (coral bg, chunky border)
   - Already-voted state: button becomes gray, disabled
3. Close button (top-right, "✕")

### 9. Kicked Modal

**Purpose:** Inform a player they've been kicked.

**Layout:** Full-screen centered overlay.

**Elements:**
1. Title: "You've Been Kicked! 👋" (coral)
2. Reason text (muted)
3. Auto-redirect countdown: "Returning to home in 3..."
4. Progress bar (coral, shrinking)

### 10. Settings Modal (In-Game)

**Purpose:** View/edit room settings during a game.

**Two variants based on role:**

**Admin view:** Same 2x2 settings grid as the Host join flow (rounds, draw time, max players, difficulty) with ± controls. "Update Settings" CTA button (blue).

**Non-admin view:** Read-only display of settings as pills (same as lobby summary pills). Includes "Vote to Kick" button (coral) and "Copy Invite Link" button (yellow).

Both share: modal card styling, close button, title "Room Settings ⚙️".

### 11. Connection & Error States

**Connecting state:** Full-screen centered, cream bg. Bouncing pencil emoji animation + "Connecting..." text in muted gray. Shown when WebSocket is establishing connection.

**Reconnecting state:** Thin banner at top of game screen (yellow bg, thick bottom border): "Reconnecting..." with a spinning icon. Non-blocking — game UI stays visible underneath.

**Error state:** Centered card (same style as join card). "Oops! 😵" title + error message + "Try Again" button (coral) + "Back to Home" button (blue).

**Room-specific errors (shown on join flow):**
- Room not found: inline error below room code input, red text + shake animation
- Room is full: inline error below room code input
- Name already taken: inline error below name input

### 12. How to Play (Instructions)

The landing page "How It Works" section replaces the previous InstructionsModal. The 3-step cards (Draw/Guess/Win) serve as the primary onboarding. No separate modal is needed — the landing page itself teaches the game. If a player is already in-game and needs help, the settings gear provides a "How to Play" link that scrolls to the landing page steps (or shows them in a simple modal with the same content).

## Generated Doodle Avatars

Avatars are auto-generated SVGs based on the player's name (used as a seed). Each avatar consists of:

- **Background:** gradient between two randomly-selected primary colors
- **Face shape:** one of ~5 simple shapes (circle, rounded rectangle, triangle, ellipse, squircle) — white fill with slight transparency
- **Eyes:** simple filled circles, positioned relative to face shape
- **Mouth:** simple path (smile, flat line, open mouth, etc.)
- **Optional accessories:** small decorative elements (antennae, ears, horns) as simple strokes

Players can hit a refresh button to regenerate (cycles through different seed variations). The avatar generation should be deterministic given name + seed, so the same player gets the same avatar across sessions.

**Data model:** The Zustand store's `avatar` field changes from an emoji string (e.g., "👽") to a numeric seed (e.g., `0`, `1`, `2`). The seed is transmitted to the backend via Phoenix Presence metadata in the existing `avatar` field (now a number instead of a string). The SVG is generated client-side from `name + seed` — the backend never sees or stores the SVG. Other players' avatars are rendered by passing their `name` (from presence) and `seed` (from the `avatar` metadata field) to the `doodleAvatar()` function. This is a minor backend data type change (string → number) but requires no backend code changes since the field is opaque metadata passed through Presence.

**Performance:** The `DoodleAvatar` component should be wrapped in `React.memo` since inputs (name + seed) rarely change. The `doodleAvatar()` utility should be a pure function with no side effects.

Implementation: pure SVG generation in a utility function. No external dependencies.

## Mobile Responsiveness

### Breakpoints
- **Mobile:** < 768px
- **Tablet:** 768px – 1023px
- **Desktop:** >= 1024px
- **Wide:** >= 1280px (larger sidebar/chat panel proportions)

### Mobile Adaptations

**Landing page:** stack CTA buttons vertically, stack how-it-works cards vertically, reduce logo size

**Join flow:** full-width card, no max-width constraint, settings grid stays 2-column

**Lobby:** players grid collapses to 2 columns, room code box stacks vertically

**Game screen (major changes):**
- Top bar: logo hidden, info badges shrink
- Players bar: horizontal scroll unchanged (works naturally on mobile)
- Canvas: takes available height, minimum 300px
- Toolbar: color palette wraps to 2 rows, tool buttons shrink, brush size slider shorter
- Chat: messages row becomes single-line overflow scroll, input full width
- Expanded chat panel: full width instead of 320px

**Modals:** full-width with padding, word buttons stack as before

### Touch Targets
All interactive elements minimum 44px touch target on mobile.

### Orientation
Keep the existing `OrientationLock` component — portrait only on mobile.

## Animations

### Always-on Animations
- Floating doodle emoji: `6s ease-in-out infinite` translateY, staggered delays
- Trophy bounce: `1s ease-in-out infinite` translateY
- Live dot pulse: `2s ease-in-out infinite` opacity + scale
- Timer spinner: `1s linear infinite` rotation (word selection)
- Turn toast progress bar: `3s linear` width shrink

### Interaction Animations
- Button press: `150ms` translate + shadow shift
- Color dot hover: `150ms` scale
- Input focus: `150ms` border + shadow color transition
- Timer warning: `0.5s` shake animation when ≤ 10s

### Transition Animations
- Modal appear: fade in + slight translateY (inherited from existing `animate-fadeIn`)
- Chat panel expand: slide up from bottom
- Toast appear/dismiss: slide in from top, slide out

### What NOT to Animate
- No particle effects or confetti (except the static rainbow strip)
- No screen shake
- No continuous background animations besides the floating doodles
- No sound-triggered visual effects

## Sound Design

Minimal, non-annoying sound effects for key moments only:

- **Correct guess:** soft pop/ding
- **Your turn to draw:** gentle notification chime
- **Timer warning (≤10s):** subtle tick
- **Game over:** short celebratory jingle
- **Turn over:** brief transition sound

All sounds should be short (< 1 second except game over jingle). Volume default 20%. Sounds can be muted via settings. No background music.

## Component Architecture

### New/Modified Components
- `LandingPage` — new, replaces current join page as the entry point
- `JoinCard` — new, handles all 3 join flows (play/host/join) as variants
- `Lobby` — new, waiting room before game starts (currently part of game page)
- `GameScreen` — major refactor of current game page, canvas maximalist layout
- `Canvas` — refactor styling only, keep react-sketch-canvas internals
- `ChatBar` — new, replaces current Chat component. Horizontal pills + input + expandable panel
- `PlayerBadge` — new, sticker-style player pill for the players bar
- `PlayerCard` — new, larger sticker card for the lobby grid
- `DoodleAvatar` — new, SVG avatar generator
- `Toolbar` — new, drawing tools extracted from Canvas component. Communicates with Canvas via props/callbacks: parent (GameScreen) holds drawing state (color, tool, brush size) and passes it down to both Toolbar and Canvas. Toolbar fires `onColorChange`, `onToolChange`, `onBrushSizeChange` callbacks; Canvas receives the current state as props.
- `WordSelectModal` — restyled
- `TurnToast` — new, replaces current turn over modal
- `GameOverModal` — restyled
- `InfoBadge` — new, reusable styled badge (round, word, timer)

### Components to Remove
- `VoiceChat.tsx` player list rendering (moves to PlayerBadge)
- Current glassmorphism utility classes
- Background music component (sound effects handled differently)

### Shared Utilities
- `doodleAvatar(name: string, seed?: number): string` — returns SVG string
- Color palette constants
- Border/shadow style tokens (CSS custom properties)

## Design Tokens (CSS Custom Properties)

```css
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
  --font-display: 'Lilita One', cursive;
  --font-body: 'Nunito', sans-serif;

  /* Transitions */
  --transition-fast: 150ms ease;
}
```

## Migration Notes

- This is a **visual-only redesign** with two minor backend touches: (1) the `avatar` presence metadata field changes from emoji string to numeric seed (no backend code change needed — it's opaque metadata), and (2) an optional `GET /api/stats/online` endpoint for the landing page live count (can be deferred). No WebSocket protocol changes. No game logic changes.
- The Zustand store, Phoenix channel integration, and all hooks remain unchanged.
- The `react-sketch-canvas` library stays — only the container styling changes.
- Font loading: replace current Outfit/Inter/JetBrains Mono with `Lilita One` and `Nunito` loaded via `next/font/google` in `layout.tsx` (not via `<link>` CDN tag). Use `variable` mode with CSS custom properties and `display: 'swap'` to prevent layout shift.
- The existing `framer-motion` dependency can be used for modal/toast animations but is optional — CSS animations are sufficient for everything in this spec.
- `socket.io-client` dependency should be removed (already unused).

## Mockups

Interactive mockups are available in `.superpowers/brainstorm/303300-1773559878/`:
- `design-landing.html` — Landing page
- `design-game.html` — Game screen
- `design-join.html` — Join flow (3 variants)
- `design-lobby.html` — Lobby / waiting room
- `design-modals.html` — Word selection, turn toasts, game over
