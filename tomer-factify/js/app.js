
var SLIDES = new Array(21);
function psStyle(i, p) { p = p || 0; return 'opacity: ' + (i === p ? 1 : 0) + '; transform: translateX(' + (i === p ? 0 : (i < p ? -60 : 60)) + 'px); pointer-events: ' + (i === p ? 'auto' : 'none') + '; visibility: ' + (Math.abs(i - p) <= 1 ? 'visible' : 'hidden'); }

var TX_PATH = 'M29.5078 27.8308C29.7344 27.6999 30.0177 27.8631 30.0181 28.1248L30.028 34.1068C30.0285 34.3692 29.7442 34.5333 29.5172 34.4017L24.3416 31.4021C24.1154 31.2709 24.1157 30.944 24.3421 30.8132L29.5078 27.8308ZM29.4639 1.04766C29.6905 0.916849 29.9738 1.08005 29.9742 1.34167L29.9838 7.52235C29.984 7.64392 29.9198 7.7564 29.8147 7.81732L12.9898 17.5312C12.7636 17.6621 12.7631 17.989 12.9892 18.1201L18.0836 21.0708C18.1889 21.1318 18.3191 21.1321 18.4245 21.0713L29.4866 14.6846C29.7131 14.5538 29.9964 14.717 29.9969 14.9786L30.0065 20.7668C30.0067 20.8885 29.9414 21.0006 29.8361 21.0615L18.3164 27.7123C18.2111 27.7731 18.0813 27.7735 17.9761 27.7126L1.16954 17.972C0.943191 17.8409 0.943501 17.5139 1.17007 17.3831L29.4639 1.04766Z';
var TX = { W: 119, H: 564, DX: 33.1, DY: 33.1, R: 135, SC: 0.58, path: null, ptr: { x: -9999, y: -9999, t: 0 }, cells: new WeakMap() };
function txAngDiff(a, b) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }
function txCells() {
  var out = [], row = 0;
  for (var y = 96; y < TX.H + 10; y += TX.DY, row++) {
    for (var x = 10; x < TX.W + 16; x += TX.DX) out.push({ x: x, y: y, a: 0, ox: 0, oy: 0, al: 0 });
  }
  return out;
}
function txFrame(now) {
  var t = now / 1000;
  if (!TX.path && window.Path2D) TX.path = new Path2D(TX_PATH);
  var cvs = document.querySelectorAll('canvas.tx-cv');
  for (var c = 0; c < cvs.length; c++) {
    var cv = cvs[c];
    var rect = cv.getBoundingClientRect();
    if (!rect.width || !TX.path) continue;
    var cells = TX.cells.get(cv); if (!cells) { cells = txCells(); TX.cells.set(cv, cells); }
    var k = rect.width / TX.W;
    var px = (TX.ptr.x - rect.left) / k, py = (TX.ptr.y - rect.top) / k;
    var near = px > -60 && px < TX.W + 60 && py > -60 && py < TX.H + 60;
    var gain = near ? 1.2 : 1;
    if (!near) {
      // ghost cursor: drifts slowly through the strip when the real one is away
      // loop: bottom-right -> top-left -> bottom-left -> back to bottom-right
      var P = [[TX.W - 14, TX.H - 45], [14, 140], [14, TX.H - 45]];
      var seg = 8, ph = (t % (seg * 3)) / seg, si = Math.floor(ph), u = ph - si;
      u = u * u * (3 - 2 * u);
      var A = P[si], B = P[(si + 1) % 3];
      px = A[0] + (B[0] - A[0]) * u + 6 * Math.sin(t * 0.9);
      py = A[1] + (B[1] - A[1]) * u + 5 * Math.cos(t * 0.7);
      near = true;
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, TX.W, TX.H);
    // soft light under the (real or ghost) cursor
    if (cv._lx == null) { cv._lx = px; cv._ly = py; }
    cv._lx += (px - cv._lx) * 0.08; cv._ly += (py - cv._ly) * 0.08;
    var lg = ctx.createRadialGradient(cv._lx, cv._ly, 0, cv._lx, cv._ly, 153);
    lg.addColorStop(0, 'rgba(70,120,255,0.171)'); lg.addColorStop(0.45, 'rgba(50,95,255,0.072)'); lg.addColorStop(1, 'rgba(40,80,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, TX.W, TX.H);
    ctx.lineWidth = 1 / TX.SC; ctx.lineJoin = 'round';
    for (var i = 0; i < cells.length; i++) {
      var g = cells[i];
      // calm pond swell: two slow crossing waves
      var wave = Math.PI / 4 + 0.95 * Math.sin((g.x * 0.55 + g.y * 0.85) * 0.022 - t * 0.32) + 0.22 * Math.sin(g.y * 0.011 + t * 0.17);
      var swell = Math.sin(g.y * 0.022 - t * 0.45 + g.x * 0.015);
      var tsc = 0, ta = wave, tox = 0.6 * Math.cos(t * 0.4 + g.y * 0.03), toy = 0.8 * swell, tal = 0;
      if (near) {
        var dx = px - g.x, dy = py - g.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < TX.R * gain) {
          var w = 1 - d / (TX.R * gain); w = w * w * (3 - 2 * w);
          var point = Math.atan2(dy, dx) - Math.PI;
          ta = wave + txAngDiff(wave, point) * Math.min(1, 1.17 * w);
          var push = 6.1 * gain * w / (d || 1);
          tox -= dx * push; toy -= dy * push;
          tal = 0.72 * gain * w; tsc = 0.3 * gain * w;
        }
      }
      var ease = near ? 0.06 : 0.035;
      g.a += txAngDiff(g.a, ta) * ease; g.ox += (tox - g.ox) * ease; g.oy += (toy - g.oy) * ease; g.al += (tal - g.al) * ease; g.sc = (g.sc || 0) + (tsc - (g.sc || 0)) * ease;
      var fade = Math.max(0, Math.min(1, (g.y - 80) / 240));
      var alpha = Math.min(1, (0.2 + 0.6 * fade) * (0.88 + 0.12 * swell) + g.al);
      if (alpha <= 0.01) continue;
      ctx.save();
      ctx.translate(g.x + g.ox, g.y + g.oy);
      ctx.rotate(g.a);
      ctx.scale(TX.SC * (1 + g.sc), TX.SC * (1 + g.sc));
      ctx.translate(-15.6, -17.7);
      if (!cv._txg) { cv._txg = ctx.createLinearGradient(15.5, 1, 18.2, 31); cv._txg.addColorStop(0, '#2e5dff'); cv._txg.addColorStop(1, '#00279f'); }
      ctx.strokeStyle = cv._txg; ctx.globalAlpha = Math.min(1, alpha * 1.25);
      ctx.stroke(TX.path);
      ctx.restore();
    }
  }
}
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { pres: 0, ld: 0, ol: false, olClosing: false, olFx: true, olFxOut: false, olRe: false, olPulse: false, olDone: null, logoAnim: true, drawer: false, mode: null, sumLen: 0, sumOn: false, audit: null, step: 0, r1: null, r2: null, readOpen: false, checked: { ltv: true, review: true, dscr: true }, date: 'nov' };
    this.timers = [];
    this._init = JSON.parse(JSON.stringify(this.state));
  }
  componentWillUnmount() { if (this.txRaf) cancelAnimationFrame(this.txRaf); if (this.txMove) window.removeEventListener('pointermove', this.txMove); if (this.onKey) window.removeEventListener('keydown', this.onKey); if (this.qoTimer) clearTimeout(this.qoTimer); if (this.supRaf) cancelAnimationFrame(this.supRaf); if (this.supKick) clearTimeout(this.supKick); if (this.olTimer) clearTimeout(this.olTimer); if (this.fxTimer) clearTimeout(this.fxTimer); if (this.pulseTimer) clearTimeout(this.pulseTimer); if (this.morphRaf) cancelAnimationFrame(this.morphRaf); if (this.logoTimer) clearInterval(this.logoTimer); if (this.logoKick) clearTimeout(this.logoKick); if (this.logoAgain) clearTimeout(this.logoAgain); this.clear(); if (this.sumTimer) clearInterval(this.sumTimer); if (this.modeTimer) clearTimeout(this.modeTimer); }
  clear() { this.timers.forEach(function (t) { clearTimeout(t); }); this.timers = []; }
  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); }
  componentDidMount() {
    var self = this;
    this.txMove = function (ev) { TX.ptr.x = ev.clientX; TX.ptr.y = ev.clientY; };
    window.addEventListener('pointermove', this.txMove);
    var txLoop = function (now) { txFrame(now); self.txRaf = requestAnimationFrame(txLoop); };
    this.txRaf = requestAnimationFrame(txLoop);
    this.onKey = function (ev) {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      var t = ev.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      var n = SLIDES.length, p = self.state.pres;
      if (typeof p === 'number') {
        if (ev.key === 'ArrowRight') { if (p < n - 1) self.setState({ pres: p + 1 }); }
        else if (p > 0) self.setState({ pres: p - 1 });
      } else if (ev.key === 'ArrowLeft' && !self.state.ld) self.setState({ pres: n - 1 });
    };
    window.addEventListener('keydown', this.onKey);
  }
  enterProto() {
    var self = this;
    clearTimeout(this._ldT1); clearTimeout(this._ldT2);
    this.setState({ pres: null, ld: 1 });
    this._ldT1 = setTimeout(function () {
      self.resetAll();
      self.replayLogo();
      self.animateSup(0, 0);
      self._ldT2 = setTimeout(function () { self.setState({ ld: 0 }); }, 760);
    }, 1720);
  }
  resetAll() {
    // fresh start: first screen, top collapsed island with 2 notifications
    this.clear();
    var self = this;
    ['qoTimer', 'olTimer', 'fxTimer', 'pulseTimer', 'modeTimer', 'logoKick', 'logoAgain', 'supKick'].forEach(function (k) { if (self[k]) { clearTimeout(self[k]); self[k] = null; } });
    ['sumTimer', 'logoTimer'].forEach(function (k) { if (self[k]) { clearInterval(self[k]); self[k] = null; } });
    ['morphRaf', 'supRaf'].forEach(function (k) { if (self[k]) { cancelAnimationFrame(self[k]); self[k] = null; } });
    var init = JSON.parse(JSON.stringify(this._init));
    var patch = {};
    Object.keys(this.state).forEach(function (k) { if (!(k in init)) patch[k] = undefined; });
    Object.assign(patch, init, { pres: null, ld: 2 });
    this.setState(patch);
  }
  replayLogo() {
    var self = this;
    this.setState({ logoAnim: false });
    if (this.logoKick) clearTimeout(this.logoKick);
    this.logoKick = setTimeout(function () { self.setState({ logoAnim: true }); }, 40);
  }
  animateMorph(target) {
    var self = this;
    if (this.morphRaf) cancelAnimationFrame(this.morphRaf);
    var from = (typeof this.state.morph === 'number') ? this.state.morph : (this.state.docked !== false ? 1 : 0);
    var t0 = null, dur = 850;
    var back = function (x) { var c1 = 1.70158 * 0.45, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
    var tick = function (ts) {
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      self.setState({ morph: from + (target - from) * back(k) });
      if (k < 1) self.morphRaf = requestAnimationFrame(tick); else self.morphRaf = null;
    };
    this.morphRaf = requestAnimationFrame(tick);
  }
  animateSup(target, delay) {
    var self = this;
    if (this.supRaf) cancelAnimationFrame(this.supRaf);
    if (this.supKick) clearTimeout(this.supKick);
    var run = function () {
      var from = (typeof self.state.sup === 'number') ? self.state.sup : 0;
      var t0 = null, dur = 900;
      var back = function (x) { var c1 = 1.70158 * 0.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
      var tick = function (ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur);
        self.setState({ sup: from + (target - from) * back(k) });
        if (k < 1) self.supRaf = requestAnimationFrame(tick); else self.supRaf = null;
      };
      self.supRaf = requestAnimationFrame(tick);
    };
    if (delay) this.supKick = setTimeout(run, delay); else run();
  }
  openQo() {
    if (this.qoTimer) clearTimeout(this.qoTimer);
    this.setState({ qo: true, qoOut: false, qoChat: false, qdx: 0, qdy: 0, qoDragging: false });
  }
  closeQo() {
    var self = this;
    this.setState({ qoOut: true });
    if (this.qoTimer) clearTimeout(this.qoTimer);
    this.qoTimer = setTimeout(function () { self.setState({ qo: false, qoOut: false }); }, 850);
  }
  closeDrawer() {
    var self = this;
    if (this.sumTimer) { clearInterval(this.sumTimer); this.sumTimer = null; }
    if (!this.state.drawer && !this.state.mode) return;
    this.setState({ drawer: false });
    if (this.modeTimer) clearTimeout(this.modeTimer);
    this.modeTimer = setTimeout(function () { if (!self.state.drawer) self.setState({ mode: null, sumOn: false, sumLen: 0, audit: null }); }, 450);
  }
  openDrawer(mode) {
    if (this.modeTimer) { clearTimeout(this.modeTimer); this.modeTimer = null; }
    if (mode !== 'help' && this.sumTimer) { clearInterval(this.sumTimer); this.sumTimer = null; }
    this.setState({ drawer: true, mode: mode, audit: null });
  }
  go(step) {
    this.closeDrawer();
    var closing = step === 0 || step === 3 || step === 6;
    var st = { step: step, readOpen: false, notchHover: false };
    if (step !== 4) st.slid = false;
    if (step === 6) this.animateSup(1, 2600);
    else if (this.state.step === 6 && !this.state.ol) this.animateSup(0, 0);
    if (closing) {
      st.dx = 0; st.dy = 0; st.dragging = false; st.logoAnim = false;
      var self = this;
      if (this.logoAgain) clearTimeout(this.logoAgain);
      this.logoAgain = setTimeout(function () { self.setState({ logoAnim: true }); }, 120);
    }
    this.setState(st);
  }
  finish1(r) {
    this.closeDrawer();
    var self = this;
    this.clear();
    this.setState({ step: 2, r1: r, readOpen: false });
    this.later(6000, function () { self.go(3); });
  }
  finish2(r) {
    this.closeDrawer();
    var self = this;
    this.clear();
    this.setState({ step: 5, r2: r, readOpen: false });
    this.later(6000, function () { self.go(6); });
  }
  renderVals() {
    var self = this;
    var s = this.state;
    var step = s.step;
    var open = step === 1 || step === 2 || step === 4 || step === 5;
    var collapsed = !open;
    var notify = step !== 6;

    var H = (step === 2 || step === 5) ? 277 : 250;
    var readTop = 0;
    if (step === 1) { readTop = 598; H = s.readOpen ? 704 : 653; }
    if (step === 4) { readTop = 856; H = s.readOpen ? 962 : 911; }

    var ease = 'cubic-bezier(.32,.72,0,1)';
    var gradient = 'linear-gradient(to right, #0080ff, #47c8ff)';

    var sealed = step === 6;
    var docked = s.docked !== false;
    var ix = (typeof s.ix === 'number') ? s.ix : 960;
    var fy = (typeof s.fy === 'number') ? s.fy : 0;
    var nw = sealed ? 493 : 594, off = sealed ? 18 : 0;
    var fw = sealed ? 317 : 388;
    var W = docked ? nw : fw;
    var nx = docked ? Math.round(ix - (sealed ? 255 : 297)) : Math.round(ix - fw / 2);
    var side = s.dockSide === 'bottom' ? 'bottom' : 'top';
    var ny = docked ? (side === 'bottom' ? 1028 : 0) : fy;
    var sh = docked ? 0 : (sealed ? -85 : -104);
    var dragN = !!s.notchDragging;
    var spring = 'cubic-bezier(.34,1.22,.64,1)';
    var moveT = dragN ? (docked ? 'top .5s ' + spring + ', left 0s' : 'top 0s, left 0s') : 'top .45s ' + spring + ', left .3s ' + ease;
    var mt = (typeof s.morph === 'number') ? s.morph : (docked ? 1 : 0);
    var lp = function (a, b) { return a + (b - a) * mt; };
    var su = docked ? ((typeof s.sup === 'number') ? s.sup : 0) : 0;
    var suC = Math.max(0, Math.min(1, su));
    var ls = function (a, b) { return a + (b - a) * su; };
    var lc = function (a, b) { return a + (b - a) * suC; };
    var HhD = ls(sealed ? 159.62 : 192.32, 27.32);
    var Hh = lp(sealed ? 158.5 : 194, HhD);
    var co = lp(0, ls(sealed ? -8.5 : 0, 0));
    var rt = lp(12, 21), rb = lp(12, 18), B = lp(52, 51);
    var xa = lp((sealed ? 158.5 : 194) - 12, HhD + 21);
    var k1 = lp(xa + 6.63, xa - 11.6);
    var y1 = lp(12, 21), c2y = lp(5.37, 9.4);
    var y2 = B - rb;
    var f = function (n) { return (Math.round(n * 100) / 100).toString(); };
    var P = function (x, y) { return f(x + co) + ' ' + f(y); };
    var morphPath = 'M' + P(-xa, 0) + 'L' + P(xa, 0) +
      'C' + P(k1, 0) + ' ' + P(Hh, c2y) + ' ' + P(Hh, y1) +
      'L' + P(Hh, y2) +
      'C' + P(Hh, y2 + rb * 0.552) + ' ' + P(Hh - rb * 0.448, B) + ' ' + P(Hh - rb, B) +
      'L' + P(-Hh + rb, B) +
      'C' + P(-Hh + rb * 0.448, B) + ' ' + P(-Hh, y2 + rb * 0.552) + ' ' + P(-Hh, y2) +
      'L' + P(-Hh, y1) +
      'C' + P(-Hh, c2y) + ' ' + P(-k1, 0) + ' ' + P(-xa, 0) + 'Z';
    var notchSrc = sealed ? 'assets/d5258feebe5b691bdf2a072da426bed4.svg' : 'assets/95af158ceeddf1ae375c45acab656f0e.svg';
    var notchImgStyle = 'position: absolute; left: 0; top: 0; width: ' + nw + 'px; height: 51px; display: block; transition: opacity .3s ease; opacity: ' + (docked ? 1 : 0);
    var floatBgStyle = 'position: absolute; left: 0; top: 0; width: ' + fw + 'px; height: 52px; border-radius: 12px; background: linear-gradient(100deg, #000078 0%, #000000 100%); ' +
      'box-shadow: 0 10px 30px rgba(0,0,40,0.35); transition: opacity .3s ease; opacity: ' + (docked ? 0 : 1);
    var cT = '';
    var lgDx = ls(0, 164.2 - (sealed ? 24 : 0)), lgDy = ls(0, 4.7), lgS = ls(1, 0.769);
    var notchLogoWrap = 'position: absolute; left: ' + (-off + sh) + 'px; top: 0; width: 594px; height: 51px; pointer-events: none; transform-origin: 117px 8px; transform: translate(' + lgDx.toFixed(2) + 'px,' + lgDy.toFixed(2) + 'px) scale(' + lgS.toFixed(4) + '); ' + cT;
    var notchTextStyle = 'position: absolute; left: ' + (173 - (sealed ? 17 : 0) + sh + ls(0, 40)) + 'px; top: 12px; width: 190px; height: 28px; overflow: hidden; opacity: ' + Math.max(0, 1 - suC * 2.2).toFixed(3) + '; filter: blur(' + (suC * 6).toFixed(2) + 'px); ' + cT;
    var pr = 7 + 6 * Math.max(0, Math.min(1, mt));
    var notchPillStyle = 'position: absolute; left: ' + (ls((sealed ? 313 : 369), sealed ? 269 : 311) + sh).toFixed(2) + 'px; top: ' + ls(8, 23).toFixed(2) + 'px; display: flex; padding: ' + lc(2, 0).toFixed(2) + 'px; border-radius: ' + lc(pr, 12).toFixed(2) + 'px; overflow: hidden; ' +
      (sealed ? 'opacity: ' + Math.max(0, 1 - suC * 1.8).toFixed(3) + '; transform: scale(' + (1 - 0.45 * suC).toFixed(3) + '); transform-origin: 0 50%; ' :
      'box-shadow: ' + (-4 * suC).toFixed(2) + 'px ' + (3 * suC).toFixed(2) + 'px 0 rgba(0,0,0,' + (0.25 * suC).toFixed(3) + '); ') + cT;
    var pillInnerRadius = 'border-radius: ' + lc(pr - 2, 10.3).toFixed(2) + 'px;';
    var pillInnerStyle = pillInnerRadius + ' position: relative; overflow: hidden; display: block; background: #ffffff; padding: ' + lc(9, 4.4).toFixed(2) + 'px ' + lc(15, 6.8).toFixed(2) + 'px; font-size: ' + lc(13.75, 11.45).toFixed(2) + 'px; font-weight: 600; line-height: 1; letter-spacing: ' + lc(0.275, 0).toFixed(3) + 'px; color: #1a49ea; white-space: nowrap; text-align: center; min-width: ' + lc(0, 7).toFixed(2) + 'px';
    var pillRestStyle = 'display: inline-block; white-space: pre; vertical-align: top; overflow: hidden; max-width: ' + lc(110, 0).toFixed(2) + 'px; opacity: ' + Math.max(0, 1 - suC * 2).toFixed(3);
    var pillSpinStyle = 'opacity: ' + (1 - suC).toFixed(3);
    var notchStyle = 'position: absolute; left: ' + nx + 'px; top: ' + ny + 'px; width: ' + W + 'px; height: 52px; touch-action: none; user-select: none; ' +
      'transition: ' + (collapsed ? 'opacity .3s ease .42s' : 'opacity .16s ease') + ', transform .45s ' + ease + ', ' + moveT + '; ' +
      (collapsed ? 'opacity: 1; transform: none; cursor: ' + (dragN ? 'grabbing' : (step === 6 ? 'grab' : 'pointer')) : 'opacity: 0; transform: none; pointer-events: none');
    var gW = ls(464, 227), gL = ls(ix - 232, ix - 80);
    var notchGlowStyle = 'position: absolute; left: ' + gL.toFixed(1) + 'px; top: ' + (docked ? (side === 'bottom' ? ls(983, 971) : ls(-44, -56)) : fy - 34).toFixed(1) + 'px; width: ' + gW.toFixed(1) + 'px; height: 121px; pointer-events: none; ' +
      'transform-origin: 100% 50%; transform: scaleX(0.85); transition: opacity .5s ease, transform .45s ease, ' + moveT + '; opacity: ' + (collapsed ? 1 : 0);
    var notchL = nx, notchR = nx + nw;
    var barY = side === 'bottom' ? 1073 : -46;
    var barL = 'position: absolute; left: 0; top: ' + barY + 'px; width: ' + Math.max(0, notchL + 101) + 'px; height: 77px; background: linear-gradient(to right, #0080ff, #47c8ff); filter: blur(45px); transition: width .3s ease';
    var barR = 'position: absolute; left: ' + (notchR - 101) + 'px; top: ' + barY + 'px; width: ' + Math.max(0, 1920 - notchR + 101) + 'px; height: 77px; background: linear-gradient(to right, #0080ff, #47c8ff); filter: blur(45px); transition: left .3s ease, width .3s ease';
    var maskStyle = 'position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; pointer-events: none; ' +
      'background: radial-gradient(ellipse 89% 127% at 50% 50%, rgba(0,0,0,0.48) 60%, rgba(0,0,0,0.336) 100%); ' +
      'backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); transition: opacity .55s ease; opacity: ' + (open || (s.qo && !s.qoOut) ? 1 : 0);
    if (s.qo) { notchStyle += '; opacity: 0; pointer-events: none'; notchGlowStyle += '; opacity: 0'; }
    var dOpen = !!s.drawer && (step === 1 || step === 4);
    var wideD = s.mode === 'word';
    var pLeft = dOpen ? (wideD ? 368 : 398) : 604, pWidth = dOpen ? (wideD ? 1185 : 1125) : 712;
    var drawerStyle = 'position: absolute; left: 665px; top: 0; width: ' + (wideD ? 520 : 460) + 'px; height: 100%; background: #ffffff; border-radius: 0 14px 14px 0; ' +
      'box-shadow: inset 4px 0 11px rgba(0,0,0,0.3); color: #444444; cursor: default; overflow: hidden; z-index: 6; ' +
      'transition: opacity .4s ease, transform .6s ' + ease + '; ' +
      (dOpen ? 'opacity: 1; transform: none' : 'opacity: 0; transform: translateX(80px); pointer-events: none');
    var alt = step === 4;
    var sumFull = alt
      ? 'Policy v4.3 was approved by the board on 28 Sep and would replace three facts you own. Nothing changes until you pick an effective date and the CRO signs off.'
      : 'Two sources disagree on the CRE DSCR minimum: policy v4.2 says 1.25x, while the CCO approved 1.20x by e-mail. It looks like an unratified carve-out for owner-occupied loans, and loan #4471 closes today.';
    var mail = alt
      ? { title: 'CRO e-mail:', meta: 'credit.policy@bankin.com\ncro.office@bankin.com\n28.09.2026', body: 'Hi team,\nThe board approved Credit Policy v4.3 on 28 Sep. It updates max LTV, the review threshold and the DSCR definition.\n\nRegards,\nCRO office' }
      : { title: 'CCO e-mail:', meta: 'bradford.g@bankin.com\nwilliamson.c@bankin.com\n29.12.2026', body: 'Dear Brad,\nThe DSCR in this loan can perfectly be 1.20x. I approve it, just make sure all team is aligned.\n\nBest,\nWilliamson' };
    var auditDefs = [{ id: 's', label: 'Audit Sender', done: 'Auditing sender…' }, { id: 'r', label: 'Audit recipient', done: 'Auditing recipient…' }, { id: 'b', label: 'Audit both', done: 'Auditing sender and recipient…' }];
    var xlDefs = [{ id: 'i', label: 'Show 1.20x impact', done: 'Showing the impact of 1.20x…' }, { id: 'n', label: 'Notify the author', done: 'Notifying Bradford Garlin…' }];
    var curX = null;
    var xlActs = xlDefs.map(function (a) {
      var on = s.xact === a.id; if (on) curX = a;
      return { label: a.label,
        style: 'font-family: inherit; font-size: 11.96px; font-weight: 300; line-height: 1; letter-spacing: 0.24px; color: ' + (on ? '#ffffff' : '#444444') + '; ' +
          'background: ' + (on ? '#2e5dff' : '#eaf4ff') + '; border: 0.4px solid ' + (on ? '#2e5dff' : '#cfcfcf') + '; border-radius: 36.54px; padding: 11.14px 22px; white-space: nowrap',
        pick: function () { self.setState({ xact: on ? null : a.id }); } };
    });
    var audits = auditDefs.map(function (a) {
      var on = s.audit === a.id;
      return { label: a.label,
        style: 'font-family: inherit; font-size: 11.96px; font-weight: 300; line-height: 1; letter-spacing: 0.24px; color: ' + (on ? '#ffffff' : '#444444') + '; ' +
          'background: ' + (on ? '#2e5dff' : '#eaf4ff') + '; border: 0.4px solid ' + (on ? '#2e5dff' : '#cfcfcf') + '; border-radius: 36.54px; padding: 11.14px 25.6px; white-space: nowrap',
        pick: function () { self.setState({ audit: on ? null : a.id }); } };
    });
    var curAudit = auditDefs.filter(function (a) { return a.id === s.audit; })[0];
    var helpInputStyle = 'position: absolute; left: 20px; bottom: 17px; width: 421px; height: ' + (s.sumOn ? 190 : 255) + 'px; border-radius: 15px; ' +
      'background: #ffffff; border: 0.6px solid #cfcfcf; box-shadow: 0 0 34px rgba(0,0,0,0.1); box-sizing: border-box; transition: height .45s ' + ease + '; animation-delay: .55s';
    var drag = 'translate(' + (s.dx || 0) + 'px, ' + (s.dy || 0) + 'px)';
    var cW = docked ? Math.max(40, 2 * HhD) : fw;
    var cL = docked ? ix - cW / 2 : nx;
    var cTop = docked ? (side === 'bottom' ? 1029 : 0) : fy;
    var mE = 'cubic-bezier(.65,0,.25,1)';
    var geoT = 'left .62s ' + mE + ', top .62s ' + mE + ', width .62s ' + mE + ', height .62s ' + mE + ', border-radius .62s ' + mE;
    var glowStyle = 'position: absolute; pointer-events: none; transform-origin: 50% 0; ' +
      (open
        ? 'left: ' + (pLeft - 15) + 'px; top: 89px; width: 747px; height: ' + (H + 46) + 'px; opacity: 1; transform: ' + drag + '; transition: ' + geoT + ', opacity .4s ease' + (s.dragging ? '' : ', transform .55s ' + ease) + ';'
        : 'left: ' + (cL - 15).toFixed(1) + 'px; top: ' + (cTop - 10) + 'px; width: ' + (cW + 30).toFixed(1) + 'px; height: 71px; opacity: 0; transform: none; transition: ' + geoT + ', opacity .3s ease .35s;');
    var panelStyle = 'position: absolute; overflow: hidden; background: linear-gradient(103.24deg, #000078 4.92%, #000000 75.77%); transform-origin: 50% 0; user-select: none; ' +
      (open
        ? 'left: ' + pLeft + 'px; top: 108px; width: ' + pWidth + 'px; height: ' + H + 'px; border-radius: 18px; opacity: 1; transform: ' + drag + '; cursor: ' + (s.dragging ? 'grabbing' : 'grab') + '; ' +
          'transition: ' + geoT + ', opacity .12s ease' + (s.dragging ? '' : ', transform .55s ' + ease) + ';'
        : 'left: ' + cL.toFixed(1) + 'px; top: ' + cTop + 'px; width: ' + cW.toFixed(1) + 'px; height: 51px; border-radius: ' + (side === 'bottom' && docked ? '18px 18px 0 0' : (docked ? '0 0 18px 18px' : '12px')) + '; opacity: 0; transform: none; pointer-events: none; ' +
          'transition: ' + geoT + ', opacity .22s ease .5s, transform .4s ' + ease + ';');

    var readIconStyle = 'position: absolute; left: -9.2px; top: ' + (readTop - 29.1) + 'px; width: 120.2px; height: 96.1px; display: block; pointer-events: none';
    var readChipStyle = 'position: absolute; left: 69px; top: ' + readTop + 'px; width: 122px; height: 34px; box-sizing: border-box; border: none; border-radius: 6.06px; ' +
      'background: linear-gradient(to right, rgba(255,255,255,0), rgba(255,255,255,0.11) 66.6%); padding: 0 0 0 17px; text-align: left; font-family: inherit; font-size: 12.49px; font-weight: 300; letter-spacing: 0.5px; color: #4e76ff; white-space: nowrap';
    var readBoxStyle = 'position: absolute; left: 69px; top: ' + (readTop + 3) + 'px; width: 581px; height: 72px; box-sizing: border-box; border: none; border-radius: 7.87px; ' +
      'background: rgba(255,255,255,0.11); padding: 8px 24px; text-align: left; font-family: inherit; font-size: 15.2px; font-weight: 300; line-height: 1.66; letter-spacing: 0.6px; color: #ffffff';
    var readText = step === 4
      ? "Factify's read: v4.3 is board approved, so it outranks v4.2. Three facts you own would change."
      : "Factify's read: probably not a conflict but a missing scope. The CCO's 1.20x looks like a carve-out for owner-occupied that was never ratified.";

    var factDefs = [
      { id: 'ltv', label: 'Max LTV Real Estate', from: '70%', to: '65%' },
      { id: 'review', label: 'Annual review threshold', from: '$5M', to: '$3M' },
      { id: 'dscr', label: 'DSCR definition', from: 'v4.2', to: '+ lease adj.' }
    ];
    var n = 0;
    var facts = factDefs.map(function (f, i) {
      var on = !!s.checked[f.id];
      if (on) n += 1;
      return {
        label: f.label, from: f.from, to: f.to, checked: on,
        rowStyle: 'display: flex; align-items: center; gap: 18px; height: 40px; box-sizing: border-box; padding: 0 20px; background: transparent; ' +
          (i < factDefs.length - 1 ? 'border-bottom: 0.65px solid #3653b4' : ''),
        boxStyle: 'width: 17px; height: 17px; box-sizing: border-box; border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; ' +
          (on ? 'background: transparent; border: 1.2px solid #4e76ff' : 'background: transparent; border: 0.65px solid #3653b4'),
        toggle: function () {
          var c = Object.assign({}, self.state.checked);
          c[f.id] = !c[f.id];
          self.setState({ checked: c });
        }
      };
    });
    var dateDefs = [
      { id: 'board', label: 'Board approval', text: 'from board approval' },
      { id: 'nov', label: 'Today', text: 'from today' },
      { id: 'new', label: 'New loans only', text: 'for new loans only' }
    ];
    var dates = dateDefs.map(function (d) {
      var on = s.date === d.id;
      return {
        label: d.label,
        style: 'font-family: inherit; font-size: 13px; font-weight: 300; letter-spacing: 0.3px; color: #ffffff; border-radius: 4.48px; padding: 7px 11px; white-space: nowrap; ' +
          (on ? 'background: rgba(0,0,120,0.56); border: 0.65px solid #4e76ff' : 'background: transparent; border: 0.65px solid #3653b4'),
        pick: function () { self.setState({ date: d.id }); }
      };
    });
    var dateText = (dateDefs.filter(function (d) { return d.id === s.date; })[0] || dateDefs[1]).text;

    var empty = { chip: '', title: '', line: '', dest: '' };
    var cur = step === 2 ? (s.r1 || empty) : (s.r2 || empty);
    var pills = { 0: '2 Decisions', 3: '1 Decision', 6: 'Check' };

    return {
      maskStyle: maskStyle,
      presOn: typeof s.pres === 'number',
      presLast: typeof s.pres === 'number' && s.pres === SLIDES.length - 1,
      presNum: (s.pres || 0) + 1,
      presTotal: SLIDES.length,
      ps0: psStyle(0, s.pres), ps1: psStyle(1, s.pres), ps2: psStyle(2, s.pres), ps3: psStyle(3, s.pres), ps4: psStyle(4, s.pres), ps5: psStyle(5, s.pres), ps6: psStyle(6, s.pres), ps7: psStyle(7, s.pres), ps8: psStyle(8, s.pres), ps9: psStyle(9, s.pres), ps10: psStyle(10, s.pres), ps11: psStyle(11, s.pres), ps12: psStyle(12, s.pres), ps13: psStyle(13, s.pres), ps14: psStyle(14, s.pres), ps15: psStyle(15, s.pres), ps16: psStyle(16, s.pres), ps17: psStyle(17, s.pres), ps18: psStyle(18, s.pres), ps19: psStyle(19, s.pres), ps20: psStyle(20, s.pres), presNotLast: typeof s.pres === 'number' && s.pres < SLIDES.length - 1, presFirst: s.pres === 0, qlCls: s.ol ? 'ql ql-min ql-app' : 'ql ql-min', texOff: false,
      presStart: function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.setState({ pres: 0 }); },
      presPrev: function (e) { if (e && e.stopPropagation) e.stopPropagation(); var p = self.state.pres || 0; if (p > 0) self.setState({ pres: p - 1 }); },
      presNext: function (e) { if (e && e.stopPropagation) e.stopPropagation(); var p = self.state.pres || 0; if (p < SLIDES.length - 1) self.setState({ pres: p + 1 }); else self.setState({ pres: null }); },
      presExit: function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.enterProto(); },
      ldOn: !!s.ld,
      ldStyle: 'opacity: ' + (s.ld === 2 ? 0 : 1) + '; pointer-events: ' + (s.ld === 2 ? 'none' : 'auto'),
      qoShow: !!s.qo,
      qoCls: 'qo' + (s.qoOut ? ' qo-closing' : '') + (s.qoChat && !s.qoOut ? ' qo-chat' : '') + (s.qoDragging ? ' qo-dragging' : ''),
      toggleQoChat: function (e) { if (e && e.stopPropagation) e.stopPropagation(); if (self.qoMoved) { self.qoMoved = false; return; } self.setState({ qoChat: !self.state.qoChat }); },
      qoMove: 'transform: translate(' + (s.qdx || 0) + 'px, ' + (s.qdy || 0) + 'px); transition: ' + (s.qoDragging ? 'none' : 'transform .45s cubic-bezier(.34,1.2,.64,1)'),
      qoDrag: function (e) {
        if (!e || e.button !== 0) return;
        var t = e.target;
        if (t && t.closest && t.closest('.qo-chips span, .d-send')) return;
        var root = e.currentTarget;
        var k = root && root.getBoundingClientRect ? (root.getBoundingClientRect().width / 1920) || 1 : 1;
        var sx = e.clientX, sy = e.clientY, ox = self.state.qdx || 0, oy = self.state.qdy || 0, moved = false;
        self.qoMoved = false;
        var move = function (ev) {
          var mx = ev.clientX - sx, my = ev.clientY - sy;
          if (!moved && Math.abs(mx) + Math.abs(my) < 4) return;
          if (!moved) { moved = true; self.qoMoved = true; self.setState({ qoDragging: true }); }
          self.setState({ qdx: ox + mx / k, qdy: oy + my / k });
        };
        var up = function () {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if (moved) self.setState({ qoDragging: false });
          setTimeout(function () { self.qoMoved = false; }, 0);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      },
      panelCls: open ? 'p-open' : 'p-closed',
      olShow: !!s.ol && s.app === 'outlook',
      xlShow: !!s.ol && s.app === 'excel',
      wdShow: !!s.ol && s.app === 'word',
      wd3Show: !!s.ol && s.app === 'word43',
      olWinStyle: s.olClosing ? 'animation: olOut .32s ease both' : 'animation: olWin .5s ease-in-out both',
      olFx: s.olFx !== false,
      olRemOn: s.olFx === false,
      olPulseCls: s.olPulse ? 'ol-pulse' : '',
      olFxStyle: s.olRe ? '--d: 0s' : '',
      olFxCls: s.olFxOut ? 'ol-fx ol-closing' : 'ol-fx',
      olActs: !s.olDone,
      olDoneOn: !!s.olDone,
      olDoneTitle: s.olDone ? s.olDone.title : '',
      olDoneDest: s.olDone ? s.olDone.dest : '',
      drawerStyle: drawerStyle,
      dHelp: s.mode === 'help',
      dMail: s.mode === 'mail',
      dExcel: s.mode === 'excel',
      dWord: s.mode === 'word',
      wpNum: (s.wpg || 0) + 1,
      wpStrip: 'transform: translateX(' + (-480 * (s.wpg || 0)) + 'px)',
      wpPrev: function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.setState({ wpg: Math.max(0, (self.state.wpg || 0) - 1) }); },
      wpNext: function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.setState({ wpg: Math.min(4, (self.state.wpg || 0) + 1) }); },
      xlActs: xlActs,
      xlInputText: curX ? curX.done : 'Write here...',
      sumOn: !!s.sumOn,
      sumText: sumFull.slice(0, s.sumLen || 0),
      caretStyle: 'display: inline-block; width: 7px; height: 15px; margin-left: 2px; vertical-align: -2px; background: #2e5dff; border-radius: 1px; ' + ((s.sumLen || 0) >= sumFull.length ? 'opacity: 0; animation: none' : ''),
      helpInputStyle: helpInputStyle,
      mailWho: alt ? 'cro' : 'cco',
      mail: mail,
      mailAtt: step === 4,
      audits: audits,
      mailInputText: curAudit ? curAudit.done : 'Write here...',
      toggleHelp: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (self.state.drawer && self.state.mode === 'help') self.closeDrawer(); else self.openDrawer('help');
      },
      openMail: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (self.state.drawer && self.state.mode === 'mail') self.closeDrawer(); else self.openDrawer('mail');
      },
      openWord: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (self.state.drawer && self.state.mode === 'word') self.closeDrawer(); else { self.setState({ wpg: 0 }); self.openDrawer('word'); }
      },
      openWord43: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var st = self.state.step;
        self.closeDrawer();
        if (self.olTimer) clearTimeout(self.olTimer);
        self.setState({ ol: true, app: 'word43', olClosing: false, olFx: true, olFxOut: false, olRe: false, olPulse: false, olDone: null });
        self.go(st === 4 ? 3 : (st === 1 ? 0 : st));
        self.animateSup(1, 420);
      },
      openWordApp: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var st = self.state.step;
        self.closeDrawer();
        if (self.olTimer) clearTimeout(self.olTimer);
        self.setState({ ol: true, app: 'word', olClosing: false, olFx: true, olFxOut: false, olRe: false, olPulse: false, olDone: null });
        self.go(st === 4 ? 3 : (st === 1 ? 0 : st));
        self.animateSup(1, 420);
      },
      wdSup: function () { self.setState({ olDone: { title: 'Sent to the CRO', dest: 'DET-0143 · supersedes 3 facts once signed' } }); },
      wdDel: function () { self.setState({ olDone: { title: 'Delegated to credit admin', dest: 'Credit admin queue · due Thu' } }); },
      wdNot: function () { self.setState({ olDone: { title: 'Marked as not a policy change', dest: 'Source rules · Outlook' } }); },
      openExcel: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (self.state.drawer && self.state.mode === 'excel') self.closeDrawer(); else { self.setState({ xact: null }); self.openDrawer('excel'); }
      },
      sendSuggestion: function () { self.openDrawer('mail'); },
      closeDrawerBtn: function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.closeDrawer(); },
      summarize: function () {
        if (self.sumTimer) clearInterval(self.sumTimer);
        self.setState({ sumOn: true, sumLen: 0 });
        var total = sumFull.length;
        self.sumTimer = setInterval(function () {
          var n2 = Math.min(total, (self.state.sumLen || 0) + 3);
          self.setState({ sumLen: n2 });
          if (n2 >= total) { clearInterval(self.sumTimer); self.sumTimer = null; }
        }, 22);
      },
      notchStyle: notchStyle,
      sideGlowStyle: 'position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; pointer-events: none; transition: opacity .5s ease; opacity: ' + (collapsed && docked && !s.qo ? (1 - suC).toFixed(3) : 0),
      morphFlip: side === 'bottom' ? 'matrix(1 0 0 -1 0 52)' : '',
      gx1: ls(-200, -34.5).toFixed(1), gy1: ls(0, 30).toFixed(1), gx2: ls(190, 103).toFixed(1), gy2: ls(40, 77).toFixed(1),
      gc1: 'rgb(0,0,' + Math.round(ls(120, 131)) + ')',
      pillInnerStyle: pillInnerStyle, pillRestStyle: pillRestStyle, pillSpinStyle: pillSpinStyle,
      pillNumCls: suC > 0.05 ? '' : 'pill-cycle pill-num',
      pillRestCls: suC > 0.05 ? '' : 'pill-cycle',
      barL: barL, barR: barR, floatBgStyle: floatBgStyle, morphPath: morphPath,
      morphSvgStyle: 'position: absolute; left: ' + Math.round(ix - 300 - nx) + 'px; top: 0; width: 600px; height: 60px; overflow: visible; pointer-events: none; ' +
        'filter: drop-shadow(0 10px 24px rgba(0,0,40,' + (0.35 * Math.max(0, 1 - mt)).toFixed(3) + '));', pillInnerRadius: pillInnerRadius,
      sidePeakStyle: 'position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transition: opacity .5s ease; opacity: ' + (s.notchHover && (step === 0 || step === 3) ? 1 : 0),
      glowBreathWrap: 'position: absolute; left: 0; top: 0; width: 100%; height: 100%; transition: opacity .5s ease; opacity: ' + (s.notchHover && (step === 0 || step === 3) ? 0 : 1),
      glowInnerStyle: 'width: 100%; height: 100%; background: linear-gradient(to right, #0080ff, #47c8ff); transition: filter .45s ease; filter: blur(' + (docked ? 45 : 54) + 'px)',
      glowPeakStyle: 'position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: linear-gradient(to right, #0080ff, #47c8ff); filter: blur(' + (docked ? 45 : 54) + 'px); transform: scale(1.45); transition: opacity .5s ease; opacity: ' + (s.notchHover && (step === 0 || step === 3) ? 1 : 0),
      notchDown: function (e) {
        if (!e || e.button !== 0) return;
        var st0 = self.state;
        var el = e.currentTarget;
        var Wc = el.getBoundingClientRect ? el.getBoundingClientRect().width : 0;
        var Wd = (st0.docked !== false) ? (st0.step === 6 ? 493 : 594) : (st0.step === 6 ? 317 : 388);
        var k = Wc ? (Wc / Wd) : 1;
        var sx = e.clientX, sy = e.clientY;
        var ox = (typeof st0.ix === 'number') ? st0.ix : 960;
        var oy = (st0.docked !== false) ? (st0.dockSide === 'bottom' ? 1028 : 0) : st0.fy;
        var moved = false;
        if (e.preventDefault) e.preventDefault();
        var move = function (ev) {
          var dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
          if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
          if (!moved) { moved = true; self.setState({ notchDragging: true, notchHover: false }); }
          var top = oy + dy;
          var dockSide = top < 38 ? 'top' : (top > 990 ? 'bottom' : null);
          var dock = !!dockSide;
          var half = (dock ? (self.state.step === 6 ? 247 : 297) : (self.state.step === 6 ? 159 : 194));
          var nx2 = Math.max(half, Math.min(1920 - half, ox + dx));
          var was = self.state.docked !== false;
          var upd = { ix: nx2, docked: dock, fy: Math.max(8, Math.min(1020, top)) };
          if (dockSide) upd.dockSide = dockSide;
          self.setState(upd);
          if (was !== dock) self.animateMorph(dock ? 1 : 0);
        };
        var up = function () {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          if (moved) { self.justDragged = true; self.setState({ notchDragging: false }); setTimeout(function () { self.justDragged = false; }, 50); }
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      },
      openOutlook: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var st = self.state.step;
        self.closeDrawer();
        if (self.olTimer) clearTimeout(self.olTimer);
        self.setState({ ol: true, app: 'outlook', olClosing: false, olFx: true, olFxOut: false, olRe: false, olPulse: false, olDone: null });
        self.go(st === 4 ? 3 : (st === 1 ? 0 : st));
        self.animateSup(1, 420);
      },
      openExcelApp: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        var st = self.state.step;
        self.closeDrawer();
        if (self.olTimer) clearTimeout(self.olTimer);
        self.setState({ ol: true, app: 'excel', olClosing: false, olFx: true, olFxOut: false, olRe: false, olPulse: false, olDone: null });
        self.go(st === 4 ? 3 : (st === 1 ? 0 : st));
        self.animateSup(1, 420);
      },
      closeOutlook: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        self.setState({ olClosing: true });
        self.animateSup(0, 0);
        if (self.olTimer) clearTimeout(self.olTimer);
        self.olTimer = setTimeout(function () { self.setState({ ol: false, olClosing: false }); }, 320);
      },
      closeOlFx: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        self.setState({ olFxOut: true });
        if (self.fxTimer) clearTimeout(self.fxTimer);
        self.fxTimer = setTimeout(function () { self.setState({ olFx: false, olFxOut: false }); }, 1000);
      },
      olReopen: function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.setState({ olFx: true, olRe: true, olFxOut: false }); },
      olPing: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (self.state.olFx === false) { self.setState({ olFx: true, olRe: true }); return; }
        self.setState({ olPulse: false });
        if (self.pulseTimer) clearTimeout(self.pulseTimer);
        setTimeout(function () { self.setState({ olPulse: true }); self.pulseTimer = setTimeout(function () { self.setState({ olPulse: false }); }, 450); }, 20);
      },
      olCarve: function () { self.setState({ olDone: { title: 'Carve-out draft opened', dest: 'Factify workspace · DET-0142' } }); },
      olRefer: function () { self.setState({ olDone: { title: 'Referred to credit committee', dest: 'Case CC-0318 · 7 Oct agenda' } }); },
      olUndo: function (e) { if (e && e.stopPropagation) e.stopPropagation(); self.setState({ olDone: null, olRe: true }); },
      olHold: function () { self.setState({ olDone: { title: 'Agent answers held', dest: 'Lending agent says "under review"' } }); },
      notchEnter: function () { self.setState({ notchHover: true }); },
      notchLeave: function () { self.setState({ notchHover: false }); },
      notchSrc: notchSrc, notchImgStyle: notchImgStyle, notchLogoWrap: notchLogoWrap, logoAnim: !!s.logoAnim, notchTextStyle: notchTextStyle, notchPillStyle: notchPillStyle,
      notchClass: (step === 0 || step === 3) ? 'notch can-decide' : 'notch',
      notchGlowStyle: notchGlowStyle,
      glowStyle: glowStyle,
      panelStyle: panelStyle,
      pillText: pills[step] || '',
      pillHasNum: /^\d/.test(pills[step] || ''),
      pillNum: ((pills[step] || '').match(/^\d+/) || [''])[0],
      pillRest: (pills[step] || '').replace(/^\d+/, ''),
      notchText: step === 6 ? 'Truth is sealed :-)' : 'Commercial Lending...',
      s1: step === 1,
      s4: step === 4,
      sConfirm: step === 2 || step === 5,
      hasNext: step === 2,
      s4Cls: s.slid ? 'slide-next' : 'fade isl-in',
      cur: cur,
      showRead: step === 1 || step === 4,
      readOpen: !!s.readOpen,
      readClosed: !s.readOpen,
      readIconStyle: readIconStyle,
      readChipStyle: readChipStyle,
      readBoxStyle: readBoxStyle,
      readText: readText,
      facts: facts,
      dates: dates,
      supLabel: 'Supersede ' + n + (n === 1 ? ' fact' : ' facts'),
      stop: function (e) { if (e && e.stopPropagation) e.stopPropagation(); },
      startDrag: function (e) {
        if (!e || e.button !== 0) return;
        var t = e.target;
        if (t && t.closest && t.closest('button, .info, .row, .chip, .src-card')) return;
        var el = e.currentTarget;
        var k = el && el.getBoundingClientRect ? (el.getBoundingClientRect().width / 712) || 1 : 1;
        var sx = e.clientX, sy = e.clientY, ox = self.state.dx || 0, oy = self.state.dy || 0;
        if (e.preventDefault) e.preventDefault();
        self.setState({ dragging: true });
        var move = function (ev) { self.setState({ dx: ox + (ev.clientX - sx) / k, dy: oy + (ev.clientY - sy) / k }); };
        var up = function () {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          self.setState({ dragging: false });
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      },
      islandClick: function (e) {
        if (self.justDragged) { self.justDragged = false; if (e && e.stopPropagation) e.stopPropagation(); return; }
        if (e && e.stopPropagation) e.stopPropagation();
        var st = self.state.step;
        if (st === 0) self.go(1);
        else if (st === 3) self.go(4);
        else if (st === 6) self.openQo();
      },
      outsideClick: function () {
        if (self.state.qo) { self.closeQo(); return; }
        var st = self.state.step;
        if (st === 1) self.go(0);
        else if (st === 2) { self.clear(); self.go(3); }
        else if (st === 4) self.go(3);
        else if (st === 5) { self.clear(); self.go(6); }
      },
      toggleRead: function () { self.setState({ readOpen: !self.state.readOpen }); },
      doHold: function () {
        self.finish1({ chip: 'Held', title: 'Agent answers held', line: 'The lending agent now replies "under review" on DSCR for CRE. The RM on Loan #4471 is told in Teams.', dest: 'Factify · held facts · until you decide' });
      },
      doRefer: function () {
        self.finish1({ chip: 'Referred', title: 'Credit committee', line: 'Case CC-0318 is on the 7 Oct agenda with both sources attached. Loan #4471 is flagged to its RM.', dest: 'Credit committee portal · CC-0318' });
      },
      doCarve: function () {
        self.finish1({ chip: 'Draft', title: 'Carve-out opened', line: 'DET-0142 is open in your workspace with the impact preview. Nothing changes until you commit.', dest: 'Factify workspace · DET-0142' });
      },
      doSupersede: function () {
        var k = n;
        self.finish2({ chip: 'Sign-off', title: 'Sent to the CRO', line: 'DET-0143 supersedes ' + k + (k === 1 ? ' fact ' : ' facts ') + dateText + ' once the CRO signs. Policy v4.2 stays in force until then.', dest: 'CRO approval queue · maker-checker' });
      },
      doDelegate: function () {
        self.finish2({ chip: 'Delegated', title: 'Credit admin', line: 'Credit admin maps v4.3 to the canonical facts by Thursday. Only the conflicts come back to you.', dest: 'Credit admin queue · due Thu' });
      },
      doNotPolicy: function () {
        self.finish2({ chip: 'Dismissed', title: 'Not a policy change', line: 'Factify will not treat this e-mail as a source, and learns from your choice.', dest: 'Source rules · Outlook' });
      },
      undo: function () {
        self.clear();
        var st = self.state.step;
        if (st === 2) self.setState({ step: 1, r1: null, readOpen: false });
        else if (st === 5) self.setState({ step: 4, r2: null, readOpen: false });
      },
      nextAlert: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        self.clear();
        self.setState({ slid: true });
        self.go(4);
      },
      replay: function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        self.clear();
        self.replayLogo();
        if (!self.state.ol) self.animateSup(0, 0);
        self.setState({ step: 0, dx: 0, dy: 0, dragging: false, r1: null, r2: null, readOpen: false, checked: { ltv: true, review: true, dscr: true }, date: 'nov' });
      }
    };
  }
}

window.Component = Component;
