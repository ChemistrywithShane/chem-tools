import { buildMatrixFromReaction, parseFormula } from "./chemistry-core/parser.js";
import { nullspaceVector } from "./chemistry-core/matrix.js";

const $ = (q, el=document)=>el.querySelector(q);
const $$ = (q, el=document)=>Array.from(el.querySelectorAll(q));

// Load species for datalist autocomplete
(async function loadSpecies(){
  try{
    const res = await fetch('./chemistry-core/species.json');
    const list = await res.json();
    const dl = $('#speciesList');
    list.forEach(sp => {
      const opt=document.createElement('option');
      opt.value = sp.display || sp.id;
      opt.label = sp.name || sp.id;
      dl.appendChild(opt);
    });
  }catch(e){ console.warn('species load failed', e); }
})();

// Add/remove boxes
$('#add-reactant').onclick = ()=> addBox('#reactants');
$('#add-product').onclick = ()=> addBox('#products');
function addBox(sel){
  const grid = $(sel);
  const div = document.createElement('div');
  div.className='box';
  div.innerHTML = '<input class="species" list="speciesList" placeholder="(reactant/product)">';
  grid.insertBefore(div, grid.querySelector('button'));
}

// Collect species from non-empty inputs
function getSpeciesFrom(selector){
  return $$(selector+' .species').map(i=>i.value.trim()).filter(Boolean);
}

function pretty(eq, coeffs, leftLen){
  const L = eq.slice(0,leftLen).map((s,i)=> (coeffs[i]===1?'':coeffs[i]+' ') + s).join(' + ');
  const R = eq.slice(leftLen).map((s,i)=> (coeffs[leftLen+i]===1?'':coeffs[leftLen+i]+' ') + s).join(' + ');
  return L + ' → ' + R;
}

$('#balance').onclick = () => {
  const reactants = getSpeciesFrom('#reactants');
  const products = getSpeciesFrom('#products');
  const chargeMode = $('#chargeToggle').checked;

  if(reactants.length===0 || products.length===0){
    $('#status').textContent = 'Please enter at least one reactant and one product.';
    return;
  }
  try{
    const {A, species} = buildMatrixFromReaction(reactants, products, chargeMode);
    const v = nullspaceVector(A);
    if(!v || v.some(x => !Number.isFinite(x))){
      $('#status').textContent='Could not balance.';
      return;
    }
    $('#result').textContent = pretty(species, v, reactants.length);
    $('#status').textContent = '✔ Balanced';
    renderTallies(reactants, products, v, chargeMode);
  }catch(e){
    console.error(e);
    $('#status').textContent = 'Error parsing input.';
  }
};

function renderTallies(reactants, products, coeffs, includeCharge){
  const L = {}; const R = {};
  reactants.forEach((sp,i)=>{
    const m = parseFormula(sp);
    for(const k in m){
      if(k==='(charge)' && !includeCharge) continue;
      L[k]=(L[k]||0)+m[k]*coeffs[i];
    }
  });
  products.forEach((sp,i)=>{
    const m = parseFormula(sp);
    for(const k in m){
      if(k==='(charge)' && !includeCharge) continue;
      const idx = reactants.length + i;
      R[k]=(R[k]||0)+m[k]*coeffs[idx];
    }
  });
  const els = Array.from(new Set([...Object.keys(L), ...Object.keys(R)]));
  const wrap = $('#tallies');
  wrap.innerHTML='';
  els.sort().forEach(el=>{
    const equal = (L[el]||0) === (R[el]||0);
    const line = document.createElement('div');
    line.innerHTML = `<span class="badge">${el}</span> <span class="${equal?'equal':'off'}">${L[el]||0} : ${R[el]||0}</span>`;
    wrap.appendChild(line);
  });
  // Reset: clear all inputs, tallies, and result
// Reset everything but keep extra boxes (nicer during demos)
$('#reset').onclick = () => {
  $$('#reactants .species, #products .species').forEach(i => i.value = '');
  $('#tallies').innerHTML = '';
  $('#result').textContent = '—';
  $('#status').textContent = '—';
  $('#chargeToggle').checked = false;
};

// Clear per section
$('#clear-reactants').onclick = () => {
  $$('#reactants .species').forEach(i => i.value = '');
  $('#tallies').innerHTML = ''; $('#result').textContent = '—'; $('#status').textContent = '—';
};
$('#clear-products').onclick = () => {
  $$('#products .species').forEach(i => i.value = '');
  $('#tallies').innerHTML = ''; $('#result').textContent = '—'; $('#status').textContent = '—';
};

}
