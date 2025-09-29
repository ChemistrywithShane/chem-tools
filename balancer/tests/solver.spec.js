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
