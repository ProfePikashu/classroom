# Recuperación AyRPC 2026: tracker estable + watchdog

## Intent
Restaurar el seguimiento de tiempo visto de recuperación al comportamiento conocido previo a la reanudación por checkpoint, manteniendo la posibilidad de continuar desde el último punto confirmado por servidor y avisando de forma visible cuando el navegador no está enviando tiempo válido.

## Problema observado
- El QA DNI 99999999 abre la recuperación y crea el gate, pero `video_watch_seconds` permanece en 0 y no se reciben heartbeats.
- El problema también aparece en Chrome, por lo que no se tratará como un caso exclusivo de Brave/Zen.
- Un alumno puede ver una grabación larga sin saber que el sistema no está validando su tiempo.
- Cast/transmisión a TV puede separar la reproducción efectiva del estado observable por el navegador.

## Enfoque elegido
1. Restaurar el loop académico de tracking al flujo conocido previo al cambio de checkpoint.
2. Mantener `Continuar desde...` sólo con `resume_position_seconds` confirmado por servidor. La reanudación no participa del contador académico.
3. Agregar un watchdog visible e independiente:
   - estado listo cuando el player controlado está disponible;
   - estado activo cuando llegan confirmaciones de progreso del backend;
   - advertencia si el player no puede montarse en 15 segundos;
   - advertencia si pasan 15 segundos de reproducción visible sin una confirmación de progreso del servidor;
   - la advertencia desaparece cuando vuelve a recibirse progreso válido.
4. No acreditar tiempo por reloj de página, localStorage, Cast ni heurísticas del navegador.

## UX
Debajo de la barra de `Tiempo visto válido` habrá un estado de validación.
- `Validación lista. Reproducí la clase para empezar.`
- `Validación activa · tu progreso se está guardando.`
- `No estamos pudiendo validar tu tiempo de reproducción. Pausá la clase y reintentá antes de continuar. El tiempo que no podamos confirmar no contará para habilitar el cuestionario.`

Cuando el seguimiento no pueda montarse, se ofrece `Reintentar validación`.

## Cast / TV
Duplicar pantalla no cambia el criterio: si el navegador sigue reproduciendo y enviando heartbeats, cuenta. Si el video se mueve a un dispositivo remoto y el navegador deja de reportar posición/progreso, se muestra la advertencia y no se inventa tiempo.

## Seguridad y no objetivos
- El backend sigue siendo la única autoridad de tiempo válido.
- No se cambia el corte académico, elegibilidad, estados, preguntas ni criterios de recuperación.
- No se añade crédito offline ni por tiempo de página abierta.
- No se modifica la base de datos.
