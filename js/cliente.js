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
  var list = $('requests');

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
    $('new-request').href = './?correo=' + encodeURIComponent(email) +
      (name ? '&nombre=' + encodeURIComponent(name) : '') + '#contacto';

    unsubscribe = db.collection('solicitudes').where('correo', '==', email).onSnapshot(function (snap) {
      var items = snap.docs.map(function (doc) {
        var data = doc.data({ serverTimestamps: 'estimate' });
        data.id = doc.id;
        return data;
      });
      items.sort(function (a, b) { return millis(b.creado) - millis(a.creado); });
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

    return article;
  }

  function render(items, email) {
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
})();
