const fruits = [null, '🍓', '🍊', '🍋', '🍇', '🍉', '🥥', '🍍', '🥭'];
const names = ['', 'Strawberry', 'Orange', 'Lemon', 'Grape', 'Watermelon', 'Coconut', 'Pineapple', 'Mango'];
const targetFruit = fruits.length - 1;

let board = Array(16).fill(null);
let score = 0;
let won = false;
let gameEnded = false;
let nextTileId = 1;
let powers = { burst: false, sprout: false, ripple: false };

const bestKey = 'mangoMergeBest';
const soundKey = 'mangoMergeSound';
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const boardEl = document.getElementById('board');
const toastEl = document.getElementById('toast');
const mangoSpeech = document.getElementById('mangoSpeech');
const catSpeech = document.getElementById('catSpeech');
const soundBtn = document.getElementById('soundBtn');
const powerBtns = document.querySelectorAll('[data-power]');
const moveBtns = document.querySelectorAll('[data-move]');

const tips = [
  'Meow tip: keep your biggest fruit cozy in a corner. 🐾',
  'Meow tip: strawberries and oranges are your combo starters. 🍓🍊',
  'Meow tip: lemons and grapes merge best when you keep a tidy lane. 🍋🍇',
  'Meow tip: protect your coconut — it is on the way to pineapple! 🥥',
  'Meow tip: two 🍍 pineapples make the dream — 🥭 Mango!'
];
let tipIndex = 0;

let audioCtx = null;
let soundEnabled = localStorage.getItem(soundKey) !== 'off';

function updateSoundButton() {
  soundBtn.textContent = soundEnabled ? 'Sound: On 🔊' : 'Sound: Off 🔇';
  soundBtn.setAttribute('aria-pressed', String(soundEnabled));
}

function initAudio() {
  if (!soundEnabled) return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, duration = 0.12, type = 'sine', delay = 0, gain = 0.055) {
  const ctx = initAudio();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function sparkle(base = 660) {
  tone(base, 0.08, 'triangle', 0, 0.045);
  tone(base * 1.25, 0.09, 'sine', 0.07, 0.04);
  tone(base * 1.5, 0.10, 'triangle', 0.14, 0.035);
}

function sfx(name, level = 1) {
  if (!soundEnabled) return;
  const pitch = 1 + Math.min(level, targetFruit) * 0.055;
  if (name === 'button') sparkle(620);
  if (name === 'new') { tone(523, .10, 'triangle', 0); tone(659, .10, 'triangle', .08); tone(784, .12, 'sine', .17); }
  if (name === 'move') { tone(392, .055, 'triangle', 0, .035); tone(523, .065, 'triangle', .055, .03); }
  if (name === 'invalid') { tone(220, .08, 'sine', 0, .035); tone(196, .10, 'sine', .08, .025); }
  if (name === 'merge') sparkle(520 * pitch);
  if (name === 'bigMerge') { sparkle(680 * pitch); tone(1046, .14, 'sine', .22, .04); }
  if (name === 'win') {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .13, i % 2 ? 'sine' : 'triangle', i * .09, .052));
    tone(1568, .26, 'sine', .48, .04);
  }
  if (name === 'gameover') { [392, 330, 262].forEach((f, i) => tone(f, .16, 'sine', i * .13, .04)); }
  if (name === 'tutorial') sparkle(740);
  if (name === 'power') { sparkle(760 + level * 35); tone(988, .18, 'triangle', .12, .045); }
  if (name === 'close') { tone(784, .07, 'triangle', 0, .035); tone(523, .10, 'sine', .07, .03); }
}

function best(){ return Number(localStorage.getItem(bestKey) || 0); }
function setBest(v){ localStorage.setItem(bestKey, String(v)); }
function createTile(value, index, justBorn = true) { return { id: nextTileId++, value, index, justBorn, merged: false }; }
function boardSignature(cells = board) { return cells.map(tile => tile ? `${tile.id}:${tile.value}` : '0').join(','); }
function emptyCells(){ return board.map((v,i)=> v === null ? i : -1).filter(i=>i>=0); }

function updateMoveButtons(){
  moveBtns.forEach(btn => {
    btn.disabled = gameEnded;
    btn.setAttribute('aria-label', gameEnded ? 'Game finished — press New Game to move again' : `Move ${btn.dataset.move}`);
  });
}

function updatePowerButtons(){
  powerBtns.forEach(btn => {
    const used = powers[btn.dataset.power];
    btn.disabled = used || gameEnded;
    btn.classList.toggle('used', used);
    btn.classList.toggle('locked', gameEnded && !used);
    btn.setAttribute('aria-label', `${btn.textContent.trim()} — ${gameEnded ? 'locked because the game is finished' : used ? 'used' : 'one-time use available'}`);
  });
}

function pulseBoard(effect){
  boardEl.classList.remove('burst-effect', 'sprout-effect', 'ripple-effect');
  void boardEl.offsetWidth;
  boardEl.classList.add(`${effect}-effect`);
  window.setTimeout(() => boardEl.classList.remove(`${effect}-effect`), 760);
}

function addRandomFruit(){
  const cells = emptyCells();
  if (!cells.length) return null;
  const idx = cells[Math.floor(Math.random()*cells.length)];
  const tile = createTile(Math.random() < 0.86 ? 1 : 2, idx, true);
  board[idx] = tile;
  return tile;
}

function ensureBoardScaffold() {
  if (boardEl.querySelector('.tiles-layer')) return;
  boardEl.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell bg-cell';
    cell.setAttribute('aria-hidden', 'true');
    boardEl.appendChild(cell);
  }
  const layer = document.createElement('div');
  layer.className = 'tiles-layer';
  boardEl.appendChild(layer);
}

function positionTile(el, index) {
  const x = index % 4;
  const y = Math.floor(index / 4);
  el.style.left = `calc(${x * 25}% + ${12 - (3 * x)}px)`;
  el.style.top = `calc(${y * 25}% + ${12 - (3 * y)}px)`;
}

function render(){
  ensureBoardScaffold();
  updatePowerButtons();
  updateMoveButtons();
  scoreEl.textContent = score;
  if (score > best()) setBest(score);
  bestEl.textContent = best();

  const layer = boardEl.querySelector('.tiles-layer');
  const liveTiles = board.filter(Boolean);
  const liveIds = new Set(liveTiles.map(tile => String(tile.id)));

  [...layer.querySelectorAll('.tile')].forEach(el => {
    if (!liveIds.has(el.dataset.id)) el.remove();
  });

  liveTiles.forEach(tile => {
    let el = layer.querySelector(`[data-id="${tile.id}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = String(tile.id);
      el.className = 'tile';
      el.setAttribute('role', 'gridcell');
      layer.appendChild(el);
    }
    el.className = `tile fruit-${tile.value}${tile.justBorn ? ' born' : ''}${tile.merged ? ' merged' : ''}`;
    el.textContent = fruits[tile.value] || '';
    el.setAttribute('aria-label', names[tile.value] || 'empty');
    positionTile(el, tile.index);

    if (tile.justBorn || tile.merged) {
      window.setTimeout(() => {
        tile.justBorn = false;
        tile.merged = false;
        el.classList.remove('born', 'merged');
      }, 260);
    }
  });
}

function newGame(playSound = true){
  board = Array(16).fill(null); score = 0; won = false; gameEnded = false; nextTileId = 1;
  powers = { burst: false, sprout: false, ripple: false };
  ensureBoardScaffold();
  boardEl.querySelectorAll('.tile').forEach(tile => tile.remove());
  addRandomFruit(); addRandomFruit();
  mangoSpeech.textContent = 'Fresh board! Make a mango to finish the game. 🥭';
  catSpeech.textContent = tips[0];
  render();
  if (playSound) sfx('new');
}

function slideLine(line){
  const nonzero = line.filter(Boolean).map(tile => ({ ...tile, justBorn: false, merged: false }));
  const out = [];
  const mergedValues = [];
  let gained = 0;
  let merged = false;
  for (let i=0; i<nonzero.length; i++) {
    if (nonzero[i].value === nonzero[i+1]?.value) {
      const nv = Math.min(nonzero[i].value + 1, targetFruit);
      out.push({ ...nonzero[i], value: nv, merged: true });
      gained += nv * 20;
      merged = true;
      mergedValues.push(nv);
      i++;
    } else {
      out.push(nonzero[i]);
    }
  }
  while(out.length < 4) out.push(null);
  return { line: out, gained, merged, mergedValues };
}

function getLine(dir, n){
  const arr = [];
  for (let i=0;i<4;i++) {
    if (dir==='left') arr.push(n*4+i);
    if (dir==='right') arr.push(n*4+(3-i));
    if (dir==='up') arr.push(i*4+n);
    if (dir==='down') arr.push((3-i)*4+n);
  }
  return arr;
}

function canMove(){
  if (emptyCells().length) return true;
  for (const dir of ['left','right','up','down']) {
    for (let n=0;n<4;n++) {
      const idxs = getLine(dir,n), vals = idxs.map(i=>board[i]?.value || 0);
      for (let i=0;i<3;i++) if (vals[i] && vals[i]===vals[i+1]) return true;
    }
  }
  return false;
}

function move(dir){
  if (gameEnded) {
    sfx('invalid');
    showToast('This orchard is finished — start a New Game! 🥭');
    return;
  }

  const before = boardSignature();
  let gained = 0;
  let anyMerged = false;
  let biggestMerge = 0;
  const next = Array(16).fill(null);

  for (let n=0;n<4;n++) {
    const idxs = getLine(dir,n);
    const vals = idxs.map(i=>board[i]);
    const res = slideLine(vals);
    gained += res.gained; anyMerged ||= res.merged;
    biggestMerge = Math.max(biggestMerge, ...res.mergedValues, 0);
    idxs.forEach((idx,k)=> {
      if (res.line[k]) next[idx] = { ...res.line[k], index: idx };
    });
  }

  board = next;
  if (boardSignature() === before) { sfx('invalid'); return; }

  score += gained;
  const madeMango = board.some(tile => tile?.value === targetFruit);
  // Keep Mango as the finish line: do not spawn another random fruit after winning.
  if (!madeMango) addRandomFruit();

  if (anyMerged) {
    tipIndex = (tipIndex + 1) % tips.length;
    catSpeech.textContent = tips[tipIndex];
    mangoSpeech.textContent = gained ? `Smooth combo! +${gained} points. ✨` : 'Nice move!';
    sfx(biggestMerge >= 6 ? 'bigMerge' : 'merge', biggestMerge);
  } else {
    sfx('move');
  }

  render();
  checkGameEnd();
}

function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(()=>toastEl.classList.add('hidden'), 2600);
}

function checkGameEnd(){
  if (!won && board.some(tile => tile?.value === targetFruit)) {
    won = true;
    gameEnded = true;
    showToast('You made a Mango! Game complete! 🥭✨');
    mangoSpeech.textContent = 'You made a juicy mango! Game complete — press New Game to play again. 🥭';
    sfx('win');
    render();
  } else if (!canMove()) {
    gameEnded = true;
    showToast('No more moves — try a fresh orchard!');
    mangoSpeech.textContent = 'No more moves — game over! Press New Game for a quick fresh orchard.';
    sfx('gameover');
    render();
  }
}

function usePower(type){
  initAudio();
  if (gameEnded) { sfx('invalid'); showToast('This orchard is finished — start a New Game! 🥭'); return; }
  if (powers[type]) { sfx('invalid'); showToast('That mango power was already used!'); return; }

  let changed = false;
  let bonus = 0;

  if (type === 'burst') {
    const targets = board
      .map((tile, index) => tile ? { tile, index } : null)
      .filter(Boolean)
      .sort((a, b) => a.tile.value - b.tile.value || a.index - b.index);
    const removeCount = Math.min(3, Math.max(0, targets.length - 1));
    if (removeCount < 1) { sfx('invalid'); showToast('Mango Burst needs at least 2 fruits.'); return; }
    targets.slice(0, removeCount).forEach(({ tile, index }) => { bonus += tile.value * 8; board[index] = null; });
    mangoSpeech.textContent = 'Mango Burst cleared your smallest fruits! 🥭💥';
    catSpeech.textContent = 'Meow tip: burst is perfect when tiny fruits are blocking your corner. 🐾';
    pulseBoard('burst');
    changed = true;
  }

  if (type === 'sprout') {
    const cells = emptyCells();
    if (cells.length) {
      const centerFirst = cells.sort((a, b) => Math.abs((a % 4) - 1.5) + Math.abs(Math.floor(a / 4) - 1.5) - (Math.abs((b % 4) - 1.5) + Math.abs(Math.floor(b / 4) - 1.5)));
      const idx = centerFirst[0];
      board[idx] = createTile(3, idx, true);
      mangoSpeech.textContent = 'Mango Sprout planted a sunny lemon! 🥭🌱🍋';
    } else {
      const targetIndex = board
        .map((tile, index) => ({ tile, index }))
        .filter(({tile}) => tile.value < targetFruit)
        .sort((a, b) => a.tile.value - b.tile.value || a.index - b.index)[0]?.index;
      if (targetIndex === undefined) { sfx('invalid'); return; }
      board[targetIndex] = { ...board[targetIndex], value: Math.min(board[targetIndex].value + 1, targetFruit), merged: true };
      mangoSpeech.textContent = 'Mango Sprout upgraded a tiny fruit because the board was full! 🥭🌱';
    }
    catSpeech.textContent = 'Meow tip: sprout gives you one helpful boost, so save it for a crowded board.';
    bonus = 30;
    pulseBoard('sprout');
    changed = true;
  }

  if (type === 'ripple') {
    const values = board.filter(Boolean).map(tile => tile.value).filter(value => value < targetFruit);
    if (!values.length) { sfx('invalid'); return; }
    const rippleValue = Math.min(...values);
    let upgraded = 0;
    board = board.map(tile => {
      if (!tile || tile.value !== rippleValue || upgraded >= 6) return tile;
      upgraded += 1;
      return { ...tile, value: Math.min(tile.value + 1, targetFruit), merged: true };
    });
    bonus = upgraded * (rippleValue + 1) * 10;
    mangoSpeech.textContent = `Mango Ripple upgraded ${upgraded} ${names[rippleValue].toLowerCase()} fruit${upgraded === 1 ? '' : 's'}! 🥭〰️`;
    catSpeech.textContent = 'Meow tip: ripple is strongest when lots of small matching fruits are on the board.';
    pulseBoard('ripple');
    changed = true;
  }

  if (!changed) return;
  powers[type] = true;
  score += bonus;
  showToast(`${type === 'burst' ? 'Mango Burst' : type === 'sprout' ? 'Mango Sprout' : 'Mango Ripple'} used — one time only!`);
  sfx('power', type === 'burst' ? 2 : type === 'sprout' ? 4 : 6);
  render();
  checkGameEnd();
}

document.addEventListener('keydown', e=>{
  const map = {ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down', a:'left', d:'right', w:'up', s:'down'};
  const dir = map[e.key];
  if (dir) { e.preventDefault(); initAudio(); move(dir); }
});
moveBtns.forEach(btn => btn.addEventListener('click', () => { initAudio(); move(btn.dataset.move); }));
powerBtns.forEach(btn => btn.addEventListener('click', () => usePower(btn.dataset.power)));
document.getElementById('newGameBtn').addEventListener('click', () => { initAudio(); newGame(true); });
soundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem(soundKey, soundEnabled ? 'on' : 'off');
  updateSoundButton();
  if (soundEnabled) sfx('button');
});

let touchStart = null;
boardEl.addEventListener('pointerdown', e => { if (!gameEnded) touchStart = {x:e.clientX, y:e.clientY}; });
boardEl.addEventListener('pointerup', e => {
  if (!touchStart) return;
  const dx=e.clientX-touchStart.x, dy=e.clientY-touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
  initAudio();
  move(Math.abs(dx) > Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
});

const tutorial = document.getElementById('tutorial');
const tutorialMascot = document.getElementById('tutorialMascot');
const tutorialSpeaker = document.getElementById('tutorialSpeaker');
const tutorialTitle = document.getElementById('tutorialTitle');
const tutorialText = document.getElementById('tutorialText');
const steps = [
  {who:'Mango says', img:'assets/mango.svg', title:'Welcome to Mango Merge!', text:'I’m Mango! Merge fruits until you make a juicy mango — with sparkly cute sounds!'},
  {who:'Mango says', img:'assets/mango.svg', title:'Move the whole board', text:'Use arrow keys, WASD, the buttons, or swipe. Every fruit slides together smoothly.'},
  {who:'Kiwi the Cat says', img:'assets/kiwi-cat.svg', title:'Meow Tip!', text:'The chain is strawberry → orange → lemon → grape → watermelon → coconut → pineapple → mango.'},
  {who:'Kiwi the Cat says', img:'assets/kiwi-cat.svg', title:'Cozy corner strategy', text:'Try keeping your biggest fruit in one corner so pineapple and mango combos are easier to plan.'},
  {who:'Mango says', img:'assets/mango.svg', title:'One-time mango powers', text:'Use Burst to clear tiny fruits, Sprout to plant a lemon, and Ripple to upgrade matching low fruits. Each power works once per game!'},
  {who:'Mango says', img:'assets/mango.svg', title:'Short and sweet!', text:'The game stops as soon as you make Mango or run out of moves. Press New Game for another quick orchard.'}
];
let step = 0;
function openTutorial(){ initAudio(); sfx('tutorial'); step=0; tutorial.classList.remove('hidden'); renderStep(); }
function closeTutorial(){ sfx('close'); tutorial.classList.add('hidden'); localStorage.setItem('mangoMergeTutorialSeen','yes'); }
function renderStep(){
  const s=steps[step]; tutorialMascot.src=s.img; tutorialSpeaker.textContent=s.who; tutorialTitle.textContent=s.title; tutorialText.textContent=s.text;
  document.getElementById('prevStep').disabled = step===0;
  document.getElementById('nextStep').textContent = step===steps.length-1 ? 'Let’s play!' : 'Next';
}
document.getElementById('helpBtn').addEventListener('click', openTutorial);
document.getElementById('closeTutorial').addEventListener('click', closeTutorial);
document.getElementById('prevStep').addEventListener('click', ()=>{ if(step>0){ sfx('button'); step--; renderStep();} else sfx('invalid'); });
document.getElementById('nextStep').addEventListener('click', ()=>{ if(step<steps.length-1){ sfx('button'); step++; renderStep();} else closeTutorial(); });

function exposeTestHooks(){
  const params = new URLSearchParams(window.location.search);
  if (!params.has('test')) return;
  window.mangoMergeTest = {
    setBoard(values) {
      board = values.map((value, index) => value ? createTile(value, index, false) : null);
      won = false; gameEnded = false; powers = { burst: false, sprout: false, ripple: false };
      render();
    },
    move,
    usePower,
    checkGameEnd,
    state() { return { values: board.map(tile => tile?.value || 0), tileCount: board.filter(Boolean).length, score, won, gameEnded, powers: {...powers} }; }
  };
}

updateSoundButton();
newGame(false);
exposeTestHooks();
if (!localStorage.getItem('mangoMergeTutorialSeen')) setTimeout(() => { step=0; tutorial.classList.remove('hidden'); renderStep(); }, 450);
