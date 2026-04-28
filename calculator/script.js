const MAX_HISTORY = 8;
const HISTORY_KEY = "calculator-history-v1";

const state = {
  displayValue: "0",
  previousValue: null,
  operator: null,
  waitingForNextValue: false,
  justCalculated: false
};

const display = document.getElementById("display");
const memoryLine = document.getElementById("memory-line");
const historyList = document.getElementById("history-list");
const keypad = document.querySelector(".keypad");
const backspaceButton = document.getElementById("backspace-button");
const clearHistoryButton = document.getElementById("clear-history-button");
const historyCount = document.getElementById("history-count");

let historyItems = loadHistory();

function formatNumberString(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "Error";
  }

  if (Math.abs(numericValue) >= 1e12 || (Math.abs(numericValue) > 0 && Math.abs(numericValue) < 1e-9)) {
    return numericValue.toExponential(6).replace(/\.?0+e/, "e");
  }

  return numericValue.toLocaleString("en-US", {
    maximumFractionDigits: 10
  });
}

function normalizeResult(value) {
  if (!Number.isFinite(value)) {
    return "Error";
  }

  const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
  return String(rounded);
}

function updateDisplay() {
  display.textContent = formatNumberString(state.displayValue);

  if (state.operator && state.previousValue !== null) {
    memoryLine.textContent = `${formatNumberString(state.previousValue)} ${getOperatorLabel(state.operator)}`;
    return;
  }

  if (state.justCalculated) {
    memoryLine.textContent = "Result";
    return;
  }

  memoryLine.textContent = "Ready";
}

function getOperatorLabel(operator) {
  return operator === "*" ? "x" : operator;
}

function inputDigit(digit) {
  if (state.waitingForNextValue || state.justCalculated) {
    state.displayValue = digit;
    state.waitingForNextValue = false;
    state.justCalculated = false;
  } else {
    state.displayValue = state.displayValue === "0" ? digit : state.displayValue + digit;
  }

  updateDisplay();
}

function inputDecimal() {
  if (state.waitingForNextValue || state.justCalculated) {
    state.displayValue = "0.";
    state.waitingForNextValue = false;
    state.justCalculated = false;
    updateDisplay();
    return;
  }

  if (!state.displayValue.includes(".")) {
    state.displayValue += ".";
    updateDisplay();
  }
}

function clearAll() {
  state.displayValue = "0";
  state.previousValue = null;
  state.operator = null;
  state.waitingForNextValue = false;
  state.justCalculated = false;
  updateDisplay();
}

function backspace() {
  if (state.waitingForNextValue || state.justCalculated) {
    state.displayValue = "0";
    state.waitingForNextValue = false;
    state.justCalculated = false;
    updateDisplay();
    return;
  }

  state.displayValue = state.displayValue.length > 1 ? state.displayValue.slice(0, -1) : "0";

  if (state.displayValue === "-" || state.displayValue === "-0") {
    state.displayValue = "0";
  }

  updateDisplay();
}

function toggleSign() {
  if (state.displayValue === "0" || state.displayValue === "Error") {
    return;
  }

  state.displayValue = state.displayValue.startsWith("-")
    ? state.displayValue.slice(1)
    : `-${state.displayValue}`;
  updateDisplay();
}

function applyPercent() {
  const currentValue = Number(state.displayValue);

  if (!Number.isFinite(currentValue)) {
    return;
  }

  state.displayValue = normalizeResult(currentValue / 100);
  state.waitingForNextValue = false;
  updateDisplay();
}

function calculate(firstValue, secondValue, operator) {
  switch (operator) {
    case "+":
      return firstValue + secondValue;
    case "-":
      return firstValue - secondValue;
    case "*":
      return firstValue * secondValue;
    case "/":
      return secondValue === 0 ? Number.NaN : firstValue / secondValue;
    default:
      return secondValue;
  }
}

function handleOperator(nextOperator) {
  const inputValue = Number(state.displayValue);

  if (state.operator && state.waitingForNextValue) {
    state.operator = nextOperator;
    updateDisplay();
    return;
  }

  if (state.previousValue === null || state.justCalculated) {
    state.previousValue = inputValue;
  } else if (state.operator) {
    const result = calculate(state.previousValue, inputValue, state.operator);
    state.displayValue = normalizeResult(result);

    if (state.displayValue === "Error") {
      clearAll();
      display.textContent = "Error";
      memoryLine.textContent = "Cannot divide by zero";
      return;
    }

    state.previousValue = Number(state.displayValue);
  }

  state.operator = nextOperator;
  state.waitingForNextValue = true;
  state.justCalculated = false;
  updateDisplay();
}

function handleEquals() {
  if (!state.operator || state.previousValue === null) {
    state.justCalculated = true;
    updateDisplay();
    return;
  }

  const currentValue = Number(state.displayValue);
  const firstValue = Number(state.previousValue);
  const result = calculate(firstValue, currentValue, state.operator);

  if (!Number.isFinite(result)) {
    clearAll();
    display.textContent = "Error";
    memoryLine.textContent = "Cannot divide by zero";
    return;
  }

  const expression = `${formatNumberString(firstValue)} ${getOperatorLabel(state.operator)} ${formatNumberString(currentValue)}`;
  state.displayValue = normalizeResult(result);
  state.previousValue = null;
  state.operator = null;
  state.waitingForNextValue = false;
  state.justCalculated = true;
  memoryLine.textContent = expression;
  saveHistoryItem(expression, formatNumberString(state.displayValue));
  updateDisplay();
  memoryLine.textContent = expression;
}

function handleAction(action, value) {
  switch (action) {
    case "digit":
      inputDigit(value);
      break;
    case "decimal":
      inputDecimal();
      break;
    case "clear":
      clearAll();
      break;
    case "sign":
      toggleSign();
      break;
    case "percent":
      applyPercent();
      break;
    case "operator":
      handleOperator(value);
      break;
    case "equals":
      handleEquals();
      break;
    default:
      break;
  }
}

function loadHistory() {
  try {
    const storedValue = window.localStorage.getItem(HISTORY_KEY);
    const parsed = storedValue ? JSON.parse(storedValue) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function persistHistory() {
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(historyItems));
}

function saveHistoryItem(expression, result) {
  historyItems = [{ expression, result }, ...historyItems].slice(0, MAX_HISTORY);
  persistHistory();
  renderHistory();
}

function renderHistory() {
  historyCount.textContent = `${historyItems.length} saved`;

  if (!historyItems.length) {
    historyList.innerHTML = '<li class="history-empty">No calculations yet.</li>';
    return;
  }

  historyList.innerHTML = historyItems
    .map((item) => `
      <li class="history-item">
        <span class="history-item-expression">${item.expression}</span>
        <strong class="history-item-result">= ${item.result}</strong>
      </li>
    `)
    .join("");
}

function pressVisualButton(label) {
  const selector = `[data-value="${label}"], [data-action="${label}"]`;
  const button = document.querySelector(selector);

  if (!button) {
    return;
  }

  button.classList.add("is-pressed");
  window.setTimeout(() => button.classList.remove("is-pressed"), 120);
}

keypad.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  handleAction(button.dataset.action, button.dataset.value);
});

backspaceButton.addEventListener("click", backspace);

clearHistoryButton.addEventListener("click", () => {
  historyItems = [];
  persistHistory();
  renderHistory();
});

window.addEventListener("keydown", (event) => {
  const { key } = event;

  if (/^\d$/.test(key)) {
    inputDigit(key);
    pressVisualButton(key);
    return;
  }

  if (["+", "-", "*", "/"].includes(key)) {
    handleOperator(key);
    pressVisualButton(key);
    return;
  }

  if (key === ".") {
    inputDecimal();
    pressVisualButton("decimal");
    return;
  }

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    handleEquals();
    pressVisualButton("equals");
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    backspace();
    return;
  }

  if (key === "Escape") {
    clearAll();
    pressVisualButton("clear");
  }
});

renderHistory();
updateDisplay();
