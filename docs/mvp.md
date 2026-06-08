\# MVP de AndyAzhTEC Classroom



\## Objetivo del MVP



Crear una primera versión funcional de AndyAzhTEC Classroom que permita gestionar un curso técnico desde una plataforma propia, integrando de forma progresiva el módulo ExamPro.



El MVP debe ser simple, usable y ampliable.



No busca tener todas las funciones finales desde el inicio, sino establecer una base sólida para:



\- cursos

\- alumnos

\- clases

\- materiales

\- asistencias

\- evaluaciones mediante ExamPro

\- certificados o constancias en una etapa posterior



\---



\# Regla principal del MVP



Primero se construye el Classroom como plataforma madre.



ExamPro se integra como módulo interno, sin romper lo que ya funciona.



\---



\# Módulos incluidos en el MVP



\## 1. Dashboard inicial



Debe existir una pantalla principal luego del ingreso.



En la primera versión puede mostrar:



\- nombre del usuario

\- rol

\- cursos activos

\- accesos rápidos

\- avisos generales

\- estado básico del curso



\## 2. Gestión de usuarios básica



Debe permitir manejar usuarios con roles mínimos.



Roles incluidos:



\- alumno

\- docente

\- administrador



Datos mínimos:



\- nombre completo

\- DNI

\- correo

\- teléfono

\- rol

\- estado



\## 3. Gestión de cursos básica



Debe permitir crear y administrar cursos.



Curso inicial:



\- AyRPC 2026



Datos mínimos:



\- nombre

\- descripción

\- año

\- estado

\- fecha de inicio

\- fecha de finalización



\## 4. Gestión de clases básica



Cada curso debe poder tener clases asociadas.



Datos mínimos:



\- número de clase

\- título

\- descripción

\- fecha

\- duración estimada

\- estado

\- link de clase

\- link de grabación



\## 5. Material de estudio básico



Debe permitir asociar material a una clase.



Tipos iniciales:



\- enlace

\- PDF

\- video

\- archivo



En la primera versión puede manejarse con URLs o rutas simples.



\## 6. Asistencia básica



Debe permitir registrar el estado de asistencia de un alumno por clase.



Estados iniciales:



\- PRESENTE

\- AUSENTE

\- REVISAR

\- RECUPERADA



En el MVP inicial no es obligatorio que el contador de tiempo esté automatizado desde el primer día.



Primero puede existir carga o revisión manual.



Luego se incorpora el validador automático.



\## 7. Integración inicial de ExamPro



ExamPro debe figurar como módulo interno del Classroom.



En el MVP puede integrarse mediante enlace interno o sección embebida.



Debe permitir acceder a:



\- exámenes

\- alumnos

\- resultados

\- recuperatorios

\- rúbricas



No se debe reescribir ExamPro en esta etapa.



\## 8. Panel admin básico



Debe permitir acceder a las secciones principales:



\- usuarios

\- cursos

\- clases

\- materiales

\- asistencias

\- ExamPro



\---



\# Módulos NO incluidos en el MVP inicial



Estos módulos quedan para etapas posteriores:



\- foro completo

\- comunidad con hilos

\- bolsa de trabajo

\- red de servicios

\- marketplace

\- sistema avanzado de notificaciones

\- automatización completa del contador de asistencia

\- certificados automáticos completos

\- pagos

\- tienda integrada

\- perfiles públicos de técnicos



\---



\# Flujo mínimo del alumno



1\. El alumno ingresa al Classroom.

2\. Ve su curso activo.

3\. Entra al curso.

4\. Ve las clases disponibles.

5\. Accede al material de estudio.

6\. Consulta su asistencia.

7\. Accede a evaluaciones desde ExamPro.

8\. Consulta resultados o feedback cuando estén disponibles.



\---



\# Flujo mínimo del docente/admin



1\. Ingresa al panel.

2\. Crea o administra un curso.

3\. Carga clases.

4\. Carga materiales.

5\. Revisa alumnos.

6\. Revisa asistencias.

7\. Accede a ExamPro para evaluaciones.

8\. Consulta resultados.



\---



\# Primera pantalla a construir



La primera pantalla real del sistema será:



\## Dashboard del Classroom



Debe tener:



\- identidad visual AndyAzhTEC

\- navegación lateral

\- bienvenida

\- tarjetas de resumen

\- acceso a AyRPC 2026

\- acceso a ExamPro

\- acceso a materiales

\- acceso a asistencias

\- espacio para avisos



\---



\# Stack inicial sugerido



Para arrancar simple:



\- HTML

\- CSS

\- JavaScript

\- estructura modular

\- sin framework al inicio



Después se podrá migrar o integrar mejor con backend según necesidad.



\---



\# Prioridad de construcción



\## Etapa 1



\- estructura del proyecto

\- dashboard visual

\- navegación

\- mock de curso AyRPC 2026

\- mock de usuario

\- acceso visual a ExamPro



\## Etapa 2



\- listado de cursos

\- listado de clases

\- materiales por clase

\- estado de asistencia manual



\## Etapa 3



\- integración más profunda con ExamPro

\- datos reales

\- backend

\- autenticación

\- persistencia



\## Etapa 4



\- recuperatorios

\- certificados

\- feedback

\- reportes



\## Etapa 5



\- foro

\- comunidad

\- notificaciones

\- bolsa de trabajo

\- red de servicios

