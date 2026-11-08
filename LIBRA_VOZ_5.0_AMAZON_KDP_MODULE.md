# LIBRA VOZ 5.0 — Mi Editorial / Amazon KDP

## Estado de implementación

Se agregó una primera pantalla guiada de publicación en la rama `release/libra-voz-5.0-foundation`, sin modificar `main`.

### Implementado en esta entrega
- Acceso a **MI EDITORIAL** desde el inicio y desde el menú principal.
- Pantalla dedicada a Amazon KDP con enlace oficial `https://kdp.amazon.com/`.
- Explicación de impresión bajo demanda y responsabilidad del autor.
- Selección local de formatos objetivo: Kindle/EPUB, tapa blanda/PDF y tapa dura.
- Recorrido guiado: cuenta, aprobación editorial, archivos, validación y publicación en KDP.
- Campos para título, autor y descripción comercial.
- Acción para copiar la ficha de metadatos.
- Advertencia específica para que autores argentinos verifiquen cobros, identidad y datos fiscales directamente en su perfil KDP.
- No se solicitan, reciben ni almacenan credenciales de Amazon.

### Límites explícitos
Esta entrega NO constituye una integración API con Amazon KDP. No crea cuentas, no inicia sesión, no sube archivos, no fija precios ni publica libros. No se ha confirmado una API pública de KDP que autorice esas operaciones a aplicaciones externas.

Los campos de metadatos y formatos de esta primera pantalla son preparación local y todavía no están vinculados a un libro de IndexedDB ni sincronizados con el backend.

### Próximas tareas técnicas
1. Vincular la pantalla con el libro seleccionado de la biblioteca sin sobrescribir la obra.
2. Persistir un expediente de publicación versionado en IndexedDB.
3. Generar EPUB Kindle validado.
4. Generar PDF interior de impresión con tamaños, márgenes y fuentes verificadas.
5. Generar cubierta completa de impresión a partir del tamaño de corte, papel y paginación.
6. Implementar preflight técnico con resultados bloqueantes y advertencias.
7. Exportar un paquete de publicación descargable con archivos y metadatos.
8. Mantener el paso final de carga y confirmación en el sitio oficial KDP, salvo que Amazon publique un mecanismo oficial compatible.

### Seguridad y costos
- No se almacenan contraseñas, cookies, tokens ni sesiones Amazon.
- No se agregaron servicios pagos ni nuevas dependencias externas.
- No se desplegó ni modificó el Cloudflare Worker de producción.
- No se modificó la rama `main`.
- No se fusionó el PR #14.

### Verificación pendiente
La compilación Android y las pruebas automatizadas de esta revisión están pendientes. Todavía no se realizaron pruebas en un dispositivo Android físico. No declarar esta pantalla lista para producción hasta completar CI, revisión de accesibilidad, persistencia, pruebas en Android y validación de archivos reales con KDP.
