(function () {
  // Edit these three values to show real contact links.
  var CONTACT = { email: "", linkedin: "", github: "" };

  var root = document.documentElement;
  var btn = document.getElementById('theme');
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var staticMode = reduce;
  var STATIC_T = 15;

  try {
    var saved = localStorage.getItem('rs-theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) {}

  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : mq.matches;
  }
  function syncBtn() {
    btn.setAttribute('aria-pressed', String(isDark()));
    btn.querySelector('span').textContent = isDark() ? 'Dark' : 'Light';
  }
  btn.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('rs-theme', next); } catch (e) {}
    syncBtn(); readColors(); if (staticMode) draw(STATIC_T);
  });
  if (mq.addEventListener) mq.addEventListener('change', function () {
    syncBtn(); readColors(); if (staticMode) draw(STATIC_T);
  });

  /* Simulated EEG */
  var canvas = document.getElementById('eeg');
  var ctx = canvas.getContext('2d');
  var chip = document.getElementById('chip');
  var chipText = document.getElementById('chipText');
  var TAU = Math.PI * 2, SPEED = 110, PERIOD = 12, B0 = 7, B1 = 10.2;
  var W = 0, H = 0, colors = { trace: '#0B6E6E', alert: '#C4361B' }, chipAlert = false;

  function ss(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function hash(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
  function vn(x) { var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u; }
  function burstW(t) { var p = ((t % PERIOD) + PERIOD) % PERIOD; return ss(B0, B0 + 0.7, p) * (1 - ss(B1 - 0.6, B1 + 0.4, p)); }

  var CH = [
    { a: 1.0, f: [9.1, 13.7, 2.3], p: 0.0, s: 11, g: 1.0 },
    { a: 0.9, f: [8.4, 12.2, 1.7], p: 1.3, s: 47, g: 0.85 },
    { a: 1.1, f: [10.2, 14.9, 2.9], p: 2.1, s: 83, g: 1.0 },
    { a: 0.8, f: [9.6, 11.8, 2.1], p: 0.7, s: 131, g: 0.7 }
  ];
  function sig(c, t, w) {
    var base = 0.5 * Math.sin(TAU * c.f[0] * t + c.p) + 0.3 * Math.sin(TAU * c.f[1] * t + c.p * 2) +
               0.35 * Math.sin(TAU * c.f[2] * t) + 1.4 * (vn(t * 22 + c.s) - 0.5);
    var sw = Math.sin(TAU * 3 * t + c.p * 0.3);
    var wave = (sw < 0 ? -1 : 1) * Math.pow(Math.abs(sw), 0.55);
    var spike = Math.pow(Math.max(0, Math.sin(TAU * 3 * t + c.p * 0.3 + 1.2)), 14);
    var burst = (0.9 * wave + 1.6 * spike) * 2.2 * c.g;
    return (base * (1 - 0.65 * w) + burst * w) * c.a;
  }
  function readColors() {
    var cs = getComputedStyle(root);
    colors = { trace: cs.getPropertyValue('--trace').trim() || colors.trace, alert: cs.getPropertyValue('--alert').trim() || colors.alert };
  }
  function size() {
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function setChip(on) {
    if (on === chipAlert) return;
    chipAlert = on;
    chip.className = on ? 'chip alert' : 'chip';
    chipText.textContent = on ? 'Seizure pattern found · alert sent to caregiver' : 'Monitoring';
  }
  function draw(now) {
    if (!W) return;
    ctx.clearRect(0, 0, W, H);
    var n = CH.length, rowH = H / n, unit = rowH * 0.09;
    ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
    for (var i = 0; i < n; i++) {
      var c = CH[i], cy = rowH * (i + 0.5);
      var pn = new Path2D(), pa = new Path2D(), last = null, lastA = false;
      for (var x = 0; x <= W; x += 2) {
        var t = now - (W - x) / SPEED, w = burstW(t);
        var y = cy - sig(c, t, w) * unit;
        var isA = w > 0.2, p = isA ? pa : pn;
        if (last === null) p.moveTo(x, y); else if (isA !== lastA) p.moveTo(last[0], last[1]);
        p.lineTo(x, y); last = [x, y]; lastA = isA;
      }
      ctx.strokeStyle = colors.trace; ctx.stroke(pn);
      ctx.strokeStyle = colors.alert; ctx.stroke(pa);
    }
    setChip(burstW(now) > 0.55);
  }

  var raf = 0, t0 = 0, running = false;
  function frame(ts) {
    if (!t0) t0 = ts;
    draw(STATIC_T + (ts - t0) / 1000);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!running && !staticMode) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); t0 = 0; }

  readColors(); syncBtn(); size();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(function () { size(); if (staticMode || !running) draw(STATIC_T); }).observe(document.getElementById('scope'));
  }
  draw(STATIC_T);
  if (!staticMode && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { es[0].isIntersecting ? start() : stop(); }).observe(document.getElementById('scope'));
  } else { start(); }

  /* Contact rows */
  var reach = document.getElementById('reach');
  function row(label, value, href, copyable) {
    var wrap = document.createElement('div');
    var dt = document.createElement('dt'); dt.textContent = label;
    var dd = document.createElement('dd');
    if (value) {
      if (href) { var a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = value; dd.appendChild(a); }
      else dd.textContent = value;
    } else { dd.className = 'ph'; dd.textContent = '[Add your ' + label.toLowerCase() + ']'; }
    wrap.appendChild(dt); wrap.appendChild(dd);
    if (value && copyable) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'copy'; b.textContent = 'Copy';
      b.addEventListener('click', function () {
        function done() { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1600); }
        try { navigator.clipboard.writeText(value).then(done, function () { b.textContent = 'Select text'; }); } catch (e) { b.textContent = 'Select text'; }
      });
      wrap.appendChild(b);
    } else { wrap.appendChild(document.createElement('span')); }
    reach.appendChild(wrap);
  }
  row('Email', CONTACT.email, '', true);
  row('LinkedIn', CONTACT.linkedin, CONTACT.linkedin, false);
  row('GitHub', CONTACT.github, CONTACT.github, false);
})();