/* Funcode Studio CB — portal del cliente «Mis solicitudes» (Firebase Auth + Firestore) */
(function () {
  'use strict';

  var config = window.FUNCODE_CONFIG || {};
  var fb = config.firebase || {};
  var estados = window.FUNCODE_ESTADOS || [];
  var estadoDe = window.FUNCODE_ESTADO;
  var $ = function (id) { return document.getElementById(id); };
  var STATES = ['config', 'loading', 'login', 'error', 'app'];

  function show(state) {
    STATES.forEach(function (s) { $('state-' + s).hidden = s !== state; });
  }

  if (!(fb.apiKey && fb.projectId) || !window.firebase) {
    show('config');
    return;
  }

  firebase.initializeApp(fb);
  var auth = firebase.auth();
  var db = firebase.firestore();

  // Solo para pruebas locales: http://localhost:8080/mis-solicitudes.html?emulador
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emulador\b/.test(location.search)) {
    auth.useEmulator('http://127.0.0.1:9099');
    db.useEmulator('127.0.0.1', 8085);
  }

  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  var unsubscribe = null;
  var unsubscribeResenas = null;
  var list = $('requests');
  var currentUser = null;
  var lastItems = [];
  var lastEmail = '';
  var resenas = {};      // reseñas del cliente por id de solicitud
  var editando = {};     // solicitudes cuya reseña se está editando
  var avisos = {};       // mensajes tras guardar una reseña
  var pendingRender = false;

  /* ---------- Sesión ---------- */
  function loginError(err) {
    var box = $('login-error');
    var messages = {
      'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar. Inténtalo de nuevo.',
      'auth/cancelled-popup-request': '',
      'auth/network-request-failed': 'No hay conexión. Revisa tu internet e inténtalo de nuevo.'
    };
    var text = err && err.code in messages ? messages[err.code] : 'No se pudo iniciar sesión. Inténtalo de nuevo en un momento.';
    box.textContent = text;
    box.hidden = !text;
  }

  $('login-btn').addEventListener('click', function () {
    $('login-error').hidden = true;
    auth.signInWithPopup(provider).catch(function (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
        return auth.signInWithRedirect(provider);
      }
      loginError(err);
    });
  });
  auth.getRedirectResult().catch(loginError);
  $('logout-btn').addEventListener('click', function () { auth.signOut(); });
  $('retry-btn').addEventListener('click', function () { if (auth.currentUser) listen(auth.currentUser); });

  auth.onAuthStateChanged(function (user) {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (unsubscribeResenas) { unsubscribeResenas(); unsubscribeResenas = null; }
    currentUser = user;
    resenas = {}; editando = {}; avisos = {};
    $('admin-user').hidden = !user;
    if (!user) { show('login'); return; }
    $('admin-email').textContent = user.email || '';
    listen(user);
  });

  /* ---------- Datos en tiempo real ---------- */
  function listen(user) {
    show('loading');
    var email = String(user.email || '').toLowerCase();
    var name = (user.displayName || '').trim();

    $('portal-greeting').textContent = (name ? 'Hola, ' + name.split(/\s+/)[0] + '. ' : '') +
      'Aquí ves en qué va cada proyecto. Se actualiza solo cuando hay cambios.';
    $('new-request').href = 'contacto.html?correo=' + encodeURIComponent(email) +
      (name ? '&nombre=' + encodeURIComponent(name) : '') + '#formulario';

    listenResenas(user);
    unsubscribe = db.collection('solicitudes').where('correo', '==', email).onSnapshot(function (snap) {
      var items = snap.docs.map(function (doc) {
        var data = doc.data({ serverTimestamps: 'estimate' });
        data.id = doc.id;
        return data;
      });
      items.sort(function (a, b) { return millis(b.creado) - millis(a.creado); });
      lastItems = items;
      lastEmail = email;
      show('app');
      render(items, email);
    }, function (err) {
      unsubscribe = null;
      $('load-error').textContent = err.code === 'permission-denied'
        ? 'Tu cuenta de Google no tiene el correo verificado, o aún no se ha activado el seguimiento.'
        : (err.message || String(err));
      show('error');
    });
  }

  function listenResenas(user) {
    if (unsubscribeResenas) return;
    unsubscribeResenas = db.collection('resenas').where('uid', '==', user.uid).onSnapshot(function (snap) {
      resenas = {};
      snap.forEach(function (doc) { resenas[doc.id] = doc.data(); });
      render(lastItems, lastEmail);
    }, function () { unsubscribeResenas = null; });
  }

  /* ---------- Reseñas ---------- */
  var ESTADO_RESENA = {
    pendiente: 'En revisión: la publicaremos pronto.',
    publicada: 'Publicada en la página de Funcode.',
    oculta: 'No publicada.'
  };

  function starsText(n) {
    var span = el('span', { class: 'stars', role: 'img', 'aria-label': n + ' de 5 estrellas' });
    span.textContent = '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
    return span;
  }

  function nombrePublico(user) {
    var partes = String(user.displayName || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    return partes[0] + (partes[1] ? ' ' + partes[1].charAt(0).toUpperCase() + '.' : '');
  }

  function reviewBlock(item) {
    var r = resenas[item.id];
    var box = el('section', { class: 'review-box', 'aria-label': 'Tu reseña de este proyecto' });

    if (avisos[item.id]) box.appendChild(el('p', { class: 'review-notice', role: 'status' }, avisos[item.id]));

    if (r && !editando[item.id]) {
      box.appendChild(el('p', { class: 'portal-message-title' }, 'Tu reseña'));
      box.appendChild(starsText(r.estrellas));
      box.appendChild(el('p', { class: 'review-text' }, r.texto));
      box.appendChild(el('p', { class: 'portal-meta' }, 'Firmada como ' + r.nombre + ' · ' + (ESTADO_RESENA[r.estado] || '')));
      var edit = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Editar reseña');
      edit.addEventListener('click', function () { editando[item.id] = true; delete avisos[item.id]; render(lastItems, lastEmail); });
      box.appendChild(edit);
      return box;
    }

    var form = el('form', { class: 'review-form', novalidate: '' });
    form.appendChild(el('p', { class: 'portal-message-title' }, r ? 'Edita tu reseña' : '¿Cómo te fue con tu proyecto?'));
    if (!r) form.appendChild(el('p', { class: 'portal-meta' }, 'Tu opinión ayuda a otras personas a decidir. Revisamos cada reseña antes de publicarla.'));

    var fs = el('fieldset', { class: 'stars-input' });
    fs.appendChild(el('legend', null, 'Calificación'));
    var group = 'estrellas-' + item.id;
    for (var n = 5; n >= 1; n--) {
      var id = group + '-' + n;
      var input = el('input', { type: 'radio', name: group, id: id, value: String(n) });
      if (r && r.estrellas === n) input.checked = true;
      var label = el('label', { for: id, title: n + (n === 1 ? ' estrella' : ' estrellas') });
      label.appendChild(el('span', { 'aria-hidden': 'true' }, '★'));
      label.appendChild(el('span', { class: 'sr-only' }, n + (n === 1 ? ' estrella' : ' estrellas')));
      fs.appendChild(input);
      fs.appendChild(label);
    }
    form.appendChild(fs);

    var textoId = 'texto-' + item.id;
    var tl = el('label', { class: 'request-field', for: textoId });
    tl.appendChild(el('span', null, 'Tu comentario'));
    var texto = el('textarea', { id: textoId, rows: '3', minlength: '10', maxlength: '600', placeholder: 'Ej.: Me mostraron avances durante el proceso y la página quedó como la necesitaba.' });
    texto.value = r ? r.texto : '';
    tl.appendChild(texto);
    form.appendChild(tl);

    var nombreId = 'nombre-' + item.id;
    var nl = el('label', { class: 'request-field', for: nombreId });
    nl.appendChild(el('span', null, 'Nombre con el que aparecerá'));
    var nombre = el('input', { id: nombreId, type: 'text', maxlength: '60', placeholder: 'Ej.: Ana P.' });
    nombre.value = r ? r.nombre : nombrePublico(currentUser || {});
    nl.appendChild(nombre);
    form.appendChild(nl);

    var error = el('p', { class: 'admin-error', role: 'alert', hidden: '' });
    form.appendChild(error);

    var actions = el('div', { class: 'btn-row' });
    var submit = el('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, r ? 'Guardar cambios' : 'Enviar reseña');
    actions.appendChild(submit);
    if (r) {
      var cancel = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Cancelar');
      cancel.addEventListener('click', function () { delete editando[item.id]; render(lastItems, lastEmail); });
      actions.appendChild(cancel);
    }
    form.appendChild(actions);

    form.addEventListener('input', function () { error.hidden = true; });
    form.addEventListener('change', function () { error.hidden = true; });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var elegido = form.querySelector('input[name="' + group + '"]:checked');
      var datos = { estrellas: elegido ? Number(elegido.value) : 0, texto: texto.value.trim(), nombre: nombre.value.trim() };
      var problema = !datos.estrellas ? 'Elige de 1 a 5 estrellas.'
        : datos.texto.length < 10 ? 'Escribe un comentario de al menos 10 caracteres.'
        : datos.nombre.length < 2 ? 'Escribe el nombre con el que quieres aparecer.' : '';
      if (problema) { error.textContent = problema; error.hidden = false; return; }
      error.hidden = true;
      submit.disabled = true;
      submit.textContent = 'Guardando…';

      var ref = db.collection('resenas').doc(item.id);
      var ahora = firebase.firestore.FieldValue.serverTimestamp();
      var guardar = r
        ? ref.update({ nombre: datos.nombre, estrellas: datos.estrellas, texto: datos.texto, estado: 'pendiente', actualizada: ahora })
        : ref.set({ nombre: datos.nombre, estrellas: datos.estrellas, texto: datos.texto, tipo: item.tipo, uid: currentUser.uid, estado: 'pendiente', creada: ahora });
      guardar.then(function () {
        delete editando[item.id];
        avisos[item.id] = '¡Gracias! Recibimos tu reseña. Aparecerá en la página cuando la revisemos.';
        document.activeElement && document.activeElement.blur && document.activeElement.blur();
        render(lastItems, lastEmail);
      }).catch(function (err) {
        submit.disabled = false;
        submit.textContent = r ? 'Guardar cambios' : 'Enviar reseña';
        error.textContent = err.code === 'permission-denied'
          ? 'No pudimos guardar la reseña. Solo se pueden calificar proyectos entregados.'
          : 'No pudimos guardar la reseña. Revisa tu conexión e inténtalo de nuevo.';
        error.hidden = false;
      });
    });

    box.appendChild(form);
    return box;
  }

  /* ---------- Render ---------- */
  function millis(ts) { return ts && ts.toMillis ? ts.toMillis() : 0; }

  var dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  var dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' });
  function fmt(ts, f) { return ts && ts.toDate ? (f || dateTime).format(ts.toDate()) : ''; }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  function stepper(estado) {
    var ol = el('ol', { class: 'steps-track', 'aria-label': 'Avance de la solicitud' });
    estados.filter(function (e) { return e.paso > 0; }).forEach(function (e) {
      var state = e.paso < estado.paso ? 'done' : e.paso === estado.paso ? 'current' : 'todo';
      var li = el('li', { class: 'is-' + state });
      if (state === 'current') li.setAttribute('aria-current', 'step');
      li.appendChild(el('span', { class: 'dot', 'aria-hidden': 'true' }));
      li.appendChild(el('span', { class: 'label' }, e.cliente));
      if (state === 'done') li.appendChild(el('span', { class: 'sr-only' }, ' (completado)'));
      ol.appendChild(li);
    });
    return ol;
  }

  function card(item) {
    var estado = estadoDe(item.estado);
    var article = el('article', { class: 'request portal-card', 'data-grupo': estado.paso === 0 ? 'descartado' : estado.paso === 6 ? 'entregado' : estado.paso === 1 ? 'nuevo' : 'encurso' });

    var head = el('header', { class: 'request-head' });
    var who = el('div');
    who.appendChild(el('h2', null, item.tipo || 'Solicitud'));
    if (item.negocio) who.appendChild(el('p', { class: 'request-business' }, item.negocio));
    head.appendChild(who);
    head.appendChild(el('span', { class: 'status-pill' }, estado.cliente));
    article.appendChild(head);

    article.appendChild(el('p', { class: 'portal-meta' }, 'Enviada el ' + fmt(item.creado, dateOnly)));

    if (estado.paso > 0) {
      article.appendChild(stepper(estado));
    }
    article.appendChild(el('p', { class: 'portal-status' }, estado.texto));

    if (item.mensaje) {
      var box = el('div', { class: 'portal-message' });
      box.appendChild(el('p', { class: 'portal-message-title' }, 'Mensaje de Funcode'));
      box.appendChild(el('p', { class: 'portal-message-text' }, item.mensaje));
      if (item.actualizado) box.appendChild(el('p', { class: 'portal-meta' }, 'Actualizado: ' + fmt(item.actualizado)));
      article.appendChild(box);
    }

    var details = el('details', { class: 'portal-details' });
    details.appendChild(el('summary', null, 'Ver lo que enviaste'));
    var dl = el('dl');
    [
      ['Idea', item.descripcion],
      ['Presupuesto', item.presupuesto || 'Aún no lo sabías'],
      ['Para cuándo', /^\d{4}-\d{2}-\d{2}$/.test(item.fecha || '') ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(item.fecha + 'T00:00:00Z')) : 'Sin fecha'],
      ['WhatsApp', item.whatsapp || '—']
    ].forEach(function (row) {
      dl.appendChild(el('dt', null, row[0]));
      dl.appendChild(el('dd', null, row[1]));
    });
    details.appendChild(dl);
    article.appendChild(details);

    if (estado.paso === 6) article.appendChild(reviewBlock(item));

    return article;
  }

  function render(items, email) {
    // No redibujar mientras el cliente escribe su reseña.
    var active = document.activeElement;
    if (active && list.contains(active) && /^(TEXTAREA|INPUT)$/.test(active.tagName)) {
      pendingRender = true;
      return;
    }
    pendingRender = false;
    list.innerHTML = '';
    items.forEach(function (item) { list.appendChild(card(item)); });

    var empty = $('empty');
    empty.hidden = items.length > 0;
    empty.innerHTML = '';
    if (!items.length) {
      empty.appendChild(el('p', null, 'No encontramos solicitudes enviadas con ' + email + '.'));
      var p = el('p', null, 'Si usaste otro correo en el formulario, entra con la cuenta de Google de ese correo. ');
      p.appendChild(el('a', { href: $('new-request').getAttribute('href') }, 'O envía una solicitud nueva'));
      p.appendChild(document.createTextNode('.'));
      empty.appendChild(p);
    }
  }
  list.addEventListener('focusout', function () {
    setTimeout(function () {
      if (pendingRender && !list.contains(document.activeElement)) render(lastItems, lastEmail);
    }, 0);
  });
})();
