const GRID_SIZE = 9;
const BOX_SIZE = 3;
const BEST_TIMES_STORAGE_KEY = "vibecoding-sudoku-best-times";

const DIFFICULTY_CONFIG = {
  "very-easy": { label: "Very Easy", shortLabel: "V-Easy", givens: 46, hints: 5 },
  easy: { label: "Easy", shortLabel: "Easy", givens: 40, hints: 4 },
  medium: { label: "Medium", shortLabel: "Medium", givens: 34, hints: 3 },
  advanced: { label: "Advanced", shortLabel: "Adv.", givens: 30, hints: 2 },
  expert: { label: "Expert", shortLabel: "Expert", givens: 26, hints: 1 },
};

const sudokuGrid = document.querySelector("#sudoku-grid");
const boardShell = document.querySelector(".board-shell");
const boardOverlay = document.querySelector("#board-overlay");
const winOverlay = document.querySelector("#win-overlay");
const winTimeLabel = document.querySelector("#win-time-label");
const playAgainButton = document.querySelector("#play-again-button");
const startGameButton = document.querySelector("#start-game-button");
const keypad = document.querySelector("#keypad");
const difficultyButtons = Array.from(document.querySelectorAll(".difficulty-button"));
const newGameButton = document.querySelector("#new-game-button");
const notesButton = document.querySelector("#notes-button");
const notesButtonLabel = document.querySelector("#notes-button-label");
const eraseButton = document.querySelector("#erase-button");
const highlightButton = document.querySelector("#highlight-button");
const highlightButtonLabel = document.querySelector("#highlight-button-label");
const undoButton = document.querySelector("#undo-button");
const hintButton = document.querySelector("#hint-button");
const difficultyLabel = document.querySelector("#difficulty-label");
const timerLabel = document.querySelector("#timer-label");
const hintsLabel = document.querySelector("#hints-label");
const statusText = document.querySelector("#status-text");
const bestTimeLabels = {
  "very-easy": document.querySelector("#best-time-very-easy"),
  easy: document.querySelector("#best-time-easy"),
  medium: document.querySelector("#best-time-medium"),
  advanced: document.querySelector("#best-time-advanced"),
  expert: document.querySelector("#best-time-expert"),
};
const bestTimeRows = Array.from(document.querySelectorAll("[data-best-time-difficulty]"));

const state = {
  difficulty: "medium",
  solvedBoard: [],
  puzzleBoard: [],
  playerBoard: [],
  givens: [],
  notes: [],
  selectedCell: null,
  noteMode: false,
  highlightMatches: true,
  hintsRemaining: DIFFICULTY_CONFIG.medium.hints,
  history: [],
  startTime: Date.now(),
  timerInterval: null,
  lastHintedCell: null,
  hasStarted: false,
  bestTimes: {},
};

function createEmptyGrid(fillValue = 0) {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(fillValue));
}

function formatElapsedTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function loadBestTimes() {
  try {
    const rawValue = window.localStorage.getItem(BEST_TIMES_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : {};
  } catch {
    return {};
  }
}

function saveBestTimes() {
  window.localStorage.setItem(BEST_TIMES_STORAGE_KEY, JSON.stringify(state.bestTimes));
}

function renderBestTimes() {
  Object.entries(bestTimeLabels).forEach(([difficulty, element]) => {
    const bestTime = state.bestTimes[difficulty];
    element.textContent = Number.isFinite(bestTime) ? formatElapsedTime(bestTime) : "--:--";
  });

  bestTimeRows.forEach((row) => {
    row.classList.toggle("is-current", row.dataset.bestTimeDifficulty === state.difficulty);
  });
}

function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

function shuffle(array) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function isPlacementValid(grid, row, column, value) {
  for (let index = 0; index < GRID_SIZE; index += 1) {
    if (grid[row][index] === value || grid[index][column] === value) {
      return false;
    }
  }

  const boxRowStart = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxColumnStart = Math.floor(column / BOX_SIZE) * BOX_SIZE;

  for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < BOX_SIZE; columnOffset += 1) {
      if (grid[boxRowStart + rowOffset][boxColumnStart + columnOffset] === value) {
        return false;
      }
    }
  }

  return true;
}

function solveGrid(grid) {
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      if (grid[row][column] !== 0) {
        continue;
      }

      for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (!isPlacementValid(grid, row, column, value)) {
          continue;
        }

        grid[row][column] = value;

        if (solveGrid(grid)) {
          return true;
        }

        grid[row][column] = 0;
      }

      return false;
    }
  }

  return true;
}

function generateSolvedBoard() {
  const board = createEmptyGrid();
  solveGrid(board);
  return board;
}

function generatePuzzleBoard(solvedBoard, givensCount) {
  const puzzle = cloneGrid(solvedBoard);
  const cellIndexes = shuffle(Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => index));
  const cellsToRemove = (GRID_SIZE * GRID_SIZE) - givensCount;

  for (let index = 0; index < cellsToRemove; index += 1) {
    const cellIndex = cellIndexes[index];
    const row = Math.floor(cellIndex / GRID_SIZE);
    const column = cellIndex % GRID_SIZE;
    puzzle[row][column] = 0;
  }

  return puzzle;
}

function isCellGiven(row, column) {
  return state.givens[row][column];
}

function resetNotes() {
  state.notes = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => new Set())
  );
}

function updateDifficultyLabel() {
  const config = DIFFICULTY_CONFIG[state.difficulty];
  const useShortLabel = window.matchMedia("(max-width: 720px)").matches;
  difficultyLabel.textContent = useShortLabel ? config.shortLabel : config.label;
}

function setDifficulty(nextDifficulty) {
  state.difficulty = nextDifficulty;
  difficultyButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.difficulty === nextDifficulty);
  });
  updateDifficultyLabel();
}

function startTimer() {
  if (state.timerInterval) {
    window.clearInterval(state.timerInterval);
  }

  state.startTime = Date.now();
  timerLabel.textContent = "00:00";

  state.timerInterval = window.setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    timerLabel.textContent = formatElapsedTime(elapsedSeconds);
  }, 1000);
}

function updateHintButtonState() {
  hintButton.disabled = state.hintsRemaining <= 0;
}

function stopTimer() {
  if (state.timerInterval) {
    window.clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function setBoardLocked(locked) {
  sudokuGrid.parentElement.classList.toggle("is-locked", locked);
  boardOverlay.hidden = !locked;
}

function setBoardCompleted(completed) {
  sudokuGrid.parentElement.classList.toggle("is-complete", completed);
  winOverlay.hidden = !completed;
}

function updateMobilePlayingState() {
  const isMobileViewport = window.matchMedia("(max-width: 720px)").matches;
  document.body.classList.toggle("is-playing-mobile", isMobileViewport && state.hasStarted && winOverlay.hidden);
}

function updateBoardFitSize() {
  if (!boardShell) {
    return;
  }

  const isMobileViewport = window.matchMedia("(max-width: 720px)").matches;
  if (!isMobileViewport) {
    sudokuGrid.style.removeProperty("width");
    sudokuGrid.style.removeProperty("height");
    return;
  }

  const top = boardShell.getBoundingClientRect().top;
  const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const containerWidth = boardShell.clientWidth;
  const bottomPadding = 44;
  const horizontalSafety = 18;
  const availableHeight = Math.max(220, Math.floor(viewportHeight - top - bottomPadding));
  const fitSize = Math.max(220, Math.min(containerWidth - horizontalSafety, availableHeight) - 4);
  sudokuGrid.style.width = `${fitSize}px`;
  sudokuGrid.style.height = `${fitSize}px`;
}

function refreshBoardFitAfterLayoutChange() {
  updateBoardFitSize();
  window.requestAnimationFrame(() => {
    updateBoardFitSize();
  });
}

function startGame() {
  if (state.hasStarted) {
    return;
  }

  state.hasStarted = true;
  setBoardLocked(false);
  setBoardCompleted(false);
  updateMobilePlayingState();
  refreshBoardFitAfterLayoutChange();
  startTimer();
  statusText.textContent = "Select an empty cell, then tap a number to place it.";
}

function pushHistorySnapshot() {
  state.history.push({
    playerBoard: cloneGrid(state.playerBoard),
    notes: state.notes.map((row) => row.map((cell) => new Set(cell))),
    hintsRemaining: state.hintsRemaining,
  });

  if (state.history.length > 100) {
    state.history.shift();
  }
}

function popHistorySnapshot() {
  const snapshot = state.history.pop();
  if (!snapshot) {
    return;
  }

  state.playerBoard = cloneGrid(snapshot.playerBoard);
  state.notes = snapshot.notes.map((row) => row.map((cell) => new Set(cell)));
  state.hintsRemaining = snapshot.hintsRemaining;
  hintsLabel.textContent = String(state.hintsRemaining);
  updateHintButtonState();
  renderBoard();
}

function buildBoard() {
  sudokuGrid.innerHTML = "";

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(row);
      cell.dataset.column = String(column);
      cell.setAttribute("role", "gridcell");
      cell.addEventListener("click", () => selectCell(row, column));

      if ((row + 1) % BOX_SIZE === 0 && row !== GRID_SIZE - 1) {
        cell.classList.add("thick-bottom");
      }

      sudokuGrid.appendChild(cell);
    }
  }
}

function getCellElement(row, column) {
  return sudokuGrid.querySelector(`[data-row="${row}"][data-column="${column}"]`);
}

function selectCell(row, column) {
  if (!state.hasStarted) {
    return;
  }

  if (isCellGiven(row, column)) {
    state.selectedCell = { row, column };
    renderBoard();
    return;
  }

  state.selectedCell = { row, column };
  renderBoard();
}

function renderNotes(cellElement, noteSet) {
  const notesGrid = document.createElement("div");
  notesGrid.className = "notes-grid";

  for (let value = 1; value <= GRID_SIZE; value += 1) {
    const note = document.createElement("span");
    note.className = "note";
    note.textContent = noteSet.has(value) ? String(value) : "";
    notesGrid.appendChild(note);
  }

  cellElement.appendChild(notesGrid);
}

function isSameValueHighlighted(value) {
  return state.highlightMatches &&
    state.selectedCell &&
    value !== 0 &&
    state.playerBoard[state.selectedCell.row][state.selectedCell.column] === value;
}

function hasConflict(row, column, value) {
  if (value === 0) {
    return false;
  }

  for (let index = 0; index < GRID_SIZE; index += 1) {
    if (index !== column && state.playerBoard[row][index] === value) {
      return true;
    }
    if (index !== row && state.playerBoard[index][column] === value) {
      return true;
    }
  }

  const boxRowStart = Math.floor(row / BOX_SIZE) * BOX_SIZE;
  const boxColumnStart = Math.floor(column / BOX_SIZE) * BOX_SIZE;

  for (let rowOffset = 0; rowOffset < BOX_SIZE; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < BOX_SIZE; columnOffset += 1) {
      const currentRow = boxRowStart + rowOffset;
      const currentColumn = boxColumnStart + columnOffset;
      if ((currentRow !== row || currentColumn !== column) && state.playerBoard[currentRow][currentColumn] === value) {
        return true;
      }
    }
  }

  return false;
}

function renderBoard() {
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      const cellElement = getCellElement(row, column);
      const value = state.playerBoard[row][column];
      const selected = state.selectedCell && state.selectedCell.row === row && state.selectedCell.column === column;
      const related = state.selectedCell && (state.selectedCell.row === row ||
        state.selectedCell.column === column ||
        (Math.floor(state.selectedCell.row / BOX_SIZE) === Math.floor(row / BOX_SIZE) &&
          Math.floor(state.selectedCell.column / BOX_SIZE) === Math.floor(column / BOX_SIZE)));

      cellElement.classList.toggle("given", isCellGiven(row, column));
      cellElement.classList.toggle("selected", Boolean(selected));
      cellElement.classList.toggle("related", Boolean(related && !selected));
      cellElement.classList.toggle("match", isSameValueHighlighted(value));
      cellElement.classList.toggle("invalid", hasConflict(row, column, value));
      cellElement.classList.toggle("hinted", Boolean(state.lastHintedCell && state.lastHintedCell.row === row && state.lastHintedCell.column === column));

      cellElement.textContent = value === 0 ? "" : String(value);
      if (value === 0 && state.notes[row][column].size > 0) {
        renderNotes(cellElement, state.notes[row][column]);
      }
    }
  }

  if (state.lastHintedCell) {
    window.setTimeout(() => {
      state.lastHintedCell = null;
      renderBoard();
    }, 800);
  }

  updateBoardFitSize();
}

function clearCell(row, column) {
  if (isCellGiven(row, column)) {
    return;
  }

  pushHistorySnapshot();
  state.playerBoard[row][column] = 0;
  state.notes[row][column].clear();
  renderBoard();
}

function applyNumber(value) {
  if (!state.hasStarted) {
    statusText.textContent = "Tap Start Game when you're ready.";
    return;
  }

  if (!state.selectedCell) {
    statusText.textContent = "Select a cell first.";
    return;
  }

  const { row, column } = state.selectedCell;
  if (isCellGiven(row, column)) {
    statusText.textContent = "That number is part of the puzzle and cannot be changed.";
    return;
  }

  pushHistorySnapshot();

  if (state.noteMode) {
    if (state.playerBoard[row][column] !== 0) {
      state.playerBoard[row][column] = 0;
    }

    const noteSet = state.notes[row][column];
    if (noteSet.has(value)) {
      noteSet.delete(value);
    } else {
      noteSet.add(value);
    }
    statusText.textContent = `Note mode is on. Candidate ${value} updated.`;
  } else {
    state.playerBoard[row][column] = value;
    state.notes[row][column].clear();
    statusText.textContent = `Placed ${value}.`;
  }

  renderBoard();
  checkWinState();
}

function useHint() {
  if (!state.hasStarted) {
    statusText.textContent = "Start the game first to use hints.";
    return;
  }

  if (state.hintsRemaining <= 0) {
    statusText.textContent = "No hints remaining for this puzzle.";
    return;
  }

  const emptyCells = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      if (state.playerBoard[row][column] === 0) {
        emptyCells.push({ row, column });
      }
    }
  }

  if (emptyCells.length === 0) {
    statusText.textContent = "The board is already complete.";
    return;
  }

  pushHistorySnapshot();

  const chosenCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  state.playerBoard[chosenCell.row][chosenCell.column] = state.solvedBoard[chosenCell.row][chosenCell.column];
  state.notes[chosenCell.row][chosenCell.column].clear();
  state.hintsRemaining -= 1;
  state.lastHintedCell = chosenCell;
  hintsLabel.textContent = String(state.hintsRemaining);
  updateHintButtonState();
  statusText.textContent = `Hint used. A random correct number was revealed.`;
  renderBoard();
  checkWinState();
}

function checkWinState() {
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let column = 0; column < GRID_SIZE; column += 1) {
      if (state.playerBoard[row][column] !== state.solvedBoard[row][column]) {
        return;
      }
    }
  }

  statusText.textContent = "Puzzle solved. Nice work.";
  stopTimer();
  setBoardCompleted(true);
  updateMobilePlayingState();
  refreshBoardFitAfterLayoutChange();
  winTimeLabel.textContent = timerLabel.textContent;

  const elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
  const savedBest = state.bestTimes[state.difficulty];
  if (!Number.isFinite(savedBest) || elapsedSeconds < savedBest) {
    state.bestTimes[state.difficulty] = elapsedSeconds;
    saveBestTimes();
    renderBestTimes();
    statusText.textContent = "New best time for this difficulty.";
  }
}

function createNewGame() {
  const config = DIFFICULTY_CONFIG[state.difficulty];
  state.solvedBoard = generateSolvedBoard();
  state.puzzleBoard = generatePuzzleBoard(state.solvedBoard, config.givens);
  state.playerBoard = cloneGrid(state.puzzleBoard);
  state.givens = state.puzzleBoard.map((row) => row.map((value) => value !== 0));
  state.hintsRemaining = config.hints;
  state.history = [];
  state.selectedCell = null;
  state.noteMode = false;
  state.lastHintedCell = null;
  state.hasStarted = false;
  resetNotes();
  stopTimer();
  timerLabel.textContent = "00:00";
  hintsLabel.textContent = String(state.hintsRemaining);
  updateHintButtonState();
  updateDifficultyLabel();
  renderBestTimes();
  notesButton.classList.remove("is-active");
  notesButtonLabel.textContent = "Notes";
  highlightButton.classList.toggle("is-active", state.highlightMatches);
  highlightButtonLabel.textContent = "Match";
  statusText.textContent = "Tap Start Game when you're ready.";
  setBoardLocked(true);
  setBoardCompleted(false);
  updateMobilePlayingState();
  refreshBoardFitAfterLayoutChange();
  renderBoard();
}

function handleKeyInput(event) {
  if (event.key >= "1" && event.key <= "9") {
    applyNumber(Number(event.key));
    return;
  }

  if (event.key === "Backspace" || event.key === "Delete") {
    if (state.selectedCell) {
      clearCell(state.selectedCell.row, state.selectedCell.column);
    }
  }
}

function init() {
  state.bestTimes = loadBestTimes();
  renderBestTimes();
  buildBoard();
  setDifficulty(state.difficulty);
  createNewGame();
  updateBoardFitSize();
}

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("[data-digit]");
  if (!button) {
    return;
  }

  applyNumber(Number(button.dataset.digit));
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDifficulty(button.dataset.difficulty);
    createNewGame();
  });
});

newGameButton.addEventListener("click", createNewGame);
playAgainButton.addEventListener("click", createNewGame);

notesButton.addEventListener("click", () => {
  state.noteMode = !state.noteMode;
  notesButton.classList.toggle("is-active", state.noteMode);
  notesButtonLabel.textContent = state.noteMode ? "Notes On" : "Notes";
  statusText.textContent = state.noteMode
    ? "Note mode is active. Tap digits to add or remove candidates."
    : "Note mode is off. Digits will fill the selected cell.";
});

highlightButton.addEventListener("click", () => {
  state.highlightMatches = !state.highlightMatches;
  highlightButton.classList.toggle("is-active", state.highlightMatches);
  highlightButtonLabel.textContent = state.highlightMatches ? "Match" : "Plain";
  statusText.textContent = state.highlightMatches
    ? "Matching numbers are highlighted when you select a filled cell."
    : "Matching number highlights are turned off.";
  renderBoard();
});

eraseButton.addEventListener("click", () => {
  if (!state.hasStarted) {
    statusText.textContent = "Start the game first.";
    return;
  }

  if (!state.selectedCell) {
    statusText.textContent = "Select a cell first.";
    return;
  }

  clearCell(state.selectedCell.row, state.selectedCell.column);
  statusText.textContent = "Cell cleared.";
});

undoButton.addEventListener("click", () => {
  if (!state.hasStarted) {
    statusText.textContent = "Start the game first.";
    return;
  }

  popHistorySnapshot();
  statusText.textContent = "Last move restored.";
});

hintButton.addEventListener("click", useHint);
startGameButton.addEventListener("click", startGame);
window.addEventListener("resize", () => {
  updateDifficultyLabel();
  updateMobilePlayingState();
  updateBoardFitSize();
});
window.addEventListener("orientationchange", updateBoardFitSize);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", updateBoardFitSize);
  window.visualViewport.addEventListener("scroll", updateBoardFitSize);
}
window.addEventListener("keydown", handleKeyInput);

init();
