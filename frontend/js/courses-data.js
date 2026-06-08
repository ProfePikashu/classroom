/* ════════════════════════════════════════════════════════
   AndyAzhTEC Classroom — courses-data.js
   Datos iniciales de cursos disponibles
════════════════════════════════════════════════════════ */

"use strict";

const CLASSROOM_COURSES = [
  {
    id: "ayrpc-2025",
    family: "Armado y Reparación de Computadoras",
    title: "AyRPC 2025",
    year: 2025,
    status: "complete",
    statusLabel: "Completo",
    visibility: "available",
    badge: "Curso finalizado",
    icon: "fa-screwdriver-wrench",
    accent: "cyan",
    description:
      "Curso completo de Armado y Reparación de Computadoras. Los alumnos aptos ya pueden rendir recuperatorio, consultar materiales, acceder a clases grabadas y autogestionar certificados o constancias.",
    highlights: [
      "Curso completo y finalizado",
      "Alumnos aptos con recuperatorio disponible",
      "Materiales de estudio disponibles",
      "Clases grabadas en Twitch y YouTube",
      "Planilla completa de alumnos en Google Sheets",
      "Certificador cargado en GitHub",
      "Certificados y constancias autogestionables",
    ],
    metrics: [
      {
        label: "Estado",
        value: "Completo",
        icon: "fa-circle-check",
      },
      {
        label: "Recuperatorio",
        value: "Activo",
        icon: "fa-file-circle-question",
      },
      {
        label: "Materiales",
        value: "Disponibles",
        icon: "fa-folder-open",
      },
      {
        label: "Certificados",
        value: "Autogestión",
        icon: "fa-certificate",
      },
    ],
    links: {
      classroom: "#",
      exampro: "#",
      materials: "#",
      twitch: "#",
      youtube: "#",
      certificates: "#",
      spreadsheet: "#",
    },
    notes:
      "Este curso sirve como referencia histórica y como primer caso real para mostrar métricas, estados de alumnos, recuperatorios, materiales y certificación.",
  },
  {
    id: "ayrpc-2026",
    family: "Armado y Reparación de Computadoras",
    title: "AyRPC 2026",
    year: 2026,
    status: "coming_soon",
    statusLabel: "Próximamente",
    visibility: "coming-soon",
    badge: "Nueva edición",
    icon: "fa-microchip",
    accent: "violet",
    description:
      "Nueva edición del curso de Armado y Reparación de Computadoras. Se planifica con más clases, mejor material, nuevo manual técnico y herramientas propias del Classroom.",
    highlights: [
      "Nueva edición en preparación",
      "Más clases que la edición anterior",
      "Nuevo manual técnico de Comunidad Reparando",
      "Material de estudio mejor organizado",
      "Recuperación de clases con pocos pasos",
      "Validación de asistencia desde plataforma propia",
      "ExamPro integrado dentro del Classroom",
      "Certificados y constancias dentro del ecosistema AndyAzhTEC",
    ],
    metrics: [
      {
        label: "Estado",
        value: "Próximamente",
        icon: "fa-clock",
      },
      {
        label: "Manual técnico",
        value: "Nuevo",
        icon: "fa-book",
      },
      {
        label: "Clases",
        value: "+10 previstas",
        icon: "fa-chalkboard-user",
      },
      {
        label: "Plataforma",
        value: "Propia",
        icon: "fa-graduation-cap",
      },
    ],
    links: {
      classroom: "#",
      exampro: "#",
      materials: "#",
      twitch: "#",
      youtube: "#",
      certificates: "#",
      spreadsheet: "#",
    },
    notes:
      "Este curso será la primera edición pensada desde el inicio para funcionar con AndyAzhTEC Classroom como plataforma madre.",
  },
];