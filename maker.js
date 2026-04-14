/**
 * maker.js – Crossword Maker (Firebase + Auth version)
 *
 * Modes:
 *   black  – click/drag to toggle black squares (Shift mirrors symmetrically)
 *   letter – click cell to select, type letters
 *
 * Numbering is auto-computed.
 * Clue inputs are generated after numbering.
 * Publish saves to Firestore and appears on front page immediately.
 * Authentication required to publish/edit/delete.
 */

// ─── State ───────────────────────────────────────────────────────────────────
let rows = 15, cols = 15;
let cells = []; // cells[r][c] = { black, letter }
let mode = 'black';
let selectedCell = null; // { r, c }
let selectedDir = 'across'; // 'across' | 'down'
let isDragging = false;
let dragValue = null; // true = painting black, false = clearing
let editingId = null; // id of puzzle being edited
let clueData = { across: {}, down: {} }; // { "1": "clue text" }
let numbering = []; // numbering[r][c] = number | 0

// ─── Init ─────────────────────────────────────────────────────────────────────
let makerInited = false;

document.addEventListener('DOMContentLoaded', () => {
  Storage.init();

  // ── Auth state observer ───────────────────────────────────────────────────
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      document.getElementById('login-overlay').style.display  = 'none';
      document.getElementById('maker-content').style.display  = 'flex';
      document.getElementById('maker-user-email').textContent = user.email;
      document.getElementById('logout-btn').style.display     = '';
      if (!makerInited) { makerInited = true; initMaker(); }
    } else {
      document.getElementById('login-overlay').style.display  = 'flex';
      document.getElementById('maker-content').style.display  = 'none';
      document.getElementById('maker-user-email').textContent = '';
      document.getElementById('logout-btn').style.display     = 'none';
    }
  });

  // ── Login form ────────────────────────────────────────────────────────────
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl  = document.getElementById('login-error');
    errorEl.textContent = '';
    document.getElementById('login-btn').textContent = 'Signing in…';
    try {
      await firebase.auth().signInWithEmailAndPassword(email, password);
    } catch (e) {
      errorEl.textContent = 'Login failed: ' + (e.message || 'Invalid credentials');
      document.getElementById('login-btn').textContent = 'Sign In';
    }
  });

  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', () => firebase.auth().signOut());
});

function initMaker() {
  buildGrid(rows, cols);
  populateLoadSelect();
  bindUI();
};

function buildGrid(r, c, existingCells) {
  rows = r; cols = c;
  cells = [];
  for (let i = 0; i < rows; i++) {
    cells[i] = [];
    for (let j = 0; j < cols; j++) {
      cells[i][j] = existingCells ? { ...existingCells[i][j] } : { black: false, letter: '' };
    }
  }
  renderGrid();
  computeNumbering();
  renderClueInputs();
}

// ─── Grid Rendering ───────────────────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('maker-grid');
  grid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  grid.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;
  grid.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      div.dataset.r = r;
      div.dataset.c = c;
      if (cells[r][c].black) div.classList.add('black');

      const numSpan = document.createElement('span');
      numSpan.className = 'cell-number';
      div.appendChild(numSpan);

      const letterSpan = document.createElement('span');
      letterSpan.className = 'cell-letter';
      letterSpan.textContent = cells[r][c].letter || '';
      div.appendChild(letterSpan);

      // Events
      div.addEventListener('mousedown', onCellMouseDown);
      div.addEventListener('mouseenter', onCellMouseEnter);
      div.addEventListener('click', onCellClick);

      grid.appendChild(div);
    }
  }

  document.addEventListener('mouseup', () => { isDragging = false; dragValue = null; }, { once: false });
}

function getCellEl(r, c) {
  return document.querySelector(`#maker-grid .cell[data-r="${r}"][data-c="${c}"]`);
}

function updateCellEl(r, c) {
  const el = getCellEl(r, c);
  if (!el) return;
  const cell = cells[r][c];
  el.classList.toggle('black', cell.black);
  el.querySelector('.cell-letter').textContent = cell.black ? '' : (cell.letter || '');
  const numSpan = el.querySelector('.cell-number');
  numSpan.textContent = numbering[r] && numbering[r][c] ? numbering[r][c] : '';
}

// ─── Numbering ────────────────────────────────────────────────────────────────
function computeNumbering() {
  numbering = [];
  for (let i = 0; i < rows; i++) { numbering[i] = new Array(cols).fill(0); }

  let n = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r][c].black) continue;
      const startsAcross = (c === 0 || cells[r][c - 1].black) && (c + 1 < cols && !cells[r][c + 1].black);
      const startsDown = (r === 0 || cells[r - 1][c].black) && (r + 1 < rows && !cells[r + 1][c].black);
      if (startsAcross || startsDown) {
        numbering[r][c] = n++;
      }
    }
  }

  // Update DOM numbers
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const el = getCellEl(r, c);
      if (!el) continue;
      const numSpan = el.querySelector('.cell-number');
      numSpan.textContent = numbering[r][c] || '';
    }
  }
}

// ─── Word navigation helpers ──────────────────────────────────────────────────
function wordStart(r, c, dir) {
  if (dir === 'across') {
    while (c > 0 && !cells[r][c - 1].black) c--;
    return { r, c };
  } else {
    while (r > 0 && !cells[r - 1][c].black) r--;
    return { r, c };
  }
}

function wordCells(r, c, dir) {
  const result = [];
  const start = wordStart(r, c, dir);
  let { r: sr, c: sc } = start;
  if (dir === 'across') {
    while (sc < cols && !cells[sr][sc].black) { result.push({ r: sr, c: sc }); sc++; }
  } else {
    while (sr < rows && !cells[sr][sc].black) { result.push({ r: sr, c: sc }); sr++; }
  }
  return result;
}

function highlightWord() {
  // Clear all highlights
  document.querySelectorAll('#maker-grid .cell').forEach(el => {
    el.classList.remove('selected', 'word-highlight');
  });
  if (!selectedCell) return;
  const { r, c } = selectedCell;
  if (cells[r][c].black) return;

  const wc = wordCells(r, c, selectedDir);
  wc.forEach(({ r: wr, c: wc_ }) => {
    const el = getCellEl(wr, wc_);
    if (el) el.classList.add('word-highlight');
  });
  const selEl = getCellEl(r, c);
  if (selEl) { selEl.classList.remove('word-highlight'); selEl.classList.add('selected'); }
}

// ─── Cell Events ──────────────────────────────────────────────────────────────
function onCellMouseDown(e) {
  if (mode !== 'black') return;
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;
  isDragging = true;
  dragValue = !cells[r][c].black;
  toggleBlack(r, c, dragValue, e.shiftKey);
  e.preventDefault();
}

function onCellMouseEnter(e) {
  if (!isDragging || mode !== 'black') return;
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;
  toggleBlack(r, c, dragValue, false);
}

function onCellClick(e) {
  const r = +e.currentTarget.dataset.r;
  const c = +e.currentTarget.dataset.c;

  if (mode === 'black') return; // handled by mousedown

  if (mode === 'letter') {
    if (cells[r][c].black) return;
    if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
      // Toggle direction
      selectedDir = selectedDir === 'across' ? 'down' : 'across';
    } else {
      selectedCell = { r, c };
    }
    highlightWord();
    focusMakerInput();
  }
}

function toggleBlack(r, c, value, mirror) {
  cells[r][c].black = value;
  if (value) cells[r][c].letter = '';
  if (mirror) {
    const mr = rows - 1 - r, mc = cols - 1 - c;
    cells[mr][mc].black = value;
    if (value) cells[mr][mc].letter = '';
    updateCellEl(mr, mc);
  }
  updateCellEl(r, c);
  computeNumbering();
  renderClueInputs();
}

// ─── Keyboard (letter mode) ───────────────────────────────────────────────────
let hiddenInput = null;

function focusMakerInput() {
  if (!hiddenInput) {
    hiddenInput = document.createElement('input');
    hiddenInput.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px;';
    hiddenInput.setAttribute('autocomplete', 'off');
    hiddenInput.setAttribute('autocorrect', 'off');
    hiddenInput.setAttribute('autocapitalize', 'characters');
    document.body.appendChild(hiddenInput);
    hiddenInput.addEventListener('keydown', onMakerKeyDown);
    hiddenInput.addEventListener('input', onMakerInput);
  }
  hiddenInput.focus();
}

function onMakerInput(e) {
  // For mobile / IME
  const val = hiddenInput.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
  hiddenInput.value = '';
  if (!val || !selectedCell) return;
  typeLetterMaker(val[val.length - 1]);
}

function onMakerKeyDown(e) {
  if (!selectedCell) return;
  const { r, c } = selectedCell;

  if (e.key === 'Backspace') {
    if (cells[r][c].letter) {
      cells[r][c].letter = '';
      updateCellEl(r, c);
    } else {
      moveSelection(-1);
    }
    e.preventDefault();
    return;
  }
  if (e.key === 'Delete') {
    cells[r][c].letter = '';
    updateCellEl(r, c);
    e.preventDefault();
    return;
  }
  if (e.key === 'Tab') {
    jumpToNextWord(e.shiftKey);
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowRight') { selectedCell = moveDir(r, c, 0, 1); selectedDir = 'across'; highlightWord(); e.preventDefault(); return; }
  if (e.key === 'ArrowLeft')  { selectedCell = moveDir(r, c, 0, -1); selectedDir = 'across'; highlightWord(); e.preventDefault(); return; }
  if (e.key === 'ArrowDown')  { selectedCell = moveDir(r, c, 1, 0); selectedDir = 'down'; highlightWord(); e.preventDefault(); return; }
  if (e.key === 'ArrowUp')    { selectedCell = moveDir(r, c, -1, 0); selectedDir = 'down'; highlightWord(); e.preventDefault(); return; }
  if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
    typeLetterMaker(e.key.toUpperCase());
    e.preventDefault();
  }
}

function typeLetterMaker(letter) {
  if (!selectedCell) return;
  const { r, c } = selectedCell;
  if (cells[r][c].black) return;
  cells[r][c].letter = letter;
  updateCellEl(r, c);
  moveSelection(1);
}

function moveSelection(delta) {
  if (!selectedCell) return;
  const { r, c } = selectedCell;
  if (selectedDir === 'across') {
    const nc = c + delta;
    if (nc >= 0 && nc < cols && !cells[r][nc].black) { selectedCell = { r, c: nc }; }
  } else {
    const nr = r + delta;
    if (nr >= 0 && nr < rows && !cells[nr][c].black) { selectedCell = { r: nr, c }; }
  }
  highlightWord();
}

function moveDir(r, c, dr, dc) {
  const nr = r + dr, nc = c + dc;
  if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || cells[nr][nc].black) return { r, c };
  return { r: nr, c: nc };
}

function jumpToNextWord(reverse) {
  // Collect all word starts
  const words = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!cells[r][c].black) {
      const n = numbering[r][c];
      if (!n) continue;
      const sa = (c === 0 || cells[r][c-1].black) && (c+1 < cols && !cells[r][c+1].black);
      const sd = (r === 0 || cells[r-1][c].black) && (r+1 < rows && !cells[r+1][c].black);
      if (sa) words.push({ r, c, dir: 'across', num: n });
      if (sd) words.push({ r, c, dir: 'down', num: n });
    }
  }
  words.sort((a, b) => a.num - b.num || (a.dir === 'across' ? -1 : 1));
  if (!words.length) return;

  const cur = words.findIndex(w => w.dir === selectedDir && selectedCell &&
    wordStart(selectedCell.r, selectedCell.c, selectedDir).r === w.r &&
    wordStart(selectedCell.r, selectedCell.c, selectedDir).c === w.c);
  let next = reverse ? cur - 1 : cur + 1;
  if (next >= words.length) next = 0;
  if (next < 0) next = words.length - 1;
  const w = words[next];
  selectedCell = { r: w.r, c: w.c };
  selectedDir = w.dir;
  highlightWord();
}

// ─── Clue Inputs ──────────────────────────────────────────────────────────────
function renderClueInputs() {
  const acrossDiv = document.getElementById('clues-across');
  const downDiv = document.getElementById('clues-down');
  acrossDiv.innerHTML = '';
  downDiv.innerHTML = '';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = numbering[r][c];
      if (!n) continue;
      const sa = (c === 0 || cells[r][c-1].black) && (c+1 < cols && !cells[r][c+1].black);
      const sd = (r === 0 || cells[r-1][c].black) && (r+1 < rows && !cells[r+1][c].black);
      if (sa) acrossDiv.appendChild(makeClueInput(n, 'across'));
      if (sd) downDiv.appendChild(makeClueInput(n, 'down'));
    }
  }
}

function makeClueInput(num, dir) {
  const group = document.createElement('div');
  group.className = 'clue-input-group';
  const numSpan = document.createElement('span');
  numSpan.className = 'clue-input-num';
  numSpan.textContent = num;
  const ta = document.createElement('textarea');
  ta.className = 'clue-input';
  ta.rows = 2;
  ta.placeholder = `${num} ${dir}…`;
  ta.value = clueData[dir][num] || '';
  ta.addEventListener('input', () => { clueData[dir][num] = ta.value; });
  group.append(numSpan, ta);
  return group;
}

// ─── Mode Buttons ─────────────────────────────────────────────────────────────
function bindUI() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('mode-hint').textContent =
        mode === 'black'
          ? 'Click cells to toggle black squares. Hold Shift to mirror.'
          : 'Click a cell then type letters. Tab = next word. Arrow keys to navigate.';
      if (mode === 'letter') focusMakerInput();
      else { selectedCell = null; highlightWord(); }
    });
  });

  document.getElementById('new-grid-btn').addEventListener('click', () => {
    const r = parseInt(document.getElementById('grid-rows').value) || 15;
    const c = parseInt(document.getElementById('grid-cols').value) || 15;
    if (confirm(`Create a new ${r}×${c} grid? This will clear the current grid.`)) {
      editingId = null;
      clueData = { across: {}, down: {} };
      buildGrid(r, c);
    }
  });

  document.getElementById('publish-btn').addEventListener('click', publishPuzzle);

  document.getElementById('load-btn').addEventListener('click', async () => {
    const id = document.getElementById('load-select').value;
    if (!id) return;
    await loadPuzzleIntoMaker(id);
  });

  document.getElementById('delete-btn').addEventListener('click', async () => {
    const id = document.getElementById('load-select').value;
    if (!id) return;
    if (confirm('Delete this puzzle? This cannot be undone.')) {
      try {
        await Storage.deletePuzzle(id);
        if (editingId === id) {
          editingId = null;
          clueData = { across: {}, down: {} };
          buildGrid(15, 15);
        }
        await populateLoadSelect();
      } catch (e) {
        alert('Error deleting puzzle: ' + e.message);
      }
    }
  });

  document.addEventListener('mouseup', () => { isDragging = false; });
}

// ─── Publish ──────────────────────────────────────────────────────────────────
async function publishPuzzle() {
  const title  = document.getElementById('puzzle-title').value.trim() || 'Untitled';
  const author = document.getElementById('puzzle-author').value.trim();
  const msg    = document.getElementById('publish-msg');

  // Collect current clue values from DOM
  document.querySelectorAll('#clues-across .clue-input-group').forEach(g => {
    const num = +g.querySelector('.clue-input-num').textContent;
    clueData.across[num] = g.querySelector('.clue-input').value;
  });
  document.querySelectorAll('#clues-down .clue-input-group').forEach(g => {
    const num = +g.querySelector('.clue-input-num').textContent;
    clueData.down[num] = g.querySelector('.clue-input').value;
  });

  const puzzle = {
    id: editingId || null,
    title,
    author,
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    rows,
    cols,
    cells: cells.map(row => row.map(cell => ({ black: cell.black, letter: cell.letter }))),
    clues: { across: { ...clueData.across }, down: { ...clueData.down } }
  };
  if (editingId) puzzle.createdAt = puzzle.createdAt; // preserve if editing

  msg.style.color = '';
  msg.textContent = 'Publishing…';
  document.getElementById('publish-btn').disabled = true;

  try {
    const id = await Storage.savePuzzle(puzzle);
    editingId = id;
    await populateLoadSelect();
    msg.textContent = '✓ Published! View on front page.';
    setTimeout(() => { msg.textContent = ''; }, 4000);
  } catch (e) {
    msg.style.color = '#c0392b';
    msg.textContent = '✗ Error: ' + e.message;
  } finally {
    document.getElementById('publish-btn').disabled = false;
  }
}

// ─── Load Puzzle ──────────────────────────────────────────────────────────────
async function populateLoadSelect() {
  const sel = document.getElementById('load-select');
  const current = sel.value || editingId;
  sel.innerHTML = '<option value="">Loading…</option>';
  try {
    const puzzles = await Storage.listPuzzles();
    sel.innerHTML = '<option value="">— select a puzzle —</option>';
    puzzles.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = (p.title || 'Untitled') + (p.author ? ` — ${p.author}` : '');
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  } catch {
    sel.innerHTML = '<option value="">— error loading —</option>';
  }
}

async function loadPuzzleIntoMaker(id) {
  try {
    const puzzle = await Storage.loadPuzzle(id);
    if (!puzzle) return alert('Puzzle not found.');
    editingId = id;
    clueData = { across: { ...(puzzle.clues.across || {}) }, down: { ...(puzzle.clues.down || {}) } };
    document.getElementById('puzzle-title').value  = puzzle.title || '';
    document.getElementById('puzzle-author').value = puzzle.author || '';
    document.getElementById('grid-rows').value = puzzle.rows;
    document.getElementById('grid-cols').value = puzzle.cols;
    buildGrid(puzzle.rows, puzzle.cols, puzzle.cells);

    // Re-apply clue values into newly rendered inputs
    document.querySelectorAll('#clues-across .clue-input-group').forEach(g => {
      const num = +g.querySelector('.clue-input-num').textContent;
      g.querySelector('.clue-input').value = clueData.across[num] || '';
    });
    document.querySelectorAll('#clues-down .clue-input-group').forEach(g => {
      const num = +g.querySelector('.clue-input-num').textContent;
      g.querySelector('.clue-input').value = clueData.down[num] || '';
    });
  } catch (e) {
    alert('Error loading puzzle: ' + e.message);
  }
}
