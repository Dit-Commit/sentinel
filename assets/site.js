// Panopticon Sentinel site: theme toggle, Game of Life hero, live masking demo, presentation, pricing calculator.
// No dependencies. Everything degrades to readable static content without JavaScript.
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- theme */
  for (const btn of document.querySelectorAll('[data-theme-toggle]')) {
    const sync = () => btn.setAttribute('aria-label', root.classList.contains('dark') ? 'Switch to light theme' : 'Switch to dark theme');
    sync();
    btn.addEventListener('click', () => {
      const dark = root.classList.toggle('dark');
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) { /* storage blocked: theme still switches */ }
      sync();
    });
  }

  /* ---------------------------------------------------------------- Game of Life (port of the dashboard's lifeRunner) */
  const canvas = document.querySelector('canvas[data-life]');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const CELL = 11, GAP = 2, STEP_MS = 100, FADE = 0.22;
    const accent = getComputedStyle(canvas).getPropertyValue('--accent').trim() || '#7aa2f2';
    let w = 1, h = 1, cells = new Uint8Array(1), next = new Uint8Array(1), dpr = 1, raf = 0, last = 0, acc = 0, sinceGlider = 0;
    const animate = !reduced();

    const seed = (density) => { for (let i = 0; i < cells.length; i++) cells[i] = Math.random() < density ? 1 : 0; };
    const step = () => {
      for (let y = 0; y < h; y++) {
        const up = ((y + h - 1) % h) * w, mid = y * w, down = ((y + 1) % h) * w;
        for (let x = 0; x < w; x++) {
          const l = (x + w - 1) % w, r = (x + 1) % w;
          const n = cells[up + l] + cells[up + x] + cells[up + r] + cells[mid + l] + cells[mid + r] + cells[down + l] + cells[down + x] + cells[down + r];
          next[mid + x] = n === 3 || (n === 2 && cells[mid + x] === 1) ? 1 : 0;
        }
      }
      [cells, next] = [next, cells];
    };
    const reseedIfSparse = () => {
      let pop = 0;
      for (let i = 0; i < cells.length; i++) pop += cells[i];
      if (pop >= cells.length * 0.012) return;
      const size = Math.max(8, Math.round(Math.min(w, h) / 3));
      const x0 = Math.floor(Math.random() * w), y0 = Math.floor(Math.random() * h);
      for (let dy = 0; dy < Math.min(size, h); dy++)
        for (let dx = 0; dx < Math.min(size, w); dx++) if (Math.random() < 0.35) cells[((y0 + dy) % h) * w + ((x0 + dx) % w)] = 1;
    };
    const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];
    const glider = () => {
      const side = Math.floor(Math.random() * 4), along = Math.random();
      let x, y;
      if (side < 2) { x = Math.floor(along * (w - 3)); y = side === 0 ? 0 : h - 3; }
      else { x = side === 2 ? 0 : w - 3; y = Math.floor(along * (h - 3)); }
      const sx = x + 1 < w / 2 ? 1 : -1, sy = y + 1 < h / 2 ? 1 : -1;
      for (const [dx, dy] of GLIDER) {
        const cx = (((sx === 1 ? dx : 2 - dx) + x) % w + w) % w;
        const cy = (((sy === 1 ? dy : 2 - dy) + y) % h + h) % h;
        cells[cy * w + cx] = 1;
      }
    };
    const paint = (clear) => {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'destination-out'; // fade the trail instead of wiping it
      ctx.fillStyle = `rgba(0,0,0,${clear ? 1 : FADE})`;
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.17;
      const s = CELL - GAP;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (cells[y * w + x]) ctx.fillRect(x * CELL, y * CELL, s, s);
      ctx.globalAlpha = 1;
    };
    const layout = () => {
      const cssW = canvas.clientWidth || 1, cssH = canvas.clientHeight || 1;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      const nw = Math.max(8, Math.ceil(cssW / CELL)), nh = Math.max(8, Math.ceil(cssH / CELL));
      if (nw === w && nh === h) { paint(true); return; }
      w = nw; h = nh;
      cells = new Uint8Array(w * h); next = new Uint8Array(w * h);
      seed(0.08);
      paint(true);
    };
    let visible = true;
    const frame = (t) => {
      raf = 0;
      if (document.hidden || !visible) return; // resumed by the visibility / intersection observers
      acc += Math.min(t - last, 500);
      last = t;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        sinceGlider += STEP_MS;
        if (sinceGlider >= 4000) { sinceGlider = 0; glider(); }
        step(); reseedIfSparse(); paint(false);
      }
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!animate || raf || document.hidden || !visible) return; last = performance.now(); raf = requestAnimationFrame(frame); };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

    layout();
    if ('ResizeObserver' in window) new ResizeObserver(layout).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(canvas);
    }
    start();
  }

  /* ---------------------------------------------------------------- live masking demo (one arrival, ≤ 1.2 s, then calm) */
  const demo = document.querySelector('[data-demo]');
  if (demo) {
    if (reduced()) demo.classList.add('scanned', 'done');
    else {
      setTimeout(() => demo.classList.add('scanned'), 350);
      setTimeout(() => demo.classList.add('done'), 950);
    }
  }

  /* ---------------------------------------------------------------- reveal on scroll */
  const reveals = document.querySelectorAll('.reveal, .scale');
  if ('IntersectionObserver' in window && !reduced()) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else reveals.forEach((el) => el.classList.add('in'));

  /* ---------------------------------------------------------------- presentation */
  const stage = document.querySelector('[data-stage]');
  if (stage) {
    const slides = [...stage.querySelectorAll('.slide')];
    const dots = stage.querySelector('.dots');
    const prev = stage.querySelector('[data-prev]');
    const next = stage.querySelector('[data-next]');
    const count = stage.querySelector('[data-count]');
    const live = stage.querySelector('[data-live]');
    let i = 0;

    slides.forEach((s, n) => {
      s.setAttribute('role', 'group');
      s.setAttribute('aria-roledescription', 'slide');
      s.setAttribute('aria-label', `${n + 1} of ${slides.length}`);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Slide ${n + 1}: ${s.querySelector('h3')?.textContent.trim() ?? ''}`);
      b.addEventListener('click', () => go(n));
      li.append(b);
      dots.append(li);
    });
    const dotButtons = [...dots.querySelectorAll('button')];

    const go = (n, announce = true) => {
      n = Math.max(0, Math.min(slides.length - 1, n));
      const back = n < i;
      slides[i].classList.remove('is-active', 'from-left');
      i = n;
      slides[i].classList.toggle('from-left', back);
      slides[i].classList.add('is-active');
      dotButtons.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
      const label = String(i + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
      count.textContent = label;
      if (announce && live) live.textContent = `Slide ${i + 1} of ${slides.length}: ${slides[i].querySelector('h3')?.textContent.trim() ?? ''}`;
    };
    prev.addEventListener('click', () => go(i - 1));
    next.addEventListener('click', () => go(i + 1));
    stage.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(i + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1); }
    });
    // Swipe on touch screens; ignore mostly-vertical gestures and swipes inside a scrolling table.
    let x0 = null, y0 = 0;
    stage.addEventListener('touchstart', (e) => {
      if (e.target.closest('.table-scroll')) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(i + (dx < 0 ? 1 : -1));
      x0 = null;
    });
    stage.classList.add('ready');
    go(0, false);
  }

  /* ---------------------------------------------------------------- pricing calculator */
  const calc = document.querySelector('[data-calc]');
  if (calc) {
    const num = calc.querySelector('input[type="number"]');
    const range = calc.querySelector('input[type="range"]');
    const termButtons = [...calc.querySelectorAll('[data-term]')];
    const discountNote = calc.querySelector('[data-discount]');
    const volRows = [...document.querySelectorAll('[data-vol-min]')];
    const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const int = new Intl.NumberFormat('en-IE');
    let term = 1;

    // From the pitch deck: annual billing, excl. VAT. Volume −10% at 500+, −20% at 2,000+, −30% at 5,000+;
    // 3-year terms −10% more. Minimums: Protect 50 users, Business 100 users, Sovereign €25,000/yr platform.
    const volume = (u) => (u >= 5000 ? 0.30 : u >= 2000 ? 0.20 : u >= 500 ? 0.10 : 0);
    const tiers = {
      protect: { per: 6, minUsers: 50 },
      business: { per: 9, minUsers: 100 },
      sovereign: { per: 12, minAnnual: 25000 },
    };

    const update = (users) => {
      users = Math.max(1, Math.min(100000, Math.round(users) || 1));
      const v = volume(users);
      const factor = (1 - v) * (term === 3 ? 0.9 : 1);
      const parts = [];
      if (v) parts.push(`−${v * 100}% volume`);
      if (term === 3) parts.push('−10% for a 3-year term');
      discountNote.textContent = parts.length ? `Applied: ${parts.join(', ')}.` : 'No volume discount below 500 users.';
      volRows.forEach((r) => r.classList.toggle('on', users >= +r.dataset.volMin && users < +(r.dataset.volMax || Infinity)));

      for (const [key, t] of Object.entries(tiers)) {
        const box = document.querySelector(`[data-estimate="${key}"]`);
        if (!box) continue;
        const billed = Math.max(users, t.minUsers || 0);
        let annual = billed * t.per * 12 * factor;
        let why = `${int.format(billed)} users × €${t.per} × 12`;
        if (t.minUsers && users < t.minUsers) why = `Billed at the ${t.minUsers}-user minimum`;
        if (t.minAnnual && annual < t.minAnnual) { annual = t.minAnnual; why = 'Platform minimum applies'; }
        else if (factor < 1 && !(t.minUsers && users < t.minUsers)) why += ` − ${Math.round((1 - factor) * 100)}%`;
        box.querySelector('.value').textContent = `${eur.format(annual)} / yr`;
        box.querySelector('.why').textContent = why;
      }
      const discover = document.querySelector('[data-estimate="discover"]');
      if (discover) {
        discover.classList.toggle('na', users > 50);
        discover.querySelector('.value').textContent = users > 50 ? 'Audit covers 50 laptops' : '€0';
        discover.querySelector('.why').textContent = users > 50 ? 'Start with a sample of 50; the paid pilot covers up to 200.' : '30 days, inventory-only mode';
      }
      return users;
    };

    const set = (u, from) => {
      const users = update(u);
      if (from !== num) num.value = users;
      if (from !== range) range.value = Math.min(users, +range.max);
    };
    num.addEventListener('input', () => { if (num.value !== '') set(+num.value, num); });
    num.addEventListener('blur', () => set(+num.value || 1));
    range.addEventListener('input', () => set(+range.value, range));
    termButtons.forEach((b) => b.addEventListener('click', () => {
      term = +b.dataset.term;
      termButtons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      set(+num.value || 1);
    }));
    calc.hidden = false;
    set(+num.value || 500);
  }
})();
