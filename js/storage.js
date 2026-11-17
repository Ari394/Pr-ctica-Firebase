"use strict";

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
  function obtenerPorIdComoAdmin(id) {
    return obtenerTodas().find(
      averia => averia.id === id
    ) || null;
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

  const CLAVE_INTERVENCIONES = "helpdesk_intervenciones_v1";
  const CLAVE_EVIDENCIAS = "helpdesk_evidencias_v1";
  const CLAVE_MENSAJES = "helpdesk_mensajes_v1";

  function leerLista(clave) {
    try {
      const datos = JSON.parse(localStorage.getItem(clave) || "[]");
      return Array.isArray(datos) ? datos : [];
    } catch (error) {
      console.error("Error al leer " + clave + ":", error);
      return [];
    }
  }

  function agregarEnLista(clave, elemento) {
    const lista = leerLista(clave);
    lista.push(elemento);
    localStorage.setItem(clave, JSON.stringify(lista));
    return elemento;
  }

  function listarPorAveria(clave, averiaId) {
    return leerLista(clave)
      .filter(elemento => elemento.averiaId === averiaId)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  }

  async function obtenerAveriasTecnico(tecnicoId) {
    return obtenerTodas().filter(
      averia => averia.tecnicoId === tecnicoId
    );
  }

  async function obtenerAveriaTecnico(id, tecnicoId) {
    return obtenerTodas().find(
      averia => averia.id === id && averia.tecnicoId === tecnicoId
    ) || null;
  }

  async function actualizarAveriaTecnico(id, tecnicoId, cambios) {
    const averias = obtenerTodas();

    const indice = averias.findIndex(
      averia => averia.id === id && averia.tecnicoId === tecnicoId
    );

    if (indice === -1) {
      throw new Error("No se encontró la avería asignada.");
    }

    averias[indice] = {
      ...averias[indice],
      ...cambios,
      id: averias[indice].id,
      usuarioId: averias[indice].usuarioId,
      tecnicoId: averias[indice].tecnicoId
    };

    guardarTodas(averias);

    return averias[indice];
  }

  async function agregarIntervencion(intervencion) {
    return agregarEnLista(CLAVE_INTERVENCIONES, intervencion);
  }

  async function obtenerIntervenciones(averiaId) {
    return listarPorAveria(CLAVE_INTERVENCIONES, averiaId);
  }

  async function agregarEvidencia(evidencia) {
    return agregarEnLista(CLAVE_EVIDENCIAS, evidencia);
  }

  async function obtenerEvidencias(averiaId) {
    return listarPorAveria(CLAVE_EVIDENCIAS, averiaId);
  }

  async function agregarMensaje(mensaje) {
    return agregarEnLista(CLAVE_MENSAJES, mensaje);
  }

  async function obtenerMensajes(averiaId) {
    return listarPorAveria(CLAVE_MENSAJES, averiaId);
  }

  return {
    obtenerTodas,
    obtenerPorIdComoAdmin,
    actualizarComoAdmin,
    crear,
    obtenerPorUsuario,
    obtenerPorId,
    actualizar,
    obtenerAveriasTecnico,
    obtenerAveriaTecnico,
    actualizarAveriaTecnico,
    agregarIntervencion,
    obtenerIntervenciones,
    agregarEvidencia,
    obtenerEvidencias,
    agregarMensaje,
    obtenerMensajes
  };
})();
