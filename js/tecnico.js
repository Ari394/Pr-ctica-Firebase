"use strict";

let TECNICO_ACTUAL = null;



const ETIQUETAS_ACCION = {
  "En proceso": { Asignado: "Iniciar atención", Rechazado: "Retomar atención" },
  "Resuelto": { "En proceso": "Marcar como resuelta" }
};

let averiaSeleccionada = null;

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  let iniciado = false;

  function iniciarTecnico() {
    if (iniciado || !window.USUARIO_FIREBASE) {
      return;
    }

    if (window.USUARIO_FIREBASE.rol !== "tecnico") {
      return;
    }

    
TECNICO_ACTUAL = {
  uid: window.USUARIO_FIREBASE.uid,
  nombre: window.USUARIO_FIREBASE.nombre,
  rol: "Tecnico"
};

ServicioTecnico.configurar(FirebaseService);

iniciado = true;
iniciar();

  }

  window.addEventListener("usuario-autenticado", iniciarTecnico);
  iniciarTecnico();
});

function iniciar() {
  $("btnVolver").addEventListener("click", mostrarPanel);
  $("filtroEstado").addEventListener("change", mostrarPanel);
  $("formObservacion").addEventListener("submit", guardarObservacion);
  $("formEvidencia").addEventListener("submit", subirEvidencia);
  $("formMensaje").addEventListener("submit", enviarMensaje);
  $("btnActualizarChat").addEventListener("click", actualizarChat);

  mostrarPanel();
}

function mostrarMensaje(texto, error = false) {
  const mensaje = $("mensaje");
  mensaje.replaceChildren();

  const aviso = document.createElement("div");
  aviso.className = error ? "aviso error" : "aviso";
  aviso.textContent = texto;

  mensaje.appendChild(aviso);
  mensaje.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function mensajeDeError(error) {
  return error && error.name === "QuotaExceededError"
    ? "No hay espacio suficiente en el navegador."
    : (error && error.message) || "Ocurrió un error inesperado.";
}

function crearElemento(etiqueta, texto, clase = "") {
  const elemento = document.createElement(etiqueta);
  elemento.textContent = texto ?? "";

  if (clase) {
    elemento.className = clase;
  }

  return elemento;
}

function textoFecha(valor) {
  if (!valor) {
    return "No registrada";
  }

  const fecha = new Date(
    valor.length === 10 ? `${valor}T12:00:00` : valor
  );

  return Number.isNaN(fecha.getTime())
    ? valor
    : fecha.toLocaleString("es-CR", {
        dateStyle: "medium",
        ...(valor.length === 10 ? {} : { timeStyle: "short" })
      });
}

function claseEstado(estado) {
  return "estado-" + estado.toLowerCase().replaceAll(" ", "-");
}

function agregarDato(contenedor, titulo, valor) {
  const dato = crearElemento("div", "", "dato");
  dato.appendChild(crearElemento("strong", titulo));
  dato.appendChild(crearElemento("span", valor ?? "No disponible"));
  contenedor.appendChild(dato);
}

function mostrarSeccion(nombre) {
  $("seccionPanel").classList.toggle("oculto", nombre !== "panel");
  $("seccionDetalle").classList.toggle("oculto", nombre !== "detalle");
}

async function mostrarPanel() {
  mostrarSeccion("panel");
  averiaSeleccionada = null;

  const lista = $("listaAsignadas");
  lista.replaceChildren();

  try {
    const filtro = $("filtroEstado").value;
    const panel = (await ServicioTecnico.listarPanel(TECNICO_ACTUAL))
      .filter(item => !filtro || item.averia.estado === filtro);

    if (!panel.length) {
      lista.appendChild(
        crearElemento(
          "p",
          "No tenés averías asignadas con ese estado.",
          "vacio"
        )
      );
      return;
    }

    panel.forEach(item => lista.appendChild(crearTarjeta(item)));
  } catch (error) {
    mostrarMensaje(mensajeDeError(error), true);
  }
}

function crearTarjeta({ averia, totalMensajes, ultimoMensaje }) {
  const tarjeta = crearElemento("article", "", "reporte");
  const superior = crearElemento("div", "", "reporte-superior");
  const datos = document.createElement("div");

  datos.appendChild(crearElemento("h3", averia.titulo));
  datos.appendChild(
    crearElemento("p", `${averia.tipo} · ${averia.departamento}`)
  );
  datos.appendChild(
    crearElemento("p", `Fecha: ${textoFecha(averia.fechaReporte)}`)
  );
  datos.appendChild(
    crearElemento(
      "p",
      totalMensajes
        ? `Mensajes: ${totalMensajes} (último: ${textoFecha(ultimoMensaje.fecha)})`
        : "Mensajes: ninguno"
    )
  );

  superior.append(
    datos,
    crearElemento("span", averia.estado, `estado ${claseEstado(averia.estado)}`)
  );

  const boton = crearElemento("button", "Ver detalles", "boton principal");
  boton.type = "button";
  boton.addEventListener("click", () => verDetalle(averia.id));

  tarjeta.append(superior, boton);
  return tarjeta;
}

async function verDetalle(id) {
  try {
    const detalle = await ServicioTecnico.obtenerDetalle(id, TECNICO_ACTUAL);

    averiaSeleccionada = id;
    mostrarSeccion("detalle");
    renderizarDetalle(detalle);
  } catch (error) {
    mostrarMensaje(mensajeDeError(error), true);
  }
}

async function recargarDetalle() {
  const detalle = await ServicioTecnico.obtenerDetalle(
    averiaSeleccionada,
    TECNICO_ACTUAL
  );

  renderizarDetalle(detalle);
}

function renderizarDetalle({ averia, intervenciones, evidencias, mensajes }) {
  renderizarDatos(averia);
  renderizarAcciones(averia);
  renderizarEvidencias(evidencias);
  renderizarIntervenciones(intervenciones);
  renderizarMensajes(mensajes);
}

function renderizarDatos(averia) {
  const contenido = $("contenidoDetalle");
  contenido.replaceChildren();

  contenido.appendChild(crearElemento("h2", averia.titulo));
  contenido.appendChild(
    crearElemento("span", averia.estado, `estado ${claseEstado(averia.estado)}`)
  );

  const datos = crearElemento("div", "", "detalle-datos");

  agregarDato(datos, "Número de reporte", averia.id);
  agregarDato(datos, "Departamento", averia.departamento);
  agregarDato(datos, "Tipo de avería", averia.tipo);
  agregarDato(datos, "Fecha del reporte", textoFecha(averia.fechaReporte));
  agregarDato(datos, "Inicio de atención", textoFecha(averia.fechaInicioAtencion));
  agregarDato(datos, "Fin de atención", textoFecha(averia.fechaFinAtencion));

  contenido.appendChild(datos);

  contenido.appendChild(crearElemento("h3", "Descripción"));
  contenido.appendChild(crearElemento("p", averia.descripcion));

  if (averia.imagen) {
    contenido.appendChild(crearElemento("h3", "Fotografía del usuario"));

    const imagen = document.createElement("img");
    imagen.src = averia.imagen;
    imagen.alt = "Fotografía adjunta por el usuario";
    imagen.className = "foto-averia";
    contenido.appendChild(imagen);
  }

  if (averia.estado === "Rechazado") {
    contenido.appendChild(crearElemento("h3", "Solución rechazada por el usuario"));
    contenido.appendChild(
      crearElemento("p", averia.motivoRechazo || "Sin motivo registrado.")
    );
  }

  contenido.appendChild(crearElemento("h3", "Observaciones registradas"));

  const observaciones = averia.observaciones || [];

  if (!observaciones.length) {
    contenido.appendChild(
      crearElemento("p", "Todavía no hay observaciones.", "vacio")
    );
  }

  observaciones.forEach(observacion => {
    const bloque = crearElemento("div", "", "dato");
    bloque.appendChild(
      crearElemento(
        "strong",
        `${observacion.autor} · ${textoFecha(observacion.fecha)}`
      )
    );
    bloque.appendChild(crearElemento("p", observacion.texto));
    contenido.appendChild(bloque);
  });
}

function renderizarAcciones(averia) {
  const acciones = $("accionesEstado");
  acciones.replaceChildren();

  ServicioTecnico.estadosSiguientes(averia.estado).forEach(nuevoEstado => {
    const etiqueta = ETIQUETAS_ACCION[nuevoEstado][averia.estado];
    const clase = nuevoEstado === "Resuelto" ? "exito" : "principal";

    const boton = crearElemento("button", etiqueta, `boton ${clase}`);
    boton.type = "button";
    boton.addEventListener("click", () => cambiarEstado(nuevoEstado));

    acciones.appendChild(boton);
  });
}

async function cambiarEstado(nuevoEstado) {
  if (
    nuevoEstado === "Resuelto" &&
    !confirm("¿Confirmás que la avería quedó resuelta?")
  ) {
    return;
  }

  try {
    await ServicioTecnico.cambiarEstado(
      averiaSeleccionada,
      TECNICO_ACTUAL,
      nuevoEstado
    );

    await recargarDetalle();
    mostrarMensaje(`Estado actualizado a "${nuevoEstado}".`);
  } catch (error) {
    mostrarMensaje(mensajeDeError(error), true);
  }
}

async function guardarObservacion(evento) {
  evento.preventDefault();

  try {
    await ServicioTecnico.agregarObservacion(
      averiaSeleccionada,
      TECNICO_ACTUAL,
      $("textoObservacion").value
    );

    $("formObservacion").reset();
    await recargarDetalle();
    mostrarMensaje("Observación guardada correctamente.");
  } catch (error) {
    mostrarMensaje(mensajeDeError(error), true);
  }
}


function renderizarEvidencias(evidencias) {
  const lista = $("listaEvidencias");
  lista.replaceChildren();

  if (!evidencias.length) {
    lista.appendChild(
      crearElemento("p", "Todavía no hay evidencias.", "vacio")
    );
    return;
  }

  evidencias.forEach(evidencia => {
    const bloque = crearElemento("div", "", "dato");

    bloque.appendChild(
      crearElemento(
        "strong",
        `${evidencia.autor} · ${textoFecha(evidencia.fecha)}`
      )
    );

    const imagen = document.createElement("img");
    imagen.src = evidencia.url;
    imagen.alt = "Evidencia de la reparación";
    imagen.className = "foto-averia";
    bloque.appendChild(imagen);

    lista.appendChild(bloque);
  });
}

async function subirEvidencia(evento) {
  evento.preventDefault();

  try {
    await ServicioTecnico.agregarEvidencia(
      averiaSeleccionada,
      TECNICO_ACTUAL,
      $("archivoEvidencia").files[0]
    );

    $("formEvidencia").reset();
    await recargarDetalle();
    mostrarMensaje("Evidencia guardada correctamente.");
  } catch (error) {
    mostrarMensaje(mensajeDeError(error), true);
  }
}

function renderizarIntervenciones(intervenciones) {
  const lista = $("listaIntervenciones");
  lista.replaceChildren();

  if (!intervenciones.length) {
    lista.appendChild(
      crearElemento("p", "Todavía no hay intervenciones registradas.", "vacio")
    );
    return;
  }

  intervenciones.forEach(intervencion => {
    const bloque = crearElemento("div", "", "dato");

    bloque.appendChild(
      crearElemento(
        "strong",
        `${intervencion.tipo} · ${textoFecha(intervencion.fecha)}`
      )
    );
    bloque.appendChild(
      crearElemento("span", `${intervencion.autor}: ${intervencion.detalle}`)
    );

    lista.appendChild(bloque);
  });
}

function renderizarMensajes(mensajes) {
  const lista = $("listaMensajes");
  lista.replaceChildren();

  if (!mensajes.length) {
    lista.appendChild(
      crearElemento("p", "Todavía no hay mensajes en esta conversación.", "vacio")
    );
    return;
  }

  mensajes.forEach(mensaje => {
    const bloque = crearElemento("div", "", "dato");

    bloque.appendChild(
      crearElemento(
        "strong",
        `${mensaje.autorNombre} (${mensaje.autorRol}) · ${textoFecha(mensaje.fecha)}`
      )
    );
    bloque.appendChild(crearElemento("span", mensaje.texto));

    lista.appendChild(bloque);
  });
}

async function actualizarChat() {
  try {
    const mensajes = await ServicioTecnico.obtenerConversacion(
      averiaSeleccionada,
      TECNICO_ACTUAL
    );

    renderizarMensajes(mensajes);
  } catch (error) {
    mostrarMensaje(mensajeDeError(error), true);
  }
}

async function enviarMensaje(evento) {
  evento.preventDefault();

  try {
    await ServicioTecnico.enviarMensaje(
      averiaSeleccionada,
      TECNICO_ACTUAL,
      $("textoMensaje").value
    );

    $("formMensaje").reset();
    await actualizarChat();
  } catch (error) {
    mostrarMensaje(mensajeDeError(error), true);
  }
}