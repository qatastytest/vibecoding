const TOTAL_WEEKS = 4576;
const WEEKS_PER_YEAR = 52;

const birthDayInput = document.querySelector("#birth-day");
const birthMonthInput = document.querySelector("#birth-month");
const birthYearInput = document.querySelector("#birth-year");
const weeksGrid = document.querySelector("#weeks-grid");
const yearLabels = document.querySelector("#year-labels");
const jumpTodayButton = document.querySelector("#jump-today");
const printPosterButton = document.querySelector("#print-poster");
const currentAgeValue = document.querySelector("#current-age");
const yearOfLifeValue = document.querySelector("#year-of-life");
const weeksLivedValue = document.querySelector("#weeks-lived");
const weeksLeftValue = document.querySelector("#weeks-left");
const lifePercentValue = document.querySelector("#life-percent");
const posterNote = document.querySelector("#poster-note");
const posterHelper = document.querySelector("#poster-helper");
const progressFill = document.querySelector("#progress-fill");

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function populateSelect(select, values, formatter = (value) => value) {
  const fragment = document.createDocumentFragment();

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = formatter(value);
    fragment.appendChild(option);
  });

  select.appendChild(fragment);
}

function setupBirthdateFields() {
  populateSelect(birthDayInput, Array.from({ length: 31 }, (_, index) => index + 1));
  populateSelect(
    birthMonthInput,
    Array.from({ length: 12 }, (_, index) => index),
    (value) => new Date(2000, value, 1).toLocaleString("en-US", { month: "long" })
  );

  const currentYear = new Date().getFullYear();
  const years = [];

  for (let year = currentYear; year >= currentYear - 120; year -= 1) {
    years.push(year);
  }

  populateSelect(birthYearInput, years);
}

function createGrid() {
  const fragment = document.createDocumentFragment();

  for (let weekIndex = 0; weekIndex < TOTAL_WEEKS; weekIndex += 1) {
    const cell = document.createElement("div");
    cell.className = "week future";
    cell.dataset.weekIndex = String(weekIndex);
    cell.title = `Week ${weekIndex + 1}`;
    fragment.appendChild(cell);
  }

  weeksGrid.appendChild(fragment);
}

function createYearLabels() {
  const totalYears = Math.ceil(TOTAL_WEEKS / WEEKS_PER_YEAR);
  const fragment = document.createDocumentFragment();

  for (let year = 1; year <= totalYears; year += 1) {
    const label = document.createElement("div");
    label.className = "year-label";
    label.textContent = year;
    fragment.appendChild(label);
  }

  yearLabels.appendChild(fragment);
}

function weeksBetween(startDate, endDate) {
  const millisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
  return Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsPerWeek);
}

function calculateAgeInYears(birthDate, today) {
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return Math.max(age, 0);
}

function updateGrid(livedWeeks) {
  const cells = weeksGrid.children;

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    const lived = index < livedWeeks;
    const current = index === livedWeeks && livedWeeks < TOTAL_WEEKS;
    cell.classList.toggle("lived", lived);
    cell.classList.toggle("current", current);
    cell.classList.toggle("future", !lived && !current);
    cell.title = current ? `Current week: ${index + 1}` : `Week ${index + 1}`;
  }
}

function updateStats(livedWeeks, ageInYears = 0) {
  const clampedLivedWeeks = Math.min(Math.max(livedWeeks, 0), TOTAL_WEEKS);
  const remainingWeeks = Math.max(TOTAL_WEEKS - clampedLivedWeeks, 0);
  const lifeUsedPercent = (clampedLivedWeeks / TOTAL_WEEKS) * 100;
  const currentYearOfLife = Math.min(Math.floor(clampedLivedWeeks / WEEKS_PER_YEAR) + 1, Math.ceil(TOTAL_WEEKS / WEEKS_PER_YEAR));

  currentAgeValue.textContent = `${formatNumber(ageInYears)} years`;
  yearOfLifeValue.textContent = `Year ${formatNumber(currentYearOfLife)} of 88`;
  weeksLivedValue.textContent = formatNumber(clampedLivedWeeks);
  weeksLeftValue.textContent = formatNumber(remainingWeeks);
  lifePercentValue.textContent = `${lifeUsedPercent.toFixed(1)}%`;
  progressFill.style.width = `${lifeUsedPercent}%`;

  if (livedWeeks > TOTAL_WEEKS) {
    const extraWeeks = livedWeeks - TOTAL_WEEKS;
    posterNote.textContent = `${formatNumber(TOTAL_WEEKS)} weeks mapped, plus ${formatNumber(extraWeeks)} weeks beyond the poster horizon.`;
    posterHelper.textContent = "Each row represents one year with 52 weeks, and the poster contains exactly 88 numbered rows.";
    return;
  }

  posterNote.textContent = `${formatNumber(clampedLivedWeeks)} weeks lived, ${formatNumber(remainingWeeks)} remaining.`;
  posterHelper.textContent = "Each row represents one year with 52 weeks, and the poster contains exactly 88 numbered rows.";
}

function updateLifeView() {
  if (!birthDayInput.value || !birthMonthInput.value || !birthYearInput.value) {
    updateGrid(0);
    updateStats(0);
    return;
  }

  const birthDay = Number(birthDayInput.value);
  const birthMonth = Number(birthMonthInput.value);
  const birthYear = Number(birthYearInput.value);
  const birthDate = new Date(birthYear, birthMonth, birthDay);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const invalidDate =
    Number.isNaN(birthDate.getTime()) ||
    birthDate.getFullYear() !== birthYear ||
    birthDate.getMonth() !== birthMonth ||
    birthDate.getDate() !== birthDay;

  if (invalidDate || birthDate > today) {
    updateGrid(0);
    updateStats(0);
    posterNote.textContent = "Choose a valid birth date that is not in the future.";
    posterHelper.textContent = "Each row represents one year with 52 weeks, and the rows are numbered from 1 to 88.";
    return;
  }

  const livedWeeks = weeksBetween(birthDate, today);
  const ageInYears = calculateAgeInYears(birthDate, today);
  updateGrid(Math.min(livedWeeks, TOTAL_WEEKS));
  updateStats(livedWeeks, ageInYears);
}

function setDefaultBirthdate() {
  const defaultDate = new Date();
  defaultDate.setFullYear(defaultDate.getFullYear() - 30);
  applyBirthdate(defaultDate);
}

function applyBirthdate(date) {
  birthDayInput.value = String(date.getDate());
  birthMonthInput.value = String(date.getMonth());
  birthYearInput.value = String(date.getFullYear());
}

setupBirthdateFields();
createGrid();
createYearLabels();
setDefaultBirthdate();
updateLifeView();

[birthDayInput, birthMonthInput, birthYearInput].forEach((field) => {
  field.addEventListener("change", updateLifeView);
});

jumpTodayButton.addEventListener("click", () => {
  setDefaultBirthdate();
  updateLifeView();
});

printPosterButton.addEventListener("click", () => {
  window.print();
});
