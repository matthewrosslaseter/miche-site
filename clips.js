/*
  Real-footage clips, shared by the home page and the product page.
  - Swipe rows of clip cards. A silent preview plays while a card is on screen.
  - Tapping a card opens a full-screen viewer with sound: tap the sides or swipe to skip,
    hold to pause, swipe down or Esc to close, and a Shop button for that clip's color.
  The clip list is config.js -> clips. Files are in /media/clips (made by scripts/clips.py).
*/
(function () {
  'use strict';

  var C = window.MICHE_CONFIG || {};
  var D = window.MicheData || {};
  var ALL = (C.clips || []).filter(function (c) { return c && c.file; });
  var BASE = '/media/clips/';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var mm = function (q) { return window.matchMedia ? window.matchMedia(q).matches : false; };
  var reduce = mm('(prefers-reduced-motion: reduce)');
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var previews = !(reduce || saveData);

  var colorName = function (id) { return ((D.colorById || {})[id] || {}).name || (id ? id.charAt(0).toUpperCase() + id.slice(1) : ''); };
  var swatchOf = function (id) { return D.swatchOf ? D.swatchOf(id) : ''; };
  var tagText = function (c) { return c.color === 'both' ? 'Neon + Pink' : colorName(c.color); };
  var shopHref = function (c) { return '/product?piece=set' + (c.color === 'both' ? '' : '&color=' + c.color); };
  var shopText = function (c) { return c.color === 'both' ? 'Shop the set' : 'Shop ' + colorName(c.color).toLowerCase(); };
  var src = function (c) { return BASE + c.file + '.mp4'; };
  var preview = function (c) { return BASE + c.file + '-sm.mp4'; };
  var poster = function (c) { return BASE + c.file + '.jpg'; };

  // Clips for one color: that color's own clips first, then the ones showing both colors
  function forColor(color) {
    if (!color) return ALL.slice();
    var own = ALL.filter(function (c) { return c.color === color; });
    var both = ALL.filter(function (c) { return c.color === 'both'; });
    return own.concat(both);
  }

  function onView(el, fn, threshold) {
    if (!('IntersectionObserver' in window)) { fn(true); return function () {}; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { fn(e.isIntersecting); }); }, { threshold: threshold || 0.2 });
    io.observe(el);
    return function () { io.disconnect(); };
  }

  // A muted looping <video> for previews and lurk tiles. Loads only when first needed.
  function silentVideo(c, className) {
    var v = document.createElement('video');
    v.className = className || '';
    v.muted = true; v.loop = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.preload = 'none';
    v.poster = poster(c);
    v.dataset.src = preview(c);
    return v;
  }
  function playSilent(v) {
    if (!v.src) v.src = v.dataset.src;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  // ---------- Full-screen viewer (built once, on first open) ----------
  var V = null;
  function buildViewer() {
    if (V) return V;
    var x = function (d) { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    var el = document.createElement('div');
    el.className = 'clipview';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Clips');
    el.innerHTML =
      '<button class="clipview-nav round-btn" type="button" data-cv-prev aria-label="Previous clip">' + x('<path d="M15 6l-6 6 6 6"/>') + '</button>' +
      '<div class="clipview-stage">' +
        '<video class="clipview-video" playsinline preload="auto" data-cv-video></video>' +
        '<div class="clipview-top">' +
          '<div class="clipview-bars" data-cv-bars></div>' +
          '<div class="clipview-head">' +
            '<span class="clipview-tag" data-cv-tag></span>' +
            '<button class="clipview-btn" type="button" data-cv-sound aria-label="Mute">' +
              '<svg class="i-on" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>' +
              '<svg class="i-off" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor"/><path d="M16 9l6 6"/><path d="M22 9l-6 6"/></svg>' +
            '</button>' +
            '<button class="clipview-btn" type="button" data-cv-close aria-label="Close">' + x('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="clipview-tap" data-cv-tap aria-hidden="true"></div>' +
        '<div class="clipview-foot"><a class="btn btn-accent" href="/product?piece=set" data-cv-shop>Shop the set</a></div>' +
      '</div>' +
      '<button class="clipview-nav round-btn" type="button" data-cv-next aria-label="Next clip">' + x('<path d="M9 6l6 6-6 6"/>') + '</button>';
    document.body.appendChild(el);

    var sv = $('[data-cv-video]', el), bars = $('[data-cv-bars]', el), tag = $('[data-cv-tag]', el);
    var shop = $('[data-cv-shop]', el), sound = $('[data-cv-sound]', el), tap = $('[data-cv-tap]', el);
    var list = [], cur = 0, muted = false, lastFocus = null, raf = 0, fills = [];

    function paint() {
      var p = sv.duration ? Math.min(1, sv.currentTime / sv.duration) : 0;
      fills.forEach(function (f, k) { f.style.transform = 'scaleX(' + (k < cur ? 1 : k === cur ? p : 0) + ')'; });
      if (!el.hidden) raf = requestAnimationFrame(paint);
    }
    function setSound(m) {
      muted = m;
      sv.muted = m;
      el.classList.toggle('is-muted', m);
      sound.setAttribute('aria-label', m ? 'Turn sound on' : 'Mute');
    }
    function show(i) {
      cur = (i + list.length) % list.length;
      var c = list[cur];
      sv.poster = poster(c);
      sv.src = src(c);
      sv.muted = muted;
      tag.textContent = tagText(c) + ' · ' + (cur + 1) + '/' + list.length;
      shop.href = shopHref(c);
      shop.textContent = shopText(c);
      var p = sv.play();
      // Browsers can refuse sound without a fresh tap: play muted rather than not at all
      if (p && p.catch) p.catch(function () { if (!sv.muted) { setSound(true); sv.play().catch(function () {}); } });
      var nx = list[(cur + 1) % list.length];
      if (nx) { var pre = new Image(); pre.src = poster(nx); }
    }
    function open(clips, i) {
      list = clips;
      if (!list.length) return;
      lastFocus = document.activeElement;
      $$('video[data-clip-preview]').forEach(function (v) { v.pause(); });
      bars.innerHTML = list.map(function () { return '<span><i></i></span>'; }).join('');
      fills = $$('i', bars);
      el.hidden = false;
      document.documentElement.classList.add('modal-open');
      setSound(false);
      show(i || 0);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
      $('[data-cv-close]', el).focus();
    }
    function close() {
      if (el.hidden) return;
      sv.pause();
      sv.removeAttribute('src');
      sv.load();
      el.hidden = true;
      el.classList.remove('is-held');
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('modal-open');
      document.dispatchEvent(new CustomEvent('miche:clipview-closed'));
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    sv.addEventListener('ended', function () { if (cur === list.length - 1) close(); else show(cur + 1); });
    $('[data-cv-close]', el).addEventListener('click', close);
    $('[data-cv-prev]', el).addEventListener('click', function () { show(cur - 1); });
    $('[data-cv-next]', el).addEventListener('click', function () { show(cur + 1); });
    sound.addEventListener('click', function () { setSound(!muted); if (sv.paused) sv.play().catch(function () {}); });
    el.addEventListener('click', function (e) { if (e.target === el) close(); });

    // Tap left third = back, elsewhere = next. Press and hold = pause. Swipe sideways = skip, down = close.
    var press = null;
    tap.addEventListener('pointerdown', function (e) {
      press = { x: e.clientX, y: e.clientY, held: false };
      press.timer = setTimeout(function () {
        if (!press) return;
        press.held = true;
        sv.pause();
        el.classList.add('is-held');
      }, 220);
    });
    function release(e, cancelled) {
      if (!press) return;
      clearTimeout(press.timer);
      var p = press; press = null;
      el.classList.remove('is-held');
      var dy = e.clientY - p.y, dx = e.clientX - p.x;
      if (!cancelled && dy > 80 && Math.abs(dy) > Math.abs(dx)) { close(); return; }
      if (p.held || cancelled) { sv.play().catch(function () {}); return; }
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { show(cur + (dx < 0 ? 1 : -1)); return; }
      var r = tap.getBoundingClientRect();
      show(cur + (e.clientX - r.left < r.width / 3 ? -1 : 1));
    }
    tap.addEventListener('pointerup', function (e) { release(e, false); });
    tap.addEventListener('pointercancel', function (e) { release(e, true); });
    tap.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    document.addEventListener('keydown', function (e) {
      if (el.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(cur + 1);
      else if (e.key === 'ArrowLeft') show(cur - 1);
      else if (e.key === 'm' || e.key === 'M') setSound(!muted);
      else if (e.key === ' ' && (e.target === document.body || e.target === el)) { e.preventDefault(); if (sv.paused) sv.play().catch(function () {}); else sv.pause(); }
      else if (e.key === 'Tab') {
        // Keep focus inside the viewer
        var f = $$('button, a[href]', el).filter(function (b) { return b.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    V = { open: open, close: close, isOpen: function () { return !el.hidden; } };
    return V;
  }
  function openViewer(list, i) { buildViewer().open(list, i); }

  // ---------- A swipe row of clip cards ----------
  function Rail(section) {
    var rail = $('[data-clips-rail]', section);
    var prev = $('[data-clips-prev]', section), next = $('[data-clips-next]', section);
    var list = [], stops = [];

    function card(c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rcard ccard';
      b.setAttribute('aria-label', 'Play clip ' + (i + 1) + ' of ' + list.length + ', ' + tagText(c));
      var img = document.createElement('img');
      img.className = 'rcard-img';
      img.src = poster(c);
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      b.appendChild(img);
      var dots = c.color === 'both' ? ['neon', 'pink'] : [c.color];
      var tag = document.createElement('span');
      tag.className = 'ccard-tag';
      dots.forEach(function (d) {
        var dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.backgroundColor = swatchOf(d);
        tag.appendChild(dot);
      });
      var t = document.createElement('span');
      t.textContent = tagText(c);
      tag.appendChild(t);
      b.appendChild(tag);
      b.insertAdjacentHTML('beforeend', '<span class="rcard-play ccard-play" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg></span>');
      b.addEventListener('click', function () { openViewer(list, i); });

      if (previews) {
        var v = silentVideo(c, 'rcard-img ccard-video');
        v.setAttribute('data-clip-preview', '');
        v.addEventListener('playing', function () { b.classList.add('is-playing'); });
        b.insertBefore(v, img.nextSibling);
        stops.push(onView(b, function (isIn) {
          if (isIn && !(V && V.isOpen())) playSilent(v); else v.pause();
        }, 0.6));
      }
      return b;
    }

    function render(clips) {
      stops.forEach(function (s) { s(); });
      stops = [];
      list = clips;
      rail.innerHTML = '';
      list.forEach(function (c, i) { rail.appendChild(card(c, i)); });
      rail.scrollLeft = 0;
      sync();
    }

    var step = function () { var c = $('.ccard', rail); return c ? c.getBoundingClientRect().width + 16 : 260; };
    function sync() {
      if (!prev) return;
      prev.disabled = rail.scrollLeft < 8;
      next.disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 8;
    }
    if (prev) {
      prev.addEventListener('click', function () { rail.scrollBy({ left: -step() * 2, behavior: reduce ? 'auto' : 'smooth' }); });
      next.addEventListener('click', function () { rail.scrollBy({ left: step() * 2, behavior: reduce ? 'auto' : 'smooth' }); });
    }
    rail.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);

    // Drag to scroll with a mouse
    var drag = null;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') drag = { x: e.clientX, left: rail.scrollLeft, moved: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6) { drag.moved = true; rail.classList.add('is-dragging'); }
      rail.scrollLeft = drag.left - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      rail.classList.remove('is-dragging');
      if (moved) rail.addEventListener('click', function stop(ev) { ev.preventDefault(); ev.stopPropagation(); rail.removeEventListener('click', stop, true); }, true);
    });

    return { render: render };
  }

  // After the viewer closes, restart the previews that are on screen
  document.addEventListener('miche:clipview-closed', function () {
    $$('video[data-clip-preview]').forEach(function (v) {
      var r = v.getBoundingClientRect();
      if (r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight && v.src) v.play().catch(function () {});
    });
  });

  // ---------- Wire up every clips section on the page ----------
  $$('[data-clips-section]').forEach(function (section) {
    if (!ALL.length) { section.hidden = true; return; }
    section.hidden = false;
    var r = Rail(section);
    if (section.hasAttribute('data-clips-by-color')) {
      // Product page: follows the color picker
      var shown = null;
      var pick = function (color) {
        if (color === shown) return;
        shown = color;
        var clips = forColor(color);
        r.render(clips);
        var label = $('[data-clips-color]', section);
        if (label) label.textContent = colorName(color).toLowerCase();
      };
      document.addEventListener('miche:color', function (e) { pick(e.detail); });
      pick(section.getAttribute('data-start-color') || (new URLSearchParams(location.search).get('color')) || ((C.colorways || [])[0] || {}).id);
    } else {
      r.render(ALL);
    }
  });
  if (!ALL.length) $$('[data-clips-link]').forEach(function (el) { el.hidden = true; });

  window.MicheClips = { all: ALL, forColor: forColor, open: openViewer, silentVideo: silentVideo, playSilent: playSilent, previews: previews };
})();
