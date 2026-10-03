/**
 * Neon Snake — classic snake game on HTML5 Canvas.
 * No dependencies. See README.md for details.
 */
(() => {
  "use strict";

  // ---------- Config ----------
  const GRID = 20;                       // cells per side
  const FOODS_PER_LEVEL = 5;             // apples needed to level up
  const BONUS_CHANCE = 0.25;             // chance a bonus spawns after eating
  const BONUS_LIFETIME = 5000;           // ms
  const SPEEDS = {                       // ms per step at level 1, min ms
    easy:   { start: 160, min: 90,  step: 8 },
    normal: { start: 120, min: 60,  step: 8 },
    hard:   { start: 85,  min: 40,  step: 6 },
  };
  const COLORS = {
    grid: "rgba(255,255,255,0.035)",
    head: "#b6ffd6",
    body1: [57, 255, 136],
    body2: [15, 209, 160],
    food: "#ff3d6e",
    bonus: "#ffd23d",
  };
  const STORAGE_KEY = "neon-snake-best";

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const board = canvas.parentElement;
  const overlay = $("overlay");
  const overlayTitle = $("overlay-title");
  const overlayMsg = $("overlay-msg");
  const optionsEl = $("options");
  const btnStart = $("btn-start");
  const btnPause = $("btn-pause");
  const btnSound = $("btn-sound");
  const scoreEl = $("score");
  const bestEl = $("best");
  const levelEl = $("level");
  const difficultyEl = $("difficulty");
  const wrapEl = $("wrap");

  // ---------- Storage (safe) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : v; }
      catch { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
  };

  // ---------- Sound ----------
  const sound = {
    enabled: store.get("neon-snake-sound", "1") === "1",
    ctx: null,
    play(freq, duration = 0.08, type = "square", vol = 0.06, slideTo = null) {
      if (!this.enabled) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + duration);
      } catch { /* audio unavailable */ }
    },
    eat()    { this.play(520, 0.07, "square", 0.05, 880); },
    bonus()  { this.play(660, 0.08); setTimeout(() => this.play(990, 0.12), 70); },
    level()  { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.play(f, 0.1, "triangle", 0.07), i * 80)); },
    die()    { this.play(300, 0.45, "sawtooth", 0.07, 60); },
  };

  // ---------- State ----------
  let snake, dir, dirQueue, food, bonus, score, level, eaten;
  let state = "ready";                    // ready | running | paused | over
  let best = parseInt(store.get(STORAGE_KEY, "0"), 10) || 0;
  let lastTime = 0, acc = 0;
  let particles = [];
  let cell = 30;                          // pixel size of a cell (recomputed on resize)

  const DIRS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 },
  };

  // ---------- Setup ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = board.clientWidth;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = size / GRID;
    draw(0);
  }

  function reset() {
    const mid = Math.floor(GRID / 2);
    snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    dir = DIRS.right;
    dirQueue = [];
    score = 0;
    level = 1;
    eaten = 0;
    bonus = null;
    particles = [];
    food = randomFreeCell();
    updateHud();
  }

  function randomFreeCell() {
    const taken = new Set(snake.map((s) => s.x + "," + s.y));
    if (food) taken.add(food.x + "," + food.y);
    if (bonus) taken.add(bonus.x + "," + bonus.y);
    const free = [];
    for (let x = 0; x < GRID; x++)
      for (let y = 0; y < GRID; y++)
        if (!taken.has(x + "," + y)) free.push({ x, y });
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function stepInterval() {
    const s = SPEEDS[difficultyEl.value] || SPEEDS.normal;
    return Math.max(s.min, s.start - (level - 1) * s.step);
  }

  // ---------- Game flow ----------
  function start() {
    sound.ctx && sound.ctx.resume && sound.ctx.resume();
    reset();
    state = "running";
    acc = 0;
    hideOverlay();
    btnPause.textContent = "⏸";
  }

  function togglePause() {
    if (state === "running") {
      state = "paused";
      btnPause.textContent = "▶";
      showOverlay("Paused", "Press P, Space or the button to resume.", false, "Resume");
    } else if (state === "paused") {
      state = "running";
      btnPause.textContent = "⏸";
      hideOverlay();
    }
  }

  function gameOver() {
    state = "over";
    sound.die();
    board.classList.remove("shake");
    void board.offsetWidth; // restart animation
    board.classList.add("shake");
    const isRecord = score > best && score > 0;
    if (score > best) {
      best = score;
      store.set(STORAGE_KEY, String(best));
    }
    updateHud();
    setTimeout(() => {
      showOverlay(
        isRecord ? "New record!" : "Game over",
        `You scored ${score} points and reached level ${level}. Snake length: ${snake.length}.`,
        true,
        "Play again"
      );
    }, 450);
  }

  function update() {
    if (dirQueue.length) dir = dirQueue.shift();

    const head = snake[0];
    let nx = head.x + dir.x;
    let ny = head.y + dir.y;

    if (wrapEl.checked) {
      nx = (nx + GRID) % GRID;
      ny = (ny + GRID) % GRID;
    } else if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) {
      return gameOver();
    }

    const willEat = food && nx === food.x && ny === food.y;
    // The tail moves away this step unless we're growing, so it's safe to enter
    const body = willEat ? snake : snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) return gameOver();

    snake.unshift({ x: nx, y: ny });

    if (willEat) {
      eaten++;
      score += 10 * level;
      burst(nx, ny, COLORS.food);
      sound.eat();
      if (eaten % FOODS_PER_LEVEL === 0) {
        level++;
        sound.level();
      }
      food = randomFreeCell();
      if (!bonus && Math.random() < BONUS_CHANCE) {
        const c = randomFreeCell();
        if (c) bonus = { ...c, expires: performance.now() + BONUS_LIFETIME };
      }
      if (!food) return win();
    } else {
      snake.pop();
    }

    if (bonus && nx === bonus.x && ny === bonus.y) {
      score += 50 * level;
      burst(nx, ny, COLORS.bonus, 26);
      sound.bonus();
      bonus = null;
    }

    updateHud();
  }

  function win() {
    state = "over";
    if (score > best) { best = score; store.set(STORAGE_KEY, String(best)); }
    updateHud();
    showOverlay("You win!", `You filled the whole board with ${score} points. Legendary.`, true, "Play again");
  }

  // ---------- Particles ----------
  function burst(gx, gy, color, count = 14) {
    const cx = (gx + 0.5), cy = (gy + 0.5);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
    }
  }

  function updateParticles(dt) {
    const s = dt / 1000;
    particles = particles.filter((p) => {
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.life -= s * 2;
      return p.life > 0;
    });
  }

  // ---------- Rendering ----------
  function draw(now) {
    const size = cell * GRID;
    ctx.clearRect(0, 0, size, size);

    // grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < GRID; i++) {
      ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size);
      ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell);
    }
    ctx.stroke();

    if (!snake) return;

    // food (pulsing)
    const pulse = 1 + Math.sin(now / 180) * 0.08;
    if (food) drawOrb(food.x, food.y, COLORS.food, 0.36 * pulse);

    // bonus (blinks when about to expire)
    if (bonus) {
      const left = bonus.expires - now;
      if (left > 1500 || Math.floor(now / 120) % 2 === 0) {
        drawOrb(bonus.x, bonus.y, COLORS.bonus, 0.4 * pulse, true);
      }
      // timer ring
      ctx.strokeStyle = "rgba(255,210,61,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc((bonus.x + 0.5) * cell, (bonus.y + 0.5) * cell, cell * 0.55,
        -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, left / BONUS_LIFETIME));
      ctx.stroke();
    }

    // snake
    const n = snake.length;
    for (let i = n - 1; i >= 0; i--) {
      const s = snake[i];
      const t = n > 1 ? i / (n - 1) : 0;
      const [r1, g1, b1] = COLORS.body1, [r2, g2, b2] = COLORS.body2;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      const pad = cell * (0.08 + t * 0.06);
      ctx.shadowColor = `rgba(${r},${g},${b},0.7)`;
      ctx.shadowBlur = i === 0 ? 18 : 8;
      ctx.fillStyle = i === 0 ? COLORS.head : `rgb(${r},${g},${b})`;
      roundRect(s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.28);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // eyes
    const h = snake[0];
    const cx = (h.x + 0.5) * cell, cy = (h.y + 0.5) * cell;
    const ex = dir.y !== 0 ? cell * 0.18 : 0;
    const ey = dir.x !== 0 ? cell * 0.18 : 0;
    const fx = dir.x * cell * 0.12, fy = dir.y * cell * 0.12;
    ctx.fillStyle = "#04120b";
    [[1], [-1]].forEach(([k]) => {
      ctx.beginPath();
      ctx.arc(cx + fx + ex * k, cy + fy + ey * k, cell * 0.08, 0, Math.PI * 2);
      ctx.fill();
    });

    // particles
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * cell, p.y * cell, cell * 0.09, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawOrb(gx, gy, color, radius, star = false) {
    const cx = (gx + 0.5) * cell, cy = (gy + 0.5) * cell;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (star) {
      const spikes = 5, outer = cell * radius, inner = outer * 0.5;
      for (let i = 0; i < spikes * 2; i++) {
        const rr = i % 2 === 0 ? outer : inner;
        const a = (Math.PI / spikes) * i - Math.PI / 2;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
    } else {
      ctx.arc(cx, cy, cell * radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    if (!star) {
      // little leaf
      ctx.fillStyle = "#39ff88";
      ctx.beginPath();
      ctx.ellipse(cx + cell * 0.1, cy - cell * 0.32, cell * 0.1, cell * 0.05, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Main loop ----------
  function loop(now) {
    const dt = lastTime ? Math.min(now - lastTime, 100) : 16;
    lastTime = now;

    if (state === "running") {
      acc += dt;
      const interval = stepInterval();
      while (acc >= interval && state === "running") {
        acc -= interval;
        update();
      }
      if (bonus && now > bonus.expires) bonus = null;
    }
    updateParticles(dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  // ---------- UI helpers ----------
  function updateHud() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(best, score);
    levelEl.textContent = level;
  }

  function showOverlay(title, msg, showOptions, buttonText) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    optionsEl.style.display = showOptions ? "" : "none";
    btnStart.textContent = buttonText;
    overlay.classList.remove("hidden");
  }
  function hideOverlay() { overlay.classList.add("hidden"); }

  function updateSoundBtn() { btnSound.textContent = sound.enabled ? "🔊" : "🔇"; }

  // ---------- Input ----------
  function queueDir(name) {
    const d = DIRS[name];
    if (!d || state !== "running") return;
    const last = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    if (d === last || (d.x === -last.x && d.y === -last.y)) return; // no reverse
    if (dirQueue.length < 3) dirQueue.push(d);
  }

  const KEYMAP = {
    ArrowUp: "up", KeyW: "up",
    ArrowDown: "down", KeyS: "down",
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
  };

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "SELECT") return;
    if (KEYMAP[e.code]) {
      if (state === "running") e.preventDefault();
      queueDir(KEYMAP[e.code]);
    } else if (e.code === "KeyP" || e.code === "Space") {
      if (state === "running" || state === "paused") { e.preventDefault(); togglePause(); }
    } else if (e.code === "Enter") {
      if (state === "ready" || state === "over") { e.preventDefault(); start(); }
      else if (state === "paused") { e.preventDefault(); togglePause(); }
    } else if (e.code === "KeyM") {
      toggleSound();
    }
  });

  // swipe
  let touchStart = null;
  board.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  board.addEventListener("touchmove", (e) => {
    if (!touchStart) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    queueDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  board.addEventListener("touchend", () => { touchStart = null; });

  // d-pad
  document.querySelectorAll(".dpad button").forEach((b) => {
    b.addEventListener("pointerdown", (e) => { e.preventDefault(); queueDir(b.dataset.dir); });
  });

  function toggleSound() {
    sound.enabled = !sound.enabled;
    store.set("neon-snake-sound", sound.enabled ? "1" : "0");
    updateSoundBtn();
  }

  btnStart.addEventListener("click", () => (state === "paused" ? togglePause() : start()));
  btnPause.addEventListener("click", () => {
    if (state === "running" || state === "paused") togglePause();
  });
  btnSound.addEventListener("click", toggleSound);

  // auto-pause when tab is hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") togglePause();
  });

  window.addEventListener("resize", resize);

  // ---------- Init ----------
  reset();
  updateSoundBtn();
  resize();
  requestAnimationFrame(loop);
})();
