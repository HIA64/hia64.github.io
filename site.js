// Shared effects: glass highlight, compact nav, scroll reveal, counters.
(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /*glass: specular highlight follows the mouse (throttled, skipped on touch)*/
  let raf = 0, target = null, px = 0, py = 0;
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest && e.target.closest('.glass, .lite');
    if (!el) return;
    target = el; px = e.clientX; py = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const r = target.getBoundingClientRect();
      target.style.setProperty('--mx', (px - r.left) + 'px');
      target.style.setProperty('--my', (py - r.top) + 'px');
    });
  }, { passive: true });

  /*touch: the specular highlight jumps to the finger on tap (one element, cheap)*/
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    const el = e.target.closest && e.target.closest('.glass, .lite');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /*tab puck: liquid stretch while it slides*/
  const lens = document.getElementById('lens');
  if (lens && !reduce) {
    document.addEventListener('click', e => {
      if (!e.target.closest || !e.target.closest('.tab')) return;
      lens.animate(
        [{ scale: '1 1' }, { scale: '1.14 .86', offset: .35 }, { scale: '.97 1.04', offset: .7 }, { scale: '1 1' }],
        { duration: 620, easing: 'ease-out' }
      );
    });
  }

  /*nav: folds to logo + name while you scroll down, opens again on scroll up or a tap on it*/
  const nav = document.querySelector('.topnav');
  if (nav) {
    const rest = nav.querySelector('.nav-rest');
    const measure = () => { if (rest) rest.style.setProperty('--rest-w', (rest.scrollWidth + 8) + 'px'); };
    let compact = false, dir = 0, lastY = window.scrollY, anchor = lastY;
    const set = v => { if (v !== compact) { compact = v; nav.classList.toggle('compact', v); } };
    const onScroll = () => {
      const y = Math.max(0, window.scrollY), d = y > lastY ? 1 : y < lastY ? -1 : 0;
      if (d && d !== dir) { dir = d; anchor = lastY; }       /* anchor = where the direction last changed */
      lastY = y;
      if (y <= 30) { set(false); return; }
      if (dir > 0 && y - anchor > 40) set(true);
      else if (dir < 0 && anchor - y > 24) set(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    nav.addEventListener('click', e => {
      if (compact && e.target.closest('.nav-pill')) { set(false); dir = 0; anchor = lastY; }
    });
    measure();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    let navW = innerWidth;
    window.addEventListener('resize', () => { if (innerWidth !== navW) { navW = innerWidth; measure(); } });
    onScroll();
  }

  /*footer note: cycles every 5s, the glass resizes to fit*/
  const note = document.getElementById('note');
  if (note) {
    const clip = note.querySelector('.note-clip');
    const text = note.querySelector('.note-text');
    const phrases = [
      'Not affiliated with Re-Logic.',
      'Terraria is a registered trademark of Re-Logic.',
      'Trademarks are the property of their respective owners.',
      'Game materials copyright Re-Logic.'
    ];
    let idx = 0;

    // One line always: the clip box changes only in width. If a phrase is wider than the
    // available space (very narrow phones), its font shrinks slightly instead of wrapping.
    function fit() {
      const cs = getComputedStyle(note);
      const avail = note.parentElement.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      text.style.fontSize = '';
      let w = Math.ceil(text.getBoundingClientRect().width);
      if (w > avail) {
        const base = parseFloat(getComputedStyle(text).fontSize);
        text.style.fontSize = Math.max(10.5, base * avail / w) + 'px';
        w = Math.min(Math.ceil(text.getBoundingClientRect().width), Math.floor(avail));
      }
      clip.style.width = w + 'px';
    }

    function swap() {
      idx = (idx + 1) % phrases.length;
      if (reduce) { text.textContent = phrases[idx]; fit(); return; }
      const out = text.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }],
        { duration: 280, easing: 'ease-in', fill: 'forwards' }
      );
      out.onfinish = () => {
        text.textContent = phrases[idx];
        fit();                      
        out.cancel();
        text.animate(
          [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
          { duration: 500, delay: 180, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }
        );
      };
    }

    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    let lastW = innerWidth;
    window.addEventListener('resize', () => { if (innerWidth !== lastW) { lastW = innerWidth; fit(); } });
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', fit);
    setInterval(() => { if (!document.hidden) swap(); }, 5000);
  }

  /*reveal + counters*/
  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    if (reduce) { el.textContent = prefix + target + suffix; return; }
    const dur = 1200, t0 = performance.now();
    let shown = -1;
    (function tick(now) {
      const k = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(target * eased);
      if (v !== shown) { shown = v; el.textContent = prefix + v + suffix; }
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      e.target.querySelectorAll('[data-count]').forEach(animateCount);
      io.unobserve(e.target);
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

/*Lite-mode lever (potato) in the nav. The class `potato` is set early by the inline script in <head>
  (?fx=low or the saved choice), so the page never flashes the wrong style.*/
(function () {
  const root = document.documentElement, KEY = 'tia-lite';
  const sw = document.querySelector('.lite-toggle');
  if (!sw) return;
  const show = () => sw.setAttribute('aria-checked', root.classList.contains('potato') ? 'true' : 'false');
  show();
  sw.addEventListener('click', () => {
    const on = !root.classList.contains('potato');
    root.classList.toggle('potato', on);
    try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) {}
    if (!on && /[?&]fx=low/.test(location.search)) {
      try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}
    }
    show();
    document.dispatchEvent(new Event('tia-mode'));
  });
})();

/*Glass rendering: the WebGL lens by default (desktop and phones), or lite CSS blur in potato mode.*/
(function () {
  const root = document.documentElement;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const docMode = coarse;                 /* touch: the canvas lives IN the page and scrolls with it (no trailing) */
  const lite = () => root.classList.contains('potato');

  /*A. light direction for the CSS rim*/
  const LX = .16, LY = -.30, lastA = new WeakMap();
  function light() {
    const W = innerWidth, H = innerHeight;
    const els = Array.from(document.querySelectorAll('.glass, .lite'));
    const rects = els.map(el => el.getBoundingClientRect());
    els.forEach((el, i) => {
      const r = rects[i];
      if (r.bottom < -60 || r.top > H + 60) return;
      let a = Math.atan2(LX * W - (r.left + r.width / 2), -(LY * H - (r.top + r.height / 2))) * 180 / Math.PI;
      if (a < 0) a += 360;
      const p = lastA.get(el);
      if (p !== undefined && Math.abs(p - a) < 2) return;
      lastA.set(el, a);
      const rad = a * Math.PI / 180;
      el.style.setProperty('--la', a.toFixed(0) + 'deg');
      el.style.setProperty('--sx', (50 + Math.sin(rad) * 36).toFixed(0) + '%');
      el.style.setProperty('--sy', (50 - Math.cos(rad) * 36).toFixed(0) + '%');
    });
  }
  let q = 0, t = 0;
  function schedule() {
    if (lite()) return;
    if (coarse) { clearTimeout(t); t = setTimeout(light, 120); return; }
    if (q) return;
    q = requestAnimationFrame(() => { q = 0; light(); });
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();

  /*B. WebGL lens*/
  const noGL = matchMedia('(prefers-reduced-transparency: reduce)').matches;

  const MAT = [
    ['.nav-pill',    { bezel: 12, str: 9,  curve: 1.7, disp: .05, tint: .16, spec: 1.00, tilt: 1.0, sat: 1.35 }],
    ['.btn',         { bezel: 16, str: 14, curve: 2.0, disp: .06, tint: .16, spec: 1.10, tilt: .8,  sat: 1.40 }],
    ['.widget',      { bezel: 30, str: 24, curve: 2.6, disp: .05, tint: .20, spec: .85,  tilt: .6,  sat: 1.45 }],
    ['.card',        { bezel: 28, str: 22, curve: 2.6, disp: .05, tint: .20, spec: .80,  tilt: .6,  sat: 1.45 }],
    ['.panel',       { bezel: 34, str: 16, curve: 3.0, disp: .04, tint: .20, spec: .50,  tilt: .3,  sat: 1.40 }],
    ['.creator',     { bezel: 24, str: 14, curve: 2.6, disp: .04, tint: .20, spec: .55,  tilt: .3,  sat: 1.40 }],
    ['.search-wrap', { bezel: 12, str: 8,  curve: 1.8, disp: .05, tint: .18, spec: .90,  tilt: .9,  sat: 1.35 }],
    ['.segmented',   { bezel: 12, str: 8,  curve: 1.8, disp: .05, tint: .18, spec: .90,  tilt: .9,  sat: 1.35 }],
    ['.dock',        { bezel: 14, str: 10, curve: 2.0, disp: .05, tint: .18, spec: .90,  tilt: .8,  sat: 1.35 }],
    ['.note',        { bezel: 12, str: 8,  curve: 1.8, disp: .04, tint: .18, spec: .80,  tilt: .6,  sat: 1.35 }]
  ];
  const DEF = { bezel: 20, str: 14, curve: 2.2, disp: .05, tint: .18, spec: .8, tilt: .6, sat: 1.40 };

  /* wallpaper blobs, keep in sync with .b1-.b4 in style.css (position/size come from the DOM)*/
  const BLOBS = [
    ['b3', .62, .62, [[0, '#e2f1f5'], [.55, '#a9d0dc'], [1, '#7fb4c6']]],
    ['b2', .76, .16, [[0, '#c9f8ea'], [.32, '#72ddc5'], [.68, '#31b3a4'], [1, '#1b8892']]],
    ['b1', .26, .80, [[0, '#8fa9f6'], [.36, '#4263e2'], [.70, '#1f33aa'], [1, '#0d1b6c']]],
    ['b4', .30, .28, [[0, '#86d6ff'], [.52, '#3590f6'], [1, '#1747c9']]]
  ];

  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uWall; uniform vec2 uRes, uView, uPtr, uLight, uTilt; uniform float uDpr, uRadius, uScroll;
uniform vec4 uRect, uM1, uM2; uniform vec3 uTint;
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
vec3 wall(vec2 p){ return texture2D(uWall, clamp((p - vec2(0., uScroll)) / uView, 0., 1.)).rgb; }
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 hb = uRect.zw * .5, c = uRect.xy + hb, q = p - c;
  float r = min(uRadius, min(hb.x, hb.y));
  float d = sdBox(q, hb, r);
  float a = 1. - smoothstep(-.7, .5, d);
  if (a <= 0.) discard;
  float depth = max(-d, 0.);
  float bezel = min(uM1.x, min(hb.x, hb.y));
  float t = clamp(1. - depth / bezel, 0., 1.);
  vec2 e = abs(q) - hb + r, s = vec2(q.x < 0. ? -1. : 1., q.y < 0. ? -1. : 1.);
  vec2 n = (e.x > 0. && e.y > 0.) ? normalize(e) * s : (e.x > e.y ? vec2(s.x, 0.) : vec2(0., s.y));

  /* refraction: the lens bends the wallpaper along the edge normal, dispersion splits R/G/B */
  float sh = uM1.y * pow(t, uM1.z);
  vec2 dir = -n;
  vec3 col = vec3(wall(p + dir * sh * (1. + uM1.w * 4.)).r, wall(p + dir * sh).g, wall(p + dir * sh * (1. - uM1.w * 4.)).b);
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, uM2.w) * 1.07;
  col = mix(col, uTint, uM2.x);
  float vy = q.y / hb.y * .5 + .5;
  col += vec3(.70, .90, 1.) * .07 * (1. - vy);          /* cool wash, top */
  col *= 1. - .07 * smoothstep(.3, 1., vy);               /* body gets darker toward the bottom */

  /* reflections: broad lamp spot + glint + an environment streak that slides with the tilt */
  vec2 L = uLight, tl = uTilt * uM2.z;
  vec2 sp = c + L * hb * .55 + tl * hb * .25, w = (p - sp) / (hb * vec2(.85, .55));
  col += vec3(.88, .97, 1.) * exp(-dot(w, w) * 1.6) * .24 * uM2.y;
  vec2 g = (p - (sp + hb * vec2(.30, .16))) / (hb * vec2(.18, .12));
  col += vec3(1.) * exp(-dot(g, g)) * .16 * uM2.y;
  float u = dot(q, normalize(vec2(1., -.6))) / length(hb) - .30 + tl.x * .45 + tl.y * .15;
  col += vec3(.80, .95, 1.) * (1. - smoothstep(0., .22, abs(u))) * .05 * uM2.y;

  /* optical edge: bright toward the lamp, cold and weaker on the far side, dark underside, thin inner line */
  float ld = dot(n, L), edge = pow(t, 2.2);
  float lit = pow(max(ld, 0.), 2.), back = pow(max(-ld, 0.), 3.);
  col += vec3(.90, .98, 1.) * edge * (.06 + .40 * lit) * uM2.y;
  col += vec3(.40, .75, 1.) * edge * back * .30;
  col *= 1. - edge * .13 * max(n.y, 0.);
  col += vec3(1.) * (1. - smoothstep(0., 1.3, abs(depth - 2.6))) * (.10 + .45 * lit) * uM2.y;

  /* pointer: a soft pool of light on the surface and a brighter rim near the cursor */
  float dp = length(p - uPtr), cur = exp(-dp * dp / (2. * 120. * 120.));
  col += vec3(.92, .99, 1.) * cur * (.14 + edge * .5) * uM2.y;

  col = clamp(col, 0., 1.);
  gl_FragColor = vec4(col * a, a);
}`;

  function startGL() {
    const wall = document.querySelector('.wall');
    if (!wall) return;
    const cv = document.createElement('canvas');
    cv.id = 'lgl'; cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = docMode
      ? 'position:absolute;left:0;top:0;width:100%;z-index:0;pointer-events:none'   /* scrolls with the page */
      : 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none';
    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return;
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
      return s;
    };
    const vs = mk(gl.VERTEX_SHADER, VS), fs = mk(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(prog)); return; }
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uWall', 'uRes', 'uView', 'uPtr', 'uLight', 'uTilt', 'uDpr', 'uRadius', 'uScroll', 'uRect', 'uM1', 'uM2', 'uTint']
      .forEach(n => U[n] = gl.getUniformLocation(prog, n));
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(U.uWall, 0);
    gl.enable(gl.SCISSOR_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    wall.after(cv);
    if (docMode) root.classList.add('mgl');

    let alive = true, fr = 0, W = 0, H = 0, CH = 0, dpr = 1, list = [], dirty = true, shown = false, lastKey = '';
    const ptr = { x: -1e4, y: -1e4 }, tilt = { x: 0, y: 0 };

    /* repaint the CSS wallpaper (gradient + blobs + scrim) into a texture at half resolution */
    function paintWall() {
      const k = .5, wc = document.createElement('canvas');
      wc.width = Math.max(2, Math.ceil(W * k)); wc.height = Math.max(2, Math.ceil(H * k));
      const g = wc.getContext('2d'); g.scale(k, k);
      const ang = 160 * Math.PI / 180, dx = Math.sin(ang), dy = -Math.cos(ang);
      const len = Math.abs(W * dx) + Math.abs(H * dy);
      const lg = g.createLinearGradient(W / 2 - dx * len / 2, H / 2 - dy * len / 2, W / 2 + dx * len / 2, H / 2 + dy * len / 2);
      lg.addColorStop(0, '#bcd9e2'); lg.addColorStop(.6, '#8fbccb'); lg.addColorStop(1, '#6fa5bd');
      g.fillStyle = lg; g.fillRect(0, 0, W, H);
      BLOBS.forEach(([cls, px, py, stops]) => {
        const el = wall.querySelector('.' + cls); if (!el) return;
        const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const ox = r.left + px * r.width, oy = r.top + py * r.height;
        const R = Math.max(Math.hypot(ox - r.left, oy - r.top), Math.hypot(ox - r.right, oy - r.top),
                           Math.hypot(ox - r.left, oy - r.bottom), Math.hypot(ox - r.right, oy - r.bottom));
        const rg = g.createRadialGradient(ox, oy, 0, ox, oy, R);
        stops.forEach(([o, col]) => rg.addColorStop(o, col));
        g.save(); g.beginPath(); g.arc(cx, cy, r.width / 2, 0, Math.PI * 2); g.clip();
        g.fillStyle = rg; g.fillRect(r.left, r.top, r.width, r.height); g.restore();
      });
      const sg = g.createLinearGradient(0, 0, 0, H);
      sg.addColorStop(0, 'rgba(8,34,68,.28)'); sg.addColorStop(1, 'rgba(8,34,68,.22)');
      g.fillStyle = sg; g.fillRect(0, 0, W, H);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wc);
    }

    function collect() {
      if (!alive) return;
      list = Array.from(document.querySelectorAll(docMode ? '.glass:not(.nav-pill)' : '.glass')).map(el => {
        const m = Object.assign({}, DEF, (MAT.find(([s]) => el.matches(s)) || [0, {}])[1]);
        return { el, m, r: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 };
      });
      dirty = true;
    }

    function resize() {
      if (!alive) return;
      const vr = wall.getBoundingClientRect();
      W = vr.width; H = vr.height;
      CH = docMode ? Math.max(2, Math.ceil(document.body.getBoundingClientRect().height)) : H;
      dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);
      if (docMode) { dpr = Math.max(.75, Math.min(dpr, 4096 / CH)); cv.style.height = CH + 'px'; }
      cv.width = Math.round(W * dpr); cv.height = Math.round(CH * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      paintWall(); collect();
    }

    function draw() {
      const sy = docMode ? (window.scrollY || 0) : 0, M = docMode ? 500 : 0;
      const vis = [], key = [ptr.x | 0, ptr.y | 0, (tilt.x * 200) | 0, (tilt.y * 200) | 0, sy | 0];
      for (const it of list) {
        const rc = it.el.getBoundingClientRect();
        if (rc.width < 2 || rc.bottom < -M || rc.top > H + M || rc.right < 0 || rc.left > W) continue;
        vis.push([it, rc]); key.push(rc.left.toFixed(1), rc.top.toFixed(1), rc.width.toFixed(1), rc.height.toFixed(1));
      }
      const k = key.join(',');
      if (k === lastKey && !dirty) return;
      lastKey = k; dirty = false;
      gl.disable(gl.SCISSOR_TEST); gl.clear(gl.COLOR_BUFFER_BIT); gl.enable(gl.SCISSOR_TEST);
      gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform2f(U.uView, W, H); gl.uniform1f(U.uDpr, dpr); gl.uniform1f(U.uScroll, sy);
      gl.uniform2f(U.uPtr, ptr.x, ptr.y); gl.uniform2f(U.uTilt, tilt.x, tilt.y);
      for (const [it, rc] of vis) {
        const m = it.m, sc = it.el.offsetWidth ? rc.width / it.el.offsetWidth : 1;
        gl.uniform4f(U.uRect, rc.left, rc.top + sy, rc.width, rc.height);
        gl.uniform1f(U.uRadius, it.r * sc);
        gl.uniform4f(U.uM1, m.bezel * sc, m.str * sc, m.curve, m.disp);
        gl.uniform4f(U.uM2, m.tint, m.spec, m.tilt, m.sat);
        gl.uniform3f(U.uTint, 34 / 255, 78 / 255, 122 / 255);
        let lx = LX * W - (rc.left + rc.width / 2), ly = LY * H - (rc.top + rc.height / 2);
        const ll = Math.hypot(lx, ly) || 1; gl.uniform2f(U.uLight, lx / ll, ly / ll);
        const x0 = Math.max(0, Math.floor((rc.left - 2) * dpr)), x1 = Math.min(cv.width, Math.ceil((rc.right + 2) * dpr));
        const y0 = Math.max(0, Math.floor((CH - rc.bottom - sy - 2) * dpr)), y1 = Math.min(cv.height, Math.ceil((CH - rc.top - sy + 2) * dpr));
        gl.scissor(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (!shown) { shown = true; root.classList.add('gl'); }
    }

    function frame() {
      if (!alive) return;
      const tx = ptr.x > -1e3 ? (ptr.x / W - .5) * 2 : 0, ty = ptr.y > -1e3 ? (ptr.y / H - .5) * 2 : 0;
      tilt.x += (tx - tilt.x) * .12; tilt.y += (ty - tilt.y) * .12;
      draw(); fr = requestAnimationFrame(frame);
    }

    const onLost = e => { e.preventDefault(); alive = false; root.classList.remove('gl', 'mgl'); cv.remove(); };
    const onMove = e => { if (e.pointerType !== 'touch') { ptr.x = e.clientX; ptr.y = e.clientY; } };
    const onLeave = () => { ptr.x = ptr.y = -1e4; };
    let rt = 0, mt = 0, ht = 0, lastRW = innerWidth;
    const onResize = () => {
      if (coarse && innerWidth === lastRW) return;   /* only the URL bar moved */
      lastRW = innerWidth; clearTimeout(rt); rt = setTimeout(resize, 120);
    };
    cv.addEventListener('webglcontextlost', onLost);
    addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave);
    addEventListener('resize', onResize);
    const mo = new MutationObserver(() => { clearTimeout(mt); mt = setTimeout(collect, 60); });
    mo.observe(document.body, { childList: true, subtree: true });
    let ro = null;
    if (docMode && window.ResizeObserver) {
      ro = new ResizeObserver(() => {
        if (Math.abs(Math.ceil(document.body.getBoundingClientRect().height) - CH) <= 2) return;
        clearTimeout(ht); ht = setTimeout(resize, 100);
      });
      ro.observe(document.body);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
    resize(); fr = requestAnimationFrame(frame);

    return function stop() {
      alive = false; cancelAnimationFrame(fr);
      clearTimeout(rt); clearTimeout(mt); clearTimeout(ht);
      removeEventListener('pointermove', onMove); root.removeEventListener('pointerleave', onLeave);
      removeEventListener('resize', onResize);
      mo.disconnect(); if (ro) ro.disconnect();
      cv.remove(); root.classList.remove('gl', 'mgl');
      const ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
    };
  }

  /* start / stop the lens when the mode changes (the lever fires 'tia-mode') */
  let stopGL = null;
  function sync() {
    if (lite() || noGL) { if (stopGL) { stopGL(); stopGL = null; } return; }
    if (!stopGL) stopGL = startGL() || null;
    schedule();
  }
  document.addEventListener('tia-mode', sync);
  sync();
})();


/*social dock on phones: two pages (4 icons, then 3), swipe or tap the dots; the dock resizes to the page*/
(function () {
  const dock = document.querySelector('.dock');
  const track = dock && dock.querySelector('.dock-track');
  const pages = track ? track.querySelectorAll('.dock-page') : [];
  const dots = document.querySelectorAll('.dock-dots button');
  if (pages.length < 2) return;
  const mq = matchMedia('(max-width: 520px)');
  let idx = 0, w0 = 0, w1 = 0, drag = null, moved = false;

  const paint = p => {                      /* p: 0 = page 1, 1 = page 2 (fractions while dragging) */
    dock.style.width = (w0 + (w1 - w0) * p) + 'px';
    track.style.transform = 'translateX(' + (-w0 * p) + 'px)';
  };
  const mark = i => dots.forEach((d, k) => d.classList.toggle('on', k === i));
  function go(i) { idx = i; dock.classList.remove('dragging'); paint(i); mark(i); }
  function layout() {
    if (!mq.matches) { dock.style.width = ''; track.style.transform = ''; return; }
    w0 = pages[0].offsetWidth; w1 = pages[1].offsetWidth;
    dock.classList.add('dragging'); paint(idx);               /* re-fit without animating */
    requestAnimationFrame(() => dock.classList.remove('dragging'));
  }

  dock.addEventListener('pointerdown', e => {
    if (!mq.matches || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { x: e.clientX, id: e.pointerId, on: false, p: idx, last: idx, dx: 0 };
    moved = false;
  });
  dock.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.on) {
      if (Math.abs(dx) < 6) return;
      drag.on = true; moved = true; dock.classList.add('dragging');
      try { dock.setPointerCapture(e.pointerId); } catch (_) {}
    }
    drag.dx = dx; drag.last = Math.min(1, Math.max(0, drag.p - dx / w0));
    paint(drag.last);
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!d.on) return;
    let to = d.last > .5 ? 1 : 0;
    if (Math.abs(d.dx) > 28) to = d.dx < 0 ? 1 : 0;
    go(to);
    setTimeout(() => { moved = false; }, 0);
  };
  dock.addEventListener('pointerup', end);
  dock.addEventListener('pointercancel', end);
  dock.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);/* a swipe is not a tap */
  dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
  dock.addEventListener('focusin', e => { 
    if (!mq.matches) return;
    const pg = e.target.closest && e.target.closest('.dock-page');
    const k = pg ? Array.prototype.indexOf.call(pages, pg) : -1;
    dock.scrollLeft = 0;
    if (k > -1 && k !== idx) go(k);
  });
  addEventListener('resize', layout);
  if (mq.addEventListener) mq.addEventListener('change', layout);
  layout(); mark(0);
})();