
"use strict";

// Almacenamiento temporal de averías.
// Posteriormente será reemplazado por Firebase Firestore.

const RepositorioAverias = (() => {
  const CLAVE = "helpdesk_averias_v1";

  function obtenerTodas() {
    try {
      const datos = JSON.parse(
        localStorage.getItem(CLAVE) || "[]"
      );

      return Array.isArray(datos) ? datos : [];
    } catch (error) {
      console.error("Error al leer averías:", error);
      return [];
    }
  }

  function guardarTodas(averias) {
    localStorage.setItem(
      CLAVE,
      JSON.stringify(averias)
    );
  }

  function crear(averia) {
    const averias = obtenerTodas();

    if (averias.some(a => a.id === averia.id)) {
      throw new Error("El identificador ya existe.");
    }

    averias.push(averia);
    guardarTodas(averias);

    return averia;
  }

  function obtenerPorUsuario(usuarioId) {
    return obtenerTodas().filter(
      averia => averia.usuarioId === usuarioId
    );
  }

  function obtenerPorId(id, usuarioId) {
    return obtenerTodas().find(
      averia =>
        averia.id === id &&
        averia.usuarioId === usuarioId
    ) || null;
  }

  function actualizar(id, usuarioId, cambios) {
    const averias = obtenerTodas();

    const indice = averias.findIndex(
      averia =>
        averia.id === id &&
        averia.usuarioId === usuarioId
    );

    if (indice === -1) {
      throw new Error("No se encontró la avería.");
    }

    averias[indice] = {
      ...averias[indice],
      ...cambios,
      id: averias[indice].id,
      usuarioId: averias[indice].usuarioId
    };

    guardarTodas(averias);

    return averias[indice];
  }

  // Uso exclusivo del administrador: no filtra por usuario.
  function actualizarComoAdmin(id, cambios) {
    const averias = obtenerTodas();

    const indice = averias.findIndex(
      averia => averia.id === id
    );

    if (indice === -1) {
      throw new Error("No se encontró la avería.");
    }

    averias[indice] = {
      ...averias[indice],
      ...cambios,
      id: averias[indice].id,
      usuarioId: averias[indice].usuarioId
    };

    guardarTodas(averias);

    return averias[indice];
  }

  return {
    obtenerTodas,
    actualizarComoAdmin,
    crear,
    obtenerPorUsuario,
    obtenerPorId,
    actualizar
  };
})();
