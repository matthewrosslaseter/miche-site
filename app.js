(function () {
  'use strict';

  var C = window.MICHE_CONFIG || {};
  var prices = C.prices || {};
  var variants = C.variants || {};
  var photos = C.photos || [];
  var shop = (C.shopDomain || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // Footer year
  $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  // Prices from config
  $$('[data-price]').forEach(function (el) {
    var p = prices[el.getAttribute('data-price')];
    if (p) el.textContent = p;
  });

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
      if (!C.signupEndpoint) {
        msg.textContent = "Signups aren't open yet. Check back soon.";
        return;
      }
      button.disabled = true;
      msg.textContent = 'Sending…';
      fetch(C.signupEndpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      }).then(function (res) {
        if (!res.ok) throw new Error('Signup failed');
        msg.textContent = "You're on the list.";
        form.reset();
      }).catch(function () {
        msg.textContent = 'Something went wrong. Try again.';
      }).then(function () {
        button.disabled = false;
      });
    });
  });

  // Product page
  var product = $('[data-product]');
  if (!product) return;

  var PIECES = {
    set: { name: 'The Volt Set' },
    hoodie: { name: 'The Volt Zip-Up' },
    pants: { name: 'The Volt Flare Pants' }
  };

  // Single-page builds route by hash (#product-hoodie) instead of ?piece=hoodie
  var hashRouting = document.documentElement.hasAttribute('data-hash-routing');
  var params = new URLSearchParams(window.location.search);
  var hashPiece = (/^#product-(\w+)$/.exec(window.location.hash) || [])[1];
  var startPiece = PIECES[params.get('piece')] ? params.get('piece') : (PIECES[hashPiece] ? hashPiece : 'set');
  var state = {
    piece: startPiece,
    size: '',
    qty: 1,
    view: 0
  };

  var mainPhoto = $('#main-photo');
  var notice = $('[data-notice]');

  function setPressed(buttons, isOn) {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', isOn(b) ? 'true' : 'false'); });
  }

  function renderPhoto() {
    var v = photos[state.view] || { label: 'Photo', note: '' };
    mainPhoto.innerHTML = '';
    if (v.src) {
      mainPhoto.className = 'r-45';
      var img = document.createElement('img');
      img.className = 'photo';
      img.src = v.src;
      img.alt = v.alt || v.label;
      mainPhoto.appendChild(img);
    } else {
      mainPhoto.className = 'ph r-45';
      var b = document.createElement('b');
      b.textContent = v.label + ' photo';
      var s = document.createElement('span');
      s.textContent = v.note;
      mainPhoto.appendChild(b);
      mainPhoto.appendChild(s);
    }
    setPressed($$('[data-view]'), function (btn) { return Number(btn.getAttribute('data-view')) === state.view; });
  }

  function render() {
    var name = PIECES[state.piece].name;
    $$('[data-name]').forEach(function (el) { el.textContent = name; });
    $('[data-current-price]').textContent = prices[state.piece] || '';
    $('[data-size-label]').textContent = state.size || 'Select';
    $('[data-qty-value]').textContent = String(state.qty);
    setPressed($$('[data-piece]'), function (b) { return b.getAttribute('data-piece') === state.piece; });
    setPressed($$('[data-size]'), function (b) { return b.getAttribute('data-size') === state.size; });
    if (!hashRouting) document.title = name + ' — Miche';
  }

  window.MicheProduct = {
    setPiece: function (p) {
      if (!PIECES[p] || p === state.piece) return;
      state.piece = p;
      notice.textContent = '';
      render();
    }
  };

  $$('[data-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.view = Number(btn.getAttribute('data-view'));
      renderPhoto();
    });
  });

  $$('[data-piece]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.piece = btn.getAttribute('data-piece');
      notice.textContent = '';
      if (hashRouting) {
        window.history.replaceState(null, '', '#product-' + state.piece);
      } else {
        var url = new URL(window.location.href);
        url.searchParams.set('piece', state.piece);
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
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
    var id = (variants[state.piece] || {})[state.size];
    if (shop && id) {
      // Shopify cart permalink: goes straight to checkout with this size and quantity,
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
  renderPhoto();
})();
