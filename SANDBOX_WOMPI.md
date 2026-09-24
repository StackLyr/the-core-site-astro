# Wompi compartido en sandbox — arquitectura del demo

La cuenta de pruebas que usa The Core Site también se está usando para otras demostraciones. Wompi Panamá permite una URL de eventos por ambiente de cada comercio. La URL de Sandbox permanece apuntando a la floristería; después de validar la firma, ese endpoint reenvía exclusivamente referencias de The Core Site a `https://the-core-site-astro.pages.dev/api/wompi/webhook`.

Esta arquitectura es temporal y exclusiva para demostraciones sin dinero real. Si The Core Site contrata el sistema, debe usar su propio comercio Wompi, sus propias llaves y su propia URL de eventos.

## Lo que ya está preparado

- Referencias exclusivas: `tcs-class-<uuid>` para clases y `tcs-plan-<uuid>` para membresías.
- Validación del checksum del evento, ambiente, referencia, monto, moneda e ID de transacción.
- Reintentos idempotentes: un evento repetido no crea otra reserva o membresía.
- Eventos de referencias ajenas se ignoran con respuesta HTTP 200 después de verificar la firma.
- Sandbox y producción se separan por los prefijos de las llaves; una llave de producción no activa un entorno marcado `test`.

El procesamiento interno se probó localmente con llaves sintéticas. El enrutador compartido tiene pruebas unitarias y conserva intactas las referencias de la floristería, pero todavía falta desplegar ambos cambios, configurar sus secretos y ejecutar una compra completa en Sandbox.

## Flujo elegido para el demo

1. Wompi envía todos los eventos Sandbox a la URL ya registrada de la floristería.
2. El endpoint valida la firma con el secreto de eventos compartido.
3. Referencias `tcs-class-<uuid>` y `tcs-plan-<uuid>` se reenvían al endpoint de The Core Site; referencias `FLV1-*` siguen su flujo normal.
4. The Core Site vuelve a validar firma, ambiente, referencia, importe y moneda antes de confirmar la reserva o membresía.
5. Si The Core Site no responde correctamente, el enrutador devuelve error para conservar los reintentos de Wompi.

No copiar llaves ni contraseñas en mensajes o en Git. Configurar secretos únicamente en `.dev.vars` local (ignorado), en secretos de Cloudflare y en variables protegidas de Vercel.

Fuentes: [eventos de Wompi Panamá](https://docs.wompi.co/docs/panama/eventos/), [ambientes y llaves](https://docs.wompi.co/docs/panama/ambientes-y-llaves/), [seguimiento de transacciones](https://docs.wompi.co/docs/panama/seguimiento-de-transacciones/).
