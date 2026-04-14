/**
 * storage.js
 * Firebase Firestore helpers for puzzles.
 *
 * NOTE: Firestore does not support nested arrays (arrays of arrays).
 * The 2D cells array is flattened before saving and reconstructed on load.
 *
 * Puzzle schema in Firestore (collection: "puzzles"):
 *   id, title, author, date, createdAt, updatedAt,
 *   rows, cols,
 *   cells: flat array of { black, letter },
 *   clues: { across: { "1": "...", ... }, down: { ... } }
 */

const Storage = (() => {
  let db   = null;
  let auth = null;

  function init() {
    db   = firebase.firestore();
    auth = firebase.auth();
  }

  // Reconstruct 2D array from flat array
  function unflattenCells(flat, rows, cols) {
    const cells = [];
    for (let r = 0; r < rows; r++) {
      cells[r] = flat.slice(r * cols, (r + 1) * cols);
    }
    return cells;
  }

  async function savePuzzle(puzzle) {
    if (!puzzle.id)        puzzle.id        = 'cw_' + Date.now();
    if (!puzzle.date)      puzzle.date      = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (!puzzle.createdAt) puzzle.createdAt = Date.now();
    puzzle.updatedAt = Date.now();

    // Flatten the 2D cells array for Firestore
    const toSave = { ...puzzle, cells: puzzle.cells.flat() };
    await db.collection('puzzles').doc(puzzle.id).set(toSave);
    return puzzle.id;
  }

  async function loadPuzzle(id) {
    try {
      const doc = await db.collection('puzzles').doc(id).get();
      if (!doc.exists) return null;
      const data = doc.data();
      data.cells = unflattenCells(data.cells, data.rows, data.cols);
      return data;
    } catch (e) {
      console.error('loadPuzzle error:', e);
      return null;
    }
  }

  async function deletePuzzle(id) {
    await db.collection('puzzles').doc(id).delete();
  }

  async function listPuzzles() {
    const snap = await db.collection('puzzles').get();
    const docs = snap.docs.map(doc => {
      const data = doc.data();
      data.cells = unflattenCells(data.cells, data.rows, data.cols);
      return data;
    });
    // Sort newest first in JS — avoids Firestore index requirements
    return docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  function getAuth() { return auth; }

  return { init, savePuzzle, loadPuzzle, deletePuzzle, listPuzzles, getAuth };
})();
