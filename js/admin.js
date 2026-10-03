/* Funcode Studio CB — panel del organizador (Firebase Auth + Firestore) */
(function () {
  'use strict';

  var config = window.FUNCODE_CONFIG || {};
  var fb = config.firebase || {};
  var $ = function (id) { return document.getElementById(id); };
  var STATES = ['config', 'loading', 'login', 'denied', 'error', 'app'];
  var ESTADOS = window.FUNCODE_ESTADOS || [];
  var estadoDe = window.FUNCODE_ESTADO;

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

  // Solo para pruebas locales: http://localhost:8080/admin.html?emulador
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]emulador\b/.test(location.search)) {
    auth.useEmulator('http://127.0.0.1:9099');
    db.useEmulator('127.0.0.1', 8085);
  }

  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  var items = [];
  var notas = {};        // notas privadas por id de solicitud (colección /notas)
  var unsubscribeNotas = null;
  var migrados = {};
  var resenas = [];
  var unsubscribeResenas = null;
  var filtroResenas = 'pendiente';
  var filter = 'todas';
  var query = '';
  var unsubscribe = null;
  var pendingRender = false;
  var list = $('requests');

  /* ---------- Sesión ---------- */
  function loginError(err) {
    var box = $('login-error');
    var messages = {
      'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase. Agrégalo en Authentication → Configuración → Dominios autorizados.',
      'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de terminar. Inténtalo de nuevo.',
      'auth/cancelled-popup-request': '',
      'auth/network-request-failed': 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
      'auth/operation-not-allowed': 'El inicio de sesión con Google no está activado en Firebase (Authentication → Método de inicio de sesión).'
    };
    var text = err && err.code in messages ? messages[err.code] : 'No se pudo iniciar sesión (' + (err && err.code || 'error desconocido') + ').';
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

  function signOut() { auth.signOut(); }
  $('logout-btn').addEventListener('click', signOut);
  $('switch-btn').addEventListener('click', signOut);
  $('retry-btn').addEventListener('click', function () { listen(); });

  auth.onAuthStateChanged(function (user) {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (unsubscribeNotas) { unsubscribeNotas(); unsubscribeNotas = null; }
    if (unsubscribeResenas) { unsubscribeResenas(); unsubscribeResenas = null; }
    resenas = [];
    notas = {};
    $('admin-user').hidden = !user;
    if (!user) {
      items = [];
      document.title = 'Panel del organizador | Funcode Studio CB';
      show('login');
      return;
    }
    $('admin-email').textContent = user.email || '';
    listen();
  });

  /* ---------- Datos en tiempo real ---------- */
  function listen() {
    if (unsubscribe) unsubscribe();
    show('loading');
    unsubscribe = db.collection('solicitudes').orderBy('creado', 'desc').onSnapshot(function (snap) {
      items = snap.docs.map(function (doc) {
        var data = doc.data({ serverTimestamps: 'estimate' });
        data.id = doc.id;
        data.confirmado = !doc.metadata.hasPendingWrites;
        return data;
      });
      show('app');
      listenNotes();
      listenResenas();
      migrateNotes();
      render();
    }, function (err) {
      unsubscribe = null;
      if (err.code === 'permission-denied') {
        $('denied-email').textContent = (auth.currentUser && auth.currentUser.email) || '';
        show('denied');
      } else {
        $('load-error').textContent = err.message || String(err);
        show('error');
      }
    });
  }

  function listenNotes() {
    if (unsubscribeNotas) return;
    unsubscribeNotas = db.collection('notas').onSnapshot(function (snap) {
      notas = {};
      snap.forEach(function (doc) { notas[doc.id] = doc.data().texto || ''; });
      render();
    }, function () { unsubscribeNotas = null; });
  }

  /* ---------- Reseñas ---------- */
  function listenResenas() {
    if (unsubscribeResenas) return;
    unsubscribeResenas = db.collection('resenas').orderBy('creada', 'desc').onSnapshot(function (snap) {
      resenas = snap.docs.map(function (doc) {
        var data = doc.data({ serverTimestamps: 'estimate' });
        data.id = doc.id;
        return data;
      });
      renderResenas();
      render();
    }, function () { unsubscribeResenas = null; });
  }

  var ESTADOS_RESENA = { pendiente: 'Pendiente', publicada: 'Publicada', oculta: 'No publicada' };

  function cambiarResena(id, estado) {
    db.collection('resenas').doc(id).update({ estado: estado }).catch(fail);
  }

  function resenaCard(r) {
    var article = el('article', { class: 'request review-admin', 'data-resena': r.estado });
    var head = el('header', { class: 'request-head' });
    var who = el('div');
    who.appendChild(el('h3', null, r.nombre));
    who.appendChild(el('p', { class: 'request-business' }, r.tipo || ''));
    head.appendChild(who);
    head.appendChild(el('span', { class: 'status-pill' }, ESTADOS_RESENA[r.estado] || r.estado));
    article.appendChild(head);

    var stars = el('p', { class: 'stars', role: 'img', 'aria-label': r.estrellas + ' de 5 estrellas' });
    stars.textContent = '★★★★★'.slice(0, r.estrellas) + '☆☆☆☆☆'.slice(0, 5 - r.estrellas);
    article.appendChild(stars);
    article.appendChild(el('p', { class: 'request-text' }, r.texto));

    var solicitud = items.filter(function (i) { return i.id === r.id; })[0];
    var meta = 'Recibida: ' + created({ creado: r.creada }) + (r.actualizada ? ' · Editada: ' + created({ creado: r.actualizada }) : '');
    if (solicitud) meta += ' · Cliente: ' + solicitud.nombre + ' (' + solicitud.correo + ')';
    article.appendChild(el('p', { class: 'request-email' }, meta));

    var actions = el('div', { class: 'request-contact' });
    if (r.estado !== 'publicada') {
      var pub = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Publicar');
      pub.addEventListener('click', function () { cambiarResena(r.id, 'publicada'); });
      actions.appendChild(pub);
    }
    if (r.estado !== 'oculta') {
      var hide = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, r.estado === 'publicada' ? 'Quitar de la página' : 'No publicar');
      hide.addEventListener('click', function () { cambiarResena(r.id, 'oculta'); });
      actions.appendChild(hide);
    }
    var del = el('button', { class: 'btn-link-danger', type: 'button' }, 'Eliminar');
    del.addEventListener('click', function () {
      if (window.confirm('¿Eliminar la reseña de ' + r.nombre + '? El cliente podrá escribir una nueva.')) {
        db.collection('resenas').doc(r.id).delete().catch(fail);
      }
    });
    actions.appendChild(del);
    article.appendChild(actions);
    return article;
  }

  function renderResenas() {
    var counts = { todas: resenas.length, pendiente: 0, publicada: 0, oculta: 0 };
    resenas.forEach(function (r) { counts[r.estado] = (counts[r.estado] || 0) + 1; });
    document.querySelectorAll('[data-count-r]').forEach(function (span) {
      span.textContent = counts[span.getAttribute('data-count-r')] || 0;
    });
    var badge = $('resenas-pendientes');
    badge.textContent = counts.pendiente;
    badge.hidden = !counts.pendiente;

    var visibles = resenas.filter(function (r) { return filtroResenas === 'todas' || r.estado === filtroResenas; });
    var listR = $('resenas-list');
    listR.innerHTML = '';
    visibles.forEach(function (r) { listR.appendChild(resenaCard(r)); });
    var empty = $('resenas-empty');
    empty.hidden = visibles.length > 0;
    empty.textContent = resenas.length
      ? 'No hay reseñas con este filtro.'
      : 'Todavía no hay reseñas. Los clientes pueden escribir una desde «Mis solicitudes» cuando marcas su proyecto como Entregada.';
  }

  document.querySelectorAll('.filter-r').forEach(function (btn) {
    btn.addEventListener('click', function () {
      filtroResenas = btn.getAttribute('data-filter-r');
      document.querySelectorAll('.filter-r').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      renderResenas();
    });
  });

  // Pestañas Solicitudes / Reseñas (teclado: flechas izquierda y derecha).
  var tabs = [$('tab-solicitudes'), $('tab-resenas')];
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });

  function fail(err) {
    window.alert('No se pudo guardar el cambio: ' + (err.message || err));
  }

  // Cambios visibles para el cliente: siempre con la fecha de actualización.
  function update(id, data) {
    data.actualizado = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('solicitudes').doc(id).update(data).catch(fail);
  }

  function saveNote(id, texto) {
    return db.collection('notas').doc(id).set({
      texto: texto,
      actualizado: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(fail);
  }

  // Versión anterior: las notas estaban dentro de la solicitud (y el cliente podría verlas).
  // Se mueven a /notas y se borran de la solicitud.
  function migrateNotes() {
    items.forEach(function (item) {
      if (typeof item.notas !== 'string' || !item.confirmado || migrados[item.id]) return;
      migrados[item.id] = true;
      var texto = item.notas.slice(0, 2000);
      var previa = notas[item.id];
      saveNote(item.id, previa ? previa + '\n' + texto : texto).then(function () {
        return update(item.id, { notas: firebase.firestore.FieldValue.delete() });
      });
    });
  }

  /* ---------- Utilidades ---------- */
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  var dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  var dateOnly = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' });

  function created(item) {
    return item.creado && item.creado.toDate ? dateTime.format(item.creado.toDate()) : '';
  }

  function wanted(item) {
    if (!item.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(item.fecha)) return '';
    return dateOnly.format(new Date(item.fecha + 'T00:00:00Z'));
  }

  function waNumber(value) {
    var digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10 && digits.charAt(0) === '3') digits = '57' + digits; // celular colombiano sin indicativo
    return digits.length >= 8 ? digits : '';
  }

  function firstName(item) { return String(item.nombre || '').trim().split(/\s+/)[0]; }

  function summary(item) {
    return [
      'Solicitud de ' + item.nombre + (item.negocio ? ' (' + item.negocio + ')' : ''),
      'Correo: ' + item.correo,
      item.whatsapp ? 'WhatsApp: ' + item.whatsapp : '',
      'Tipo: ' + item.tipo,
      'Presupuesto: ' + (item.presupuesto || 'Aún no lo sabe'),
      item.fecha ? 'Para: ' + wanted(item) : '',
      'Recibida: ' + created(item),
      '',
      item.descripcion
    ].filter(function (l, i) { return l !== '' || i === 7; }).join('\n');
  }

  function copy(text, btn) {
    var done = function (label) {
      btn.textContent = label;
      setTimeout(function () { btn.textContent = 'Copiar'; }, 2000);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done('¡Copiada!'); }, function () { done('No se pudo copiar'); });
    } else {
      done('No se pudo copiar');
    }
  }

  /* ---------- Render ---------- */
  function grupo(item) {
    var paso = estadoDe(item.estado).paso;
    if (paso === 0) return 'descartado';
    if (paso === 1) return 'nuevo';
    if (paso === 6) return 'entregado';
    return 'encurso';
  }

  function matches(item) {
    if (filter !== 'todas' && grupo(item) !== filter) return false;
    if (!query) return true;
    return [item.nombre, item.negocio, item.correo, item.whatsapp, item.tipo, item.descripcion, item.mensaje, notas[item.id]]
      .join(' ').toLowerCase().indexOf(query) !== -1;
  }

  function card(item) {
    var article = el('article', { class: 'request', 'data-grupo': grupo(item) });

    var head = el('header', { class: 'request-head' });
    var who = el('div');
    who.appendChild(el('h2', null, item.nombre || 'Sin nombre'));
    if (item.negocio) who.appendChild(el('p', { class: 'request-business' }, item.negocio));
    head.appendChild(who);
    head.appendChild(el('time', { class: 'request-date' }, created(item)));
    article.appendChild(head);

    var chips = el('ul', { class: 'chips request-chips', 'aria-label': 'Datos del proyecto' });
    chips.appendChild(el('li', null, item.tipo));
    chips.appendChild(el('li', null, 'Presupuesto: ' + (item.presupuesto || 'no sabe')));
    if (item.fecha) chips.appendChild(el('li', null, 'Para: ' + wanted(item)));
    article.appendChild(chips);

    article.appendChild(el('p', { class: 'request-text' }, item.descripcion));

    var contact = el('div', { class: 'request-contact' });
    var mail = el('a', {
      class: 'btn btn-primary btn-sm',
      href: 'mailto:' + item.correo +
        '?subject=' + encodeURIComponent('Tu solicitud en Funcode Studio CB') +
        '&body=' + encodeURIComponent('Hola, ' + firstName(item) + ':\n\nGracias por escribirnos sobre tu proyecto (' + item.tipo + ').\n\n')
    }, 'Responder por correo');
    contact.appendChild(mail);

    var wa = waNumber(item.whatsapp);
    if (wa) {
      contact.appendChild(el('a', {
        class: 'btn btn-ghost btn-sm',
        href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent('Hola, ' + firstName(item) + '. Te escribo de Funcode Studio CB por tu solicitud de ' + String(item.tipo).toLowerCase() + '.'),
        target: '_blank',
        rel: 'noopener'
      }, 'WhatsApp'));
    }

    var copyBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Copiar');
    copyBtn.addEventListener('click', function () { copy(summary(item), copyBtn); });
    contact.appendChild(copyBtn);
    contact.appendChild(el('span', { class: 'request-email' }, item.correo + (item.whatsapp ? ' · ' + item.whatsapp : '')));
    article.appendChild(contact);

    var manage = el('div', { class: 'request-manage' });

    var stateField = el('label', { class: 'request-field' });
    stateField.appendChild(el('span', null, 'Estado'));
    var select = el('select');
    var actual = estadoDe(item.estado).id;
    ESTADOS.forEach(function (e) {
      var option = el('option', { value: e.id }, e.admin);
      if (actual === e.id) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', function () { update(item.id, { estado: select.value }); });
    stateField.appendChild(select);
    manage.appendChild(stateField);

    var messageField = el('label', { class: 'request-field request-notes' });
    messageField.appendChild(el('span', null, 'Mensaje para el cliente (lo ve en «Mis solicitudes»)'));
    var message = el('textarea', { rows: '2', maxlength: '1000', placeholder: 'Ej.: Te envié la propuesta a tu correo' });
    message.value = item.mensaje || '';
    message.addEventListener('change', function () { update(item.id, { mensaje: message.value.trim() }); });
    messageField.appendChild(message);
    manage.appendChild(messageField);

    var notesField = el('label', { class: 'request-field request-notes request-private' });
    notesField.appendChild(el('span', null, 'Notas privadas (solo tú las ves)'));
    var notes = el('textarea', { rows: '2', maxlength: '2000', placeholder: 'Ej.: llamar el lunes' });
    notes.value = notas[item.id] || (typeof item.notas === 'string' ? item.notas : '');
    notes.addEventListener('change', function () { saveNote(item.id, notes.value.trim()); });
    notesField.appendChild(notes);
    manage.appendChild(notesField);

    var del = el('button', { class: 'btn-link-danger', type: 'button' }, 'Eliminar');
    del.addEventListener('click', function () {
      if (window.confirm('¿Eliminar la solicitud de ' + item.nombre + '? No se puede deshacer.')) {
        db.collection('solicitudes').doc(item.id).delete().then(function () {
          return db.collection('notas').doc(item.id).delete();
        }).catch(function (err) {
          window.alert('No se pudo eliminar: ' + (err.message || err));
        });
      }
    });
    manage.appendChild(del);
    article.appendChild(manage);

    return article;
  }

  function render() {
    // No redibujar mientras se escribe una nota o se elige un estado.
    var active = document.activeElement;
    if (active && list.contains(active) && /^(TEXTAREA|SELECT)$/.test(active.tagName)) {
      pendingRender = true;
      return;
    }
    pendingRender = false;

    var counts = { todas: items.length, nuevo: 0, encurso: 0, entregado: 0, descartado: 0 };
    items.forEach(function (i) { counts[grupo(i)] += 1; });
    document.querySelectorAll('[data-count]').forEach(function (span) {
      span.textContent = counts[span.getAttribute('data-count')] || 0;
    });
    var pendientes = counts.nuevo + resenas.filter(function (r) { return r.estado === 'pendiente'; }).length;
    document.title = (pendientes ? '(' + pendientes + ') ' : '') + 'Panel del organizador | Funcode Studio CB';

    var visible = items.filter(matches);
    list.innerHTML = '';
    visible.forEach(function (item) { list.appendChild(card(item)); });

    var empty = $('empty');
    empty.hidden = visible.length > 0;
    empty.textContent = items.length
      ? 'No hay solicitudes con este filtro.'
      : 'Todavía no han llegado solicitudes. Cuando alguien llene el formulario, aparecerá aquí al instante.';
  }

  list.addEventListener('focusout', function () {
    setTimeout(function () { if (pendingRender) render(); }, 0);
  });

  document.querySelectorAll('.filter[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      filter = btn.getAttribute('data-filter');
      document.querySelectorAll('.filter[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      render();
    });
  });

  $('search').addEventListener('input', function (e) {
    query = e.target.value.trim().toLowerCase();
    render();
  });
})();
