/*
 * Configuración de Funcode Studio CB
 * ----------------------------------
 * Este es el ÚNICO archivo que hay que editar para conectar los datos de contacto,
 * las redes sociales y el formulario. Todo lo que quede vacío ('') se muestra en la
 * página como «Próximamente» y nunca como un enlace falso.
 *
 * PENDIENTE DE REEMPLAZAR (marcado con TODO):
 *   - whatsapp       → número con indicativo de país, solo dígitos. Ej: '573001234567'
 *   - email          → correo público de contacto. Ej: 'hola@tudominio.com'
 *   - firebase       → datos de tu proyecto de Firebase (ver FIREBASE.md)
 *   - instagram / facebook / linkedin → URL completa del perfil
 */
window.FUNCODE_CONFIG = {
  // TODO: número de WhatsApp (solo dígitos, con 57 para Colombia).
  whatsapp: '',

  // TODO: correo de contacto público.
  email: '',

  // TODO: configuración de tu proyecto de Firebase (ver FIREBASE.md).
  // Con esto el formulario guarda cada solicitud en Firestore y el panel
  // del organizador (admin.html) las muestra. Firebase Console → Configuración
  // del proyecto → Tus apps → App web → objeto «firebaseConfig».
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    appId: ''
  },

  // Opcional: endpoint alternativo (Formspree, Getform...). Solo se usa si
  // Firebase no está configurado. Debe aceptar POST con FormData y responder 2xx.
  formEndpoint: '',

  social: {
    instagram: '', // TODO
    facebook: '',  // TODO
    linkedin: '',  // TODO
    github: 'https://github.com/cristianbuitrago-funcode'
  },

  // Mensaje inicial al abrir WhatsApp desde los botones de la página.
  whatsappMessage: 'Hola, Funcode Studio CB. Vi su página web y quiero hablar sobre un proyecto.'
};
