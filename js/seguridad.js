/*
 * Funcode Studio CB — protección contra clickjacking para las páginas privadas
 * (panel del organizador y «Mis solicitudes»).
 * GitHub Pages no permite enviar la cabecera X-Frame-Options / frame-ancestors, así que si otra
 * página intenta mostrar esta dentro de un marco (iframe) para engañar a quien la usa, se oculta
 * el contenido y se intenta abrir la página fuera del marco.
 * Se carga sin «defer» en el <head> para actuar antes de que se vea nada.
 */
(function () {
  'use strict';
  var enMarco;
  try { enMarco = window.top !== window.self; } catch (e) { enMarco = true; }
  if (!enMarco) return;
  document.documentElement.style.display = 'none';
  try { window.top.location.replace(window.self.location.href); } catch (e) { /* el marco lo bloquea: la página queda oculta */ }
})();
