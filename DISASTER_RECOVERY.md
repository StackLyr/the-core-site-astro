# Recuperación y reconstrucción limpia — The Core Site Agenda

> Propietario: StackLayer / responsable del proyecto  
> Última prueba de restauración: no realizada  
> RPO/RTO: no definidos; bloqueador de producción

## Inventario reproducible

- Código Astro y Pages Functions en Git.
- Cloudflare Pages con binding `DB`.
- D1 `core-booking`, creado mediante `db/schema.sql` y migraciones documentadas.
- Variables: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `PAYMENT_MODE`; correo opcional mediante `RESEND_API_KEY` y `EMAIL_FROM`.
- Sin almacenamiento de archivos, colas externas ni procesador de pagos en el modo demo.

## Pérdida total o entorno no confiable

1. Declarar incidente, congelar despliegues y preservar logs/configuración.
2. Elegir una revisión Git confiable y crear un proyecto Cloudflare limpio.
3. Crear una D1 nueva, ejecutar `db/schema.sql` y aplicar migraciones futuras en orden.
4. Crear secretos nuevos; no reutilizar valores del entorno sospechoso.
5. Restaurar una copia verificada de D1 cuando exista una estrategia de backup aprobada.
6. Desplegar, enlazar D1 y validar reservas, cupos, panel, sesiones, membresías, límites y correo.
7. Revocar el entorno y credenciales anteriores después de la investigación.

## Estado de respaldo

No se ha configurado ni verificado un respaldo restaurable de D1. No se afirma capacidad de recuperación. Antes de producción se deben definir retención, RPO/RTO, propietario, exportación automatizada, protección de copias y realizar una restauración aislada con evidencia.

