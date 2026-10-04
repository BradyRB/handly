# Handly

Aplicación web responsive para conectar clientes y contratistas independientes en República Dominicana. Implementa los ocho módulos de la Carta Constitutiva S8 - Grupo C con persistencia PostgreSQL, permisos de servidor y recorridos compartidos entre ambos roles.

## Inicio rápido local

Requisitos: Node.js 24 LTS, pnpm 11.9.0; Windows x64, macOS o Linux con binarios compatibles del auxiliar PostgreSQL. Las dependencias de aplicación están fijadas en `package.json` y `pnpm-lock.yaml`. El auxiliar `embedded-postgres` es exclusivamente de desarrollo; su paquete está marcado beta, y ejecuta PostgreSQL real, no una base simulada. En producción utiliza PostgreSQL administrado.

Desde esta carpeta:

```powershell
pnpm install --frozen-lockfile
pnpm setup:local
pnpm db:generate
```

Primera terminal (dejar abierta):

```powershell
pnpm db:local
```

Segunda terminal:

```powershell
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abrir **http://localhost:3000**. Usa este hostname, porque la protección de origen compara con `NEXTAUTH_URL`. `setup:local` crea `.env` con secretos aleatorios sin sobrescribir una configuración existente. Datos locales en `.local/postgres`; detener con Ctrl+C conserva los registros. La semilla es idempotente y nunca se ejecuta en producción. No uses `migrate reset` sobre registros que quieras conservar.

## Demostración

Todas las personas y direcciones son ficticias. Las cuentas se crean solo al ejecutar la semilla.

| Rol | Correo | Contraseña |
|---|---|---|
| Cliente | ana@handly.demo | HandlyDemo2026! |
| Contratista | rafael@handly.demo | HandlyDemo2026! |

Hay una solicitud pendiente de Ana a Rafael y dos trabajos históricos ficticios con opiniones. Para demostrar la conexión sin invalidar sesiones, usa un navegador normal y otro privado. Un inicio de sesión nuevo revoca la sesión anterior de esa misma cuenta.

1. Ana busca electricidad, abre el perfil de Rafael y envía una solicitud.
2. Rafael la encuentra en Solicitudes recibidas y la acepta.
3. Ambos conversan desde el detalle de esa solicitud.
4. Rafael propone fecha futura, lugar y monto. Ana confirma cita, precio y método de pago.
5. Rafael inicia el trabajo. Si es efectivo, confirma su recepción; si es tarjeta de desarrollo, Ana pulsa Simular pago de prueba.
6. Rafael marca el trabajo realizado. Ana confirma el servicio completado y publica su opinión.
7. Rafael consulta la reseña en Opiniones recibidas. Ambos tienen acceso al mismo historial.

## Módulos

- **Usuarios:** registro cliente/contratista, credenciales, logout, perfil y eliminación mediante anonimización. Contraseñas bcrypt con costo 12, JWT cifrado de ocho horas, revocación y verificación de cuenta en servidor.
- **Publicaciones:** crear, editar, ocultar y eliminar; solo su contratista las gestiona. Se conservan referencias de solicitudes antiguas.
- **Búsqueda:** título, descripción, profesional, categoría, provincia, precio y calificación; orden por precio. Perfil público, lista y mapa configurable.
- **Solicitudes:** flujo de estados y mutaciones transaccionales con aislamiento Serializable y reintentos acotados.
- **Mensajería:** conversación creada por solicitud, mensajes persistentes, permisos de participante y paginación del historial. Actualización periódica cada 2.5 segundos mientras la pestaña está visible.
- **Agenda y pagos:** propuesta del contratista, confirmación del cliente, edición que invalida el acuerdo, cancelación de cita, conflicto horario de una hora, importes decimales y recepción de efectivo. Tarjetas con adaptador de desarrollo o Stripe Checkout de prueba.
- **Opiniones:** una por solicitud completada, solo su cliente; media y cantidad de reseñas públicas.
- **Reportes:** crear, consultar, editar y eliminar reportes abiertos propios sobre una persona relacionada con un servicio. Sin plataforma de administración adicional.

## Configuración e integraciones

Consulta `.env.example` y [INTEGRATIONS.md](docs/INTEGRATIONS.md). Para PostgreSQL externo, reemplaza `DATABASE_URL`, ejecuta `pnpm db:generate` y `pnpm db:migrate`. Nunca subas `.env`, `.local` ni secretos al repositorio. Mantén ambientes de prueba y producción separados.

Google Maps necesita una clave para navegador con restricciones de sitios y API; no se incluye ninguna. La lista permanece funcional sin ella. Stripe se limita deliberadamente a claves `sk_test_`, con Checkout alojado y webhook firmado. El modo `development` registra pagos simulados explícitamente y no realiza cargos reales. No se solicitan ni almacenan números de tarjeta. Las pruebas del SDK y webhook con fixtures no equivalen a una operación contra una cuenta externa.

## Verificación

```powershell
pnpm typecheck
pnpm test
pnpm test:integration
pnpm exec playwright install chromium
pnpm test:e2e
node scripts/performance.mjs
pnpm build
pnpm start
```

Las pruebas integradas y E2E requieren el PostgreSQL local migrado y crean/eliminan únicamente sus registros QA. E2E arranca el servidor si no hay uno activo, y deja un reporte en `playwright-report`. La compilación usa webpack para una salida Node standalone. Ver resultados efectivamente ejecutados en [QA.md](docs/QA.md); las capturas visuales están en `docs/screenshots`.

`pnpm start` copia los archivos estáticos a la salida standalone y la ejecuta en localhost. Detén ese servidor antes de volver a compilar, especialmente en Windows, donde el directorio en uso puede quedar bloqueado. Para repetir E2E sobre producción, deja `pnpm start` activo en otra terminal; Playwright lo reutiliza.

## Arquitectura y entrega académica

TypeScript estricto, Next.js App Router, React, Tailwind, componentes estilo shadcn sobre Radix, React Hook Form/Zod, Prisma y Auth.js (paquete estable next-auth 4.24.15). Monolito modular con reglas puras de dominio, servicios de aplicación y adaptadores de infraestructura. Dependencias compatibles verificadas por instalación, generación Prisma, TypeScript, pruebas y build.

La implementación aprobada es **una web responsive**. Sustituye la referencia a Flutter y dos aplicaciones de la carta; conserva los ocho módulos y la planificación conceptual de **42 días / seis Sprints**. Documentación:

- [Plan y análisis de la fuente](docs/PLAN.md)
- [Arquitectura, entidades y decisiones](docs/ARCHITECTURE.md)
- [Matriz de trazabilidad](docs/TRACEABILITY.md)
- [Integraciones y variables](docs/INTEGRATIONS.md)
- [Pruebas y evidencia](docs/QA.md)
- [Preparación de producción y operación](docs/OPERATIONS.md)

No se afirma disponibilidad, cumplimiento normativo, verificación profesional, seguros ni capacidad en producción sin las evaluaciones correspondientes. La aplicación está verificada localmente; el mapa externo, Stripe contra una cuenta real y despliegue cloud requieren configuración externa.
