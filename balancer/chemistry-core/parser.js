// Parses chemical formulas incl. parentheses, hydrates (·, ., or *), and charges (^2-, ^+, etc).
// Returns an element count map; charge (if present) is stored under the key "charge".
export function parseFormula(str) {
  if (!str) return {};

  // 1) Normalise: remove whitespace; turn hydrate separators into '*'
  //    Accept: middle dot `·`, explicit `*`, and a dot just before H2O like "CuSO4.5H2O"
  let s = String(str).trim().replace(/\s+/g, '');
  s = s.replace(/·/g, '*');
  s = s.replace(/\.(?=(\d+)?H2O\b)/gi, '*'); // e.g. CuSO4.5H2O -> CuSO4*5H2O

  // 2) Extract an overall ionic charge at the end (optional):
  //    Supported tails: ^2-, ^-, ^3+, ^+
  //    If absent, charge = 0
  let charge = 0;
  const chargeMatch = s.match(/\^([0-9]*)\s*([+-])$/);
  if (chargeMatch) {
    const mag = chargeMatch[1] ? parseInt(chargeMatch[1], 10) : 1;
    const sign = (chargeMatch[2] === '-') ? -1 : +1;
    charge = sign * mag;
    s = s.slice(0, chargeMatch.index); // strip the charge tail from the formula
  }

  // 3) Split on '*' which (after normalisation) means "hydrate part"
  //    e.g. "CuSO4*5H2O" => ["CuSO4", "5H2O"]
  const parts = s.split('*').filter(Boolean);

  // 4) Accumulate counts across all parts (core + hydrates)
  const total = {};
  for (const raw of parts) {
    // Hydrate shorthand: "nH2O" where n is integer
    const hyd = raw.match(/^([0-9]+)H2O$/i);
    if (hyd) {
      const n = parseInt(hyd[1], 10);
      add(total, { H: 2 * n, O: 1 * n });
      continue;
    }

    // Otherwise parse a regular core fragment with parentheses, multipliers etc.
    const coreCounts = parseCore(raw);
    add(total, coreCounts);
  }

  if (charge !== 0) total['charge'] = (total['charge'] || 0) + charge;
  return total;
}

// ---- parser for a single fragment (no '*' left), handling parentheses and multipliers ----
function parseCore(formula) {
  let i = 0;
  const len = formula.length;

  function readNumber() {
    let num = '';
    while (i < len && /[0-9]/.test(formula[i])) { num += formula[i++]; }
    return num ? parseInt(num, 10) : 1;
  }

  function readElement() {
    if (i >= len || !/[A-Z]/.test(formula[i])) return null;
    let sym = formula[i++]; // uppercase
    if (i < len && /[a-z]/.test(formula[i])) sym += formula[i++]; // optional lowercase
    return sym;
  }

  function parseGroup() {
    const out = {};
    while (i < len) {
      const ch = formula[i];

      if (ch === '(') {
        i++; // skip '('
        const inner = parseGroup(); // parse recursively
        if (i >= len || formula[i] !== ')') {
          throw new Error('Unmatched "(" in ' + formula);
        }
        i++; // skip ')'
        const mult = readNumber();
        scaleAndAdd(out, inner, mult);
        continue;
      }

      if (ch === ')') {
        // group end - handled by caller
        break;
      }

      // Element symbol
      const el = readElement();
      if (el) {
        const n = readNumber();
        out[el] = (out[el] || 0) + n;
        continue;
      }

      // Anything else means we've reached an unexpected character
      // Common benign case: we already stripped charge; so throw if encountered.
      throw new Error('Unexpected character "' + ch + '" in ' + formula + ' at ' + i);
    }
    return out;
  }

  return parseGroup();
}

// ---- helpers ----
function scaleAndAdd(target, src, k) {
  for (const key in src) {
    target[key] = (target[key] || 0) + k * src[key];
  }
}

function add(target, src) {
  for (const key in src) {
    target[key] = (target[key] || 0) + src[key];
  }
}

