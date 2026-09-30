# Aviso por WhatsApp cuando llega una solicitud

Cuando un cliente envía el formulario, te llega un WhatsApp como este:

```
🔔 Nueva solicitud en Funcode Studio CB
👤 Ana Pérez
🧩 Página web
💰 $160.000 – $400.000 COP

Revísala en el panel: https://cristianbuitrago-funcode.github.io/Funcode-Studio-CB/admin.html
```

**Cómo funciona:** la página guarda la solicitud en Firebase (igual que antes) y luego le avisa a
un pequeño programa en **Google Apps Script**. Ese programa te escribe por WhatsApp usando
**CallMeBot**, un servicio gratuito. Tu llave de CallMeBot queda guardada dentro de Apps Script y
nunca aparece en la página pública.

- Máximo 10 avisos por hora, para que nadie pueda llenarte el WhatsApp de mensajes.
- Si el aviso falla, la solicitud igual queda guardada en el panel.
- CallMeBot es un servicio gratuito y no oficial: a veces tarda unos segundos o puede fallar.
  El panel sigue siendo el registro principal.

> Te recomiendo hacer las partes 2 a 5 **desde un computador**. El editor de Apps Script casi no
> funciona en el celular. Si solo tienes celular, en Chrome toca **⋮ → Sitio de escritorio**.

---

## Parte 1: activar CallMeBot en tu WhatsApp (desde el celular)

1. Abre <https://www.callmebot.com/blog/free-api-whatsapp-messages/>.
2. Busca el **número de teléfono de CallMeBot** que aparece en esa página y guárdalo en los
   contactos de tu celular (por ejemplo, con el nombre «CallMeBot»). Usa el número que diga la
   página: a veces lo cambian.
3. Abre WhatsApp, entra al chat de ese contacto y envía exactamente este mensaje:

   ```
   I allow callmebot to send me messages
   ```

4. Espera la respuesta (puede tardar hasta 2 minutos). Dirá algo como:
   *«CallMeBot API Activated for 57300… (o 1090…@lid). Your apikey is: 1234567»*.
   **Guarda las dos cosas:** lo que dice después de «Activated for» y la apikey.
5. **Guarda ese número (tu APIKEY) en un lugar privado.** No lo compartas con nadie ni lo
   pegues en la página. Si no llega respuesta en unos minutos, vuelve a enviar el mensaje.

## Parte 2: crear el proyecto en Google Apps Script

1. En el computador, abre <https://script.google.com> y entra con tu cuenta de Google
   (`buitragocristianespinosa@gmail.com`).
2. Arriba a la izquierda, pulsa **«Nuevo proyecto»**.
3. Se abre el editor con un archivo llamado **Código.gs** que tiene algo como
   `function myFunction() { }`.
4. Arriba a la izquierda, donde dice **«Proyecto sin título»**, haz clic y cámbialo a
   `Aviso WhatsApp Funcode`. Pulsa **Cambiar nombre**.

## Parte 3: pegar el código

1. Abre el código en otra pestaña:
   <https://raw.githubusercontent.com/cristianbuitrago-funcode/Funcode-Studio-CB/main/apps-script/aviso-whatsapp.gs>
2. Selecciona todo (**Ctrl + A**) y cópialo (**Ctrl + C**).
3. Vuelve a Apps Script, haz clic dentro del editor de **Código.gs**, selecciona todo
   (**Ctrl + A**) y **bórralo**.
4. Pega el código (**Ctrl + V**).
5. Guarda con el ícono del **disquete 💾** (arriba) o con **Ctrl + S**.

## Parte 4: guardar tu llave y tu número (en privado)

1. En la barra de la izquierda, haz clic en el **engranaje ⚙️ «Configuración del proyecto»**.
2. Baja hasta **«Propiedades de la secuencia de comandos»** y pulsa
   **«Agregar propiedad de la secuencia de comandos»**.
3. Llena la primera:
   - **Propiedad:** `CALLMEBOT_APIKEY`
   - **Valor:** tu APIKEY de la Parte 1 (solo el número)
4. Pulsa **«Agregar propiedad de la secuencia de comandos»** otra vez y llena la segunda:
   - **Propiedad:** `WHATSAPP_PHONE`
   - **Valor:** copia **exactamente** lo que dice el mensaje de CallMeBot después de
     *«API Activated for»*. Puede ser un número (por ejemplo `573114924385`) o un
     identificador que termina en `@lid` (por ejemplo `109040663277680@lid`). Si es un
     `@lid`, cópialo completo, con el `@lid` incluido.
5. Pulsa **«Guardar propiedades de la secuencia de comandos»**.

Los nombres deben quedar exactamente así, en mayúsculas y con guion bajo.

## Parte 5: probar y dar permisos

1. En la barra de la izquierda, vuelve al editor con el ícono **`< >` «Editor»**.
2. Arriba, al lado de los botones **Ejecutar** y **Depurar**, hay un menú desplegable con el
   nombre de una función. Elige **`probarAviso`**.
3. Pulsa **▶ Ejecutar**.
4. La primera vez, Google pide permisos:
   1. Pulsa **«Revisar permisos»** y elige tu cuenta.
   2. Aparece **«Google no verificó esta app»**. Es normal: la app es tuya.
      Pulsa **«Configuración avanzada»** y luego
      **«Ir a Aviso WhatsApp Funcode (no seguro)»**.
   3. Pulsa **«Permitir»**. El permiso es para «conectarse a un servicio externo», que es
      CallMeBot.
5. Abajo aparece el **Registro de ejecución**. Debe terminar en **«Ejecución completada»**.
6. En unos segundos te llega por WhatsApp:
   *«✅ Prueba de Funcode Studio CB: los avisos por WhatsApp funcionan.»*

Si sale un error, revisa la tabla del final.

## Parte 6: publicar el script como aplicación web

1. Arriba a la derecha, pulsa el botón azul **«Implementar» → «Nueva implementación»**.
2. Junto a **«Seleccionar tipo»**, pulsa el **engranaje ⚙️** y elige **«Aplicación web»**.
3. Llena:
   - **Descripción:** `Aviso de solicitudes`
   - **Ejecutar como:** **Yo** (tu correo)
   - **Quién tiene acceso:** **Cualquier usuario**
4. Pulsa **«Implementar»**. Si vuelve a pedir permisos, repite el paso 4 de la Parte 5.
5. Aparece **«URL de la aplicación web»**, que termina en **`/exec`**. Pulsa **Copiar**.
6. **Envíale esa URL a Claude** (o pégala en `avisoWhatsappUrl` dentro de `js/config.js`) y
   publica el cambio.

«Cualquier usuario» significa que la página puede enviarle avisos al script sin iniciar sesión.
Nadie puede ver tu llave ni tu código desde esa URL; lo único que se puede hacer con ella es pedir
un aviso, y el script limita esos avisos a 10 por hora.

---

## Si cambias el código más adelante

Después de editar el código en Apps Script, pulsa **Implementar → Administrar implementaciones**,
luego **✏️ Editar**, en **Versión** elige **«Nueva versión»** y pulsa **Implementar**.
Así la URL `/exec` sigue siendo la misma.

## Problemas comunes

| Qué pasa | Solución |
|---|---|
| «Faltan las propiedades CALLMEBOT_APIKEY o WHATSAPP_PHONE» | Parte 4: revisa que los nombres estén exactamente así y que guardaste |
| La prueba dice «Ejecución completada» pero no llega nada | Mira en el registro la línea «Respuesta de CallMeBot». `WHATSAPP_PHONE` debe ser exactamente lo que dice CallMeBot después de «Activated for» (a veces un `…@lid`, no tu número) |
| «CallMeBot respondió …» con un mensaje sobre la APIKEY | La llave está mal copiada o CallMeBot aún no la activó. Repite la Parte 1 |
| La prueba funciona, pero no llegan avisos del formulario | Revisa que implementaste como **Aplicación web** con acceso **Cualquier usuario** y que la URL termina en `/exec` |
| Llegan avisos, pero no todos | Se alcanzó el límite de 10 por hora o CallMeBot tuvo una falla. Las solicitudes siempre están en el panel |
