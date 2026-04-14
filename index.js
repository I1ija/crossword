/**
 * index.js – Front page: list puzzles, render canvas preview thumbnails.
 */

document.getElementById('header-date').textContent =
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

Storage.init();

function renderPreview(puzzle, canvas) {
  const ctx = canvas.getContext('2d');
  const size = 180;
  canvas.width = size;
  canvas.height = size;
  const cw = size / puzzle.cols;
  const ch = size / puzzle.rows;

  ctx.fillStyle = '#fefefe';
  ctx.fillRect(0, 0, size, size);

  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const cell = puzzle.cells[r][c];
      if (cell.black) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(c * cw, r * ch, cw, ch);
      } else {
        ctx.strokeStyle = '#aaa49a';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(c * cw + 0.25, r * ch + 0.25, cw - 0.5, ch - 0.5);
      }
    }
  }

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
}

async function renderPuzzles() {
  const grid  = document.getElementById('puzzle-grid');
  const empty = document.getElementById('empty-state');

  grid.innerHTML = '<p class="loading-msg">Loading puzzles…</p>';
  grid.style.display = 'block';
  empty.style.display = 'none';

  try {
    const puzzles = await Storage.listPuzzles();

    if (!puzzles.length) {
      grid.style.display = 'none';
      empty.style.display = 'block';
      return;
    }

    grid.style.display = '';
    grid.innerHTML = '';

    puzzles.forEach(puzzle => {
      const a = document.createElement('a');
      a.className = 'puzzle-card';
      a.href = `play.html?id=${puzzle.id}`;

      const previewDiv = document.createElement('div');
      previewDiv.className = 'card-preview';
      const canvas = document.createElement('canvas');
      previewDiv.appendChild(canvas);
      renderPreview(puzzle, canvas);

      const titleEl = document.createElement('div');
      titleEl.className = 'card-title';
      titleEl.textContent = puzzle.title || 'Untitled';

      const metaEl = document.createElement('div');
      metaEl.className = 'card-meta';
      metaEl.textContent = puzzle.author ? `By ${puzzle.author}` : '';

      const dateEl = document.createElement('div');
      dateEl.className = 'card-date';
      dateEl.textContent = puzzle.date || '';

      a.append(previewDiv, titleEl, metaEl, dateEl);
      grid.appendChild(a);
    });

  } catch (err) {
    console.error('listPuzzles error:', err);
    const msg = err.code === 'permission-denied'
      ? 'Permission denied — update your Firestore rules to allow public reads.'
      : (err.message || 'Unknown error. Check the browser console.');
    grid.innerHTML = `<p class="loading-msg" style="color:#c0392b">Failed to load puzzles: ${msg}</p>`;
  }
}

renderPuzzles();

