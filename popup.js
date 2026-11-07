/*
  Discount popup: email + phone → spin the wheel or scratch the card → discount code.
  Settings live in config.js (popup).
  Preview (nothing sent or saved): add ?popup=wheel or ?popup=scratch to the address,
  or #popup-wheel / #popup-scratch, or call MichePopup.preview('wheel' | 'scratch').
*/
(function () {
  'use strict';

  var C = window.MICHE_CONFIG || {};
  var P = C.popup || {};
  var prizes = (P.prizes || []).filter(function (p) { return p && p.label && p.code; });
  if (prizes.length < 2) return;

  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  };
  var KEY_CLOSED = 'miche_popup_closed';
  var KEY_JOINED = 'miche_popup_joined';
  var KEY_PRIZE = 'miche_prize';
  var live = !!(P.enabled && C.signupEndpoint);
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = null;

  function safeUrl(u) {
    return typeof u === 'string' && /^(https?:\/\/|\/|#)/.test(u) ? u : '#';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function previewFromUrl() {
    var q = null;
    try { q = new URLSearchParams(window.location.search).get('popup'); } catch (e) { q = null; }
    if (q === 'wheel' || q === 'scratch') return q;
    var h = window.location.hash.replace(/^#/, '');
    if (h === 'popup-wheel') return 'wheel';
    if (h === 'popup-scratch') return 'scratch';
    return null;
  }

  function mount(style, preview) {
    var isWheel = style === 'wheel';
    var won = null;
    if (!preview) {
      try { won = JSON.parse(store.get(KEY_PRIZE) || 'null'); } catch (e) { won = null; }
    }
    var joined = !preview && store.get(KEY_JOINED) === '1';
    var title = isWheel ? 'Spin to win' : 'Scratch to win';
    var unlock = isWheel ? 'Unlock my spin' : 'Unlock my card';
    var thing = isWheel ? 'spin' : 'card';
    var shopHref = esc(safeUrl(P.shopLink || '/product?piece=set'));

    var html =
      '<div class="pop-backdrop" hidden>' +
        '<div class="pop" role="dialog" aria-modal="true" aria-labelledby="pop-title">' +
          '<button class="pop-close" type="button" aria-label="Close">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>' +
          '</button>' +
          (preview ? '<p class="pop-preview">Preview — nothing is sent or saved</p>' : '') +

          '<div class="pop-step" data-step="form">' +
            '<p class="eyebrow">Drop 001 · Volt</p>' +
            '<h2 class="display pop-title" id="pop-title">' + title + '</h2>' +
            '<p class="pop-sub">Drop your email and number to unlock your ' + thing + '. Every ' + thing + ' wins a discount.</p>' +
            '<form class="pop-form" novalidate>' +
              '<label for="pop-email">Email</label>' +
              '<input id="pop-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@email.com" required>' +
              '<label for="pop-phone">Phone</label>' +
              '<input id="pop-phone" name="phone" type="tel" autocomplete="tel-national" inputmode="tel" placeholder="(251) 555-0123" required>' +
              '<label class="pop-consent" for="pop-consent">' +
                '<input id="pop-consent" type="checkbox" name="sms_consent" required>' +
                '<span>By checking this box and signing up, you agree to receive recurring automated marketing texts (drop alerts and promos) and emails from Miche at the number and email provided. Consent is not a condition of purchase. Msg frequency varies. Msg &amp; data rates may apply. Reply STOP to unsubscribe, HELP for help. ' +
                '<a href="' + esc(safeUrl(P.privacyUrl)) + '">Privacy Policy</a> · <a href="' + esc(safeUrl(P.termsUrl)) + '">Terms</a></span>' +
              '</label>' +
              '<button class="btn btn-accent pop-submit" type="submit">' + unlock + '</button>' +
              '<p class="pop-msg" role="status" aria-live="polite"></p>' +
            '</form>' +
            '<button class="pop-skip" type="button" data-close>No thanks</button>' +
            (preview ? '<button class="pop-skip" type="button" data-skip-form>Skip the form (preview only)</button>' : '') +
          '</div>' +

          '<div class="pop-step" data-step="play" hidden>' +
            (isWheel
              ? '<h2 class="display pop-title">Spin it</h2>' +
                '<div class="wheel-wrap"><span class="wheel-pointer" aria-hidden="true"></span><svg class="wheel" viewBox="0 0 300 300" role="img" aria-label="Prize wheel"></svg></div>' +
                '<button class="btn btn-accent pop-wide" type="button" data-spin>Spin</button>'
              : '<h2 class="display pop-title" data-scratch-title>Scratch it</h2>' +
                '<p class="pop-sub" data-scratch-sub>Drag your finger across the card to reveal your discount.</p>' +
                '<div class="scratch">' +
                  '<div class="scratch-prize"><span class="scratch-prize-label" data-scratch-prize></span><span class="scratch-prize-note">Miche · Drop 001</span></div>' +
                  '<canvas class="scratch-cover" aria-hidden="true"></canvas>' +
                  '<canvas class="scratch-fx" aria-hidden="true"></canvas>' +
                  '<span class="scratch-hint" aria-hidden="true"><span></span></span>' +
                '</div>' +
                '<button class="pop-skip" type="button" data-reveal>Reveal it without scratching</button>') +
            '<p class="pop-msg" role="status" aria-live="polite" data-play-msg></p>' +
          '</div>' +

          '<div class="pop-step" data-step="result" hidden>' +
            '<p class="eyebrow">You won</p>' +
            '<h2 class="display pop-title" data-result-label></h2>' +
            '<div class="code-box"><span class="code" data-result-code></span><button class="btn btn-dark code-copy" type="button" data-copy>Copy</button></div>' +
            '<p class="pop-sub">Use it at checkout. Tapping Buy now adds it for you.</p>' +
            '<a class="btn btn-accent pop-wide" href="' + shopHref + '" data-shop>Shop the set</a>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button class="pop-tab" type="button" hidden></button>';

    var holder = document.createElement('div');
    holder.innerHTML = html;
    var nodes = Array.prototype.slice.call(holder.childNodes);
    nodes.forEach(function (n) { document.body.appendChild(n); });

    var backdrop = nodes[0];
    var tab = nodes[1];
    var dialog = backdrop.querySelector('.pop');
    var form = dialog.querySelector('.pop-form');
    var emailInput = dialog.querySelector('#pop-email');
    var phoneInput = dialog.querySelector('#pop-phone');
    var consentInput = dialog.querySelector('#pop-consent');
    var formMsg = form.querySelector('.pop-msg');
    var submitBtn = form.querySelector('.pop-submit');
    var playMsg = dialog.querySelector('[data-play-msg]');

    var isOpen = false;
    var shownOnce = false;
    var lastFocus = null;
    var step = won ? 'result' : (joined ? 'play' : 'form');
    var prizeIndex = -1;
    var played = false;
    var timers = [];
    var cleanups = [];

    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function listen(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      cleanups.push(function () { target.removeEventListener(type, fn, opts); });
    }

    function pickPrize() {
      var total = prizes.reduce(function (s, p) { return s + Math.max(0, Number(p.weight) || 0); }, 0);
      if (total <= 0) return Math.floor(Math.random() * prizes.length);
      var roll = Math.random() * total;
      for (var i = 0; i < prizes.length; i++) {
        roll -= Math.max(0, Number(prizes[i].weight) || 0);
        if (roll < 0) return i;
      }
      return prizes.length - 1;
    }
    function digits(s) { return String(s || '').replace(/\D/g, ''); }
    function toE164(s) {
      var d = digits(s);
      if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
      return d.length === 10 ? '+1' + d : '';
    }
    function focusables() {
      return Array.prototype.slice.call(dialog.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])'))
        .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    }

    function show(name) {
      step = name;
      dialog.querySelector('[data-step="result"]').classList.remove('is-inline');
      Array.prototype.forEach.call(dialog.querySelectorAll('.pop-step'), function (el) {
        el.hidden = el.getAttribute('data-step') !== name;
      });
      if (name === 'play' && !isWheel) setupScratch();
      if (name === 'result') fillResult();
      var first = focusables().filter(function (el) { return !el.classList.contains('pop-close'); })[0];
      if (isOpen && first) first.focus();
    }

    function updateTab() {
      if (isOpen) { tab.hidden = true; return; }
      tab.textContent = won ? 'Your code: ' + won.code : (isWheel ? 'Spin for a discount' : 'Scratch for a discount');
      tab.hidden = false;
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      shownOnce = true;
      lastFocus = document.activeElement;
      backdrop.hidden = false;
      document.documentElement.classList.add('pop-lock');
      tab.hidden = true;
      show(step);
      requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      backdrop.classList.remove('is-open');
      backdrop.hidden = true;
      document.documentElement.classList.remove('pop-lock');
      if (!preview && !won) store.set(KEY_CLOSED, String(Date.now()));
      updateTab();
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    dialog.querySelector('.pop-close').addEventListener('click', close);
    Array.prototype.forEach.call(dialog.querySelectorAll('[data-close]'), function (b) { b.addEventListener('click', close); });
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    tab.addEventListener('click', open);

    listen(document, 'keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // ---------- form ----------
    phoneInput.addEventListener('input', function () {
      var d = digits(phoneInput.value);
      if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
      d = d.slice(0, 10);
      var out = d;
      if (d.length > 6) out = '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
      else if (d.length > 3) out = '(' + d.slice(0, 3) + ') ' + d.slice(3);
      phoneInput.value = out;
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (emailInput.value || '').trim();
      var phone = toE164(phoneInput.value);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { formMsg.textContent = 'Enter a valid email.'; emailInput.focus(); return; }
      if (!phone) { formMsg.textContent = 'Enter a 10-digit US phone number.'; phoneInput.focus(); return; }
      if (!consentInput.checked) { formMsg.textContent = 'Check the box to get texts and your code.'; consentInput.focus(); return; }

      if (preview) { formMsg.textContent = ''; show('play'); return; }

      submitBtn.disabled = true;
      formMsg.textContent = 'Unlocking…';
      fetch(C.signupEndpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, phone: phone, sms_consent: true, source: 'popup-' + style, page: window.location.pathname })
      }).then(function (res) {
        if (!res.ok) throw new Error('Signup failed');
        joined = true;
        store.set(KEY_JOINED, '1');
        formMsg.textContent = '';
        show('play');
      }).catch(function () {
        formMsg.textContent = 'Something went wrong. Try again.';
      }).then(function () {
        submitBtn.disabled = false;
      });
    });

    var skipForm = dialog.querySelector('[data-skip-form]');
    if (skipForm) skipForm.addEventListener('click', function () { formMsg.textContent = ''; show('play'); });

    // ---------- prize ----------
    function award(index) {
      var p = prizes[index];
      won = { label: p.label, code: p.code };
      if (!preview) store.set(KEY_PRIZE, JSON.stringify(won));
      if (isWheel) { later(function () { show('result'); }, 700); return; }
      // Scratch card: keep the revealed card on screen and show the code right under it
      later(function () {
        fillResult();
        dialog.querySelector('[data-scratch-title]').textContent = 'You won';
        dialog.querySelector('[data-scratch-sub]').hidden = true;
        dialog.querySelector('[data-reveal]').hidden = true;
        var res = dialog.querySelector('[data-step="result"]');
        res.classList.add('is-inline');
        res.hidden = false;
        step = 'result';
        dialog.querySelector('[data-copy]').focus();
      }, 650);
    }
    function fillResult() {
      if (!won) return;
      dialog.querySelector('[data-result-label]').textContent = won.label;
      dialog.querySelector('[data-result-code]').textContent = won.code;
    }

    dialog.querySelector('[data-copy]').addEventListener('click', function () {
      var btn = this;
      var selectCode = function () {
        var range = document.createRange();
        range.selectNodeContents(dialog.querySelector('[data-result-code]'));
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        btn.textContent = 'Selected';
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(won.code).then(function () {
          btn.textContent = 'Copied';
          later(function () { btn.textContent = 'Copy'; }, 1800);
        }, selectCode);
      } else {
        selectCode();
      }
    });

    dialog.querySelector('[data-shop]').addEventListener('click', function (e) {
      var product = document.querySelector('[data-product]');
      if (product && product.offsetParent !== null) { e.preventDefault(); close(); return; }
      close();
    });

    // ---------- wheel ----------
    if (isWheel) {
      var NS = 'http://www.w3.org/2000/svg';
      var wheel = dialog.querySelector('.wheel');
      var n = prizes.length, cx = 150, cy = 150, r = 144, seg = 360 / n;
      var rotation = 0;
      var pt = function (deg, rad) {
        var t = deg * Math.PI / 180;
        return [cx + rad * Math.sin(t), cy - rad * Math.cos(t)];
      };
      var svgEl = function (tag, attrs) {
        var el = document.createElementNS(NS, tag);
        Object.keys(attrs).forEach(function (k) { el.setAttribute(k, String(attrs[k])); });
        return el;
      };
      prizes.forEach(function (p, i) {
        var odd = n % 2 === 1 && i === n - 1;
        var fill = odd ? '#2A2A2A' : (i % 2 === 0 ? '#D4FF00' : '#151515');
        var ink = fill === '#D4FF00' ? '#0B0B0B' : '#F4F4F0';
        var a = pt(i * seg, r), b = pt((i + 1) * seg, r);
        wheel.appendChild(svgEl('path', {
          d: 'M' + cx + ' ' + cy + ' L' + a[0].toFixed(2) + ' ' + a[1].toFixed(2) +
            ' A' + r + ' ' + r + ' 0 ' + (seg > 180 ? 1 : 0) + ' 1 ' + b[0].toFixed(2) + ' ' + b[1].toFixed(2) + ' Z',
          fill: fill, stroke: '#0B0B0B', 'stroke-width': 2
        }));
        var text = svgEl('text', {
          x: cx, y: cy - r * 0.68, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: ink,
          'font-family': 'Inter, system-ui, sans-serif', 'font-weight': 800, 'font-size': n > 8 ? 11 : 15,
          'letter-spacing': 0.5, transform: 'rotate(' + (i * seg + seg / 2) + ' ' + cx + ' ' + cy + ')'
        });
        text.textContent = p.label;
        wheel.appendChild(text);
      });
      wheel.appendChild(svgEl('circle', { cx: cx, cy: cy, r: r + 1, fill: 'none', stroke: '#F4F4F0', 'stroke-width': 4 }));
      wheel.appendChild(svgEl('circle', { cx: cx, cy: cy, r: 22, fill: '#0B0B0B', stroke: '#D4FF00', 'stroke-width': 3 }));
      if (reduceMotion) wheel.classList.add('wheel-quick');

      var spinBtn = dialog.querySelector('[data-spin]');
      spinBtn.addEventListener('click', function () {
        if (played) return;
        played = true;
        spinBtn.disabled = true;
        playMsg.textContent = 'Spinning…';
        prizeIndex = pickPrize();
        var landing = prizeIndex * seg + seg / 2 + (Math.random() - 0.5) * seg * 0.6;
        var base = Math.ceil(rotation / 360) * 360;
        rotation = base + 360 * (reduceMotion ? 1 : 6) + ((360 - landing) % 360);
        wheel.style.transform = 'rotate(' + rotation + 'deg)';
        var finished = false;
        var finish = function () {
          if (finished) return;
          finished = true;
          playMsg.textContent = 'You landed on ' + prizes[prizeIndex].label + '.';
          award(prizeIndex);
        };
        wheel.addEventListener('transitionend', finish, { once: true });
        later(finish, reduceMotion ? 1500 : 6000);
      });
    }

    // ---------- scratch card ----------
    var scratchReady = false;
    function setupScratch() {
      if (scratchReady || isWheel) return;
      scratchReady = true;
      if (prizeIndex < 0) prizeIndex = pickPrize();
      dialog.querySelector('[data-scratch-prize]').textContent = prizes[prizeIndex].label;

      var card = dialog.querySelector('.scratch');
      var canvas = dialog.querySelector('.scratch-cover');
      var fx = dialog.querySelector('.scratch-fx');
      var hint = dialog.querySelector('.scratch-hint');
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      var fctx = fx.getContext('2d');
      var dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      var w = card.clientWidth, h = card.clientHeight;
      [canvas, fx].forEach(function (c) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.style.width = w + 'px';
        c.style.height = h + 'px';
      });
      ctx.scale(dpr, dpr);
      fctx.scale(dpr, dpr);

      // Volt foil: metallic sheen, grain, dashed edge, instructions
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#BFE600');
      g.addColorStop(0.42, '#DFFF4D');
      g.addColorStop(0.5, '#F1FF9E');
      g.addColorStop(0.58, '#D4FF00');
      g.addColorStop(1, '#A9CC00');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      var grains = Math.round(w * h / 22);
      for (var k = 0; k < grains; k++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(11, 11, 11, 0.07)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
      }
      ctx.strokeStyle = 'rgba(11, 11, 11, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(10.5, 10.5, w - 21, h - 21);
      ctx.setLineDash([]);
      ctx.fillStyle = '#0B0B0B';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 22px Inter, system-ui, sans-serif';
      ctx.fillText('SCRATCH HERE', w / 2, h / 2 - 14);
      ctx.font = '600 13px Inter, system-ui, sans-serif';
      ctx.fillText('Drag to reveal your discount', w / 2, h / 2 + 12);

      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000000';

      var down = false, last = null, moves = 0, done = false, lastBuzz = 0;
      var particles = [], fxRunning = false;
      var pos = function (e) {
        var b = canvas.getBoundingClientRect();
        return [e.clientX - b.left, e.clientY - b.top];
      };
      // A slightly rough brush so the edges look scratched, not cut
      var dab = function (x, y) {
        ctx.beginPath();
        ctx.arc(x, y, 17 + Math.random() * 6, 0, Math.PI * 2);
        ctx.fill();
      };
      var stroke = function (a, b) {
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var steps = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 4));
        for (var s = 1; s <= steps; s++) dab(a[0] + dx * s / steps, a[1] + dy * s / steps);
      };
      var tick = function () {
        fctx.clearRect(0, 0, w, h);
        particles = particles.filter(function (q) { return q.life > 0; });
        particles.forEach(function (q) {
          q.vy += 0.25; q.x += q.vx; q.y += q.vy; q.life--;
          fctx.fillStyle = 'rgba(212, 255, 0, ' + Math.min(1, q.life / 20) + ')';
          fctx.fillRect(q.x, q.y, q.s, q.s);
        });
        if (particles.length) requestAnimationFrame(tick); else fxRunning = false;
      };
      // Foil flakes flying off under the finger
      var flakes = function (p) {
        if (reduceMotion) return;
        for (var i = 0; i < 3; i++) {
          particles.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, life: 30 + Math.random() * 20, s: 1.5 + Math.random() * 2.5 });
        }
        if (!fxRunning) { fxRunning = true; requestAnimationFrame(tick); }
      };
      // Tiny buzz while scratching, on phones that support it
      var buzz = function () {
        var t = Date.now();
        if (navigator.vibrate && t - lastBuzz > 90) {
          lastBuzz = t;
          try { navigator.vibrate(4); } catch (err) { /* not allowed */ }
        }
      };
      var clearedShare = function () {
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        var clear = 0, total = 0;
        for (var i = 3; i < data.length; i += 96) { total++; if (data[i] < 128) clear++; }
        return total ? clear / total : 0;
      };
      var finish = function () {
        if (done) return;
        done = true;
        played = true;
        down = false;
        hint.hidden = true;
        card.classList.add('is-revealed');
        playMsg.textContent = 'You got ' + prizes[prizeIndex].label + '.';
        award(prizeIndex);
      };

      canvas.addEventListener('pointerdown', function (e) {
        if (done) return;
        down = true;
        hint.hidden = true;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        last = pos(e);
        dab(last[0], last[1]);
        flakes(last);
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!down || done) return;
        var list = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
        if (!list.length) list = [e];
        list.forEach(function (ev) { var p = pos(ev); stroke(last, p); last = p; });
        flakes(last);
        buzz();
        if (++moves % 8 === 0 && clearedShare() > 0.55) finish();
      });
      var up = function () {
        if (!down) return;
        down = false;
        if (clearedShare() > 0.55) finish();
      };
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      // Keep the page and popup from scrolling while a finger is on the card
      ['touchstart', 'touchmove'].forEach(function (type) {
        canvas.addEventListener(type, function (e) { e.preventDefault(); }, { passive: false });
      });
      dialog.querySelector('[data-reveal]').addEventListener('click', finish);
    }

    // ---------- when to open ----------
    function eligible() {
      if (won) return false;
      var closed = Number(store.get(KEY_CLOSED) || 0);
      var days = Number(P.hideForDays);
      if (!(days >= 0)) days = 3;
      return !closed || Date.now() - closed > days * 86400000;
    }

    if (preview) {
      open();
    } else if (eligible()) {
      var timer = later(open, Math.max(0, Number(P.delaySeconds) || 0) * 1000);
      // Desktop: open early if the cursor heads for the tab bar
      listen(document, 'mouseout', function (e) {
        if (shownOnce) return;
        if (!e.relatedTarget && e.clientY <= 0) { clearTimeout(timer); open(); }
      });
    } else {
      updateTab();
    }

    return {
      destroy: function () {
        timers.forEach(clearTimeout);
        cleanups.forEach(function (fn) { fn(); });
        document.documentElement.classList.remove('pop-lock');
        nodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
      }
    };
  }

  function start(style, preview) {
    if (current) current.destroy();
    current = mount(style, preview);
  }

  window.MichePopup = {
    preview: function (style) { start(style === 'scratch' ? 'scratch' : 'wheel', true); }
  };

  window.addEventListener('hashchange', function () {
    var pv = previewFromUrl();
    if (pv) start(pv, true);
  });

  var pv = previewFromUrl();
  if (pv) start(pv, true);
  else if (live) start(P.style === 'scratch' ? 'scratch' : 'wheel', false);
})();
