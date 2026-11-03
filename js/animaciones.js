/*
 * Funcode Studio CB — animaciones de código, personajes y la mascota Funi.
 * Todo es decorativo y respeta «movimiento reducido» (prefers-reduced-motion).
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var MONO = '01<>/{}[]#$_*=;';

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  /* ------------------------------------------------------------------
   * Pausar las animaciones que no están en pantalla
   * ------------------------------------------------------------------ */
  var scopes = document.querySelectorAll('.anim-scope');
  if (!hasIO) {
    scopes.forEach(function (el) { el.classList.add('is-playing'); });
  } else {
    var playIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('is-playing', e.isIntersecting); });
    }, { rootMargin: '80px 0px' });
    scopes.forEach(function (el) { playIO.observe(el); });
  }

  /* ------------------------------------------------------------------
   * Lluvia de símbolos de código en las cabeceras
   * ------------------------------------------------------------------ */
  var GLYPHS = ['</>', '{ }', '=>', '( )', '01', '[ ]', ';', '#', 'fn', '&&', '//', '<div>', 'if', '✓', '++', '==='];
  if (!reduceMotion) {
    document.querySelectorAll('.hero-bg, .page-hero-bg').forEach(function (bg) {
      var rain = document.createElement('div');
      rain.className = 'code-rain anim-scope';
      var count = window.innerWidth < 700 ? 9 : 18;
      for (var i = 0; i < count; i++) {
        var s = document.createElement('span');
        s.textContent = pick(GLYPHS);
        s.style.left = rand(2, 96).toFixed(1) + '%';
        s.style.fontSize = rand(11, 20).toFixed(0) + 'px';
        s.style.setProperty('--d', rand(14, 26).toFixed(1) + 's');
        s.style.setProperty('--delay', (-rand(0, 26)).toFixed(1) + 's');
        s.style.setProperty('--o', rand(0.12, 0.32).toFixed(2));
        s.style.setProperty('--sway', rand(-30, 30).toFixed(0) + 'px');
        rain.appendChild(s);
      }
      bg.appendChild(rain);
      if (playIO) playIO.observe(rain); else rain.classList.add('is-playing');
    });
  }

  /* ------------------------------------------------------------------
   * Títulos pequeños («kicker») que se descifran como código
   * ------------------------------------------------------------------ */
  function decode(el) {
    var text = el.textContent;
    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    var shown = document.createElement('span');
    shown.className = 'kicker-code is-decoding';
    shown.setAttribute('aria-hidden', 'true');
    el.textContent = '';
    el.appendChild(sr);
    el.appendChild(shown);
    var frame = 0;
    var total = Math.max(14, text.length * 2);
    (function step() {
      var done = Math.floor(text.length * frame / total);
      var out = '';
      for (var i = 0; i < text.length; i++) {
        out += i < done || text[i] === ' ' ? text[i] : MONO[Math.floor(Math.random() * MONO.length)];
      }
      shown.textContent = out;
      if (frame++ < total) setTimeout(step, 40);
      else { shown.textContent = text; shown.classList.remove('is-decoding'); }
    })();
  }
  if (!reduceMotion && hasIO) {
    var kickIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        kickIO.unobserve(e.target);
        decode(e.target);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('.kicker').forEach(function (k) { if (!k.children.length) kickIO.observe(k); });
  }

  /* ------------------------------------------------------------------
   * Editor que escribe código solo (Inicio)
   * ------------------------------------------------------------------ */
  var CODE = [
    '// así nace tu proyecto',
    'const idea = escuchar("tu negocio");',
    'const plan = definirAlcance(idea); // claro desde el inicio',
    '',
    'const web = construir(plan, {',
    '  responsive: true,',
    '  avances: 3',
    '});',
    '',
    'mostrarAvances(web); // tú revisas',
    'probar(web) && ajustar(web);',
    'publicar(web);'
  ];
  var OUTPUT = '✓ Proyecto entregado y en línea';

  // Divide una línea en fragmentos con color (comentarios, textos, palabras clave, funciones…).
  function tokens(line) {
    var out = [];
    var re = /(\/\/.*$)|("[^"]*")|\b(const|let|true|false|return)\b|\b(\d+)\b|([A-Za-záéíóúñ_]\w*)(?=\()|([{}()[\];,.:&=])/g;
    var last = 0;
    var m;
    while ((m = re.exec(line))) {
      if (m.index > last) out.push({ t: line.slice(last, m.index), c: '' });
      var cls = m[1] ? 'tk-com' : m[2] ? 'tk-str' : m[3] ? 'tk-key' : m[4] ? 'tk-num' : m[5] ? 'tk-fn' : 'tk-pun';
      out.push({ t: m[0], c: cls });
      last = m.index + m[0].length;
    }
    if (last < line.length) out.push({ t: line.slice(last), c: '' });
    return out;
  }

  function editor(box) {
    var code = box.querySelector('[data-typing]');
    var term = box.querySelector('[data-typing-out]');
    var caret = document.createElement('span');
    caret.className = 'type-caret';
    var timer = null;
    var running = false;

    function render(full) {
      code.innerHTML = '';
      CODE.forEach(function (line) {
        var ln = document.createElement('span');
        ln.className = 'ln';
        tokens(line).forEach(function (tk) {
          var s = document.createElement('span');
          if (tk.c) s.className = tk.c;
          s.setAttribute('data-full', tk.t);
          s.textContent = full ? tk.t : '';
          ln.appendChild(s);
        });
        code.appendChild(ln);
      });
      term.textContent = full ? OUTPUT : '';
    }

    if (reduceMotion) { render(true); return; }

    function play() {
      running = true;
      render(false);
      var parts = code.querySelectorAll('[data-full]');
      var lines = code.querySelectorAll('.ln');
      var p = 0;
      var c = 0;
      (function type() {
        if (!running) return;
        if (p >= parts.length) {
          lines[lines.length - 1].appendChild(caret);
          typeOut();
          return;
        }
        var part = parts[p];
        var full = part.getAttribute('data-full');
        part.textContent = full.slice(0, ++c);
        part.parentNode.appendChild(caret);
        var delay = full[c - 1] === ' ' ? 20 : rand(26, 70);
        if (c >= full.length) {
          p++;
          c = 0;
          if (!parts[p] || parts[p].parentNode !== part.parentNode) delay = 260;
        }
        timer = setTimeout(type, delay);
      })();
    }

    function typeOut() {
      var i = 0;
      timer = setTimeout(function tick() {
        if (!running) return;
        term.textContent = OUTPUT.slice(0, ++i);
        timer = i < OUTPUT.length ? setTimeout(tick, 35) : setTimeout(play, 6000);
      }, 500);
    }

    function stop() { running = false; clearTimeout(timer); }

    render(false);
    if (!hasIO) { play(); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && !running) play();
        else if (!e.isIntersecting && running) { stop(); render(true); }
      });
    }, { threshold: 0.3 }).observe(box);
  }
  document.querySelectorAll('.code-editor').forEach(editor);

  /* ------------------------------------------------------------------
   * Consola del pie de página
   * ------------------------------------------------------------------ */
  document.querySelectorAll('[data-typing-line]').forEach(function (el) {
    var text = el.getAttribute('data-typing-line');
    if (reduceMotion || !hasIO) { el.textContent = text; return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      var i = 0;
      (function tick() {
        el.textContent = text.slice(0, ++i);
        if (i < text.length) setTimeout(tick, rand(30, 80));
      })();
    });
    io.observe(el);
  });

  /* ------------------------------------------------------------------
   * Personajes: saltan al tocarlos
   * ------------------------------------------------------------------ */
  document.querySelectorAll('.cast-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var art = card.querySelector('.char');
      if (!art || reduceMotion) return;
      art.classList.remove('is-hello');
      void art.getBoundingClientRect();
      art.classList.add('is-hello');
    });
  });

  /* ------------------------------------------------------------------
   * Funi, la mascota
   * ------------------------------------------------------------------ */
  var root = document.getElementById('mascota');
  if (!root) return;
  var bubble = document.getElementById('mascota-bubble');
  var btn = root.querySelector('.mascota-btn');
  var closeBtn = root.querySelector('.mascota-close');
  var showBtn = document.getElementById('mascota-show');
  var KEY = 'funcode-mascota';

  var TIPS = [
    'Usamos inteligencia artificial como herramienta, siempre con revisión.',
    'Si un proyecto supera nuestro alcance, te lo decimos con transparencia.',
    'Puedes seguir tu solicitud en «Mis solicitudes» entrando con Google.',
    'Las páginas que hacemos se adaptan a celular y computador.',
    'Estoy hecho de código SVG. ¡Sin imágenes!',
    'Mi antena dorada es el puntito del logo de Funcode.',
    'Los proyectos empiezan desde $160.000 COP.',
    'Durante el proceso ves avances, no solo el último día.'
  ];

  function oculta() {
    try { return localStorage.getItem(KEY) === 'oculta'; } catch (e) { return false; }
  }
  function guardar(valor) {
    try { if (valor) localStorage.setItem(KEY, valor); else localStorage.removeItem(KEY); } catch (e) { /* sin almacenamiento */ }
  }

  var talkTimer = null;
  var lastTalk = 0;
  var moodTimer = null;

  function setMood(mood, ms) {
    root.classList.remove('is-happy', 'is-waving');
    if (mood) root.classList.add('is-' + mood);
    clearTimeout(moodTimer);
    if (mood && ms) moodTimer = setTimeout(function () { root.classList.remove('is-' + mood); }, ms);
  }

  function say(text, opts) {
    opts = opts || {};
    if (root.hidden) return;
    wake();
    lastTalk = Date.now();
    // Solo se anuncia a lectores de pantalla cuando la persona tocó a Funi.
    if (opts.anunciar) bubble.setAttribute('aria-live', 'polite'); else bubble.removeAttribute('aria-live');
    bubble.textContent = text;
    root.classList.add('is-talking');
    setMood(opts.mood || 'waving', 1600);
    clearTimeout(talkTimer);
    talkTimer = setTimeout(function () { root.classList.remove('is-talking'); }, opts.ms || Math.max(3800, text.length * 70));
  }

  function mostrar() {
    root.hidden = false;
    if (showBtn) showBtn.hidden = true;
  }
  function ocultar() {
    root.hidden = true;
    root.classList.remove('is-talking');
    if (showBtn) showBtn.hidden = false;
  }

  closeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    guardar('oculta');
    ocultar();
    if (showBtn) showBtn.focus();
  });
  if (showBtn) {
    showBtn.addEventListener('click', function () {
      guardar('');
      mostrar();
      layout();
      say('¡Volví! Gracias por llamarme.', { mood: 'happy', anunciar: true });
    });
  }

  var tipIndex = Math.floor(Math.random() * TIPS.length);
  btn.addEventListener('click', function () {
    if (!reduceMotion) {
      var trick = Math.random() < 0.25 ? 'is-spin' : 'is-jump';
      root.classList.remove('is-jump', 'is-spin');
      void root.offsetWidth;
      root.classList.add(trick);
      setTimeout(function () { root.classList.remove(trick); }, 900);
    }
    tipIndex = (tipIndex + 1) % TIPS.length;
    say(TIPS[tipIndex], { mood: 'happy', anunciar: true });
  });

  /* Dormir si no pasa nada por un rato */
  var idleTimer = null;
  function wake() {
    root.classList.remove('is-sleeping');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (!root.classList.contains('is-talking')) root.classList.add('is-sleeping');
    }, 30000);
  }
  ['pointerdown', 'keydown', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, wake, { passive: true });
  });

  /* Los ojos siguen el puntero (computador) */
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    var eyeFrame = 0;
    window.addEventListener('pointermove', function (e) {
      if (eyeFrame || root.hidden) return;
      eyeFrame = requestAnimationFrame(function () {
        eyeFrame = 0;
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height * 0.4);
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        root.style.setProperty('--ex', (dx / len * 3).toFixed(2) + 'px');
        root.style.setProperty('--ey', (dy / len * 3).toFixed(2) + 'px');
      });
      wake();
    }, { passive: true });
  }

  /* Movimiento con el scroll */
  var current = 0;
  var target = 0;
  var lastY = window.pageYOffset;
  var velocity = 0;
  var raf = 0;
  var flyingTimer = null;
  var wide = false;

  function container() {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--container'));
    return v || 1160;
  }

  function computeTarget() {
    var header = 80;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var progress = Math.min(1, Math.max(0, window.pageYOffset / max));
    var room = window.innerHeight - header - btn.offsetHeight - 40;
    target = header + 10 + room * progress;
  }

  function tick() {
    raf = 0;
    current += (target - current) * 0.12;
    var tilt = Math.max(-16, Math.min(16, velocity * 0.6));
    velocity *= 0.85;
    root.style.setProperty('--my', current.toFixed(1) + 'px');
    root.style.setProperty('--tilt', tilt.toFixed(1) + 'deg');
    if (Math.abs(target - current) > 0.5 || Math.abs(velocity) > 0.2) raf = requestAnimationFrame(tick);
    else root.classList.remove('is-flying');
  }

  function onScroll() {
    var y = window.pageYOffset;
    velocity = Math.max(-30, Math.min(30, y - lastY));
    lastY = y;
    if (!wide || reduceMotion) return;
    computeTarget();
    root.classList.add('is-flying');
    clearTimeout(flyingTimer);
    flyingTimer = setTimeout(function () { root.classList.remove('is-flying'); }, 400);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function layout() {
    var gutter = (window.innerWidth - Math.min(window.innerWidth, container())) / 2;
    wide = !reduceMotion && gutter >= 130;
    root.classList.toggle('is-wide', wide);
    root.classList.toggle('is-peek', !wide && !reduceMotion);
    if (wide) {
      computeTarget();
      current = target;
      root.style.setProperty('--my', current.toFixed(1) + 'px');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { layout(); }, { passive: true });

  /* Mensajes según la sección que se está viendo */
  function seccionesConMensaje() {
    var secs = document.querySelectorAll('[data-mascota]');
    if (!hasIO || !secs.length) return;
    var vistos = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting || vistos[e.target.getAttribute('data-mascota')]) return;
        if (Date.now() - lastTalk < 5000) return; // no hablar demasiado seguido
        vistos[e.target.getAttribute('data-mascota')] = true;
        say(e.target.getAttribute('data-mascota'), { mood: e.target.getAttribute('data-mascota-mood') || 'waving' });
      });
    }, { threshold: 0.45 });
    secs.forEach(function (s) { io.observe(s); });
  }

  if (oculta()) {
    ocultar();
  } else {
    mostrar();
  }
  layout();
  wake();
  // Pequeña pausa para que Funi llegue antes de hablar.
  setTimeout(seccionesConMensaje, 900);
})();
