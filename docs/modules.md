\# Módulos de AndyAzhTEC Classroom



\## Objetivo de este documento



Este documento define los módulos principales de AndyAzhTEC Classroom y qué responsabilidad tendrá cada uno dentro del sistema.



La idea es separar bien las funciones para que el proyecto pueda crecer sin convertirse en un quilombo inmantenible.



\---



\# 1. Dashboard



\## Descripción



Pantalla inicial del usuario luego de iniciar sesión.



Debe mostrar información resumida según el rol del usuario.



\## Para alumnos



Debe mostrar:



\- cursos activos

\- próximas clases

\- clases pendientes

\- asistencias recientes

\- exámenes pendientes

\- recuperatorios pendientes

\- certificados o constancias disponibles

\- avisos importantes



\## Para docentes



Debe mostrar:



\- cursos asignados

\- clases próximas

\- alumnos activos

\- asistencias a revisar

\- exámenes pendientes de corrección

\- consultas recientes del foro

\- alertas administrativas



\## Para administradores



Debe mostrar:



\- resumen general de alumnos

\- cursos activos

\- cantidad de cursadas

\- asistencia general

\- exámenes activos

\- recuperatorios pendientes

\- certificados emitidos

\- actividad reciente del sistema



\---



\# 2. Usuarios y roles



\## Descripción



Módulo encargado de manejar usuarios, permisos y accesos.



\## Roles iniciales



\### Alumno



Puede acceder a sus cursos, clases, materiales, asistencias, exámenes, recuperatorios, feedback y certificados.



\### Docente



Puede gestionar clases, materiales, asistencias, evaluaciones, feedback y consultas.



\### Administrador



Puede gestionar todo el sistema.



\## Datos mínimos de usuario



\- id

\- nombre completo

\- DNI

\- correo

\- teléfono

\- rol

\- estado

\- fecha de creación

\- último acceso



\---



\# 3. Cursos



\## Descripción



Módulo encargado de agrupar clases, alumnos, materiales, evaluaciones y certificados.



\## Datos mínimos de curso



\- id

\- nombre

\- descripción

\- año

\- estado

\- fecha de inicio

\- fecha de finalización

\- modalidad

\- docente responsable



\## Estados posibles



\- borrador

\- activo

\- finalizado

\- archivado



\## Curso inicial



\- AyRPC 2026



\---



\# 4. Cursadas



\## Descripción



Representa la relación entre un alumno y un curso.



Un alumno puede estar inscripto en uno o varios cursos.



\## Datos mínimos de cursada



\- id

\- alumno\_id

\- curso\_id

\- estado

\- fecha de inscripción

\- porcentaje de asistencia

\- nota final

\- resultado final



\## Estados posibles



\- inscripto

\- regular

\- en riesgo

\- aprobado

\- desaprobado

\- abandonó

\- certificado



\---



\# 5. Clases



\## Descripción



Cada curso estará dividido en clases.



\## Datos mínimos de clase



\- id

\- curso\_id

\- número de clase

\- título

\- descripción

\- fecha

\- duración estimada

\- estado

\- link de clase en vivo

\- link de grabación

\- material asociado



\## Estados posibles



\- programada

\- en vivo

\- finalizada

\- archivada



\---



\# 6. Material de estudio



\## Descripción



Repositorio de materiales por curso y por clase.



\## Tipos de material



\- PDF

\- video

\- enlace externo

\- imagen

\- archivo descargable

\- guía escrita

\- apunte

\- presentación



\## Datos mínimos de material



\- id

\- curso\_id

\- clase\_id

\- título

\- descripción

\- tipo

\- url o archivo

\- visibilidad

\- fecha de carga



\---



\# 7. Asistencias



\## Descripción



Módulo encargado de registrar y evaluar la asistencia de los alumnos.



\## Funciones principales



\- registrar ingreso a clase

\- registrar salida o último pulso de actividad

\- calcular tiempo conectado

\- comparar contra el mínimo requerido

\- determinar estado de asistencia

\- permitir revisión manual



\## Estados posibles



\- PRESENTE

\- AUSENTE

\- REVISAR

\- RECUPERADA



\## Reglas iniciales



\- PRESENTE: cumple el mínimo de tiempo requerido.

\- AUSENTE: no registra actividad suficiente o no ingresa.

\- REVISAR: registra actividad, pero no alcanza claramente el mínimo.

\- RECUPERADA: recupera mediante cuestionario o actividad posterior.



\---



\# 8. Recuperatorios de asistencia



\## Descripción



Sistema para recuperar asistencia mediante material y cuestionario.



\## Flujo esperado



1\. El alumno no cumple asistencia o queda ausente.

2\. El sistema habilita recuperación.

3\. El alumno accede al material o grabación.

4\. El alumno responde un cuestionario.

5\. El sistema evalúa el resultado.

6\. Si aprueba, la asistencia pasa a RECUPERADA.



\## Datos mínimos



\- id

\- alumno\_id

\- clase\_id

\- cuestionario\_id

\- estado

\- nota

\- intentos

\- fecha de habilitación

\- fecha de finalización



\---



\# 9. ExamPro



\## Descripción



Módulo interno de evaluaciones.



ExamPro será integrado dentro de AndyAzhTEC Classroom como el sistema encargado de exámenes, recuperatorios, rúbricas, entregas y resultados.



\## Funciones principales



\- crear exámenes

\- crear preguntas

\- recibir entregas

\- gestionar archivos

\- corregir respuestas

\- aplicar rúbricas

\- calcular resultados

\- registrar notas

\- emitir feedback evaluativo



\## Relación con Classroom



Classroom será la plataforma madre.



ExamPro será un módulo interno accesible desde:



\- curso

\- clase

\- alumno

\- panel docente

\- panel administrador



\---



\# 10. Certificados y constancias



\## Descripción



Módulo encargado de generar documentos para alumnos.



\## Tipos de documentos



\- certificado de aprobación

\- constancia de cursada

\- constancia de asistencia

\- constancia de participación

\- comprobante interno



\## Datos mínimos



\- id

\- alumno\_id

\- curso\_id

\- tipo

\- estado

\- url del documento

\- fecha de emisión

\- código de validación



\---



\# 11. Feedback



\## Descripción



Módulo de devoluciones docentes.



\## Tipos de feedback



\- feedback por examen

\- feedback por clase

\- feedback general del curso

\- observación individual

\- recomendación técnica



\## Datos mínimos



\- id

\- alumno\_id

\- docente\_id

\- curso\_id

\- clase\_id

\- examen\_id

\- contenido

\- visibilidad

\- fecha de creación



\---



\# 12. Foro y comunidad



\## Descripción



Espacio para consultas, hilos y participación de alumnos.



\## Funciones principales



\- crear hilos por curso

\- crear hilos por clase

\- responder consultas

\- marcar respuestas útiles

\- marcar respuestas solucionadas

\- moderar contenido



\## Categorías iniciales



\- consultas generales

\- dudas por clase

\- problemas técnicos

\- recursos compartidos

\- avisos de docentes



\---



\# 13. Notificaciones



\## Descripción



Módulo para avisar eventos importantes al usuario.



\## Tipos de notificación



\- nueva clase disponible

\- material nuevo

\- examen habilitado

\- recuperatorio pendiente

\- feedback recibido

\- certificado disponible

\- respuesta en foro



\---



\# 14. Reportes



\## Descripción



Módulo de análisis y seguimiento.



\## Reportes iniciales



\- asistencia por alumno

\- asistencia por curso

\- alumnos en riesgo

\- resultados de exámenes

\- recuperatorios pendientes

\- certificados emitidos

\- actividad general del curso



\---



\# 15. Futuro: Bolsa de trabajo



\## Descripción



Módulo futuro para conectar egresados con oportunidades laborales.



No forma parte del MVP inicial.



\---



\# 16. Futuro: Red de servicios



\## Descripción



Módulo futuro para conectar oferta y solicitud de servicios técnicos.



No forma parte del MVP inicial.

