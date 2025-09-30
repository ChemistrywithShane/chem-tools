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

// ------- EXAMPLES DROPDOWN -------
let EXAMPLES = [];

(async function loadExamples(){
  try{
    const res = await fetch('./chemistry-core/equations.json');
    EXAMPLES = await res.json();
    hydrateTopicSelect();
    populateExampleList(); // initial population
  }catch(e){ console.warn('equations load failed', e); }
})();

function hydrateTopicSelect(){
  const topics = Array.from(new Set(EXAMPLES.flatMap(e => e.topic ? [e.topic] : []))).sort();
  const topicSel = document.getElementById('topicSelect');
  topicSel.innerHTML = `<option value="ALL" selected>All topics</option>` +
    topics.map(t => `<option value="${t}">${prettyLabel(t)}</option>`).join('');
}

function populateExampleList(){
  const lvl = document.getElementById('levelSelect').value;
  const topic = document.getElementById('topicSelect').value;
  const exSel = document.getElementById('exampleSelect');
  const filtered = EXAMPLES.filter(e => {
    const okLevel = (lvl === 'ALL') || (e.level || []).includes(lvl);
    const okTopic = (topic === 'ALL') || (e.topic === topic);
    return okLevel && okTopic;
  });
  if (filtered.length === 0) {
  exSel.innerHTML = `<option value="" selected>(no examples for this filter)</option>`;
  return;
}
  exSel.innerHTML = `<option value="" selected>— select an example —</option>` +
    filtered.map(e => `<option value="${e.id}">${exampleLabel(e)}</option>`).join('');
}

document.getElementById('levelSelect').addEventListener('change', populateExampleList);
document.getElementById('topicSelect').addEventListener('change', populateExampleList);

document.getElementById('loadExample').addEventListener('click', () => {
  const id = document.getElementById('exampleSelect').value;
  if(!id) return;
  const ex = EXAMPLES.find(e => e.id === id);
  if(!ex) return;

  // ensure enough boxes exist
  ensureBoxes('#reactants', ex.reactants.length);
  ensureBoxes('#products', ex.products.length);

  // write values
  writeBoxes('#reactants', ex.reactants);
  writeBoxes('#products', ex.products);

  // clear old output
  $('#tallies').innerHTML = '';
  $('#result').textContent = '—';
  $('#status').textContent = '—';
});

function ensureBoxes(sectionSelector, n){
  const grid = document.querySelector(sectionSelector);
  const inputs = Array.from(grid.querySelectorAll('.species'));
  const addBtn = grid.querySelector('button');
  let need = n - inputs.length;
  while(need-- > 0){
    const div = document.createElement('div');
    div.className='box';
    div.innerHTML = '<input class="species" list="speciesList" placeholder="(reactant/product)">';
    grid.insertBefore(div, addBtn);
  }
}
function writeBoxes(sectionSelector, values){
  const inputs = Array.from(document.querySelectorAll(sectionSelector+' .species'));
  inputs.forEach((inp,i)=>{ inp.value = values[i] || ''; });
}
function exampleLabel(e){
  // Build a friendly label like: "Combustion — C3H8 + O2 → CO2 + H2O"
  const left = (e.reactants || []).join(' + ');
  const right = (e.products || []).join(' + ');
  const topic = e.topic ? prettyLabel(e.topic) : 'Example';
  return `${topic} — ${left} → ${right}`;
}
function prettyLabel(s){ return s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }


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
function buildCompound(cation, anion) {
  const qCat = Math.abs(cation.charge);
  const qAn = Math.abs(anion.charge);
  const lcm = (a,b)=> a*b/gcd(a,b);
  const gcd = (a,b)=> b ? gcd(b, a%b) : a;

  const mult = lcm(qCat, qAn);
  const nCat = mult / qCat;
  const nAn = mult / qAn;

  return (cation.display.replace(/[^A-Za-z0-9()]/g,'')) +
         (nCat>1 ? nCat : '') +
         (anion.display.replace(/[^A-Za-z0-9()]/g,'')) +
         (nAn>1 ? nAn : '');
}
