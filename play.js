/**
 * play.js – Interactive crossword solver
 */

// ─── State ────────────────────────────────────────────────────────────────────
let puzzle = null;
let userGrid = [];
let selectedCell = null;
let selectedDir = 'across';
let numbering = [];
let timerInterval = null;
let timerSeconds = 0;
let solved = false;

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  Storage.init();

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) {
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">No puzzle ID specified. <a href="index.html">Go back</a></p>';
    return;
  }

  document.querySelector('.play-main').style.opacity = '0.4';
  puzzle = await Storage.loadPuzzle(id);
  document.querySelector('.play-main').style.opacity = '1';

  if (!puzzle) {
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">Puzzle not found. <a href="index.html">Go back</a></p>';
    return;
  }

  document.getElementById('play-title').textContent   = puzzle.title || 'CROSSWORD';
  document.getElementById('play-byline').textContent  = puzzle.author ? `By ${puzzle.author}` : (puzzle.date || '');

  initUserGrid();
  computeNumbering();
  renderGrid();
  renderClues();
  startTimer();
  bindControls();
});

function initUserGrid() {
  userGrid = [];
  for (let r = 0; r < puzzle.rows; r++) {
    userGrid[r] = [];
    for (let c = 0; c < puzzle.cols; c++) {
      userGrid[r][c] = { letter: '', revealed: false, correct: false };
    }
  }
}

// ─── Numbering ────────────────────────────────────────────────────────────────
function computeNumbering() {
  numbering = [];
  for (let i = 0; i < puzzle.rows; i++) numbering[i] = new Array(puzzle.cols).fill(0);
  let n = 1;
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (puzzle.cells[r][c].black) continue;
      const sa = (c === 0 || puzzle.cells[r][c-1].black) && (c+1 < puzzle.cols && !puzzle.cells[r][c+1].black);
      const sd = (r === 0 || puzzle.cells[r-1][c].black) && (r+1 < puzzle.rows && !puzzle.cells[r+1][c].black);
      if (sa || sd) numbering[r][c] = n++;
    }
  }
}

// ─── Grid Rendering ───────────────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('play-grid');
  grid.style.gridTemplateColumns = `repeat(${puzzle.cols}, var(--cell-size))`;
  grid.style.gridTemplateRows = `repeat(${puzzle.rows}, var(--cell-size))`;
  grid.innerHTML = '';

  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.r = r;
      div.dataset.c = c;

      if (puzzle.cells[r][c].black) {
        div.classList.add('black');
      } else {
        const numSpan = document.createElement('span');
        numSpan.className = 'cell-number';
        numSpan.textContent = numbering[r][c] || '';
        const letterSpan = document.createElement('span');
        letterSpan.className = 'cell-letter';
        div.append(numSpan, letterSpan);
        div.addEventListener('click', onCellClick);
      }
      grid.appendChild(div);
    }
  }
}

function getCellEl(r, c) {
  return document.querySelector(`#play-grid .cell[data-r="${r}"][data-c="${c}"]`);
}

function updateCellEl(r, c) {
  const el = getCellEl(r, c);
  if (!el || puzzle.cells[r][c].black) return;
  const ud = userGrid[r][c];
  const letterSpan = el.querySelector('.cell-letter');
  letterSpan.textContent = ud.letter;
  el.classList.remove('correct', 'wrong', 'revealed');
  if (ud.revealed) el.classList.add('revealed');
  else if (ud.correct) el.classList.add('correct');
}

// ─── Clue Rendering ───────────────────────────────────────────────────────────
function renderClues() {
  renderClueList('across');
  renderClueList('down');
}

function renderClueList(dir) {
  const container = document.getElementById(`play-clues-${dir}`);
  container.innerHTML = '';
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const n = numbering[r][c];
      if (!n) continue;
      const isAcross = (c === 0 || puzzle.cells[r][c-1].black) && (c+1 < puzzle.cols && !puzzle.cells[r][c+1].black);
      const isDown   = (r === 0 || puzzle.cells[r-1][c].black) && (r+1 < puzzle.rows && !puzzle.cells[r+1][c].black);
      const applies  = dir === 'across' ? isAcross : isDown;
      if (!applies) continue;

      const clueText = puzzle.clues[dir][n] || '…';
      const div = document.createElement('div');
      div.className = 'clue-item';
      div.dataset.num = n;
      div.dataset.dir = dir;
      div.innerHTML = `<span class="clue-num">${n}</span>${clueText}`;
      div.addEventListener('click', () => {
        selectedCell = { r, c };
        selectedDir = dir;
        highlight();
        updateActiveClueBanner();
        focusHidden();
      });
      container.appendChild(div);
    }
  }
}

// ─── Word helpers ─────────────────────────────────────────────────────────────
function wordStart(r, c, dir) {
  if (dir === 'across') { while (c > 0 && !puzzle.cells[r][c-1].black) c--; }
  else { while (r > 0 && !puzzle.cells[r-1][c].black) r--; }
  return { r, c };
}
function wordCells(r, c, dir) {
  const res = [];
  const s = wordStart(r, c, dir);
  let { r: sr, c: sc } = s;
  if (dir === 'across') while (sc < puzzle.cols && !puzzle.cells[sr][sc].black) { res.push({ r: sr, c: sc }); sc++; }
  else while (sr < puzzle.rows && !puzzle.cells[sr][sc].black) { res.push({ r: sr, c: sc }); sr++; }
  return res;
}
function wordNumber(r, c, dir) {
  const s = wordStart(r, c, dir);
  return numbering[s.r][s.c];
}

// ─── Highlighting ─────────────────────────────────────────────────────────────
function highlight() {
  document.querySelectorAll('#play-grid .cell').forEach(el => el.classList.remove('selected', 'word-highlight'));
  document.querySelectorAll('.clue-item').forEach(el => el.classList.remove('active'));
  if (!selectedCell) return;

  const { r, c } = selectedCell;
  if (puzzle.cells[r][c].black) return;

  const wc = wordCells(r, c, selectedDir);
  wc.forEach(({ r: wr, c: wc_ }) => {
    const el = getCellEl(wr, wc_); if (el) el.classList.add('word-highlight');
  });
  const sel = getCellEl(r, c);
  if (sel) { sel.classList.remove('word-highlight'); sel.classList.add('selected'); }

  // Highlight clue list item
  const num = wordNumber(r, c, selectedDir);
  document.querySelector(`.clue-item[data-num="${num}"][data-dir="${selectedDir}"]`)?.classList.add('active');
}

function updateActiveClueBanner() {
  if (!selectedCell) return;
  const { r, c } = selectedCell;
  if (puzzle.cells[r][c].black) return;
  const num = wordNumber(r, c, selectedDir);
  const clueText = puzzle.clues[selectedDir][num] || '…';
  document.getElementById('active-clue-num').textContent = num;
  document.getElementById('active-clue-dir').textContent = selectedDir.toUpperCase();
  document.getElementById('active-clue-text').textContent = clueText;
}

// ─── Input ────────────────────────────────────────────────────────────────────
let hiddenInput = null;
function focusHidden() {
  if (!hiddenInput) {
    hiddenInput = document.createElement('input');
    hiddenInput.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px;';
    hiddenInput.setAttribute('autocomplete', 'off');
    hiddenInput.setAttribute('autocorrect', 'off');
    hiddenInput.setAttribute('autocapitalize', 'characters');
    document.body.appendChild(hiddenInput);
    hiddenInput.addEventListener('keydown', onKeyDown);
    hiddenInput.addEventListener('input', onInput);
  }
  hiddenInput.focus();
}

function onInput() {
  const val = hiddenInput.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
  hiddenInput.value = '';
  if (!val || !selectedCell) return;
  typeLetter(val[val.length - 1]);
}

function onKeyDown(e) {
  if (!selectedCell) return;
  const { r, c } = selectedCell;
  if (e.key === 'Backspace') { deleteLetter(); e.preventDefault(); return; }
  if (e.key === 'Delete') { userGrid[r][c].letter = ''; userGrid[r][c].revealed = false; updateCellEl(r, c); e.preventDefault(); return; }
  if (e.key === 'Tab') { jumpToNextWord(e.shiftKey); e.preventDefault(); return; }
  if (e.key === 'ArrowRight') { selectedCell = moveDirFn(r, c, 0, 1); selectedDir = 'across'; highlight(); updateActiveClueBanner(); e.preventDefault(); return; }
  if (e.key === 'ArrowLeft')  { selectedCell = moveDirFn(r, c, 0, -1); selectedDir = 'across'; highlight(); updateActiveClueBanner(); e.preventDefault(); return; }
  if (e.key === 'ArrowDown')  { selectedCell = moveDirFn(r, c, 1, 0); selectedDir = 'down'; highlight(); updateActiveClueBanner(); e.preventDefault(); return; }
  if (e.key === 'ArrowUp')    { selectedCell = moveDirFn(r, c, -1, 0); selectedDir = 'down'; highlight(); updateActiveClueBanner(); e.preventDefault(); return; }
  if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) { typeLetter(e.key.toUpperCase()); e.preventDefault(); }
}

function typeLetter(letter) {
  if (!selectedCell || solved) return;
  const { r, c } = selectedCell;
  if (puzzle.cells[r][c].black) return;
  userGrid[r][c].letter = letter;
  userGrid[r][c].revealed = false;
  updateCellEl(r, c);
  moveForward();
  checkWin();
}

function deleteLetter() {
  if (!selectedCell) return;
  const { r, c } = selectedCell;
  if (userGrid[r][c].letter) { userGrid[r][c].letter = ''; userGrid[r][c].revealed = false; updateCellEl(r, c); }
  else moveForward(-1);
}

function moveForward(delta = 1) {
  if (!selectedCell) return;
  const { r, c } = selectedCell;
  if (selectedDir === 'across') {
    const nc = c + delta;
    if (nc >= 0 && nc < puzzle.cols && !puzzle.cells[r][nc].black) selectedCell = { r, c: nc };
    else { jumpToNextWord(delta < 0); return; }
  } else {
    const nr = r + delta;
    if (nr >= 0 && nr < puzzle.rows && !puzzle.cells[nr][c].black) selectedCell = { r: nr, c };
    else { jumpToNextWord(delta < 0); return; }
  }
  highlight();
  updateActiveClueBanner();
}

function moveDirFn(r, c, dr, dc) {
  const nr = r + dr, nc = c + dc;
  if (nr < 0 || nr >= puzzle.rows || nc < 0 || nc >= puzzle.cols || puzzle.cells[nr][nc].black) return { r, c };
  return { r: nr, c: nc };
}

function jumpToNextWord(reverse) {
  const words = [];
  for (let r = 0; r < puzzle.rows; r++) for (let c = 0; c < puzzle.cols; c++) {
    const n = numbering[r][c]; if (!n) continue;
    const sa = (c === 0 || puzzle.cells[r][c-1].black) && (c+1 < puzzle.cols && !puzzle.cells[r][c+1].black);
    const sd = (r === 0 || puzzle.cells[r-1][c].black) && (r+1 < puzzle.rows && !puzzle.cells[r+1][c].black);
    if (sa) words.push({ r, c, dir: 'across', num: n });
    if (sd) words.push({ r, c, dir: 'down', num: n });
  }
  words.sort((a, b) => a.num - b.num || (a.dir === 'across' ? -1 : 1));
  if (!words.length) return;
  const cur = words.findIndex(w => {
    if (!selectedCell) return false;
    const s = wordStart(selectedCell.r, selectedCell.c, selectedDir);
    return w.dir === selectedDir && w.r === s.r && w.c === s.c;
  });
  let next = reverse ? cur - 1 : cur + 1;
  if (next >= words.length) next = 0;
  if (next < 0) next = words.length - 1;
  const w = words[next];
  selectedCell = { r: w.r, c: w.c };
  selectedDir = w.dir;
  highlight();
  updateActiveClueBanner();
}

// ─── Cell Click ───────────────────────────────────────────────────────────────
function onCellClick(e) {
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;
  if (puzzle.cells[r][c].black) return;
  if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
    selectedDir = selectedDir === 'across' ? 'down' : 'across';
  } else {
    selectedCell = { r, c };
  }
  highlight();
  updateActiveClueBanner();
  focusHidden();
}

// ─── Controls ─────────────────────────────────────────────────────────────────
function bindControls() {
  document.getElementById('check-btn').addEventListener('click', checkAnswers);
  document.getElementById('reveal-btn').addEventListener('click', revealLetter);
  document.getElementById('clear-btn').addEventListener('click', clearAll);
  document.getElementById('win-home').addEventListener('click', () => { location.href = 'index.html'; });
}

function checkAnswers() {
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (puzzle.cells[r][c].black) continue;
      const ud = userGrid[r][c];
      if (!ud.letter) continue;
      const el = getCellEl(r, c);
      if (!el) continue;
      el.classList.remove('correct', 'wrong');
      if (ud.letter === puzzle.cells[r][c].letter) {
        el.classList.add('correct');
        ud.correct = true;
      } else {
        el.classList.add('wrong');
        ud.correct = false;
      }
    }
  }
}

function revealLetter() {
  if (!selectedCell) return;
  const { r, c } = selectedCell;
  if (puzzle.cells[r][c].black) return;
  userGrid[r][c].letter = puzzle.cells[r][c].letter;
  userGrid[r][c].revealed = true;
  userGrid[r][c].correct = true;
  updateCellEl(r, c);
  moveForward();
  checkWin();
}

function clearAll() {
  if (!confirm('Clear all letters?')) return;
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      userGrid[r][c] = { letter: '', revealed: false, correct: false };
      const el = getCellEl(r, c);
      if (el) { el.classList.remove('correct', 'wrong', 'revealed'); el.querySelector('.cell-letter').textContent = ''; }
    }
  }
}

// ─── Win Detection ────────────────────────────────────────────────────────────
function checkWin() {
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (puzzle.cells[r][c].black) continue;
      if (userGrid[r][c].letter !== puzzle.cells[r][c].letter) return;
    }
  }
  // All correct!
  solved = true;
  clearInterval(timerInterval);
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('win-time').textContent = `Solved in ${m}:${String(s).padStart(2, '0')}`;
  document.getElementById('win-modal').style.display = 'flex';
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function startTimer() {
  const el = document.getElementById('play-timer');
  timerInterval = setInterval(() => {
    timerSeconds++;
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }, 1000);
}
