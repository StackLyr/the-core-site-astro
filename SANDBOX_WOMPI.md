# Wompi compartido en sandbox — decisión pendiente

La cuenta de pruebas que usa The Core Site también se está usando para ferretería B1 y un SaaS de citas. Wompi Panamá documenta una URL de eventos por ambiente de cada comercio. **No se debe sustituir la URL actual**: dejaría de confirmar eventos de los otros sistemas salvo que se haya instalado y probado antes un receptor central que los distribuya.

## Lo que ya está preparado

- Referencias exclusivas: `tcs-class-<uuid>` para clases y `tcs-plan-<uuid>` para membresías.
- Validación del checksum del evento, ambiente, referencia, monto, moneda e ID de transacción.
- Reintentos idempotentes: un evento repetido no crea otra reserva o membresía.
- Eventos de referencias ajenas se ignoran con respuesta HTTP 200 después de verificar la firma.
- Sandbox y producción se separan por los prefijos de las llaves; una llave de producción no activa un entorno marcado `test`.

Esto se probó **localmente con llaves sintéticas**, no con el comercio de Wompi. No demuestra aún que WooCommerce o el SaaS reenvíen eventos a The Core Site.

## Opciones seguras para recibir eventos reales

1. **Cuenta/comercio Wompi independiente para The Core Site:** cada negocio conserva sus llaves y URL. Es la mejor separación si cobran para entidades comerciales distintas.
2. **Cuenta compartida y receptor central:** la URL existente recibe todos los eventos, verifica su firma y los distribuye según referencia a WooCommerce, el SaaS y The Core Site. Antes de modificar la URL hay que conocer el receptor actual y probar los tres flujos de sandbox de principio a fin, incluyendo reintentos, fallos y pedidos cerrados en el navegador.
3. **Sin receptor central:** no habilitar pagos de The Core Site todavía. Consultar manualmente una transacción no reemplaza al webhook: si el cliente cierra la pestaña, podríamos no enterarnos del pago.

Para escoger hace falta saber qué sistema controla la URL actual, si se puede modificar sin perder el plugin de WooCommerce y si los tres proyectos comparten el mismo comercio legal. No copiar llaves ni contraseñas en mensajes o en Git. Configurar secretos únicamente en `.dev.vars` local (ignorado) y, luego, en secretos de Cloudflare.

Fuentes: [eventos de Wompi Panamá](https://docs.wompi.co/docs/panama/eventos/), [ambientes y llaves](https://docs.wompi.co/docs/panama/ambientes-y-llaves/), [seguimiento de transacciones](https://docs.wompi.co/docs/panama/seguimiento-de-transacciones/).
