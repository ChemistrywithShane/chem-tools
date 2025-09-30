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

  // Normalise “A Level” vs “ALevel”, handle spacing/case
  const norm = s => (s || '').replace(/\s+/g, '').toLowerCase();
  const lvlNorm = norm(lvl);

  const filtered = EXAMPLES.filter(e=>{
    const okL = (lvl === 'ALL') || (e.level || []).some(L => norm(L) === lvlNorm);
    const okT = (topic === 'ALL') || (e.topic === topic);
    return okL && okT;
  });

  if(filtered.length===0){
    exSel.innerHTML = `<option value="" selected>(no examples for this filter)</option>`;
    return;
  }
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
// ---------- Hints (Teacher Mode) ----------
const hintPanel = $('#hintPanel');
const hintList  = $('#hintList');
const btnHintN  = $('#hintNext');
const btnHintAll= $('#hintAll');
const btnHintR  = $('#hintReset');
// ---------- Practice elements ----------
const practicePanel = $('#practicePanel');
const practiceType  = $('#practiceType');
const btnGen        = $('#genPractice');
const btnReveal     = $('#revealPractice');
const btnNew        = $('#newPractice');
const practiceQ     = $('#practiceQ');
const practiceA     = $('#practiceA');

TEACH.practice = { type:'mole', current:null }; // store current generated item

// keep hint progress in TEACH
TEACH.hIndex = 0;   // number of hints currently revealed
TEACH.hCache = [];  // current equation's hints

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
  const L=(eq.reactants||[]).map(s=>`□ ${formatFormulaForDisplay(s)}`).join('  +  ');
  const R=(eq.products ||[]).map(s=>`□ ${formatFormulaForDisplay(s)}`).join('  +  ');
  return `${L}  →  ${R}`;
}
function unmaskedEqText(eq){
  const L=(eq.reactants||[]).map(s=>formatFormulaForDisplay(s)).join('  +  ');
  const R=(eq.products ||[]).map(s=>formatFormulaForDisplay(s)).join('  +  ');
  return `${L}  →  ${R}`;
}
function balancedEqText(eq){
  try{
    const charge = $('#chargeToggle')?.checked || false;
    const { A } = buildMatrixFromReaction(eq.reactants || [], eq.products || [], charge);
    const v = nullspaceVector(A);
    if(!v || !v.length) return unmaskedEqText(eq);

    const leftLen = (eq.reactants || []).length;
    const left = (eq.reactants || []).map((s,i) =>
      (v[i] === 1 ? '' : v[i] + ' ') + formatFormulaForDisplay(s)
    ).join('  +  ');
    const right = (eq.products || []).map((s,i) =>
      (v[leftLen + i] === 1 ? '' : v[leftLen + i] + ' ') + formatFormulaForDisplay(s)
    ).join('  +  ');

    return `${left}  →  ${right}`;
  }catch(e){
    console.warn('balancedEqText failed:', e);
    return unmaskedEqText(eq);
  }
}
function getHintsForEq(eq){
  // Prefer explicit hint_steps from data
  const steps = Array.isArray(eq?.hint_steps) ? eq.hint_steps.slice() : [];

  // Graceful fallback if none present
  if(steps.length === 0){
    return [
      'Start by counting atoms on each side. Pick one element to balance first.',
      'If a polyatomic ion appears unchanged on both sides, treat it as a unit.',
      'Balance elements that appear in fewest places first.',
      'Leave H and O until last (they often appear in many places).',
    ];
  }
  return steps;
}

function resetHints(eq){
  TEACH.hCache = getHintsForEq(eq);
  TEACH.hIndex = 0;
  renderHints();
}

function revealNextHint(){
  if(TEACH.hIndex < TEACH.hCache.length){
    TEACH.hIndex++;
    renderHints();
  }
}

function revealAllHints(){
  TEACH.hIndex = TEACH.hCache.length;
  renderHints();
}

function renderHints(){
  if(!TEACH.on){ hintPanel.hidden = true; return; }
  hintPanel.hidden = false;

  if(!TEACH.hCache || TEACH.hCache.length === 0){
    hintList.innerHTML = `<li class="revealed">No hints available for this equation yet.</li>`;
    btnHintN.disabled = true; btnHintAll.disabled = true; btnHintR.disabled = false;
    return;
  }

  // Build list where first hIndex are "revealed"
  const items = TEACH.hCache.map((txt, i) =>
    `<li class="${i < TEACH.hIndex ? 'revealed' : 'pending'}">${i+1}. ${txt}</li>`
  ).join('');

  hintList.innerHTML = items;
  btnHintN.disabled   = TEACH.hIndex >= TEACH.hCache.length;
  btnHintAll.disabled = TEACH.hIndex >= TEACH.hCache.length;
  btnHintR.disabled   = TEACH.hIndex === 0;
}

function resetPractice(){
  TEACH.practice.current = null;
  practiceQ.textContent = '—';
  practiceA.textContent = '—';
  practiceA.hidden = true;
  btnReveal.disabled = true;
  btnNew.disabled = true;
}


function renderCard(){
  const eq=currentEq();
  if(!eq || TEACH.ids.length===0){ eqText.textContent='—'; eqTags.innerHTML=''; return; }
 eqText.innerHTML = TEACH.masked ? maskEqText(eq) : balancedEqText(eq);
  eqTags.innerHTML   = `
    <span class="badge">${(eq.level||[]).join(', ')||'—'}</span>
    <span class="badge">${prettyLabel(eq.topic||'misc')}</span>
    <span class="badge">${(eq.difficulty||'core')}</span>`;
resetHints(eq);
   resetPractice();
}

function nextEq(){ if(TEACH.ids.length){ TEACH.index=(TEACH.index+1)%TEACH.ids.length; renderCard(); } }
function prevEq(){ if(TEACH.ids.length){ TEACH.index=(TEACH.index-1+TEACH.ids.length)%TEACH.ids.length; renderCard(); } }
function shuffleEq(){ for(let i=TEACH.ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [TEACH.ids[i],TEACH.ids[j]]=[TEACH.ids[j],TEACH.ids[i]]; } TEACH.index=0; renderCard(); }
function refreshMaskButton(){
  // If masked (hidden), offer to SHOW numbers; if shown, offer to HIDE.
  btnMask.textContent = TEACH.masked
    ? 'Show Balancing Numbers'
    : 'Hide Balancing Numbers';
}

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
  eqText.innerHTML = TEACH.masked ? maskEqText(tmp) : balancedEqText(tmp);
  eqTags.innerHTML   = `<span class="badge">Custom</span>`;
resetHints(tmp);
   resetPractice();
}
function getStoich(eq){
  return eq?.stoich || { mole_ratios:[], mass_ratios:[], yield_questions:[], atom_economy:false };
}

function genMolePractice(eq){
  const s = getStoich(eq);
  const item = choice(s.mole_ratios || []);
  if(!item) return { q:'No mole-ratio items for this equation yet.', a:'' };

  const given = item.given; const ask = item.ask;
  // Build a balanced vector to get stoich coefficients
  const { A } = buildMatrixFromReaction(eq.reactants||[], eq.products||[], false);
  const v = nullspaceVector(A);
  const all = [...(eq.reactants||[]), ...(eq.products||[])];
  const coeff = Object.fromEntries(all.map((sp,i)=>[sp, v[i]]));

  const ratio = coeff[ask.species] / coeff[given.species];
  const molesAns = given.moles * ratio;

  return {
    q: `If you have ${given.moles} mol of ${given.species}, how many moles of ${ask.species} are produced/required?`,
    a: `${roundSig(molesAns)} mol (ratio ${coeff[given.species]}:${coeff[ask.species]} from the balanced equation)`
  };
}

function genMassPractice(eq){
  const s = getStoich(eq);
  const item = choice(s.mass_ratios || []);
  if(!item) return { q:'No mass-ratio items for this equation yet.', a:'' };

  const given = item.given; const ask = item.ask;
  const { A } = buildMatrixFromReaction(eq.reactants||[], eq.products||[], false);
  const v = nullspaceVector(A);
  const all = [...(eq.reactants||[]), ...(eq.products||[])];
  const coeff = Object.fromEntries(all.map((sp,i)=>[sp, v[i]]));

  const mmGiven = molarMass(given.species);
  const mmAsk   = molarMass(ask.species);

  const nGiven  = given.mass_g / mmGiven;
  const ratio   = coeff[ask.species] / coeff[given.species];
  const nAsk    = nGiven * ratio;
  const massAsk = nAsk * mmAsk;

  return {
    q: `If you start with ${given.mass_g} g of ${given.species}, what mass of ${ask.species} is formed/required?`,
    a: `${roundSig(massAsk)} g  (molar masses: ${ask.species} ${roundSig(mmAsk)} g·mol⁻¹, ${given.species} ${roundSig(mmGiven)} g·mol⁻¹; stoich ${coeff[given.species]}:${coeff[ask.species]})`
  };
}

function genYieldPractice(eq){
  const s = getStoich(eq);
  const item = choice(s.yield_questions || []);
  if(!item) return { q:'No yield items for this equation yet.', a:'' };

  const given = item.given; const ask = item.ask;
  const { A } = buildMatrixFromReaction(eq.reactants||[], eq.products||[], false);
  const v = nullspaceVector(A);
  const all = [...(eq.reactants||[]), ...(eq.products||[])];
  const coeff = Object.fromEntries(all.map((sp,i)=>[sp, v[i]]));

  const mmGiven = molarMass(given.species);
  const mmAsk   = molarMass(ask.species);
  const nGiven  = (given.mass_g ?? 0) / mmGiven || given.moles || 0;
  const ratio   = coeff[ask.species] / coeff[given.species];
  const nTheo   = nGiven * ratio;
  const mTheo   = nTheo * mmAsk;

  const expected = item.expected_yield_percent ?? 100;
  const mActual  = mTheo * (expected/100);

  return {
    q: `You react ${given.mass_g ?? (given.moles+' mol')} of ${given.species}. What is the theoretical mass of ${ask.species}? If the actual yield is ${expected}% what mass would you collect?`,
    a: `Theoretical: ${roundSig(mTheo)} g.  At ${expected}% yield: ${roundSig(mActual)} g.`
  };
}

function genAtomEconomyPractice(eq){
  const s = getStoich(eq);
  if(!s.atom_economy) return { q:'Atom economy not flagged for this reaction.', a:'' };

  // Define desired product as "the first product" by default
  const desired = (eq.products||[])[0];
  if(!desired) return { q:'No products array found.', a:'' };

  // Mass of desired from coefficients; total mass of all products
  const { A } = buildMatrixFromReaction(eq.reactants||[], eq.products||[], false);
  const v = nullspaceVector(A);
  const leftLen = (eq.reactants||[]).length;
  let mDesired = 0, mTotal = 0;
  (eq.products||[]).forEach((p,i)=>{
    const n = v[leftLen+i];
    const mm = molarMass(p);
    const mass = n*mm;
    mTotal += mass;
    if(p === desired) mDesired += mass;
  });
  const pct = 100 * (mDesired / mTotal);
  return {
    q: `Calculate the atom economy for producing ${desired} in this reaction.`,
    a: `Atom economy = (mass of desired products ÷ total mass of products) × 100 = ${roundSig(pct)}%.`
  };
}



teacherToggle?.addEventListener('change', ()=>{
  TEACH.on = teacherToggle.checked;
  teacherBar.hidden = !TEACH.on;
  eqCard.hidden     = !TEACH.on;
  hintPanel.hidden = !TEACH.on;
  practicePanel.hidden = !TEACH.on;
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
btnHintN ?.addEventListener('click', revealNextHint);
btnHintAll?.addEventListener('click', revealAllHints);
btnHintR ?.addEventListener('click', ()=> resetHints(currentEq() || eqFromBoxes() || { hint_steps: [] }));

// Live update card when typing in boxes (Teacher Mode ON)
document.addEventListener('input', e=>{
  if(!TEACH.on) return;
  if(e.target.classList?.contains('species')) renderCardFromBoxesOrCurrent();
});

practiceType?.addEventListener('change', ()=>{
  TEACH.practice.type = practiceType.value;
  resetPractice();
});

btnGen?.addEventListener('click', ()=>{
  const eq = currentEq() || eqFromBoxes();
  if(!eq){ practiceQ.textContent = 'No equation selected.'; return; }

  let out = { q:'', a:'' };
  try{
    switch(practiceType.value){
      case 'mole':  out = genMolePractice(eq); break;
      case 'mass':  out = genMassPractice(eq); break;
      case 'yield': out = genYieldPractice(eq); break;
      case 'atom':  out = genAtomEconomyPractice(eq); break;
    }
  }catch(e){
    console.warn('Practice error:', e);
    out = { q:'Cannot generate for this equation (missing masses?)', a:String(e.message||e) };
  }

  TEACH.practice.current = out;
  practiceQ.textContent = out.q || '—';
  practiceA.textContent = out.a || '—';
  practiceA.hidden = true;
  btnReveal.disabled = !out.a;
  btnNew.disabled = !out.q;
});

btnReveal?.addEventListener('click', ()=>{
  practiceA.hidden = false;
});

btnNew?.addEventListener('click', ()=>{
  // Generate again with same type
  btnGen.click();
});


$('#btnVideo')?.addEventListener('click', ()=>{
  const eq = currentEq() || eqFromBoxes();
  if(!eq || !Array.isArray(eq.media?.video_queries) || eq.media.video_queries.length===0){
    window.open('https://www.youtube.com/results?search_query=chemistry+reaction+demonstration', '_blank');
    return;
  }

   
  // Prefer the equation's first query
  const q = eq.media.video_queries[0];
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  window.open(url, '_blank');
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
// --- Display formatting: charges as superscripts, digits as subscripts ---
function formatFormulaForDisplay(str){
  if(!str) return '';
  return String(str)
    // ^2+, ^-, ^3-  -> <sup>2+</sup>, <sup>-</sup>, <sup>3-</sup>
    .replace(/\^([0-9]*)([+-])/g, (_, num, sign) => `<sup>${(num||'')}${sign}</sup>`)
    // Element + number -> element<sub>number</sub>  (e.g. H2O -> H<sub>2</sub>O)
    .replace(/([A-Za-z\)])([0-9]+)/g, (_, el, num) => `${el}<sub>${num}</sub>`);
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
  const L = eq.slice(0,leftLen).map((s,i)=> (coeffs[i]===1?'':coeffs[i]+' ') + formatFormulaForDisplay(s)).join(' + ');
  const R = eq.slice(leftLen).map((s,i)=> (coeffs[leftLen+i]===1?'':coeffs[leftLen+i]+' ') + formatFormulaForDisplay(s)).join(' + ');
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
   $('#result').innerHTML = prettyReaction(species, v, reactants.length);
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
// ---------- Simple molar-mass table (extend anytime) ----------
const ATOMIC_MASS = {
  H:1.008, He:4.003, Li:6.941, Be:9.012, B:10.81, C:12.011, N:14.007, O:15.999, F:18.998, Ne:20.180,
  Na:22.990, Mg:24.305, Al:26.982, Si:28.086, P:30.974, S:32.065, Cl:35.453, Ar:39.948, K:39.098, Ca:40.078,
  Sc:44.956, Ti:47.867, V:50.942, Cr:51.996, Mn:54.938, Fe:55.845, Co:58.933, Ni:58.693, Cu:63.546, Zn:65.38,
  Ga:69.723, Ge:72.630, As:74.922, Se:78.971, Br:79.904, Kr:83.798, Rb:85.468, Sr:87.62, Y:88.906, Zr:91.224,
  Ag:107.868, I:126.904, Ba:137.327, Cs:132.905
};

function molarMass(formula){
  // parseFormula returns map of element -> count; ignore '(charge)'
  const m = parseFormula(formula);
  let total = 0;
  for(const el in m){
    if(el === '(charge)') continue;
    if(!ATOMIC_MASS[el]) throw new Error(`No atomic mass for ${el}`);
    total += ATOMIC_MASS[el] * m[el];
  }
  return total; // g/mol
}

function roundSig(x, s=3){ if(!isFinite(x)) return x; const p = Math.pow(10, Math.max(0, s-1-Math.floor(Math.log10(Math.abs(x))))); return Math.round(x*p)/p; }
function choice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
