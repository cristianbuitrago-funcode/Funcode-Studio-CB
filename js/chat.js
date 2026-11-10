/*
 * Funcode Studio CB — chat «Pregúntale a Funi».
 *
 * Dos formas de responder:
 *   1. Con IA, si js/config.js tiene «chatUrl» (Google Apps Script → Claude; ver CHAT-FUNI.md).
 *   2. Sin IA: busca la pregunta en assets/chat/conocimiento.json (preguntas frecuentes reales).
 * Si la IA falla o no está configurada, siempre responde la opción 2.
 * Funi nunca inventa: si no sabe, lo dice y ofrece WhatsApp o el formulario.
 */
(function () {
  'use strict';

  var panel = document.getElementById('chat');
  if (!panel) return;

  var config = window.FUNCODE_CONFIG || {};
  var log = document.getElementById('chat-log');
  var form = document.getElementById('chat-form');
  var input = document.getElementById('chat-input');
  var suggest = document.getElementById('chat-suggest');
  var sub = document.getElementById('chat-sub');
  var closeBtn = document.getElementById('chat-close');
  var funiBtn = document.querySelector('.mascota-btn');
  var KEY = 'funi-chat';
  var remoto = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.chatUrl || '');

  var motor = window.FuncodeChatMotor;
  var saber = null;
  var historial = cargar();
  var ocupado = false;
  var fallos = 0; // preguntas seguidas sin respuesta

  sub.textContent = remoto ? 'Asistente con inteligencia artificial · puede equivocarse' : 'Asistente automático de Funcode';

  /* ---------- Historial (se mantiene al cambiar de página) ---------- */
  function cargar() {
    try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function guardar() {
    try { sessionStorage.setItem(KEY, JSON.stringify(historial.slice(-30))); } catch (e) { /* sin almacenamiento */ }
  }

  /* ---------- Conocimiento ---------- */
  function conocimiento() {
    if (saber) return Promise.resolve(saber);
    return fetch('assets/chat/conocimiento.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        saber = motor.preparar(data);
        return saber;
      });
  }

  function whatsappUrl(texto) {
    var n = String(config.whatsapp || '').replace(/\D/g, '');
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto || config.whatsappMessage || '') : '';
  }

  function porId(id) {
    for (var i = 0; i < saber.intenciones.length; i++) if (saber.intenciones[i].id === id) return saber.intenciones[i];
    return null;
  }

  // Arma la respuesta con una o dos intenciones (si la pregunta traía dos temas).
  function componer(intenciones, pregunta) {
    fallos = 0;
    var dos = intenciones.length > 1;
    var texto = intenciones.map(function (it) { return (dos ? it.titulo + ': ' : '') + it.respuesta; }).join('\n\n');
    var enlaces = [];
    intenciones.forEach(function (it) {
      (it.enlaces || []).forEach(function (e) {
        if (!enlaces.some(function (x) { return x.href === e.href; })) enlaces.push(e);
      });
    });
    var conWa = intenciones.some(function (it) { return it.whatsapp; });
    return {
      texto: texto,
      enlaces: enlaces.slice(0, 3),
      wa: conWa ? whatsappUrl('Hola, Funcode. ' + (pregunta ? 'Tengo una pregunta: ' + pregunta.slice(0, 300) : '')) : ''
    };
  }

  function respuestaLocal(pregunta) {
    return conocimiento().then(function () {
      var r = motor.buscar(saber, pregunta);
      if (r.respuestas.length) return componer(r.respuestas, pregunta);
      fallos++;
      if (fallos >= 2) {
        // Segunda pregunta seguida sin respuesta: ahí sí conviene hablar con una persona.
        fallos = 0;
        return {
          texto: saber.sinRespuestaOtraVez,
          enlaces: [{ texto: 'Ir al formulario', href: 'contacto.html#formulario' }],
          wa: whatsappUrl('Hola, Funcode. Tengo una pregunta: ' + pregunta.slice(0, 300))
        };
      }
      // Primera vez: proponer temas parecidos y el menú de temas, sin mandar a WhatsApp.
      var ids = r.sugerencias.slice(0, 2).map(function (it) { return it.id; });
      saber.temas.forEach(function (id) { if (ids.indexOf(id) === -1 && ids.length < 6) ids.push(id); });
      return {
        texto: saber.sinRespuesta,
        temas: ids.map(function (id) { var it = porId(id); return it ? { id: id, titulo: it.titulo } : null; }).filter(Boolean)
      };
    });
  }

  function respuestaIA(pregunta) {
    var mensajes = historial.slice(-10).map(function (m) { return { rol: m.rol, texto: String(m.texto).slice(0, 600) }; });
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    return fetch(config.chatUrl, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita la verificación CORS previa de Apps Script
      body: JSON.stringify({ mensajes: mensajes, pagina: location.pathname.split('/').pop() || 'index.html' }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.json(); }).then(function (data) {
      clearTimeout(timer);
      if (!data || !data.ok || !data.respuesta) throw new Error((data && data.error) || 'sin respuesta');
      return { texto: data.respuesta, enlaces: [], wa: /whatsapp/i.test(data.respuesta) ? whatsappUrl('Hola, Funcode. Vengo del chat de la página.') : '' };
    }, function (err) { clearTimeout(timer); throw err; });
  }

  /* ---------- Mostrar mensajes ---------- */
  // Texto seguro: nunca se usa innerHTML con lo que escribe la persona o la IA.
  function conEnlaces(el, texto) {
    var partes = String(texto).split(/(https:\/\/wa\.me\/\d+(?:\?[^\s)]*)?|\b(?:index|precios|servicios|proyectos|proceso|nosotros|contacto|mis-solicitudes)\.html(?:#[\w-]+)?)/g);
    partes.forEach(function (p, i) {
      if (!p) return;
      if (i % 2 === 1) {
        var a = document.createElement('a');
        var esWa = /^https:\/\/wa\.me/.test(p);
        // Un enlace de WhatsApp escrito por la IA siempre se cambia por el número oficial de Funcode.
        a.href = esWa ? (whatsappUrl() || 'contacto.html') : p;
        a.textContent = esWa ? 'WhatsApp' : p.replace(/\.html.*$/, '').replace('mis-solicitudes', 'Mis solicitudes').replace('index', 'Inicio');
        if (/^https:/.test(p)) { a.target = '_blank'; a.rel = 'noopener'; }
        el.appendChild(a);
      } else {
        el.appendChild(document.createTextNode(p));
      }
    });
  }

  function pintar(m) {
    var row = document.createElement('div');
    row.className = 'chat-msg chat-msg--' + (m.rol === 'usuario' ? 'yo' : 'funi');
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (m.rol === 'usuario') {
      bubble.textContent = m.texto;
      var sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = 'Tú: ';
      row.appendChild(sr);
    } else {
      var srf = document.createElement('span');
      srf.className = 'sr-only';
      srf.textContent = 'Funi: ';
      bubble.appendChild(srf);
      conEnlaces(bubble, m.texto);
    }
    row.appendChild(bubble);
    if (m.temas && m.temas.length) {
      var temas = document.createElement('div');
      temas.className = 'chat-topics';
      m.temas.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chat-chip';
        b.textContent = t.titulo;
        b.addEventListener('click', function () { elegirTema(t); });
        temas.appendChild(b);
      });
      row.appendChild(temas);
    }
    var acciones = (m.enlaces || []).slice(0, 3).map(function (e) { return { texto: e.texto, href: e.href }; });
    if (m.wa) acciones.push({ texto: 'Escribir por WhatsApp', href: m.wa, wa: true });
    if (acciones.length) {
      var links = document.createElement('div');
      links.className = 'chat-links';
      acciones.forEach(function (e) {
        var a = document.createElement('a');
        a.href = e.href;
        a.textContent = e.texto;
        a.className = 'chat-link' + (e.wa ? ' chat-link--wa' : '');
        if (e.wa) { a.target = '_blank'; a.rel = 'noopener'; }
        links.appendChild(a);
      });
      row.appendChild(links);
    }
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function escribiendo(on) {
    var t = log.querySelector('.chat-typing');
    if (on && !t) {
      t = document.createElement('div');
      t.className = 'chat-msg chat-msg--funi chat-typing';
      t.setAttribute('aria-hidden', 'true');
      t.innerHTML = '<div class="chat-bubble"><span></span><span></span><span></span></div>';
      log.appendChild(t);
      log.scrollTop = log.scrollHeight;
    } else if (!on && t) {
      t.remove();
    }
  }

  function sugerencias() {
    suggest.innerHTML = '';
    if (!saber || historial.length > 2) { suggest.hidden = true; return; }
    suggest.hidden = false;
    saber.sugerencias.forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-chip';
      b.textContent = q;
      b.addEventListener('click', function () { enviar(q); });
      suggest.appendChild(b);
    });
  }

  function agregar(m) {
    historial.push(m);
    guardar();
    pintar(m);
  }

  /* ---------- Enviar ---------- */
  function enviar(texto) {
    texto = String(texto || '').trim().slice(0, 500);
    if (!texto || ocupado) return;
    ocupado = true;
    agregar({ rol: 'usuario', texto: texto });
    input.value = '';
    ajustar();
    suggest.hidden = true;
    escribiendo(true);
    var inicio = Date.now();
    var intento = remoto
      ? respuestaIA(texto).catch(function () { return respuestaLocal(texto); })
      : respuestaLocal(texto);
    intento.catch(function () {
      return { texto: 'Uy, no pude cargar mis respuestas. Revisa tu conexión o escríbenos por WhatsApp.', enlaces: [], wa: whatsappUrl() };
    }).then(function (r) {
      // Una pequeña pausa para que se note que Funi «piensa».
      setTimeout(function () {
        escribiendo(false);
        agregar({ rol: 'funi', texto: r.texto, enlaces: r.enlaces, wa: r.wa, temas: r.temas });
        ocupado = false;
      }, Math.max(0, 700 - (Date.now() - inicio)));
    });
  }

  // Tocar un tema propuesto responde ese tema directamente (sin volver a adivinar).
  function elegirTema(t) {
    if (ocupado || !saber) return;
    var it = porId(t.id);
    if (!it) return;
    agregar({ rol: 'usuario', texto: t.titulo });
    var r = componer([it], '');
    escribiendo(true);
    ocupado = true;
    setTimeout(function () {
      escribiendo(false);
      agregar({ rol: 'funi', texto: r.texto, enlaces: r.enlaces, wa: r.wa });
      ocupado = false;
    }, 500);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    enviar(input.value);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      enviar(input.value);
    }
  });
  function ajustar() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  input.addEventListener('input', ajustar);

  /* ---------- Abrir y cerrar ---------- */
  function abrir() {
    panel.hidden = false;
    document.documentElement.classList.add('chat-open');
    document.dispatchEvent(new CustomEvent('funi:chat', { detail: { abierto: true } }));
    conocimiento().catch(function () { return null; }).then(function () {
      if (!log.children.length) {
        if (!historial.length) {
          agregar({ rol: 'funi', texto: '¡Hola! Soy Funi 🤖. Pregúntame lo que quieras sobre Funcode: precios, tiempos, servicios o cómo pedir tu proyecto.' });
        } else {
          historial.forEach(pintar);
        }
      }
      sugerencias();
    });
    setTimeout(function () { input.focus(); }, 50);
  }

  function cerrar() {
    panel.hidden = true;
    document.documentElement.classList.remove('chat-open');
    document.dispatchEvent(new CustomEvent('funi:chat', { detail: { abierto: false } }));
    if (funiBtn) funiBtn.focus();
  }

  closeBtn.addEventListener('click', cerrar);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) cerrar();
  });

  // Enlaces o botones de la página con data-chat abren el chat.
  document.querySelectorAll('[data-chat]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); abrir(); });
  });

  window.FuncodeChat = {
    abrir: abrir,
    cerrar: cerrar,
    alternar: function () { if (panel.hidden) abrir(); else cerrar(); }
  };
})();
