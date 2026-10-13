(function () {
  "use strict";

  const COLS = 10;
  const VISIBLE_ROWS = 20;
  const HIDDEN_ROWS = 2;
  const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
  const QUEUE_SIZE = 5;
  const STORAGE_KEY = "codex-tetris-best";

  const COLORS = {
    I: "#38d3ff",
    J: "#4b83ff",
    L: "#ff9f3c",
    O: "#ffe14a",
    S: "#55df7b",
    T: "#bd7cff",
    Z: "#ff5d73"
  };

  const PIECES = {
    I: [
      [0, 0, 0, 0],
      ["I", "I", "I", "I"],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    J: [
      ["J", 0, 0],
      ["J", "J", "J"],
      [0, 0, 0]
    ],
    L: [
      [0, 0, "L"],
      ["L", "L", "L"],
      [0, 0, 0]
    ],
    O: [
      ["O", "O"],
      ["O", "O"]
    ],
    S: [
      [0, "S", "S"],
      ["S", "S", 0],
      [0, 0, 0]
    ],
    T: [
      [0, "T", 0],
      ["T", "T", "T"],
      [0, 0, 0]
    ],
    Z: [
      ["Z", "Z", 0],
      [0, "Z", "Z"],
      [0, 0, 0]
    ]
  };

  const boardCanvas = document.getElementById("board");
  const holdCanvas = document.getElementById("hold");
  const nextCanvases = Array.from(document.querySelectorAll(".next-piece"));
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlayKicker");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayAction = document.getElementById("overlayAction");
  const startButton = document.getElementById("startButton");
  const pauseButton = document.getElementById("pauseButton");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const linesEl = document.getElementById("lines");
  const bestEl = document.getElementById("best");

  const boardCtx = boardCanvas.getContext("2d");
  const holdCtx = holdCanvas.getContext("2d");
  const nextContexts = nextCanvases.map((canvas) => canvas.getContext("2d"));

  let board = createBoard();
  let queue = [];
  let current = null;
  let holdType = null;
  let holdLocked = false;
  let score = 0;
  let level = 1;
  let lines = 0;
  let best = readBest();
  let state = "idle";
  let lastTime = 0;
  let dropCounter = 0;
  let animationFrame = 0;

  const dimensions = {
    boardCell: 0,
    previewCell: 0
  };

  function createBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function cloneMatrix(matrix) {
    return matrix.map((row) => row.slice());
  }

  function shuffledBag() {
    const bag = Object.keys(PIECES);
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  function refillQueue() {
    while (queue.length < QUEUE_SIZE) {
      queue.push(...shuffledBag());
    }
  }

  function makePiece(type) {
    const matrix = cloneMatrix(PIECES[type]);
    return {
      type,
      matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: 0
    };
  }

  function spawnPiece(type) {
    current = makePiece(type || queue.shift());
    refillQueue();
    holdLocked = false;
    if (collides(current, 0, 0, current.matrix)) {
      gameOver();
    }
  }

  function collides(piece, offsetX, offsetY, matrix) {
    for (let y = 0; y < matrix.length; y += 1) {
      for (let x = 0; x < matrix[y].length; x += 1) {
        if (!matrix[y][x]) {
          continue;
        }
        const boardX = piece.x + x + offsetX;
        const boardY = piece.y + y + offsetY;
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
          return true;
        }
        if (boardY >= 0 && board[boardY][boardX]) {
          return true;
        }
      }
    }
    return false;
  }

  function mergePiece() {
    current.matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          const boardY = current.y + y;
          const boardX = current.x + x;
          if (boardY >= 0) {
            board[boardY][boardX] = cell;
          }
        }
      });
    });
  }

  function clearLines() {
    let cleared = 0;
    for (let y = board.length - 1; y >= 0; y -= 1) {
      if (board[y].every(Boolean)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        cleared += 1;
        y += 1;
      }
    }

    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      updateBest();
      syncStats();
    }
  }

  function lockPiece() {
    mergePiece();
    clearLines();
    spawnPiece();
  }

  function move(dx, dy) {
    if (state !== "running" || !current) {
      return false;
    }
    if (!collides(current, dx, dy, current.matrix)) {
      current.x += dx;
      current.y += dy;
      return true;
    }
    if (dy > 0) {
      lockPiece();
    }
    return false;
  }

  function rotateMatrix(matrix, direction) {
    const size = matrix.length;
    const rotated = Array.from({ length: size }, () => Array(size).fill(0));
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (direction > 0) {
          rotated[x][size - 1 - y] = matrix[y][x];
        } else {
          rotated[size - 1 - x][y] = matrix[y][x];
        }
      }
    }
    return rotated;
  }

  function rotate(direction) {
    if (state !== "running" || !current || current.type === "O") {
      return;
    }
    const rotated = rotateMatrix(current.matrix, direction);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collides(current, kick, 0, rotated)) {
        current.x += kick;
        current.matrix = rotated;
        return;
      }
      if (!collides(current, kick, -1, rotated)) {
        current.x += kick;
        current.y -= 1;
        current.matrix = rotated;
        return;
      }
    }
  }

  function hardDrop() {
    if (state !== "running" || !current) {
      return;
    }
    let distance = 0;
    while (!collides(current, 0, 1, current.matrix)) {
      current.y += 1;
      distance += 1;
    }
    score += distance * 2;
    updateBest();
    syncStats();
    lockPiece();
  }

  function softDrop() {
    if (move(0, 1)) {
      score += 1;
      updateBest();
      syncStats();
    }
    dropCounter = 0;
  }

  function holdPiece() {
    if (state !== "running" || !current || holdLocked) {
      return;
    }
    const activeType = current.type;
    if (holdType) {
      current = makePiece(holdType);
      holdType = activeType;
      if (collides(current, 0, 0, current.matrix)) {
        gameOver();
      }
    } else {
      holdType = activeType;
      spawnPiece();
    }
    holdLocked = true;
    drawPreviews();
  }

  function getGhostPiece() {
    if (!current) {
      return null;
    }
    const ghost = {
      type: current.type,
      matrix: current.matrix,
      x: current.x,
      y: current.y
    };
    while (!collides(ghost, 0, 1, ghost.matrix)) {
      ghost.y += 1;
    }
    return ghost;
  }

  function dropInterval() {
    return Math.max(90, 850 - (level - 1) * 58);
  }

  function resetGame() {
    board = createBoard();
    queue = [];
    refillQueue();
    score = 0;
    level = 1;
    lines = 0;
    holdType = null;
    holdLocked = false;
    state = "running";
    dropCounter = 0;
    lastTime = performance.now();
    spawnPiece();
    syncStats();
    syncOverlay();
    draw();
  }

  function pauseGame() {
    if (state === "running") {
      state = "paused";
    } else if (state === "paused") {
      state = "running";
      lastTime = performance.now();
    }
    syncOverlay();
  }

  function gameOver() {
    state = "gameover";
    updateBest();
    syncStats();
    syncOverlay();
  }

  function readBest() {
    try {
      return Number(localStorage.getItem(STORAGE_KEY) || 0);
    } catch (error) {
      return 0;
    }
  }

  function updateBest() {
    if (score <= best) {
      return;
    }
    best = score;
    try {
      localStorage.setItem(STORAGE_KEY, String(best));
    } catch (error) {
      // Storage is optional; the game should still run when unavailable.
    }
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function syncStats() {
    scoreEl.textContent = formatNumber(score);
    levelEl.textContent = formatNumber(level);
    linesEl.textContent = formatNumber(lines);
    bestEl.textContent = formatNumber(best);
  }

  function syncOverlay() {
    const isVisible = state !== "running";
    overlay.hidden = !isVisible;
    pauseButton.disabled = state === "idle" || state === "gameover";

    if (state === "idle") {
      overlayKicker.textContent = "Ready";
      overlayTitle.textContent = "Tetris";
      overlayAction.innerHTML = '<span aria-hidden="true">▶</span><span>Start</span>';
      pauseButton.querySelector("span:last-child").textContent = "Pause";
    } else if (state === "paused") {
      overlayKicker.textContent = "Paused";
      overlayTitle.textContent = "Level " + level;
      overlayAction.innerHTML = '<span aria-hidden="true">▶</span><span>Resume</span>';
      pauseButton.querySelector("span:last-child").textContent = "Resume";
    } else if (state === "gameover") {
      overlayKicker.textContent = "Game over";
      overlayTitle.textContent = formatNumber(score);
      overlayAction.innerHTML = '<span aria-hidden="true">↺</span><span>Restart</span>';
      pauseButton.querySelector("span:last-child").textContent = "Pause";
    } else {
      pauseButton.querySelector("span:last-child").textContent = "Pause";
    }
  }

  function scaleCanvas(canvas, context) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  function resizeCanvases() {
    const boardSize = scaleCanvas(boardCanvas, boardCtx);
    dimensions.boardCell = boardSize.width / COLS;

    const holdSize = scaleCanvas(holdCanvas, holdCtx);
    dimensions.previewCell = Math.min(holdSize.width / 6, holdSize.height / 3.2);

    nextCanvases.forEach((canvas, index) => {
      scaleCanvas(canvas, nextContexts[index]);
    });
    draw();
  }

  function clearCanvas(context, canvas, fill) {
    const rect = canvas.getBoundingClientRect();
    context.clearRect(0, 0, rect.width, rect.height);
    context.fillStyle = fill;
    context.fillRect(0, 0, rect.width, rect.height);
    return rect;
  }

  function shadeColor(hex, amount) {
    const value = Number.parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (value >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((value >> 8) & 255) + amount));
    const b = Math.min(255, Math.max(0, (value & 255) + amount));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function drawBlock(context, x, y, size, type, alpha) {
    const color = COLORS[type];
    const pad = Math.max(1, size * 0.06);
    const innerX = x + pad;
    const innerY = y + pad;
    const innerSize = Math.max(1, size - pad * 2);

    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(innerX, innerY, innerSize, innerSize);
    context.fillStyle = shadeColor(color, 34);
    context.fillRect(innerX, innerY, innerSize, Math.max(2, innerSize * 0.16));
    context.fillRect(innerX, innerY, Math.max(2, innerSize * 0.16), innerSize);
    context.fillStyle = shadeColor(color, -42);
    context.fillRect(innerX, innerY + innerSize * 0.84, innerSize, Math.max(2, innerSize * 0.16));
    context.fillRect(innerX + innerSize * 0.84, innerY, Math.max(2, innerSize * 0.16), innerSize);
    context.restore();
  }

  function drawGrid() {
    const rect = clearCanvas(boardCtx, boardCanvas, "#10141a");
    const cell = dimensions.boardCell;

    boardCtx.strokeStyle = "rgba(255, 255, 255, 0.055)";
    boardCtx.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) {
      boardCtx.beginPath();
      boardCtx.moveTo(x * cell, 0);
      boardCtx.lineTo(x * cell, rect.height);
      boardCtx.stroke();
    }
    for (let y = 0; y <= VISIBLE_ROWS; y += 1) {
      boardCtx.beginPath();
      boardCtx.moveTo(0, y * cell);
      boardCtx.lineTo(rect.width, y * cell);
      boardCtx.stroke();
    }
  }

  function drawMatrix(context, matrix, x, y, cell, alpha) {
    matrix.forEach((row, rowIndex) => {
      row.forEach((type, colIndex) => {
        if (!type) {
          return;
        }
        const visibleY = y + rowIndex - HIDDEN_ROWS;
        if (visibleY < 0) {
          return;
        }
        drawBlock(context, (x + colIndex) * cell, visibleY * cell, cell, type, alpha);
      });
    });
  }

  function drawBoard() {
    drawGrid();
    const cell = dimensions.boardCell;
    board.forEach((row, y) => {
      row.forEach((type, x) => {
        if (type && y >= HIDDEN_ROWS) {
          drawBlock(boardCtx, x * cell, (y - HIDDEN_ROWS) * cell, cell, type, 1);
        }
      });
    });

    const ghost = getGhostPiece();
    if (ghost && state === "running") {
      drawMatrix(boardCtx, ghost.matrix, ghost.x, ghost.y, cell, 0.24);
    }
    if (current) {
      drawMatrix(boardCtx, current.matrix, current.x, current.y, cell, 1);
    }
  }

  function drawPreview(context, canvas, type) {
    const rect = clearCanvas(context, canvas, "#111820");
    if (!type) {
      return;
    }

    const matrix = PIECES[type];
    const rows = matrix.length;
    const cols = matrix[0].length;
    const cell = Math.min(rect.width / 6, rect.height / 3.3);
    const matrixWidth = cols * cell;
    const matrixHeight = rows * cell;
    const originX = (rect.width - matrixWidth) / 2;
    const originY = (rect.height - matrixHeight) / 2;

    matrix.forEach((row, y) => {
      row.forEach((cellType, x) => {
        if (cellType) {
          drawBlock(context, originX + x * cell, originY + y * cell, cell, cellType, 1);
        }
      });
    });
  }

  function drawPreviews() {
    drawPreview(holdCtx, holdCanvas, holdType);
    nextCanvases.forEach((canvas, index) => {
      drawPreview(nextContexts[index], canvas, queue[index]);
    });
  }

  function draw() {
    drawBoard();
    drawPreviews();
  }

  function update(time) {
    const delta = time - lastTime;
    lastTime = time;

    if (state === "running") {
      dropCounter += delta;
      if (dropCounter > dropInterval()) {
        move(0, 1);
        dropCounter = 0;
      }
    }

    draw();
    animationFrame = requestAnimationFrame(update);
  }

  function handleAction(action) {
    if (state === "idle" || state === "gameover") {
      if (action === "start" || action === "drop" || action === "rotate") {
        resetGame();
      }
      return;
    }

    switch (action) {
      case "left":
        move(-1, 0);
        break;
      case "right":
        move(1, 0);
        break;
      case "down":
        softDrop();
        break;
      case "drop":
        hardDrop();
        break;
      case "rotate":
        rotate(1);
        break;
      case "rotateBack":
        rotate(-1);
        break;
      case "hold":
        holdPiece();
        break;
      case "pause":
        pauseGame();
        break;
      case "start":
        resetGame();
        break;
      default:
        break;
    }
  }

  function bindButtons() {
    startButton.addEventListener("click", () => handleAction("start"));
    pauseButton.addEventListener("click", () => handleAction("pause"));
    overlayAction.addEventListener("click", () => {
      if (state === "paused") {
        pauseGame();
      } else {
        resetGame();
      }
    });

    document.querySelectorAll("[data-action]").forEach((button) => {
      const action = button.dataset.action;
      let repeatTimer = 0;
      let repeatDelay = 0;
      const repeatable = action === "left" || action === "right" || action === "down";

      const stopRepeat = () => {
        clearTimeout(repeatDelay);
        clearInterval(repeatTimer);
        repeatDelay = 0;
        repeatTimer = 0;
      };

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        handleAction(action);
        if (repeatable) {
          repeatDelay = window.setTimeout(() => {
            repeatTimer = window.setInterval(() => handleAction(action), action === "down" ? 55 : 85);
          }, 180);
        }
      });
      button.addEventListener("pointerup", stopRepeat);
      button.addEventListener("pointercancel", stopRepeat);
      button.addEventListener("lostpointercapture", stopRepeat);
    });
  }

  function bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      const keys = [
        "ArrowLeft",
        "ArrowRight",
        "ArrowDown",
        "ArrowUp",
        "KeyA",
        "KeyD",
        "KeyS",
        "KeyW",
        " ",
        "Spacebar",
        "KeyZ",
        "KeyX",
        "KeyC",
        "ShiftLeft",
        "ShiftRight",
        "KeyP",
        "Escape",
        "Enter"
      ];
      if (keys.includes(event.code) || keys.includes(event.key)) {
        event.preventDefault();
      }

      switch (event.code) {
        case "ArrowLeft":
        case "KeyA":
          handleAction("left");
          break;
        case "ArrowRight":
        case "KeyD":
          handleAction("right");
          break;
        case "ArrowDown":
        case "KeyS":
          handleAction("down");
          break;
        case "ArrowUp":
        case "KeyW":
        case "KeyX":
          handleAction("rotate");
          break;
        case "KeyZ":
          handleAction("rotateBack");
          break;
        case "Space":
          handleAction("drop");
          break;
        case "KeyC":
        case "ShiftLeft":
        case "ShiftRight":
          handleAction("hold");
          break;
        case "KeyP":
        case "Escape":
          handleAction("pause");
          break;
        case "Enter":
          if (state === "idle" || state === "gameover") {
            handleAction("start");
          } else if (state === "paused") {
            handleAction("pause");
          }
          break;
        default:
          break;
      }
    });
  }

  function init() {
    refillQueue();
    syncStats();
    syncOverlay();
    bindButtons();
    bindKeyboard();
    resizeCanvases();
    window.addEventListener("resize", resizeCanvases);
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(update);
  }

  window.addEventListener("beforeunload", () => {
    cancelAnimationFrame(animationFrame);
  });

  init();
})();
