// La mano huye del puntero: si el ratón se acerca demasiado, salta lejos.
const el = document.getElementById("highFive");

const FLEE_RADIUS = 110; // distancia (px) a la que empieza a huir
const JUMP = 180;        // cuánto se aleja en cada huida
const MARGIN = 24;       // margen con los bordes de la pantalla

let x = 0;
let y = 0;

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

function flee(px, py) {
  const dx = x - px;
  const dy = y - py;
  const dist = Math.hypot(dx, dy);
  if (dist > FLEE_RADIUS) return;

  // Empuja en la dirección contraria al puntero
  const nx = dist === 0 ? Math.random() - 0.5 : dx / dist;
  const ny = dist === 0 ? Math.random() - 0.5 : dy / dist;
  const prevX = x;
  const prevY = y;
  place(x + nx * JUMP, y + ny * JUMP);

  // Si queda arrinconada contra un borde, reaparece en otro sitio
  if (Math.hypot(x - prevX, y - prevY) < JUMP / 3) {
    place(...randomSpot());
  }
}

// Posición inicial: centrada, debajo del título
place(window.innerWidth / 2, window.innerHeight * 0.78);
requestAnimationFrame(() => el.classList.add("ready"));

window.addEventListener("pointermove", (e) => flee(e.clientX, e.clientY));
window.addEventListener("pointerdown", (e) => flee(e.clientX, e.clientY));
window.addEventListener("resize", () => place(x, y));
