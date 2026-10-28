# LIVRA

**Tu voz. Tu historia. Tu libro.**

Prototipo PWA móvil para grabar y guardar historias personales.

## Incluye
- Interfaz móvil simple en blanco y azul con logo LIVRA.
- Grabación del micrófono con pausa, continuación, stop, revisión, cancelación y guardado.
- Guardado local mediante IndexedDB.
- Reproducción y descarga de grabaciones.
- Manifiesto PWA y service worker.

## Límites actuales
- La transcripción y redacción con IA todavía no están conectadas; necesitan un servicio externo y backend.
- Los audios se guardan en el navegador del dispositivo y no se sincronizan ni se publican.
- Compartir libros, cuentas, biblioteca pública y voces narradoras se desarrollarán después.

## Publicar como web instalable
1. En GitHub, abrí **Settings → Pages**.
2. Elegí **Deploy from a branch**, rama **main**, carpeta **/(root)** y guardá.
3. Esperá la publicación y abrí la URL HTTPS de GitHub Pages en Chrome para Android.
4. Permití el micrófono, tocá **Grabar mi libro**, probá pausa y detener, y guardá el audio.
5. En el menú de Chrome elegí **Instalar aplicación** o **Agregar a pantalla principal**.

El acceso al micrófono requiere HTTPS; GitHub Pages lo proporciona. Esta versión es un prototipo de grabación, no todavía el generador automático de libros.
