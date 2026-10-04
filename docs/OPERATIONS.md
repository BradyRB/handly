# Producción y operación

## Servidor Node

1. Provisionar PostgreSQL administrado y un servicio Node 24 LTS. La referencia académica a Azure es un objetivo de infraestructura; no se crearon recursos ni se incurrió en gastos.
2. Configurar DATABASE_URL con TLS del proveedor, NEXTAUTH_URL HTTPS y NEXTAUTH_SECRET aleatorio en almacén de secretos; configurar claves externas de prueba por separado.
3. Ejecutar `pnpm install --frozen-lockfile`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm build`.
4. Ejecutar la salida standalone con `HOSTNAME=0.0.0.0 PORT=3000 node .next/standalone/server.js`, copiando `public` y `.next/static` a sus rutas equivalentes dentro de standalone; Dockerfile ya lo hace. Alternativa: `pnpm exec next start -H 0.0.0.0 -p 3000` con dependencias instaladas.
5. Terminar HTTPS en el proxy/plataforma, sobrescribir cabeceras de cliente, bloquear conexión directa al proceso, limitar bodies a 100 KB y acceso al puerto PostgreSQL.
6. Usar cuenta de base con permisos mínimos para runtime; usuario separado para migraciones. No ejecutar semilla ficticia en producción.

Next.js, Prisma y Auth.js se fijan en versiones compatibles comprobadas. Guías: [Next.js Node](https://nextjs.org/docs/app/getting-started/deploying), [migraciones Prisma 6](https://www.prisma.io/docs/orm/v6/prisma-migrate/getting-started), [Credentials Auth.js](https://next-auth.js.org/configuration/providers/credentials).

## Docker

`compose.yaml` prepara PostgreSQL, job de migración y servidor. Añadir POSTGRES_PASSWORD a `.env`, revisar NEXTAUTH_URL/NEXTAUTH_SECRET y ejecutar `docker compose up --build`. El PostgreSQL auxiliar local debe estar detenido si usa el mismo puerto 55432. No se ejecutó Docker en esta máquina porque el daemon no estaba activo; los archivos se entregan como preparación, sin afirmar despliegue probado. Persistencia en volumen nombrado. NEXT_PUBLIC_GOOGLE_MAPS_KEY se pasa como build arg y exige reconstrucción cuando cambia.

## CI/CD y recuperación

Pipeline recomendado para Azure DevOps: instalación congelada, generación, typecheck, unitarias, PostgreSQL de CI + migraciones + integración, E2E, build y publicación de imagen/version. Desplegar a staging, aplicar migraciones y verificar antes de promoción. Evitar rollback de esquema destructivo: las dos migraciones actuales son aditivas. Conservar imagen anterior para rollback de aplicación; futuras migraciones deben seguir expand/contract. Verificar restauración, no solo la creación de backups.

Respaldos: configurar automáticos cifrados y recuperación puntual en PostgreSQL administrado. Ensayar restauración a una base aislada. Azure puede proporcionar backups georredundantes conforme al plan elegido; esta entrega no aprovisiona esas capacidades. En desarrollo, respaldar la base con pg_dump o detener el auxiliar antes de copiar su directorio completo. Nunca publicar ese directorio como entregable.

## Observabilidad y calidad

`Server-Timing` mide el trabajo del endpoint; auditar duración total en proxy/monitor para incluir red. Registro crítico persistido en AuditLog; excepciones internas registran tipo y ruta sin secretos. Configurar alertas por 5xx, disponibilidad, latencia P95, fallos de webhook, crecimiento de base y rate-limit 429. P95 <2 s es una meta de la carta. La capacidad de 2500 usuarios y referencia 100 consultas/día exige prueba con carga representativa; el smoke local no la certifica. Tampoco certifica cuatro horas máximas de interrupción/mes ni los objetivos de largo plazo de McCall.

Limpiar periódicamente RateLimit con `DELETE FROM "RateLimit" WHERE "resetsAt" < NOW() - INTERVAL '1 day'` en operación controlada. Definir política de retención para AuditLog y datos personales antes de uso real. Logout y nuevo login revocan las sesiones; no hay múltiples sesiones simultáneas por cuenta. Revisar cambios de dependencias mediante lockfile y pruebas antes de actualizar.

## Límites de la entrega

Mapa externo y cuenta Stripe no configurados; se comprobaron estados de indisponibilidad y fixtures firmados. No publicación cloud, cobros reales, reembolsos, geocodificación de direcciones, recuperación por email, archivos adjuntos o moderación administrativa. Solo español, DOP y America/Santo_Domingo. La eliminación anonimiza perfil y conserva historial. La política de datos, términos y evaluaciones comerciales/jurídicas deben definirse por el equipo antes del lanzamiento; no se afirma certificación normativa.
