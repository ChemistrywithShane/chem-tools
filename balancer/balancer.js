// ===== Chemistry with Shane — Box Balancer =====
// Core imports
import { buildMatrixFromReaction, parseFormula } from "./chemistry-core/parser.js";
import { nullspaceVector } from "./chemistry-core/matrix.js";

// Shortcuts
const $  = (q, el=document)=>el.querySelector(q);
const $$ = (q, el=document)=>Array.from(el.querySelectorAll(q));

/* ------------------------------------------------
   SPECIES DATALIST (autocomplete for inputs)
-------------------------------------------------*/
(async function loadSpecies(){
  try{
    const res  = await fetch('./chemistry-core/species.json');
    const list = await res.json();
    const dl   = $('#speciesList');
    list.forEach(sp => {
      const opt = document.createElement('option');
      opt.value = sp.display || sp.id;
      opt.label = sp.name || sp.id;
      dl.appendChild(opt);
    });
  }catch(e){ console.warn('species load failed', e); }
})();

/* ------------------------------------------------
   ION BUILDER (modal, load ions, preview, insert)
-------------------------------------------------*/
// Open/close
let ionTarget = 'reactants';
const ionModal = $('#ionModal');
const ionClose = $('#ionClose');
$('#openIonReactants')?.addEventListener('click', ()=> openIon('reactants'));
$('#openIonProducts') ?.addEventListener('click', ()=> openIon('products'));
ionClose?.addEventListener('click', closeIon);
ionModal?.addEventListener('click', e=>{ if(e.target===ionModal) closeIon(); });

function openIon(target){ ionTarget = target; ionModal.setAttribute('aria-hidden','false'); }
function closeIon(){
  ionModal.setAttribute('aria-hidden','true');
  $('#ionCation').value = '';
  $('#ionAnion').value  = '';
  ionPrev.textContent = '—';
  ionPrev.dataset.formula = '';
  updateIonButtons();
}

// Load ions
let CATIONS=[], ANIONS=[];
(async function loadIons(){
  try{
    const res = await fetch('./chemistry-core/species.json');
    const all = await res.json();
    CATIONS = all.filter(x => x.class==='cation' && typeof x.charge==='number');
    ANIONS  = all.filter(x => x.class==='anion'  && typeof x.charge==='number');
    const catSel = $('#ionCation'), anSel = $('#ionAnion');
    if(catSel && anSel){
      catSel.innerHTML = `<option value="">— choose a cation —</option>` +
        CATIONS.map((c,i)=>`<option value="${i}">${c.display||c.id} (${c.charge>0?`+${c.charge}`:c.charge})</option>`).join('');
      anSel.innerHTML = `<option value="">— choose an anion —</option>` +
        ANIONS.map((a,i)=>`<option value="${i}">${a.display||a.id} (${a.charge})</option>`).join('');
    }
  }catch(e){ console.warn('ion load failed', e); }
})();

// Helpers for pretty output
function subNum(n){ const subs={0:'₀',1:'₁',2:'₂',3:'₃',4:'₄',5:'₅',6:'₆',7:'₇',8:'₈',9:'₉'}; return String(n).split('').map(d=>subs[d]||d).join(''); }
function gcd(a,b){ return b ? gcd(b, a%b) : a; }
function lcm(a,b){ return a*b/gcd(a,b); }

// Preview + buttons
const ionCatSel = $('#ionCation');
const ionAnSel  = $('#ionAnion');
const ionPrev   = $('#ionPreview');
ionCatSel?.addEventListener('change', updateIonPreview);
ionAnSel ?.addEventListener('change', updateIonPreview);

function updateIonButtons(){
  const ready = ionCatSel?.value!=='' && ionAnSel?.value!=='';
  $('#ionInsertReactant')?.toggleAttribute('disabled', !ready);
  $('#ionInsertProduct') ?.toggleAttribute('disabled', !ready);
}

function updateIonPreview(){
  const c = ionCatSel?.value!=='' ? CATIONS[Number(ionCatSel.value)] : null;
  const a = ionAnSel ?.value!=='' ? ANIONS [Number(ionAnSel.value)]  : null;
  if(!c || !a){ ionPrev.textContent='—'; updateIonButtons(); return; }

  const cleanBase = ion => {
    let base = (ion.formula || ion.display || ion.id);
    base = base.replace(/\s+/g,'').replace(/\^.*$/,'').replace(/[+−-]+$/,'');
    base = base.replace(/\d/g, d=>subNum(d));
    return base.trim();
  };
  const isPolyatomic = base => {
    const caps = (base.match(/[A-Z]/g)||[]).length;
    const hasSub = /[₀-₉]/.test(base);
    return caps>1 || hasSub;
  };

  const qCat = Math.abs(c.charge), qAn = Math.abs(a.charge);
  const mult = lcm(qCat,qAn), nCat = mult/qCat, nAn = mult/qAn;
  const useParens = $('#ionAddParens').checked;

  const fmt = (ion,n)=>{
    let base = cleanBase(ion);
    if(useParens && n>1 && isPolyatomic(base)) base = '('+base+')';
    return base + (n>1 ? subNum(n) : '');
  };

  const formula = fmt(c,nCat)+fmt(a,nAn);
  ionPrev.textContent = `${cleanBase(c)} + ${cleanBase(a)} → ${formula}`;
  ionPrev.dataset.formula = formula;
  updateIonButtons();
}

// Insert into boxes (attach once)
$('#ionInsertReactant')?.addEventListener('click', ()=>insertIonFormula('reactants'));
$('#ionInsertProduct') ?.addEventListener('click', ()=>insertIonFormula('products'));
function insertIonFormula(target){
  const f = ionPrev?.dataset?.formula; if(!f) return;
  ensureBoxes('#'+target, 1);
  const inputs = Array.from(document.querySelectorAll('#'+target+' .species'));
  const empty  = inputs.find(i=>!i.value.trim());
  (empty || inputs[inputs.length-1]).value = f;
  closeIon();
  if(TEACH?.on) renderCardFromBoxesOrCurrent();
}

/* ------------------------------------------------
   EXAMPLES (auto-populate on change)
-------------------------------------------------*/
let EXAMPLES = [];
(async function loadExamples(){
  try{
    const res = await fetch('./chemistry-core/equations.json');
    EXAMPLES = await res.json();
    hydrateTopicSelect();
    populateExampleList();
  }catch(e){ console.warn('equations load failed', e); }
})();

function hydrateTopicSelect(){
  const topics = Array.from(new Set(EXAMPLES.flatMap(e=>e.topic?[e.topic]:[]))).sort();
  const el = $('#topicSelect');
  el.innerHTML = `<option value="ALL" selected>All topics</option>` +
    topics.map(t=>`<option value="${t}">${prettyLabel(t)}</option>`).join('');
}
function populateExampleList(){
  const lvl = $('#levelSelect').value, topic = $('#topicSelect').value, exSel = $('#exampleSelect');
  const filtered = EXAMPLES.filter(e=>{
    const okL = (lvl==='ALL') || (e.level||[]).includes(lvl);
    const okT = (topic==='ALL') || (e.topic===topic);
    return okL && okT;
  });
  if(filtered.length===0){ exSel.innerHTML = `<option value="" selected>(no examples for this filter)</option>`; return; }
  exSel.innerHTML = `<option value="" selected>— select an example —</option>` +
      filtered.map(e=>`<option value="${e.id}">${exampleLabel(e)}</option>`).join('');
}
$('#levelSelect').addEventListener('change', populateExampleList);
$('#topicSelect').addEventListener('change', populateExampleList);

// Auto-load on selection
$('#exampleSelect')?.addEventListener('change', e=>{
  const id = e.target.value; if(id) loadExampleById(id);
});
function loadExampleById(id){
  const ex = EXAMPLES.find(x=>x.id===id); if(!ex) return;
  ensureBoxes('#reactants', (ex.reactants||[]).length);
  ensureBoxes('#products',  (ex.products ||[]).length);
  writeBoxes('#reactants', ex.reactants||[]);
  writeBoxes('#products',  ex.products ||[]);
  $('#tallies').innerHTML=''; $('#result').textContent='—'; $('#status').textContent='—';

  if(TEACH.on){
    if(TEACH.sets.size===0){ buildSets(); hydrateSetSelect(); }
    const lvl = (ex.level&&ex.level[0])||'GCSE';
    const key = `${lvl}::${ex.topic||'misc'}`;
    if(TEACH.sets.has(key)){
      setSelect.value = key; selectSet(key, diffSelect.value);
      const idx = TEACH.ids.indexOf(ex.id); if(idx>=0) TEACH.index = idx;
      renderCard();
    }else{
      renderCardFromBoxesOrCurrent();
    }
    eqCard.hidden = false;
  }
}

/* ------------------------------------------------
   TEACHER MODE (MVP)
-------------------------------------------------*/
const TEACH = { on:false, sets:new Map(), ids:[], index:0, masked:true };

const teacherToggle = $('#teacherMode');
const teacherBar    = $('#teacherBar');
const setSelect     = $('#setSelect');
const diffSelect    = $('#diffSelect');
const btnPrev       = $('#prevEq');
const btnNext       = $('#nextEq');
const btnShuffle    = $('#shuffleEq');
const btnMask       = $('#toggleMask');
const btnLoadBoxes  = $('#loadToBoxes');
const eqCard        = $('#equationCard');
const eqText        = $('#eqText');
const eqTags        = $('#eqTags');

function buildSets(){
  const m = new Map();
  EXAMPLES.forEach(e=>{
    (e.level||[]).forEach(lvl=>{
      const key = `${lvl}::${e.topic||'misc'}`;
      if(!m.has(key)) m.set(key, []);
      m.get(key).push(e.id);
    });
  });
  TEACH.sets = m;
}
function hydrateSetSelect(){
  const opts=[]; TEACH.sets.forEach((ids,key)=>{
    const [lvl,topic]=key.split('::');
    opts.push({key, label:`${lvl} ▸ ${prettyLabel(topic)} (${ids.length})`});
  });
  opts.sort((a,b)=>a.label.localeCompare(b.label));
  setSelect.innerHTML = opts.map(o=>`<option value="${o.key}">${o.label}</option>`).join('') || `<option value="">(no sets)</option>`;
}
function selectSet(key, difficulty='ALL'){
  const ids = TEACH.sets.get(key)||[];
  TEACH.ids = ids.filter(id=>{
    const eq = EXAMPLES.find(x=>x.id===id);
    return difficulty==='ALL' || (eq?.difficulty||'core')===difficulty;
  });
  TEACH.index=0; renderCard();
}
function currentEq(){ const id = TEACH.ids[TEACH.index]; return EXAMPLES.find(x=>x.id===id)||null; }
function maskEqText(eq){
  const L=(eq.reactants||[]).map(s=>`□ ${s}`).join('  +  ');
  const R=(eq.products ||[]).map(s=>`□ ${s}`).join('  +  ');
  return `${L}  →  ${R}`;
}
function unmaskedEqText(eq){
  const L=(eq.reactants||[]).join('  +  ');
  const R=(eq.products ||[]).join('  +  ');
  return `${L}  →  ${R}`;
}
function renderCard(){
  const eq=currentEq();
  if(!eq || TEACH.ids.length===0){ eqText.textContent='—'; eqTags.innerHTML=''; return; }
  eqText.textContent = TEACH.masked ? maskEqText(eq) : unmaskedEqText(eq);
  eqTags.innerHTML   = `
    <span class="badge">${(eq.level||[]).join(', ')||'—'}</span>
    <span class="badge">${prettyLabel(eq.topic||'misc')}</span>
    <span class="badge">${(eq.difficulty||'core')}</span>
  `;
}
function nextEq(){ if(TEACH.ids.length){ TEACH.index=(TEACH.index+1)%TEACH.ids.length; renderCard(); } }
function prevEq(){ if(TEACH.ids.length){ TEACH.index=(TEACH.index-1+TEACH.ids.length)%TEACH.ids.length; renderCard(); } }
function shuffleEq(){ for(let i=TEACH.ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [TEACH.ids[i],TEACH.ids[j]]=[TEACH.ids[j],TEACH.ids[i]]; } TEACH.index=0; renderCard(); }
function refreshMaskButton(){ btnMask.textContent = TEACH.masked ? 'Hide Balancing Numbers' : 'Show Balancing Numbers'; }
function toggleMask(){ TEACH.masked=!TEACH.masked; refreshMaskButton(); renderCardFromBoxesOrCurrent(); }

function loadToBoxes(){
  const eq=currentEq(); if(!eq) return;
  ensureBoxes('#reactants',(eq.reactants||[]).length);
  ensureBoxes('#products', (eq.products ||[]).length);
  writeBoxes('#reactants',eq.reactants||[]);
  writeBoxes('#products', eq.products ||[]);
  $('#tallies').innerHTML=''; $('#result').textContent='—'; $('#status').textContent='—';
}

function eqFromBoxes(){
  const r=$$('#reactants .species').map(i=>i.value.trim()).filter(Boolean);
  const p=$$('#products  .species').map(i=>i.value.trim()).filter(Boolean);
  if(!r.length && !p.length) return null;
  return {reactants:r, products:p, level:['—'], topic:'custom', difficulty:'custom'};
}
function renderCardFromBoxesOrCurrent(){
  const cur=currentEq(); if(cur){ renderCard(); return; }
  const tmp=eqFromBoxes(); if(!tmp){ eqText.textContent='—'; eqTags.innerHTML=''; return; }
  eqText.textContent = TEACH.masked ? maskEqText(tmp) : unmaskedEqText(tmp);
  eqTags.innerHTML   = `<span class="badge">Custom</span>`;
}

teacherToggle?.addEventListener('change', ()=>{
  TEACH.on = teacherToggle.checked;
  teacherBar.hidden = !TEACH.on;
  eqCard.hidden     = !TEACH.on;
  if(TEACH.on){
    buildSets(); hydrateSetSelect();
    renderCardFromBoxesOrCurrent();
    refreshMaskButton();
  }
});
setSelect ?.addEventListener('change', ()=> selectSet(setSelect.value, diffSelect.value));
diffSelect?.addEventListener('change', ()=> selectSet(setSelect.value, diffSelect.value));
btnNext   ?.addEventListener('click', nextEq);
btnPrev   ?.addEventListener('click', prevEq);
btnShuffle?.addEventListener('click', shuffleEq);
btnMask   ?.addEventListener('click', toggleMask);
btnLoadBoxes?.addEventListener('click', loadToBoxes);

// Live update card when typing in boxes (Teacher Mode ON)
document.addEventListener('input', e=>{
  if(!TEACH.on) return;
  if(e.target.classList?.contains('species')) renderCardFromBoxesOrCurrent();
});

/* ------------------------------------------------
   UI helpers (boxes, labels)
-------------------------------------------------*/
function ensureBoxes(sectionSelector, n){
  const grid  = document.querySelector(sectionSelector);
  const inputs= Array.from(grid.querySelectorAll('.species'));
  const addBtn= grid.querySelector('button');
  let need = n - inputs.length;
  while(need-- > 0){
    const div=document.createElement('div');
    div.className='box';
    div.innerHTML='<input class="species" list="speciesList" placeholder="(reactant/product)">';
    grid.insertBefore(div, addBtn);
  }
}
function writeBoxes(sectionSelector, values){
  const inputs = $$(sectionSelector+' .species');
  inputs.forEach((inp,i)=> inp.value = values[i] || '');
}
function exampleLabel(e){
  const left  = (e.reactants||[]).join(' + ');
  const right = (e.products ||[]).join(' + ');
  const topic = e.topic ? prettyLabel(e.topic) : 'Example';
  return `${topic} — ${left} → ${right}`;
}
function prettyLabel(s){ return (s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); }

// Add/clear/reset
$('#add-reactant').onclick = ()=> addBox('#reactants');
$('#add-product') .onclick = ()=> addBox('#products');
function addBox(sel){
  const grid = $(sel);
  const div  = document.createElement('div');
  div.className='box';
  div.innerHTML='<input class="species" list="speciesList" placeholder="(reactant/product)">';
  grid.insertBefore(div, grid.querySelector('button'));
}
$('#reset').onclick = ()=>{
  $$('#reactants .species, #products .species').forEach(i=> i.value='');
  $('#tallies').innerHTML=''; $('#result').textContent='—'; $('#status').textContent='—';
  $('#chargeToggle').checked=false;
};
$('#clear-reactants').onclick = ()=>{
  $$('#reactants .species').forEach(i=> i.value='');
  $('#tallies').innerHTML=''; $('#result').textContent='—'; $('#status').textContent='—';
};
$('#clear-products').onclick = ()=>{
  $$('#products .species').forEach(i=> i.value='');
  $('#tallies').innerHTML=''; $('#result').textContent='—'; $('#status').textContent='—';
};

/* ------------------------------------------------
   BALANCER (matrix solver) + tallies
-------------------------------------------------*/
function getSpeciesFrom(selector){ return $$(selector+' .species').map(i=>i.value.trim()).filter(Boolean); }
function prettyReaction(eq, coeffs, leftLen){
  const L = eq.slice(0,leftLen).map((s,i)=> (coeffs[i]===1?'':coeffs[i]+' ') + s).join(' + ');
  const R = eq.slice(leftLen).map((s,i)=> (coeffs[leftLen+i]===1?'':coeffs[leftLen+i]+' ') + s).join(' + ');
  return L + ' → ' + R;
}
$('#balance').onclick = ()=>{
  const reactants = getSpeciesFrom('#reactants');
  const products  = getSpeciesFrom('#products');
  const chargeMode= $('#chargeToggle').checked;
  if(!reactants.length || !products.length){
    $('#status').textContent='Please enter at least one reactant and one product.'; return;
  }
  try{
    const {A, species} = buildMatrixFromReaction(reactants, products, chargeMode);
    const v = nullspaceVector(A);
    if(!v || v.some(x=>!Number.isFinite(x))){ $('#status').textContent='Could not balance.'; return; }
    $('#result').textContent = prettyReaction(species, v, reactants.length);
    $('#status').textContent = '✔ Balanced';
    renderTallies(reactants, products, v, chargeMode);
  }catch(e){
    console.error(e); $('#status').textContent='Error parsing input.';
  }
};
function renderTallies(reactants, products, coeffs, includeCharge){
  const L={}, R={};
  reactants.forEach((sp,i)=>{
    const m = parseFormula(sp);
    for(const k in m){ if(k==='(charge)' && !includeCharge) continue; L[k]=(L[k]||0)+m[k]*coeffs[i]; }
  });
  products.forEach((sp,i)=>{
    const m = parseFormula(sp);
    for(const k in m){ if(k==='(charge)' && !includeCharge) continue; const idx=reactants.length+i; R[k]=(R[k]||0)+m[k]*coeffs[idx]; }
  });
  const els = Array.from(new Set([...Object.keys(L), ...Object.keys(R)])).sort();
  const wrap = $('#tallies'); wrap.innerHTML='';
  els.forEach(el=>{
    const equal=(L[el]||0)===(R[el]||0);
    const line=document.createElement('div');
    line.innerHTML=`<span class="badge">${el}</span> <span class="${equal?'equal':'off'}">${L[el]||0} : ${R[el]||0}</span>`;
    wrap.appendChild(line);
  });
}
