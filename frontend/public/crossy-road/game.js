(() => {
  /* ═══════════════════════════════════════════
     CROSSY ROAD CLONE — faithful recreation
     ═══════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreDisplay = document.getElementById('scoreDisplay');
  const coinDisplay = document.getElementById('coinDisplay');
  const hud = document.getElementById('hud');
  const startScreen = document.getElementById('startScreen');
  const gameOverPanel = document.getElementById('gameOverPanel');
  const finalScore = document.getElementById('finalScore');
  const finalBest = document.getElementById('finalBest');
  const restartBtn = document.getElementById('restartBtn');

  // ── Constants ──
  const STORAGE_KEY = 'auratracker-crossy-road-best';
  const COIN_KEY = 'auratracker-crossy-road-coins';
  const TILE = 48;
  const COLS = 13;
  const HALF_COLS = Math.floor(COLS / 2);
  const HOP_DURATION = 0.12;
  const IDLE_TIMEOUT = 7.0;
  const EAGLE_SWOOP_DURATION = 1.2;
  const CAMERA_BEHIND = 4;

  const LANE_TYPE = { GRASS: 0, ROAD: 1, WATER: 2, RAIL: 3 };

  // ── Color palettes ──
  const PAL = {
    grassLight: '#6abf3b',
    grassDark: '#5eaf32',
    grassDarker: '#54a02c',
    roadLight: '#808080',
    roadDark: '#707070',
    roadLine: '#c8c864',
    waterLight: '#4499dd',
    waterDark: '#3388cc',
    railLight: '#887766',
    railDark: '#776655',
    railTrack: '#aaaaaa',
    sidewalkLight: '#bbbbaa',
    sidewalkDark: '#aaa999',
    treeGreen: ['#2d7d2d', '#339933', '#228822', '#44aa44'],
    treeTrunk: '#8b5e3c',
    rockGray: ['#999999', '#aaaaaa', '#888888'],
    carColors: ['#e84040', '#4488ee', '#eecc22', '#44cc88', '#ee6622', '#cc44cc', '#22aacc', '#ff6699'],
    truckColors: ['#dddddd', '#3366aa', '#cc3333', '#44aa44'],
    busColor: '#eebb22',
    logBrown: '#8b6532',
    logDarkBrown: '#6b4522',
    lilyGreen: '#44aa44',
    trainBody: '#dddddd',
    trainStripe: '#dd3344',
    trainWindow: '#4466aa',
    chickenBody: '#f0f0e0',
    chickenWing: '#e0e0d0',
    chickenBeak: '#ff9900',
    chickenComb: '#dd3333',
    chickenEye: '#222222',
    coinGold: '#ffcc00',
    coinShine: '#ffee88',
    shadow: 'rgba(0,0,0,0.18)',
    eagleBrown: '#6b4226',
    eagleWing: '#8b5e3c',
    eagleBelly: '#d4a96a',
  };

  // ── State ──
  let vw = 0, vh = 0, dpr = 1;
  let gameState = 'start'; // start | playing | dead | eagle
  let score = 0;
  let bestScore = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
  let totalCoins = parseInt(localStorage.getItem(COIN_KEY) || '0', 10) || 0;
  let sessionCoins = 0;

  let lanes = [];
  let laneMap = new Map();
  let player = null;
  let camera = { y: 0 };
  let idleTimer = 0;
  let eagle = null;
  let deathAnim = null;
  let elapsed = 0;
  let lastTime = 0;
  let swipeStart = null;
  let queuedMoves = [];
  let particles = [];

  // ── Utility ──
  function rand(a, b) { return Math.random() * (b - a) + a; }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  // Seeded random for lane generation consistency
  function hashY(y) {
    let h = y * 2654435761 >>> 0;
    h = ((h >> 16) ^ h) * 0x45d9f3b >>> 0;
    h = ((h >> 16) ^ h) >>> 0;
    return h;
  }
  function seededRand(y, i) {
    return (hashY(y * 1000 + i) % 10000) / 10000;
  }

  // ── Canvas sizing ──
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth;
    vh = window.innerHeight;
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── World coordinate → screen ──
  function toScreen(wx, wy) {
    const screenX = vw / 2 + (wx - HALF_COLS / 2) * TILE - TILE / 2;
    const screenY = vh * 0.75 - (wy - camera.y) * TILE;
    return { x: screenX, y: screenY };
  }

  // ══════════════════════════════════════
  //  LANE GENERATION
  // ══════════════════════════════════════

  function decideLaneType(y) {
    if (y <= 0) return LANE_TYPE.GRASS;
    if (y === 1) return LANE_TYPE.GRASS; // one safe grass lane

    // Check previous lanes for grouping
    const prev = laneMap.get(y - 1);
    const prev2 = laneMap.get(y - 2);

    // Group lanes: roads come in 2-4, rivers 2-3, rail is single
    if (prev) {
      // Continue road group
      if (prev.type === LANE_TYPE.ROAD && prev.groupRemaining > 0) {
        return LANE_TYPE.ROAD;
      }
      // Continue water group
      if (prev.type === LANE_TYPE.WATER && prev.groupRemaining > 0) {
        return LANE_TYPE.WATER;
      }
    }

    // Always put grass between groups
    if (prev && prev.type !== LANE_TYPE.GRASS) {
      return LANE_TYPE.GRASS;
    }

    // New group
    const r = Math.random();
    const difficulty = clamp(y / 100, 0, 1);
    if (r < 0.45) return LANE_TYPE.ROAD;
    if (r < 0.45 + 0.25 + difficulty * 0.1) return LANE_TYPE.WATER;
    if (r < 0.45 + 0.25 + difficulty * 0.1 + 0.05 + difficulty * 0.05) return LANE_TYPE.RAIL;
    return LANE_TYPE.GRASS;
  }

  function createLane(y) {
    const type = decideLaneType(y);
    const prev = laneMap.get(y - 1);
    const difficulty = clamp(y / 80, 0, 1);

    const lane = {
      y,
      type,
      direction: Math.random() < 0.5 ? 1 : -1,
      speed: 0,
      entities: [],
      obstacles: [],
      coins: [],
      groupRemaining: 0,
      // Rail specifics
      trainTimer: 0,
      trainActive: false,
      trainX: 0,
      trainLength: 0,
      trainWarning: false,
    };

    // Alternate direction from previous same-type lane
    if (prev && prev.type === type) {
      lane.direction = -prev.direction;
    }

    switch (type) {
      case LANE_TYPE.GRASS: {
        // Trees and rocks as obstacles
        const count = randInt(0, 3);
        const used = new Set();
        // Always keep center clear for the first few lanes
        if (y <= 2) break;
        for (let i = 0; i < count; i++) {
          const x = randInt(-HALF_COLS, HALF_COLS);
          if (x === 0 && y < 6) continue; // keep center clear near start
          if (used.has(x)) continue;
          used.add(x);
          lane.obstacles.push({
            x,
            kind: Math.random() < 0.7 ? 'tree' : 'rock',
            variant: randInt(0, 3),
          });
        }
        break;
      }

      case LANE_TYPE.ROAD: {
        if (prev && prev.type === LANE_TYPE.ROAD) {
          lane.groupRemaining = prev.groupRemaining - 1;
        } else {
          lane.groupRemaining = randInt(1, 3);
        }
        lane.speed = rand(1.5, 3.5 + difficulty * 2.5) * lane.direction;
        const numCars = randInt(2, 3 + Math.floor(difficulty * 2));
        const spacing = (COLS + 6) / numCars;
        for (let i = 0; i < numCars; i++) {
          const isLarge = Math.random() < 0.25;
          lane.entities.push({
            x: -HALF_COLS - 3 + i * spacing + rand(-1, 1),
            w: isLarge ? 2.0 : 1.2,
            h: isLarge ? 1.0 : 0.7,
            color: isLarge ? pick(PAL.truckColors) : pick(PAL.carColors),
            isLarge,
          });
        }
        break;
      }

      case LANE_TYPE.WATER: {
        if (prev && prev.type === LANE_TYPE.WATER) {
          lane.groupRemaining = prev.groupRemaining - 1;
        } else {
          lane.groupRemaining = randInt(1, 2);
        }
        lane.speed = rand(1.0, 2.0 + difficulty) * lane.direction;
        const numLogs = randInt(2, 4);
        const spacing = (COLS + 8) / numLogs;
        for (let i = 0; i < numLogs; i++) {
          const isLily = Math.random() < 0.2;
          lane.entities.push({
            x: -HALF_COLS - 4 + i * spacing + rand(-1, 1),
            w: isLily ? 0.8 : rand(2.0, 3.5),
            isLily,
          });
        }
        break;
      }

      case LANE_TYPE.RAIL: {
        lane.speed = rand(8, 14) * lane.direction;
        lane.trainTimer = rand(3, 8);
        lane.trainLength = rand(6, 10);
        break;
      }
    }

    // Coins (rare)
    if (y > 3 && type !== LANE_TYPE.WATER && Math.random() < 0.12) {
      const cx = randInt(-HALF_COLS + 1, HALF_COLS - 1);
      if (!lane.obstacles.some(o => o.x === cx)) {
        lane.coins.push({ x: cx, collected: false });
      }
    }

    return lane;
  }

  function ensureLanes(minY, maxY) {
    for (let y = minY; y <= maxY; y++) {
      if (!laneMap.has(y)) {
        const lane = createLane(y);
        laneMap.set(y, lane);
        lanes.push(lane);
      }
    }
    // Cleanup far lanes
    for (let i = lanes.length - 1; i >= 0; i--) {
      if (lanes[i].y < minY - 10 || lanes[i].y > maxY + 20) {
        laneMap.delete(lanes[i].y);
        lanes.splice(i, 1);
      }
    }
  }

  // ══════════════════════════════════════
  //  PLAYER
  // ══════════════════════════════════════

  function createPlayer() {
    return {
      x: 0,
      y: 0,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
      hopT: 1,
      maxY: 0,
      dead: false,
      facing: 0, // 0=up, 1=left, 2=down, 3=right
      squash: 1,
      onLog: null,
    };
  }

  function isBlocked(x, y) {
    if (x < -HALF_COLS || x > HALF_COLS) return true;
    const lane = laneMap.get(y);
    if (!lane) return false;
    return lane.obstacles.some(o => o.x === x);
  }

  function tryMove(dir) {
    if (gameState !== 'playing') return;
    if (queuedMoves.length >= 3) return;
    queuedMoves.push(dir);
  }

  function processMove() {
    if (player.hopT < 1) return;
    if (queuedMoves.length === 0) return;

    const dir = queuedMoves.shift();
    const deltas = {
      up: [0, 1],
      down: [0, -1],
      left: [-1, 0],
      right: [1, 0],
    };
    const [dx, dy] = deltas[dir];
    const nx = player.x + dx;
    const ny = player.y + dy;

    // Can't go below camera
    if (ny < Math.floor(camera.y) - 2) return;
    if (isBlocked(nx, ny)) return;

    player.fromX = player.x;
    player.fromY = player.y;
    player.toX = nx;
    player.toY = ny;
    player.hopT = 0;
    player.onLog = null;
    player.squash = 0.6;
    idleTimer = 0;

    // Facing
    if (dy > 0) player.facing = 0;
    else if (dy < 0) player.facing = 2;
    else if (dx < 0) player.facing = 1;
    else if (dx > 0) player.facing = 3;
  }

  // ══════════════════════════════════════
  //  UPDATE
  // ══════════════════════════════════════

  function updatePlayer(dt) {
    if (player.dead) return;

    // Hop animation
    if (player.hopT < 1) {
      player.hopT = clamp(player.hopT + dt / HOP_DURATION, 0, 1);
      if (player.hopT >= 1) {
        player.x = player.toX;
        player.y = player.toY;
        if (player.y > player.maxY) {
          const gained = player.y - player.maxY;
          player.maxY = player.y;
          score += gained;
          scoreDisplay.textContent = score;
        }
      }
    }

    // Squash recovery
    player.squash = lerp(player.squash, 1, dt * 12);

    // Log riding
    if (player.hopT >= 1) {
      const lane = laneMap.get(player.y);
      if (lane && lane.type === LANE_TYPE.WATER) {
        let onLog = false;
        for (const log of lane.entities) {
          const logLeft = log.x - log.w / 2;
          const logRight = log.x + log.w / 2;
          if (player.x + 0.5 >= logLeft && player.x + 0.5 <= logRight) {
            onLog = true;
            const drift = lane.speed * dt;
            player.x += drift;
            player.fromX += drift;
            player.toX += drift;
            break;
          }
        }
        if (!onLog) {
          killPlayer('water');
          return;
        }
        // Fell off edge
        if (player.x < -HALF_COLS - 1 || player.x > HALF_COLS + 1) {
          killPlayer('water');
          return;
        }
      }
    }

    // Coin collection
    const currentLane = laneMap.get(Math.round(
      player.hopT < 1
        ? lerp(player.fromY, player.toY, player.hopT)
        : player.y
    ));
    if (currentLane) {
      const px = player.hopT < 1 ? lerp(player.fromX, player.toX, player.hopT) : player.x;
      for (const coin of currentLane.coins) {
        if (!coin.collected && Math.abs(coin.x - px) < 0.7) {
          coin.collected = true;
          sessionCoins++;
          totalCoins++;
          localStorage.setItem(COIN_KEY, String(totalCoins));
          coinDisplay.textContent = sessionCoins;
          coinDisplay.style.display = 'block';
          // Coin particles
          for (let i = 0; i < 8; i++) {
            particles.push({
              x: coin.x, y: currentLane.y,
              vx: rand(-3, 3), vy: rand(1, 5),
              life: rand(0.3, 0.6),
              maxLife: 0.6,
              color: PAL.coinGold,
              size: rand(2, 4),
            });
          }
        }
      }
    }

    // Idle eagle
    idleTimer += dt;
    if (idleTimer > IDLE_TIMEOUT && !eagle) {
      startEagle();
    }

    // Behind camera death (scrolled off)
    if (player.y < player.maxY - 5) {
      killPlayer('behind');
    }
  }

  function updateEntities(dt) {
    const viewMin = Math.floor(camera.y) - 6;
    const viewMax = Math.floor(camera.y) + Math.ceil(vh / TILE) + 6;

    for (const lane of lanes) {
      if (lane.y < viewMin || lane.y > viewMax) continue;

      if (lane.type === LANE_TYPE.ROAD || lane.type === LANE_TYPE.WATER) {
        for (const e of lane.entities) {
          e.x += lane.speed * dt;
          const bound = HALF_COLS + 6;
          if (lane.direction > 0 && e.x > bound + e.w) {
            e.x = -bound - e.w;
          } else if (lane.direction < 0 && e.x < -bound - e.w) {
            e.x = bound + e.w;
          }
        }
      }

      if (lane.type === LANE_TYPE.RAIL) {
        if (lane.trainActive) {
          lane.trainX += lane.speed * dt;
          const bound = HALF_COLS + lane.trainLength + 5;
          if ((lane.direction > 0 && lane.trainX > bound) ||
              (lane.direction < 0 && lane.trainX < -bound)) {
            lane.trainActive = false;
            lane.trainTimer = rand(4, 10);
            lane.trainWarning = false;
          }
        } else {
          lane.trainTimer -= dt;
          if (lane.trainTimer < 1.5 && !lane.trainWarning) {
            lane.trainWarning = true;
          }
          if (lane.trainTimer <= 0) {
            lane.trainActive = true;
            lane.trainX = lane.direction > 0
              ? -HALF_COLS - lane.trainLength - 3
              : HALF_COLS + lane.trainLength + 3;
          }
        }
      }
    }
  }

  function checkCollisions() {
    if (player.dead || player.hopT < 0.3) return;

    const px = player.hopT < 1 ? lerp(player.fromX, player.toX, player.hopT) : player.x;
    const py = player.hopT < 1 ? lerp(player.fromY, player.toY, player.hopT) : player.y;
    const lane = laneMap.get(Math.round(py));
    if (!lane) return;

    if (lane.type === LANE_TYPE.ROAD) {
      for (const car of lane.entities) {
        const carLeft = car.x - car.w / 2;
        const carRight = car.x + car.w / 2;
        if (px + 0.3 > carLeft && px - 0.3 < carRight) {
          killPlayer('car');
          return;
        }
      }
    }

    if (lane.type === LANE_TYPE.RAIL && lane.trainActive) {
      const tLeft = lane.trainX - lane.trainLength / 2;
      const tRight = lane.trainX + lane.trainLength / 2;
      if (px + 0.3 > tLeft && px - 0.3 < tRight) {
        killPlayer('train');
        return;
      }
    }
  }

  function updateCamera(dt) {
    const target = player.maxY - CAMERA_BEHIND;
    camera.y += (target - camera.y) * clamp(dt * 5, 0, 1);
    // Camera only goes forward
    if (camera.y < target - 0.01) {
      camera.y = lerp(camera.y, target, clamp(dt * 4, 0, 1));
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= dt * 8;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function updateEagle(dt) {
    if (!eagle) return;
    eagle.t += dt / EAGLE_SWOOP_DURATION;
    if (eagle.t >= 1) {
      killPlayer('eagle');
      eagle = null;
    }
  }

  function startEagle() {
    eagle = {
      t: 0,
      startX: player.x + (Math.random() < 0.5 ? -8 : 8),
      startY: player.y + 8,
    };
    gameState = 'eagle';
  }

  function killPlayer(reason) {
    if (player.dead) return;
    player.dead = true;
    gameState = 'dead';

    deathAnim = {
      reason,
      t: 0,
      x: player.x,
      y: player.y,
    };

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(STORAGE_KEY, String(bestScore));
    }

    // Delay showing game over
    setTimeout(() => {
      finalScore.textContent = score;
      finalBest.textContent = bestScore;
      gameOverPanel.classList.remove('hidden');
    }, 800);
  }

  function updateDeathAnim(dt) {
    if (!deathAnim) return;
    deathAnim.t += dt;

    if (deathAnim.reason === 'water' && deathAnim.t < 0.5) {
      // Splash particles
      if (deathAnim.t < 0.1) {
        for (let i = 0; i < 12; i++) {
          particles.push({
            x: deathAnim.x, y: deathAnim.y,
            vx: rand(-4, 4), vy: rand(1, 6),
            life: rand(0.3, 0.8),
            maxLife: 0.8,
            color: PAL.waterLight,
            size: rand(2, 5),
          });
        }
      }
    }

    if (deathAnim.reason === 'car' || deathAnim.reason === 'train') {
      // Squash flat
    }
  }

  // ══════════════════════════════════════
  //  DRAWING
  // ══════════════════════════════════════

  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // Draw a voxel-style box (top + front face visible)
  function drawVoxelBox(sx, sy, w, h, depth, topColor, frontColor, sideColor) {
    // Front face
    ctx.fillStyle = frontColor;
    ctx.fillRect(sx, sy, w, h);

    // Top face
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + depth * 0.5, sy - depth * 0.5);
    ctx.lineTo(sx + w + depth * 0.5, sy - depth * 0.5);
    ctx.lineTo(sx + w, sy);
    ctx.closePath();
    ctx.fill();

    // Right side face
    if (sideColor) {
      ctx.fillStyle = sideColor;
      ctx.beginPath();
      ctx.moveTo(sx + w, sy);
      ctx.lineTo(sx + w + depth * 0.5, sy - depth * 0.5);
      ctx.lineTo(sx + w + depth * 0.5, sy + h - depth * 0.5);
      ctx.lineTo(sx + w, sy + h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function darken(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `rgb(${r},${g},${b})`;
  }

  function lighten(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `rgb(${r},${g},${b})`;
  }

  function drawLaneBackground(lane) {
    const s = toScreen(-HALF_COLS - 1, lane.y);
    const w = (COLS + 2) * TILE;

    // Crossy Road uses solid-color rows that alternate per lane
    let rowColor;
    switch (lane.type) {
      case LANE_TYPE.GRASS:
        rowColor = lane.y % 2 === 0 ? PAL.grassLight : PAL.grassDark;
        break;
      case LANE_TYPE.ROAD:
        rowColor = lane.y % 2 === 0 ? PAL.roadLight : PAL.roadDark;
        break;
      case LANE_TYPE.WATER: {
        rowColor = lane.y % 2 === 0 ? PAL.waterLight : PAL.waterDark;
        break;
      }
      case LANE_TYPE.RAIL:
        rowColor = lane.y % 2 === 0 ? PAL.railLight : PAL.railDark;
        break;
    }

    // Full-width row fill (extend to cover entire canvas width)
    const rowRef = toScreen(0, lane.y);
    ctx.fillStyle = rowColor;
    ctx.fillRect(0, rowRef.y, vw, TILE);

    // Water shimmer overlay
    if (lane.type === LANE_TYPE.WATER) {
      const wave = Math.sin(elapsed * 2.5 + lane.y * 1.3) * 0.08;
      ctx.fillStyle = `rgba(255,255,255,${0.04 + wave})`;
      ctx.fillRect(0, rowRef.y, vw, TILE);
    }

    // Road markings
    if (lane.type === LANE_TYPE.ROAD) {
      const ry = toScreen(0, lane.y).y;
      // Dashed center line
      ctx.fillStyle = PAL.roadLine;
      for (let dx = 0; dx < vw; dx += TILE) {
        ctx.fillRect(dx + 8, ry + TILE - 2, TILE * 0.5, 2);
      }
    }

    // Rail tracks
    if (lane.type === LANE_TYPE.RAIL) {
      const ry = toScreen(0, lane.y).y;
      ctx.fillStyle = PAL.railTrack;
      // Two rails - full width
      ctx.fillRect(0, ry + TILE * 0.3, vw, 3);
      ctx.fillRect(0, ry + TILE * 0.65, vw, 3);

      // Ties
      ctx.fillStyle = '#665544';
      const tieSpacing = TILE * 0.8;
      for (let tx = 0; tx < vw; tx += tieSpacing) {
        ctx.fillRect(tx, ry + TILE * 0.25, 4, TILE * 0.5);
      }

      // Warning flash
      if (lane.trainWarning && !lane.trainActive) {
        const flash = Math.sin(elapsed * 12) > 0;
        if (flash) {
          ctx.fillStyle = 'rgba(255, 50, 50, 0.3)';
          ctx.fillRect(0, ry, vw, TILE);
        }
        // Warning lights on sides
        const lightColor = flash ? '#ff3333' : '#661111';
        ctx.fillStyle = lightColor;
        ctx.beginPath();
        ctx.arc(8, ry + TILE / 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(vw - 8, ry + TILE / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Water shimmer
    if (lane.type === LANE_TYPE.WATER) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      for (let i = -HALF_COLS; i <= HALF_COLS; i++) {
        const shimmer = Math.sin(elapsed * 3 + i * 1.5 + lane.y * 2);
        if (shimmer > 0.5) {
          const ws = toScreen(i, lane.y);
          ctx.fillRect(ws.x + 8, ws.y + 12, TILE * 0.4, 2);
        }
      }
    }
  }

  function drawTree(x, y, variant) {
    const s = toScreen(x, y);
    const cx = s.x + TILE / 2;
    const base = s.y + TILE;
    const d = 6; // voxel depth

    // Trunk
    drawVoxelBox(cx - 5, base - 26, 10, 14, d, '#7a5530', PAL.treeTrunk, '#6b4828');

    // Foliage - stacked voxel layers
    const green = PAL.treeGreen[variant % PAL.treeGreen.length];
    const greenDark = darken(green, 25);
    const greenTop = lighten(green, 15);

    drawVoxelBox(cx - 16, base - 50, 32, 12, d, greenTop, green, greenDark);
    drawVoxelBox(cx - 13, base - 60, 26, 12, d, greenTop, green, greenDark);
    drawVoxelBox(cx - 9, base - 67, 18, 9, d, greenTop, green, greenDark);
  }

  function drawRock(x, y, variant) {
    const s = toScreen(x, y);
    const cx = s.x + TILE / 2;
    const base = s.y + TILE;
    const d = 5;

    const gray = PAL.rockGray[variant % PAL.rockGray.length];
    drawVoxelBox(cx - 12, base - 18, 24, 12, d, lighten(gray, 20), gray, darken(gray, 20));
    drawVoxelBox(cx - 8, base - 26, 16, 10, d, lighten(gray, 30), lighten(gray, 10), darken(gray, 10));
  }

  function drawCar(lane, car) {
    const s = toScreen(car.x - car.w / 2, lane.y);
    const px = s.x;
    const py = s.y;
    const w = car.w * TILE;
    const h = TILE * 0.75;
    const d = 10;

    // Shadow
    ctx.fillStyle = PAL.shadow;
    ctx.fillRect(px - 2, py + TILE - 4, w + 4, 6);

    if (car.isLarge) {
      // Truck body
      const truckH = TILE * 0.9;
      drawVoxelBox(px, py + TILE - truckH - 2, w, truckH, d,
        lighten(car.color, 20), car.color, darken(car.color, 30));
      // Cabin
      drawVoxelBox(
        lane.direction > 0 ? px + w - w * 0.3 : px,
        py + TILE - truckH - 12, w * 0.3, 12, d,
        lighten(car.color, 30), lighten(car.color, 10), darken(car.color, 15)
      );
    } else {
      // Car body
      drawVoxelBox(px, py + TILE - h - 2, w, h, d,
        lighten(car.color, 20), car.color, darken(car.color, 30));
      // Roof/windshield
      const roofW = w * 0.5;
      const roofX = px + (w - roofW) / 2;
      drawVoxelBox(roofX, py + TILE - h - 12, roofW, 10, d * 0.7,
        '#aaccee', '#88aacc', '#6688aa');
    }

    // Wheels
    ctx.fillStyle = '#333';
    const wheelY = py + TILE - 5;
    ctx.fillRect(px + 4, wheelY, 7, 5);
    ctx.fillRect(px + w - 11, wheelY, 7, 5);
  }

  function drawLog(lane, log) {
    const s = toScreen(log.x - log.w / 2, lane.y);
    const px = s.x;
    const py = s.y;
    const w = log.w * TILE;
    const d = 8;

    if (log.isLily) {
      // Lily pad - flat circle
      const cx = px + w / 2;
      const cy = py + TILE / 2;
      ctx.fillStyle = PAL.lilyGreen;
      ctx.beginPath();
      ctx.ellipse(cx, cy, TILE * 0.35, TILE * 0.3, 0, 0.2, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = darken(PAL.lilyGreen, 20);
      ctx.beginPath();
      ctx.ellipse(cx, cy, TILE * 0.15, TILE * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Log
      drawVoxelBox(px, py + TILE * 0.3, w, TILE * 0.45, d,
        lighten(PAL.logBrown, 15), PAL.logBrown, PAL.logDarkBrown);
      // Wood grain lines
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < w; i += 12) {
        ctx.fillRect(px + i + 2, py + TILE * 0.35, 1, TILE * 0.35);
      }
      // End circles
      ctx.fillStyle = '#a07040';
      ctx.beginPath();
      ctx.ellipse(px + 3, py + TILE * 0.52, 4, TILE * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(px + w - 3, py + TILE * 0.52, 4, TILE * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTrain(lane) {
    if (!lane.trainActive) return;

    const halfLen = lane.trainLength / 2;
    const s = toScreen(lane.trainX - halfLen, lane.y);
    const px = s.x;
    const py = s.y;
    const w = lane.trainLength * TILE;
    const h = TILE * 1.1;
    const d = 12;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(px - 4, py + TILE - 2, w + 8, 6);

    // Body
    drawVoxelBox(px, py + TILE - h, w, h, d,
      lighten(PAL.trainBody, 10), PAL.trainBody, darken(PAL.trainBody, 30));

    // Red stripe
    ctx.fillStyle = PAL.trainStripe;
    ctx.fillRect(px, py + TILE - h * 0.4, w, h * 0.2);

    // Windows
    ctx.fillStyle = PAL.trainWindow;
    const winW = 14;
    const winH = 10;
    const winY = py + TILE - h + 8;
    for (let wx = px + 12; wx < px + w - 12; wx += 22) {
      ctx.fillRect(wx, winY, winW, winH);
    }

    // Front
    const frontX = lane.direction > 0 ? px + w - 4 : px;
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(frontX, py + TILE - 10, 4, 6);
  }

  function drawChicken() {
    if (player.dead && deathAnim && deathAnim.reason !== 'eagle') return;

    const t = player.hopT;
    const hopHeight = Math.sin(t * Math.PI) * TILE * 0.6;
    const visualX = lerp(player.fromX, player.toX, t);
    const visualY = lerp(player.fromY, player.toY, t);

    const s = toScreen(visualX, visualY);
    const cx = s.x + TILE / 2;
    const base = s.y + TILE - hopHeight;
    const d = 7;

    const squash = player.squash;
    const stretch = 1 + (1 - squash) * 0.5;

    // Shadow (on ground)
    ctx.fillStyle = PAL.shadow;
    const shadowScale = 1 - hopHeight / (TILE * 0.6) * 0.3;
    ctx.beginPath();
    ctx.ellipse(cx, s.y + TILE - 2, 12 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, base);
    ctx.scale(squash, stretch);

    const bodyW = 22;
    const bodyH = 20;

    // Body
    drawVoxelBox(-bodyW / 2, -bodyH - 6, bodyW, bodyH, d,
      lighten(PAL.chickenBody, 10), PAL.chickenBody, darken(PAL.chickenBody, 20));

    // Wings
    const wingFlap = Math.sin(t * Math.PI * 2) * 2;
    ctx.fillStyle = PAL.chickenWing;
    ctx.fillRect(-bodyW / 2 - 4, -bodyH + 2 + wingFlap, 5, 10);
    ctx.fillRect(bodyW / 2 - 1, -bodyH + 2 - wingFlap, 5, 10);

    // Head (on top)
    const headW = 14;
    const headH = 12;
    drawVoxelBox(-headW / 2, -bodyH - headH - 6, headW, headH, d * 0.7,
      lighten(PAL.chickenBody, 15), PAL.chickenBody, darken(PAL.chickenBody, 15));

    // Comb
    ctx.fillStyle = PAL.chickenComb;
    ctx.fillRect(-3, -bodyH - headH - 12, 3, 6);
    ctx.fillRect(0, -bodyH - headH - 14, 3, 8);
    ctx.fillRect(3, -bodyH - headH - 11, 3, 5);

    // Beak
    ctx.fillStyle = PAL.chickenBeak;
    if (player.facing === 3) {
      // Right
      ctx.fillRect(headW / 2, -bodyH - headH + 1, 7, 5);
    } else if (player.facing === 1) {
      // Left
      ctx.fillRect(-headW / 2 - 7, -bodyH - headH + 1, 7, 5);
    } else {
      // Forward or back - centered
      ctx.fillRect(-3, -bodyH - headH + 2, 6, 5);
    }

    // Eyes
    ctx.fillStyle = PAL.chickenEye;
    if (player.facing !== 2) { // Not facing away
      ctx.fillRect(-4, -bodyH - headH + 0, 3, 3);
      ctx.fillRect(2, -bodyH - headH + 0, 3, 3);
    }

    // Feet
    ctx.fillStyle = PAL.chickenBeak;
    ctx.fillRect(-5, -3, 3, 4);
    ctx.fillRect(3, -3, 3, 4);

    ctx.restore();
  }

  function drawCoin(lane, coin) {
    if (coin.collected) return;
    const s = toScreen(coin.x, lane.y);
    const cx = s.x + TILE / 2;
    const cy = s.y + TILE / 2;
    const bob = Math.sin(elapsed * 4 + coin.x) * 4;
    const shimmer = Math.sin(elapsed * 6 + coin.x * 2);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, s.y + TILE - 4, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Coin
    ctx.fillStyle = shimmer > 0 ? PAL.coinShine : PAL.coinGold;
    ctx.beginPath();
    ctx.arc(cx, cy - 8 + bob, 8, 0, Math.PI * 2);
    ctx.fill();

    // Inner circle
    ctx.fillStyle = darken(PAL.coinGold, 30);
    ctx.beginPath();
    ctx.arc(cx, cy - 8 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEagle() {
    if (!eagle) return;
    const t = ease(eagle.t);
    const ex = lerp(eagle.startX, player.x, t);
    const ey = lerp(eagle.startY, player.y, t);
    const s = toScreen(ex, ey);
    const altitude = (1 - t) * 120 + 10;

    const cx = s.x + TILE / 2;
    const cy = s.y + TILE / 2 - altitude;

    const wingSpan = 60;
    const wingFlap = Math.sin(elapsed * 15) * 15;
    const scale = 0.6 + t * 0.6;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Wings
    ctx.fillStyle = PAL.eagleWing;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-wingSpan, -10 + wingFlap);
    ctx.lineTo(-wingSpan * 0.6, 5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(wingSpan, -10 - wingFlap);
    ctx.lineTo(wingSpan * 0.6, 5);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = PAL.eagleBrown;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = PAL.eagleBelly;
    ctx.beginPath();
    ctx.arc(0, -12, 8, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = PAL.chickenBeak;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(6, -8);
    ctx.lineTo(0, -6);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(-3, -14, 2, 2);
    ctx.fillRect(2, -14, 2, 2);

    ctx.restore();

    // Shadow on ground
    const gs = toScreen(ex, ey);
    ctx.fillStyle = `rgba(0,0,0,${0.1 + t * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(gs.x + TILE / 2, gs.y + TILE - 4, 20 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDeathEffect() {
    if (!deathAnim) return;
    const t = deathAnim.t;

    if (deathAnim.reason === 'car' || deathAnim.reason === 'train') {
      // Flattened chicken
      const s = toScreen(deathAnim.x, deathAnim.y);
      const cx = s.x + TILE / 2;
      const cy = s.y + TILE - 4;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t * 0.8);
      ctx.fillStyle = PAL.chickenBody;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PAL.chickenComb;
      ctx.fillRect(cx - 2, cy - 3, 4, 2);
      ctx.restore();
    }

    if (deathAnim.reason === 'water') {
      // Splash rings
      const s = toScreen(deathAnim.x, deathAnim.y);
      const cx = s.x + TILE / 2;
      const cy = s.y + TILE / 2;
      const ringSize = t * 40;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t * 1.5);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ringSize, ringSize * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy, ringSize * 0.6, ringSize * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const s = toScreen(p.x, p.y);
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(s.x + TILE / 2 - p.size / 2, s.y + TILE / 2 - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // ── Main render ──

  function render() {
    // Background - solid grass green (lanes paint over it; sky is above all lanes)
    ctx.fillStyle = PAL.grassDark;
    ctx.fillRect(0, 0, vw, vh);

    const viewMin = Math.floor(camera.y) - 3;
    const viewMax = Math.floor(camera.y) + Math.ceil(vh / TILE) + 3;

    // Draw lanes back to front (high Y first since higher Y = further forward = higher on screen)
    // We iterate from top of screen (high Y) to bottom (low Y)
    for (let y = viewMax; y >= viewMin; y--) {
      const lane = laneMap.get(y);
      if (!lane) continue;
      drawLaneBackground(lane);
    }

    // Collect all drawable objects for depth sorting
    const drawables = [];

    for (let y = viewMax; y >= viewMin; y--) {
      const lane = laneMap.get(y);
      if (!lane) continue;

      // Obstacles
      for (const obs of lane.obstacles) {
        drawables.push({
          sortY: y,
          draw: () => {
            if (obs.kind === 'tree') drawTree(obs.x, lane.y, obs.variant);
            else drawRock(obs.x, lane.y, obs.variant);
          }
        });
      }

      // Cars
      if (lane.type === LANE_TYPE.ROAD) {
        for (const car of lane.entities) {
          drawables.push({ sortY: y, draw: () => drawCar(lane, car) });
        }
      }

      // Logs
      if (lane.type === LANE_TYPE.WATER) {
        for (const log of lane.entities) {
          drawables.push({ sortY: y, draw: () => drawLog(lane, log) });
        }
      }

      // Train
      if (lane.type === LANE_TYPE.RAIL && lane.trainActive) {
        drawables.push({ sortY: y, draw: () => drawTrain(lane) });
      }

      // Coins
      for (const coin of lane.coins) {
        drawables.push({ sortY: y, draw: () => drawCoin(lane, coin) });
      }
    }

    // Player
    const playerVisualY = player.hopT < 1
      ? lerp(player.fromY, player.toY, player.hopT)
      : player.y;
    drawables.push({ sortY: playerVisualY, draw: drawChicken });

    // Sort by Y (lower Y drawn later = in front, since lower Y = closer to viewer)
    drawables.sort((a, b) => b.sortY - a.sortY);
    for (const d of drawables) d.draw();

    drawDeathEffect();
    drawParticles();
    drawEagle();
  }

  // ══════════════════════════════════════
  //  GAME LOOP
  // ══════════════════════════════════════

  function update(dt) {
    elapsed += dt;

    if (gameState === 'playing') {
      processMove();
      updatePlayer(dt);
      updateEntities(dt);
      checkCollisions();
      updateCamera(dt);

      const viewMin = Math.floor(camera.y) - 6;
      const viewMax = Math.floor(camera.y) + Math.ceil(vh / TILE) + 10;
      ensureLanes(viewMin, viewMax);
    }

    if (gameState === 'eagle') {
      updateEagle(dt);
      updateCamera(dt);
    }

    if (gameState === 'dead') {
      updateDeathAnim(dt);
      updateCamera(dt);
    }

    updateParticles(dt);
  }

  function frame(now) {
    const dtRaw = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(dtRaw, 0.05);

    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ══════════════════════════════════════
  //  INPUT
  // ══════════════════════════════════════

  function startGame() {
    if (gameState === 'start') {
      gameState = 'playing';
      startScreen.classList.add('hidden');
      hud.style.display = 'flex';
    }
  }

  function restartGame() {
    laneMap.clear();
    lanes = [];
    player = createPlayer();
    camera.y = 0;
    score = 0;
    sessionCoins = 0;
    idleTimer = 0;
    eagle = null;
    deathAnim = null;
    queuedMoves = [];
    particles = [];

    scoreDisplay.textContent = '0';
    coinDisplay.textContent = '0';
    coinDisplay.style.display = 'none';
    gameOverPanel.classList.add('hidden');

    ensureLanes(-6, 30);
    gameState = 'playing';
  }

  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (gameState === 'start') {
      startGame();
      return;
    }

    if (gameState === 'dead' && (key === 'enter' || key === ' ')) {
      e.preventDefault();
      restartGame();
      return;
    }

    if (key === 'arrowup' || key === 'w' || key === 'z') {
      e.preventDefault();
      tryMove('up');
    } else if (key === 'arrowdown' || key === 's') {
      e.preventDefault();
      tryMove('down');
    } else if (key === 'arrowleft' || key === 'a' || key === 'q') {
      e.preventDefault();
      tryMove('left');
    } else if (key === 'arrowright' || key === 'd') {
      e.preventDefault();
      tryMove('right');
    }
  }, { passive: false });

  // Touch/pointer
  canvas.addEventListener('pointerdown', (e) => {
    if (gameState === 'start') { startGame(); return; }
    swipeStart = { x: e.clientX, y: e.clientY, time: performance.now() };
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    const dist = Math.hypot(dx, dy);
    swipeStart = null;

    if (dist < 15) {
      tryMove('up');
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      tryMove(dx > 0 ? 'right' : 'left');
    } else {
      tryMove(dy < 0 ? 'up' : 'down');
    }
  });

  // Mobile controls
  document.querySelectorAll('.ctrl').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (gameState === 'start') { startGame(); return; }
      const dir = btn.dataset.dir;
      if (dir) tryMove(dir);
    });
  });

  restartBtn.addEventListener('click', restartGame);

  // Start screen click
  startScreen.addEventListener('click', startGame);

  // Keep focus
  window.addEventListener('pointerdown', () => window.focus());

  // ── Boot ──
  function boot() {
    resize();
    window.addEventListener('resize', resize);

    player = createPlayer();
    ensureLanes(-6, 30);

    hud.style.display = 'none';
    scoreDisplay.textContent = '0';

    requestAnimationFrame((now) => {
      lastTime = now;
      requestAnimationFrame(frame);
    });
  }

  boot();
})();
