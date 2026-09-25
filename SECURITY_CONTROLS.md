# Registro de controles de seguridad

| Control | Implementación | Evidencia | Limitación / estado |
|---|---|---|---|
| Modo demo explícito | Solo `PAYMENT_MODE=demo` habilita simulaciones | `lib/payment.js`, `tests/booking-security.test.mjs` | No es un procesador real; PASS para demo |
| Pago ficticio interno | URL mismo origen, token aleatorio, sin campos de tarjeta | `/pago-demo/`, `/api/demo-payment` | Token viaja en URL; aceptable solo para demo |
| Autorización administrativa | Sesión HttpOnly revocable y comprobación servidor | `lib/booking.js`, `functions/api/admin/` | Contraseña compartida; BLOCKER para producción |
| Abuso | Límites persistidos por IP hash | `public_request_limits`, `allowPublicRequest` | Falta WAF/Turnstile y prueba de carga; WARNING |
| Cupos e idempotencia | Actualizaciones condicionadas por estado, expiración y capacidad | `functions/api/demo-payment.js` | Falta prueba de concurrencia remota; WARNING |
| Secretos | Valores fuera de Git y variables nombradas en documentación | `.dev.vars.example`, Cloudflare | Rotación no ensayada; WARNING |
| Recuperación | Procedimiento de reconstrucción documentado | `DISASTER_RECOVERY.md` | Restauración no verificada; BLOCKER |

