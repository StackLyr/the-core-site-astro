# Respuesta a incidentes — The Core Site Agenda

> Propietario: StackLayer / responsable del proyecto  
> Última revisión: 2026-09-24  
> Estado: demo; no autorizado para producción

## Clasificación y responsables

Registrar hora UTC, síntomas, datos afectados y severidad. Clasificar como indisponibilidad, abuso, acceso administrativo, vulnerabilidad, exposición de credenciales, corrupción de D1 o fallo de proveedor. Asignar responsable técnico y una persona que mantenga la cronología.

## Contención y evidencia

1. Pausar despliegues y, si es necesario, deshabilitar Pages o `PAYMENT_MODE=demo`.
2. Conservar logs de Cloudflare, revisiones desplegadas, variables configuradas, eventos de D1 e IP hashes; nunca copiar contraseñas o tokens a la bitácora.
3. Rotar `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, credenciales de Cloudflare y correo si pudieron exponerse.
4. Invalidar sesiones eliminando o revocando filas activas de `admin_sessions` después de preservar evidencia.
5. Corregir la causa, añadir una prueba de regresión y revisar rutas equivalentes.

## Recuperación y validación

Reconstruir desde una revisión Git confiable, crear secretos nuevos, restaurar D1 solo desde un punto verificado y validar autenticación, autorización, cupos, clientes, reservas, membresías, cola de correo, límites y encabezados. Reabrir gradualmente. Documentar impacto, cronología, causa, decisiones y tareas pendientes.

No existe todavía un ejercicio formal ni alertas operativas; ambos son bloqueadores de producción.

