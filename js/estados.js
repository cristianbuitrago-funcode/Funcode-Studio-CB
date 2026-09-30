/* Estados de una solicitud: los usan el panel del organizador y el portal del cliente. */
window.FUNCODE_ESTADOS = [
  { id: 'nuevo', admin: 'Nueva', cliente: 'Recibida', paso: 1,
    texto: 'Recibimos tu solicitud. Pronto la revisaremos.' },
  { id: 'revision', admin: 'En revisión', cliente: 'En revisión', paso: 2,
    texto: 'Estamos revisando tu idea para definir el alcance.' },
  { id: 'propuesta', admin: 'Propuesta enviada', cliente: 'Propuesta enviada', paso: 3,
    texto: 'Te enviamos una propuesta con alcance, tiempos y valor.' },
  { id: 'aprobado', admin: 'Aprobada', cliente: 'Aprobada', paso: 4,
    texto: 'Propuesta aprobada. Pronto empezamos el desarrollo.' },
  { id: 'desarrollo', admin: 'En desarrollo', cliente: 'En desarrollo', paso: 5,
    texto: 'Estamos construyendo tu proyecto y te mostraremos avances.' },
  { id: 'entregado', admin: 'Entregada', cliente: 'Entregada', paso: 6,
    texto: '¡Proyecto entregado! Gracias por confiar en Funcode.' },
  { id: 'descartado', admin: 'Descartada', cliente: 'Cerrada', paso: 0,
    texto: 'Esta solicitud se cerró. Si tienes dudas, escríbenos.' }
];

window.FUNCODE_ESTADO = function (id) {
  if (id === 'respondido') id = 'propuesta'; // estado de la versión anterior
  var list = window.FUNCODE_ESTADOS;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return list[0];
};
