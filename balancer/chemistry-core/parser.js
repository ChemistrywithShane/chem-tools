// Parses chemical formulas incl. parentheses, hydrates (· or *), and charges (^2-, ^+, etc.).
// Returns an element-count map; charge (if present) is stored under the key "(charge)".
export function parseFormula(str){
  let s = str.replace(/\s+/g,'').replace('→','->');
  const parts = s.split(/·|\*/g);           // support middle dot or '*' for hydrates
  const counts = {};
  for(const partRaw of parts){
    if(!partRaw) continue;
    const mCharge = partRaw.match(/\^(?:([0-9]+)?([+-]))$/);
    let core = partRaw;
    if(mCharge){
      core = partRaw.slice(0, mCharge.index);
      const mag = mCharge[1] ? parseInt(mCharge[1],10) : 1;
      const sign = mCharge[2] === '+' ? -1 : +1; // electrons negative
      counts['(charge)'] = (counts['(charge)']||0) + sign*mag;
    }
    const local = parseCore(core);
    for(const k in local){ counts[k] = (counts[k]||0) + local[k]; }
  }
  return counts;
}

function parseCore(f){
  let i=0;
  function readNum(){ let n=''; while(i<f.length && /[0-9]/.test(f[i])) n+=f[i++]; return n?parseInt(n,10):1; }
  function merge(dst,src,m=1){ for(const k in src){ dst[k]=(dst[k]||0)+src[k]*m; } }
  function parseGroup(){
    const out={};
    while(i<f.length){
      const ch=f[i];
      if(ch==='('){
        i++; const inner=parseGroup();
        if(f[i]!==')') throw new Error('Missing )');
        i++; const mult=readNum(); merge(out,inner,mult); continue;
      }
      if(ch===')'){ break; }
      if(/[0-9]/.test(ch)){
        const mult=readNum();
        if(f[i]==='('){
          i++; const inner=parseGroup(); if(f[i]!==')') throw new Error('Missing )'); i++; merge(out,inner,mult);
        }else{
          const el=readElement(); const sub=readNum(); out[el]=(out[el]||0)+sub*mult;
        }
        continue;
      }
      if(/[A-Z]/.test(ch)){
        const el=readElement(); const sub=readNum(); out[el]=(out[el]||0)+sub; continue;
      }
      break;
    }
    return out;
  }
  function readElement(){ if(!/[A-Z]/.test(f[i])) throw new Error('Expected element at '+i); let el=f[i++]; if(i<f.length && /[a-z]/.test(f[i])) el+=f[i++]; return el; }
  return parseGroup();
}

// Build stoichiometry matrix from reactant/product lists
export function buildMatrixFromReaction(reactants, products, includeCharge=false){
  const species=[...reactants, ...products];
  const parsed=species.map(parseFormula);
  const set=new Set();
  parsed.forEach(m => Object.keys(m).forEach(k => { if(k!=='(charge)' || includeCharge) set.add(k); }));
  const rows=Array.from(set);
  const A = rows.map(()=>Array(species.length).fill(0));
  rows.forEach((el, r) => {
    species.forEach((sp, c) => {
      const v = parsed[c][el] || 0;
      A[r][c] = c < reactants.length ? v : -v;
    });
  });
  return {A, rows, species};
}
