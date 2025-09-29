export function gcd(a,b){ a=Math.abs(a); b=Math.abs(b); while(b){ [a,b]=[b,a%b]; } return a||1; }
export function lcm(a,b){ return Math.abs(a*b)/gcd(a,b); }
export function toRational(n){ return {n: BigInt(n), d: 1n}; }
export function norm(x){
  if (x.d < 0n){ x.n = -x.n; x.d = -x.d; }
  const g = gcd(Number(x.n < 0n ? -x.n : x.n), Number(x.d));
  x.n /= BigInt(g || 1); x.d /= BigInt(g || 1);
  return x;
}
export function add(x,y){ return norm({n:x.n*y.d + y.n*x.d, d:x.d*y.d}); }
export function sub(x,y){ return add(x, {n:-y.n, d:y.d}); }
export function mul(x,y){ return norm({n:x.n*y.n, d:x.d*y.d}); }
export function div(x,y){ return norm({n:x.n*y.d, d:x.d*y.n}); }

export function nullspaceVector(A){
  const rows = A.length, cols = A[0].length;
  if (rows === 0) return Array(cols).fill(1); // safety: degenerate input
  const M = A.map(r => r.map(v => norm(toRational(v))));
  let r=0;
  for(let c=0;c<cols && r<rows;c++){
    let piv=r; while(piv<rows && M[piv][c].n===0n) piv++;
    if(piv===rows) continue;
    [M[r], M[piv]] = [M[piv], M[r]];
    const pivval = M[r][c];
    for(let j=c;j<cols;j++) M[r][j] = div(M[r][j], pivval);
    for(let i=0;i<rows;i++){
      if(i===r) continue;
      const factor = M[i][c];
      if(factor.n!==0n){
        for(let j=c;j<cols;j++) M[i][j] = sub(M[i][j], mul(factor, M[r][j]));
      }
    }
    r++;
  }
  const pivot = Array(cols).fill(false);
  for(let i=0;i<rows;i++){
    const j = M[i].findIndex(x=>x.n===1n && x.d===1n);
    if(j>=0) pivot[j] = true;
  }
  let free = -1;
  for(let c=cols-1;c>=0;c--) if(!pivot[c]) { free=c; break; }
  if(free===-1) free = cols-1; // fully determined -> choose last

  const sol = Array(cols).fill(null).map(()=>toRational(0));
  sol[free] = toRational(1);
  for(let i=rows-1;i>=0;i--){
    const j = M[i].findIndex(x=>x.n===1n && x.d===1n);
    if(j<0) continue;
    let s = toRational(0);
    for(let c=j+1;c<cols;c++){
      if(M[i][c].n!==0n) s = add(s, mul(M[i][c], sol[c]));
    }
    sol[j] = norm({n:-s.n, d:s.d});
  }

  // scale → smallest positive integers
  let L = 1; for(const v of sol){ L = lcm(L, Math.max(1, Number(v.d))); }
  let ints = sol.map(v => Number(v.n) * (L/Math.max(1, Number(v.d))));
  let g = 0; for(const x of ints) g = gcd(g, Math.abs(x));
  g = g || 1; ints = ints.map(x => x / g);

  // HARDEN: avoid the all-zero trap; ensure positivity
  if (ints.every(x => x === 0)) {
    ints = Array(cols).fill(0); ints[free] = 1;
  }
  if (ints.every(x => x <= 0)) ints = ints.map(x => -x);
  return ints;
}
