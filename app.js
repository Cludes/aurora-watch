'use strict';

const SRC = {
  kp:       'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
  forecast: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json',
  plasma:   'https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json',
  mag:      'https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json',
};
const REFRESH_MS = 5 * 60 * 1000;

// Approx minimum Kp for aurora to become visible low on the southern horizon, by state
// (driven by geomagnetic latitude - Tasmania is closest to the pole, so it sees it first).
const REGIONS = [
  { name: 'Tasmania',         kp: 4 },
  { name: 'Victoria',         kp: 6 },
  { name: 'South Australia',  kp: 6 },
  { name: 'ACT',              kp: 7 },
  { name: 'New South Wales',  kp: 7 },
  { name: 'Western Australia', kp: 7 },
  { name: 'Queensland',       kp: 8 },
  { name: 'Northern Territory', kp: 9 },
];

function kpColor(kp) {
  if (kp >= 8) return '#ff4a6e';
  if (kp >= 7) return '#ff7a59';
  if (kp >= 6) return '#ff8c42';
  if (kp >= 5) return '#ffd23f';
  if (kp >= 4) return '#9be15d';
  return '#00e5ff';
}

// likelihood tier for a region given current Kp (kp >= threshold => visible; +1 over => strong)
function chance(kp, threshold) {
  if (kp >= threshold + 1) return { t: 'likely',   c: '#9be15d' };
  if (kp >= threshold)     return { t: 'possible', c: '#ffd23f' };
  if (kp >= threshold - 1) return { t: 'slim',     c: '#ff8c42' };
  return { t: 'no', c: '#5a6575' };
}
const CHANCE_LABEL = { likely: 'Likely', possible: 'Possible', slim: 'Slim', no: 'Unlikely' };

async function getJSON(u) {
  const r = await fetch(u + '?t=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(`${u} -> ${r.status}`);
  return r.json();
}

function num(x) { const n = parseFloat(x); return Number.isFinite(n) ? n : null; }

async function load() {
  try {
    const [kpArr, fcArr, plasma, mag] = await Promise.all([
      getJSON(SRC.kp), getJSON(SRC.forecast), getJSON(SRC.plasma), getJSON(SRC.mag),
    ]);

    const kp = num(kpArr[kpArr.length - 1].Kp);
    // plasma/mag are [header, ...rows]; last row is newest
    const speed = num(plasma[plasma.length - 1][2]);
    const density = num(plasma[plasma.length - 1][1]);
    const bz = num(mag[mag.length - 1][3]);

    renderVerdict(kp, bz);
    renderScale(kp);
    renderHistory(kpArr);
    renderRegions(kp);
    renderTiles(kp, bz, speed, density);
    renderForecast(fcArr);

    document.getElementById('updated').textContent =
      'Updated ' + new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    document.getElementById('v-text').textContent = 'Could not load space-weather data';
    console.error(e);
  }
}

function renderVerdict(kp, bz) {
  // best (southernmost-reaching) region currently in play
  const visible = REGIONS.filter(r => kp >= r.kp);
  const bzSouth = bz != null && bz <= -5;
  let text, sub;
  if (!visible.length) {
    text = 'Quiet - aurora unlikely anywhere tonight';
    sub = kp >= 3 ? 'Keep an eye on Tasmania if activity picks up.' : 'Geomagnetic activity is low.';
  } else {
    const northern = visible[visible.length - 1].name; // last = highest threshold reached
    text = `Possible as far north as ${northern}`;
    sub = bzSouth ? 'Solar wind is favourable (Bz pointing south) - look to the southern horizon after dark.'
                  : 'Look low on the southern horizon after astronomical dusk; a camera sees more than the eye.';
  }
  const vt = document.getElementById('v-text');
  vt.textContent = text; vt.style.color = visible.length ? kpColor(kp) : '#cfd6e0';
  document.getElementById('v-sub').textContent = sub;
}

function renderScale(kp) {
  document.getElementById('kp-val').textContent = kp != null ? kp.toFixed(1) : '–';
  const scale = document.getElementById('kp-scale');
  scale.innerHTML = '';
  for (let i = 0; i <= 9; i++) {
    const seg = document.createElement('div');
    seg.className = 'kp-seg';
    seg.style.background = kpColor(i);
    seg.style.opacity = (kp != null && i <= Math.round(kp)) ? '1' : '0.18';
    const lab = document.createElement('span'); lab.textContent = i; seg.appendChild(lab);
    scale.appendChild(seg);
  }
}

function renderHistory(kpArr) {
  const el = document.getElementById('kp-history');
  if (!el) return;
  const last = kpArr.slice(-8); // 8 x 3h = last 24 hours
  if (!last.length) { el.innerHTML = ''; return; }
  const bars = last.map(d => {
    const k = num(d.Kp) ?? 0;
    const t = new Date(d.time_tag);
    const hh = isNaN(t) ? '' : t.toLocaleTimeString('en-AU', { hour: '2-digit', hour12: false });
    return `<div class="kh-bar" title="Kp ${k.toFixed(1)} @ ${hh}"><div class="kh-fill" style="height:${Math.max(6, (k / 9) * 100)}%;background:${kpColor(k)}"></div></div>`;
  }).join('');
  el.innerHTML = `<div class="kh-label">Last 24 hours</div><div class="kh-bars">${bars}</div>`;
}

function renderRegions(kp) {
  const el = document.getElementById('regions');
  el.innerHTML = '';
  // sort by best chance first
  const rows = REGIONS.map(r => ({ ...r, ch: chance(kp ?? 0, r.kp) }));
  const order = { likely: 0, possible: 1, slim: 2, no: 3 };
  rows.sort((a, b) => order[a.ch.t] - order[b.ch.t] || a.kp - b.kp);
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'region';
    row.innerHTML =
      `<span class="r-name">${r.name}</span>` +
      `<span class="r-need">needs Kp ${r.kp}</span>` +
      `<span class="r-chip" style="color:${r.ch.c};border-color:${r.ch.c}33;background:${r.ch.c}1a">${CHANCE_LABEL[r.ch.t]}</span>`;
    el.appendChild(row);
  }
}

function renderTiles(kp, bz, speed, density) {
  const set = (id, v, color) => { const e = document.getElementById(id); e.textContent = v; if (color) e.style.color = color; };
  set('t-kp', kp != null ? kp.toFixed(1) : '–', kpColor(kp ?? 0));
  set('t-bz', bz != null ? `${bz.toFixed(1)} nT` : '–', bz != null && bz <= -5 ? '#9be15d' : null);
  set('t-spd', speed != null ? Math.round(speed) : '–');
  set('t-den', density != null ? density.toFixed(1) : '–');
}

function renderForecast(fcArr) {
  // fcArr: [{time_tag, kp, observed: 'observed'|'predicted'}]; keep predicted, group by date, take max
  const byDay = new Map();
  for (const r of fcArr.slice(1)) {
    if (r.observed !== 'predicted') continue;
    const day = r.time_tag.slice(0, 10);
    const k = num(r.kp);
    if (k == null) continue;
    byDay.set(day, Math.max(byDay.get(day) ?? 0, k));
  }
  const days = [...byDay.entries()].slice(0, 3);
  const el = document.getElementById('forecast');
  el.innerHTML = '';
  if (!days.length) { el.innerHTML = '<div class="fc-empty">No forecast available</div>'; return; }
  for (const [day, k] of days) {
    const d = new Date(day + 'T00:00:00');
    const label = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
    const bar = document.createElement('div');
    bar.className = 'fc-day';
    bar.innerHTML =
      `<div class="fc-label">${label}</div>` +
      `<div class="fc-track"><div class="fc-fill" style="width:${(k / 9) * 100}%;background:${kpColor(k)}"></div></div>` +
      `<div class="fc-kp" style="color:${kpColor(k)}">Kp ${k.toFixed(0)}</div>`;
    el.appendChild(bar);
  }
}

load();
setInterval(load, REFRESH_MS);
