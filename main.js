import './style.css'
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAnalytics, logEvent } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";

let analytics;
if (import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) {
  try {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: "G-BJLK9339LN",
    };
    const app = initializeApp(firebaseConfig);
    analytics = getAnalytics(app);
    logEvent(analytics, 'session_start');
  } catch (e) {
    console.warn("Analytics error:", e);
  }
}

let publisherDomain = 'unknown';
if (document.referrer) {
    try {
        publisherDomain = new URL(document.referrer).hostname;
    } catch(e) {}
}

// 1. Fixed Resolution Scaling Architecture
const LOGICAL_WIDTH = 450;
const LOGICAL_HEIGHT = 800;

const container = document.getElementById('game-container');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const budsLayer = document.getElementById('buds-layer');
const victoryModal = document.getElementById('victory-modal');

let gameData = null;
let activeConnections = []; // { budA: id, likeA: emoji, budB: id, likeB: emoji }
let draggingState = null; // { sourceBud: id, sourceLike: emoji, x: px, y: px }

function resizeCanvas() {
  let effectiveHeight = window.innerHeight;
  if (params.get('autoplay') === 'split') {
      effectiveHeight = window.innerHeight / 2;
  }
  const scaleWidth = window.innerWidth / LOGICAL_WIDTH;
  const scaleHeight = effectiveHeight / LOGICAL_HEIGHT;
  const scale = Math.min(scaleWidth, scaleHeight);

  container.style.width = `${LOGICAL_WIDTH}px`;
  container.style.height = `${LOGICAL_HEIGHT}px`;
  container.style.minHeight = `${LOGICAL_HEIGHT}px`;
  container.style.transform = `scale(${scale})`;
  container.style.transformOrigin = 'center center';
  
  container.style.position = 'absolute';
  container.style.left = '50%';
  if (params.get('autoplay') === 'split') {
      container.style.top = '25%';
  } else {
      container.style.top = '50%';
  }
  container.style.marginLeft = `-${LOGICAL_WIDTH / 2}px`;
  container.style.marginTop = `-${LOGICAL_HEIGHT / 2}px`;

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight; 
  drawLines();
}
window.addEventListener('resize', resizeCanvas);

function updateUndoVisibility() {
  const undoBtn = document.getElementById('undo-btn');
  if (!undoBtn) return;
  if (activeConnections.length > 0) {
    undoBtn.classList.remove('hidden');
  } else {
    undoBtn.classList.add('hidden');
  }
}

function undoLastConnection() {
  if (activeConnections.length === 0) return;
  
  const lastConn = activeConnections.pop();
  
  // Re-enable the specific buttons
  const sourceBtn = document.querySelector(`.emoji-btn.like[data-bud="${lastConn.budA}"][data-index="${lastConn.indexA}"]`);
  const targetBtn = document.querySelector(`.emoji-btn.like[data-bud="${lastConn.budB}"][data-index="${lastConn.indexB}"]`);
  
  if (sourceBtn) sourceBtn.classList.remove('connected');
  if (targetBtn) targetBtn.classList.remove('connected');
  
  // Reset any animations
  document.querySelectorAll('.bud-container').forEach(b => b.classList.remove('shiver', 'ecstatic'));
  
  playSound('pop'); // Play a quick sound to confirm undo
  drawLines();
  updateUndoVisibility();
}


function getLogicalPos(e) {
  const rect = canvas.getBoundingClientRect();
  const touches = e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches : e.touches;
  const clientX = touches && touches.length > 0 ? touches[0].clientX : e.clientX;
  const clientY = touches && touches.length > 0 ? touches[0].clientY : e.clientY;
  
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

// 2. Load Game Data
async function initGame() {
  resizeCanvas();
  try {
    const epochParam = params.get('epoch');
    let fetchUrl = import.meta.env.BASE_URL + 'daily_puzzle.json';
    if (epochParam) {
      fetchUrl = import.meta.env.BASE_URL + `puzzles/${epochParam}.json`;
    }
    
    let res = await fetch(fetchUrl);
    if (!res.ok && epochParam) {
        res = await fetch(import.meta.env.BASE_URL + 'daily_puzzle.json');
    }
    gameData = await res.json();

    const isEmbed = params.get('mode') === 'embed';
    if (isEmbed && !epochParam) {
       let baseEpoch = gameData.epoch;
       if (baseEpoch % 3 !== 1) {
          let targetEpoch = baseEpoch;
          while(targetEpoch % 3 !== 1) targetEpoch++;
          let embedRes = await fetch(import.meta.env.BASE_URL + `puzzles/${targetEpoch}.json`);
          if (embedRes.ok) {
              gameData = await embedRes.json();
          }
       }
    }

    renderBuds();
    setupGlobalEvents();
    
    if (params.get('autoplay')) {
      setTimeout(() => {
        autoSolve(params.get('autoplay'));
      }, 1000);
    }
  } catch (err) {
    console.error("Failed to load puzzle", err);
  }
}

if (new URLSearchParams(window.location.search).get('autoplay') === 'split') {
    const asmrFile = new URLSearchParams(window.location.search).get('asmr');
    if (asmrFile) {
        const vid = document.createElement('video');
        vid.src = `/asmr/${asmrFile}`;
        vid.autoplay = true;
        vid.loop = true;
        vid.muted = true;
        vid.style.position = 'absolute';
        vid.style.bottom = '0';
        vid.style.left = '0';
        vid.style.width = '100%';
        vid.style.height = '50%';
        vid.style.objectFit = 'cover';
        document.body.appendChild(vid);
    }
    
    const banner = document.createElement('div');
    banner.innerText = "Bud Bud Puzzle from Oops-games";
    banner.style.position = 'absolute';
    banner.style.top = '50%';
    banner.style.left = '50%';
    banner.style.transform = 'translate(-50%, -50%)';
    banner.style.background = 'rgba(0, 0, 0, 0.85)';
    banner.style.color = '#fde047';
    banner.style.padding = '12px 24px';
    banner.style.borderRadius = '12px';
    banner.style.border = '2px solid #b45309';
    banner.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    banner.style.fontWeight = '800';
    banner.style.fontSize = '28px';
    banner.style.zIndex = '1000';
    banner.style.whiteSpace = 'nowrap';
    banner.style.boxShadow = '0 4px 15px rgba(0,0,0,0.5)';
    banner.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    document.body.appendChild(banner);
}

function renderBuds() {
  budsLayer.innerHTML = '';
  const numBuds = gameData.buds.length;
  const radius = 150;
  const centerX = LOGICAL_WIDTH / 2;
  const centerY = LOGICAL_HEIGHT / 2 + 50;

  gameData.buds.forEach((bud, i) => {
    const angle = (i / numBuds) * Math.PI * 2 - Math.PI / 2;
    bud.x = centerX + radius * Math.cos(angle);
    bud.y = centerY + radius * Math.sin(angle);

    const budEl = document.createElement('div');
    budEl.className = 'bud-container';
    budEl.id = `bud-${bud.id}`;
    budEl.style.left = `${bud.x}px`;
    budEl.style.top = `${bud.y}px`;

    // To ensure unique emoji classes even if a bud has duplicate likes (which shouldn't happen with our generator),
    // we use an index or just the emoji.
    budEl.innerHTML = `
      <img class="bud-image" src="${import.meta.env.BASE_URL}assets/${bud.asset}" draggable="false" />
      <div class="bud-popup">
        <div class="popup-row">
          <div class="emoji-btn like" data-bud="${bud.id}" data-emoji="${bud.likes[0]}" data-index="0"><img src="${import.meta.env.BASE_URL}assets/${bud.likes[0]}" style="width: 95%; height: 95%; object-fit: contain;" draggable="false" /></div>
          <div class="emoji-btn like" data-bud="${bud.id}" data-emoji="${bud.likes[1]}" data-index="1"><img src="${import.meta.env.BASE_URL}assets/${bud.likes[1]}" style="width: 95%; height: 95%; object-fit: contain;" draggable="false" /></div>
        </div>
        <div class="popup-row">
          <div class="emoji-btn dislike"><img src="${import.meta.env.BASE_URL}assets/${bud.dislike}" style="width: 95%; height: 95%; object-fit: contain;" draggable="false" /></div>
        </div>
      </div>
    `;

    budsLayer.appendChild(budEl);

    // Desktop hover
    budEl.addEventListener('mouseenter', () => budEl.classList.add('show-popup'));
    budEl.addEventListener('mouseleave', () => {
      if (!draggingState) budEl.classList.remove('show-popup');
    });

    // Mobile touch
    budEl.addEventListener('touchstart', (e) => {
      // Show popup for this bud, hide others
      document.querySelectorAll('.bud-container').forEach(b => {
        if (b !== budEl && !draggingState) b.classList.remove('show-popup');
      });
      budEl.classList.add('show-popup');
    }, {passive: true});
  });

  // Attach drag events to emoji-btn
  document.querySelectorAll('.emoji-btn.like').forEach(btn => {
    btn.addEventListener('mousedown', startDrag);
    btn.addEventListener('touchstart', startDrag, {passive: false});
  });
}

function startDrag(e) {
  e.preventDefault();
  const targetBtn = e.currentTarget || e.target.closest('.emoji-btn');
  if (targetBtn.classList.contains('connected')) return;
  
  const budId = parseInt(targetBtn.dataset.bud);
  const emoji = targetBtn.dataset.emoji;
  const index = targetBtn.dataset.index;
  const pos = getLogicalPos(e);
  
  draggingState = { sourceBud: budId, sourceLike: emoji, sourceIndex: index, x: pos.x, y: pos.y };
  
  drawLines();
}

function setupGlobalEvents() {
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, {passive: false});
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
  
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', undoLastConnection);
  }
  
  const tutBtn = document.getElementById('tutorial-btn');
  const tutModal = document.getElementById('tutorial-modal');
  const tutCloseBtn = document.getElementById('btn-close-tutorial');
  
  if (tutBtn && tutModal && tutCloseBtn) {
    tutBtn.addEventListener('click', () => tutModal.classList.remove('hidden'));
    tutCloseBtn.addEventListener('click', () => tutModal.classList.add('hidden'));
  }
}

function onMove(e) {
  if (!draggingState) return;
  e.preventDefault(); // prevent scrolling
  const pos = getLogicalPos(e);
  draggingState.x = pos.x;
  draggingState.y = pos.y;
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const targetEl = document.elementFromPoint(clientX, clientY);
  const budContainer = targetEl ? targetEl.closest('.bud-container') : null;
  
  document.querySelectorAll('.bud-container').forEach(b => {
    if (b === budContainer || b.id === `bud-${draggingState.sourceBud}`) {
      b.classList.add('show-popup');
    } else {
      b.classList.remove('show-popup');
    }
  });

  drawLines();
}

function getBudData(id) {
  return gameData.buds.find(b => b.id === id);
}

function onEnd(e) {
  if (!draggingState) return;
  const finalPos = getLogicalPos(e);
  
  let targetFound = false;
  
  const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
  
  let likeBtn = null;
  let closestDist = Infinity;
  
  // Robust "fat finger" geometric collision detection
  document.querySelectorAll('.emoji-btn.like').forEach(btn => {
      const rect = btn.getBoundingClientRect();
      // Only consider buttons that are currently visible/interactable
      if (rect.width > 0 && rect.height > 0) {
          const btnCx = rect.left + rect.width / 2;
          const btnCy = rect.top + rect.height / 2;
          const dist = Math.hypot(clientX - btnCx, clientY - btnCy);
          
          if (dist < 60 && dist < closestDist) {
              closestDist = dist;
              likeBtn = btn;
          }
      }
  });

  if (likeBtn && !likeBtn.classList.contains('connected')) {
    const targetBudId = parseInt(likeBtn.dataset.bud);
    const targetEmoji = likeBtn.dataset.emoji;
    const targetIndex = likeBtn.dataset.index;

    if (targetBudId !== draggingState.sourceBud) {
      const budA = getBudData(draggingState.sourceBud);
      const budB = getBudData(targetBudId);

      const sameEmoji = targetEmoji === draggingState.sourceLike;
      const bLikes = budB.likes;
      const aLikes = budA.likes;
      const noDislikeConflict = 
        !bLikes.includes(budA.dislike) &&
        !aLikes.includes(budB.dislike);

      if (sameEmoji && noDislikeConflict) {
        // Success
        activeConnections.push({
          budA: draggingState.sourceBud,
          likeA: draggingState.sourceLike,
          indexA: draggingState.sourceIndex,
          budB: targetBudId,
          likeB: targetEmoji,
          indexB: targetIndex
        });
        
        document.querySelector(`.emoji-btn.like[data-bud="${budA.id}"][data-index="${draggingState.sourceIndex}"]`).classList.add('connected');
        document.querySelector(`.emoji-btn.like[data-bud="${budB.id}"][data-index="${targetIndex}"]`).classList.add('connected');

        playSound('happy');
        
        document.querySelectorAll('.bud-container').forEach(b => {
          b.classList.remove('shiver', 'ecstatic');
          void b.offsetWidth; // trigger reflow
          if (b.id === `bud-${budA.id}` || b.id === `bud-${budB.id}`) {
            b.classList.add('ecstatic');
          } else {
            b.classList.add('shiver');
          }
        });
        
        const heart = document.getElementById('heart-container');
        if (heart) {
          heart.classList.remove('pop');
          void heart.offsetWidth;
          heart.classList.add('pop');
        }

        const undoBtn = document.getElementById('undo-btn');
        if (undoBtn) undoBtn.classList.remove('hidden');
      } else {
        playSound('unhappy');
      }
    }
  } else {
     if (Math.hypot(draggingState.x - getBudData(draggingState.sourceBud).x, draggingState.y - getBudData(draggingState.sourceBud).y) > 50) {
        playSound('unhappy');
     }
  }

  draggingState = null;
  document.querySelectorAll('.bud-container').forEach(b => b.classList.remove('show-popup'));
  drawLines();
  checkWinState();
}

function jumpBuds(id1, id2) {
  const b1 = document.getElementById(`bud-${id1}`);
  const b2 = document.getElementById(`bud-${id2}`);
  b1.classList.add('jumping');
  b2.classList.add('jumping');
  setTimeout(() => {
    b1.classList.remove('jumping');
    b2.classList.remove('jumping');
  }, 500);
}

function playSound(type) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  if (type === 'happy') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }
}

function getEmojiPosition(budId, index) {
  const btn = document.querySelector(`.emoji-btn.like[data-bud="${budId}"][data-index="${index}"]`);
  if (btn) {
    const rect = btn.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      x: (rect.left + rect.width / 2 - canvasRect.left) * (canvas.width / canvasRect.width),
      y: (rect.top + rect.height / 2 - canvasRect.top) * (canvas.height / canvasRect.height)
    };
  }
  const bud = getBudData(budId);
  return { x: bud.x, y: bud.y - 45 }; 
}

function drawLines() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#000000'; // Black Miro lines
  ctx.setLineDash([]); // Solid lines

  let drawnPairs = {};
  activeConnections.forEach(conn => {
    const budA = getBudData(conn.budA);
    const budB = getBudData(conn.budB);
    const key = [conn.budA, conn.budB].sort().join('-');
    drawnPairs[key] = (drawnPairs[key] || 0) + 1;
    
    const count = drawnPairs[key];
    
    const dx = budB.x - budA.x;
    const dy = budB.y - budA.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    
    // Ensure normal points towards the center of the board
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2 + 50;
    const mx = budA.x + dx / 2;
    const my = budA.y + dy / 2;
    if (nx * (cx - mx) + ny * (cy - my) < 0) {
      nx = -nx;
      ny = -ny;
    }
    
    // Alternate loops for multiple connections between same buds
    const sign = count % 2 === 0 ? -1 : 1;
    const amp = 80 + (Math.floor((count - 1) / 2) * 40); // Increase amplitude if >2 connections
    
    // Cross over control points to create a loop
    const cp1x = budA.x + dx * 0.65 + nx * amp * sign;
    const cp1y = budA.y + dy * 0.65 + ny * amp * sign;
    const cp2x = budA.x + dx * 0.35 + nx * amp * sign;
    const cp2y = budA.y + dy * 0.35 + ny * amp * sign;
    
    ctx.beginPath();
    ctx.moveTo(budA.x, budA.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, budB.x, budB.y);
    ctx.stroke();
  });

  if (draggingState) {
    const budA = getBudData(draggingState.sourceBud);
    ctx.strokeStyle = '#000000';
    
    const dx = draggingState.x - budA.x;
    const dy = draggingState.y - budA.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    
    // Ensure normal points towards the center of the board
    const cx = LOGICAL_WIDTH / 2;
    const cy = LOGICAL_HEIGHT / 2 + 50;
    const mx = budA.x + dx / 2;
    const my = budA.y + dy / 2;
    if (nx * (cx - mx) + ny * (cy - my) < 0) {
      nx = -nx;
      ny = -ny;
    }
    
    // Scale the loop amplitude based on drag distance so it forms naturally
    const amp = Math.min(len * 0.4, 80);
    const cp1x = budA.x + dx * 0.65 + nx * amp;
    const cp1y = budA.y + dy * 0.65 + ny * amp;
    const cp2x = budA.x + dx * 0.35 + nx * amp;
    const cp2y = budA.y + dy * 0.35 + ny * amp;

    ctx.beginPath();
    ctx.moveTo(budA.x, budA.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, draggingState.x, draggingState.y);
    ctx.stroke();
  }
}

function checkWinState() {
  if (activeConnections.length === gameData.buds.length) {
    setTimeout(showVictory, 1000);
  }
}

function getDailyCypher(gameIndex) {
  const seed = gameData && gameData.epoch ? gameData.epoch : Math.floor(new Date().getTime() / 86400000);
  const x = Math.sin(seed + gameIndex) * 10000;
  return "Cypher: " + Math.floor((x - Math.floor(x)) * 10000).toString().padStart(4, '0');
}

async function autoSolve(format) {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const edges = [];
  const buds = gameData.buds;
  
  // Collect all valid edges
  for (let i = 0; i < buds.length; i++) {
    for (let j = i + 1; j < buds.length; j++) {
      const a = buds[i];
      const b = buds[j];
      const sharedLikes = a.likes.filter(l => b.likes.includes(l));
      if (sharedLikes.length > 0) {
        sharedLikes.forEach(like => {
          if (!a.likes.includes(b.dislike) && !b.likes.includes(a.dislike)) {
            edges.push({a, b, like});
          }
        });
      }
    }
  }

  // To solve, we need a cycle of length N
  // In a well-formed puzzle, the generator guarantees exactly one valid cycle of length N.
  // We'll just grab N unique connections.
  const speedMultiplier = format === 'split' ? 3 : 1;
  const moves = edges.slice(0, buds.length);
  const movesToPlay = format === 'interactive' ? moves.slice(0, moves.length - 1) : moves;

  for (let move of movesToPlay) {
    const btnA = document.querySelector(`.emoji-btn.like[data-bud="${move.a.id}"][data-emoji="${move.like}"]:not(.connected)`);
    const btnB = document.querySelector(`.emoji-btn.like[data-bud="${move.b.id}"][data-emoji="${move.like}"]:not(.connected)`);
    if (!btnA || !btnB) continue;
    
    const rectA = btnA.getBoundingClientRect();
    const rectB = btnB.getBoundingClientRect();
    
    // Mousedown A
    btnA.dispatchEvent(new MouseEvent('mousedown', {
      clientX: rectA.left + rectA.width/2,
      clientY: rectA.top + rectA.height/2,
      bubbles: true
    }));
    
    await sleep(300 / speedMultiplier);
    
    // Drag to B
    const steps = 15;
    for(let k=1; k<=steps; k++) {
      const x = rectA.left + (rectB.left - rectA.left) * (k/steps);
      const y = rectA.top + (rectB.top - rectA.top) * (k/steps);
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: x + rectB.width/2,
        clientY: y + rectB.height/2,
        bubbles: true
      }));
      await sleep(30 / speedMultiplier);
    }
    
    // Mouseup B
    document.dispatchEvent(new MouseEvent('mouseup', {
      clientX: rectB.left + rectB.width/2,
      clientY: rectB.top + rectB.height/2,
      bubbles: true
    }));
    
    await sleep(600 / speedMultiplier);
  }

  if (format === 'fail') {
    // Make a wrong move
    const wrongBuds = document.querySelectorAll('.bud-container');
    if (wrongBuds.length >= 2) {
       const btnA = wrongBuds[0].querySelector('.emoji-btn.like:not(.connected)');
       const btnB = wrongBuds[1].querySelector('.emoji-btn.like:not(.connected)');
       if (btnA && btnB) {
         const rectA = btnA.getBoundingClientRect();
         const rectB = btnB.getBoundingClientRect();
         btnA.dispatchEvent(new MouseEvent('mousedown', { clientX: rectA.left + rectA.width/2, clientY: rectA.top + rectA.height/2, bubbles: true }));
         await sleep(200);
         document.dispatchEvent(new MouseEvent('mouseup', { clientX: rectB.left + rectB.width/2, clientY: rectB.top + rectB.height/2, bubbles: true }));
         await sleep(600);
       }
    }
  }

  if (format === 'interactive' || format === 'fail') {
     window._VIDEO_RECORDING_DONE = true;
  }
}

function showVictory() {
  window._VIDEO_RECORDING_DONE = true;
  victoryModal.classList.remove('hidden');
  document.getElementById('vic-cypher').innerText = getDailyCypher(0);
  
  const nextBtn = document.getElementById('btn-next-level');
  if (gameData.buds.length < 8 && !params.get('carousel')) {
     nextBtn.classList.remove('hidden');
  } else {
     nextBtn.classList.add('hidden');
  }

  if (analytics) {
      let eventParams = {};
      if (params.get('mode') === 'embed') eventParams.publisher_domain = publisherDomain;
      logEvent(analytics, 'level_complete', eventParams);
  }
}

// Victory Modal Listeners
document.getElementById('btn-next-level').addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'next_level_clicked');
    window.location.href = `/?epoch=${gameData.epoch + 1}`;
});
document.getElementById('btn-install').addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'install_prompt_clicked');
    alert("Add to Home Screen from your browser menu!");
});
document.getElementById('btn-share').addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'brag_clicked');
    alert("Thanks for sharing!");
});
document.getElementById('btn-binge').addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'binge_presale_click');
    window.location.href = 'https://oops-games-hub.web.app/presale.html';
});
document.getElementById('btn-hub').addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'hub_clicked');
    window.location.href = 'https://oops-games-hub.web.app';
});
document.getElementById('btn-next').addEventListener('click', advanceCarousel);
document.getElementById('btn-binge-carousel').addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'binge_presale_click');
    window.location.href = 'https://oops-games-hub.web.app/presale.html?carousel=true';
});

document.getElementById('btn-embed-hook')?.addEventListener('click', () => {
    if (analytics) logEvent(analytics, 'embed_hook_clicked');
    window.open('https://oops-games-hub.web.app/', '_blank');
});

async function advanceCarousel() {
  const playedGamesStr = params.get('played') || '';
  let currentPlayed = playedGamesStr ? playedGamesStr.split(',').filter(Boolean) : [];
  if (!currentPlayed.includes('BB')) currentPlayed.push('BB');
  
  try {
      const res = await fetch('https://oops-games-hub.web.app/carousel_config.json');
      const configList = await res.json();
      const unplayed = configList.filter(g => !currentPlayed.includes(g.id));
      if (unplayed.length > 0) {
          const nextGame = unplayed[Math.floor(Math.random() * unplayed.length)];
          window.location.href = `${nextGame.url}?carousel=true&played=${currentPlayed.join(',')}`;
      } else {
          window.location.href = 'https://oops-games-hub.web.app/';
      }
  } catch(e) {
      window.location.href = 'https://oops-games-hub.web.app/';
  }
}

const params = new URLSearchParams(window.location.search);
if (params.get('mode') === 'embed') {
  if (analytics) logEvent(analytics, 'embed_visit', { game_id: 'BB', publisher_domain: publisherDomain });
  document.getElementById('standard-buttons').classList.add('hidden');
  document.getElementById('carousel-buttons').classList.add('hidden');
  const embedBtns = document.getElementById('embed-buttons');
  if (embedBtns) embedBtns.classList.remove('hidden');
  document.getElementById('vic-cypher').style.display = 'none';
  const h2 = document.querySelector('#victory-modal h2');
  if (h2) h2.innerText = "Level 1 Complete!";
} else if (params.get('carousel') === 'true') {
  if (analytics) logEvent(analytics, 'carousel_visit', { game_id: 'BB' });
  document.getElementById('standard-buttons').classList.add('hidden');
  document.getElementById('carousel-buttons').classList.remove('hidden');
}

// Autoplay logic moved into autoSolve function
initGame();
