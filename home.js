/*
  Home page interactions: header, menu, hero film, color stage, product cards,
  film player, sticky details, story word reveal, swipe row, scroll reveals.
  Photo data comes from app.js (window.MicheData).
*/
(function () {
  'use strict';

  var D = window.MicheData;
  if (!D || !document.body.classList.contains('home')) return;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var mm = function (q) { return window.matchMedia ? window.matchMedia(q).matches : false; };
  var reduce = mm('(prefers-reduced-motion: reduce)');
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var film = D.film;
  var colorName = function (id) { return ((D.colorById[id] || {}).name) || id; };

  function img(name, alt, opts) {
    var el = document.createElement('img');
    el.src = D.shootSrc(name, opts && opts.thumb);
    el.alt = alt || '';
    el.decoding = 'async';
    if (!opts || !opts.eager) el.loading = 'lazy';
    if (opts && opts.className) el.className = opts.className;
    return el;
  }

  // Swap photos without a dark dip: the outgoing photo stays fully visible underneath while the new one fades in on top
  function crossfade(els, isOn) {
    els.forEach(function (el, k) {
      var on = isOn(el, k);
      if (on) { el.classList.remove('is-prev'); el.classList.add('is-on'); }
      else if (el.classList.contains('is-on')) { el.classList.remove('is-on'); el.classList.add('is-prev'); }
      else el.classList.remove('is-prev');
    });
  }

  function onView(el, fn, options) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(true); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { fn(e.isIntersecting, e); });
    }, options || { threshold: 0.2 }).observe(el);
  }

  // ---------- Header: turns into a floating pill once you scroll ----------
  var header = $('[data-header]');
  var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 40); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Menu (phones) ----------
  var menu = $('[data-menu]');
  var menuBtn = $('[data-menu-btn]');
  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.documentElement.classList.toggle('menu-open', open);
  }
  menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });

  // "Get 10% off" buttons open the scratch card (popup.js handles the click); close the menu first
  $$('[data-open-offer]').forEach(function (b) {
    b.addEventListener('click', function () { setMenu(false); });
  });

  // ---------- The film: wide version on landscape screens, tall on phones ----------
  var wide = function () { return mm('(min-width: 760px) and (min-aspect-ratio: 1/1)'); };
  var filmSrc = function () { return film ? (wide() ? film.wide : film.tall) : ''; };
  var filmPoster = function () { return film ? (wide() ? film.posterWide : film.posterTall) : ''; };

  if (!film) {
    $$('[data-play-film], [data-film-link]').forEach(function (el) { el.hidden = true; });
  } else {
    $$('[data-play-film]').forEach(function (el) { el.hidden = false; });
    var fs = $('[data-film-section]');
    if (fs) fs.hidden = false;
  }

  // Background film (hero + closer): muted loop, plays only while on screen, with a pause button
  function backgroundFilm(video, toggle) {
    if (!film || !video) return;
    var card = video.parentNode;
    video.poster = filmPoster();
    var userPaused = reduce || saveData;
    var visible = false;
    var started = false;
    function sync() {
      if (toggle) {
        toggle.classList.toggle('is-paused', video.paused);
        toggle.setAttribute('aria-label', video.paused ? 'Play background video' : 'Pause background video');
      }
    }
    function play() {
      if (userPaused || !visible) return;
      if (!started) { video.src = filmSrc(); started = true; }
      var p = video.play();
      if (p && p.catch) p.catch(function () { sync(); });
    }
    video.addEventListener('playing', function () { card.classList.add('is-playing'); sync(); });
    video.addEventListener('pause', sync);
    if (toggle) {
      toggle.hidden = false;
      toggle.addEventListener('click', function () {
        if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); }
        sync();
      });
    }
    onView(card, function (isIn) {
      visible = isIn;
      if (isIn) play(); else if (!video.paused) video.pause();
    }, { threshold: 0.15 });
    sync();
  }
  backgroundFilm($('[data-hero-video]'), $('[data-hero-toggle]'));
  backgroundFilm($('[data-closer-video]'), null);

  // ---------- Film player (inline section + full-screen modal) ----------
  function fmt(t) {
    if (!isFinite(t)) return '0:00';
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function Player(root) {
    var v = $('[data-player-video]', root);
    var toggle = $('[data-player-toggle]', root);
    var big = $('[data-player-big]', root);
    var seek = $('[data-player-seek]', root);
    var time = $('[data-player-time]', root);
    var full = $('[data-player-full]', root);
    var loaded = false;
    v.loop = true;
    v.poster = filmPoster();
    root.classList.toggle('is-tall', !wide());
    function load() { if (!loaded) { v.src = filmSrc(); loaded = true; } }
    function play() { load(); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    function pause() { v.pause(); }
    function sync() {
      root.classList.toggle('is-playing', !v.paused);
      toggle.setAttribute('aria-label', v.paused ? 'Play' : 'Pause');
    }
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    v.addEventListener('timeupdate', function () {
      if (v.duration) seek.value = String(Math.round((v.currentTime / v.duration) * 1000));
      time.textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration);
    });
    v.addEventListener('loadedmetadata', function () { time.textContent = '0:00 / ' + fmt(v.duration); });
    seek.addEventListener('input', function () {
      load();
      if (v.duration) v.currentTime = (Number(seek.value) / 1000) * v.duration;
    });
    toggle.addEventListener('click', function () { if (v.paused) play(); else pause(); });
    big.addEventListener('click', play);
    v.addEventListener('click', function () { if (v.paused) play(); else pause(); });
    full.addEventListener('click', function () {
      load();
      if (root.requestFullscreen) root.requestFullscreen().catch(function () {});
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    });
    return { play: play, pause: pause };
  }

  var inline = film && $('[data-player="inline"]') ? Player($('[data-player="inline"]')) : null;
  var modal = $('[data-film-modal]');
  var modalPlayer = film && modal ? Player($('[data-player="modal"]', modal)) : null;
  var lastFocus = null;
  function openFilm() {
    if (!modalPlayer) return;
    if (inline) inline.pause();
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.documentElement.classList.add('modal-open');
    $('[data-film-close]', modal).focus();
    modalPlayer.play();
  }
  function closeFilm() {
    if (modal.hidden) return;
    modalPlayer.pause();
    modal.hidden = true;
    document.documentElement.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('[data-play-film]').forEach(function (b) { b.addEventListener('click', openFilm); });
  if (modal) {
    $('[data-film-close]', modal).addEventListener('click', closeFilm);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeFilm(); });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (modal && !modal.hidden) closeFilm();
    else if (!menu.hidden) setMenu(false);
  });

  // ---------- Color stage: tabs swap the color, numbered slides auto-advance ----------
  var stage = $('[data-colors]');
  if (stage) {
    var media = $('[data-stage-media]', stage);
    var steps = $('[data-stage-steps]', stage);
    var shopLink = $('[data-stage-shop]', stage);
    var current = { color: D.colors[0].id, idx: 0, count: 0 };
    var STEP_LABELS = ['Rhinestone Miche script', 'Cropped, full zip', 'High waist, flared leg', 'Heavyweight, 250–300 GSM'];
    var paused = false;

    var token = 0;
    function show(i) {
      current.idx = i;
      var list = $$('.stage-slide:not(.is-leaving)', media);
      var mine = ++token;
      var go = function () {
        if (mine !== token) return;
        crossfade(list, function (s, k) { return k === i; });
        // The last color's photo sits underneath until the new one has faded in, then it goes
        setTimeout(function () { if (mine === token) $$('.is-leaving', media).forEach(function (el) { el.remove(); }); }, 1100);
      };
      // Wait for the incoming photo to load so it fades in rather than popping in
      var target = list[i];
      if (target && target.decode && !target.complete) target.decode().then(go, go); else go();
      $$('.step', steps).forEach(function (s, k) {
        s.classList.toggle('is-on', k === i);
        s.classList.toggle('is-done', k < i);
        var b = $('button', s);
        if (b) b.setAttribute('aria-current', k === i ? 'true' : 'false');
      });
    }
    function next() { if (current.count) show((current.idx + 1) % current.count); }

    function setColor(id) {
      current.color = id;
      var name = colorName(id);
      stage.style.setProperty('--tone', D.swatchOf(id));
      $$('[data-color-tab]', stage).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-color-tab') === id ? 'true' : 'false'); });
      $('[data-stage-name]', stage).textContent = name;
      $('[data-stage-dot]', stage).style.backgroundColor = D.swatchOf(id);
      shopLink.href = '/product?piece=set&color=' + id;
      shopLink.textContent = 'Shop the ' + name.toLowerCase() + ' set';

      var pics = D.galleryFor(id).slice(0, 4);
      current.count = pics.length;
      // Keep the photo that's showing now, so the new color dissolves in over it
      var leaving = $('.stage-slide.is-on', media) || $('.stage-slide.is-prev', media);
      $$('.stage-slide', media).forEach(function (el) { if (el !== leaving) el.remove(); });
      if (leaving) { leaving.classList.remove('is-on'); leaving.classList.add('is-prev', 'is-leaving'); }
      steps.innerHTML = '';
      if (!pics.length) {
        media.insertAdjacentHTML('beforeend', '<div class="ph stage-slide is-on"><b>' + name + ' photos</b></div>');
        return;
      }
      pics.forEach(function (n, i) {
        var slide = img(n, 'The Fitted Set in ' + name.toLowerCase() + ', photo ' + (i + 1) + ' of ' + pics.length, { className: 'stage-slide', eager: i === 0 });
        media.appendChild(slide);
        var li = document.createElement('li');
        li.className = 'step';
        var b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<span class="step-num">0' + (i + 1) + '</span><span class="step-text">' + STEP_LABELS[i % STEP_LABELS.length] + '</span><span class="step-bar"><span></span></span>';
        b.setAttribute('aria-label', 'Show photo ' + (i + 1) + ': ' + STEP_LABELS[i % STEP_LABELS.length]);
        b.addEventListener('click', function () { show(i); });
        li.appendChild(b);
        steps.appendChild(li);
        $('.step-bar span', li).addEventListener('animationend', function () { if (!reduce) next(); });
      });
      void media.offsetWidth; // new photos start see-through, so the switch below animates
      show(0);
    }

    $$('[data-color-tab]', stage).forEach(function (b) {
      b.addEventListener('click', function () { setColor(b.getAttribute('data-color-tab')); });
    });
    // Pause the slideshow while it's off screen, or while you're hovering it
    onView(stage, function (isIn) { stage.classList.toggle('is-paused', !isIn || paused); }, { threshold: 0.25 });
    stage.addEventListener('mouseenter', function () { paused = true; stage.classList.add('is-paused'); });
    stage.addEventListener('mouseleave', function () { paused = false; stage.classList.remove('is-paused'); });
    setColor(current.color);
  }

  // ---------- Product cards: color dots swap the photo ----------
  var ROLE = { set: { neon: 'setNeon', pink: 'setPink' }, hoodie: { neon: 'zipup', pink: 'zipupPink' }, pants: { neon: 'pants', pink: 'pantsPink' } };
  var FALLBACK_INDEX = { set: 0, hoodie: 1, pants: 2 };
  var used = {};
  function cardPhoto(piece, color) {
    var name = D.shoot[(ROLE[piece] || {})[color]];
    var p = name && D.photoByName[name];
    if (p && p.color === color) { used[name] = true; return name; }
    var g = D.galleryFor(color).filter(function (n) { return !used[n]; });
    var pickName = g[FALLBACK_INDEX[piece] % Math.max(1, g.length)] || '';
    if (pickName) used[pickName] = true;
    return pickName;
  }
  $$('[data-pcard]').forEach(function (card) {
    var piece = card.getAttribute('data-pcard');
    var mediaEl = $('.pcard-media', card);
    var link = $('[data-pcard-link]', card);
    var title = $('h3', card).textContent;
    var layers = {};
    D.colors.forEach(function (c) {
      var n = cardPhoto(piece, c.id);
      if (!n) return;
      var el = img(n, title + ' in ' + c.name.toLowerCase(), { className: 'pcard-img' });
      el.setAttribute('data-color', c.id);
      mediaEl.appendChild(el);
      layers[c.id] = el;
    });
    if (!Object.keys(layers).length) mediaEl.insertAdjacentHTML('beforeend', '<div class="ph pcard-img is-on"><b>Photo</b></div>');
    function setColor(id) {
      crossfade(Object.keys(layers).map(function (k) { return layers[k]; }), function (el) { return el === layers[id]; });
      $$('[data-pcard-color]', card).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-pcard-color') === id ? 'true' : 'false'); });
      link.href = '/product?piece=' + piece + '&color=' + id;
    }
    $$('[data-pcard-color]', card).forEach(function (b) {
      var id = b.getAttribute('data-pcard-color');
      b.addEventListener('click', function () { setColor(id); });
      b.addEventListener('mouseenter', function () { setColor(id); });
    });
    setColor(D.colors[0].id);
  });

  // ---------- Details: sticky photo swaps as each detail scrolls past ----------
  var scrolly = $('[data-scrolly]');
  if (scrolly) {
    var defaults = [D.shoot.macro, D.galleryFor('neon')[1], D.galleryFor('pink')[0], D.galleryFor('neon')[2]];
    var picks = (D.config.detailPhotos || []).map(function (n, i) { return D.photoByName[n] ? n : defaults[i]; });
    var stickyMedia = $('[data-scrolly-media]', scrolly);
    var stepsEls = $$('[data-scrolly-step]', scrolly);
    stepsEls.forEach(function (stepEl, i) {
      var n = picks[i] || defaults[i];
      var title = $('h3', stepEl).textContent;
      if (!n) return;
      var big = img(n, '', { className: 'scrolly-img' });
      stickyMedia.appendChild(big);
      $('[data-scrolly-inline]', stepEl).appendChild(img(n, title, { className: 'scrolly-inline-img' }));
    });
    function activate(i) {
      crossfade($$('.scrolly-img', stickyMedia), function (el, k) { return k === i; });
      stepsEls.forEach(function (el, k) { el.classList.toggle('is-on', k === i); });
    }
    activate(0);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) activate(Number(e.target.getAttribute('data-scrolly-step'))); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      stepsEls.forEach(function (el) { io.observe(el); });
    }
  }

  // ---------- Story: words light up as you scroll through ----------
  var words = $('[data-words]');
  if (words) {
    var text = words.textContent.trim();
    words.setAttribute('aria-label', text);
    words.textContent = '';
    var spans = text.split(/\s+/).map(function (w, i, all) {
      var s = document.createElement('span');
      s.className = 'w';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w + (i < all.length - 1 ? ' ' : '');
      words.appendChild(s);
      return s;
    });
    if (reduce) {
      spans.forEach(function (s) { s.classList.add('is-lit'); });
    } else {
      var ticking = false;
      var paint = function () {
        ticking = false;
        var r = words.getBoundingClientRect();
        var vh = window.innerHeight;
        var p = Math.min(1, Math.max(0, (vh * 0.8 - r.top) / (r.height + vh * 0.3)));
        var lit = Math.round(p * spans.length);
        spans.forEach(function (s, i) { s.classList.toggle('is-lit', i < lit); });
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
      paint();
    }
  }

  // ---------- Scroll progress: a thin neon line across the top ----------
  var bar = $('[data-progress]');
  if (bar) {
    var ticking = false;
    var paint = function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ')';
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }

  // ---------- Lurk mode: photos hiding in the dark, a spotlight follows your cursor or finger ----------
  var lurk = $('[data-lurk]');
  if (lurk) {
    var lgrid = $('[data-lurk-grid]', lurk);
    var lurkPics = (function () {
      // Start past the photos the color slideshow uses, so these feel like a find
      var from = function (list) { return list.length >= 10 ? list.slice(4) : list; };
      var n = from(D.galleryFor('neon')), p = from(D.galleryFor('pink')), out = [];
      for (var i = 0; out.length < 12 && (i < n.length || i < p.length); i++) {
        if (n[i]) out.push(n[i]);
        if (p[i] && out.length < 12) out.push(p[i]);
      }
      return out;
    })();
    if (!lurkPics.length) {
      lurk.parentNode.hidden = true;
    } else {
      lurkPics.forEach(function (name) { lgrid.appendChild(img(name, '', { thumb: true })); });
      $('[data-lurk-hint]', lurk).textContent = mm('(hover: none)') ? 'Drag your finger around' : 'Move your cursor around';

      var COLS = 8, ROWS = 5, GOAL = Math.round(COLS * ROWS * 0.4);
      var seen = new Uint8Array(COLS * ROWS), seenCount = 0;
      var meter = $('[data-lurk-meter]', lurk), foundCard = $('[data-lurk-found]', lurk);
      var cur = { x: 0.5, y: 0.45 }, aimAt = { x: 0.5, y: 0.45 };
      var radius = 160, lastUser = -1e9, t0 = performance.now();
      var running = false, done = false, lurkInView = false;

      var size = function () {
        var b = lurk.getBoundingClientRect();
        radius = Math.max(110, Math.min(230, Math.min(b.width, b.height) * 0.27));
        if (!done) lurk.style.setProperty('--r', radius + 'px');
      };
      var mark = function (x, y) {
        var b = lurk.getBoundingClientRect(), reach = radius * 0.7;
        for (var row = 0; row < ROWS; row++) {
          for (var col = 0; col < COLS; col++) {
            var k = row * COLS + col;
            if (seen[k]) continue;
            var dx = ((col + 0.5) / COLS - x) * b.width, dy = ((row + 0.5) / ROWS - y) * b.height;
            if (dx * dx + dy * dy < reach * reach) { seen[k] = 1; seenCount++; }
          }
        }
        meter.style.width = Math.min(100, Math.round((seenCount / GOAL) * 100)) + '%';
        if (seenCount >= GOAL) reveal();
      };
      var aim = function (cx, cy) {
        var b = lurk.getBoundingClientRect();
        aimAt.x = Math.max(0, Math.min(1, (cx - b.left) / b.width));
        aimAt.y = Math.max(0, Math.min(1, (cy - b.top) / b.height));
        lastUser = performance.now();
        lurk.classList.add('is-touched');
        go();
      };
      var frame = function (now) {
        if (!lurkInView || done) { running = false; return; }
        var idle = now - lastUser > 2200;
        if (idle && !reduce) {
          // Drift on its own until someone takes over, so phones see it moving right away
          var t = (now - t0) / 1000;
          aimAt.x = 0.5 + 0.34 * Math.sin(t * 0.43);
          aimAt.y = 0.5 + 0.28 * Math.sin(t * 0.71 + 1.3);
        }
        var ease = reduce ? 1 : (idle ? 0.035 : 0.2);
        cur.x += (aimAt.x - cur.x) * ease;
        cur.y += (aimAt.y - cur.y) * ease;
        lurk.style.setProperty('--x', (cur.x * 100).toFixed(2) + '%');
        lurk.style.setProperty('--y', (cur.y * 100).toFixed(2) + '%');
        if (!idle) mark(cur.x, cur.y);
        if (reduce && idle) { running = false; return; }
        requestAnimationFrame(frame);
      };
      var go = function () {
        if (!running && lurkInView && !done) { running = true; requestAnimationFrame(frame); }
      };
      var reveal = function () {
        if (done) return;
        done = true;
        lurk.classList.add('is-found');
        var b = lurk.getBoundingClientRect();
        var from = radius, to = Math.hypot(b.width, b.height) * 1.1, s = performance.now();
        var grow = function (now) {
          var p = reduce ? 1 : Math.min(1, (now - s) / 1200);
          lurk.style.setProperty('--r', (from + (to - from) * (1 - Math.pow(1 - p, 3))).toFixed(1) + 'px');
          if (p < 1) requestAnimationFrame(grow);
        };
        requestAnimationFrame(grow);
        foundCard.hidden = false;
      };

      lurk.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') aim(e.clientX, e.clientY); });
      lurk.addEventListener('pointerdown', function (e) { aim(e.clientX, e.clientY); });
      ['touchstart', 'touchmove'].forEach(function (type) {
        lurk.addEventListener(type, function (e) { var t = e.touches[0]; if (t) aim(t.clientX, t.clientY); }, { passive: true });
      });
      $('[data-lurk-skip]', lurk).addEventListener('click', reveal);
      window.addEventListener('resize', size);
      size();
      onView(lurk, function (isIn) { lurkInView = isIn; if (isIn) go(); }, { threshold: 0.15 });
    }
  }

  // ---------- Swipe row ----------
  var rail = $('[data-rail]');
  if (rail) {
    $$('[data-rail-photo]', rail).forEach(function (card) {
      var spec = card.getAttribute('data-rail-photo');
      var el;
      if (spec === 'film') {
        if (!film) return;
        el = document.createElement('img');
        el.src = film.posterTall;
        el.alt = '';
        el.loading = 'lazy';
        el.className = 'rcard-img';
      } else {
        var parts = spec.split(':');
        var g = D.galleryFor(parts[0]);
        var n = g[Number(parts[1]) % Math.max(1, g.length)];
        if (!n) return;
        el = img(n, '', { className: 'rcard-img' });
      }
      card.insertBefore(el, card.firstChild);
    });
    var stepSize = function () {
      var c = $('.rcard:not([hidden])', rail);
      return c ? c.getBoundingClientRect().width + 16 : 300;
    };
    var prev = $('[data-rail-prev]');
    var nextBtn = $('[data-rail-next]');
    var smooth = reduce ? 'auto' : 'smooth';
    prev.addEventListener('click', function () { rail.scrollBy({ left: -stepSize(), behavior: smooth }); });
    nextBtn.addEventListener('click', function () { rail.scrollBy({ left: stepSize(), behavior: smooth }); });
    var syncArrows = function () {
      prev.disabled = rail.scrollLeft < 8;
      nextBtn.disabled = rail.scrollLeft + rail.clientWidth > rail.scrollWidth - 8;
    };
    rail.addEventListener('scroll', syncArrows, { passive: true });
    window.addEventListener('resize', syncArrows);
    // The film card was hidden until the script knew there's a film; snap back to the first card
    var toStart = function () { rail.scrollLeft = 0; syncArrows(); };
    toStart();
    requestAnimationFrame(toStart);
    // Drag to scroll with a mouse
    var drag = null;
    rail.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      drag = { x: e.clientX, left: rail.scrollLeft, moved: false };
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
  }

  // ---------- Reveal sections as they scroll in ----------
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-rv');
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    $$('.rv').forEach(function (el) { rio.observe(el); });
  }
})();
