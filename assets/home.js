// Spikewatch home v4: the night shift. One WebGL scene (hero), everything else is DOM/SVG.
const $ = id => document.getElementById(id);
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOBILE = matchMedia("(max-width: 760px)").matches;
const ev = n => { try { window.clarity && clarity("event", n) } catch (e) {} };
const fmt = v => "$" + (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v >= 100 ? v.toFixed(0) : v.toFixed(2));
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => 1 - Math.pow(1 - t, 3);

/* ---------- spend model shared by the hero ---------- */
const noise = (d, h) => (((d * 131 + h * 37) % 23) / 23) * 0.7;
const usual = (d, h) => { const hh = ((h % 24) + 24) % 24; return 4 + (hh >= 8 && hh <= 19 ? 3.2 + Math.sin((hh - 8) / 11 * Math.PI) * 1.6 : 0) + noise(d, Math.floor(hh)); };
const BASE = 4.98, PEAK = 26.4;
// tonight's loop: ramps in during 02:00-02:40, then holds
const loopMult = (h, start) => h < start ? 1 : lerp(1, PEAK / BASE, ease(clamp((h - start) / 0.66)));

/* ---------- hero state machine ---------- */
const hero = $("hero"), btn = $("breakBtn"), log = $("hudLog"), rate = $("hudRate"), clock = $("hudClock"), stateEl = $("hudState"), toast = $("toast");
const sim = { t: 2.0, loop: false, start: 99, caught: false, flash: 0, running: false };
const TITLE = document.title;
const hhmm = h => { const m = Math.round(h * 60); return String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); };
const STEPS = [
  { at: 2.00, cls: "e", txt: "02:00 retry loop started: job summarize-batch" },
  { at: 2.33, cls: "w", txt: "02:20 spend rate $18.90/h and rising" },
  { at: 2.75, cls: "w", txt: "02:45 spend rate $26.10/h" },
  { at: 3.00, cls: "", txt: "03:00 hour closed: $26.40" },
  { at: 3.10, cls: "e", txt: "03:07 check: $26.40 vs usual $4.98, 5.3x (line is 3x)" },
  { at: 3.117, cls: "s", txt: "03:07 alert sent to #ai-spend, next check 04:07" }
];
let stepI = 0;
function addLog(s) { const li = document.createElement("li"); if (s.cls) li.className = s.cls; li.textContent = s.txt; log.appendChild(li); while (log.children.length > 7) log.firstElementChild.remove(); }
function curRate() { return BASE * (sim.loop ? loopMult(sim.t, sim.start) : 1); }
function paintHud() {
  const r = curRate(), ratio = r / BASE;
  clock.textContent = "Sat " + hhmm(sim.t) + " UTC";
  rate.firstChild.nodeValue = fmt(r);
  rate.style.fontStretch = Math.round(clamp(100 + (ratio - 1) * 6.5, 100, 125)) + "%";
  hero.classList.toggle("spiked", ratio >= 3 && !sim.caught);
  document.body.classList.toggle("spiked", sim.loop && !sim.caught);
}
function catchIt() {
  sim.caught = true; sim.flash = 1;
  hero.classList.add("caught"); hero.classList.remove("spiked");
  document.body.classList.remove("spiked"); document.body.classList.add("caught");
  stateEl.textContent = "1 alert sent";
  document.title = "(1) Spike caught - Spikewatch";
  toast.hidden = false; requestAnimationFrame(() => toast.classList.add("show"));
  btn.querySelector("span").textContent = "Reset the night";
  btn.disabled = false; sim.running = false;
  ev("hero_caught");
}
function resetNight() {
  Object.assign(sim, { t: 2.0, loop: false, start: 99, caught: false, flash: 0, running: false });
  stepI = 0; hero.classList.remove("caught", "spiked"); document.body.classList.remove("caught", "spiked");
  stateEl.textContent = "watching"; document.title = TITLE;
  toast.classList.remove("show"); setTimeout(() => { if (!toast.classList.contains("show")) toast.hidden = true; }, 500);
  log.innerHTML = ["23:00 check: $5.12 this hour, usual $5.04, 1.0x", "00:00 check: $4.71 this hour, usual $4.88, 1.0x", "01:00 check: $4.95 this hour, usual $4.97, 1.0x"].map(t => `<li>${t}</li>`).join("") + '<li class="ok">02:00 all quiet</li>';
  btn.querySelector("span").textContent = "Start a retry loop";
  paintHud();
}
let last = 0;
function runLoop(now) {
  if (!sim.running) return;
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  sim.t = Math.min(3.117, sim.t + dt * (1.117 / 6.5)); // 67 sim minutes in 6.5 s
  while (stepI < STEPS.length && sim.t >= STEPS[stepI].at) addLog(STEPS[stepI++]);
  paintHud();
  if (sim.t >= 3.117) { catchIt(); return; }
  requestAnimationFrame(runLoop);
}
btn.addEventListener("click", () => {
  if (sim.caught) { resetNight(); return; }
  if (sim.running) return;
  ev("hero_break");
  Object.assign(sim, { loop: true, start: 2.0, running: true });
  stateEl.textContent = "spend rising"; btn.disabled = true;
  if (innerWidth <= 900) { const r = $("hud").getBoundingClientRect(); if (r.bottom > innerHeight - 24) scrollBy({ top: r.bottom - innerHeight + 40, behavior: RM ? "auto" : "smooth" }); }
  if (RM) { sim.t = 3.117; while (stepI < STEPS.length) addLog(STEPS[stepI++]); paintHud(); catchIt(); return; }
  last = 0; requestAnimationFrame(runLoop);
});
$("toastX").addEventListener("click", () => { toast.classList.remove("show"); setTimeout(() => toast.hidden = true, 400); btn.focus(); });
paintHud();
// the toast belongs to the hero moment: tuck it away once the hero scrolls off
new IntersectionObserver(e => { if (!e[0].isIntersecting && toast.classList.contains("show")) { toast.classList.remove("show"); setTimeout(() => toast.hidden = true, 400); } }, { threshold: 0.15 }).observe(hero);

/* ---------- WebGL spend terrain ---------- */
(async () => {
  let THREE;
  try { THREE = await import("three"); } catch (e) { hero.classList.add("nogl"); return; }
  const canvas = $("terrain");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "low-power" }); } catch (e) { hero.classList.add("nogl"); return; }
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
  renderer.setClearColor(0x1f1f1f, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1f1f1f, 14, 34);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  const DAYS = 14, PER = MOBILE ? 3 : 6, COLS = 24 * PER + 1, W = 24, YS = 0.26, OFF = 10; // rows run 14:00 -> 14:00, so 02:00 sits mid-row
  const xOf = c => -W / 2 + c / (COLS - 1) * W;
  const teal = new THREE.Color(0x4ec9b0), red = new THREE.Color(0xf14c4c), warn = new THREE.Color(0xcca700), dim = new THREE.Color(0x3f9e8c), FZ = 2.2;
  const rows = [];
  for (let d = 0; d < DAYS; d++) {
    const z = -(DAYS - 1 - d) * 1.3 + FZ;
    const pos = new Float32Array(COLS * 3), col = new Float32Array(COLS * 3);
    for (let c = 0; c < COLS; c++) { pos[c * 3] = xOf(c); pos[c * 3 + 2] = z; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const front = d === DAYS - 1;
    scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: front ? 1 : 0.22 + d / DAYS * 0.55 })));
    if (front) { const l2 = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true })); l2.position.y = 0.025; scene.add(l2); }
    rows.push({ g, pos, col, d, front });
  }
  // a translucent curtain under tonight's line gives the spend some mass
  const cPos = new Float32Array(COLS * 6), cCol = new Float32Array(COLS * 6), idx = [];
  for (let c = 0; c < COLS; c++) { cPos[c * 6] = cPos[c * 6 + 3] = xOf(c); cPos[c * 6 + 2] = cPos[c * 6 + 5] = FZ; if (c < COLS - 1) { const i = c * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); } }
  const cGeo = new THREE.BufferGeometry();
  cGeo.setAttribute("position", new THREE.BufferAttribute(cPos, 3)); cGeo.setAttribute("color", new THREE.BufferAttribute(cCol, 3)); cGeo.setIndex(idx);
  scene.add(new THREE.Mesh(cGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })));
  // threshold: 3x usual night spend, drawn as a blue plane + dashed edge
  const thrY = 3 * BASE * YS;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W / 2 + 3, 3), new THREE.MeshBasicMaterial({ color: 0x0078d4, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  plane.rotation.x = -Math.PI / 2; plane.position.set((W / 2 - 3) / 2, thrY, FZ - 1.5); scene.add(plane);
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3, thrY, FZ), new THREE.Vector3(W / 2, thrY, FZ)]), new THREE.LineDashedMaterial({ color: 0x1c8ae0, dashSize: 0.22, gapSize: 0.16, transparent: true, opacity: 0.75 }));
  edge.computeLineDistances(); scene.add(edge);
  // "now" marker on tonight's row
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  scene.add(dot);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.33, 40), new THREE.MeshBasicMaterial({ color: 0xcca700, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  scene.add(ring);

  function fill(rise) {
    for (const r of rows) {
      for (let c = 0; c < COLS; c++) {
        const h = c / PER - OFF; let v = usual(r.d, h), color = r.front ? teal : dim;
        if (r.front && h <= sim.t && sim.loop) { const m = loopMult(h, sim.start); v *= m; if (m > 1.6) color = sim.caught && h > 3.1 ? warn : red; }
        const y = v * YS * rise;
        r.pos[c * 3 + 1] = y; r.col[c * 3] = color.r; r.col[c * 3 + 1] = color.g; r.col[c * 3 + 2] = color.b;
        if (r.front) { cPos[c * 6 + 1] = y; cCol[c * 6] = color.r; cCol[c * 6 + 1] = color.g; cCol[c * 6 + 2] = color.b; cCol[c * 6 + 3] = color.r * .15; cCol[c * 6 + 4] = color.g * .15; cCol[c * 6 + 5] = color.b * .15; }
      }
      if (r.front) { const n = Math.max(2, Math.floor((sim.t + OFF) * PER) + 1); r.g.setDrawRange(0, n); cGeo.setDrawRange(0, (n - 1) * 6); }
      r.g.attributes.position.needsUpdate = true; r.g.attributes.color.needsUpdate = true;
    }
    cGeo.attributes.position.needsUpdate = true; cGeo.attributes.color.needsUpdate = true;
    dot.position.set(xOf((sim.t + OFF) * PER), curRate() * YS * rise, FZ);
    ring.position.copy(dot.position); ring.lookAt(cam.position);
  }

  let px = 0, py = 0, tx = 0, ty = 0, pending = false;
  if (matchMedia("(hover: hover)").matches && !RM) {
    addEventListener("pointermove", e => { if (pending) return; pending = true; requestAnimationFrame(() => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; pending = false; }); }, { passive: true });
  }
  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h;
    // keep the ridge in the right half on desktop, centred on mobile
    cam.setViewOffset(w, h, w > 900 ? -w * 0.04 : 0, w > 900 ? -h * 0.02 : h * 0.2, w, h);
    cam.updateProjectionMatrix();
  }
  new ResizeObserver(() => { size(); kick(); }).observe(canvas); size();

  let visible = true, t0 = performance.now(), raf = 0;
  function frame(now) {
    raf = 0;
    const rise = RM ? 1 : ease(clamp((now - t0) / 1200));
    px += (tx - px) * 0.06; py += (ty - py) * 0.06;
    cam.position.set(px * 1.6, 9.5 - py * 1.0, 15);
    cam.lookAt(0, 0.6, -4);
    fill(rise);
    if (sim.flash > 0) sim.flash = Math.max(0, sim.flash - 0.012);
    plane.material.opacity = 0.06 + sim.flash * 0.32;
    edge.material.opacity = 0.7 + sim.flash * 0.3;
    ring.material.opacity = sim.caught ? 0.5 + 0.5 * Math.sin(now / 260) * (RM ? 0 : 1) : 0;
    dot.material.color.set(sim.caught ? 0xcca700 : (sim.loop ? 0xf14c4c : 0xffffff));
    renderer.render(scene, cam);
    const active = !RM && (rise < 1 || sim.running || sim.flash > 0 || sim.caught || Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001);
    if (visible && !document.hidden && active) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(e => { visible = e[0].isIntersecting; kick(); }).observe(hero);
  document.addEventListener("visibilitychange", kick);
  addEventListener("pointermove", kick, { passive: true });
  btn.addEventListener("click", () => setTimeout(kick, 0));
  addEventListener("resize", kick);
  kick();
})();

/* ---------- story: one loop, two weekends (scroll-scrubbed) ---------- */
(() => {
  const story = $("story"), beats = [...$("beats").children];
  const PER_H = 21.4, FIX = 6.17, ALERT = 1.12, END = 55;
  const hOf = p => p < 0.55 ? p / 0.55 * 8.5 : 8.5 + (p - 0.55) / 0.45 * (END - 8.5);
  const pOf = h => h <= 8.5 ? h / 8.5 * 0.55 : 0.55 + (h - 8.5) / (END - 8.5) * 0.45;
  const DAYN = ["Sat", "Sun", "Mon"];
  const when = h => { const t = 2 + h; return DAYN[Math.floor(t / 24)] + " " + hhmm(t % 24); };
  const yR = r => 135 - (r - 5) / 21.4 * 100;
  function lane(svg, hNow, fixed) {
    const N = 120, pts = [];
    for (let i = 0; i <= N; i++) { const p = i / N, h = hOf(p); if (h > hNow) break; const on = fixed ? h < FIX : true; pts.push([p * 300, yR(on ? 26.4 : 5)]); }
    if (pts.length < 2) pts.push([pOf(hNow) * 300, yR(26.4)]);
    const line = pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join(" ");
    const lastX = pts[pts.length - 1][0];
    const c = fixed ? "var(--safe)" : "var(--spike)";
    let s = `<line x1="0" x2="300" y1="${yR(5)}" y2="${yR(5)}" stroke="var(--rule2)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>`;
    s += `<path d="${line} L${lastX} 150 L0 150Z" fill="${c}" opacity=".12"/>`;
    s += `<path d="${line}" fill="none" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
    if (fixed && hNow >= ALERT) s += `<line x1="${pOf(ALERT) * 300}" x2="${pOf(ALERT) * 300}" y1="0" y2="150" stroke="var(--warn)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
    svg.innerHTML = s;
  }
  let lastP = -1;
  function paint(p) {
    if (Math.abs(p - lastP) < 0.002) return; lastP = p;
    const h = hOf(p);
    $("storyClock").textContent = when(h) + " UTC";
    $("billA").textContent = fmt(PER_H * h);
    $("billB").textContent = fmt(PER_H * Math.min(h, FIX));
    $("noteA").textContent = h >= END - 0.01 ? "Found at Monday standup, after 55 hours." : "Extra spend so far. Nobody is looking.";
    $("noteB").innerHTML = h < ALERT ? "Extra spend so far." : h < FIX ? "<b>Alert sent at 03:07.</b> Waiting on your phone." : "<b>Job stopped at 08:10,</b> even after sleeping through the alert.";
    beats.forEach(b => b.classList.toggle("on", h >= +b.dataset.at));
    lane($("laneA"), h, false); lane($("laneB"), h, true);
  }
  const stage = story.querySelector(".stage"), pinned = () => getComputedStyle(stage).position === "sticky";
  if (RM || !pinned()) { paint(1); }
  let tick = false;
  function onScroll() {
    if (tick) return; tick = true;
    requestAnimationFrame(() => {
      tick = false;
      if (RM || !pinned()) { paint(1); return; }
      const r = story.getBoundingClientRect(), span = r.height - innerHeight;
      paint(clamp(-r.top / span));
    });
  }
  addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll); onScroll();
})();

/* ---------- calculator ---------- */
(() => {
  let hours = 72; const WHEN = { 12: "next morning", 72: "after a weekend", 360: "on the invoice" };
  const segs = document.querySelectorAll(".seg4 button");
  function calc() {
    const bill = Math.max(0, +$("cbill").value || 0), mult = +$("cmult").value; $("cmultv").textContent = mult + "x";
    const perHour = bill / 730, bad = perHour * (mult - 1) * hours, good = perHour * (mult - 1) * 1, saved = bad - good;
    $("cbad").textContent = fmt(bad); $("cgood").textContent = fmt(good); $("cwhenTxt").textContent = WHEN[hours];
    $("csaved").textContent = fmt(saved);
    const months = Math.floor(saved / 15);
    $("csavedTxt").textContent = "saved on a single incident. " + (months >= 1 ? `That pays for ${months >= 24 ? Math.floor(months / 12) + " years" : months + " month" + (months > 1 ? "s" : "")} of Spikewatch.` : "Bigger bills or longer spikes make the gap wider.");
  }
  ["cbill", "cmult"].forEach(id => $(id).addEventListener("input", calc));
  segs.forEach(b => b.addEventListener("click", () => { hours = +b.dataset.h; segs.forEach(c => c.setAttribute("aria-pressed", c === b)); calc(); }));
  calc();
})();

/* ---------- heartbeat EKG draws once ---------- */
new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { $("beat4").classList.add("in"); o.disconnect(); } }, { threshold: 0.4 }).observe($("beat4"));

/* ---------- sticky mobile CTA + CTA tracking ---------- */
(() => {
  const st = $("sticky"); let heroOut = false, finalIn = false;
  const upd = () => { const on = heroOut && !finalIn; st.classList.toggle("show", on); st.setAttribute("aria-hidden", !on); st.querySelector("a").tabIndex = on ? 0 : -1; };
  new IntersectionObserver(e => { heroOut = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; upd(); }).observe($("heroCta"));
  new IntersectionObserver(e => { finalIn = e[0].isIntersecting; upd(); }).observe($("finalCta"));
  document.querySelectorAll("[data-cta]").forEach(a => a.addEventListener("click", () => ev("cta_" + a.dataset.cta)));
})();
