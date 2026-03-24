const STORAGE_KEY = "flappybird-best-score";
const MUTE_STORAGE_KEY = "flappybird-muted";
const GAME_WIDTH = 480;
const GAME_HEIGHT = 720;
const GROUND_HEIGHT = 112;
const CEILING_HEIGHT = 8;
const PIPE_WIDTH = 84;
const BASE_PIPE_GAP = 176;
const MIN_PIPE_GAP = 146;
const BASE_PIPE_SPEED = 170;
const MAX_PIPE_SPEED = 225;
const BASE_PIPE_SPAWN_INTERVAL = 1.45;
const MIN_PIPE_SPAWN_INTERVAL = 1.08;
const GRAVITY = 1450;
const FLAP_VELOCITY = -420;
const MAX_DROP_SPEED = 640;
const BIRD_RADIUS = 18;
const BIRD_X = 140;
const ENEMY_RADIUS = 16;
const ENEMY_SPAWN_SCORE_THRESHOLD = 12;
const BASE_ENEMY_SPAWN_INTERVAL = 5.2;
const MIN_ENEMY_SPAWN_INTERVAL = 3.1;
const ENEMY_WARNING_TIME = 0.9;

const canvas = document.querySelector("#game-canvas");
const canvasFrame = document.querySelector(".canvas-frame");
const context = canvas.getContext("2d");
const readyOverlay = document.querySelector("#ready-overlay");
const playOverlay = document.querySelector("#play-overlay");
const gameoverOverlay = document.querySelector("#gameover-overlay");
const restartButton = document.querySelector("#restart-button");
const muteButton = document.querySelector("#mute-button");
const muteIndicator = document.querySelector("#mute-indicator");
const muteLabel = document.querySelector("#mute-label");
const scorePill = document.querySelector("#score-pill");
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
  enemySpawnTimer: 0,
  bird: {
    x: BIRD_X,
    y: GAME_HEIGHT * 0.42,
    velocityY: 0,
    rotation: 0,
    wingPhase: 0,
  },
  pipes: [],
  enemies: [],
  particles: [],
  scorePulse: 0,
  shakeTime: 0,
  shakeStrength: 0,
  muted: false,
  clouds: [
    { x: 70, y: 105, width: 90, speed: 10 },
    { x: 250, y: 155, width: 70, speed: 14 },
    { x: 390, y: 95, width: 110, speed: 8 },
  ],
  lastFrameTime: performance.now(),
};

const audioState = {
  context: null,
  unlocked: false,
  resumePromise: null,
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

function loadMutedPreference() {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveMutedPreference(value) {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  } catch {
    return;
  }
}

function syncMuteUI() {
  muteLabel.textContent = state.muted ? "Sound Off" : "Sound On";
  muteIndicator.textContent = state.muted ? "x" : "))";
  muteButton.classList.toggle("muted", state.muted);
  muteButton.setAttribute("aria-pressed", String(!state.muted));
}

function ensureAudioContext() {
  if (audioState.context) {
    return audioState.context;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  audioState.context = new AudioContextClass();
  return audioState.context;
}

function unlockAudio() {
  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return Promise.resolve();
  }

  if (audioContext.state === "running") {
    audioState.unlocked = true;
    return Promise.resolve();
  }

  if (!audioState.resumePromise) {
    audioState.resumePromise = audioContext.resume()
      .then(() => {
        audioState.unlocked = true;
      })
      .catch(() => {})
      .finally(() => {
        audioState.resumePromise = null;
      });
  }

  return audioState.resumePromise;
}

function playTone({ frequency, duration, type = "sine", volume = 0.04, frequencyEnd = frequency }) {
  if (state.muted) {
    return;
  }

  const audioContext = ensureAudioContext();
  if (!audioContext) {
    return;
  }

  if (audioContext.state !== "running") {
    unlockAudio().then(() => {
      if (audioContext.state === "running" && !state.muted) {
        playTone({ frequency, duration, type, volume, frequencyEnd });
      }
    });
    return;
  }

  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(frequencyEnd, 1), now + duration);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(volume, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playFlapSound() {
  playTone({ frequency: 420, frequencyEnd: 320, duration: 0.08, type: "triangle", volume: 0.03 });
}

function playScoreSound() {
  playTone({ frequency: 640, frequencyEnd: 860, duration: 0.11, type: "sine", volume: 0.04 });
}

function playHitSound() {
  playTone({ frequency: 180, frequencyEnd: 90, duration: 0.18, type: "square", volume: 0.05 });
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
  state.enemySpawnTimer = 0;
  state.pipes = [];
  state.enemies = [];
  state.particles = [];
  state.scorePulse = 0;
  state.shakeTime = 0;
  state.shakeStrength = 0;
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
  state.enemySpawnTimer = 0;
  state.pipes = [];
  state.enemies = [];
  state.particles = [];
  state.scorePulse = 0;
  state.shakeTime = 0;
  state.shakeStrength = 0;
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
  spawnFlapParticles();
  playFlapSound();
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
  triggerScreenShake(0.42, 18);
  spawnImpactParticles();
  playHitSound();
  playOverlay.classList.remove("play-overlay-visible");
  syncScoreUI();
  gameoverOverlay.classList.add("overlay-visible");
}

function randomPipeGapY() {
  const currentGap = getCurrentPipeGap();
  const halfGap = currentGap / 2;
  const minCenter = 150 + halfGap;
  const maxCenter = GAME_HEIGHT - GROUND_HEIGHT - 150 - halfGap;
  return minCenter + Math.random() * (maxCenter - minCenter);
}

function getDifficultyProgress() {
  return Math.min(state.score / 12, 1);
}

function getCurrentPipeGap() {
  const progress = getDifficultyProgress();
  return BASE_PIPE_GAP - ((BASE_PIPE_GAP - MIN_PIPE_GAP) * progress);
}

function getCurrentPipeSpeed() {
  const progress = getDifficultyProgress();
  return BASE_PIPE_SPEED + ((MAX_PIPE_SPEED - BASE_PIPE_SPEED) * progress);
}

function getCurrentSpawnInterval() {
  const progress = getDifficultyProgress();
  return BASE_PIPE_SPAWN_INTERVAL - ((BASE_PIPE_SPAWN_INTERVAL - MIN_PIPE_SPAWN_INTERVAL) * progress);
}

function getCurrentEnemySpawnInterval() {
  const progress = getDifficultyProgress();
  return BASE_ENEMY_SPAWN_INTERVAL - ((BASE_ENEMY_SPAWN_INTERVAL - MIN_ENEMY_SPAWN_INTERVAL) * progress);
}

function addPipePair() {
  const currentGap = getCurrentPipeGap();
  state.pipes.push({
    x: GAME_WIDTH + PIPE_WIDTH,
    gapY: randomPipeGapY(),
    gap: currentGap,
    scored: false,
  });
}

function addEnemyBird() {
  const laneMin = 120;
  const laneMax = GAME_HEIGHT - GROUND_HEIGHT - 160;
  const baseY = laneMin + Math.random() * (laneMax - laneMin);
  const amplitude = 12 + Math.random() * 16;
  const verticalSpeed = 1.4 + Math.random() * 0.9;
  const driftSpeed = 172 + Math.random() * 26 + (getDifficultyProgress() * 24);

  state.enemies.push({
    x: GAME_WIDTH + 120,
    y: baseY,
    baseY,
    amplitude,
    verticalSpeed,
    driftSpeed,
    flapPhase: Math.random() * Math.PI * 2,
    bobOffset: Math.random() * Math.PI * 2,
    radius: ENEMY_RADIUS,
    warningTime: ENEMY_WARNING_TIME,
  });
}

function spawnParticles(count, configFactory) {
  for (let index = 0; index < count; index += 1) {
    state.particles.push(configFactory(index));
  }
}

function spawnFlapParticles() {
  spawnParticles(12, () => ({
    x: state.bird.x - 18,
    y: state.bird.y + (Math.random() * 18 - 9),
    velocityX: -120 - Math.random() * 90,
    velocityY: Math.random() * 120 - 60,
    radius: 4 + Math.random() * 4,
    life: 0.38 + Math.random() * 0.12,
    maxLife: 0.52,
    color: Math.random() > 0.4 ? "#ffffff" : "#ffd34d",
  }));
}

function spawnScoreParticles(pipe) {
  const particleX = pipe.x + (PIPE_WIDTH * 0.5);
  const particleY = pipe.gapY;
  spawnParticles(18, () => ({
    x: particleX + (Math.random() * 24 - 12),
    y: particleY + (Math.random() * 20 - 10),
    velocityX: -50 + Math.random() * 100,
    velocityY: -110 + Math.random() * 180,
    radius: 3 + Math.random() * 4,
    life: 0.52 + Math.random() * 0.24,
    maxLife: 0.76,
    color: Math.random() > 0.5 ? "#fff8c6" : "#ffd34d",
  }));
}

function spawnImpactParticles() {
  spawnParticles(26, () => ({
    x: state.bird.x + (Math.random() * 18 - 9),
    y: state.bird.y + (Math.random() * 18 - 9),
    velocityX: -170 + Math.random() * 340,
    velocityY: -170 + Math.random() * 340,
    radius: 4 + Math.random() * 5,
    life: 0.48 + Math.random() * 0.2,
    maxLife: 0.72,
    color: Math.random() > 0.55 ? "#ffffff" : "#f8922b",
  }));
}

function triggerScreenShake(duration, strength) {
  state.shakeTime = duration;
  state.shakeStrength = strength;
}

function handleInput() {
  unlockAudio();

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
  const currentSpawnInterval = getCurrentSpawnInterval();
  const currentPipeSpeed = getCurrentPipeSpeed();

  if (state.spawnTimer >= currentSpawnInterval) {
    state.spawnTimer = 0;
    addPipePair();
  }

  state.pipes.forEach((pipe) => {
    pipe.x -= currentPipeSpeed * deltaTime;

    if (!pipe.scored && pipe.x + PIPE_WIDTH < state.bird.x) {
      pipe.scored = true;
      state.score += 1;
      state.scorePulse = 1;
      scorePill.classList.remove("pulse");
      void scorePill.offsetWidth;
      scorePill.classList.add("pulse");
      window.setTimeout(() => scorePill.classList.remove("pulse"), 180);
      spawnScoreParticles(pipe);
      playScoreSound();
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
      }
      syncScoreUI();
    }
  });

  state.pipes = state.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -40);
}

function updateEnemies(deltaTime) {
  if (state.score < ENEMY_SPAWN_SCORE_THRESHOLD) {
    state.enemySpawnTimer = 0;
    state.enemies = [];
    return;
  }

  state.enemySpawnTimer += deltaTime;
  const spawnInterval = getCurrentEnemySpawnInterval();

  if (state.enemySpawnTimer >= spawnInterval) {
    state.enemySpawnTimer = 0;
    addEnemyBird();
  }

  state.enemies.forEach((enemy) => {
    enemy.flapPhase += deltaTime * 11;

    if (enemy.warningTime > 0) {
      enemy.warningTime = Math.max(0, enemy.warningTime - deltaTime);
      return;
    }

    enemy.x -= enemy.driftSpeed * deltaTime;
    enemy.bobOffset += enemy.verticalSpeed * deltaTime;
    enemy.y = enemy.baseY + Math.sin(enemy.bobOffset) * enemy.amplitude;
  });

  state.enemies = state.enemies.filter((enemy) => enemy.warningTime > 0 || enemy.x + enemy.radius * 2 > -30);
}

function circlesOverlap(aX, aY, aRadius, bX, bY, bRadius) {
  const deltaX = aX - bX;
  const deltaY = aY - bY;
  const distanceSquared = (deltaX * deltaX) + (deltaY * deltaY);
  const radii = aRadius + bRadius;
  return distanceSquared <= radii * radii;
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
    const topPipeHeight = pipe.gapY - (pipe.gap / 2);
    const bottomPipeY = pipe.gapY + (pipe.gap / 2);
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

  for (const enemy of state.enemies) {
    if (enemy.warningTime > 0) {
      continue;
    }

    if (circlesOverlap(state.bird.x, state.bird.y, BIRD_RADIUS, enemy.x, enemy.y, enemy.radius)) {
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

function updateParticles(deltaTime) {
  state.particles = state.particles.filter((particle) => {
    particle.life -= deltaTime;
    if (particle.life <= 0) {
      return false;
    }

    particle.x += particle.velocityX * deltaTime;
    particle.y += particle.velocityY * deltaTime;
    particle.velocityX *= 0.985;
    particle.velocityY += 240 * deltaTime;
    return true;
  });
}

function updateFeedback(deltaTime) {
  if (state.scorePulse > 0) {
    state.scorePulse = Math.max(0, state.scorePulse - deltaTime * 4.2);
  }

  if (state.shakeTime > 0) {
    state.shakeTime = Math.max(0, state.shakeTime - deltaTime);
    if (state.shakeTime === 0) {
      state.shakeStrength = 0;
    }
  }

  updateParticles(deltaTime);
}

function updateGame(deltaTime) {
  updateClouds(deltaTime);
  updateFeedback(deltaTime);

  if (state.mode !== "playing") {
    state.bird.wingPhase += deltaTime * 3;
    return;
  }

  state.elapsed += deltaTime;
  updateBird(deltaTime);
  updatePipes(deltaTime);
  updateEnemies(deltaTime);
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
    const topPipeHeight = pipe.gapY - (pipe.gap / 2);
    const bottomPipeY = pipe.gapY + (pipe.gap / 2);
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

function drawEnemyBird(enemy) {
  if (enemy.warningTime > 0) {
    drawEnemyWarning(enemy);
    return;
  }

  context.save();
  context.translate(enemy.x, enemy.y);
  context.scale(-1, 1);

  context.fillStyle = "#ff8b5f";
  context.beginPath();
  context.ellipse(0, 0, 19, 14, 0, 0, Math.PI * 2);
  context.fill();

  const wingOffset = Math.sin(enemy.flapPhase) * 5;
  context.fillStyle = "#ff6b43";
  context.beginPath();
  context.ellipse(-3, 2 + wingOffset * 0.25, 10, 6.5, -0.45, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffd4c6";
  context.beginPath();
  context.ellipse(6, 1, 7, 6, 0.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#fff";
  context.beginPath();
  context.arc(5, -4, 4.6, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#111";
  context.beginPath();
  context.arc(6.5, -4, 2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f6b84a";
  context.beginPath();
  context.moveTo(-16, -1);
  context.lineTo(-29, -4);
  context.lineTo(-16, 6);
  context.closePath();
  context.fill();

  context.restore();
}

function drawEnemyWarning(enemy) {
  const alpha = 0.35 + ((Math.sin(enemy.warningTime * 18) + 1) * 0.2);
  const markerX = GAME_WIDTH - 22;
  const markerY = enemy.baseY;

  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#ff7d57";
  context.beginPath();
  context.moveTo(markerX, markerY);
  context.lineTo(markerX - 18, markerY - 12);
  context.lineTo(markerX - 18, markerY + 12);
  context.closePath();
  context.fill();

  context.fillStyle = "#fff6ef";
  context.font = "700 14px Segoe UI";
  context.textAlign = "center";
  context.fillText("!", markerX - 10, markerY + 5);
  context.restore();
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    drawEnemyBird(enemy);
  });
}

function drawParticles() {
  state.particles.forEach((particle) => {
    const alpha = particle.life / particle.maxLife;
    context.globalAlpha = Math.max(alpha, 0);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  });
}

function drawScoreInCanvas() {
  const pulse = state.scorePulse;
  const width = 104 + pulse * 10;
  const height = 48 + pulse * 6;
  const x = 16 - (pulse * 5);
  const y = 16 - (pulse * 3);

  context.fillStyle = pulse > 0 ? "rgba(255, 247, 201, 0.95)" : "rgba(255, 255, 255, 0.86)";
  context.fillRect(x, y, width, height);
  context.fillStyle = "#12212c";
  context.font = pulse > 0 ? "700 34px Georgia" : "700 30px Georgia";
  context.textAlign = "left";
  context.fillText(String(state.score), x + 14, y + 33);
}

function drawFrame() {
  context.save();
  if (state.shakeTime > 0) {
    const intensity = state.shakeStrength * (state.shakeTime / 0.32);
    const shakeX = (Math.random() * 2 - 1) * intensity;
    const shakeY = (Math.random() * 2 - 1) * intensity;
    context.translate(shakeX, shakeY);
  }
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  drawBackground();
  drawPipes();
  drawEnemies();
  drawGround();
  drawParticles();
  drawBird();
  drawScoreInCanvas();
  context.restore();
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
  state.muted = loadMutedPreference();
  syncScoreUI();
  syncMuteUI();
  drawFrame();
  window.requestAnimationFrame(gameLoop);
}

canvasFrame.addEventListener("pointerdown", onPointerInput);
window.addEventListener("keydown", onKeyboardInput);
restartButton.addEventListener("click", resetRun);
muteButton.addEventListener("click", () => {
  state.muted = !state.muted;
  saveMutedPreference(state.muted);
  syncMuteUI();
  if (!state.muted) {
    unlockAudio();
    playTone({ frequency: 520, frequencyEnd: 640, duration: 0.07, type: "sine", volume: 0.025 });
  }
});

init();
