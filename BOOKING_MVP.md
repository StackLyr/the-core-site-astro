# Agenda local — The Core Site

Este prototipo vive en la rama `feature/booking-mvp`. La rama `main` y el sitio público no se modifican ni se despliegan desde aquí.

## Qué hace

- `/reservar`: muestra horarios, cupos y precios definidos por el estudio. Acepta solicitudes sin precio y prepara el Checkout de Wompi cuando el precio y las credenciales existen.
- `/agenda`: acceso privado para crear clases, ver clientes y reservas, confirmar solicitudes, registrar cancelaciones y ausencias.
- API y base de datos D1 locales para probar sin tocar datos de producción.
- Webhook de Wompi con validación de firma, referencia, moneda e importe. La vuelta del navegador no confirma el pago.

No incluye todavía membresías, recordatorios, reembolsos automáticos ni autocancelación del cliente. No se deben publicar tarifas inventadas.

## Ejecutarlo en esta PC

1. Desde `C:\Users\cram5\the-core-site-astro`, instala dependencias con `npm ci`.
2. Copia `.dev.vars.example` a `.dev.vars` y cambia `ADMIN_PASSWORD` por una contraseña larga y `ADMIN_SESSION_SECRET` por una cadena aleatoria de al menos 32 caracteres. Nunca subas `.dev.vars` a GitHub.
3. Ejecuta `npm run booking:db:init` una vez.
4. Ejecuta `npm run booking:dev`.
5. Abre `http://127.0.0.1:8788/agenda` para crear una clase y `http://127.0.0.1:8788/reservar` para probar la reserva.

El nombre, email y teléfono de prueba quedan solo en la base D1 local de Wrangler (`.wrangler/`, ignorado por Git).

## Wompi Panamá

Configura en `.dev.vars` las llaves **sandbox** del comercio: `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET` y `WOMPI_ENV=test`. Solo entonces una clase con precio mayor que cero ofrecerá Checkout. La URL de eventos para pruebas tendría que ser una URL HTTPS pública que apunte a `/api/wompi/webhook`; Wompi no puede notificar a `localhost` sin un túnel de pruebas. No uses credenciales de producción en esta etapa.

Para producción faltan: los precios y reglas reales del estudio, cuenta Wompi activa, base D1 de producción y su ID en `wrangler.jsonc`, secretos en Cloudflare, URL de webhook configurada en Wompi, pruebas de pago y reembolso, prevención de abuso en login/reservas, políticas de privacidad, respaldo y revisión de seguridad. El `database_id` actual en `wrangler.jsonc` es solo un identificador local ficticio. `npm audit` detecta vulnerabilidades en la versión actual de Astro y dependencias; no desplegar el panel hasta actualizar y verificar compatibilidad.

Documentación: [Checkout Wompi Panamá](https://docs.wompi.co/docs/panama/widget-checkout-web/), [eventos Wompi](https://docs.wompi.co/docs/panama/eventos/), [Pages Functions + D1](https://developers.cloudflare.com/pages/functions/bindings/).
