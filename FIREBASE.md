# Conectar el formulario y el panel a Firebase

Con Firebase, cada solicitud del formulario se guarda en **Firestore** y tú la ves en el
**panel del organizador** (`admin.html`), entrando con tu cuenta de Google.

- Cualquier visitante puede **enviar** una solicitud, pero nadie puede leerlas, modificarlas
  ni borrarlas salvo el correo que autorices en las reglas.
- La página sigue publicada en GitHub Pages; Firebase solo guarda los datos y controla el acceso.
- El plan gratuito (Spark) es suficiente: permite miles de lecturas y escrituras al día.

Tiempo estimado: 15 minutos.

## 1. Crear el proyecto

1. Entra a <https://console.firebase.google.com> con tu cuenta de Google.
2. **Crear un proyecto** → ponle un nombre (por ejemplo `funcode-studio-cb`).
3. Google Analytics no es necesario: puedes desactivarlo.

## 2. Crear la base de datos (Firestore)

1. Menú **Compilación → Firestore Database → Crear base de datos**.
2. Ubicación: una cercana, por ejemplo `southamerica-east1 (São Paulo)` o `nam5 (United States)`.
   No se puede cambiar después.
3. Elige **Iniciar en modo de producción**. Las reglas correctas se pegan en el paso 5.

## 3. Activar el inicio de sesión con Google

1. **Compilación → Authentication → Comenzar**.
2. En **Método de inicio de sesión**, elige **Google → Habilitar**, selecciona tu correo de
   asistencia y guarda.
3. En **Configuración → Dominios autorizados**, pulsa **Agregar dominio** y escribe:
   `cristianbuitrago-funcode.github.io`

## 4. Registrar la app web y copiar la configuración

1. Ícono de engranaje → **Configuración del proyecto** → sección **Tus apps** → ícono **`</>`** (Web).
2. Ponle un nombre (por ejemplo `Sitio web`). **No** actives Firebase Hosting.
3. Firebase muestra un bloque `firebaseConfig`. Copia estos cuatro valores en `js/config.js`:

```js
firebase: {
  apiKey: 'AIza...',
  authDomain: 'tu-proyecto.firebaseapp.com',
  projectId: 'tu-proyecto',
  appId: '1:123456789:web:abc123'
},
```

> La `apiKey` de Firebase **no es secreta**: identifica tu proyecto y puede estar en la página
> pública. La seguridad la dan las reglas del paso 5.

## 5. Publicar las reglas de seguridad

1. Abre el archivo `firestore.rules` de este repositorio.
2. Revisa que el correo de `isAdmin()` sea el de Google con el que vas a entrar al panel.
   Para autorizar a más personas: `['correo1@gmail.com', 'correo2@gmail.com']`.
3. En Firebase: **Firestore Database → Reglas**, borra lo que haya, pega el contenido completo
   y pulsa **Publicar**.

Qué permiten estas reglas:

| Quién | Qué puede hacer |
|---|---|
| Cualquier visitante | Crear una solicitud con los campos del formulario, con tamaños y tipo de proyecto válidos |
| Tu correo (verificado) | Ver todas las solicitudes, cambiar su estado y notas, y eliminarlas |
| Cualquier otra persona | Nada: ni leer, ni editar, ni borrar |

## 6. Probar

1. Publica los cambios de `js/config.js` (commit y push a `main`) y espera un par de minutos.
2. Llena el formulario de la página y envíalo: debe decir **«¡Solicitud enviada!»**.
3. Abre `https://cristianbuitrago-funcode.github.io/Funcode-Studio-CB/admin.html`
   (también está el enlace **«Acceso del organizador»** al final de la página).
4. Pulsa **Entrar con Google**: verás la solicitud. Las nuevas aparecen al instante.

## Qué puedes hacer en el panel

- Filtrar por estado: **Nueva**, **En revisión**, **Respondida**, **Descartada**.
- Buscar por nombre, negocio, correo, idea o notas.
- **Responder por correo** o **WhatsApp** con un mensaje inicial ya escrito.
- **Copiar** la solicitud completa.
- Escribir **notas privadas** (solo tú las ves) y **eliminar** solicitudes.
- La pestaña del navegador muestra cuántas solicitudes nuevas tienes, por ejemplo `(2) Panel…`.

## Problemas comunes

| Mensaje | Solución |
|---|---|
| «Este dominio no está autorizado en Firebase» | Paso 3: agrega `cristianbuitrago-funcode.github.io` en Dominios autorizados |
| «Esta cuenta no tiene acceso» | El correo con el que entraste no está en `firestore.rules` (paso 5) |
| «El inicio de sesión con Google no está activado» | Paso 3: habilita el proveedor Google |
| El formulario dice «No pudimos enviar tu solicitud» | Revisa que publicaste las reglas (paso 5) y que `projectId` y `apiKey` son correctos |
| El panel dice que Firebase no está configurado | Falta completar el bloque `firebase` de `js/config.js` |

## Limitaciones actuales

- **No llegan avisos automáticos**: las solicitudes se ven en el panel, pero Firebase no te
  envía un correo cuando llega una nueva. Se puede añadir con la extensión *Trigger Email* o
  una Cloud Function, que requieren el plan de pago por uso (Blaze).
- **Protección contra spam**: el formulario tiene un campo trampa y las reglas limitan el
  tamaño y formato de los datos. Si llegara spam, se puede activar **App Check** (reCAPTCHA).
- Opcional: en Google Cloud Console puedes restringir la `apiKey` para que solo funcione
  desde tu dominio.

## Probar en local con los emuladores (opcional, para desarrollo)

```bash
npx firebase-tools emulators:start --only firestore,auth --project demo-funcode
python3 -m http.server 8080
# Formulario: http://localhost:8080/?emulador
# Panel:      http://localhost:8080/admin.html?emulador
```

Para esto, `js/config.js` necesita valores en el bloque `firebase` (en local sirven
`apiKey: 'demo-key'` y `projectId: 'demo-funcode'`), y en el panel se entra con el correo
que pusiste en `firestore.rules`.

El parámetro `?emulador` solo funciona en `localhost`; en la página publicada no tiene efecto.
