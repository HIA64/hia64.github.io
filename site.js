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

  /*touch: light the glass where the finger lands (one custom-property write, no per-frame work)*/
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    const el = e.target.closest && e.target.closest('.glass, .lite');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /*weak-device probe: if the first ~700ms of frames are slow on a touch screen, switch to the lighter tier*/
  if (!reduce && window.matchMedia('(pointer: coarse)').matches) {
    let last = 0, n = 0, slow = 0;
    (function probe(t) {
      if (last && n++ > 2) { if (t - last > 34) slow++; }
      last = t;
      if (n < 40) requestAnimationFrame(probe);
      else if (slow > 14) document.documentElement.classList.add('lowfx');
    })(performance.now());
  }

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
