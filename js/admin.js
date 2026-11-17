"use strict";

// Administrador temporal hasta integrar Firebase Authentication.
const ADMIN_ACTUAL = {
  uid: "admin-demo-001",
  nombre: "Administrador de prueba"
};

// Sección desde la que se abrió el detalle, para poder volver.
let seccionOrigen = "averias";

let averiaSeleccionada = null;

// Estados en los que el técnico está trabajando en la avería.
const ESTADOS_ACTIVOS = ["Asignado", "En proceso"];

// Estados en los que el administrador puede asignar o reasignar.
const ESTADOS_ASIGNABLES = ["Pendiente", "Asignado", "Rechazado"];

// Valor del filtro de técnico para las averías sin asignar.
const SIN_TECNICO = "sin-asignar";

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", iniciar);

function iniciar() {
  document
    .querySelectorAll(".navegacion button[data-seccion]")
    .forEach(boton => {
      boton.addEventListener("click", () => {
        mostrarSeccion(boton.dataset.seccion);
      });
    });

  cargarOpcionesTecnicos();

  $("buscar").addEventListener("input", mostrarAverias);

  [
    "filtroEstado",
    "filtroDepartamento",
    "filtroTipo",
    "filtroTecnico",
    "filtroDesde",
    "filtroHasta"
  ].forEach(id => {
    $(id).addEventListener("change", mostrarAverias);
  });

  $("formFiltros").addEventListener("submit", evento => {
    evento.preventDefault();
  });

  $("btnLimpiarFiltros").addEventListener("click", () => {
    $("formFiltros").reset();
    mostrarAverias();
  });

  $("btnVolver").addEventListener("click", () => {
    mostrarSeccion(seccionOrigen);
  });

  $("filtroTecnicos").addEventListener(
    "change",
    mostrarTecnicos
  );

  $("formAsignacion").addEventListener(
    "submit",
    asignarTecnico
  );

  mostrarSeccion("resumen");
}

function mostrarSeccion(nombre) {
  document
    .querySelectorAll("main section[data-seccion]")
    .forEach(seccion => {
      seccion.classList.toggle(
        "oculto",
        seccion.dataset.seccion !== nombre
      );
    });

  // El detalle mantiene activo el botón de la sección de origen.
  if (nombre !== "detalle") {
    seccionOrigen = nombre;

    document
      .querySelectorAll(".navegacion button[data-seccion]")
      .forEach(boton => {
        boton.classList.toggle(
          "activo",
          boton.dataset.seccion === nombre
        );
      });
  }

  if (nombre === "resumen") {
    mostrarResumen();
  }

  if (nombre === "averias") {
    mostrarAverias();
  }

  if (nombre === "pendientes") {
    mostrarPendientes();
  }

  if (nombre === "tecnicos") {
    mostrarTecnicos();
  }

  if (nombre === "chats") {
    mostrarChats();
  }

  if (nombre === "estadisticas") {
    mostrarEstadisticas();
  }
}

function mostrarMensaje(texto, error = false) {
  const mensaje = $("mensaje");
  mensaje.replaceChildren();

  const aviso = document.createElement("div");

  aviso.className = error ? "aviso error" : "aviso";
  aviso.textContent = texto;

  mensaje.appendChild(aviso);

  mensaje.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

function crearElemento(
  etiqueta,
  texto = "",
  clase = ""
) {
  const elemento = document.createElement(etiqueta);

  if (texto) elemento.textContent = texto;
  if (clase) elemento.className = clase;

  return elemento;
}

function textoFecha(valor) {
  if (!valor) {
    return "No registrada";
  }

  const fecha = new Date(
    valor.length === 10
      ? `${valor}T12:00:00`
      : valor
  );

  return Number.isNaN(fecha.getTime())
    ? valor
    : fecha.toLocaleString("es-CR", {
        dateStyle: "medium",
        ...(valor.length === 10
          ? {}
          : { timeStyle: "short" })
      });
}

function claseEstado(estado) {
  return "estado-" +
    estado.toLowerCase().replaceAll(" ", "-");
}

function textoCantidad(cantidad, singular, plural) {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

function diasDesde(valor) {
  const milisegundos = Date.now() - new Date(valor).getTime();

  return Math.max(
    0,
    Math.floor(milisegundos / 86400000)
  );
}

function ordenarPorFecha(averias, ascendente = false) {
  return [...averias].sort((a, b) => {
    const diferencia =
      new Date(a.fechaCreacion) -
      new Date(b.fechaCreacion);

    return ascendente ? diferencia : -diferencia;
  });
}

function mostrarVacio(lista, texto) {
  lista.appendChild(
    crearElemento("p", texto, "vacio")
  );
}

function crearTarjetaAveria(averia, detalleExtra = "") {
  const tarjeta = crearElemento(
    "article",
    "",
    "reporte"
  );

  const superior = crearElemento(
    "div",
    "",
    "reporte-superior"
  );

  const datos = document.createElement("div");

  datos.append(
    crearElemento("h3", averia.titulo),
    crearElemento(
      "p",
      `${averia.tipo} · ${averia.departamento}`
    ),
    crearElemento(
      "p",
      `Fecha: ${textoFecha(averia.fechaReporte)}`
    ),
    crearElemento(
      "p",
      `Técnico: ${averia.tecnicoNombre || "Sin asignar"}`
    )
  );

  if (detalleExtra) {
    datos.appendChild(
      crearElemento("p", detalleExtra)
    );
  }

  const estado = crearElemento(
    "span",
    averia.estado,
    `estado ${claseEstado(averia.estado)}`
  );

  superior.append(datos, estado);

  const boton = crearElemento(
    "button",
    "Ver detalles",
    "boton principal"
  );

  boton.type = "button";

  boton.addEventListener(
    "click",
    () => verDetalle(averia.id)
  );

  tarjeta.append(superior, boton);

  return tarjeta;
}

function cargarOpcionesTecnicos() {
  const selector = $("filtroTecnico");
  selector.replaceChildren();

  const opciones = [
    { valor: "", texto: "Todos los técnicos" },
    { valor: SIN_TECNICO, texto: "Sin asignar" },
    ...RepositorioTecnicos
      .obtenerTodos()
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map(tecnico => ({
        valor: tecnico.id,
        texto: tecnico.nombre
      }))
  ];

  opciones.forEach(({ valor, texto }) => {
    const opcion = crearElemento("option", texto);
    opcion.value = valor;
    selector.appendChild(opcion);
  });
}

function leerFiltros() {
  return {
    busqueda: $("buscar").value.trim().toLowerCase(),
    estado: $("filtroEstado").value,
    departamento: $("filtroDepartamento").value,
    tipo: $("filtroTipo").value,
    tecnicoId: $("filtroTecnico").value,
    desde: $("filtroDesde").value,
    hasta: $("filtroHasta").value
  };
}

// Filtro común para el listado y las estadísticas.
// Las fechas se comparan como texto en formato AAAA-MM-DD.
function filtrarAverias(averias, filtros = {}) {
  const {
    busqueda = "",
    estado = "",
    departamento = "",
    tipo = "",
    tecnicoId = "",
    desde = "",
    hasta = ""
  } = filtros;

  return averias.filter(averia =>
    (!estado || averia.estado === estado) &&
    (!departamento || averia.departamento === departamento) &&
    (!tipo || averia.tipo === tipo) &&
    (
      !tecnicoId ||
      (tecnicoId === SIN_TECNICO
        ? !averia.tecnicoId
        : averia.tecnicoId === tecnicoId)
    ) &&
    (!desde || averia.fechaReporte >= desde) &&
    (!hasta || averia.fechaReporte <= hasta) &&
    (
      !busqueda ||
      averia.titulo.toLowerCase().includes(busqueda) ||
      averia.id.toLowerCase().includes(busqueda)
    )
  );
}

function mostrarAverias() {
  const lista = $("listaAverias");
  lista.replaceChildren();

  const filtros = leerFiltros();

  // Evita elegir un rango de fechas invertido.
  $("filtroHasta").min = filtros.desde;
  $("filtroDesde").max = filtros.hasta;

  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    $("conteoAverias").textContent = "";
    mostrarVacio(
      lista,
      "La fecha inicial no puede ser posterior a la fecha final."
    );
    return;
  }

  const todas = RepositorioAverias.obtenerTodas();

  const averias = ordenarPorFecha(
    filtrarAverias(todas, filtros)
  );

  $("conteoAverias").textContent =
    `Mostrando ${averias.length} de ` +
    textoCantidad(todas.length, "avería registrada", "averías registradas") +
    ".";

  if (!averias.length) {
    mostrarVacio(
      lista,
      todas.length
        ? "No hay averías que coincidan con la búsqueda."
        : "Todavía no se han registrado averías."
    );
    return;
  }

  averias.forEach(averia => {
    lista.appendChild(crearTarjetaAveria(averia));
  });
}

function mostrarPendientes() {
  const lista = $("listaPendientes");
  lista.replaceChildren();

  // Las más antiguas primero: son las que deben atenderse antes.
  const pendientes = ordenarPorFecha(
    RepositorioAverias
      .obtenerTodas()
      .filter(averia => averia.estado === "Pendiente"),
    true
  );

  $("conteoPendientes").textContent =
    textoCantidad(
      pendientes.length,
      "avería espera",
      "averías esperan"
    ) +
    " la asignación de un técnico.";

  if (!pendientes.length) {
    mostrarVacio(
      lista,
      "No hay averías pendientes de asignar."
    );
    return;
  }

  pendientes.forEach(averia => {
    const dias = diasDesde(averia.fechaCreacion);

    lista.appendChild(
      crearTarjetaAveria(
        averia,
        dias === 0
          ? "Registrada hoy"
          : `En espera hace ${textoCantidad(dias, "día", "días")}`
      )
    );
  });
}

function agregarDato(
  contenedor,
  titulo,
  valor
) {
  const dato = crearElemento(
    "div",
    "",
    "dato"
  );

  dato.append(
    crearElemento("strong", titulo),
    crearElemento("span", valor ?? "No disponible")
  );

  contenedor.appendChild(dato);
}

function verDetalle(id) {
  const averia = RepositorioAverias.obtenerPorIdComoAdmin(id);

  if (!averia) {
    mostrarMensaje(
      "No se encontró la avería.",
      true
    );
    return;
  }

  averiaSeleccionada = id;

  const contenido = $("contenidoDetalle");
  contenido.replaceChildren();

  contenido.append(
    crearElemento("h2", averia.titulo),
    crearElemento(
      "span",
      averia.estado,
      `estado ${claseEstado(averia.estado)}`
    )
  );

  const datos = crearElemento(
    "div",
    "",
    "detalle-datos"
  );

  agregarDato(datos, "Número de reporte", averia.id);
  agregarDato(datos, "Usuario", averia.usuarioId);
  agregarDato(datos, "Departamento", averia.departamento);
  agregarDato(datos, "Tipo de avería", averia.tipo);
  agregarDato(datos, "Fecha del reporte", textoFecha(averia.fechaReporte));
  agregarDato(datos, "Fecha de registro", textoFecha(averia.fechaCreacion));
  agregarDato(datos, "Técnico asignado", averia.tecnicoNombre || "Sin asignar");
  agregarDato(datos, "Fecha de asignación", textoFecha(averia.fechaAsignacion));
  agregarDato(datos, "Fecha de resolución", textoFecha(averia.fechaResolucion));

  contenido.appendChild(datos);

  if (averia.tecnicoId) {
    const botonChat = crearElemento(
      "button",
      `Chat con ${averia.tecnicoNombre}`,
      "boton secundario"
    );

    botonChat.type = "button";

    botonChat.addEventListener("click", () => {
      abrirConversacion(averia.id);
    });

    contenido.appendChild(botonChat);
  }

  contenido.append(
    crearElemento("h3", "Descripción"),
    crearElemento("p", averia.descripcion)
  );

  if (averia.imagen) {
    const imagen = document.createElement("img");

    imagen.src = averia.imagen;
    imagen.alt = "Fotografía adjunta a la avería";
    imagen.className = "foto-averia";

    contenido.append(
      crearElemento("h3", "Fotografía"),
      imagen
    );
  }

  contenido.appendChild(
    crearElemento("h3", "Observaciones del técnico")
  );

  const observaciones = averia.observaciones || [];

  if (observaciones.length === 0) {
    contenido.appendChild(
      crearElemento("p", "Todavía no hay observaciones.")
    );
  } else {
    observaciones.forEach(observacion => {
      const bloque = crearElemento("div", "", "dato");

      bloque.append(
        crearElemento(
          "strong",
          `${observacion.autor} · ${textoFecha(observacion.fecha)}`
        ),
        crearElemento("p", observacion.texto)
      );

      contenido.appendChild(bloque);
    });
  }

  if (averia.conformidad) {
    contenido.append(
      crearElemento("h3", "Respuesta del usuario"),
      crearElemento(
        "p",
        averia.conformidad === "Aceptada"
          ? `Solución aceptada el ${textoFecha(averia.fechaConformidad)}.`
          : `Solución rechazada: ${averia.motivoRechazo}`
      )
    );
  }

  const asignaciones = averia.historialAsignaciones || [];

  if (asignaciones.length) {
    contenido.appendChild(
      crearElemento("h3", "Historial de asignaciones")
    );

    asignaciones.forEach(asignacion => {
      const bloque = crearElemento("div", "", "dato");

      bloque.append(
        crearElemento(
          "strong",
          `${textoFecha(asignacion.fecha)} · ${asignacion.asignadoPor}`
        ),
        crearElemento(
          "p",
          `Asignada a ${asignacion.tecnicoNombre}.`
        )
      );

      if (asignacion.motivoRechazo) {
        bloque.appendChild(
          crearElemento(
            "p",
            `Reasignada tras el rechazo del usuario: ${asignacion.motivoRechazo}`
          )
        );
      }

      contenido.appendChild(bloque);
    });
  }

  prepararAsignacion(averia);

  mostrarSeccion("detalle");
}

function tecnicosConCarga() {
  const averias = RepositorioAverias.obtenerTodas();

  return RepositorioTecnicos.obtenerTodos().map(tecnico => {
    const activas = averias.filter(
      averia =>
        averia.tecnicoId === tecnico.id &&
        ESTADOS_ACTIVOS.includes(averia.estado)
    );

    return {
      ...tecnico,
      activas,
      disponible: activas.length === 0
    };
  });
}

function mostrarTecnicos() {
  const lista = $("listaTecnicos");
  lista.replaceChildren();

  const filtro = $("filtroTecnicos").value;
  const todos = tecnicosConCarga();

  const disponibles = todos.filter(
    tecnico => tecnico.disponible
  ).length;

  $("conteoTecnicos").textContent =
    `${disponibles} de ` +
    textoCantidad(todos.length, "técnico disponible", "técnicos disponibles") +
    ".";

  const tecnicos = todos
    .filter(tecnico =>
      !filtro ||
      (filtro === "disponibles" && tecnico.disponible) ||
      (filtro === "ocupados" && !tecnico.disponible)
    )
    .sort((a, b) =>
      a.activas.length - b.activas.length ||
      a.nombre.localeCompare(b.nombre)
    );

  if (!tecnicos.length) {
    mostrarVacio(
      lista,
      "No hay técnicos que coincidan con el filtro."
    );
    return;
  }

  tecnicos.forEach(tecnico => {
    const tarjeta = crearElemento("article", "", "reporte");

    const superior = crearElemento(
      "div",
      "",
      "reporte-superior"
    );

    const datos = document.createElement("div");

    datos.append(
      crearElemento("h3", tecnico.nombre),
      crearElemento(
        "p",
        `${tecnico.especialidad} · ${tecnico.correo}`
      ),
      crearElemento(
        "p",
        `Averías activas: ${tecnico.activas.length}`
      )
    );

    tecnico.activas.forEach(averia => {
      datos.appendChild(
        crearElemento(
          "p",
          `• ${averia.titulo} (${averia.estado})`
        )
      );
    });

    superior.append(
      datos,
      crearElemento(
        "span",
        tecnico.disponible ? "Disponible" : "Ocupado",
        tecnico.disponible
          ? "estado estado-disponible"
          : "estado estado-ocupado"
      )
    );

    tarjeta.appendChild(superior);
    lista.appendChild(tarjeta);
  });
}

function prepararAsignacion(averia) {
  const formulario = $("formAsignacion");
  const puedeAsignar = ESTADOS_ASIGNABLES.includes(averia.estado);

  formulario.classList.toggle("oculto", !puedeAsignar);

  if (!puedeAsignar) {
    return;
  }

  $("tituloAsignacion").textContent = averia.tecnicoId
    ? "Reasignar técnico"
    : "Asignar técnico";

  // Primero los disponibles con la especialidad de la avería,
  // luego el resto según su carga de trabajo.
  const tecnicos = tecnicosConCarga()
    .filter(tecnico => tecnico.id !== averia.tecnicoId)
    .sort((a, b) =>
      Number(b.disponible) - Number(a.disponible) ||
      Number(b.especialidad === averia.tipo) -
        Number(a.especialidad === averia.tipo) ||
      a.activas.length - b.activas.length ||
      a.nombre.localeCompare(b.nombre)
    );

  const selector = $("tecnicoAsignado");
  selector.replaceChildren();

  const vacia = crearElemento("option", "Seleccionar");
  vacia.value = "";
  selector.appendChild(vacia);

  tecnicos.forEach(tecnico => {
    const carga = tecnico.disponible
      ? "Disponible"
      : textoCantidad(tecnico.activas.length, "avería activa", "averías activas");

    const opcion = crearElemento(
      "option",
      `${tecnico.nombre} · ${tecnico.especialidad} · ${carga}`
    );

    opcion.value = tecnico.id;
    selector.appendChild(opcion);
  });
}

function asignarTecnico(evento) {
  evento.preventDefault();

  const averia = RepositorioAverias.obtenerPorIdComoAdmin(
    averiaSeleccionada
  );

  if (!averia || !ESTADOS_ASIGNABLES.includes(averia.estado)) {
    mostrarMensaje(
      "Esta avería ya no se puede asignar.",
      true
    );
    return;
  }

  const tecnico = RepositorioTecnicos.obtenerPorId(
    $("tecnicoAsignado").value
  );

  if (!tecnico) {
    mostrarMensaje("Seleccioná un técnico.", true);
    return;
  }

  const ahora = new Date().toISOString();

  const asignacion = {
    tecnicoId: tecnico.id,
    tecnicoNombre: tecnico.nombre,
    fecha: ahora,
    asignadoPor: ADMIN_ACTUAL.nombre,
    motivoRechazo:
      averia.estado === "Rechazado"
        ? averia.motivoRechazo
        : null
  };

  const cambios = {
    tecnicoId: tecnico.id,
    tecnicoNombre: tecnico.nombre,
    estado: "Asignado",
    // Se conserva la primera asignación para medir el tiempo de respuesta.
    fechaAsignacion: averia.fechaAsignacion || ahora,
    historialAsignaciones: [
      ...(averia.historialAsignaciones || []),
      asignacion
    ]
  };

  // Tras un rechazo, la avería vuelve a trabajarse y el usuario
  // debe poder confirmar la nueva solución.
  if (averia.estado === "Rechazado") {
    Object.assign(cambios, {
      fechaResolucion: null,
      conformidad: null,
      motivoRechazo: null,
      fechaConformidad: null
    });
  }

  try {
    RepositorioAverias.actualizarComoAdmin(averia.id, cambios);

    verDetalle(averia.id);

    mostrarMensaje(
      `Avería asignada a ${tecnico.nombre}.`
    );
  } catch (error) {
    mostrarMensaje(
      "No se pudo asignar el técnico.",
      true
    );
    console.error(error);
  }
}

function contarPorEstado(averias, ...estados) {
  return averias.filter(
    averia => estados.includes(averia.estado)
  ).length;
}

function mostrarResumen() {
  const averias = RepositorioAverias.obtenerTodas();
  const tecnicos = tecnicosConCarga();

  const disponibles = tecnicos.filter(
    tecnico => tecnico.disponible
  ).length;

  const indicadores = [
    {
      titulo: "Averías registradas",
      valor: averias.length
    },
    {
      titulo: "Pendientes de asignar",
      valor: contarPorEstado(averias, "Pendiente"),
      clase: "estado-pendiente"
    },
    {
      titulo: "En atención",
      valor: contarPorEstado(averias, "Asignado", "En proceso"),
      clase: "estado-en-proceso"
    },
    {
      titulo: "Resueltas o cerradas",
      valor: contarPorEstado(averias, "Resuelto", "Cerrado"),
      clase: "estado-cerrado"
    },
    {
      titulo: "Rechazadas",
      valor: contarPorEstado(averias, "Rechazado"),
      clase: "estado-rechazado"
    },
    {
      titulo: "Técnicos disponibles",
      valor: `${disponibles} de ${tecnicos.length}`
    }
  ];

  const contenedor = $("indicadores");
  contenedor.replaceChildren();

  indicadores.forEach(indicador => {
    const tarjeta = crearElemento(
      "article",
      "",
      `indicador ${indicador.clase || ""}`.trim()
    );

    tarjeta.append(
      crearElemento("strong", String(indicador.valor)),
      crearElemento("span", indicador.titulo)
    );

    contenedor.appendChild(tarjeta);
  });
}
