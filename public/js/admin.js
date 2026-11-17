"use strict";

// Administrador temporal hasta integrar Firebase Authentication.
const ADMIN_ACTUAL = {
  uid: "admin-demo-001",
  nombre: "Administrador de prueba"
};

// Técnicos registrados en Firebase
let tecnicosFirebase = [];

// Sección desde la que se abrió el detalle, para poder volver.
let seccionOrigen = "averias";

let averiaSeleccionada = null;

// Estados en los que el técnico está trabajando en la avería.
const ESTADOS_ACTIVOS = ["Asignado", "En proceso"];

// Estados en los que el administrador puede asignar o reasignar.
const ESTADOS_ASIGNABLES = ["Pendiente", "Asignado", "Rechazado"];

// Valor del filtro de técnico para las averías sin asignar.
const SIN_TECNICO = "sin-asignar";

// El administrador elige el tipo de servicio al asignar la avería.
const TIPOS_SERVICIO = [
  "Reparación",
  "Instalación",
  "Mantenimiento",
  "Configuración",
  "Otro"
];

const $ = id => document.getElementById(id);

// Iniciar el administrador cuando Firebase autorice el acceso
let administradorIniciado = false;

function iniciarAdministrador() {
  if (administradorIniciado) return;

  if (window.USUARIO_FIREBASE?.rol !== "administrador") {
    return;
  }

  if (!window.HelpDeskFirebase) {
    return;
  }

  const { db, storage, firestoreAPI, storageAPI } =
    window.HelpDeskFirebase;

  FirebaseService.configurar(
    db,
    storage,
    firestoreAPI,
    storageAPI
  );

  administradorIniciado = true;
  iniciar();
}

window.addEventListener(
  "usuario-autenticado",
  iniciarAdministrador
);

iniciarAdministrador();

function iniciar() {
  document
    .querySelectorAll(".navegacion button[data-seccion]")
    .forEach(boton => {
      boton.addEventListener("click", () => {
        mostrarSeccion(boton.dataset.seccion);
      });
    });

  cargarOpcionesTecnicos();
  cargarOpcionesServicio();

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
async function cargarOpcionesTecnicos() {
  const selector = $("filtroTecnico");
  selector.replaceChildren();

  let tecnicos = [];

  try {
    tecnicos = await FirebaseService.obtenerTecnicos();
  } catch (error) {
    console.error("Error al cargar técnicos:", error);

    const opcion = crearElemento(
      "option",
      "No se pudieron cargar los técnicos"
    );

    opcion.value = "";
    selector.appendChild(opcion);
    selector.disabled = true;
    return;
  }

  selector.disabled = false;

  const opciones = [
    { valor: "", texto: "Todos los técnicos" },
    { valor: SIN_TECNICO, texto: "Sin asignar" },
    ...tecnicos
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
function cargarOpcionesServicio() {
  const selector = $("tipoServicio");

  const vacia = crearElemento("option", "Seleccionar");
  vacia.value = "";
  selector.appendChild(vacia);

  TIPOS_SERVICIO.forEach(tipo => {
    const opcion = crearElemento("option", tipo);
    opcion.value = tipo;
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

async function mostrarAverias() {
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

 let todas;

try {
  todas = await FirebaseService.obtenerTodasAverias();
} catch (error) {
  console.error("Error al consultar averías:", error);

  $("conteoAverias").textContent = "";

  mostrarVacio(
    lista,
    "No se pudieron cargar las averías desde Firebase."
  );

  return;
}

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

async function mostrarPendientes() {
  const lista = $("listaPendientes");
  lista.replaceChildren();

  
let todas;

try {
  todas = await FirebaseService.obtenerTodasAverias();
} catch (error) {
  console.error("Error al consultar averías pendientes:", error);

  $("conteoPendientes").textContent = "";

  mostrarVacio(
    lista,
    "No se pudieron cargar las averías pendientes desde Firebase."
  );

  return;
}

const pendientes = ordenarPorFecha(
  todas.filter(averia => averia.estado === "Pendiente"),
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

async function verDetalle(id) {
  let averia;

try {
  averia = await FirebaseService.obtenerAveria(id);
} catch (error) {
  console.error("Error al consultar el detalle:", error);

  mostrarMensaje(
    "No se pudo cargar el detalle de la avería desde Firebase.",
    true
  );

  return;
}

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
  agregarDato(datos, "Tipo de servicio", averia.tipoServicio || "Sin definir");
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

 try {
  await prepararAsignacion(averia);
} catch (error) {
  console.error("Error al cargar técnicos:", error);

  $("formAsignacion").classList.add("oculto");

  mostrarMensaje(
    "No se pudieron cargar los técnicos desde Firebase.",
    true
  );
}

mostrarSeccion("detalle");
}

async function tecnicosConCarga() {
  const [averias, tecnicos] = await Promise.all([
    FirebaseService.obtenerTodasAverias(),
    FirebaseService.obtenerTecnicos()
  ]);

  return tecnicos.map(tecnico => {
    const activas = averias.filter(
      averia =>
        averia.tecnicoId === tecnico.id &&
        ESTADOS_ACTIVOS.includes(averia.estado)
    );

    return {
      ...tecnico,
      especialidad: tecnico.especialidad || "Sin especialidad",
      activas,
      disponible: activas.length === 0
    };
  });
}

async function mostrarTecnicos() {
  const lista = $("listaTecnicos");
  lista.replaceChildren();

  const filtro = $("filtroTecnicos").value;

let todos;

try {
  todos = await tecnicosConCarga();
} catch (error) {
  console.error("Error al consultar técnicos:", error);

  $("conteoTecnicos").textContent = "";

  mostrarVacio(
    lista,
    "No se pudieron cargar los técnicos desde Firebase."
  );

  return;
}

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

async function prepararAsignacion(averia) {
  const formulario = $("formAsignacion");
  const puedeAsignar = averia.estado === "Pendiente";

  formulario.classList.toggle("oculto", !puedeAsignar);

  if (!puedeAsignar) {
    return;
  }

  $("tituloAsignacion").textContent = averia.tecnicoId
    ? "Reasignar técnico"
    : "Asignar técnico";

  // Al reasignar se conserva el tipo de servicio elegido antes.
  $("tipoServicio").value = averia.tipoServicio || "";

  // Primero los disponibles con la especialidad de la avería,
  // luego el resto según su carga de trabajo.
tecnicosFirebase = await tecnicosConCarga();

const tecnicos = tecnicosFirebase
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

async function asignarTecnico(evento) {
  evento.preventDefault();

  let averia;

try {
  averia = await FirebaseService.obtenerAveria(
    averiaSeleccionada
  );
} catch (error) {
  console.error("Error al consultar la avería:", error);
  mostrarMensaje("No se pudo consultar la avería.", true);
  return;
}
 if (!averia || averia.estado !== "Pendiente") {
    mostrarMensaje(
      "Esta avería ya no se puede asignar.",
      true
    );
    return;
  }

  const tecnico = tecnicosFirebase.find(
  tecnico => tecnico.id === $("tecnicoAsignado").value
);

  if (!tecnico) {
    mostrarMensaje("Seleccioná un técnico.", true);
    return;
  }

  const tipoServicio = $("tipoServicio").value;

  if (!TIPOS_SERVICIO.includes(tipoServicio)) {
    mostrarMensaje("Seleccioná el tipo de servicio.", true);
    return;
  }

  const ahora = new Date().toISOString();

  const asignacion = {
    tecnicoId: tecnico.id,
    tecnicoNombre: tecnico.nombre,
    fecha: ahora,
    asignadoPor: window.USUARIO_FIREBASE.nombre,
    motivoRechazo:
      averia.estado === "Rechazado"
        ? averia.motivoRechazo
        : null
  };

  const cambios = {
    tecnicoId: tecnico.id,
    tecnicoNombre: tecnico.nombre,
    tipoServicio,
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
      fechaFinAtencion: null,
      conformidad: null,
      motivoRechazo: null,
      fechaConformidad: null
    });
  }

  try {
    await FirebaseService.asignarTecnicoAveria(
  averia.id,
  cambios
);

await verDetalle(averia.id);
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

async function mostrarResumen() {
  const contenedor = $("indicadores");

  contenedor.replaceChildren();
  mostrarMensaje("Cargando resumen desde Firebase...");

  try {
    // Obtener averías y técnicos desde Firebase
    const [averias, tecnicos] = await Promise.all([
      FirebaseService.obtenerTodasAverias(),
      tecnicosConCarga()
    ]);

    // Calcular técnicos disponibles
    const disponibles = tecnicos.filter(
      tecnico => tecnico.disponible
    ).length;

    // Crear indicadores del resumen
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

    // Mostrar las tarjetas
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

    mostrarMensaje("");

  } catch (error) {
    console.error("Error al cargar el resumen:", error);

    contenedor.replaceChildren();

    mostrarMensaje(
      "No se pudo cargar el resumen desde Firebase.",
      true
    );
  }
}

