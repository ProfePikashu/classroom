# Vista docente de conexión AyRPC 2026

## Intent
Mostrar en el panel AyRPC 2026 los tiempos reales de conexión del docente en lugar de dejar la interfaz en estado de carga permanente.

## Alcance
- Mantener intacta la carga normal de alumnos.
- Detectar la sesión docente y consultar el mismo endpoint de estado de cursada.
- Interpretar `teacher_preview` como vista personal de Twitch/MKC.
- Mostrar `REGISTRADO`, tiempo real, total, mejor clase, gráfico y avance de conexiones.
- No convertir al docente en alumno ni alterar estados académicos.

## Enfoque
Se agrega un controlador docente separado que reutiliza los helpers del panel actual. El controlador principal sigue retornando para docentes, evitando cambiar el camino de alumnos, y el nuevo controlador se encarga exclusivamente de la vista docente.
