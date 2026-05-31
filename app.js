const fruits = [null, '🍒', '🍓', '🥝', '🥥', '🥭'];
const names = ['', 'Cherry', 'Strawberry', 'Kiwi', 'Coconut', 'Mango'];
let board = Array(16).fill(0);
let score = 0;
let won = false;
const bestKey = 'mangoMergeBest';
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const boardEl = document.getElementById('board');
const toastEl = document.getElementById('toast');
const mangoSpeech = document.getElementById('mangoSpeech');
const catSpeech = document.getElementById('catSpeech');

const tips = [
  'Meow tip: keep your biggest fruit cozy in a corner. 🐾',
  'Meow tip: try not to scatter coconuts everywhere!',
  'Meow tip: if the board feels crowded, make tiny merges first.',
  'Meow tip: two 🥥 coconuts make the dream — 🥭 mango!'
];
let tipIndex = 0;

function best(){ return Number(localStorage.getItem(bestKey) || 0); }
function setBest(v){ localStorage.setItem(bestKey, String(v)); }
function emptyCells(){ return board.map((v,i)=> v===0 ? i : -1).filter(i=>i>=0); }
function addRandomFruit(){
  const cells = emptyCells();
  if (!cells.length) return;
  const idx = cells[Math.floor(Math.random()*cells.length)];
  board[idx] = Math.random() < 0.86 ? 1 : 2;
}
function newGame(){
  board = Array(16).fill(0); score = 0; won = false;
  addRandomFruit(); addRandomFruit();
  mangoSpeech.textContent = 'Fresh board! Match fruits until you grow a mango. 🥭';
  catSpeech.textContent = tips[0];
  render();
}
function render(popIndexes=[]){
  scoreEl.textContent = score;
  if (score > best()) setBest(score);
  bestEl.textContent = best();
  boardEl.innerHTML = '';
  board.forEach((v,i)=>{
    const cell = document.createElement('div');
    cell.className = 'cell' + (v ? ' filled' : '') + (popIndexes.includes(i) ? ' pop' : '');
    cell.setAttribute('role','gridcell');
    cell.setAttribute('aria-label', v ? names[v] : 'empty');
    cell.textContent = fruits[v] || '';
    boardEl.appendChild(cell);
  });
}
function slideLine(line){
  const nonzero = line.filter(Boolean);
  const out = [];
  let gained = 0;
  let merged = false;
  for (let i=0; i<nonzero.length; i++) {
    if (nonzero[i] === nonzero[i+1]) {
      const nv = Math.min(nonzero[i]+1, fruits.length-1);
      out.push(nv); gained += nv * 10; merged = true; i++;
    } else out.push(nonzero[i]);
  }
  while(out.length < 4) out.push(0);
  return { line: out, gained, merged };
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
      const idxs = getLine(dir,n), vals = idxs.map(i=>board[i]);
      for (let i=0;i<3;i++) if (vals[i] && vals[i]===vals[i+1]) return true;
    }
  }
  return false;
}
function move(dir){
  const before = board.join(',');
  let gained = 0;
  let anyMerged = false;
  const next = board.slice();
  for (let n=0;n<4;n++) {
    const idxs = getLine(dir,n);
    const vals = idxs.map(i=>board[i]);
    const res = slideLine(vals);
    gained += res.gained; anyMerged ||= res.merged;
    idxs.forEach((idx,k)=> next[idx]=res.line[k]);
  }
  board = next;
  if (board.join(',') === before) return;
  score += gained;
  addRandomFruit();
  if (anyMerged) {
    tipIndex = (tipIndex + 1) % tips.length;
    catSpeech.textContent = tips[tipIndex];
    mangoSpeech.textContent = gained ? `Yay! +${gained} points. Keep merging! ✨` : 'Nice move!';
  }
  render();
  if (!won && board.includes(5)) {
    won = true;
    showToast('You made a Mango! You win! 🥭✨');
    mangoSpeech.textContent = 'You made a juicy mango! I’m so proud! 🥭';
  } else if (!canMove()) {
    showToast('No more moves — try a fresh orchard!');
    mangoSpeech.textContent = 'That orchard is full! New game?';
  }
}
function showToast(msg){
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(()=>toastEl.classList.add('hidden'), 2600);
}

document.addEventListener('keydown', e=>{
  const map = {ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down', a:'left', d:'right', w:'up', s:'down'};
  const dir = map[e.key];
  if (dir) { e.preventDefault(); move(dir); }
});
document.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => move(btn.dataset.move)));
document.getElementById('newGameBtn').addEventListener('click', newGame);

let touchStart = null;
boardEl.addEventListener('pointerdown', e => { touchStart = {x:e.clientX, y:e.clientY}; });
boardEl.addEventListener('pointerup', e => {
  if (!touchStart) return;
  const dx=e.clientX-touchStart.x, dy=e.clientY-touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
  move(Math.abs(dx) > Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
});

const tutorial = document.getElementById('tutorial');
const tutorialMascot = document.getElementById('tutorialMascot');
const tutorialSpeaker = document.getElementById('tutorialSpeaker');
const tutorialTitle = document.getElementById('tutorialTitle');
const tutorialText = document.getElementById('tutorialText');
const steps = [
  {who:'Mango says', img:'assets/mango.svg', title:'Welcome to Mango Merge!', text:'I’m Mango! Merge matching fruits until you make a juicy mango.'},
  {who:'Mango says', img:'assets/mango.svg', title:'Move the whole board', text:'Use arrow keys, WASD, the buttons, or swipe. Every fruit slides together.'},
  {who:'Kiwi the Cat says', img:'assets/kiwi-cat.svg', title:'Meow Tip!', text:'Two matching fruits become the next fruit. Cherry to strawberry, strawberry to kiwi, kiwi to coconut, coconut to mango!'},
  {who:'Kiwi the Cat says', img:'assets/kiwi-cat.svg', title:'Cozy corner strategy', text:'Try keeping your biggest fruit in one corner so combos are easier to plan.'},
  {who:'Mango says', img:'assets/mango.svg', title:'Ready?', text:'That’s it. Let’s merge some fruit!'}
];
let step = 0;
function openTutorial(){ step=0; tutorial.classList.remove('hidden'); renderStep(); }
function closeTutorial(){ tutorial.classList.add('hidden'); localStorage.setItem('mangoMergeTutorialSeen','yes'); }
function renderStep(){
  const s=steps[step]; tutorialMascot.src=s.img; tutorialSpeaker.textContent=s.who; tutorialTitle.textContent=s.title; tutorialText.textContent=s.text;
  document.getElementById('prevStep').disabled = step===0;
  document.getElementById('nextStep').textContent = step===steps.length-1 ? 'Let’s play!' : 'Next';
}
document.getElementById('helpBtn').addEventListener('click', openTutorial);
document.getElementById('closeTutorial').addEventListener('click', closeTutorial);
document.getElementById('prevStep').addEventListener('click', ()=>{ if(step>0){step--; renderStep();} });
document.getElementById('nextStep').addEventListener('click', ()=>{ if(step<steps.length-1){step++; renderStep();} else closeTutorial(); });

newGame();
if (!localStorage.getItem('mangoMergeTutorialSeen')) setTimeout(openTutorial, 450);
