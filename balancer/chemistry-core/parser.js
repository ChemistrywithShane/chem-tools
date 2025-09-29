// Parses chemical formulas incl. parentheses, hydrates (·, ., or *), and charges (^2-, ^+, etc.).
// Returns an element-count map; charge (if present) is stored under the key "(charge)".
export function parseFormula(str) {
  if (!str) return {};

  // 1) Normalise separators & whitespace
  let s = String(str).trim().replace(/\s+/g, '');
  s = s.replace(/·/g, '*');                 // middle dot -> *
  s = s.replace(/\.(?=(\d+)?H2O\b)/gi, '*'); // plain dot before H2O -> *
  // leave '^...+/-' charge tail for us to read now

  // 2) Pull charge tail like ^2-, ^-, ^3+, ^+
  let charge = 0;
  const mCharge = s.match(/\^([0-9]*)\s*([+-])$/);
  if (mCharge) {
    const mag = mCharge[1] ? parseInt(mCharge[1], 10) : 1;
    const sign = (mCharge[2] === '-') ? -1 : +1;
    charge = sign * mag;
    s = s.slice(0, mCharge.index); // strip charge suffix
  }

  // 3) Split hydrate fragments on *
  const parts = s.split('*').filter(Boolean);

  // 4) Accumulate counts (core + hydrate fragments)
  const total = {};
  for (const frag of parts) {
    // hydrate shorthand "nH2O"
    const hyd = frag.match(/^([0-9]+)H2O$/i);
    if (hyd) {
      const n = parseInt(hyd[1], 10);
      total['H'] = (total['H'] || 0) + 2 * n;
      total['O'] = (total['O'] || 0) + 1 * n;
      continue;
    }
    // normal core with parentheses/multipliers
    add(total, parseCore(frag));
  }
  if (charge !== 0) total['(charge)'] = (total['(charge)'] || 0) + charge;
  return total;
}

// Build stoichiometry matrix from reactant/product lists.
// includeCharge: whether to include a charge-balance row.
export function buildMatrixFromReaction(reactants, products, includeCharge = false) {
  const species = [...reactants, ...products];
  const parsed = species.map(parseFormula);

  const elems = new Set();
  for (const m of parsed) {
    for (const k of Object.keys(m)) {
      if (k === '(charge)' && !includeCharge) continue;
      elems.add(k);
    }
  }
  const rows = Array.from(elems);
  const A = rows.map(() => Array(species.length).fill(0));

  rows.forEach((el, r) => {
    species.forEach((_, c) => {
      const v = parsed[c][el] || 0;
      A[r][c] = (c < reactants.length) ? v : -v;
    });
  });

  return { A, rows, species };
}

// ---------- internal: parse a single fragment (no '*' left) ----------
function parseCore(formula) {
  let i = 0;
  const len = formula.length;

  function readNumber() {
    let num = '';
    while (i < len && /[0-9]/.test(formula[i])) num += formula[i++];
    return num ? parseInt(num, 10) : 1;
  }

  function readElement() {
    if (i >= len || !/[A-Z]/.test(formula[i])) return null;
    let sym = formula[i++];                      // capital
    if (i < len && /[a-z]/.test(formula[i])) sym += formula[i++]; // optional lowercase
    return sym;
  }

  function parseGroup() {
    const out = {};
    while (i < len) {
      const ch = formula[i];

      if (ch === '(') {
        i++; // skip '('
        const inner = parseGroup();
        if (i >= len || formula[i] !== ')') throw new Error('Unmatched "(" in ' + formula);
        i++; // ')'
        const mult = readNumber();
        scaleAndAdd(out, inner, mult);
        continue;
      }
      if (ch === ')') break;

      const el = readElement();
      if (el) {
        const n = readNumber();
        out[el] = (out[el] || 0) + n;
        continue;
      }

      // Unexpected character -> stop to avoid infinite loop
      throw new Error('Unexpected "' + ch + '" in ' + formula + ' at ' + i);
    }
    return out;
  }

  return parseGroup();
}

// ---------- small helpers ----------
function add(dst, src) {
  for (const k in src) dst[k] = (dst[k] || 0) + src[k];
}
function scaleAndAdd(dst, src, m) {
  for (const k in src) dst[k] = (dst[k] || 0) + m * src[k];
}
