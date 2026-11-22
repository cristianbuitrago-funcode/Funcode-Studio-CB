/*
 * Funcode Studio CB — chat «Pregúntale a Funi».
 *
 * Dos formas de responder:
 *   1. Con IA, si js/config.js tiene «chatUrl» (Google Apps Script → Claude; ver CHAT-FUNI.md).
 *   2. Sin IA: busca la pregunta en assets/chat/conocimiento.json (preguntas frecuentes reales).
 * Si la IA falla o no está configurada, siempre responde la opción 2.
 * Funi nunca inventa: si no sabe, lo dice y ofrece WhatsApp o el formulario.
 *
 * Además:
 *   - Recuerda el tema de la conversación («contexto»): si hablaste de una tienda y luego
 *     preguntas «¿cuánto cuesta?», responde el precio de una tienda.
 *   - «Preparar mi solicitud»: preguntas opcionales, de una en una, que terminan en un resumen
 *     para enviar por WhatsApp. No se envía nada a ningún servidor: solo se abre WhatsApp
 *     con el texto, si la persona lo decide.
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
  var KEY_ESTADO = 'funi-estado';
  var remoto = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.chatUrl || '');

  var motor = window.FuncodeChatMotor;
  var saber = null;
  var historial = cargar(KEY, []);
  // contexto: último tema comercial (tienda, app…); perfil: datos que la persona ya dio;
  // flujo: la solicitud en curso ({ paso, datos }); ofrecido: cuándo se ofreció la solicitud.
  var estado = cargar(KEY_ESTADO, {});
  if (!estado.perfil) estado.perfil = {};
  var ocupado = false;
  var fallos = 0; // preguntas seguidas sin respuesta

  sub.textContent = remoto ? 'Asistente con inteligencia artificial · puede equivocarse' : 'Asistente virtual de Funcode';
  var nota = document.getElementById('chat-note');
  if (remoto && nota) {
    nota.textContent = 'Respuestas con inteligencia artificial: pueden tener errores. Tus preguntas se envían a la IA para responderte ' +
      '(las respuestas de «Preparar mi solicitud» no). No escribas contraseñas ni datos bancarios.';
  }

  /* ---------- Historial (se mantiene al cambiar de página) ---------- */
  function cargar(clave, vacio) {
    try { return JSON.parse(sessionStorage.getItem(clave)) || vacio; } catch (e) { return vacio; }
  }
  function guardar() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(historial.slice(-40)));
      sessionStorage.setItem(KEY_ESTADO, JSON.stringify(estado));
    } catch (e) { /* sin almacenamiento */ }
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

  function botonSolicitud() {
    return { titulo: saber.solicitud.boton, accion: 'solicitud' };
  }

  // Aplica el contexto de la conversación y recuerda lo que la persona ya contó.
  function aplicarContexto(intenciones) {
    return intenciones.map(function (it) {
      var cambio = it.segunContexto && estado.contexto && it.segunContexto[estado.contexto];
      var final = (cambio && porId(cambio)) || it;
      if (final.contexto) estado.contexto = final.contexto;
      if (final.plataforma) estado.perfil.plataforma = final.plataforma;
      return final;
    });
  }

  // Arma la respuesta con una o dos intenciones (si la pregunta traía dos temas).
  function componer(intenciones, pregunta) {
    fallos = 0;
    intenciones = aplicarContexto(intenciones);
    var dos = intenciones.length > 1;
    var texto = intenciones.map(function (it) { return (dos ? it.titulo + ': ' : '') + it.respuesta; }).join('\n\n');
    var enlaces = [];
    intenciones.forEach(function (it) {
      (it.enlaces || []).forEach(function (e) {
        if (!enlaces.some(function (x) { return x.href === e.href; })) enlaces.push(e);
      });
    });
    var temas = (intenciones[0].opciones || []).slice(0, 6);
    // Ofrecer preparar la solicitud cuando hay interés comercial, sin insistir en cada mensaje.
    var interesa = intenciones.some(function (it) { return it.iniciaSolicitud; }) ||
      (intenciones.some(function (it) { return it.ofrecerSolicitud; }) &&
        (estado.ofrecido == null || historial.length - estado.ofrecido >= 6));
    if (interesa && !estado.flujo && saber.solicitud) {
      temas = temas.concat([botonSolicitud()]);
      estado.ofrecido = historial.length;
    }
    var conWa = intenciones.some(function (it) { return it.whatsapp; });
    return {
      texto: texto,
      enlaces: enlaces.slice(0, 3),
      temas: temas,
      wa: conWa ? whatsappUrl('Hola, Funcode Studio CB. ' + (pregunta ? 'Tengo una pregunta: ' + pregunta.slice(0, 300) : 'Vengo del chat de la página.')) : ''
    };
  }

  function temasDeRespaldo(sugeridas) {
    var ids = sugeridas.slice(0, 2).map(function (it) { return it.id; });
    saber.temas.forEach(function (id) { if (ids.indexOf(id) === -1 && ids.length < 6) ids.push(id); });
    return ids.map(function (id) { var it = porId(id); return it ? { id: id, titulo: it.titulo } : null; }).filter(Boolean);
  }

  function respuestaLocal(pregunta) {
    return conocimiento().then(function () {
      var r = motor.buscar(saber, pregunta);
      if (r.respuestas.length) return componer(r.respuestas, pregunta);
      fallos++;
      var wa = whatsappUrl('Hola, Funcode Studio CB. Tengo una pregunta: ' + pregunta.slice(0, 300));
      if (fallos >= 2) {
        // Segunda pregunta seguida sin respuesta: ahí conviene hablar con una persona.
        fallos = 0;
        return { texto: saber.sinRespuestaOtraVez, enlaces: [{ texto: 'Ir al formulario', href: 'contacto.html#formulario' }], wa: wa };
      }
      // Primera vez: no improvisa; propone temas parecidos y ofrece WhatsApp.
      return { texto: saber.sinRespuesta, temas: temasDeRespaldo(r.sugerencias), wa: wa };
    });
  }

  // Lo que la persona escribió hace poco (para que el mensaje de WhatsApp llegue con contexto).
  function ultimasPreguntas() {
    return historial.filter(function (m) { return m.rol === 'usuario' && !m.flujo; })
      .slice(-3).map(function (m) { return '• ' + String(m.texto).slice(0, 200); }).join('\n');
  }

  function respuestaIA(pregunta) {
    // Las respuestas de «Preparar mi solicitud» (nombre, presupuesto…) no se envían a la IA.
    var mensajes = historial.filter(function (m) { return !m.flujo; }).slice(-10)
      .map(function (m) { return { rol: m.rol, texto: String(m.texto).slice(0, 600) }; });
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
      var wa = /whatsapp/i.test(data.respuesta)
        ? whatsappUrl('Hola, Funcode Studio CB. Vengo del chat de la página. Mis preguntas:\n' + ultimasPreguntas())
        : '';
      return { texto: data.respuesta, enlaces: [], wa: wa };
    }, function (err) { clearTimeout(timer); throw err; });
  }

  /* ---------- Preparar mi solicitud ---------- */
  function pasoAplica(p, datos) {
    if (p.soloSi && p.soloSi.indexOf(datos.servicio) === -1) return false;
    if (p.saltarSi && p.saltarSi.indexOf(datos.servicio) !== -1) return false;
    return datos[p.campo] === undefined;
  }

  function preguntarPaso(prefijo) {
    var f = estado.flujo;
    var p = saber.solicitud.pasos[f.paso];
    var chips = (p.opciones || []).map(function (o) { return { titulo: o, valor: o, paso: f.paso }; });
    if (p.omitir) chips.push({ titulo: p.omitir, valor: '', paso: f.paso });
    chips.push({ titulo: saber.solicitud.cancelar, accion: 'cancelar', paso: f.paso });
    agregar({ rol: 'funi', texto: (prefijo ? prefijo + ' ' : '') + p.pregunta, temas: chips, paso: f.paso, flujo: true });
  }

  function siguientePaso(prefijo) {
    var f = estado.flujo;
    var pasos = saber.solicitud.pasos;
    for (var i = f.paso + 1; i < pasos.length; i++) {
      if (pasoAplica(pasos[i], f.datos)) {
        f.paso = i;
        guardar();
        preguntarPaso(prefijo);
        return;
      }
    }
    terminarSolicitud();
  }

  function iniciarSolicitud() {
    if (!saber || !saber.solicitud) return;
    var s = saber.solicitud;
    var datos = {};
    var intro = s.inicio;
    // Regla de continuidad: si ya se sabe qué necesita, no se vuelve a preguntar.
    var servicio = estado.contexto && saber.contextoServicio && saber.contextoServicio[estado.contexto];
    if (servicio) {
      datos.servicio = servicio;
      intro = s.conContexto.replace('{servicio}', servicio) + intro;
    }
    if (estado.perfil.plataforma && (!servicio || servicio === 'Aplicación')) datos.plataforma = estado.perfil.plataforma;
    estado.flujo = { paso: -1, datos: datos };
    agregar({ rol: 'funi', texto: intro, flujo: true });
    siguientePaso();
  }

  function quitarOpcionesDelPaso() {
    log.querySelectorAll('.chat-topics[data-paso]').forEach(function (el) { el.remove(); });
  }

  function responderPaso(valor, mostrado) {
    var f = estado.flujo;
    if (!f) return;
    var p = saber.solicitud.pasos[f.paso];
    quitarOpcionesDelPaso();
    f.datos[p.campo] = String(valor).trim().slice(0, 300);
    agregar({ rol: 'usuario', texto: mostrado || valor, flujo: true });
    siguientePaso();
  }

  function cancelarSolicitud() {
    quitarOpcionesDelPaso();
    estado.flujo = null;
    agregar({ rol: 'funi', texto: saber.solicitud.cancelado, temas: [botonSolicitud()] });
  }

  // Nivel de interés según la guía de Funcode: alto = necesidad clara y pide cotización.
  function nivelInteres(d) {
    var s = saber.solicitud.interes;
    var conServicio = d.servicio && d.servicio !== 'Todavía no lo sé';
    if (conServicio && d.necesidad) return s.alto;
    if (conServicio || d.necesidad) return s.medio;
    return s.ninguno;
  }

  function terminarSolicitud() {
    var s = saber.solicitud;
    var d = estado.flujo.datos;
    estado.flujo = null;
    var lineas = s.pasos.map(function (p) {
      return d[p.campo] ? '• ' + s.etiquetas[p.campo] + ': ' + d[p.campo] : '';
    }).filter(Boolean);
    var categoria = s.categorias[d.servicio] || s.categoriaGeneral;
    var mensaje = s.whatsappInicio + '\n\n' + lineas.join('\n') + '\n\n' +
      s.whatsappClasificacion + ': ' + categoria + ' · interés ' + nivelInteres(d);
    agregar({
      rol: 'funi',
      texto: s.resumen + '\n' + (lineas.length ? lineas.join('\n') : '• (sin detalles)') + '\n\n' + s.cierre,
      enlaces: [{ texto: 'Ir al formulario', href: 'contacto.html#formulario' }],
      wa: whatsappUrl(mensaje),
      waTexto: 'Enviar por WhatsApp',
      temas: [{ titulo: s.corregir, accion: 'solicitud' }],
      flujo: true
    });
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
    // Las opciones de un paso de la solicitud solo se muestran mientras ese paso está activo.
    var vigente = m.paso == null || (estado.flujo && estado.flujo.paso === m.paso);
    if (m.temas && m.temas.length && vigente) {
      var temas = document.createElement('div');
      temas.className = 'chat-topics';
      if (m.paso != null) temas.setAttribute('data-paso', m.paso);
      m.temas.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chat-chip' + (t.accion === 'solicitud' ? ' chat-chip--solicitud' : '');
        b.textContent = t.titulo;
        b.addEventListener('click', function () { elegirTema(t); });
        temas.appendChild(b);
      });
      row.appendChild(temas);
    }
    var acciones = (m.enlaces || []).slice(0, 3).map(function (e) { return { texto: e.texto, href: e.href }; });
    if (m.wa) acciones.push({ texto: m.waTexto || 'Escribir por WhatsApp', href: m.wa, wa: true });
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
    if (!saber || historial.length > 2 || estado.flujo) { suggest.hidden = true; return; }
    suggest.hidden = false;
    saber.sugerencias.forEach(function (q) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-chip';
      b.textContent = q;
      b.addEventListener('click', function () {
        if (saber.solicitud && q === saber.solicitud.boton) elegirTema(botonSolicitud());
        else enviar(q);
      });
      suggest.appendChild(b);
    });
  }

  function agregar(m) {
    historial.push(m);
    guardar();
    pintar(m);
  }

  /* ---------- Enviar ---------- */
  function responder(promesa) {
    ocupado = true;
    escribiendo(true);
    var inicio = Date.now();
    promesa.catch(function () {
      return { texto: 'Uy, no pude cargar mis respuestas. Revisa tu conexión o escríbenos por WhatsApp.', enlaces: [], wa: whatsappUrl() };
    }).then(function (r) {
      // Una pequeña pausa para que se note que Funi «piensa».
      setTimeout(function () {
        escribiendo(false);
        agregar({ rol: 'funi', texto: r.texto, enlaces: r.enlaces, wa: r.wa, temas: r.temas });
        ocupado = false;
        if (estado.flujo) preguntarPaso(saber.solicitud.seguir); // retomar la solicitud tras una pregunta
      }, Math.max(0, 700 - (Date.now() - inicio)));
    });
  }

  function enviar(texto) {
    texto = String(texto || '').trim().slice(0, 500);
    if (!texto || ocupado) return;
    input.value = '';
    ajustar();
    suggest.hidden = true;
    if (estado.flujo && saber) {
      var normal = motor.norm(texto);
      if (/^(cancelar|salir|olvidalo|ya no|no quiero)\b/.test(normal)) {
        agregar({ rol: 'usuario', texto: texto, flujo: true });
        cancelarSolicitud();
        return;
      }
      // Si escribe una pregunta en medio de la solicitud, se responde y luego se retoma.
      if (texto.indexOf('?') === -1) {
        responderPaso(texto);
        return;
      }
      quitarOpcionesDelPaso();
    }
    agregar({ rol: 'usuario', texto: texto });
    responder(remoto
      ? respuestaIA(texto).catch(function () { return respuestaLocal(texto); })
      : respuestaLocal(texto));
  }

  // Tocar un botón: un tema responde ese tema directamente; los de la solicitud avanzan el paso.
  function elegirTema(t) {
    if (ocupado || !saber) return;
    if (t.accion === 'solicitud') {
      quitarOpcionesDelPaso();
      agregar({ rol: 'usuario', texto: t.titulo.replace(/^\S+\s/, ''), flujo: true });
      iniciarSolicitud();
      return;
    }
    if (t.accion === 'cancelar') {
      agregar({ rol: 'usuario', texto: t.titulo, flujo: true });
      cancelarSolicitud();
      return;
    }
    if (t.valor !== undefined) {
      if (estado.flujo && estado.flujo.paso === t.paso) responderPaso(t.valor, t.titulo);
      return;
    }
    var it = porId(t.id);
    if (!it) return;
    agregar({ rol: 'usuario', texto: t.titulo });
    responder(Promise.resolve(componer([it], '')));
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
          agregar({ rol: 'funi', texto: (saber && saber.saludo) || '¡Hola! Soy Funi 🤖, el asistente virtual de Funcode Studio CB. ¿En qué te ayudo?' });
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
