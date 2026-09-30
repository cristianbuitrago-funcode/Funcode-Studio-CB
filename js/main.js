/* Funcode Studio CB — interacciones de la página (sin dependencias) */
(function () {
  'use strict';

  var config = window.FUNCODE_CONFIG || {};
  var social = config.social || {};
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
   * Enlaces de contacto y redes (según js/config.js)
   * ------------------------------------------------------------------ */
  function digits(value) { return String(value || '').replace(/\D/g, ''); }

  function whatsappUrl(text) {
    var number = digits(config.whatsapp);
    if (!number) return '';
    return 'https://wa.me/' + number + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  function isHttpUrl(value) { return /^https?:\/\/\S+$/i.test(String(value || '')); }

  function resolveLink(kind) {
    switch (kind) {
      case 'whatsapp': return whatsappUrl(config.whatsappMessage);
      case 'email': return /\S+@\S+\.\S+/.test(config.email || '') ? 'mailto:' + config.email : '';
      default: return isHttpUrl(social[kind]) ? social[kind] : '';
    }
  }

  var missing = [];
  document.querySelectorAll('[data-link]').forEach(function (el) {
    var kind = el.getAttribute('data-link');
    var url = resolveLink(kind);

    if (url) {
      el.setAttribute('href', url);
      if (/^https?:/.test(url)) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
      }
      if (el.hasAttribute('data-float')) el.hidden = false;
      return;
    }

    if (missing.indexOf(kind) === -1) missing.push(kind);
    if (el.hasAttribute('data-float')) { el.remove(); return; }

    // Sin URL real: se muestra como «Próximamente» y deja de ser un enlace.
    el.removeAttribute('href');
    el.removeAttribute('target');
    el.classList.add('is-pending');
    el.setAttribute('title', (el.getAttribute('data-label') || kind) + ': próximamente');
    var tag = document.createElement('span');
    tag.className = 'pending-tag';
    tag.textContent = 'Próximamente';
    el.appendChild(tag);
  });

  if (missing.length && window.console) {
    console.info('[Funcode] Enlaces pendientes de configurar en js/config.js: ' + missing.join(', '));
  }

  /* ------------------------------------------------------------------
   * Header y menú móvil
   * ------------------------------------------------------------------ */
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('menu-principal');
  var toggleLabel = toggle.querySelector('.sr-only');
  var toggleIcon = toggle.querySelector('use');

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggleLabel.textContent = open ? 'Cerrar menú' : 'Abrir menú';
    toggleIcon.setAttribute('href', open ? '#i-close' : '#i-menu');
  }

  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setMenu(false);
      toggle.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (nav.classList.contains('is-open') && !header.contains(e.target)) setMenu(false);
  });

  window.matchMedia('(min-width: 1101px)').addEventListener('change', function (mq) {
    if (mq.matches) setMenu(false);
  });

  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 12); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ------------------------------------------------------------------
   * Aparición suave de secciones
   * ------------------------------------------------------------------ */
  var reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    reveals.forEach(function (el) {
      // Pequeño escalonado entre tarjetas hermanas.
      var parent = el.parentElement;
      var siblings = parent ? parent.querySelectorAll(':scope > .reveal') : [];
      var index = Array.prototype.indexOf.call(siblings, el);
      if (index > 0) el.style.transitionDelay = Math.min(index, 5) * 70 + 'ms';
      io.observe(el);
    });
  }

  /* Brillo que sigue al cursor en las tarjetas de servicios (solo con ratón) */
  if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.service-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* ------------------------------------------------------------------
   * Formulario de contacto
   * ------------------------------------------------------------------ */
  var form = document.getElementById('contact-form');
  if (!form) return;

  var statusBox = document.getElementById('form-status');
  var modeNote = document.getElementById('form-mode');
  var submitBtn = form.querySelector('button[type="submit"]');
  var endpoint = isHttpUrl(config.formEndpoint) ? config.formEndpoint : '';
  var fb = config.firebase || {};
  var firebaseReady = !!(fb.apiKey && fb.projectId);
  // Solo para pruebas locales: http://localhost:8080/?emulador usa los emuladores de Firebase.
  var useEmulator = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emulador\b/.test(location.search);
  var dateInput = form.elements.fecha;

  // No permitir fechas pasadas.
  var now = new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  dateInput.min = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

  // Datos que envía el portal «Mis solicitudes» al pulsar «Nueva solicitud».
  var params = new URLSearchParams(location.search);
  if (params.get('correo')) form.elements.correo.value = params.get('correo').slice(0, 120);
  if (params.get('nombre')) form.elements.nombre.value = params.get('nombre').slice(0, 80);

  if (!firebaseReady && !endpoint) {
    modeNote.textContent = 'Aviso: el envío automático del formulario todavía no está activo. Al pulsar «Enviar solicitud» te mostraremos cómo hacernos llegar tu mensaje.';
  }

  var messages = {
    nombre: { valueMissing: 'Escribe tu nombre.' },
    correo: { valueMissing: 'Escribe tu correo.', typeMismatch: 'Revisa el correo: debe tener el formato nombre@dominio.com.' },
    whatsapp: { patternMismatch: 'Usa solo números y, si quieres, el indicativo (+57).' },
    tipo: { valueMissing: 'Elige el tipo de proyecto.' },
    descripcion: { valueMissing: 'Cuéntanos tu idea.', tooShort: 'Cuéntanos un poco más (mínimo 20 caracteres).' },
    fecha: { rangeUnderflow: 'Elige una fecha a partir de hoy.' }
  };

  var extraChecks = {
    nombre: { test: /\S/, msg: 'valueMissing' },
    descripcion: { test: /^[\s\S]{20,}$/, msg: 'tooShort' },
    correo: { test: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, msg: 'typeMismatch' },
    whatsapp: { test: /^\+?[0-9()\s-]{7,20}$/, msg: 'patternMismatch' }
  };

  function errorFor(field) {
    var v = field.validity;
    var m = messages[field.name] || {};
    var extra = extraChecks[field.name];
    var value = field.value.trim();
    if (v.valid && extra && field.value && !extra.test.test(value)) return m[extra.msg];
    if (v.valid) return '';
    if (v.valueMissing) return m.valueMissing || 'Este campo es obligatorio.';
    if (v.typeMismatch) return m.typeMismatch || 'Revisa este dato.';
    if (v.patternMismatch) return m.patternMismatch || 'Revisa este dato.';
    if (v.tooShort) return m.tooShort || 'Es demasiado corto.';
    if (v.rangeUnderflow) return m.rangeUnderflow || 'Revisa este dato.';
    return 'Revisa este dato.';
  }

  function showError(field) {
    var box = document.getElementById('e-' + field.id.replace('f-', ''));
    var msg = errorFor(field);
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (box) box.textContent = msg;
    return !msg;
  }

  var checked = ['nombre', 'correo', 'whatsapp', 'tipo', 'descripcion', 'fecha'];
  checked.forEach(function (name) {
    var field = form.elements[name];
    field.addEventListener('blur', function () { if (field.value) showError(field); });
    field.addEventListener('input', function () {
      if (field.getAttribute('aria-invalid') === 'true') showError(field);
    });
  });

  function validate() {
    var firstInvalid = null;
    checked.forEach(function (name) {
      var field = form.elements[name];
      if (!showError(field) && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function formatDate(value) {
    if (!value) return '';
    var parts = value.split('-');
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function summary() {
    var f = form.elements;
    var lines = [
      'Solicitud de proyecto — Funcode Studio CB',
      '',
      'Nombre: ' + f.nombre.value.trim()
    ];
    if (f.negocio.value.trim()) lines.push('Negocio: ' + f.negocio.value.trim());
    lines.push('Correo: ' + f.correo.value.trim());
    if (f.whatsapp.value.trim()) lines.push('WhatsApp: ' + f.whatsapp.value.trim());
    lines.push('Tipo de proyecto: ' + f.tipo.value);
    lines.push('Presupuesto aproximado: ' + (f.presupuesto.value || 'Aún no lo sé'));
    if (f.fecha.value) lines.push('Fecha aproximada: ' + formatDate(f.fecha.value));
    lines.push('', 'Idea:', f.descripcion.value.trim());
    return lines.join('\n');
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      if (ok) { resolve(); } else { reject(new Error('copy failed')); }
    });
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text) node.textContent = text;
    return node;
  }

  function renderStatus(type, title, text, withFallback) {
    statusBox.className = 'form-status is-' + type;
    statusBox.innerHTML = '';
    statusBox.appendChild(el('h3', null, title));
    statusBox.appendChild(el('p', null, text));

    if (withFallback) {
      var body = summary();
      var row = el('div', { class: 'btn-row' });
      var wa = whatsappUrl(body);

      if (wa) {
        var waBtn = el('a', { class: 'btn btn-primary btn-sm', href: wa, target: '_blank', rel: 'noopener' }, 'Enviar por WhatsApp');
        row.appendChild(waBtn);
      }
      if (/\S+@\S+\.\S+/.test(config.email || '')) {
        var mail = 'mailto:' + config.email +
          '?subject=' + encodeURIComponent('Solicitud de proyecto: ' + form.elements.tipo.value) +
          '&body=' + encodeURIComponent(body);
        row.appendChild(el('a', { class: 'btn btn-ghost btn-sm', href: mail }, 'Enviar por correo'));
      }

      var copyBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Copiar solicitud');
      copyBtn.addEventListener('click', function () {
        copyText(body).then(function () {
          copyBtn.textContent = '¡Copiada!';
        }, function () {
          copyBtn.textContent = 'No se pudo copiar';
        });
        setTimeout(function () { copyBtn.textContent = 'Copiar solicitud'; }, 2500);
      });
      row.appendChild(copyBtn);
      statusBox.appendChild(row);
    }

    statusBox.hidden = false;
    statusBox.focus({ preventScroll: true });
    statusBox.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  function fallbackText() {
    var hasWa = !!whatsappUrl('');
    var hasMail = /\S+@\S+\.\S+/.test(config.email || '');
    if (hasWa && hasMail) return 'Envíala por WhatsApp o por correo con los botones de abajo: tu mensaje ya va escrito.';
    if (hasWa) return 'Envíala por WhatsApp con el botón de abajo: tu mensaje ya va escrito.';
    if (hasMail) return 'Envíala por correo con el botón de abajo: tu mensaje ya va escrito.';
    return 'Copia tu solicitud y envíanosla por el mismo medio por el que conociste a Funcode (redes sociales, flyer o recomendación).';
  }

  function randomId() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var bytes = new Uint8Array(20);
    window.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return chars[b % chars.length]; }).join('');
  }

  // Guarda la solicitud en Firestore con la API REST (sin cargar el SDK en la página pública).
  // Las reglas de firestore.rules solo permiten crear solicitudes válidas; nadie más puede leerlas.
  function saveToFirestore() {
    var f = form.elements;
    var docs = 'projects/' + fb.projectId + '/databases/(default)/documents';
    var base = useEmulator ? 'http://127.0.0.1:8085/v1/' : 'https://firestore.googleapis.com/v1/';
    var fields = {};
    function put(key, value) {
      value = String(value || '').trim();
      if (value) fields[key] = { stringValue: value };
    }
    ['nombre', 'negocio', 'whatsapp', 'tipo', 'descripcion', 'presupuesto', 'fecha'].forEach(function (name) {
      put(name, f[name].value);
    });
    // En minúsculas: así el cliente puede seguirla en «Mis solicitudes» entrando con ese correo.
    put('correo', f.correo.value.toLowerCase());
    put('estado', 'nuevo');
    put('origen', (location.origin + location.pathname).slice(0, 200));

    var body = {
      writes: [{
        update: { name: docs + '/solicitudes/' + randomId(), fields: fields },
        updateTransforms: [{ fieldPath: 'creado', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false }
      }]
    };

    return fetch(base + docs + ':commit?key=' + encodeURIComponent(fb.apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  function postToEndpoint() {
    var data = new FormData(form);
    data.append('_subject', 'Nueva solicitud de proyecto: ' + form.elements.tipo.value);
    return fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
  }

  // Aviso por WhatsApp al organizador (Google Apps Script + CallMeBot, ver AVISO-WHATSAPP.md).
  // Solo se envía un resumen; si falla, la solicitud ya quedó guardada igual.
  function notifyOwner() {
    var url = isHttpUrl(config.avisoWhatsappUrl) ? config.avisoWhatsappUrl : '';
    if (!url) return;
    var f = form.elements;
    var body = JSON.stringify({
      nombre: f.nombre.value.trim(),
      tipo: f.tipo.value,
      presupuesto: f.presupuesto.value
    });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
      fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: body }).catch(function () {});
    } catch (err) { /* el aviso es opcional */ }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    statusBox.hidden = true;

    if (!validate()) return;

    // Campo trampa: si un bot lo llenó, no se envía nada.
    if (form.elements._gotcha.value) return;

    if (!firebaseReady && !endpoint) {
      renderStatus('info',
        'Tu solicitud está lista, pero aún no se ha enviado',
        'El formulario todavía no está conectado a un servidor, así que no recibimos los datos automáticamente. ' + fallbackText(),
        true);
      return;
    }

    // La petición se arma antes de bloquear los campos (FormData ignora los deshabilitados).
    var request = firebaseReady ? saveToFirestore() : postToEndpoint();

    // Bloquear el formulario mientras se envía.
    var controls = Array.prototype.filter.call(form.elements, function (c) { return !c.disabled; });
    controls.forEach(function (c) { c.disabled = true; });
    form.setAttribute('aria-busy', 'true');
    var original = submitBtn.innerHTML;
    submitBtn.textContent = 'Enviando…';

    request
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        notifyOwner();
        form.reset();
        form.querySelectorAll('[aria-invalid]').forEach(function (f) { f.removeAttribute('aria-invalid'); });
        renderStatus('ok', '¡Solicitud enviada!', 'Gracias por escribirnos. Revisaremos tu idea y te responderemos al correo que indicaste.', false);
        if (firebaseReady) {
          var track = el('p', null, 'Puedes seguir el estado de tu solicitud en ');
          track.appendChild(el('a', { href: 'mis-solicitudes.html' }, 'Mis solicitudes'));
          track.appendChild(document.createTextNode(', entrando con la cuenta de Google de ese correo.'));
          statusBox.appendChild(track);
        }
      })
      .catch(function () {
        renderStatus('error', 'No pudimos enviar tu solicitud',
          'Hubo un problema de conexión con el servidor. Tus datos siguen en el formulario. ' + fallbackText(),
          true);
      })
      .then(function () {
        controls.forEach(function (c) { c.disabled = false; });
        form.removeAttribute('aria-busy');
        submitBtn.innerHTML = original;
      });
  });
})();
