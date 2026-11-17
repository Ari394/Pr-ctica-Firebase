"use strict";

// Almacenamiento temporal de técnicos.
// Posteriormente será reemplazado por Firebase Firestore.

const RepositorioTecnicos = (() => {
  const CLAVE = "helpdesk_tecnicos_v1";

  // Datos iniciales mientras no exista el módulo de técnicos.
  // La disponibilidad no se guarda: se calcula según las
  // averías activas asignadas a cada técnico.
  const TECNICOS_INICIALES = [
    {
      id: "tecnico-001",
      nombre: "Carlos Méndez",
      correo: "carlos.mendez@helpdesk.local",
      especialidad: "Hardware"
    },
    {
      id: "tecnico-002",
      nombre: "María Rodríguez",
      correo: "maria.rodriguez@helpdesk.local",
      especialidad: "Software"
    },
    {
      id: "tecnico-003",
      nombre: "José Hernández",
      correo: "jose.hernandez@helpdesk.local",
      especialidad: "Hardware"
    },
    {
      id: "tecnico-004",
      nombre: "Ana Castillo",
      correo: "ana.castillo@helpdesk.local",
      especialidad: "Software"
    }
  ];

  function obtenerTodos() {
    try {
      const guardados = localStorage.getItem(CLAVE);

      if (guardados === null) {
        guardarTodos(TECNICOS_INICIALES);
        return [...TECNICOS_INICIALES];
      }

      const datos = JSON.parse(guardados);

      return Array.isArray(datos) ? datos : [];
    } catch (error) {
      console.error("Error al leer técnicos:", error);
      return [];
    }
  }

  function guardarTodos(tecnicos) {
    localStorage.setItem(
      CLAVE,
      JSON.stringify(tecnicos)
    );
  }

  function obtenerPorId(id) {
    return obtenerTodos().find(
      tecnico => tecnico.id === id
    ) || null;
  }

  function actualizar(id, cambios) {
    const tecnicos = obtenerTodos();

    const indice = tecnicos.findIndex(
      tecnico => tecnico.id === id
    );

    if (indice === -1) {
      throw new Error("No se encontró el técnico.");
    }

    tecnicos[indice] = {
      ...tecnicos[indice],
      ...cambios,
      id: tecnicos[indice].id
    };

    guardarTodos(tecnicos);

    return tecnicos[indice];
  }

  return {
    obtenerTodos,
    obtenerPorId,
    actualizar
  };
})();
