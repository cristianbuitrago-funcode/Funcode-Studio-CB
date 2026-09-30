/* Funcode Studio CB — panel del organizador (Firebase Auth + Firestore) */
(function () {
  'use strict';

  var config = window.FUNCODE_CONFIG || {};
  var fb = config.firebase || {};
  var $ = function (id) { return document.getElementById(id); };
  var STATES = ['config', 'loading', 'login', 'denied', 'error', 'app'];
  var ESTADOS = [
    ['nuevo', 'Nueva'],
    ['revision', 'En revisión'],
    ['respondido', 'Respondida'],
    ['descartado', 'Descartada']
  ];

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
        return data;
      });
      show('app');
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

  function update(id, data) {
    return db.collection('solicitudes').doc(id).update(data).catch(function (err) {
      window.alert('No se pudo guardar el cambio: ' + (err.message || err));
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
  function matches(item) {
    if (filter !== 'todas' && item.estado !== filter) return false;
    if (!query) return true;
    return [item.nombre, item.negocio, item.correo, item.whatsapp, item.tipo, item.descripcion, item.notas]
      .join(' ').toLowerCase().indexOf(query) !== -1;
  }

  function card(item) {
    var article = el('article', { class: 'request', 'data-estado': item.estado || 'nuevo' });

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
    ESTADOS.forEach(function (e) {
      var option = el('option', { value: e[0] }, e[1]);
      if ((item.estado || 'nuevo') === e[0]) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', function () { update(item.id, { estado: select.value }); });
    stateField.appendChild(select);
    manage.appendChild(stateField);

    var notesField = el('label', { class: 'request-field request-notes' });
    notesField.appendChild(el('span', null, 'Notas privadas'));
    var notes = el('textarea', { rows: '2', maxlength: '2000', placeholder: 'Ej.: le envié propuesta el martes' });
    notes.value = item.notas || '';
    notes.addEventListener('change', function () { update(item.id, { notas: notes.value.trim() }); });
    notesField.appendChild(notes);
    manage.appendChild(notesField);

    var del = el('button', { class: 'btn-link-danger', type: 'button' }, 'Eliminar');
    del.addEventListener('click', function () {
      if (window.confirm('¿Eliminar la solicitud de ' + item.nombre + '? No se puede deshacer.')) {
        db.collection('solicitudes').doc(item.id).delete().catch(function (err) {
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

    var counts = { todas: items.length, nuevo: 0, revision: 0, respondido: 0, descartado: 0 };
    items.forEach(function (i) { counts[i.estado || 'nuevo'] = (counts[i.estado || 'nuevo'] || 0) + 1; });
    document.querySelectorAll('[data-count]').forEach(function (span) {
      span.textContent = counts[span.getAttribute('data-count')] || 0;
    });
    document.title = (counts.nuevo ? '(' + counts.nuevo + ') ' : '') + 'Panel del organizador | Funcode Studio CB';

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

  document.querySelectorAll('.filter').forEach(function (btn) {
    btn.addEventListener('click', function () {
      filter = btn.getAttribute('data-filter');
      document.querySelectorAll('.filter').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      render();
    });
  });

  $('search').addEventListener('input', function (e) {
    query = e.target.value.trim().toLowerCase();
    render();
  });
})();
