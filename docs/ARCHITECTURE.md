# Arquitectura y decisiones

## Capas

```
src/app                   Rutas Next.js, página con control de sesión y endpoints JSON
src/ui                    Componentes React, navegación por rol, formularios, mapas
src/components/ui         Button y confirmación accesible con Radix
src/domain                Reglas puras, estados, validación Zod y conversión monetaria
src/application           Servicios de los ocho módulos, recibe PrismaClient por inyección
src/infrastructure        Prisma, Auth.js, rate limits, puerto/adaptador de pago
prisma                    Modelo, migraciones SQL y semilla de desarrollo
tests                     Dominio, interfaz, integración PostgreSQL y E2E Playwright
```

La separación hexagonal es pragmática: las reglas del dominio no dependen de React, Next.js ni Prisma. La aplicación recibe el cliente de infraestructura y concentra las transacciones; se acepta el acoplamiento de sus consultas a Prisma para evitar interfaces genéricas que no aportan valor. `PaymentGateway` define un puerto real con implementación Stripe y fixtures intercambiables. La persistencia no usa arrays estáticos en producción. Las categorías visuales solo son etiquetas/iconos; los registros de servicio y categorías provienen de PostgreSQL.

## Entidades

User tiene exactamente un perfil acorde al rol mediante registro transaccional. ContractorProfile incorpora especialidad, presentación, experiencia declarada y coordenadas aproximadas públicas. ServicePublication pertenece al contratista y categoría. ServiceRequest referencia cliente, contratista y publicación; conserva título/dirección como instantánea del acuerdo. Una solicitud tiene una conversación, cita, pago y reseña como máximo mediante claves únicas. Conversation tiene mensajes ordenados por fecha e ID. Review referencia cliente y contratista y tiene restricciones de rango. UserReport pertenece a su autor, identifica a otra persona y limita las mutaciones a OPEN. AuditLog registra actor, acción, recurso y fecha, sin cuerpos de mensajes ni contraseñas. RateLimit persiste ventanas atómicas con claves hasheadas.

Los importes usan Decimal(12,2). Para el proveedor se convierten a centavos enteros validando el texto y evitando operaciones financieras con punto flotante. Float se reserva para coordenadas. FKs `Restrict` conservan integridad histórica; conversaciones/mensajes/citas usan cascada solo en eliminación física del registro padre. Las acciones de usuario no borran físicamente solicitudes o transacciones.

Índices cubren rol/cuenta activa, catálogo por categoría/provincia/visibilidad, solicitudes por participante/estado/fecha, conversaciones por fecha/ID, opiniones y reportes por propietario. El registro del correo, reseña por solicitud y referencias de proveedor son únicos. Las migraciones añaden CHECK para precio, importe, moneda, coordenadas y calificación.

## Estados de solicitud

| Desde | Hacia | Responsable / condición |
|---|---|---|
| PENDING | ACCEPTED o REJECTED | Contratista asignado |
| PENDING, ACCEPTED, SCHEDULED | CANCELLED | Cliente, sin pago registrado/en curso |
| ACCEPTED | SCHEDULED | Cliente confirma propuesta de cita y método |
| SCHEDULED | ACCEPTED | Edición/cancelación de cita sin pago/en curso |
| SCHEDULED | IN_PROGRESS | Contratista |
| IN_PROGRESS | AWAITING_CONFIRMATION | Contratista marca trabajo realizado |
| AWAITING_CONFIRMATION | COMPLETED | Cliente confirma, pago PAID |

COMPLETED, REJECTED y CANCELLED son terminales. La cita pasa de PROPOSED a CONFIRMED con el consentimiento del cliente. Al editar, vuelve a PROPOSED y elimina el pago no procesado para confirmar el nuevo acuerdo. Una cita cancelada conserva su fila y la solicitud sigue ACCEPTED. Un pago PAID o PROCESSING impide cancelar/editar; no se implementan reembolsos sin requisito y proveedor operativo. En desarrollo, PAID con adapter=development sigue siendo una simulación indicada en todas las pantallas de pago.

## Autenticación y seguridad

Auth.js Credentials valida con Zod, compara bcrypt costo 12 y crea JWT cifrado en cookie HttpOnly. Producción HTTPS habilita cookies Secure de Auth.js. Sesión de ocho horas, `sessionVersion` en base y JWT. Nuevo login revoca sesiones anteriores; logout incrementa esa versión; eliminación revoca y anonimiza. Cada endpoint privado revalida usuario/version en base, y cada mutación serializable vuelve a comprobar que el actor existe y mantiene su rol. No se confía en IDs o roles enviados por formulario.

Mutaciones JSON requieren Origin exacto de NEXTAUTH_URL y Content-Type JSON, con tamaño acotado. Auth.js aplica su mecanismo CSRF. Queries son parametrizadas mediante Prisma; el upsert de rate limit usa interpolación parametrizada. React escapa contenido, no hay HTML arbitrario de usuarios. CSP, no-sniff, frame deny y permisos de cámara/micrófono restringidos. `unsafe-eval` se admite solo en desarrollo por las herramientas de React. CSP usa `unsafe-inline` para el runtime Next sin nonce; una política con nonce es una mejora operativa futura, no una defensa contra toda forma de XSS.

Rate limits: intentos de login por correo (10/10 min), registro (20/hora por origen de red), mutaciones por cuenta (90/min). Login de cuentas inexistentes también compara un hash para reducir diferencias temporales. Protección IP debe estar detrás de proxy confiable que sobrescriba cabeceras; no se considera un WAF. Errores internos no devuelven secretos ni trazas.

## Supuestos documentados

- El rol se elige al crear cuenta y no cambia desde perfil.
- Provincia se valida con las 32 divisiones; municipio es texto. El catálogo de municipios oficial no se inventa ni se replica parcialmente.
- Zona pública aproximada, dirección exacta privada en solicitud, no geocodificación con una clave de servidor inexistente.
- Contratista propone; cliente acepta monto. No existe aprobación automática ni tarifa comercial inventada.
- Separación mínima de una hora entre citas del contratista; duración real no está especificada.
- Iniciar trabajo exige estado agendado, sin bloqueo por reloj; ambos coordinan mediante mensajería.
- Mensajes de solicitudes rechazadas/canceladas son de solo lectura; servicios completados conservan conversación.
- Reportes solo de personas con una relación de servicio; sin moderador ni resolución automática.
- Eliminación de cuenta anonimizadora. Historial contractual/transaccional y mensajes se conserva; política formal de retención debe definirse antes de uso real.
- Listados muestran hasta 100 registros; historial de mensajes permite páginas anteriores. No se ofrece paginación avanzada de catálogo en esta entrega.
- No hay correo de verificación, recuperación por email, carga de archivos, suscripciones ni chat por WebSocket porque no se exigen y requerirían infraestructura adicional. La mensajería tiene actualización periódica real con persistencia.

## Usabilidad

Nielsen: estados visibles, términos cotidianos, navegación estable por rol, confirmaciones destructivas, validación temprana y de servidor, historial accesible, pantallas vacías y errores con reintento. HTML semántico, labels, foco visible, enlace de salto, diálogos Radix y reduced-motion. Breakpoints a 1440, 768, 390 y 320 px; verificaciones no equivalen a una auditoría de accesibilidad completa ni validación de todos los navegadores.
