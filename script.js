// La mano huye del puntero, pero se cansa: al final se deja atrapar.
const el = document.getElementById("highFive");
const label = el.querySelector(".label");
const statsEl = document.getElementById("stats");
const cursorHand = document.getElementById("cursorHand");
const canvas = document.getElementById("confetti");

const FLEE_RADIUS = 110; // distancia (px) a la que empieza a huir
const JUMP = 180;        // cuánto se aleja en la primera huida
const MARGIN = 24;       // margen con los bordes de la pantalla
const EXHAUSTED = 10;    // huidas hasta que se rinde
const NEAR = 220;        // distancia a la que el cursor se convierte en mano
const RECORD_KEY = "brandemia:record";

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Texto según cuántas veces ha huido
const MOODS = [
  [0, "Choca esos 5"],
  [1, "¡Casi!"],
  [3, "Más rápido"],
  [5, "Ni de broma"],
  [7, "Uf, qué cansancio…"],
  [EXHAUSTED, "Vale, vale…"],
];

let x = 0;
let y = 0;
let tired = 0;        // huidas en esta partida
let restingUntil = 0; // tras cada huida tarda un poco más en reaccionar
let feint = null;     // amago en curso
let caught = false;
let startTime = null;
let lastPointer = { x: -1e4, y: -1e4 };

cursorHand.appendChild(el.querySelector(".hand").cloneNode(true));

function size() {
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
}

// Coloca el centro del bloque en (cx, cy), sin salirse de la pantalla
function place(cx, cy) {
  const { w, h } = size();
  x = Math.min(Math.max(cx, MARGIN + w / 2), window.innerWidth - MARGIN - w / 2);
  y = Math.min(Math.max(cy, MARGIN + h / 2), window.innerHeight - MARGIN - h / 2);
  el.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px)`;
}

function randomSpot() {
  return [Math.random() * window.innerWidth, Math.random() * window.innerHeight];
}

function updateMood() {
  label.textContent = MOODS.filter(([n]) => tired >= n).pop()[1];
  el.dataset.mood = tired >= 7 ? "tired" : "";
}

function canFlee() {
  return !caught && !feint && tired < EXHAUSTED && performance.now() >= restingUntil;
}

function tryFlee(px, py) {
  if (!canFlee()) return;
  if (Math.hypot(x - px, y - py) > FLEE_RADIUS - tired * 5) return;

  // A media partida a veces amaga: se queda quieta un instante y luego salta
  if (tired >= 3 && Math.random() < 0.25) {
    feint = setTimeout(() => {
      feint = null;
      jump(lastPointer.x, lastPointer.y);
    }, 260);
    return;
  }
  jump(px, py);
}

function jump(px, py) {
  if (caught) return;
  if (startTime === null) startTime = performance.now();

  // Empuja en la dirección contraria al puntero, cada vez con menos fuerza
  const dx = x - px;
  const dy = y - py;
  const dist = Math.hypot(dx, dy);
  const angle = dist === 0 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
  const strength = JUMP * (1 - tired / (EXHAUSTED + 4));
  const prevX = x;
  const prevY = y;
  place(x + Math.cos(angle) * strength, y + Math.sin(angle) * strength);

  // Si queda arrinconada contra un borde, reaparece en otro sitio
  if (Math.hypot(x - prevX, y - prevY) < strength / 3) {
    place(...randomSpot());
  }

  tired++;
  restingUntil = performance.now() + tired * 45;
  updateMood();
}

// --- Choque ---

function catchIt() {
  caught = true;
  clearTimeout(feint);
  feint = null;

  const time = (performance.now() - (startTime ?? performance.now())) / 1000;
  const record = readRecord();
  const isRecord = record === null || time < record;
  if (isRecord) saveRecord(time);

  label.textContent = "¡Eso es!";
  el.dataset.mood = "";
  document.body.classList.remove("near");
  document.body.classList.add("caught");
  statsEl.innerHTML =
    `La has atrapado en <strong>${fmt(time)}</strong>` +
    (isRecord ? " · ¡Nuevo récord!" : ` · Tu récord: ${fmt(record)}`);

  clap();
  if (!reduceMotion) confetti();
  setTimeout(reset, 2200);
}

function reset() {
  caught = false;
  tired = 0;
  restingUntil = 0;
  startTime = null;
  document.body.classList.remove("caught");
  updateMood();
  place(window.innerWidth / 2, window.innerHeight * 0.78);
}

// --- Récord (se guarda solo en este navegador) ---

function fmt(seconds) {
  return `${seconds.toFixed(1).replace(".", ",")} s`;
}

function readRecord() {
  try {
    const value = parseFloat(localStorage.getItem(RECORD_KEY));
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function saveRecord(seconds) {
  try {
    localStorage.setItem(RECORD_KEY, String(seconds));
  } catch {
    // Sin almacenamiento (modo privado): el récord dura solo esta visita
  }
}

function showRecord() {
  const record = readRecord();
  statsEl.innerHTML = record === null ? "Atrápala si puedes" : `Tu récord: <strong>${fmt(record)}</strong>`;
}

// --- Efectos ---

let audio;

// Palmada sintetizada: tres golpes de ruido filtrado muy seguidos
function clap() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const length = Math.floor(0.2 * audio.sampleRate);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

    [0, 0.012, 0.024].forEach((offset, i) => {
      const last = i === 2;
      const start = audio.currentTime + offset;
      const src = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      src.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = 1400;
      filter.Q.value = 0.9;
      gain.gain.setValueAtTime(last ? 0.9 : 0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (last ? 0.18 : 0.02));
      src.connect(filter).connect(gain).connect(audio.destination);
      src.start(start);
      src.stop(start + 0.2);
    });
  } catch {
    // Sin audio no pasa nada
  }
}

function confetti() {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const colors = ["#000000", "#000000", "#666666", "#bbbbbb"];
  const pieces = Array.from({ length: 140 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[i % colors.length],
    };
  });

  const DURATION = 1800;
  const t0 = performance.now();
  function frame(now) {
    const t = now - t0;
    ctx.clearRect(0, 0, w, h);
    if (t >= DURATION) return;
    ctx.globalAlpha = 1 - t / DURATION;
    for (const p of pieces) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Con ratón, el cursor se convierte en una mano al acercarse
function moveCursor(px, py) {
  cursorHand.style.transform = `translate(${px}px, ${py}px)`;
  document.body.classList.toggle("near", !caught && Math.hypot(x - px, y - py) < NEAR);
}

// --- Arranque ---

place(window.innerWidth / 2, window.innerHeight * 0.78);
requestAnimationFrame(() => el.classList.add("ready"));
showRecord();

window.addEventListener("pointermove", (e) => {
  lastPointer = { x: e.clientX, y: e.clientY };
  if (e.pointerType === "mouse") moveCursor(e.clientX, e.clientY);
  tryFlee(e.clientX, e.clientY);
});

window.addEventListener("pointerdown", (e) => tryFlee(e.clientX, e.clientY));

// Tocar la mano: si aún tiene fuerzas se escapa; si no, ¡choque!
el.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  if (caught) return;
  if (canFlee()) jump(e.clientX, e.clientY);
  else catchIt();
});

document.addEventListener("mouseleave", () => document.body.classList.remove("near"));
window.addEventListener("resize", () => place(x, y));
