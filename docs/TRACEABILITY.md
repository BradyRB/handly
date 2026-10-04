# Trazabilidad

Los números de página corresponden a las 76 páginas físicas del PDF; el índice presenta algunos desplazamientos. Se usan los módulos explícitos de pp. 6-8, 31-33 y pp. 56-60 para calidad. Los textos de escenarios hipotéticos no amplían el producto.

| Requisito | Implementación | Evidencia automatizada |
|---|---|---|
| Usuario cliente/contratista, actualización, eliminación | Auth.js, register/profile API, perfiles Prisma, anonimización | Registro/password hashing, credenciales correctas/incorrectas, revocación, eliminación; E2E registra ambos |
| Publicaciones registro/actualización/eliminación | /app/servicios, ownership, visibilidad, borrado lógico | CRUD y permisos, ocultación; E2E crea servicio |
| Búsqueda de contratistas Google Maps | /buscar, search API, perfil público, adaptador de mapa | Query/provincia/visibilidad; E2E descubre y prueba mapa sin clave |
| Registro/listado de solicitudes | Solicitud ligada a publicación y contratista, estados transaccionales | Entrega al contratista, permisos, aceptación, rechazo de transiciones; recorrido E2E |
| Registro/listado de mensajes | Conversation y Message, orden y permisos, polling | Mensajes persistidos/ordenados, intrusión rechazada; comunicación bilateral E2E |
| Agenda lugar/fecha/pago y CRUD | Propuesta, confirmación y cancelación de cita | Creación, edición, cancelación, confirmación; E2E agenda |
| Efectivo o tarjeta | Decimal, adaptadores cash/development/stripe-test | Recepción por contratista, simulación por cliente, duplicados, firmas/currency/amount/idempotencia |
| Opiniones y calificaciones | Review única por trabajo, cliente y estado COMPLETED | Autor/estado/duplicado, cálculo media; E2E publica y contratista recibe |
| Reportes CRUD | Reportes propios, relación de servicio, estado OPEN | Ownership/create/update/delete; E2E crea/edita/elimina |
| Calidad McCall y hexagonal | Dominio puro, DI de Prisma y PaymentGateway, índices y validación | 21 pruebas de dominio, interfaz, integración real y recorrido E2E |
| Seguridad y confianza cero | requireActor + recurso/participante en servidor, sesiones revocables, origin check | Protección de rutas/API, error de origen externo, pruebas de propiedad |
| Portabilidad web/móvil | CSS responsive y navegación por rol | Playwright en 1440, 768, 390 y 320; capturas |
| P95 < 2s, 2500 usuarios, 100 consultas/día | Server-Timing, smoke de latencia, operación propuesta | Medición local de lecturas; capacidad y disponibilidad no certificadas |
| Azure, contingencia y backups | Docker standalone, guía de migración/rollback/backups | Build local verificado; Docker/cloud no ejecutados |
| Seis Sprints / 42 días | PLAN.md mantiene línea base | Documento de decisión responsive |

## Entregables frente a la EDT

Repositorio, base de datos, variables y configuración disponibles; ocho módulos conectados y pruebas ejecutables; manual README y documentación técnica. Piloto/preliminar/final son hitos conceptuales de la línea base, no tres despliegues ficticios. Las campañas publicitarias, firmas contractuales, patrocinio, presupuesto, ceremonias Scrum y métricas a diez años requieren trabajo del equipo académico. No se afirma haberlos realizado mediante código.
