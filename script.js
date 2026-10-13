document.documentElement.classList.add('js');

// ---------- Oscilloscope hero ----------
(function () {
  const cv = document.getElementById('wave');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, mx = .5, my = .5, t = 0;
  function size() {
    const dpr = window.devicePixelRatio || 1;
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    const freq = 1.5 + mx * 4, amp = 14 + my * 46;
    [[.35, 0, 2], [.2, 1.2, 1.5], [.12, 2.4, 1]].forEach(([a, ph, lw], i) => {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = h * (.5 + i * .08) + Math.sin(x / w * Math.PI * 2 * freq + t + ph) * amp * (1 - i * .2);
        x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(232,168,64,${a})`; ctx.lineWidth = lw; ctx.stroke();
    });
    if (!still) { t += 0.03; requestAnimationFrame(draw); }
  }
  size(); draw();
  window.addEventListener('resize', () => { size(); if (still) draw(); });
  cv.parentElement.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height;
    if (still) draw();
  });
})();

// ---------- Breaker switch on each card ----------
function setOn(card, on) {
  card.classList.toggle('on', on);
  const b = card.querySelector('.breaker');
  b.setAttribute('aria-checked', on);
  b.querySelector('.lbl').textContent = on ? 'ON' : 'OFF';
}
document.querySelectorAll('.card').forEach(card => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'breaker'; b.setAttribute('role', 'switch');
  b.setAttribute('aria-label', 'Show details for ' + card.dataset.title);
  b.innerHTML = '<span class="track"><span class="knob"></span></span><span class="lbl">OFF</span>';
  b.addEventListener('click', () => setOn(card, !card.classList.contains('on')));
  card.querySelector('.thumb').appendChild(b);
  setOn(card, false);
});

// ---------- Filter ----------
const chips = document.querySelectorAll('.chip');
const cards = document.querySelectorAll('.card');
const empty = document.getElementById('empty');

chips.forEach(chip => chip.addEventListener('click', () => {
  const f = chip.dataset.filter;
  chips.forEach(c => {
    const on = c === chip;
    c.classList.toggle('active', on);
    c.setAttribute('aria-pressed', on);
  });
  let shown = 0;
  cards.forEach(card => {
    const match = f === 'all' || card.dataset.category === f;
    card.hidden = !match;
    if (match) shown++;
  });
  empty.hidden = shown > 0;
}));

document.getElementById('show-all').addEventListener('click', () => document.querySelector('[data-filter="all"]').click());

// ---------- Add to calendar (.ics download) ----------
const p2 = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`;

document.querySelectorAll('.cal').forEach(btn => btn.addEventListener('click', () => {
  const card = btn.closest('.card');
  const title = card.dataset.title;
  const dt = card.querySelector('time').getAttribute('datetime');
  const place = card.querySelector('.venue').textContent.split('\u2022')[0].trim() + ', NIT Kurukshetra';
  const [d, t] = dt.split('T');
  const [y, m, day] = d.split('-').map(Number);
  let start, end;
  if (t) {
    const [hh, mm] = t.split(':').map(Number);
    start = 'DTSTART:' + fmt(new Date(y, m - 1, day, hh, mm));
    end = 'DTEND:' + fmt(new Date(y, m - 1, day, hh + 2, mm)); // assumed 2-hour slot
  } else { // date only: all-day event
    const ymd = dd => `${dd.getFullYear()}${p2(dd.getMonth()+1)}${p2(dd.getDate())}`;
    start = 'DTSTART;VALUE=DATE:' + ymd(new Date(y, m - 1, day));
    end = 'DTEND;VALUE=DATE:' + ymd(new Date(y, m - 1, day + 1));
  }
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ElectroReck//Events//EN','BEGIN:VEVENT',
    `UID:${title.replace(/\s+/g,'-').toLowerCase()}-${dt}@electroreck`,
    'DTSTAMP:' + fmt(new Date()), start, end,
    `SUMMARY:${title} (ElectroReck)`, `LOCATION:${place}`, 'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = title.replace(/\s+/g, '-').toLowerCase() + '.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}));

// ---------- Registration modal ----------
const modal = document.getElementById('modal');
const form = document.getElementById('reg-form');
const success = document.getElementById('success');
const eventLabel = document.getElementById('modal-event');
let currentEvent = '';
let lastTrigger = null;

// Registrations are kept in the browser so the card state survives a reload.
const load = () => { try { return JSON.parse(localStorage.getItem('registrations')) || []; } catch { return []; } };
const save = list => { try { localStorage.setItem('registrations', JSON.stringify(list)); } catch {} };

function markRegistered(card) {
  const btn = card.querySelector('.register');
  btn.textContent = 'Registered';
  btn.disabled = true;
  setOn(card, true); // circuit closed
}
cards.forEach(card => {
  if (load().some(r => r.event === card.dataset.title)) markRegistered(card);
});

document.querySelectorAll('.register').forEach(btn => btn.addEventListener('click', () => {
  const card = btn.closest('.card');
  currentEvent = card.dataset.title;
  lastTrigger = btn;
  eventLabel.textContent = currentEvent;
  form.reset();
  clearErrors();
  form.hidden = false;
  success.hidden = true;
  modal.showModal();
  document.getElementById('name').focus();
}));

const closeModal = () => { modal.close(); lastTrigger && lastTrigger.focus(); };
document.getElementById('close').addEventListener('click', closeModal);
document.getElementById('done').addEventListener('click', closeModal);
document.getElementById('print').addEventListener('click', () => window.print());
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); }); // click on backdrop

// ---------- Validation ----------
const rules = {
  name:  v => v.trim().length >= 2 ? '' : 'Enter your full name.',
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email, like name@example.com.',
  roll:  v => v.trim().length >= 3 ? '' : 'Enter your roll number.',
  dept:  v => v ? '' : 'Select your department.',
  year:  v => v ? '' : 'Select your year of study.',
  phone: v => v.trim() === '' || /^\d{10}$/.test(v.trim()) ? '' : 'Enter a 10-digit number or leave it empty.',
  terms: () => form.elements.terms.checked ? '' : 'Please tick the box to continue.'
};

function setError(field, msg) {
  const input = form.elements[field];
  form.querySelector(`[data-for="${field}"]`).textContent = msg;
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
}
function clearErrors() { Object.keys(rules).forEach(f => setError(f, '')); }

Object.keys(rules).forEach(f =>
  form.elements[f].addEventListener('blur', e => setError(f, rules[f](e.target.value))));

form.addEventListener('submit', e => {
  e.preventDefault();
  let firstBad = null;
  Object.keys(rules).forEach(f => {
    const msg = rules[f](form.elements[f].value);
    setError(f, msg);
    if (msg && !firstBad) firstBad = form.elements[f];
  });
  if (firstBad) { firstBad.focus(); return; }

  const list = load();
  list.push({
    event: currentEvent,
    name: form.elements.name.value.trim(),
    roll: form.elements.roll.value.trim(),
    dept: form.elements.dept.value,
    email: form.elements.email.value.trim(),
    phone: form.elements.phone.value.trim(),
    year: form.elements.year.value,
    at: new Date().toISOString()
  });
  const passId = 'ER-2025-' + String(list.length).padStart(4, '0');
  list[list.length - 1].passId = passId;
  save(list);

  const card = document.querySelector(`.card[data-title="${currentEvent}"]`);
  document.getElementById('t-event').textContent = currentEvent;
  document.getElementById('t-name').textContent = form.elements.name.value.trim();
  document.getElementById('t-roll').textContent = form.elements.roll.value.trim();
  document.getElementById('t-date').textContent = card.querySelector('time').textContent;
  document.getElementById('t-venue').textContent = card.querySelector('.venue').textContent.split('\u2022')[0].trim();
  document.getElementById('t-id').textContent = passId;

  document.getElementById('success-msg').textContent =
    `Thanks, ${form.elements.name.value.trim().split(' ')[0]}. You are registered for ${currentEvent}. Keep an eye on ${form.elements.email.value.trim()} for updates from the ElectroReck team.`;
  form.hidden = true;
  success.hidden = false;
  markRegistered(document.querySelector(`.card[data-title="${currentEvent}"]`));
  document.getElementById('done').focus();
});


// ---------- Ohm's law calculator ----------
const oV = document.getElementById('o-v'), oI = document.getElementById('o-i'), oR = document.getElementById('o-r');
const oOut = document.getElementById('o-out');
const num = x => parseFloat(Number(x).toPrecision(5));

function ohm() {
  const f = { V: oV.value, I: oI.value, R: oR.value };
  const filled = Object.keys(f).filter(k => f[k] !== '');
  if (filled.length < 2) { oOut.textContent = 'Result appears here.'; return; }
  if (filled.length === 3) { oOut.textContent = 'Clear one field to calculate it.'; return; }
  if (filled.some(k => !(Number(f[k]) > 0))) { oOut.textContent = 'Enter values greater than 0.'; return; }
  let V = Number(f.V), I = Number(f.I), R = Number(f.R);
  let line;
  if (f.V === '') { V = I * R; line = `V = ${num(V)} V`; }
  else if (f.I === '') { I = V / R; line = `I = ${num(I)} A`; }
  else { R = V / I; line = `R = ${num(R)} \u03A9`; }
  oOut.textContent = `${line}   |   Power P = ${num(V * I)} W`;
}
[oV, oI, oR].forEach(el => el.addEventListener('input', ohm));
document.getElementById('o-clear').addEventListener('click', () => { oV.value = oI.value = oR.value = ''; ohm(); });


// ---------- Gallery lightbox ----------
const lb = document.getElementById('lightbox');
document.querySelectorAll('.g-item').forEach(b => b.addEventListener('click', () => {
  document.getElementById('lb-img').src = b.dataset.full;
  document.getElementById('lb-img').alt = b.dataset.cap + ' poster';
  document.getElementById('lb-cap').textContent = b.dataset.cap;
  lb.showModal();
}));
document.getElementById('lb-close').addEventListener('click', () => lb.close());
lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });

// ---------- Logic gate playground ----------
const gates = {
  AND: (a, b) => a & b, OR: (a, b) => a | b, NOT: a => +!a,
  NAND: (a, b) => +!(a & b), NOR: (a, b) => +!(a | b), XOR: (a, b) => a ^ b
};
const gType = document.getElementById('g-type'), gA = document.getElementById('g-a'), gB = document.getElementById('g-b');
const gOut = document.getElementById('g-out'), gLed = document.getElementById('g-led'), gTable = document.getElementById('g-table');
let A = 0, B = 0;

function gate() {
  const type = gType.value, one = type === 'NOT', fn = gates[type];
  gB.hidden = one;
  gA.textContent = 'A = ' + A; gA.setAttribute('aria-pressed', A === 1);
  gB.textContent = 'B = ' + B; gB.setAttribute('aria-pressed', B === 1);
  const y = fn(A, B);
  gOut.textContent = 'Y = ' + y; gLed.classList.toggle('on', y === 1);
  const rows = one ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]];
  gTable.innerHTML = '<tr><th>A</th>' + (one ? '' : '<th>B</th>') + '<th>Y</th></tr>' + rows.map(r => {
    const hit = one ? r[0] === A : r[0] === A && r[1] === B;
    return `<tr class="${hit ? 'hit' : ''}">${r.map(v => `<td>${v}</td>`).join('')}<td>${fn(r[0], r[1])}</td></tr>`;
  }).join('');
}
gA.addEventListener('click', () => { A ^= 1; gate(); });
gB.addEventListener('click', () => { B ^= 1; gate(); });
gType.addEventListener('change', gate);
gate();
