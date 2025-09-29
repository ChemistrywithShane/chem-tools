import { buildMatrixFromReaction } from "../chemistry-core/parser.js";
import { nullspaceVector } from "../chemistry-core/matrix.js";

function assertArrayEqual(a,b,msg){
  const ja=JSON.stringify(a), jb=JSON.stringify(b);
  if(ja!==jb){ throw new Error((msg||"assertArrayEqual failed") + "\n" + ja + "\n" + jb); }
}

console.log("solver.spec.js: start");

// H2 + O2 -> H2O  =>  2,1,2
{
  const {A} = buildMatrixFromReaction(["H2","O2"],["H2O"]);
  const v = nullspaceVector(A);
  assertArrayEqual(v, [2,1,2], "water formation");
}

// C3H8 + O2 -> CO2 + H2O => 1,5,3,4
{
  const {A} = buildMatrixFromReaction(["C3H8","O2"],["CO2","H2O"]);
  const v = nullspaceVector(A);
  assertArrayEqual(v, [1,5,3,4], "propane combustion");
}

// Fe + O2 -> Fe2O3 => 4,3,2
{
  const {A} = buildMatrixFromReaction(["Fe","O2"],["Fe2O3"]);
  const v = nullspaceVector(A);
  assertArrayEqual(v, [4,3,2], "iron oxide formation");
}

// KMnO4 -> K2MnO4 + MnO2 + O2
{
  const {A} = buildMatrixFromReaction(["KMnO4"],["K2MnO4","MnO2","O2"]);
  const v = nullspaceVector(A);
  assertArrayEqual(v, [2,1,1,1], "KMnO4 disproportionation");
}

console.log("solver.spec.js: ok");
// Hydrate balancing: CuSO4·5H2O -> CuSO4 + H2O  => 1,1,5
{
  const { buildMatrixFromReaction } = await import("../chemistry-core/parser.js");
  const { nullspaceVector } = await import("../chemistry-core/matrix.js");
  const {A} = buildMatrixFromReaction(["CuSO4·5H2O"], ["CuSO4","H2O"]);
  const v = nullspaceVector(A);
  // Allow either [1,1,5] or any positive scalar multiple (e.g., [2,2,10])
  const g = (arr)=>arr.reduce((g,x)=>{ x=Math.abs(x); while(x){ [g,x]=[x,g%x]; } return g; },0)||1;
  const norm = v.map(x=>x/g(v));
  if(!(norm[0]===1 && norm[1]===1 && norm[2]===5)){
    throw new Error("hydrate balancing failed: got "+JSON.stringify(v));
  }
}
console.log("solver.spec.js: hydrate balance ok");
