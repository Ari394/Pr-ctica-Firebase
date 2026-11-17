"use strict";

const ServicioTecnico = (() => {
  const ESTADOS_PERMITIDOS = {
    "Asignado": ["En proceso"],
    "En proceso": ["Resuelto"],
    "Rechazado": ["En proceso"]
  };

  const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
  const MAXIMO_BYTES = 1024 * 1024;

  let repo = null;

  function configurar(repositorio) {
    repo = repositorio;
  }

  function verificarRepositorio() {
    if (!repo) {
      throw new Error("El repositorio no está configurado.");
    }
  }

  function generarId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function textoObligatorio(valor, mensaje) {
    const texto = (valor || "").trim();

    if (!texto) {
      throw new Error(mensaje);
    }

    return texto;
  }

  async function obtenerAsignada(id, tecnico) {
    verificarRepositorio();

    const averia = await repo.obtenerAveriaTecnico(id, tecnico.uid);

    if (!averia) {
      throw new Error("La avería no está asignada a este técnico.");
    }

    return averia;
  }

  function nuevaIntervencion(averia, tecnico, tipo, detalle, fecha) {
    return {
      id: generarId(),
      averiaId: averia.id,
      tecnicoId: tecnico.uid,
      autor: tecnico.nombre,
      tipo,
      detalle,
      fecha
    };
  }

  function estadosSiguientes(estado) {
    return ESTADOS_PERMITIDOS[estado] || [];
  }

  async function listarPanel(tecnico) {
    verificarRepositorio();

    const averias = await repo.obtenerAveriasTecnico(tecnico.uid);

    const panel = await Promise.all(
      averias.map(async averia => {
        const mensajes = await repo.obtenerMensajes(averia.id);

        return {
          averia,
          totalMensajes: mensajes.length,
          ultimoMensaje: mensajes.length
            ? mensajes[mensajes.length - 1]
            : null
        };
      })
    );

    return panel.sort(
      (a, b) =>
        new Date(b.averia.fechaCreacion) -
        new Date(a.averia.fechaCreacion)
    );
  }

  async function obtenerDetalle(id, tecnico) {
    const averia = await obtenerAsignada(id, tecnico);

    const [intervenciones, evidencias, mensajes] = await Promise.all([
      repo.obtenerIntervenciones(id),
      repo.obtenerEvidencias(id),
      repo.obtenerMensajes(id)
    ]);

    return { averia, intervenciones, evidencias, mensajes };
  }

  
async function cambiarEstado(id, tecnico, nuevoEstado) {
  const averia = await obtenerAsignada(id, tecnico);

  if (!estadosSiguientes(averia.estado).includes(nuevoEstado)) {
    throw new Error(
      `No se puede cambiar de "${averia.estado}" a "${nuevoEstado}".`
    );
  }

  const ahora = new Date().toISOString();
  const cambios = { estado: nuevoEstado };

  const registros = [
    nuevaIntervencion(
      averia,
      tecnico,
      "Cambio de estado",
      `${averia.estado} → ${nuevoEstado}`,
      ahora
    )
  ];

  if (averia.estado === "Rechazado") {
    registros.push(
      nuevaIntervencion(
        averia,
        tecnico,
        "Rechazo del usuario",
        `Motivo: ${averia.motivoRechazo || "No registrado"}`,
        ahora
      )
    );

    cambios.conformidad = null;
    cambios.motivoRechazo = null;
    cambios.fechaConformidad = null;
    cambios.fechaResolucion = null;
    cambios.fechaFinAtencion = null;
  }

  if (nuevoEstado === "En proceso" && !averia.fechaInicioAtencion) {
    cambios.fechaInicioAtencion = ahora;

    registros.push(
      nuevaIntervencion(
        averia,
        tecnico,
        "Inicio de atención",
        "Se registró el inicio de la atención.",
        ahora
      )
    );
  }

  if (nuevoEstado === "Resuelto") {
    cambios.fechaResolucion = ahora;
    cambios.fechaFinAtencion = ahora;

    registros.push(
      nuevaIntervencion(
        averia,
        tecnico,
        "Fin de atención",
        "Se marcó la avería como resuelta.",
        ahora
      )
    );
  }

  // Guardar el inicio de atención en una sola operación de Firestore.
  if (averia.estado === "Asignado" && nuevoEstado === "En proceso") {
    return repo.guardarInicioAtencion(
      id,
      tecnico.uid,
      cambios,
      registros
    );
  }

  
if (averia.estado === "En proceso" && nuevoEstado === "Resuelto") {
  return repo.guardarResolucion(
    id,
    tecnico.uid,
    cambios,
    registros
  );
}


if (averia.estado === "Rechazado" && nuevoEstado === "En proceso") {
  return repo.guardarReapertura(
    id,
    tecnico.uid,
    cambios,
    registros
  );
}



  // Conservar el comportamiento de los demás cambios de estado.
  for (const registro of registros) {
    await repo.agregarIntervencion(registro);
  }

  return repo.actualizarAveriaTecnico(
    id,
    tecnico.uid,
    cambios
  );
}


async function agregarObservacion(id, tecnico, texto) {
  const contenido = textoObligatorio(
    texto,
    "Escribí la observación antes de guardar."
  );

  const averia = await obtenerAsignada(id, tecnico);
  const ahora = new Date().toISOString();

  const observaciones = [
    ...(averia.observaciones || []),
    {
      autor: tecnico.nombre,
      fecha: ahora,
      texto: contenido
    }
  ];

  const registro = nuevaIntervencion(
    averia,
    tecnico,
    "Observación",
    contenido,
    ahora
  );

  return repo.guardarObservacion(
    id,
    tecnico.uid,
    observaciones,
    registro
  );
}

  
  function leerImagen(archivo) {
    return new Promise((resolve, reject) => {
      if (!archivo) {
        reject(new Error("Seleccioná una fotografía."));
        return;
      }

      if (!TIPOS_IMAGEN.includes(archivo.type)) {
        reject(new Error("Seleccioná una imagen JPG, PNG o WEBP."));
        return;
      }

      if (archivo.size > MAXIMO_BYTES) {
        reject(new Error("La imagen no debe superar 1 MB."));
        return;
      }

      const lector = new FileReader();

      lector.onload = () => resolve(lector.result);
      lector.onerror = () => reject(
        new Error("No se pudo leer la imagen.")
      );

      lector.readAsDataURL(archivo);
    });
  }

  async function agregarEvidencia(id, tecnico, archivo) {
    const averia = await obtenerAsignada(id, tecnico);
    const url = await leerImagen(archivo);
    const ahora = new Date().toISOString();

    const evidencia = {
      id: generarId(),
      averiaId: averia.id,
      tecnicoId: tecnico.uid,
      autor: tecnico.nombre,
      url,
      fecha: ahora
    };

    await repo.agregarEvidencia(evidencia);

    await repo.agregarIntervencion(
      nuevaIntervencion(
        averia,
        tecnico,
        "Evidencia",
        "Se adjuntó una fotografía de la reparación.",
        ahora
      )
    );

    return evidencia;
  }

  async function enviarMensaje(id, tecnico, texto) {
    const contenido = textoObligatorio(
      texto,
      "Escribí un mensaje antes de enviar."
    );

    const averia = await obtenerAsignada(id, tecnico);

    return repo.agregarMensaje({
      id: generarId(),
      averiaId: averia.id,
      autorId: tecnico.uid,
      autorNombre: tecnico.nombre,
      autorRol: "Tecnico",
      texto: contenido,
      fecha: new Date().toISOString()
    });
  }

  async function obtenerConversacion(id, tecnico) {
    await obtenerAsignada(id, tecnico);
    return repo.obtenerMensajes(id);
  }

  return {
    configurar,
    estadosSiguientes,
    listarPanel,
    obtenerDetalle,
    cambiarEstado,
    agregarObservacion,
    agregarEvidencia,
    enviarMensaje,
    obtenerConversacion
  };
})();