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


## Update — dual publishing Phase 1 (2026-11-08)

Product owner selected both routes:
- Independent author: author's own KDP account; Amazon pays the author directly.
- Managed LIBRA editorial: a legally constituted LIBRA publishing entity is the KDP publisher and receives royalties, then settles authors under signed agreements.

Phase 1 implementation added:
- Mobile-first publishing route choice.
- Selection of an existing library book from IndexedDB.
- Prefilled/editable title, author and description.
- Format choices.
- Rights confirmation and separate AI provenance selectors for text, images and translations; none are preselected.
- Readiness checklist.
- Local versioned publication project storage in a new IndexedDB object store, without changing book records.
- Explicit status that saving is local preparation only and does not submit or publish to Amazon.
- Architecture and staged delivery plan in LIBRA_VOZ_DUAL_PUBLISHING_ARCHITECTURE.md.

Not implemented yet:
- EPUB/PDF/cover file generation or deterministic preflight.
- Cloudflare/backend sync, editorial staff permissions, contracts, royalty statements, reconciliation or author payouts.
- Amazon API integration or automated KDP upload.
- Legal/accounting validation for the managed editorial route.
- Physical Android device testing and fresh CI validation for these latest commits.

The managed route is a design choice and saved draft option only; it must remain unavailable for real submissions until the publisher entity, contract, tax/accounting workflow and Amazon eligibility are confirmed.


## Update — first export actions (2026-11-08)

Implemented on the isolated 5.0 development branch:
- EPUB 3 draft generation from a selected library book, including title, author, summary/prologue/pages or transcript, navigation document, stylesheet, package metadata and ZIP container.
- Print-layout HTML with a cover/title page and chapter breaks; user can use the browser's Print → Save as PDF workflow.
- Explicit copy clarifies that the print layout is not yet a KDP-validated PDF.
- Service worker cache updated to include the editorial assets.

Still pending before describing files as KDP-ready:
- Validate generated EPUB in an EPUBCheck-equivalent validator and Kindle Previewer.
- Produce a true PDF export with selected trim size, paper/ink/bleed/page-count and exact KDP interior margins; current print layout is a draft HTML print workflow.
- Generate a full-wrap print cover from final trim size, page count, paper and bleed.
- Include and validate embedded fonts/images and accessibility/navigation requirements.
- Test downloads and print flow on physical Android devices and WebView.
- Reconcile EPUB metadata/provenance with the actual AI-generation record.
- Fresh CI and device tests for these commits.
