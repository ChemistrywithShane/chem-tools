import { parseFormula, buildMatrixFromReaction } from "../chemistry-core/parser.js";

function assertEqual(a,b,msg){
  const ja=JSON.stringify(a), jb=JSON.stringify(b);
  if(ja!==jb){ throw new Error((msg||"assertEqual failed") + "\n" + ja + "\n" + jb); }
}

console.log("parser.spec.js: start");

assertEqual(parseFormula("H2O"), {"H":2,"O":1});
assertEqual(parseFormula("Fe2(SO4)3"), {"Fe":2,"S":3,"O":12});
assertEqual(parseFormula("CuSO4·5H2O"), {"Cu":1,"S":1,"O":9,"H":10});
assertEqual(parseFormula("SO4^2-"), {"S":1,"O":4,"(charge)":2});        // charge row for ionic mode
assertEqual(parseFormula("NH4^+"), {"N":1,"H":4,"(charge)":-1});

const {A, rows} = buildMatrixFromReaction(["H2","O2"],["H2O"]);
console.log("Rows:", rows, "A0:", A[0]);

console.log("parser.spec.js: ok");
