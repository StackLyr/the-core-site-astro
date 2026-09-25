# Agenda demo — The Core Site

Este prototipo vive en la rama `feature/booking-mvp`. La rama `main` y el sitio público no se modifican ni se despliegan desde aquí.

## Qué incluye

- `/reservar`: horario semanal, cupos, solicitudes, clases con precio y membresías.
- `/pago-demo`: simulador explícito de aprobación o rechazo. No contiene campos de tarjeta, no llama a un banco y no mueve dinero.
- `/agenda`: panel privado para clases, cupos, clientes, reservas, cancelaciones, ausencias, membresías y cola de correos.
- Pages Functions y D1 para conservar el estado del demo.

La membresía se compra una vez; no hay renovación automática. La redención de créditos, reembolsos, recordatorios y autocancelación todavía no están implementados.

## Ejecutarlo localmente

1. En `C:\Users\cram5\the-core-site-astro`, ejecuta `npm ci`.
2. Copia `.dev.vars.example` a `.dev.vars`; usa una contraseña administrativa larga y un `ADMIN_SESSION_SECRET` aleatorio de al menos 32 caracteres.
3. Ejecuta `npm run booking:db:init` para una base nueva.
4. Ejecuta `npm run booking:dev -- --port 8788`.
5. Abre `http://127.0.0.1:8788/agenda/` y `http://127.0.0.1:8788/reservar/`.

`PAYMENT_MODE=demo` debe estar configurado explícitamente. Si falta, las clases y membresías con precio no se pueden publicar ni comprar. Esta separación evita presentar el simulador como un procesador real por accidente.

## Límites deliberados

- No existen credenciales ni código de Wompi en este demo.
- Los estados de pago son simulaciones identificadas en la interfaz y en `booking_events`.
- Resend es opcional. Sin `RESEND_API_KEY` y `EMAIL_FROM`, los correos quedan en la cola del panel.
- El panel usa una contraseña compartida, sesiones revocables de dos horas y límites básicos por IP. Esto no es suficiente para producción.
- No se ha verificado respaldo, restauración, monitoreo, alertas ni recuperación total de D1.

Antes de una implementación real se debe integrar el comercio propio del cliente, validar webhooks firmados, definir precios y políticas, añadir Cloudflare Access o autenticación individual, configurar correo, ejecutar pruebas de concurrencia y completar la revisión de producción.
