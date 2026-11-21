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

    /* Interaction: dragging draws a solid line of live cells, and a click or tap bursts a cluster of cells
       with four gliders flying outward. Hovering does nothing. Off under reduced motion. */
    const hero = canvas.parentElement;
    if (animate && ctx && hero) {
      const wrap = (v, n) => ((v % n) + n) % n;
      const cellAt = (e) => {
        const r = canvas.getBoundingClientRect();
        return [Math.floor((e.clientX - r.left) / CELL), Math.floor((e.clientY - r.top) / CELL)];
      };
      // A freshly seeded cell is drawn brighter at once; the trail fade then settles it into the field.
      const flash = (x, y) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x * CELL, y * CELL, CELL - GAP, CELL - GAP);
        ctx.globalAlpha = 1;
      };
      const seedCell = (x, y) => {
        x = wrap(x, w); y = wrap(y, h);
        cells[y * w + x] = 1;
        flash(x, y);
      };
      const stamp = (x, y, sx, sy) => {
        for (const [dx, dy] of GLIDER) seedCell(x + (sx === 1 ? dx : 2 - dx), y + (sy === 1 ? dy : 2 - dy));
      };

      // A solid brush for drags: the cell plus its 4 neighbours, so the drawn line is clearly visible.
      const seedBrush = (x, y) => {
        seedCell(x, y); seedCell(x + 1, y); seedCell(x - 1, y); seedCell(x, y + 1); seedCell(x, y - 1);
      };
      // Click or tap: a dense disc of cells that bursts into activity, plus four gliders flying outward.
      const burst = (x, y) => {
        for (let dy = -3; dy <= 3; dy++)
          for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 10 && Math.random() < 0.55) seedCell(x + dx, y + dy);
        stamp(x + 4, y + 4, 1, 1);
        stamp(x - 6, y + 4, -1, 1);
        stamp(x + 4, y - 6, 1, -1);
        stamp(x - 6, y - 6, -1, -1);
      };
      const excluded = (e) => e.target.closest('a, button, input, select, textarea, .demo');

      let px = null, py = null, drawing = null; // drawing = id of the pointer that is pressed, or null
      const trace = (x, y) => {
        if (px === null) seedBrush(x, y);
        else {
          // Fill the cells between samples so fast drags still leave a continuous line.
          const n = Math.max(Math.abs(x - px), Math.abs(y - py));
          for (let s = 1; s <= n; s++) seedBrush(Math.round(px + ((x - px) * s) / n), Math.round(py + ((y - py) * s) / n));
        }
        px = x; py = y;
      };
      hero.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || excluded(e)) return;
        if (e.pointerType === 'mouse') e.preventDefault(); // drag draws instead of selecting text
        drawing = e.pointerId;
        const [x, y] = cellAt(e);
        burst(x, y);
        px = x; py = y;
      });
      hero.addEventListener('pointermove', (e) => {
        // Only a press-and-drag draws; plain hovering leaves the field alone.
        // On touch, vertical swipes still scroll the page (see touch-action in CSS).
        if (drawing !== e.pointerId) return;
        const [x, y] = cellAt(e);
        if (x === px && y === py) return;
        trace(x, y);
      }, { passive: true });
      const release = (e) => { if (drawing === e.pointerId) drawing = null; };
      // Listen on window so letting go outside the hero still ends the drag.
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', (e) => { release(e); px = py = null; });
      hero.classList.add('life-interactive');
    }
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

  /* ---------------------------------------------------------------- top bar over the hero */
  // The glass bar takes the dark tokens while the (always dark) hero is behind it.
  const barWrap = document.querySelector('.bar-wrap');
  const heroEl = document.querySelector('.hero');
  if (barWrap && heroEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => barWrap.classList.toggle('on-hero', e.isIntersecting),
      { rootMargin: '0px 0px -92% 0px' }).observe(heroEl);
  }

  /* ---------------------------------------------------------------- dashboard gallery */
  const gallery = document.querySelector('[data-gallery]');
  if (gallery) {
    const gSlides = [...gallery.querySelectorAll('.gallery-slide')];
    const gDots = gallery.querySelector('[data-gdots]');
    const gCap = gallery.querySelector('[data-gcap]');
    let g = 0;
    const dotButtons = gSlides.map((s, n) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `${s.dataset.title} (${n + 1} of ${gSlides.length})`);
      b.addEventListener('click', () => show(n));
      li.append(b); gDots.append(li);
      return b;
    });
    const show = (n) => {
      g = (n + gSlides.length) % gSlides.length;
      gSlides.forEach((s, k) => { s.classList.toggle('is-active', k === g); s.setAttribute('aria-hidden', String(k !== g)); });
      dotButtons.forEach((b, k) => b.setAttribute('aria-current', String(k === g)));
      const s = gSlides[g];
      gCap.innerHTML = '';
      const t = document.createElement('b'); t.textContent = s.dataset.title;
      gCap.append(t, ' ' + s.dataset.caption);
      // Load images on demand: this page and the next one. Only the current theme's image is fetched
      // (the other is display: none), so a visitor who never clicks downloads two screenshots.
      for (const k of [g, (g + 1) % gSlides.length]) {
        gSlides[k].querySelectorAll('img[data-src]').forEach((i) => { i.loading = 'lazy'; i.src = i.dataset.src; i.removeAttribute('data-src'); });
      }
    };
    gallery.querySelectorAll('[data-gprev]').forEach((b) => b.addEventListener('click', () => show(g - 1)));
    gallery.querySelectorAll('[data-gnext]').forEach((b) => b.addEventListener('click', () => show(g + 1)));
    gallery.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(g - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(g + 1); }
    });
    let gx = null, gy = null;
    const frame = gallery.querySelector('.gallery-frame');
    frame.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { gx = e.clientX; gy = e.clientY; } });
    frame.addEventListener('pointerup', (e) => {
      if (gx === null) return;
      const dx = e.clientX - gx, dy = e.clientY - gy; gx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(g + (dx < 0 ? 1 : -1));
    });
    show(0);
  }

  /* ---------------------------------------------------------------- demo video */
  // Two recordings of the same video, light and dark, identical frame for frame. The one that
  // matches the theme is shown; on a theme switch the other seeks a little ahead, starts when the
  // visible one reaches that moment, and they crossfade, so playback continues in the new theme.
  const film = document.querySelector('[data-film]');
  if (film) {
    const frame = film.querySelector('.film-frame');
    const vids = { light: film.querySelector('[data-film-theme="light"]'), dark: film.querySelector('[data-film-theme="dark"]') };
    const chapters = [...film.querySelectorAll('[data-seek]')];
    const themeNow = () => (root.classList.contains('dark') ? 'dark' : 'light');
    let cur = themeNow();
    let swap = 0;
    frame.classList.add('js');
    const mark = () => { for (const k in vids) vids[k].classList.toggle('is-on', k === cur); };
    mark();
    const once = (el, ev) => new Promise((res) => el.addEventListener(ev, res, { once: true }));
    const ready = async (v) => { if (v.readyState < 1) { v.preload = 'auto'; v.load(); await once(v, 'loadedmetadata'); } };
    const seek = async (v, t) => { if (Math.abs(v.currentTime - t) < 0.02) return; v.currentTime = t; await once(v, 'seeked'); };
    const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const active = () => vids[cur];

    new MutationObserver(async () => {
      const next = themeNow();
      if (next === cur) return;
      const from = vids[cur], to = vids[next], id = ++swap;
      const started = from.currentTime > 0 || !from.paused;
      if (!started) { cur = next; mark(); return; }
      await ready(to);
      if (id !== swap) return;
      const playing = !from.paused && !from.ended;
      if (playing) {
        // Seek ahead of the visible video, then start exactly when it gets there.
        const at = Math.min(from.currentTime + 0.6, from.duration - 0.05);
        await seek(to, at);
        if (id !== swap) return;
        await new Promise((res) => {
          const tick = () => (id !== swap || from.paused || from.currentTime >= at ? res() : requestAnimationFrame(tick));
          tick();
        });
        if (id !== swap) return;
        play(to);
      } else {
        await seek(to, from.currentTime);
        if (id !== swap) return;
      }
      cur = next; mark();
      if (playing) setTimeout(() => { if (id === swap) from.pause(); }, reduced() ? 0 : 520);
    }).observe(root, { attributes: true, attributeFilter: ['class'] });

    const go = async (t) => {
      const v = active(); swap++;
      await ready(v);
      if (t !== undefined) await seek(v, t);
      play(v);
    };
    chapters.forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.seek))));
    for (const k in vids) vids[k].addEventListener('timeupdate', () => {
      if (vids[k] !== active()) return;
      let at = -1;
      chapters.forEach((b, n) => { if (vids[k].currentTime >= Number(b.dataset.seek) - 0.2) at = n; });
      chapters.forEach((b, n) => b.setAttribute('aria-current', String(n === at)));
    });
    document.querySelectorAll('[data-play-film]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      film.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
      go();
    }));
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
        discover.querySelector('.value').textContent = users > 50 ? 'Audit covers 50 computers' : '€0';
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
