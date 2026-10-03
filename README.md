# 🐍 Neon Snake

A modern, responsive take on the classic **Snake** game, built with plain **HTML5 Canvas, CSS and JavaScript**. No frameworks, no build step, no dependencies.

![Neon Snake](assets/screenshot.png)

## ✨ Features

- Neon visuals with glow, gradient snake body, particle bursts and a screen shake on game over
- **3 difficulty levels** (Easy / Normal / Hard)
- **Levels**: every 5 apples the snake speeds up and points multiply
- **Golden bonus star**: appears at random for 5 seconds, worth 50 × level
- **Pass-through walls** toggle (classic wrap-around or deadly walls)
- **Best score** saved in the browser (localStorage)
- Retro **sound effects** generated with the Web Audio API (no audio files), with mute toggle
- Works on **desktop and mobile**: keyboard, swipe gestures and on-screen D-pad
- Auto-pauses when you switch tabs
- Sharp rendering on high-DPI / Retina screens
- Installable as a simple web app (web manifest)

## 🎮 Controls

| Action        | Keyboard                    | Mobile              |
|---------------|-----------------------------|---------------------|
| Move          | Arrow keys or `W` `A` `S` `D` | Swipe or D-pad      |
| Start/Restart | `Enter`                     | "Start game" button |
| Pause/Resume  | `P` or `Space`              | ⏸ button            |
| Mute          | `M`                         | 🔊 button           |

## 📏 Rules & scoring

| Item           | Points        | Effect                     |
|----------------|---------------|----------------------------|
| 🍎 Apple       | 10 × level    | Snake grows by 1           |
| ⭐ Golden bonus | 50 × level    | Disappears after 5 seconds |

The game ends when the snake hits its own body — or a wall, if "Pass through walls" is turned off. Fill the entire 20 × 20 board to win.

## 🚀 Getting started

### Play locally
1. **Extract the zip first** (right-click → *Extract All…* on Windows). Opening `index.html` directly from inside the zip won't load the styles and scripts.
2. Double-click `index.html`.

Or just open **`snake-standalone.html`** — a single file with everything built in, which works even on its own.

Optionally, serve it with a local server (recommended for the web manifest to work):

```bash
# Python 3
python -m http.server 8000

# or Node.js
npx serve .
```

Then visit <http://localhost:8000>.

### Deploy
The site is fully static, so it can be hosted anywhere:

- **GitHub Pages** — push the folder to a repo, then *Settings → Pages → Deploy from branch*.
- **Netlify / Vercel / Cloudflare Pages** — drag-and-drop the folder or connect the repo. No build command needed; publish directory is the root.

## 📁 Project structure

```
snake-game/
├── index.html            # Page layout: header, game board, how-to-play, about
├── snake-standalone.html # Same game in one self-contained file
├── css/
│   └── style.css         # Theme, layout, responsive rules, animations
├── js/
│   └── game.js           # Game engine: loop, logic, rendering, input, sound
├── assets/
│   └── favicon.svg       # Site icon
├── manifest.webmanifest  # Web app manifest
├── robots.txt
├── .gitignore
├── LICENSE               # MIT
└── README.md
```

## 🛠️ Customising

All tunable values are at the top of `js/game.js`:

```js
const GRID = 20;              // board size (cells per side)
const FOODS_PER_LEVEL = 5;    // apples needed to level up
const BONUS_CHANCE = 0.25;    // chance a bonus appears after eating
const BONUS_LIFETIME = 5000;  // bonus lifetime in ms
const SPEEDS = { ... };       // speed per difficulty
```

Colours live in CSS variables at the top of `css/style.css` (`--snake`, `--food`, `--bonus`, `--accent`…) and in the `COLORS` object in `game.js`.

## 🧠 How it works (for learners)

1. **Game loop** — `requestAnimationFrame` runs every frame; a time accumulator advances the snake one cell every *N* ms, so speed is independent of the screen's refresh rate.
2. **Movement** — a new head is added in the current direction; the tail is removed unless the snake just ate.
3. **Input queue** — key presses go into a small queue so quick turns aren't lost, and 180° reversals are blocked.
4. **Collisions** — the new head is checked against the walls and the body.
5. **Rendering** — the board is redrawn every frame on the canvas: grid, food, bonus, snake, then particles.

Ideas to extend it: obstacles, two-player mode, online leaderboard, themes, or a speed-boost power-up.

## 🌐 Browser support

Latest Chrome, Edge, Firefox and Safari (desktop and mobile).

## 📄 License

[MIT](LICENSE) — free to use, modify and share.
