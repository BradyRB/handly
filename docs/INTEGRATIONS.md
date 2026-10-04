# Integraciones

## Variables

| Variable | Uso | Privacidad |
|---|---|---|
| DATABASE_URL | PostgreSQL, credenciales y schema | Solo servidor |
| NEXTAUTH_URL | Origen canónico y callbacks | Configuración servidor |
| NEXTAUTH_SECRET | Cifrado/firma de sesiones y salt para límites | Secreto servidor |
| PAYMENT_ADAPTER | development o stripe | Configuración servidor |
| NEXT_PUBLIC_GOOGLE_MAPS_KEY | Maps JavaScript en navegador | Clave pública restringida, compilada en build |
| STRIPE_SECRET_KEY | Solo sk_test_ aceptada | Secreto servidor |
| STRIPE_WEBHOOK_SECRET | Verificación de eventos | Secreto servidor |
| POSTGRES_PASSWORD | Solo docker compose | Secreto servidor |

## Google Maps

Habilitar Maps JavaScript API en un proyecto Google Cloud con configuración de facturación propia. Crear una clave para navegador limitada a referrers concretos como `http://localhost:3000/*` y el dominio HTTPS del despliegue, y a Maps JavaScript API. Guardarla en NEXT_PUBLIC_GOOGLE_MAPS_KEY. Reiniciar desarrollo o recompilar producción. La clave de navegador es visible por naturaleza: nunca reutilizar una clave privada de servidor. [Guía oficial de seguridad](https://developers.google.com/maps/api-security-best-practices).

Los marcadores se calculan con las coordenadas públicas de ContractorProfile. Se editan en Perfil profesional. Los servicios sin coordenadas siguen en la lista del mapa. Los errores de carga, timeout y autorización se muestran sin impedir la búsqueda por lista. Sin clave, se muestra el estado de integración pendiente; no hay mapa falso. No se envía la dirección exacta de solicitudes a Google.

## Pagos

`development`: flujo local completo. Cliente selecciona tarjeta y confirma la cita. Simular pago de prueba registra status=PAID, adapter=development y auditoría SIMULATE_TEST_PAYMENT. Todas las pantallas relevantes indican que no existe cargo real. Nunca hay formulario de tarjeta.

`cash`: cliente acuerda efectivo. Solo el contratista de ese servicio registra recepción cuando el trabajo está en curso o pendiente de confirmación.

`stripe`: configurar cuenta sandbox propia y claves de prueba. El SDK crea Checkout alojado, moneda DOP, precio en centavos y referencia al pago. Usa idempotency key por pago/intento. Abre la URL del proveedor. No se cambia a PAID por la URL de retorno. El webhook validado es quien confirma el pago.

```text
PAYMENT_ADAPTER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Con Stripe CLI configurado por el propietario:

```bash
stripe listen --forward-to localhost:3000/api/handly/webhook
```

Copiar el signing secret de esa sesión a `.env`, reiniciar y realizar el recorrido desde una nueva cita con CARD. Eventos admitidos: checkout.session.completed, checkout.session.expired y checkout.session.async_payment_failed. Firma validada sobre body crudo, modo de prueba, ID/referencia, moneda e importe. `PaymentEvent` evita doble procesamiento; un evento de expiración no revierte un pago registrado. Fallos ambiguos de creación conservan PROCESSING; reintentar Checkout reutiliza la misma clave en lugar de crear un cobro paralelo.

Solo tarjeta de prueba y pago inmediato; no métodos diferidos ni cargos live. Debe comprobarse soporte del proveedor, país de la cuenta y moneda antes de cualquier operación comercial. [Monedas del proveedor](https://docs.stripe.com/currencies), [firmas de webhook](https://docs.stripe.com/webhooks/signature). La prueba integrada usa eventos firmados locales y un gateway inyectado; no contacta Stripe y no demuestra configuración de una cuenta externa.

## Mensajería

Persistencia primero: POST autorizado crea Message. Conversación consulta hasta 100 últimos mensajes con cursor por fecha/ID y permite Cargar anteriores. Polling de 2.5 segundos con pestaña visible; listado cada cinco segundos. Recuperación tras recarga conserva el historial. Se puede sustituir polling por un transporte SSE/WebSocket sin modificar propiedad ni tablas, pero no se incluye un servicio adicional.
