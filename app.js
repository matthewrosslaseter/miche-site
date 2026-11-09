(function () {
  'use strict';

  var C = window.MICHE_CONFIG || {};
  var PH = window.MICHE_PHOTOS || { photos: [], swatches: {} };
  var prices = C.prices || {};
  var variants = C.variants || {};
  var shop = (C.shopDomain || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ---------- Shoot photos + colorways ----------
  // Picks come from config.js, or from a preview picked at /photos on this device
  var shootPreview = null;
  try { shootPreview = JSON.parse(window.localStorage.getItem('miche_shoot_preview') || 'null'); } catch (e) { shootPreview = null; }

  var COLORS = (C.colorways && C.colorways.length ? C.colorways : [{ id: 'neon', name: 'Neon' }, { id: 'pink', name: 'Pink' }]);
  var colorById = {};
  COLORS.forEach(function (c) { colorById[c.id] = c; });
  var FALLBACK_SWATCH = { neon: '#D4FF00', pink: '#EB93AD' };
  function swatchOf(id) {
    var c = colorById[id] || {};
    return c.swatch || (PH.swatches || {})[id] || FALLBACK_SWATCH[id] || '#888888';
  }

  var overrides = {};
  Object.keys(C.colorOverrides || {}).forEach(function (k) { overrides[k] = C.colorOverrides[k]; });
  if (shootPreview && shootPreview._colors) Object.keys(shootPreview._colors).forEach(function (k) { overrides[k] = shootPreview._colors[k]; });

  var allPhotos = (PH.photos || []).map(function (p) {
    var color = overrides[p.name] !== undefined ? overrides[p.name] : p.color;
    return { name: p.name, color: colorById[color] ? color : '' };
  });
  var photoByName = {};
  allPhotos.forEach(function (p) { photoByName[p.name] = p; });

  var shoot = {};
  Object.keys(C.shoot || {}).forEach(function (k) { shoot[k] = C.shoot[k]; });
  var colorPicks = {};
  COLORS.forEach(function (c) { colorPicks[c.id] = ((C.colorPhotos || {})[c.id] || []).slice(); });
  if (shootPreview) {
    Object.keys(shootPreview).forEach(function (k) {
      if (k === '_colors' || !shootPreview[k]) return;
      var m = /^([a-z]+)(\d)$/.exec(k);
      if (m && colorById[m[1]]) colorPicks[m[1]][Number(m[2]) - 1] = shootPreview[k];
      else shoot[k] = shootPreview[k];
    });
  }

  function shootSrc(name, thumb) {
    return name ? '/images/shoot/' + (thumb ? 'thumb/' : '') + encodeURIComponent(name) + '.jpg' : '';
  }

  // Photos for one color: its picks first, then others of that color spread across the shoot
  function galleryFor(colorId) {
    var limit = Math.max(1, Number(C.galleryLimit) || 12);
    var picks = [];
    colorPicks[colorId].forEach(function (n) {
      var p = photoByName[n];
      if (p && p.color === colorId && picks.indexOf(n) < 0) picks.push(n);
    });
    var rest = allPhotos.filter(function (p) { return p.color === colorId && picks.indexOf(p.name) < 0; })
      .map(function (p) { return p.name; });
    var need = Math.min(rest.length, limit - picks.length);
    var spread = [];
    for (var i = 0; i < need; i++) {
      var idx = need === 1 ? 0 : Math.round(i * (rest.length - 1) / (need - 1));
      if (spread.indexOf(rest[idx]) < 0) spread.push(rest[idx]);
    }
    return picks.concat(spread).slice(0, limit);
  }

  // Swatch dots anywhere on the site
  $$('[data-swatch]').forEach(function (el) { el.style.backgroundColor = swatchOf(el.getAttribute('data-swatch')); });

  // Footer year
  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  // Prices from config
  $$('[data-price]').forEach(function (el) {
    var p = prices[el.getAttribute('data-price')];
    if (p) el.textContent = p;
  });

  // Home cards for single pieces open in the color their photo shows
  $$('[data-color-link]').forEach(function (a) {
    var p = photoByName[shoot[a.getAttribute('data-color-link')]];
    if (p && p.color) a.setAttribute('href', a.getAttribute('href') + '&color=' + p.color);
  });

  // Swap striped placeholders for shoot photos
  $$('[data-role]').forEach(function (el) {
    var name = shoot[el.getAttribute('data-role')];
    if (!name) return;
    var img = document.createElement('img');
    var ratio = (el.className.match(/r-\d+/) || [''])[0];
    img.className = 'photo ' + ratio;
    img.src = shootSrc(name);
    img.alt = el.getAttribute('data-alt') || 'Miche fitted set';
    img.decoding = 'async';
    if (el.getAttribute('data-role') !== 'hero') img.loading = 'lazy';
    el.parentNode.replaceChild(img, el);
  });

  // Hide the "In the wild" row until at least one of its photos is picked
  var wild = $('.wild');
  if (wild && !shoot.wild1 && !shoot.wild2 && !shoot.wild3) {
    var wildSection = wild.closest('section');
    if (wildSection) wildSection.hidden = true;
  }

  // Let Matt know he's looking at his own photo preview, with a way out
  if (shootPreview) {
    var pill = document.createElement('div');
    pill.className = 'preview-pill';
    pill.innerHTML = '<span>Showing your photo picks</span> <a href="/photos">Edit</a> <button type="button">Clear</button>';
    pill.querySelector('button').addEventListener('click', function () {
      try { window.localStorage.removeItem('miche_shoot_preview'); } catch (e) { /* ignore */ }
      window.location.reload();
    });
    document.body.appendChild(pill);
  }

  // Bag link → Shopify cart once the store is connected
  $$('[data-cart-link]').forEach(function (el) {
    el.setAttribute('href', shop ? 'https://' + shop + '/cart' : '/#shop');
  });

  // Email signup
  $$('[data-signup]').forEach(function (form) {
    var input = $('input[type="email"]', form);
    var button = $('button[type="submit"]', form);
    var msg = $('.form-msg', form);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.textContent = 'Enter a valid email.';
        input.focus();
        return;
      }
      var signup = window.MicheSignup;
      if (!signup || !signup.ready()) {
        msg.textContent = "Signups aren't open yet. Check back soon.";
        return;
      }
      button.disabled = true;
      msg.textContent = 'Sending…';
      signup.subscribe({ email: email, source: 'Website: drop alerts form' }).then(function () {
        msg.textContent = "You're on the list.";
        form.reset();
      }).catch(function () {
        msg.textContent = 'Something went wrong. Try again.';
      }).then(function () {
        button.disabled = false;
      });
    });
  });

  // ---------- Product page ----------
  var product = $('[data-product]');
  if (!product) return;

  var PIECES = {
    set: { name: 'The Fitted Set' },
    hoodie: { name: 'The Cropped Zip-Up' },
    pants: { name: 'The Flare Pants' }
  };

  // Single-page builds route by hash (#product-hoodie) instead of ?piece=hoodie
  var hashRouting = document.documentElement.hasAttribute('data-hash-routing');
  var params = new URLSearchParams(window.location.search);
  var hashPiece = (/^#product-(\w+)$/.exec(window.location.hash) || [])[1];
  var startPiece = PIECES[params.get('piece')] ? params.get('piece') : (PIECES[hashPiece] ? hashPiece : 'set');
  var startColor = colorById[params.get('color')] ? params.get('color') : COLORS[0].id;
  var state = {
    piece: startPiece,
    color: startColor,
    size: '',
    qty: 1,
    view: 0,
    gallery: []
  };

  var mainPhoto = $('#main-photo');
  var thumbsEl = $('[data-thumbs]');
  var countEl = $('[data-gal-count]');
  var notice = $('[data-notice]');

  function setPressed(buttons, isOn) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', isOn(b) ? 'true' : 'false'); });
  }

  function syncUrl() {
    if (hashRouting) {
      window.history.replaceState(null, '', '#product-' + state.piece);
      return;
    }
    var url = new URL(window.location.href);
    url.searchParams.set('piece', state.piece);
    url.searchParams.set('color', state.color);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  function renderPhoto() {
    var name = state.gallery[state.view];
    var colorName = (colorById[state.color] || {}).name || '';
    mainPhoto.innerHTML = '';
    if (name) {
      mainPhoto.className = 'main-photo r-45';
      var img = document.createElement('img');
      img.className = 'photo r-45';
      img.src = shootSrc(name);
      img.alt = PIECES[state.piece].name + ' in ' + colorName.toLowerCase() + ', photo ' + (state.view + 1) + ' of ' + state.gallery.length;
      img.decoding = 'async';
      mainPhoto.appendChild(img);
      // Warm up the next photo so swiping feels instant
      var next = state.gallery[state.view + 1];
      if (next) { var pre = new Image(); pre.src = shootSrc(next); }
    } else {
      mainPhoto.className = 'ph r-45';
      var b = document.createElement('b');
      b.textContent = colorName + ' photos';
      var s = document.createElement('span');
      s.textContent = 'Coming soon';
      mainPhoto.appendChild(b);
      mainPhoto.appendChild(s);
    }
    var many = state.gallery.length > 1;
    $$('[data-gal]').forEach(function (btn) { btn.hidden = !many; });
    countEl.hidden = !many;
    countEl.textContent = (state.view + 1) + ' / ' + state.gallery.length;
    $$('.thumb', thumbsEl).forEach(function (btn, i) {
      btn.setAttribute('aria-pressed', i === state.view ? 'true' : 'false');
      if (i === state.view && btn.scrollIntoView && thumbsEl.scrollWidth > thumbsEl.clientWidth) {
        var left = btn.offsetLeft - (thumbsEl.clientWidth - btn.clientWidth) / 2;
        thumbsEl.scrollTo({ left: left, behavior: 'smooth' });
      }
    });
  }

  function renderGallery() {
    state.gallery = galleryFor(state.color);
    state.view = 0;
    thumbsEl.innerHTML = '';
    var colorName = ((colorById[state.color] || {}).name || '').toLowerCase();
    state.gallery.forEach(function (name, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'thumb';
      btn.setAttribute('aria-label', 'Show ' + colorName + ' photo ' + (i + 1));
      var img = document.createElement('img');
      img.src = shootSrc(name, true);
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      btn.appendChild(img);
      btn.addEventListener('click', function () { state.view = i; renderPhoto(); });
      thumbsEl.appendChild(btn);
    });
    thumbsEl.hidden = state.gallery.length < 2;
    thumbsEl.scrollLeft = 0;
    renderPhoto();
  }

  function render() {
    var name = PIECES[state.piece].name;
    var colorName = (colorById[state.color] || {}).name || '';
    $$('[data-name]').forEach(function (el) { el.textContent = name; });
    $$('[data-color-name]').forEach(function (el) { el.textContent = colorName; });
    $('[data-current-price]').textContent = prices[state.piece] || '';
    $('[data-size-label]').textContent = state.size || 'Select';
    $('[data-qty-value]').textContent = String(state.qty);
    setPressed($$('[data-piece]'), function (b) { return b.getAttribute('data-piece') === state.piece; });
    setPressed($$('[data-color]'), function (b) { return b.getAttribute('data-color') === state.color; });
    setPressed($$('[data-size]'), function (b) { return b.getAttribute('data-size') === state.size; });
    if (!hashRouting) document.title = name + ' in ' + colorName + ' — Miche';
  }

  window.MicheProduct = {
    setPiece: function (p) {
      if (!PIECES[p] || p === state.piece) return;
      state.piece = p;
      notice.textContent = '';
      render();
    }
  };

  function step(dir) {
    if (state.gallery.length < 2) return;
    state.view = (state.view + dir + state.gallery.length) % state.gallery.length;
    renderPhoto();
  }
  $$('[data-gal]').forEach(function (btn) {
    btn.addEventListener('click', function () { step(Number(btn.getAttribute('data-gal'))); });
  });

  // Swipe the main photo on phones
  var touchX = null, touchY = null;
  mainPhoto.addEventListener('touchstart', function (e) {
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
  }, { passive: true });
  mainPhoto.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX, dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  $$('[data-color]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var c = btn.getAttribute('data-color');
      if (!colorById[c] || c === state.color) return;
      state.color = c;
      notice.textContent = '';
      syncUrl();
      render();
      renderGallery();
      // On phones the photos sit above the buttons: bring them into view so the color change is visible
      var wrap = $('.main-wrap');
      if (wrap && wrap.getBoundingClientRect().bottom < window.innerHeight * 0.35) {
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        wrap.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    });
  });

  $$('[data-piece]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.piece = btn.getAttribute('data-piece');
      notice.textContent = '';
      syncUrl();
      render();
    });
  });

  $$('[data-size]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.size = btn.getAttribute('data-size');
      notice.textContent = '';
      render();
    });
  });

  $$('[data-qty]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.qty = Math.min(10, Math.max(1, state.qty + Number(btn.getAttribute('data-qty'))));
      render();
    });
  });

  $('[data-buy]').addEventListener('click', function () {
    if (!state.size) {
      notice.textContent = 'Pick a size first.';
      return;
    }
    var id = (((variants[state.color] || {})[state.piece]) || {})[state.size];
    if (shop && id) {
      // Shopify cart permalink: goes straight to checkout with this color, size and quantity,
      // plus the popup discount code if this visitor won one.
      var url = 'https://' + shop + '/cart/' + encodeURIComponent(id) + ':' + state.qty;
      var prize = null;
      try { prize = JSON.parse(window.localStorage.getItem('miche_prize') || 'null'); } catch (e) { prize = null; }
      if (prize && prize.code) url += '?discount=' + encodeURIComponent(prize.code);
      window.location.href = url;
      return;
    }
    notice.textContent = "Checkout isn't open yet. Join the drop list to hear first.";
  });

  render();
  renderGallery();
})();
