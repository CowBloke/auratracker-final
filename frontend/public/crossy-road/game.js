(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreValue = document.getElementById('scoreValue');
  const bestValue = document.getElementById('bestValue');
  const finalScore = document.getElementById('finalScore');
  const gameOverPanel = document.getElementById('gameOverPanel');
  const restartBtn = document.getElementById('restartBtn');
  const hint = document.getElementById('hint');

  const STORAGE_KEY = 'auratracker-crossy-road-best';

  const TILE_W = 66;
  const TILE_H = 34;
  const LAYER_H = 26;
  const WORLD_HALF_WIDTH = 5;
  const START_Y = 0;

  const OFFSCREEN_TOP_MARGIN = 14;
  const OFFSCREEN_BOTTOM_MARGIN = 12;

  const PLAYER_HOP_MS = 160;
  const PLAYER_SIZE = 0.68;

  const LANE = {
    GRASS: 'grass',
    ROAD: 'road',
    WATER: 'water',
    RAIL: 'rail',
  };

  const COLORS = {
    skyTop: '#152739',
    skyBottom: '#080b10',
    shadow: 'rgba(0, 0, 0, 0.25)',
    grassA: '#4aa64a',
    grassB: '#3f9441',
    roadA: '#3d3f46',
    roadB: '#33363c',
    waterA: '#397fc0',
    waterB: '#2f6ea6',
    railA: '#6f6f74',
    railB: '#5d5d61',
    line: '#f6f06f',
    laneEdge: '#1f252f',
    log: '#8b5a2f',
    logDark: '#65401f',
    train: '#f4f6fc',
    trainStripe: '#e83d52',
    carPalette: ['#f15b4c', '#f5a623', '#4ecdc4', '#7b6ff5', '#f54291', '#50d890', '#ffe66d'],
    chickenBody: '#f5f5ed',
    chickenWing: '#dfdfd2',
    chickenBeak: '#ffb141',
    chickenComb: '#e14d58',
    obstacleTree: '#2e6f37',
    obstacleRock: '#a1a1ad',
    riverFoam: 'rgba(255, 255, 255, 0.35)',
    dangerLine: '#ff5b5b',
  };

  let viewportW = 0;
  let viewportH = 0;

  let camera = {
    x: 0,
    y: START_Y,
  };

  let laneByY = new Map();
  let minGeneratedY = -16;
  let maxGeneratedY = 80;

  let player;
  let queuedMoves = [];
  let score = 0;
  let bestScore = Number.parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
  let gameState = 'running';

  let lastFrameTime = performance.now();
  let elapsed = 0;

  let swipeStart = null;

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function laneTypeForY(y) {
    if (y <= 0) return LANE.GRASS;

    const wave = (Math.sin(y * 0.37) + 1) * 0.5;
    const waterChance = clamp((y - 10) / 90, 0.05, 0.22);
    const railChance = clamp((y - 20) / 220, 0.02, 0.08);
    const roadChance = 0.44 + wave * 0.2;
    const r = Math.random();

    if (r < railChance) return LANE.RAIL;
    if (r < railChance + waterChance) return LANE.WATER;
    if (r < railChance + waterChance + roadChance) return LANE.ROAD;
    return LANE.GRASS;
  }

  function createLane(y) {
    const type = laneTypeForY(y);
    const lane = {
      y,
      type,
      entities: [],
      obstacles: [],
      direction: Math.random() < 0.5 ? -1 : 1,
      speed: 0,
      trainTimer: rand(4.8, 10.5),
      trainActive: false,
      trainCooldown: 0,
      trainLength: 0,
      trainX: 0,
    };

    if (type === LANE.ROAD) {
      lane.speed = rand(1.5, 4.2) * lane.direction;
      const density = y < 20 ? 2 : y < 45 ? 3 : 4;
      for (let i = 0; i < density; i += 1) {
        lane.entities.push({
          x: rand(-WORLD_HALF_WIDTH - 8, WORLD_HALF_WIDTH + 8),
          width: Math.random() < 0.26 ? 1.65 : 1.2,
          color: pick(COLORS.carPalette),
        });
      }
    } else if (type === LANE.WATER) {
      lane.speed = rand(0.9, 2.1) * lane.direction;
      const count = 2 + Math.floor(rand(0, 3));
      for (let i = 0; i < count; i += 1) {
        lane.entities.push({
          x: rand(-WORLD_HALF_WIDTH - 8, WORLD_HALF_WIDTH + 8),
          width: Math.random() < 0.45 ? 2.4 : 1.7,
          color: Math.random() < 0.5 ? COLORS.log : COLORS.logDark,
        });
      }
    } else if (type === LANE.RAIL) {
      lane.speed = 9.2 * lane.direction;
      lane.trainTimer = rand(5.8, 11.2);
    } else {
      const obstacleCount = Math.random() < 0.45 ? 1 : Math.random() < 0.12 ? 2 : 0;
      const used = new Set();
      for (let i = 0; i < obstacleCount; i += 1) {
        const ox = Math.floor(rand(-WORLD_HALF_WIDTH, WORLD_HALF_WIDTH + 1));
        if (ox === 0 || used.has(ox)) continue;
        used.add(ox);
        lane.obstacles.push({
          x: ox,
          kind: Math.random() < 0.7 ? 'tree' : 'rock',
        });
      }
    }

    return lane;
  }

  function ensureWorldRange(minY, maxY) {
    for (let y = minY; y <= maxY; y += 1) {
      if (!laneByY.has(y)) {
        laneByY.set(y, createLane(y));
      }
    }

    minGeneratedY = Math.min(minGeneratedY, minY);
    maxGeneratedY = Math.max(maxGeneratedY, maxY);

    for (const key of Array.from(laneByY.keys())) {
      if (key < minY - 6 || key > maxY + 12) {
        laneByY.delete(key);
      }
    }
  }

  function resetPlayer() {
    player = {
      x: 0,
      y: START_Y,
      fromX: 0,
      fromY: START_Y,
      toX: 0,
      toY: START_Y,
      hopProgress: 1,
      hopElapsed: PLAYER_HOP_MS,
      dead: false,
      deathReason: '',
      onLog: null,
      maxRow: START_Y,
    };
  }

  function resetGame() {
    laneByY = new Map();
    minGeneratedY = -16;
    maxGeneratedY = 80;
    ensureWorldRange(minGeneratedY, maxGeneratedY);
    resetPlayer();
    queuedMoves = [];
    score = 0;
    camera.x = 0;
    camera.y = START_Y;
    gameState = 'running';
    elapsed = 0;
    gameOverPanel.classList.add('hidden');
    hint.classList.remove('hidden');
    updateHud();
  }

  function updateHud() {
    scoreValue.textContent = String(score);
    bestValue.textContent = String(bestScore);
  }

  function isoToScreen(wx, wy, wz) {
    const dx = wx - camera.x;
    const dy = wy - camera.y;

    return {
      x: viewportW * 0.5 + (dx - dy) * (TILE_W * 0.5),
      y: viewportH * 0.56 + (dx + dy) * (TILE_H * 0.5) - wz,
    };
  }

  function drawDiamond(wx, wy, color, alpha = 1) {
    const c = isoToScreen(wx, wy, 0);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - TILE_H * 0.5);
    ctx.lineTo(c.x + TILE_W * 0.5, c.y);
    ctx.lineTo(c.x, c.y + TILE_H * 0.5);
    ctx.lineTo(c.x - TILE_W * 0.5, c.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawLaneBase(lane) {
    for (let x = -WORLD_HALF_WIDTH; x <= WORLD_HALF_WIDTH; x += 1) {
      let colorA = COLORS.grassA;
      let colorB = COLORS.grassB;

      if (lane.type === LANE.ROAD) {
        colorA = COLORS.roadA;
        colorB = COLORS.roadB;
      } else if (lane.type === LANE.WATER) {
        colorA = COLORS.waterA;
        colorB = COLORS.waterB;
      } else if (lane.type === LANE.RAIL) {
        colorA = COLORS.railA;
        colorB = COLORS.railB;
      }

      drawDiamond(x, lane.y, (x + lane.y) % 2 === 0 ? colorA : colorB);
    }

    if (lane.type === LANE.ROAD) {
      const lineY = lane.y + 0.5;
      for (let x = -WORLD_HALF_WIDTH; x < WORLD_HALF_WIDTH; x += 2) {
        const p = isoToScreen(x + 0.5, lineY, 1);
        const q = isoToScreen(x + 1.3, lineY, 1);
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }

    if (lane.type === LANE.RAIL) {
      const leftA = isoToScreen(-WORLD_HALF_WIDTH, lane.y + 0.35, 1);
      const rightA = isoToScreen(WORLD_HALF_WIDTH + 1, lane.y + 0.35, 1);
      const leftB = isoToScreen(-WORLD_HALF_WIDTH, lane.y + 0.65, 1);
      const rightB = isoToScreen(WORLD_HALF_WIDTH + 1, lane.y + 0.65, 1);

      ctx.strokeStyle = '#c8c9d0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(leftA.x, leftA.y);
      ctx.lineTo(rightA.x, rightA.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(leftB.x, leftB.y);
      ctx.lineTo(rightB.x, rightB.y);
      ctx.stroke();

      for (let x = -WORLD_HALF_WIDTH; x <= WORLD_HALF_WIDTH; x += 1) {
        const s = isoToScreen(x + 0.15, lane.y + 0.35, 0.5);
        const e = isoToScreen(x + 0.45, lane.y + 0.65, 0.5);
        ctx.strokeStyle = '#8d8f95';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
      }

      if (!lane.trainActive && lane.trainTimer < 1.2) {
        const warning = Math.sin(elapsed * 16) > 0 ? '#ff3939' : '#ffd1d1';
        const markerL = isoToScreen(-WORLD_HALF_WIDTH, lane.y + 0.5, 4);
        const markerR = isoToScreen(WORLD_HALF_WIDTH + 1, lane.y + 0.5, 4);
        ctx.strokeStyle = warning;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(markerL.x, markerL.y);
        ctx.lineTo(markerR.x, markerR.y);
        ctx.stroke();
      }
    }

    if (lane.type === LANE.WATER) {
      const foamOffset = ((elapsed * lane.speed * 0.7) % 2 + 2) % 2;
      for (let x = -WORLD_HALF_WIDTH - 1; x <= WORLD_HALF_WIDTH + 1; x += 2) {
        const p = isoToScreen(x + foamOffset, lane.y + 0.45, 1);
        const q = isoToScreen(x + 0.8 + foamOffset, lane.y + 0.52, 1);
        ctx.strokeStyle = COLORS.riverFoam;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }
  }

  function drawObstacle(lane, obstacle) {
    const base = isoToScreen(obstacle.x + 0.5, lane.y + 0.5, 0);
    if (obstacle.kind === 'tree') {
      ctx.fillStyle = '#7a4e27';
      ctx.fillRect(base.x - 4, base.y - 20, 8, 16);
      ctx.beginPath();
      ctx.fillStyle = COLORS.obstacleTree;
      ctx.arc(base.x, base.y - 26, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(base.x - 8, base.y - 18, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(base.x + 8, base.y - 18, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.fillStyle = COLORS.obstacleRock;
      ctx.ellipse(base.x, base.y - 8, 12, 9, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#7f7f89';
      ctx.ellipse(base.x + 2, base.y - 10, 5, 3.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(lane, car) {
    const center = isoToScreen(car.x, lane.y + 0.5, 0);
    const pixelWidth = Math.max(28, car.width * TILE_W * 0.38);
    const pixelHeight = 14;

    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 11, pixelWidth * 0.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = car.color;
    ctx.fillRect(center.x - pixelWidth * 0.5, center.y - pixelHeight, pixelWidth, pixelHeight);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(center.x - pixelWidth * 0.23, center.y - pixelHeight + 2, pixelWidth * 0.46, 5);

    const wheelY = center.y + 1;
    ctx.fillStyle = '#202126';
    ctx.fillRect(center.x - pixelWidth * 0.38, wheelY, 6, 4);
    ctx.fillRect(center.x + pixelWidth * 0.32, wheelY, 6, 4);
  }

  function drawLog(lane, log) {
    const center = isoToScreen(log.x, lane.y + 0.5, 0);
    const pixelWidth = Math.max(42, log.width * TILE_W * 0.42);

    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 9, pixelWidth * 0.48, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = log.color;
    ctx.fillRect(center.x - pixelWidth * 0.5, center.y - 9, pixelWidth, 12);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fillRect(center.x - pixelWidth * 0.5 + 5, center.y - 7, pixelWidth - 10, 3);
  }

  function drawTrain(lane) {
    if (!lane.trainActive) return;

    const trainCenterX = lane.trainX + lane.direction * lane.trainLength * 0.5;
    const center = isoToScreen(trainCenterX, lane.y + 0.5, 0);
    const pixelWidth = Math.max(100, lane.trainLength * TILE_W * 0.44);

    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 14, pixelWidth * 0.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.train;
    ctx.fillRect(center.x - pixelWidth * 0.5, center.y - 16, pixelWidth, 20);

    ctx.fillStyle = COLORS.trainStripe;
    ctx.fillRect(center.x - pixelWidth * 0.5, center.y - 6, pixelWidth, 6);

    ctx.fillStyle = '#2f3f63';
    for (let i = 0; i < 4; i += 1) {
      const sx = center.x - pixelWidth * 0.38 + i * (pixelWidth * 0.22);
      ctx.fillRect(sx, center.y - 13, pixelWidth * 0.12, 6);
    }
  }

  function drawPlayer() {
    const hopHeight = Math.sin(player.hopProgress * Math.PI) * 18;
    const visualX = player.fromX + (player.toX - player.fromX) * player.hopProgress;
    const visualY = player.fromY + (player.toY - player.fromY) * player.hopProgress;

    const center = isoToScreen(visualX + 0.5, visualY + 0.5, hopHeight);

    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 11, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.chickenBody;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y - 3, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.chickenWing;
    ctx.beginPath();
    ctx.ellipse(center.x - 6, center.y - 2, 4, 6, -0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(center.x + 6, center.y - 2, 4, 6, 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.chickenComb;
    ctx.fillRect(center.x - 3, center.y - 17, 2, 4);
    ctx.fillRect(center.x, center.y - 18, 2, 5);
    ctx.fillRect(center.x + 3, center.y - 17, 2, 4);

    ctx.fillStyle = COLORS.chickenBeak;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - 8);
    ctx.lineTo(center.x + 8, center.y - 5);
    ctx.lineTo(center.x, center.y - 2);
    ctx.closePath();
    ctx.fill();
  }

  function laneFromY(y) {
    return laneByY.get(Math.round(y));
  }

  function isObstacleAt(x, y) {
    const lane = laneByY.get(y);
    if (!lane || lane.obstacles.length === 0) return false;
    return lane.obstacles.some((ob) => ob.x === x);
  }

  function enqueueMove(dir) {
    if (gameState !== 'running') return;
    if (queuedMoves.length > 2) return;
    queuedMoves.push(dir);
    hint.classList.add('hidden');
  }

  function applyQueuedMove() {
    if (player.hopProgress < 1) return;
    if (queuedMoves.length === 0) return;

    const dir = queuedMoves.shift();
    const step = {
      up: { x: 0, y: 1 },
      down: { x: 0, y: -1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    }[dir];

    const targetX = player.x + step.x;
    const targetY = player.y + step.y;

    if (targetX < -WORLD_HALF_WIDTH || targetX > WORLD_HALF_WIDTH) {
      return;
    }

    if (targetY < Math.floor(camera.y) - 2) {
      return;
    }

    if (isObstacleAt(targetX, targetY)) {
      return;
    }

    player.fromX = player.x;
    player.fromY = player.y;
    player.toX = targetX;
    player.toY = targetY;
    player.hopElapsed = 0;
    player.hopProgress = 0;
    player.onLog = null;
  }

  function killPlayer(reason) {
    if (player.dead) return;

    player.dead = true;
    player.deathReason = reason;
    gameState = 'game-over';
    finalScore.textContent = String(score);
    gameOverPanel.classList.remove('hidden');

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(STORAGE_KEY, String(bestScore));
      updateHud();
    }
  }

  function updatePlayer(dt) {
    if (player.dead) return;

    if (player.hopProgress < 1) {
      player.hopElapsed += dt * 1000;
      player.hopProgress = clamp(player.hopElapsed / PLAYER_HOP_MS, 0, 1);
      if (player.hopProgress >= 1) {
        player.x = player.toX;
        player.y = player.toY;
        if (player.y > player.maxRow) {
          player.maxRow = player.y;
          score = player.maxRow - START_Y;
          updateHud();
        }
      }
    }

    if (player.hopProgress >= 1) {
      const lane = laneFromY(player.y);
      if (!lane) return;

      if (lane.type === LANE.WATER) {
        let onAnyLog = null;
        for (const log of lane.entities) {
          if (Math.abs(player.x + 0.5 - log.x) <= log.width * 0.5) {
            onAnyLog = log;
            break;
          }
        }

        if (!onAnyLog) {
          killPlayer('water');
          return;
        }

        const drift = lane.speed * dt;
        player.x += drift;
        player.fromX += drift;
        player.toX += drift;

        if (player.x < -WORLD_HALF_WIDTH - 0.48 || player.x > WORLD_HALF_WIDTH + 0.48) {
          killPlayer('water');
          return;
        }
      }
    }

    const safeLine = player.maxRow - 8;
    if (player.y < safeLine) {
      killPlayer('eagle');
    }
  }

  function updateLaneEntities(lane, dt) {
    if (lane.type === LANE.ROAD || lane.type === LANE.WATER) {
      for (const e of lane.entities) {
        e.x += lane.speed * dt;

        const minX = -WORLD_HALF_WIDTH - 10;
        const maxX = WORLD_HALF_WIDTH + 10;
        if (lane.direction > 0 && e.x - e.width * 0.5 > maxX) {
          e.x = minX - e.width;
        } else if (lane.direction < 0 && e.x + e.width * 0.5 < minX) {
          e.x = maxX + e.width;
        }
      }
    }

    if (lane.type === LANE.RAIL) {
      if (lane.trainActive) {
        lane.trainX += lane.speed * dt;

        const minX = -WORLD_HALF_WIDTH - 18;
        const maxX = WORLD_HALF_WIDTH + 18;
        if ((lane.direction > 0 && lane.trainX > maxX) || (lane.direction < 0 && lane.trainX < minX)) {
          lane.trainActive = false;
          lane.trainCooldown = rand(4.6, 10.8);
          lane.trainTimer = lane.trainCooldown;
        }
      } else {
        lane.trainTimer -= dt;
        if (lane.trainTimer <= 0) {
          lane.trainActive = true;
          lane.trainLength = rand(3.8, 5.8);
          lane.trainX = lane.direction > 0 ? -WORLD_HALF_WIDTH - 15 : WORLD_HALF_WIDTH + 15;
        }
      }
    }
  }

  function checkCollisions() {
    if (player.dead) return;

    const py = player.fromY + (player.toY - player.fromY) * player.hopProgress;
    const px = player.fromX + (player.toX - player.fromX) * player.hopProgress;

    const lane = laneByY.get(Math.round(py));
    if (!lane) return;

    if (lane.type === LANE.ROAD) {
      for (const car of lane.entities) {
        const dx = Math.abs(px + 0.5 - car.x);
        if (dx < car.width * 0.45 + PLAYER_SIZE * 0.32 && player.hopProgress > 0.2) {
          killPlayer('car');
          return;
        }
      }
    }

    if (lane.type === LANE.RAIL && lane.trainActive) {
      const trainCenterX = lane.trainX + lane.direction * lane.trainLength * 0.5;
      const dx = Math.abs(px + 0.5 - trainCenterX);
      if (dx < lane.trainLength * 0.5 + PLAYER_SIZE * 0.35) {
        killPlayer('train');
      }
    }
  }

  function updateCamera(dt) {
    const targetY = player.y - 2;
    camera.y += (targetY - camera.y) * clamp(dt * 6.5, 0, 1);

    const targetX = player.x * 0.18;
    camera.x += (targetX - camera.x) * clamp(dt * 5, 0, 1);

    const minY = Math.floor(camera.y) - OFFSCREEN_BOTTOM_MARGIN;
    const maxY = Math.floor(camera.y) + OFFSCREEN_TOP_MARGIN;
    ensureWorldRange(minY, maxY + 26);
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, viewportH);
    grad.addColorStop(0, COLORS.skyTop);
    grad.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewportW, viewportH);
  }

  function drawDangerLine() {
    const dangerWorldY = player.maxRow - 8 + 0.15;
    const a = isoToScreen(-WORLD_HALF_WIDTH - 1, dangerWorldY, 2);
    const b = isoToScreen(WORLD_HALF_WIDTH + 2, dangerWorldY, 2);

    ctx.strokeStyle = COLORS.dangerLine;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function render() {
    drawBackground();

    const visibleMinY = Math.floor(camera.y) - OFFSCREEN_BOTTOM_MARGIN;
    const visibleMaxY = Math.floor(camera.y) + OFFSCREEN_TOP_MARGIN;

    for (let y = visibleMinY; y <= visibleMaxY; y += 1) {
      const lane = laneByY.get(y);
      if (lane) drawLaneBase(lane);
    }

    const objects = [];

    for (let y = visibleMinY; y <= visibleMaxY; y += 1) {
      const lane = laneByY.get(y);
      if (!lane) continue;

      for (const obstacle of lane.obstacles) {
        objects.push({ sortY: y + 0.95, draw: () => drawObstacle(lane, obstacle) });
      }

      if (lane.type === LANE.ROAD) {
        for (const car of lane.entities) {
          objects.push({ sortY: y + 0.7, draw: () => drawCar(lane, car) });
        }
      }

      if (lane.type === LANE.WATER) {
        for (const log of lane.entities) {
          objects.push({ sortY: y + 0.67, draw: () => drawLog(lane, log) });
        }
      }

      if (lane.type === LANE.RAIL && lane.trainActive) {
        objects.push({ sortY: y + 0.72, draw: () => drawTrain(lane) });
      }
    }

    const playerSortY = player.fromY + (player.toY - player.fromY) * player.hopProgress + 0.84;
    objects.push({ sortY: playerSortY, draw: drawPlayer });

    objects.sort((a, b) => a.sortY - b.sortY);
    for (const object of objects) {
      object.draw();
    }

    drawDangerLine();
  }

  function update(dt) {
    if (gameState !== 'running') return;

    for (const lane of laneByY.values()) {
      updateLaneEntities(lane, dt);
    }

    applyQueuedMove();
    updatePlayer(dt);
    checkCollisions();
    updateCamera(dt);
  }

  function frame(now) {
    const dtRaw = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    const dt = Math.min(0.05, dtRaw);

    elapsed += dt;
    update(dt);
    render();

    requestAnimationFrame(frame);
  }

  function setCanvasSize() {
    const ratio = window.devicePixelRatio || 1;
    viewportW = window.innerWidth;
    viewportH = window.innerHeight;
    canvas.width = Math.floor(viewportW * ratio);
    canvas.height = Math.floor(viewportH * ratio);
    canvas.style.width = `${viewportW}px`;
    canvas.style.height = `${viewportH}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();

    if (gameState === 'game-over' && (key === 'enter' || key === ' ')) {
      event.preventDefault();
      resetGame();
      return;
    }

    if (key === 'arrowup' || key === 'w' || key === 'z') {
      event.preventDefault();
      enqueueMove('up');
    } else if (key === 'arrowdown' || key === 's') {
      event.preventDefault();
      enqueueMove('down');
    } else if (key === 'arrowleft' || key === 'a' || key === 'q') {
      event.preventDefault();
      enqueueMove('left');
    } else if (key === 'arrowright' || key === 'd') {
      event.preventDefault();
      enqueueMove('right');
    }
  }

  function setupPointerControls() {
    canvas.addEventListener('pointerdown', (event) => {
      swipeStart = { x: event.clientX, y: event.clientY };
    });

    canvas.addEventListener('pointerup', (event) => {
      if (!swipeStart) return;
      const dx = event.clientX - swipeStart.x;
      const dy = event.clientY - swipeStart.y;
      swipeStart = null;

      if (Math.hypot(dx, dy) < 20) {
        enqueueMove('up');
        return;
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        enqueueMove(dx > 0 ? 'right' : 'left');
      } else {
        enqueueMove(dy > 0 ? 'down' : 'up');
      }
    });

    document.querySelectorAll('.ctrl').forEach((button) => {
      button.addEventListener('click', () => {
        const dir = button.getAttribute('data-dir');
        if (dir) enqueueMove(dir);
      });
    });
  }

  function setupUiEvents() {
    restartBtn.addEventListener('click', resetGame);
    window.addEventListener('resize', setCanvasSize);
    window.addEventListener('keydown', onKeyDown, { passive: false });

    // Keep keyboard focus inside iframe so directional keys work immediately.
    window.addEventListener('pointerdown', () => {
      window.focus();
    });
  }

  function boot() {
    setCanvasSize();
    setupUiEvents();
    setupPointerControls();
    updateHud();
    resetGame();
    requestAnimationFrame((time) => {
      lastFrameTime = time;
      requestAnimationFrame(frame);
    });
  }

  boot();
})();
