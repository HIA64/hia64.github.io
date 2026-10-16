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

    /*low-end tier: never for capable phones. Only when the hardware hints say "weak" (<=4 cores or <=3 GB)
    AND frames are measurably slow while the user actually scrolls. Manual override: ?fx=low / ?fx=high*/
  (function () {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    let fx = '';
    try { fx = new URLSearchParams(location.search).get('fx') || ''; } catch (e) {}
    const root = document.documentElement;
    if (fx === 'low') { root.classList.add('lowfx'); return; }
    if (fx === 'high' || !coarse || reduce) return;
    const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
    if (!weak) return;
    let lastScroll = 0, last = 0, n = 0, bad = 0, running = false;
    function frame(t) {
      if (t - lastScroll < 120) {
        const dt = t - last;
        if (last && dt < 250) { n++; if (dt > 40) bad++; }
        if (n >= 60) { if (bad / n > 0.4) root.classList.add('lowfx'); window.removeEventListener('scroll', onScroll); return; }
      }
      last = t;
      requestAnimationFrame(frame);
    }
    function onScroll() {
      lastScroll = performance.now();
      if (!running) { running = true; requestAnimationFrame(frame); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

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

  /*nav shrinks on scroll, like ios 26 Safari*/
  const nav = document.querySelector('.topnav');
  if (nav) {
    let compact = false;
    const onScroll = () => {
      const now = window.scrollY > 30;
      if (now !== compact) { compact = now; nav.classList.toggle('compact', compact); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
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
    window.addEventListener('resize', fit);
    setInterval(() => { if (!document.hidden) swap(); }, 5000);
  }

  /*reveal + counters*/
  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    if (reduce) { el.textContent = prefix + target + suffix; return; }
    const dur = 1500, t0 = performance.now();
    (function tick(now) {
      const k = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
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

/* ===== Liquid Glass v2 =====
   1. every glass surface gets its own light direction (--la, --sx, --sy) from where it sits on screen
   2. Chromium only: a real refraction lens (SVG displacement map) behind small/medium glass.
      Safari/Firefox keep the CSS-only material. Disable with ?fx=flat */
(function () {
  let fx = '';
  try { fx = new URLSearchParams(location.search).get('fx') || ''; } catch (e) {}
  if (fx === 'flat') return;
  const coarse = matchMedia('(pointer: coarse)').matches;

  /* 1. light direction: one lamp, top-left, above the fold */
  const LX = .16, LY = -.30, lastA = new WeakMap();
  function light() {
    const W = innerWidth, H = innerHeight;
    const els = Array.from(document.querySelectorAll('.glass, .lite'));
    const rects = els.map(el => el.getBoundingClientRect());      // all reads first, then all writes
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
  let q = 0, t = 0, t2 = 0;
  function schedule() {
    clearTimeout(t2); t2 = setTimeout(scan, 700);          // catch size changes after the nav pill finishes animating
    if (coarse) { clearTimeout(t); t = setTimeout(() => { light(); scan(); }, 120); return; }
    if (q) return;
    q = requestAnimationFrame(() => { q = 0; light(); scan(); });
  }

  /* 2. refraction lens */
  const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
  const lens = brands.some(b => /Chromium/i.test(b.brand)) && !coarse &&
    !matchMedia('(prefers-reduced-transparency: reduce)').matches && fx !== 'low';
  const NS = 'http://www.w3.org/2000/svg';
  const SEL = '.nav-pill, .btn, .dock, .search-wrap, .segmented, .widget, .card, .creator, .note';
  let defs = null, uid = 0;
  const filters = new WeakMap(), sizes = new WeakMap();

  function makeMap(w, h, r, bz) {
    const cw = Math.max(8, Math.round(w / 2)), ch = Math.max(8, Math.round(h / 2));
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d'), img = g.createImageData(cw, ch), d = img.data;
    const bx = w / 2 - r, by = h / 2 - r;
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const x = ((i + .5) / cw - .5) * w, y = ((j + .5) / ch - .5) * h;
      const qx = Math.abs(x) - bx, qy = Math.abs(y) - by;
      const depth = r - (Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0));
      let R = 128, G = 128;
      if (depth >= 0 && depth < bz) {
        const mag = Math.pow(1 - depth / bz, 2), sx = x < 0 ? -1 : 1, sy = y < 0 ? -1 : 1;
        let nx = 0, ny = 0;
        if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy) || 1; nx = sx * qx / l; ny = sy * qy / l; }
        else if (qx > qy) nx = sx; else ny = sy;
        R = 128 - nx * mag * 127; G = 128 - ny * mag * 127;   // pull the sample from inside the glass
      }
      const o = (j * cw + i) * 4; d[o] = R; d[o + 1] = G; d[o + 2] = 128; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function refract(el) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h || w * h > 90000) return;
    const s = sizes.get(el);
    if (s && Math.abs(s[0] - w) < 3 && Math.abs(s[1] - h) < 3) return;
    sizes.set(el, [w, h]);
    const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
    const bz = Math.max(6, Math.min(18, Math.min(w, h) * .22));
    let f = filters.get(el);
    if (!f) {
      const id = 'lg' + (++uid);
      const flt = document.createElementNS(NS, 'filter');
      flt.setAttribute('id', id);
      flt.setAttribute('filterUnits', 'userSpaceOnUse');
      flt.setAttribute('color-interpolation-filters', 'sRGB');
      const im = document.createElementNS(NS, 'feImage');
      im.setAttribute('preserveAspectRatio', 'none'); im.setAttribute('result', 'map');
      const dm = document.createElementNS(NS, 'feDisplacementMap');
      dm.setAttribute('in', 'SourceGraphic'); dm.setAttribute('in2', 'map');
      dm.setAttribute('xChannelSelector', 'R'); dm.setAttribute('yChannelSelector', 'G');
      flt.append(im, dm); defs.appendChild(flt);
      f = { id, flt, im, dm }; filters.set(el, f);
      el.style.setProperty('--refract', 'url(#' + id + ')');
    }
    f.flt.setAttribute('x', 0); f.flt.setAttribute('y', 0);
    f.flt.setAttribute('width', w); f.flt.setAttribute('height', h);
    f.im.setAttribute('width', w); f.im.setAttribute('height', h);
    f.im.setAttribute('href', makeMap(w, h, r, bz));
    f.dm.setAttribute('scale', (bz * 1.8).toFixed(1));
  }

  function scan() {
    if (!lens) return;
    document.querySelectorAll(SEL).forEach(el => { if (el.classList.contains('glass')) refract(el); });
  }

  if (lens) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', 0); svg.setAttribute('height', 0); svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none';
    defs = document.createElementNS(NS, 'defs'); svg.appendChild(defs);
    document.body.appendChild(svg);
    root().classList.add('refract');
  }
  function root() { return document.documentElement; }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
})();
