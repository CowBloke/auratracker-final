/* Paper.io — clone solo avec bots, intégré à AuraTracker.
   Communication avec le parent via postMessage:
     -> PAPERIO_SCORE_UPDATE { score }
     -> PAPERIO_GAME_OVER    { score }
     <- RESTART_GAME
*/
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------
  const COLS = 110;
  const ROWS = 110;
  const CELL = 100; // logical world units per cell (camera works in world units)
  const TOTAL = COLS * ROWS;
  const STEP_MS = 80; // logic tick: a head advances one cell per tick
  const BOT_COUNT = 11;
  const SPAWN_RADIUS = 2; // 5x5 starting territory
  const BOT_RESPAWN_MS = 2600;

  const PALETTE = [
    { main: '#2d7dff', light: '#7fb0ff' }, // player (index 0)
    { main: '#ff4d5e', light: '#ff97a0' },
    { main: '#37c871', light: '#86e7ad' },
    { main: '#ff9f1c', light: '#ffc774' },
    { main: '#a368ff', light: '#c9a6ff' },
    { main: '#13c4c4', light: '#76e6e6' },
    { main: '#ff6bd6', light: '#ffaee8' },
    { main: '#f2d024', light: '#f8e482' },
    { main: '#5ce65c', light: '#a5f2a5' },
    { main: '#ff7847', light: '#ffae90' },
    { main: '#4d8bff', light: '#9bbcff' },
    { main: '#c0c64d', light: '#dde08f' },
  ];

  const BOT_NAMES = [
    'Léo', 'Mia', 'Hugo', 'Zoé', 'Tom', 'Eva',
    'Nora', 'Sam', 'Lina', 'Max', 'Iris', 'Nael',
  ];

  // ---------------------------------------------------------------------------
  // Canvas
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');
  let viewW = 0, viewH = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = viewW + 'px';
    canvas.style.height = viewH + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------------------
  // World state
  // ---------------------------------------------------------------------------
  const grid = new Uint8Array(TOTAL);  // owner id (0 = empty)
  const trail = new Uint8Array(TOTAL); // trail owner id (0 = none)
  let players = [];
  let player = null; // human
  let running = false;
  let gameOver = false;
  let bestScore = 0;
  let lastReported = -1;
  let acc = 0;
  let lastFrame = 0;
  let renderT = 0; // interpolation factor 0..1

  const idx = (x, y) => y * COLS + x;
  const inBounds = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS;
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  function makePlayer(id, isBot, name) {
    return {
      id, isBot, name,
      color: PALETTE[(id - 1) % PALETTE.length],
      x: 0, y: 0, prevX: 0, prevY: 0,
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      trailCells: [],
      area: 0,
      kills: 0,
      alive: false,
      respawnAt: 0,
      // bot AI
      homeX: 0, homeY: 0,
      returning: false,
      outSteps: 0,
      maxTrail: rand(14, 30),
    };
  }

  function clearOwned(id) {
    for (let i = 0; i < TOTAL; i++) if (grid[i] === id) grid[i] = 0;
  }
  function clearTrail(p) {
    for (const c of p.trailCells) if (trail[c] === p.id) trail[c] = 0;
    p.trailCells = [];
  }

  function spawnPlayer(p) {
    let cx = 0, cy = 0, ok = false;
    for (let tries = 0; tries < 400 && !ok; tries++) {
      cx = rand(SPAWN_RADIUS + 2, COLS - SPAWN_RADIUS - 3);
      cy = rand(SPAWN_RADIUS + 2, ROWS - SPAWN_RADIUS - 3);
      ok = true;
      for (let dy = -SPAWN_RADIUS - 1; dy <= SPAWN_RADIUS + 1 && ok; dy++) {
        for (let dx = -SPAWN_RADIUS - 1; dx <= SPAWN_RADIUS + 1; dx++) {
          const c = idx(cx + dx, cy + dy);
          if (grid[c] !== 0) { ok = false; break; }
        }
      }
    }
    for (let dy = -SPAWN_RADIUS; dy <= SPAWN_RADIUS; dy++) {
      for (let dx = -SPAWN_RADIUS; dx <= SPAWN_RADIUS; dx++) {
        grid[idx(cx + dx, cy + dy)] = p.id;
      }
    }
    p.x = cx; p.y = cy; p.prevX = cx; p.prevY = cy;
    p.homeX = cx; p.homeY = cy;
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    p.dir = dirs[rand(0, 3)];
    p.nextDir = p.dir;
    p.trailCells = [];
    p.returning = false;
    p.outSteps = 0;
    p.maxTrail = rand(14, 30);
    p.alive = true;
  }

  function setup() {
    grid.fill(0);
    trail.fill(0);
    players = [];
    player = makePlayer(1, false, 'Toi');
    players.push(player);
    for (let i = 0; i < BOT_COUNT; i++) {
      players.push(makePlayer(i + 2, true, BOT_NAMES[i % BOT_NAMES.length]));
    }
    for (const p of players) spawnPlayer(p);
    recomputeAreas();
    gameOver = false;
    running = true;
    bestScore = 0;
    lastReported = -1;
    acc = 0;
    canvas.focus();
  }

  function recomputeAreas() {
    for (const p of players) p.area = 0;
    const byId = {};
    for (const p of players) byId[p.id] = p;
    for (let i = 0; i < TOTAL; i++) {
      const o = grid[i];
      if (o && byId[o]) byId[o].area++;
    }
  }

  // ---------------------------------------------------------------------------
  // Capture (flood-fill enclosed area)
  // ---------------------------------------------------------------------------
  const floodVisited = new Uint8Array(TOTAL);
  const floodStack = new Int32Array(TOTAL);

  function capture(p) {
    const id = p.id;
    // trail becomes solid territory
    for (const c of p.trailCells) { grid[c] = id; trail[c] = 0; }
    p.trailCells = [];

    floodVisited.fill(0);
    let sp = 0;
    // seed from all border cells not owned by p
    for (let x = 0; x < COLS; x++) {
      const top = idx(x, 0), bot = idx(x, ROWS - 1);
      if (grid[top] !== id && !floodVisited[top]) { floodVisited[top] = 1; floodStack[sp++] = top; }
      if (grid[bot] !== id && !floodVisited[bot]) { floodVisited[bot] = 1; floodStack[sp++] = bot; }
    }
    for (let y = 0; y < ROWS; y++) {
      const lf = idx(0, y), rt = idx(COLS - 1, y);
      if (grid[lf] !== id && !floodVisited[lf]) { floodVisited[lf] = 1; floodStack[sp++] = lf; }
      if (grid[rt] !== id && !floodVisited[rt]) { floodVisited[rt] = 1; floodStack[sp++] = rt; }
    }
    while (sp > 0) {
      const c = floodStack[--sp];
      const x = c % COLS, y = (c / COLS) | 0;
      if (x > 0) { const n = c - 1; if (grid[n] !== id && !floodVisited[n]) { floodVisited[n] = 1; floodStack[sp++] = n; } }
      if (x < COLS - 1) { const n = c + 1; if (grid[n] !== id && !floodVisited[n]) { floodVisited[n] = 1; floodStack[sp++] = n; } }
      if (y > 0) { const n = c - COLS; if (grid[n] !== id && !floodVisited[n]) { floodVisited[n] = 1; floodStack[sp++] = n; } }
      if (y < ROWS - 1) { const n = c + COLS; if (grid[n] !== id && !floodVisited[n]) { floodVisited[n] = 1; floodStack[sp++] = n; } }
    }
    // any cell not reachable from outside and not yet ours -> captured
    for (let i = 0; i < TOTAL; i++) {
      if (grid[i] !== id && !floodVisited[i]) grid[i] = id;
    }
  }

  function killPlayer(p, killer) {
    if (!p.alive) return;
    p.alive = false;
    clearTrail(p);
    clearOwned(p.id);
    if (killer && killer !== p) killer.kills++;
    if (p === player) {
      endGame();
    } else {
      p.respawnAt = performance.now() + BOT_RESPAWN_MS;
    }
  }

  // ---------------------------------------------------------------------------
  // Logic step
  // ---------------------------------------------------------------------------
  const byIdMap = {};

  function step() {
    for (const p of players) byIdMap[p.id] = p;

    const active = players.filter((p) => p.alive);

    // 1. resolve directions + targets
    for (const p of active) {
      if (p.isBot) botThink(p);
      const nd = p.nextDir;
      // forbid 180° reversal
      if (!(nd.x === -p.dir.x && nd.y === -p.dir.y)) p.dir = nd;
      p.prevX = p.x; p.prevY = p.y;
      p.tx = p.x + p.dir.x;
      p.ty = p.y + p.dir.y;
    }

    // 2. detect deaths
    const deaths = new Map(); // victim -> killer|null
    const mark = (victim, killer) => {
      if (!deaths.has(victim)) deaths.set(victim, killer || null);
    };

    for (const p of active) {
      if (!inBounds(p.tx, p.ty)) { mark(p, null); }
    }
    for (const p of active) {
      if (deaths.has(p)) continue;
      const c = idx(p.tx, p.ty);
      const to = trail[c];
      if (to !== 0) {
        const victim = byIdMap[to];
        if (victim) mark(victim, to === p.id ? null : p);
      }
    }
    // head-to-head (same target, or swap)
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        const sameCell = a.tx === b.tx && a.ty === b.ty;
        const swap = a.tx === b.x && a.ty === b.y && b.tx === a.x && b.ty === a.y;
        if (sameCell || swap) { mark(a, b); mark(b, a); }
      }
    }

    // 3. apply deaths (clears trails/territory)
    for (const [victim, killer] of deaths) killPlayer(victim, killer);

    // 4. move survivors + extend trail / capture
    for (const p of active) {
      if (!p.alive) continue;
      p.x = p.tx; p.y = p.ty;
      const c = idx(p.x, p.y);
      if (grid[c] === p.id) {
        if (p.trailCells.length > 0) capture(p);
      } else if (trail[c] === 0) {
        trail[c] = p.id;
        p.trailCells.push(c);
      }
    }

    recomputeAreas();
  }

  // ---------------------------------------------------------------------------
  // Bot AI
  // ---------------------------------------------------------------------------
  const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

  function safeDirs(p) {
    const out = [];
    for (const d of DIRS) {
      if (d.x === -p.dir.x && d.y === -p.dir.y) continue; // no reverse
      const nx = p.x + d.x, ny = p.y + d.y;
      if (!inBounds(nx, ny)) continue;
      if (trail[idx(nx, ny)] === p.id) continue; // would cut own trail
      out.push(d);
    }
    return out;
  }

  function botThink(p) {
    const here = idx(p.x, p.y);
    const onOwn = grid[here] === p.id;
    const trailLen = p.trailCells.length;

    if (onOwn && trailLen === 0) { p.returning = false; p.outSteps = 0; }
    if (trailLen >= p.maxTrail) p.returning = true;

    const opts = safeDirs(p);
    if (opts.length === 0) { return; } // trapped → keeps direction, dies

    if (p.returning) {
      // head toward home territory, prefer cells already owned to close the loop
      opts.sort((a, b) => {
        const da = dist(p.x + a.x, p.y + a.y, p.homeX, p.homeY);
        const db = dist(p.x + b.x, p.y + b.y, p.homeX, p.homeY);
        const oa = grid[idx(p.x + a.x, p.y + a.y)] === p.id ? -3 : 0;
        const ob = grid[idx(p.x + b.x, p.y + b.y)] === p.id ? -3 : 0;
        return (da + oa) - (db + ob);
      });
      p.nextDir = opts[0];
    } else {
      // expand: mostly straight lines, occasional turns to carve area
      const straight = opts.find((d) => d.x === p.dir.x && d.y === p.dir.y);
      if (straight && Math.random() < 0.8) p.nextDir = straight;
      else p.nextDir = opts[rand(0, opts.length - 1)];
      p.outSteps++;
      if (p.outSteps > p.maxTrail) p.returning = true;
    }
  }
  const dist = (x1, y1, x2, y2) => Math.abs(x1 - x2) + Math.abs(y1 - y2);

  // ---------------------------------------------------------------------------
  // Scoring
  // ---------------------------------------------------------------------------
  function liveScore() {
    const pct = player.area / TOTAL; // 0..1
    return Math.round(pct * 10000) + player.kills * 500;
  }
  function post(type, score) {
    if (window.parent !== window) {
      window.parent.postMessage({ type, data: { score } }, window.location.origin);
    }
  }
  function reportScore() {
    const s = liveScore();
    if (s > bestScore) bestScore = s;
    if (s !== lastReported) {
      lastReported = s;
      post('PAPERIO_SCORE_UPDATE', s);
    }
  }
  function endGame() {
    if (gameOver) return;
    gameOver = true;
    running = false;
    const final = Math.max(bestScore, liveScore());
    post('PAPERIO_GAME_OVER', final);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  let camX = 0, camY = 0;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function rgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function headPixel(p) {
    return {
      x: (lerp(p.prevX, p.x, renderT) + 0.5) * CELL,
      y: (lerp(p.prevY, p.y, renderT) + 0.5) * CELL,
    };
  }

  let mmFrame = 0;
  const mmCanvas = document.createElement('canvas');
  mmCanvas.width = 120; mmCanvas.height = 120;
  const mmCtx = mmCanvas.getContext('2d');

  function drawMinimap() {
    const MM = 120;
    const img = mmCtx.createImageData(MM, MM);
    const data = img.data;
    const cols = {};
    for (const p of players) {
      const h = p.color.main;
      cols[p.id] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    }
    for (let my = 0; my < MM; my++) {
      const gy = ((my / MM) * ROWS) | 0;
      for (let mx = 0; mx < MM; mx++) {
        const gx = ((mx / MM) * COLS) | 0;
        const o = grid[idx(gx, gy)];
        const di = (my * MM + mx) * 4;
        if (o && cols[o]) {
          data[di] = cols[o][0]; data[di + 1] = cols[o][1]; data[di + 2] = cols[o][2]; data[di + 3] = 235;
        } else {
          data[di] = 22; data[di + 1] = 25; data[di + 2] = 36; data[di + 3] = 180;
        }
      }
    }
    mmCtx.putImageData(img, 0, 0);
  }

  function render() {
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, viewW, viewH);

    // background
    ctx.fillStyle = '#0e1018';
    ctx.fillRect(0, 0, viewW, viewH);

    // camera follows player head
    const hp = player.alive ? headPixel(player) : { x: (player.x + 0.5) * CELL, y: (player.y + 0.5) * CELL };
    const scale = viewW < 560 ? 0.18 : 0.22; // zoom: world units -> screen px
    const px = CELL * scale;

    camX = hp.x * scale - viewW / 2;
    camY = hp.y * scale - viewH / 2;
    const worldW = COLS * px, worldH = ROWS * px;
    camX = Math.max(-40, Math.min(camX, worldW - viewW + 40));
    camY = Math.max(-40, Math.min(camY, worldH - viewH + 40));
    if (worldW < viewW) camX = (worldW - viewW) / 2;
    if (worldH < viewH) camY = (worldH - viewH) / 2;

    const sx = (wx) => wx * scale - camX;
    const sy = (wy) => wy * scale - camY;

    // visible cell range
    const c0 = Math.max(0, Math.floor(camX / px) - 1);
    const r0 = Math.max(0, Math.floor(camY / px) - 1);
    const c1 = Math.min(COLS - 1, Math.ceil((camX + viewW) / px) + 1);
    const r1 = Math.min(ROWS - 1, Math.ceil((camY + viewH) / px) + 1);

    // arena floor inside walls
    ctx.fillStyle = '#15182410';
    // grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = c0; x <= c1 + 1; x++) {
      const gx = sx(x * CELL);
      ctx.moveTo(gx, sy(r0 * CELL));
      ctx.lineTo(gx, sy((r1 + 1) * CELL));
    }
    for (let y = r0; y <= r1 + 1; y++) {
      const gy = sy(y * CELL);
      ctx.moveTo(sx(c0 * CELL), gy);
      ctx.lineTo(sx((c1 + 1) * CELL), gy);
    }
    ctx.stroke();

    const colorById = {};
    for (const p of players) colorById[p.id] = p.color;

    // territory
    for (let y = r0; y <= r1; y++) {
      for (let x = c0; x <= c1; x++) {
        const o = grid[idx(x, y)];
        if (!o) continue;
        ctx.fillStyle = rgba(colorById[o].main, 0.92);
        ctx.fillRect(sx(x * CELL), sy(y * CELL), px + 0.6, px + 0.6);
      }
    }
    // territory edge highlight (top border per cell whose top neighbour is different)
    for (let y = r0; y <= r1; y++) {
      for (let x = c0; x <= c1; x++) {
        const o = grid[idx(x, y)];
        if (!o) continue;
        const up = y > 0 ? grid[idx(x, y - 1)] : 0;
        if (up !== o) {
          ctx.fillStyle = rgba(colorById[o].light, 0.95);
          ctx.fillRect(sx(x * CELL), sy(y * CELL), px + 0.6, Math.max(2, px * 0.18));
        }
      }
    }

    // trails
    for (const p of players) {
      if (!p.alive || p.trailCells.length === 0) continue;
      ctx.fillStyle = rgba(p.color.light, 0.7);
      for (const c of p.trailCells) {
        const x = c % COLS, y = (c / COLS) | 0;
        if (x < c0 - 1 || x > c1 + 1 || y < r0 - 1 || y > r1 + 1) continue;
        ctx.fillRect(sx(x * CELL) + px * 0.12, sy(y * CELL) + px * 0.12, px * 0.76, px * 0.76);
      }
    }

    // heads
    for (const p of players) {
      if (!p.alive) continue;
      const h = headPixel(p);
      const hx = sx(h.x), hy = sy(h.y);
      const s = px * 0.92;
      ctx.fillStyle = p.color.main;
      ctx.strokeStyle = '#0e1018';
      ctx.lineWidth = Math.max(1.5, px * 0.12);
      roundRect(ctx, hx - s / 2, hy - s / 2, s, s, px * 0.22);
      ctx.fill();
      ctx.stroke();
      if (p === player) {
        // little eyes
        ctx.fillStyle = '#fff';
        const e = Math.max(1.5, px * 0.13);
        ctx.beginPath();
        ctx.arc(hx - px * 0.16, hy - px * 0.08, e, 0, 7);
        ctx.arc(hx + px * 0.16, hy - px * 0.08, e, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#0e1018';
        ctx.beginPath();
        ctx.arc(hx - px * 0.16 + p.dir.x * px * 0.05, hy - px * 0.08 + p.dir.y * px * 0.05, e * 0.5, 0, 7);
        ctx.arc(hx + px * 0.16 + p.dir.x * px * 0.05, hy - px * 0.08 + p.dir.y * px * 0.05, e * 0.5, 0, 7);
        ctx.fill();
      }
      // name tag for bots near player
      if (px > 6) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `${Math.max(9, px * 0.5)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.name, hx, hy - s * 0.75);
      }
    }

    // walls
    ctx.strokeStyle = 'rgba(255,80,80,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx(0), sy(0), COLS * px, ROWS * px);

    ctx.restore();

    drawHUD();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawHUD() {
    ctx.save();
    ctx.scale(dpr, dpr);

    // territory percentage (top-left)
    const pct = (player.area / TOTAL) * 100;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, 12, 12, 168, 58, 12); ctx.fill();
    ctx.fillStyle = player.color.main;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(pct.toFixed(2) + '%', 24, 46);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px sans-serif';
    ctx.fillText('Territoire   •   ' + player.kills + ' KO', 24, 62);

    // leaderboard (top-right)
    const ranked = players
      .filter((p) => p.alive || p === player)
      .slice()
      .sort((a, b) => b.area - a.area)
      .slice(0, 5);
    const lbW = 188, lbX = viewW - lbW - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, lbX, 12, lbW, 22 + ranked.length * 20, 12); ctx.fill();
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left';
    ctx.fillText('CLASSEMENT', lbX + 12, 30);
    ctx.font = '13px sans-serif';
    ranked.forEach((p, i) => {
      const y = 48 + i * 20;
      ctx.fillStyle = p.color.main;
      roundRect(ctx, lbX + 12, y - 9, 10, 10, 2); ctx.fill();
      ctx.fillStyle = p === player ? '#fff' : 'rgba(255,255,255,0.8)';
      ctx.font = p === player ? 'bold 13px sans-serif' : '13px sans-serif';
      const name = p.name.length > 9 ? p.name.slice(0, 9) : p.name;
      ctx.fillText(`${i + 1}. ${name}`, lbX + 28, y);
      ctx.textAlign = 'right';
      ctx.fillText(((p.area / TOTAL) * 100).toFixed(1) + '%', lbX + lbW - 12, y);
      ctx.textAlign = 'left';
    });

    // minimap (bottom-right)
    mmFrame++;
    if (mmFrame % 8 === 0) drawMinimap();
    const MM = 120, mmX = viewW - MM - 12, mmY = viewH - MM - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    roundRect(ctx, mmX - 4, mmY - 4, MM + 8, MM + 8, 8); ctx.fill();
    ctx.drawImage(mmCanvas, mmX, mmY);
    // player dot
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mmX + (player.x / COLS) * MM, mmY + (player.y / ROWS) * MM, 2.5, 0, 7);
    ctx.fill();

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------------
  function frame(now) {
    if (!lastFrame) lastFrame = now;
    const dt = Math.min(now - lastFrame, 120);
    lastFrame = now;

    if (running) {
      acc += dt;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        step();
        reportScore();
      }
      renderT = acc / STEP_MS;
    } else {
      renderT = 1;
    }

    // respawn bots
    for (const p of players) {
      if (!p.alive && p.isBot && performance.now() >= p.respawnAt) spawnPlayer(p);
    }

    render();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function setDir(x, y) {
    if (!player.alive) return;
    if (x === -player.dir.x && y === -player.dir.y) return; // no reverse
    player.nextDir = { x, y };
    if (hint) hint.style.opacity = '0';
  }

  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': case 'z': case 'Z': setDir(0, -1); e.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S': setDir(0, 1); e.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A': case 'q': case 'Q': setDir(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': setDir(1, 0); e.preventDefault(); break;
    }
  });

  // touch / swipe
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!touchStart) return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    e.preventDefault();
  }, { passive: false });

  // restart from parent
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'RESTART_GAME') {
      setup();
      if (hint) hint.style.opacity = '1';
    }
  });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  setup();
  requestAnimationFrame(frame);
})();
