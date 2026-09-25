# Simulador de pagos

El modo `PAYMENT_MODE=demo` existe únicamente para enseñar el recorrido de una reserva. No acepta números de tarjeta ni se comunica con Wompi u otro procesador.

## Flujo

1. Una reserva o membresía con precio crea un registro `pending_payment` y un token aleatorio de un solo flujo.
2. El navegador abre `/pago-demo/`, claramente identificado como demostración.
3. La persona elige aprobar o rechazar la simulación.
4. `POST /api/demo-payment` valida mismo origen, modo demo, formato del identificador, token, estado pendiente, vigencia del cupo y límite por IP.
5. El servidor cambia el estado, registra un evento con el texto `Simulación DEMO — sin cobro` y encola la confirmación correspondiente.

La página de regreso nunca confirma por sí sola. El cambio ocurre en el endpoint servidor después de validar el token. Para sustituirlo por pagos reales hay que retirar `PAYMENT_MODE=demo`, implementar el proveedor en servidor y aceptar confirmaciones únicamente desde webhooks firmados e idempotentes.

