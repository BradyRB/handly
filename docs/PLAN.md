# Plan de implementación y análisis de la carta

Fuente: Carta Constitutiva S8 - Grupo C, 76 páginas. Objetivo: conectar clientes con trabajadores técnicos independientes en República Dominicana, incluyendo provincias fuera de los grandes núcleos urbanos (pp. 6-8). Ocho módulos en pp. 6-8 y 31-33. Arquitectura hexagonal, responsabilidad única, inyección de dependencias y modelo McCall en pp. 56-60. Seguridad: validación, autenticación, cifrado en tránsito/reposo y auditoría en pp. 28-29, 59-60. Google Maps es la integración explícita (p. 17). Azure, respaldos y recuperación son objetivos operativos (p. 62).

## Decisión aprobada por la solicitud
Una aplicación web responsive Next.js/React/TypeScript, PostgreSQL/Prisma y Auth.js. Sustituye Flutter y el doble desarrollo web/móvil (p. 58). Portabilidad se evalúa en navegadores a 1440, 768 y 390 px. No se crea app nativa. El alojamiento Sites usa Workers y no coincide con el servidor Node/PostgreSQL solicitado; se entrega servidor Node y preparación Docker/Azure.

## Línea base académica
42 días; seis Sprints de siete días. La referencia a un mes (p. 8), 29.38 días de esfuerzo y ejemplos de reducción de alcance no modifican esta línea base. Los escenarios de suscripción, IA, comisiones y módulos avanzados son ejemplos de gestión, no requisitos de implementación. El presupuesto no tiene monto final; no se inventa.

| Sprint | Días | Entrega | Presupuesto conceptual |
|---|---|---|---|
| 1 | 1-7 | Entorno, esquema, usuarios | 12% |
| 2 | 8-14 | Perfiles y publicaciones | 14% |
| 3 | 15-21 | Búsqueda y Google Maps | 15% |
| 4 | 22-28 | Solicitudes y piloto | 18% |
| 5 | 29-35 | Mensajería, agenda, pagos | 19% |
| 6 | 36-42 | Opiniones, reportes, QA y documentación | 22% |

## Etapas técnicas
1. Dependencias compatibles, arquitectura, sistema visual, esquema y migración.
2. Registro y credenciales, sesiones y permisos de cliente/contratista.
3. Perfil profesional y CRUD de publicaciones con visibilidad.
4. Descubrimiento público filtrado, perfil y mapa con estados de indisponibilidad.
5. Solicitudes transaccionales y máquina de estados explícita.
6. Conversaciones persistentes, actualización periódica, acuerdos de agenda y adaptadores de pago.
7. Reseñas ligadas a trabajos completados, reportes propios y gestión de cuenta.
8. Pruebas de dominio/integración/E2E, revisión responsive, build y documentación.

## Objetivos medibles
P95 < 2 s para transacciones, referencia de 2,500 usuarios y 100 consultas/día; máximo cuatro horas mensuales de interrupción durante los primeros 90 días. Son objetivos de medición, no garantías. Registrar latencia, tasas de error, accesos críticos y resultados de prueba; verificar en infraestructura de producción. Los objetivos de largo plazo del modelo McCall se conservan como marco académico, sin afirmar cumplimiento futuro. Campañas y contratos son entregables de gestión ajenos al código.
