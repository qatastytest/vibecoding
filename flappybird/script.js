const STORAGE_KEY = "flappybird-best-score";
const GAME_WIDTH = 480;
const GAME_HEIGHT = 720;
const GROUND_HEIGHT = 112;
const CEILING_HEIGHT = 8;
const PIPE_WIDTH = 84;
const PIPE_GAP = 176;
const PIPE_SPEED = 170;
const PIPE_SPAWN_INTERVAL = 1.45;
const GRAVITY = 1450;
const FLAP_VELOCITY = -420;
const MAX_DROP_SPEED = 640;
const BIRD_RADIUS = 18;
const BIRD_X = 140;

const canvas = document.querySelector("#game-canvas");
const canvasFrame = document.querySelector(".canvas-frame");
const context = canvas.getContext("2d");
const readyOverlay = document.querySelector("#ready-overlay");
const playOverlay = document.querySelector("#play-overlay");
const gameoverOverlay = document.querySelector("#gameover-overlay");
const restartButton = document.querySelector("#restart-button");
const scoreValue = document.querySelector("#score-value");
const bestScoreValue = document.querySelector("#best-score-value");
const finalScoreValue = document.querySelector("#final-score-value");
const finalBestScoreValue = document.querySelector("#final-best-score-value");

const state = {
  mode: "ready",
  score: 0,
  bestScore: 0,
  elapsed: 0,
  spawnTimer: 0,
  bird: {
    x: BIRD_X,
    y: GAME_HEIGHT * 0.42,
    velocityY: 0,
    rotation: 0,
    wingPhase: 0,
  },
  pipes: [],
  clouds: [
    { x: 70, y: 105, width: 90, speed: 10 },
    { x: 250, y: 155, width: 70, speed: 14 },
    { x: 390, y: 95, width: 110, speed: 8 },
  ],
  lastFrameTime: performance.now(),
};

function loadBestScore() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    return;
  }
}

function syncScoreUI() {
  scoreValue.textContent = String(state.score);
  bestScoreValue.textContent = String(state.bestScore);
  finalScoreValue.textContent = String(state.score);
  finalBestScoreValue.textContent = String(state.bestScore);
}

function resetRun() {
  state.mode = "ready";
  state.score = 0;
  state.elapsed = 0;
  state.spawnTimer = 0;
  state.pipes = [];
  state.bird.x = BIRD_X;
  state.bird.y = GAME_HEIGHT * 0.42;
  state.bird.velocityY = 0;
  state.bird.rotation = 0;
  state.bird.wingPhase = 0;
  readyOverlay.classList.add("overlay-visible");
  playOverlay.classList.remove("play-overlay-visible");
  gameoverOverlay.classList.remove("overlay-visible");
  syncScoreUI();
}

function startRun() {
  state.mode = "playing";
  state.score = 0;
  state.elapsed = 0;
  state.spawnTimer = 0;
  state.pipes = [];
  state.bird.x = BIRD_X;
  state.bird.y = GAME_HEIGHT * 0.42;
  state.bird.velocityY = FLAP_VELOCITY;
  state.bird.rotation = -0.35;
  state.bird.wingPhase = 0;
  readyOverlay.classList.remove("overlay-visible");
  playOverlay.classList.add("play-overlay-visible");
  gameoverOverlay.classList.remove("overlay-visible");
  syncScoreUI();
}

function flap() {
  state.bird.velocityY = FLAP_VELOCITY;
  state.bird.rotation = -0.45;
}

function endRun() {
  if (state.mode === "gameover") {
    return;
  }

  state.mode = "gameover";
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    saveBestScore(state.bestScore);
  }
  playOverlay.classList.remove("play-overlay-visible");
  syncScoreUI();
  gameoverOverlay.classList.add("overlay-visible");
}

function randomPipeGapY() {
  const minCenter = 180;
  const maxCenter = GAME_HEIGHT - GROUND_HEIGHT - 190;
  return minCenter + Math.random() * (maxCenter - minCenter);
}

function addPipePair() {
  state.pipes.push({
    x: GAME_WIDTH + PIPE_WIDTH,
    gapY: randomPipeGapY(),
    scored: false,
  });
}

function handleInput() {
  if (state.mode === "ready") {
    startRun();
    return;
  }

  if (state.mode === "playing") {
    flap();
    return;
  }

  resetRun();
}

function onPointerInput(event) {
  if (event.target === restartButton) {
    return;
  }

  event.preventDefault();
  handleInput();
}

function onKeyboardInput(event) {
  if (event.code !== "Space") {
    return;
  }

  event.preventDefault();
  handleInput();
}

function updateClouds(deltaTime) {
  state.clouds.forEach((cloud) => {
    cloud.x -= cloud.speed * deltaTime;
    if (cloud.x + cloud.width < -30) {
      cloud.x = GAME_WIDTH + 30;
    }
  });
}

function updatePipes(deltaTime) {
  state.spawnTimer += deltaTime;

  if (state.spawnTimer >= PIPE_SPAWN_INTERVAL) {
    state.spawnTimer = 0;
    addPipePair();
  }

  state.pipes.forEach((pipe) => {
    pipe.x -= PIPE_SPEED * deltaTime;

    if (!pipe.scored && pipe.x + PIPE_WIDTH < state.bird.x) {
      pipe.scored = true;
      state.score += 1;
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
      }
      syncScoreUI();
    }
  });

  state.pipes = state.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -40);
}

function circleRectCollision(circleX, circleY, radius, rectX, rectY, rectWidth, rectHeight) {
  const closestX = Math.max(rectX, Math.min(circleX, rectX + rectWidth));
  const closestY = Math.max(rectY, Math.min(circleY, rectY + rectHeight));
  const deltaX = circleX - closestX;
  const deltaY = circleY - closestY;
  return (deltaX * deltaX) + (deltaY * deltaY) <= radius * radius;
}

function checkCollisions() {
  const birdTop = state.bird.y - BIRD_RADIUS;
  const birdBottom = state.bird.y + BIRD_RADIUS;

  if (birdTop <= CEILING_HEIGHT || birdBottom >= GAME_HEIGHT - GROUND_HEIGHT) {
    endRun();
    return;
  }

  for (const pipe of state.pipes) {
    const topPipeHeight = pipe.gapY - (PIPE_GAP / 2);
    const bottomPipeY = pipe.gapY + (PIPE_GAP / 2);
    const bottomPipeHeight = GAME_HEIGHT - GROUND_HEIGHT - bottomPipeY;

    const hitTopPipe = circleRectCollision(
      state.bird.x,
      state.bird.y,
      BIRD_RADIUS,
      pipe.x,
      0,
      PIPE_WIDTH,
      topPipeHeight
    );

    const hitBottomPipe = circleRectCollision(
      state.bird.x,
      state.bird.y,
      BIRD_RADIUS,
      pipe.x,
      bottomPipeY,
      PIPE_WIDTH,
      bottomPipeHeight
    );

    if (hitTopPipe || hitBottomPipe) {
      endRun();
      return;
    }
  }
}

function updateBird(deltaTime) {
  state.bird.velocityY += GRAVITY * deltaTime;
  state.bird.velocityY = Math.min(state.bird.velocityY, MAX_DROP_SPEED);
  state.bird.y += state.bird.velocityY * deltaTime;
  state.bird.wingPhase += deltaTime * 14;

  const normalizedVelocity = Math.max(-1, Math.min(1, state.bird.velocityY / MAX_DROP_SPEED));
  state.bird.rotation = normalizedVelocity * 0.9;
}

function updateGame(deltaTime) {
  updateClouds(deltaTime);

  if (state.mode !== "playing") {
    state.bird.wingPhase += deltaTime * 3;
    return;
  }

  state.elapsed += deltaTime;
  updateBird(deltaTime);
  updatePipes(deltaTime);
  checkCollisions();
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  gradient.addColorStop(0, "#7cd4ff");
  gradient.addColorStop(1, "#d9f3ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  context.fillStyle = "rgba(255, 255, 255, 0.65)";
  state.clouds.forEach((cloud) => {
    drawCloud(cloud.x, cloud.y, cloud.width);
  });
}

function drawCloud(x, y, width) {
  const radius = width / 4;
  context.beginPath();
  context.arc(x, y, radius * 0.9, Math.PI * 0.5, Math.PI * 1.5);
  context.arc(x + radius * 0.9, y - radius * 0.45, radius, Math.PI, Math.PI * 2);
  context.arc(x + radius * 2, y - radius * 0.25, radius * 1.08, Math.PI, Math.PI * 2);
  context.arc(x + radius * 3.1, y, radius * 0.88, Math.PI * 1.5, Math.PI * 0.5);
  context.closePath();
  context.fill();
}

function drawGround() {
  context.fillStyle = "#cbb870";
  context.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, GROUND_HEIGHT);

  context.fillStyle = "#6daa49";
  context.fillRect(0, GAME_HEIGHT - GROUND_HEIGHT, GAME_WIDTH, 18);

  context.fillStyle = "rgba(82, 61, 18, 0.15)";
  for (let x = 0; x < GAME_WIDTH; x += 24) {
    context.fillRect(x, GAME_HEIGHT - GROUND_HEIGHT + 32, 14, 6);
    context.fillRect(x + 6, GAME_HEIGHT - GROUND_HEIGHT + 62, 18, 7);
  }
}

function drawPipeSegment(x, y, width, height, flipped = false) {
  const bodyColor = "#68ba47";
  const shadingColor = "#4f9a34";
  const lipHeight = 26;

  context.fillStyle = bodyColor;
  context.fillRect(x, y, width, height);

  context.fillStyle = shadingColor;
  context.fillRect(x + width - 14, y, 10, height);

  context.fillStyle = "#78d058";
  context.fillRect(x + 6, y, 8, height);

  const lipY = flipped ? y + height - lipHeight : y;
  context.fillStyle = bodyColor;
  context.fillRect(x - 6, lipY, width + 12, lipHeight);

  context.fillStyle = shadingColor;
  context.fillRect(x + width - 10, lipY, 10, lipHeight);
}

function drawPipes() {
  state.pipes.forEach((pipe) => {
    const topPipeHeight = pipe.gapY - (PIPE_GAP / 2);
    const bottomPipeY = pipe.gapY + (PIPE_GAP / 2);
    const bottomPipeHeight = GAME_HEIGHT - GROUND_HEIGHT - bottomPipeY;

    drawPipeSegment(pipe.x, 0, PIPE_WIDTH, topPipeHeight, true);
    drawPipeSegment(pipe.x, bottomPipeY, PIPE_WIDTH, bottomPipeHeight);
  });
}

function drawBird() {
  context.save();
  context.translate(state.bird.x, state.bird.y);
  context.rotate(state.bird.rotation);

  context.fillStyle = "#ffd34d";
  context.beginPath();
  context.ellipse(0, 0, 22, 17, 0, 0, Math.PI * 2);
  context.fill();

  const wingOffset = Math.sin(state.bird.wingPhase) * 6;
  context.fillStyle = "#f1b636";
  context.beginPath();
  context.ellipse(-5, 4 + wingOffset * 0.2, 11, 7, -0.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f8922b";
  context.beginPath();
  context.moveTo(16, 0);
  context.lineTo(32, -3);
  context.lineTo(16, 8);
  context.closePath();
  context.fill();

  context.fillStyle = "#fff";
  context.beginPath();
  context.arc(6, -6, 5.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#121212";
  context.beginPath();
  context.arc(8, -6, 2.3, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function drawScoreInCanvas() {
  context.fillStyle = "rgba(255, 255, 255, 0.86)";
  context.fillRect(16, 16, 104, 48);
  context.fillStyle = "#12212c";
  context.font = "700 30px Georgia";
  context.textAlign = "left";
  context.fillText(String(state.score), 30, 49);
}

function drawFrame() {
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawBackground();
  drawPipes();
  drawGround();
  drawBird();
  drawScoreInCanvas();
}

function gameLoop(timestamp) {
  const deltaTime = Math.min((timestamp - state.lastFrameTime) / 1000, 0.033);
  state.lastFrameTime = timestamp;
  updateGame(deltaTime);
  drawFrame();
  window.requestAnimationFrame(gameLoop);
}

function init() {
  state.bestScore = loadBestScore();
  syncScoreUI();
  drawFrame();
  window.requestAnimationFrame(gameLoop);
}

canvasFrame.addEventListener("pointerdown", onPointerInput);
window.addEventListener("keydown", onKeyboardInput);
restartButton.addEventListener("click", resetRun);

init();
