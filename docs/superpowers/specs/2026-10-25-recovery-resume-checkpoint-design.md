# Recuperación: reanudar desde el último punto guardado

## Intent
Permitir que un alumno retome una recuperación interrumpida sin volver a ver desde cero lo que ya tenía validado.

## Comportamiento
- La barra de `Tiempo visto válido` se reconstruye exclusivamente con `video_watch_seconds` recibido del backend.
- Si existe `resume_position_seconds`, se ofrece un botón `Continuar desde HH:MM:SS`.
- El botón no hace autoplay: sólo al tocarlo se hace seek y comienza la reproducción.
- Se retroceden 5 segundos respecto del checkpoint elegido para dar contexto.
- El navegador guarda un checkpoint local mientras el video se reproduce.
- El checkpoint local puede adelantar como máximo 10 segundos sobre el último punto confirmado por servidor.
- El checkpoint local jamás suma tiempo válido, modifica la barra ni habilita el cuestionario.
- Si el punto calculado es menor a 10 segundos, no se muestra el botón.
- Al recuperar la clase se limpia el checkpoint local.
- La vista previa docente no guarda ni consume checkpoints locales de alumno.

## Seguridad
- No guardar token, DNI, email ni otra PII en localStorage.
- La clave local se limita a curso + clase.
- El backend sigue validando todos los heartbeats y el progreso académico.

## Enfoque elegido
Servidor como ancla + checkpoint local acotado. El local sólo mejora la UX ante un corte brusco; el progreso académico siempre sale del servidor.