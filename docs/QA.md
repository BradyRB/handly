# Verificación ejecutada

Fecha: 4 de octubre de 2026. Entorno: Windows x64, Node.js 24.12.0, pnpm 11.9.0, PostgreSQL 18 persistente en localhost y Chromium de Playwright. Las personas y operaciones de prueba son ficticias. Los fixtures se crean y eliminan en la base local; no se hicieron cargos ni transmisiones a proveedores de pago.

## Resultados

| Comprobación | Resultado observado |
|---|---|
| Instalación congelada y generación Prisma | Correctas |
| Dos migraciones PostgreSQL | Aplicadas, incluidas restricciones adicionales |
| TypeScript estricto | Sin errores; también comprobado con noUnusedLocals y noUnusedParameters |
| Vitest dominio e interfaz | 22 pruebas aprobadas: 21 reglas y validaciones, 1 formulario accesible |
| Vitest integración | 15 pruebas aprobadas con PostgreSQL real |
| Playwright Chromium | 3 recorridos aprobados sobre el servidor standalone de producción |
| Next.js producción | Compilación webpack, tipos y generación de rutas correctas |
| Lecturas de búsqueda, 40 muestras calientes | P50 5 ms, P95 8 ms, máximo 17 ms en localhost |

La medición es un smoke secuencial local, no una prueba de carga, concurrencia o disponibilidad. No certifica capacidad para 2500 usuarios. `scripts/performance.mjs` permite repetirla; los resultados varían por equipo, datos y entorno.

## Cobertura significativa

Dominio: roles, propiedad, transiciones permitidas y rechazadas, requisitos de finalización y reseña, importes exactos, registro y validación de datos. Interfaz: etiquetas, errores requeridos, bloqueo de envío y error asíncrono del servidor.

Integración: creación y hash de usuarios, proveedor de credenciales válido/inválido, CRUD y permisos de publicaciones, búsqueda por ubicación/visibilidad, solicitud entregada al contratista correcto, aislamiento de conversaciones, orden de mensajes, citas y acuerdo del cliente, pagos, reseña única y media pública, CRUD de reportes propios, rate-limit, revocación de sesiones, eliminación mediante anonimización. Se prueban duplicados de pago, importes y moneda de webhook, firma inválida, entrega idempotente y eventos de expiración antiguos con fixtures del SDK Stripe.

E2E principal: registro de ambas cuentas, publicación, descubrimiento, solicitud, aceptación, mensajes bilaterales persistidos, propuesta y confirmación de cita, inicio de trabajo, recepción de efectivo, finalización por ambos roles, opinión visible al contratista, creación/edición/eliminación de reporte, edición de perfil desde el menú móvil, restricción de publicaciones del cliente y logout. No se detectaron errores JavaScript de página en los recorridos comprobados.

E2E adicional: redirección privada a login, API sin sesión 401, origen externo 403, búsqueda vacía, mapa sin clave y registro profesional desde el enlace correspondiente.

## Evidencia visual

Capturas en `screenshots/`: inicio y búsqueda a 1440, 768, 390 y 320 px; dashboard cliente a 390, contratista a 1440 y solicitud completada a 1440. Se revisaron escritorio y móvil visualmente. Se corrigió una superposición del buscador de inicio y se verificó ausencia de desplazamiento horizontal. Los nombres E2E en algunas capturas identifican fixtures ya eliminados, no personas reales.

La revisión de filtros y reportes detectó un problema de estado al inicializar parámetros en cliente; se corrigió pasando los parámetros resueltos desde la página de servidor. La evidencia entregada corresponde a la versión corregida. El reporte HTML se regenera mediante `pnpm test:e2e`; no se incluye caché ni trazas anteriores en el paquete de código.

## Límites comprobados y pendientes

Google Maps: estado sin clave y fallback funcional verificados; carga externa con una clave válida pendiente. Stripe: adaptador test y webhooks con fixtures verificados; Checkout contra una cuenta externa pendiente. Docker/Azure: configuración y guía entregadas, sin ejecución de contenedores ni recursos cloud. No se afirma auditoría completa de accesibilidad, seguridad, normativa o carga de producción.

## Reproducir

Seguir README para instalar, configurar, migrar y sembrar una base exclusivamente de prueba. Ejecutar `pnpm typecheck`, `pnpm test`, `pnpm test:integration` y `pnpm build`. Mantener PostgreSQL activo. Para reproducir la verificación de producción, arrancar `pnpm start` en otra terminal y ejecutar `pnpm test:e2e`; Playwright reutiliza localhost:3000. Sin servidor activo inicia el servidor de desarrollo automáticamente. Las pruebas no requieren claves externas.
