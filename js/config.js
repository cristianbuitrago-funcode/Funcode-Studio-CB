/*
 * Configuración de Funcode Studio CB
 * ----------------------------------
 * Este es el ÚNICO archivo que hay que editar para conectar los datos de contacto,
 * las redes sociales y el formulario. Todo lo que quede vacío ('') se muestra en la
 * página como «Próximamente» y nunca como un enlace falso.
 *
 * PENDIENTE DE REEMPLAZAR (marcado con TODO):
 *   - instagram / facebook → URL completa del perfil
 */
window.FUNCODE_CONFIG = {
  // Número de WhatsApp (solo dígitos, con 57 para Colombia).
  whatsapp: '573202920181',

  // Correo de contacto público.
  email: 'buitragocristianespinosa@gmail.com',

  // Configuración del proyecto de Firebase (ver FIREBASE.md).
  // Con esto el formulario guarda cada solicitud en Firestore y el panel
  // del organizador (admin.html) las muestra. Firebase Console → Configuración
  // del proyecto → Tus apps → App web → objeto «firebaseConfig».
  firebase: {
    apiKey: 'AIzaSyBQQmAB4AEDXhM7b9zRpOUV255NTqb7Vts',
    authDomain: 'funcode-studio-cb.firebaseapp.com',
    projectId: 'funcode-studio-cb',
    appId: '1:603572417154:web:8f72fcee78678b1a3b7a9b'
  },

  // Aviso por WhatsApp cuando llega una solicitud: dirección /exec de la aplicación web
  // de Google Apps Script (ver AVISO-WHATSAPP.md). Vacío = sin aviso.
  avisoWhatsappUrl: 'https://script.google.com/macros/s/AKfycbwZ-arqGe-C4LYOhGwf7lwoPNUcaAHnrhkLOfuE-Ce8t7TXe-pE8ZlTBjRy5VfO_KG6/exec',

  // Opcional: endpoint alternativo (Formspree, Getform...). Solo se usa si
  // Firebase no está configurado. Debe aceptar POST con FormData y responder 2xx.
  formEndpoint: '',

  social: {
    instagram: '', // TODO
    facebook: '',  // TODO
    linkedin: 'https://www.linkedin.com/in/cristian-camilo-buitrago-espinosa-549044366/',
    github: 'https://github.com/cristianbuitrago-funcode'
  },

  // Mensaje inicial al abrir WhatsApp desde los botones de la página.
  whatsappMessage: 'Hola, Funcode Studio CB. Vi su página web y quiero hablar sobre un proyecto.'
};
