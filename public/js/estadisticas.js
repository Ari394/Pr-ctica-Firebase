"use strict";

// Estadísticas y gráficos del administrador con Google Charts.
// Usa las funciones auxiliares definidas en admin.js.
//
// Los cálculos reciben arreglos de averías y no dependen del
// almacenamiento, para poder reutilizarlos al migrar a Firebase.

// Paleta categórica en orden fijo, validada para daltonismo.
// Cada serie toma siempre el mismo color según su posición.
const COLORES_GRAFICOS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#6250d6",
  "#e34948"
];

const ESTADOS = [
  "Pendiente",
  "Asignado",
  "En proceso",
  "Resuelto",
  "Cerrado",
  "Rechazado"
];

// Mismos valores que el formulario de registro de averías.
const DEPARTAMENTOS = [
  "TI",
  "Administración",
  "Recursos Humanos",
  "Contabilidad",
  "Otro"
];

const TIPOS = ["Hardware", "Software"];

let cargaGoogleCharts = null;
let tecnicosEstadisticas = [];
let temporizadorRedimension = null;

document.addEventListener("DOMContentLoaded", iniciarEstadisticas);

function iniciarEstadisticas() {
  aplicarRango($("estRango").value);

  $("estRango").addEventListener("change", () => {
    aplicarRango($("estRango").value);
    mostrarEstadisticas();
  });

  ["estDesde", "estHasta"].forEach(id => {
    $(id).addEventListener("change", () => {
      $("estRango").value = "personalizado";
      mostrarEstadisticas();
    });
  });

  $("formPeriodo").addEventListener("submit", evento => {
    evento.preventDefault();
  });

  // Google Charts no se adapta solo al ancho: se redibuja.
  window.addEventListener("resize", () => {
    clearTimeout(temporizadorRedimension);

    temporizadorRedimension = setTimeout(() => {
      if (!$("seccionEstadisticas").classList.contains("oculto")) {
        mostrarEstadisticas();
      }
    }, 200);
  });
}

function fechaISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function aplicarRango(rango) {
  if (rango === "personalizado") {
    return;
  }

  const hoy = new Date();
  let desde = "";

  if (rango === "7" || rango === "30") {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - (Number(rango) - 1));
    desde = fechaISO(inicio);
  }

  if (rango === "mes") {
    desde = fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  }

  if (rango === "anio") {
    desde = fechaISO(new Date(hoy.getFullYear(), 0, 1));
  }

  $("estDesde").value = desde;
  $("estHasta").value = rango === "todo" ? "" : fechaISO(hoy);
}

function leerPeriodo() {
  return {
    desde: $("estDesde").value,
    hasta: $("estHasta").value
  };
}

function textoPeriodo({ desde, hasta }) {
  if (!desde && !hasta) {
    return "Todo el historial";
  }

  if (!desde) {
    return `Hasta el ${textoFecha(hasta)}`;
  }

  if (!hasta) {
    return `Desde el ${textoFecha(desde)}`;
  }

  return `Del ${textoFecha(desde)} al ${textoFecha(hasta)}`;
}

function porcentaje(parte, total) {
  return total
    ? Math.round((parte / total) * 1000) / 10
    : 0;
}

function cargarGoogleCharts() {
  if (!cargaGoogleCharts) {
    cargaGoogleCharts = new Promise((resolve, reject) => {
      if (typeof google === "undefined" || !google.charts) {
        reject(new Error("Google Charts no está disponible."));
        return;
      }

      google.charts.load("current", {
        packages: ["corechart"],
        language: "es"
      });

      google.charts.setOnLoadCallback(resolve);
    });
  }

  return cargaGoogleCharts;
}

// ----- Cálculos -----

function calcularPorEstado(averias) {
  return ESTADOS.map(estado => [
    estado,
    averias.filter(averia => averia.estado === estado).length
  ]);
}

// Valores conocidos en orden fijo, más cualquier otro que aparezca
// en los datos, para no perder averías con valores nuevos.
function valoresPresentes(conocidos, averias, campo) {
  const adicionales = new Set(
    averias
      .map(averia => averia[campo])
      .filter(valor => valor && !conocidos.includes(valor))
  );

  return [...conocidos, ...adicionales];
}

function calcularPorTipo(averias) {
  return valoresPresentes(TIPOS, averias, "tipo").map(tipo => {
    const cantidad = averias.filter(
      averia => averia.tipo === tipo
    ).length;

    return {
      tipo,
      cantidad,
      porcentaje: porcentaje(cantidad, averias.length)
    };
  });
}

// Milisegundos entre dos fechas ISO, o null si falta alguna
// o si el resultado no tiene sentido (negativo).
function diferencia(inicio, fin) {
  if (!inicio || !fin) {
    return null;
  }

  const milisegundos = new Date(fin) - new Date(inicio);

  return Number.isFinite(milisegundos) && milisegundos >= 0
    ? milisegundos
    : null;
}

function promedio(valores) {
  const validos = valores.filter(valor => valor !== null);

  return validos.length
    ? validos.reduce((suma, valor) => suma + valor, 0) / validos.length
    : null;
}

// Fecha en que el técnico actual recibió la avería. Si fue reasignada,
// es la última asignación a ese técnico, no la primera de la avería.
function fechaAsignacionTecnico(averia) {
  const asignaciones = averia.historialAsignaciones || [];

  const ultima = [...asignaciones]
    .reverse()
    .find(asignacion => asignacion.tecnicoId === averia.tecnicoId);

  return ultima?.fecha || averia.fechaAsignacion;
}

// Tiempos de una avería en milisegundos (null si todavía no aplica):
// - asignacion: desde el registro hasta la primera asignación (administrador).
// - respuesta: desde la asignación hasta el inicio de la atención (técnico).
// - duracion: desde el inicio de la atención hasta la resolución.
function calcularTiempos(averia) {
  const resuelta = ["Resuelto", "Cerrado"].includes(averia.estado);

  return {
    asignacion: diferencia(averia.fechaCreacion, averia.fechaAsignacion),
    respuesta: diferencia(
      fechaAsignacionTecnico(averia),
      averia.fechaInicioAtencion
    ),
    duracion: resuelta
      ? diferencia(averia.fechaInicioAtencion, averia.fechaResolucion)
      : null
  };
}

function calcularTiemposPromedio(averias) {
  const tiempos = averias.map(calcularTiempos);

  return {
    asignacion: promedio(tiempos.map(tiempo => tiempo.asignacion)),
    respuesta: promedio(tiempos.map(tiempo => tiempo.respuesta)),
    duracion: promedio(tiempos.map(tiempo => tiempo.duracion))
  };
}

// Técnicos registrados, más los que aparecen en averías antiguas
// aunque ya no estén en la lista.

function tecnicosEnDatos(averias) {
  // Técnicos registrados en Firebase.
  const tecnicos = new Map(
    tecnicosEstadisticas.map(tecnico => [
      tecnico.id,
      tecnico.nombre
    ])
  );

  // Incluir técnicos de averías antiguas,
  // aunque ya no estén registrados en Firebase.
  averias.forEach(averia => {
    if (
      averia.tecnicoId &&
      !tecnicos.has(averia.tecnicoId)
    ) {
      tecnicos.set(
        averia.tecnicoId,
        averia.tecnicoNombre || averia.tecnicoId
      );
    }
  });

  // Ordenar alfabéticamente por nombre.
  return [...tecnicos]
    .map(([id, nombre]) => ({
      id,
      nombre
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}


function calcularPorTecnico(averias) {
  return tecnicosEnDatos(averias).map(({ id, nombre }) => {
    const asignadas = averias.filter(
      averia => averia.tecnicoId === id
    );

    const tiempos = calcularTiemposPromedio(asignadas);

    return {
      tecnicoId: id,
      nombre,
      asignadas: asignadas.length,
      enAtencion: contarPorEstado(asignadas, ...ESTADOS_ACTIVOS),
      resueltas: contarPorEstado(asignadas, "Resuelto", "Cerrado"),
      rechazadas: contarPorEstado(asignadas, "Rechazado"),
      respuesta: tiempos.respuesta,
      duracion: tiempos.duracion
    };
  });
}

function textoDuracion(milisegundos) {
  if (milisegundos === null) {
    return "Sin datos";
  }

  const minutos = Math.round(milisegundos / 60000);

  if (minutos < 60) {
    return `${minutos} min`;
  }

  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;

  if (horas < 24) {
    return minutosRestantes
      ? `${horas} h ${minutosRestantes} min`
      : `${horas} h`;
  }

  const dias = Math.floor(horas / 24);
  const horasRestantes = horas % 24;

  return horasRestantes
    ? `${dias} d ${horasRestantes} h`
    : `${dias} d`;
}

// Unidad del eje según el mayor tiempo, para que los valores sean legibles.
function elegirUnidadTiempo(maximo) {
  if (maximo < 2 * 3600000) {
    return { nombre: "Minutos", milisegundos: 60000 };
  }

  if (maximo < 2 * 86400000) {
    return { nombre: "Horas", milisegundos: 3600000 };
  }

  return { nombre: "Días", milisegundos: 86400000 };
}

// Etiqueta para las averías que todavía no tienen tipo de servicio
// (las pendientes y las registradas antes de existir este campo).
const SIN_SERVICIO = "Sin definir";

function calcularPorTipoServicio(averias) {
  return [
    ...valoresPresentes(TIPOS_SERVICIO, averias, "tipoServicio"),
    SIN_SERVICIO
  ].map(servicio => {
    const delServicio = averias.filter(averia =>
      servicio === SIN_SERVICIO
        ? !averia.tipoServicio
        : averia.tipoServicio === servicio
    );

    return {
      servicio,
      cantidad: delServicio.length,
      porcentaje: porcentaje(delServicio.length, averias.length),
      resueltas: contarPorEstado(delServicio, "Resuelto", "Cerrado"),
      duracion: calcularTiemposPromedio(delServicio).duracion
    };
  });
}

function calcularPorDepartamento(averias) {
  return valoresPresentes(DEPARTAMENTOS, averias, "departamento").map(departamento => {
    const delDepartamento = averias.filter(
      averia => averia.departamento === departamento
    );

    return {
      departamento,
      hardware: delDepartamento.filter(averia => averia.tipo === "Hardware").length,
      software: delDepartamento.filter(averia => averia.tipo === "Software").length,
      total: delDepartamento.length,
      porcentaje: porcentaje(delDepartamento.length, averias.length)
    };
  });
}

// ----- Presentación -----

async function mostrarEstadisticas() {
  const periodo = leerPeriodo();

  // Evita elegir un rango de fechas invertido.
  $("estHasta").min = periodo.desde;
  $("estDesde").max = periodo.hasta;

  if (periodo.desde && periodo.hasta && periodo.desde > periodo.hasta) {
    $("periodoEstadisticas").textContent =
      "La fecha inicial no puede ser posterior a la fecha final.";
    return;
  }

  $("periodoEstadisticas").textContent =
    "Cargando estadísticas desde Firebase...";

  try {
    // Consultar las averías registradas en Firestore.
    const todas = await FirebaseService.obtenerTodasAverias();

    // Consultar los técnicos reales de Firebase.
    tecnicosEstadisticas = await FirebaseService.obtenerTecnicos();

    // Aplicar el filtro de fechas original.
    const averias = filtrarAverias(todas, periodo);

    $("periodoEstadisticas").textContent =
      `${textoPeriodo(periodo)} · ` +
      textoCantidad(
        averias.length,
        "avería reportada",
        "averías reportadas"
      ) + ".";

    mostrarIndicadoresPeriodo(averias);
    mostrarIndicadoresTiempos(averias);

    // Las tablas no dependen de Google Charts.
    mostrarTablasEstadisticas(averias);

    try {
      await cargarGoogleCharts();

      $("avisoGraficos").classList.add("oculto");
      dibujarGraficos(averias);

    } catch (error) {
      $("avisoGraficos").textContent =
        "No se pudieron cargar los gráficos de Google Charts. " +
        "Revisá la conexión a internet y recargá la página.";

      $("avisoGraficos").classList.remove("oculto");
      console.error(error);
    }

  } catch (error) {
    console.error("Error al cargar estadísticas:", error);

    $("periodoEstadisticas").textContent =
      "No se pudieron consultar las estadísticas desde Firebase.";
  }
}


function mostrarIndicadoresPeriodo(averias) {
  const total = averias.length;
  const resueltas = contarPorEstado(averias, "Resuelto", "Cerrado");

  const indicadores = [
    { titulo: "Averías en el período", valor: total },
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
      valor: `${resueltas} (${porcentaje(resueltas, total)}%)`,
      clase: "estado-cerrado"
    }
  ];

  pintarIndicadores("indicadoresPeriodo", indicadores);
}

function mostrarIndicadoresTiempos(averias) {
  const tiempos = calcularTiemposPromedio(averias);

  pintarIndicadores("indicadoresTiempos", [
    {
      titulo: "Asignación promedio (registro → asignación)",
      valor: textoDuracion(tiempos.asignacion)
    },
    {
      titulo: "Respuesta promedio del técnico (asignación → inicio)",
      valor: textoDuracion(tiempos.respuesta)
    },
    {
      titulo: "Duración promedio de la atención (inicio → resolución)",
      valor: textoDuracion(tiempos.duracion)
    }
  ]);
}

// indicadores: [{ titulo, valor, clase? }, ...]
function pintarIndicadores(contenedorId, indicadores) {
  const contenedor = $(contenedorId);
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

// filas: arreglos de celdas; las celdas numéricas se alinean a la derecha.
// pie (opcional): fila de totales.
function mostrarTabla(contenedorId, encabezados, filas, pie = null) {
  const tabla = crearElemento("table", "", "tabla-resumen");

  const agregarFila = (seccion, celdas, etiquetaCelda) => {
    const fila = document.createElement("tr");

    celdas.forEach((celda, indice) => {
      fila.appendChild(
        crearElemento(
          etiquetaCelda,
          String(celda),
          indice > 0 ? "numero" : ""
        )
      );
    });

    seccion.appendChild(fila);
  };

  const encabezado = document.createElement("thead");
  agregarFila(encabezado, encabezados, "th");

  const cuerpo = document.createElement("tbody");
  filas.forEach(fila => agregarFila(cuerpo, fila, "td"));

  tabla.append(encabezado, cuerpo);

  if (pie) {
    const totales = document.createElement("tfoot");
    agregarFila(totales, pie, "td");
    tabla.appendChild(totales);
  }

  $(contenedorId).replaceChildren(tabla);
}

function mostrarTablasEstadisticas(averias) {
  const porTipo = calcularPorTipo(averias);

  mostrarTabla(
    "tablaTipos",
    ["Clasificación", "Cantidad", "Porcentaje"],
    porTipo.map(fila => [fila.tipo, fila.cantidad, `${fila.porcentaje}%`])
  );

  const porDepartamento = calcularPorDepartamento(averias);

  mostrarTabla(
    "tablaDepartamentos",
    ["Departamento", "Hardware", "Software", "Total", "Porcentaje"],
    porDepartamento.map(fila => [
      fila.departamento,
      fila.hardware,
      fila.software,
      fila.total,
      `${fila.porcentaje}%`
    ]),
    [
      "Total",
      contarPorTipo(averias, "Hardware"),
      contarPorTipo(averias, "Software"),
      averias.length,
      averias.length ? "100%" : "0%"
    ]
  );

  const asignadas = averias.filter(averia => averia.tecnicoId);
  const tiemposGenerales = calcularTiemposPromedio(asignadas);

  mostrarTabla(
    "tablaTecnicos",
    [
      "Técnico",
      "Asignadas",
      "En atención",
      "Resueltas",
      "Rechazadas",
      "Respuesta promedio",
      "Duración promedio"
    ],
    calcularPorTecnico(averias).map(fila => [
      fila.nombre,
      fila.asignadas,
      fila.enAtencion,
      fila.resueltas,
      fila.rechazadas,
      textoDuracion(fila.respuesta),
      textoDuracion(fila.duracion)
    ]),
    [
      "Todos",
      asignadas.length,
      contarPorEstado(asignadas, ...ESTADOS_ACTIVOS),
      contarPorEstado(asignadas, "Resuelto", "Cerrado"),
      contarPorEstado(asignadas, "Rechazado"),
      textoDuracion(tiemposGenerales.respuesta),
      textoDuracion(tiemposGenerales.duracion)
    ]
  );

  mostrarTabla(
    "tablaServicios",
    ["Tipo de servicio", "Cantidad", "Porcentaje", "Resueltas", "Duración promedio"],
    calcularPorTipoServicio(averias).map(fila => [
      fila.servicio,
      fila.cantidad,
      `${fila.porcentaje}%`,
      fila.resueltas,
      textoDuracion(fila.duracion)
    ]),
    [
      "Total",
      averias.length,
      averias.length ? "100%" : "0%",
      contarPorEstado(averias, "Resuelto", "Cerrado"),
      textoDuracion(calcularTiemposPromedio(averias).duracion)
    ]
  );
}

function contarPorTipo(averias, tipo) {
  return averias.filter(averia => averia.tipo === tipo).length;
}

function dibujarGraficos(averias) {
  dibujarBarras(
    "graficoEstados",
    "Estado",
    calcularPorEstado(averias)
  );

  dibujarDona(
    "graficoTipos",
    "Clasificación",
    calcularPorTipo(averias).map(fila => [fila.tipo, fila.cantidad])
  );

  dibujarBarrasPorSerie(
    "graficoDepartamentos",
    "Departamento",
    TIPOS,
    calcularPorDepartamento(averias).map(fila => [
      fila.departamento,
      fila.hardware,
      fila.software
    ])
  );

  const porTecnico = calcularPorTecnico(averias);

  dibujarBarrasPorSerie(
    "graficoTecnicos",
    "Técnico",
    ["En atención", "Resueltas", "Rechazadas"],
    porTecnico.map(fila => [
      fila.nombre,
      fila.enAtencion,
      fila.resueltas,
      fila.rechazadas
    ])
  );

  dibujarTiemposPorTecnico(porTecnico);

  dibujarBarras(
    "graficoServicios",
    "Tipo de servicio",
    calcularPorTipoServicio(averias).map(fila => [
      fila.servicio,
      fila.cantidad
    ])
  );
}

// Barras agrupadas (una al lado de la otra, en la misma unidad):
// respuesta y duración promedio de cada técnico con datos.
function dibujarTiemposPorTecnico(porTecnico) {
  const conDatos = porTecnico.filter(
    fila => fila.respuesta !== null || fila.duracion !== null
  );

  const maximo = Math.max(
    0,
    ...conDatos.flatMap(fila => [fila.respuesta || 0, fila.duracion || 0])
  );

  const unidad = elegirUnidadTiempo(maximo);

  // Valor numérico para la barra y texto legible para el tooltip.
  const celda = milisegundos => milisegundos === null
    ? null
    : {
        v: Math.round((milisegundos / unidad.milisegundos) * 10) / 10,
        f: textoDuracion(milisegundos)
      };

  dibujarBarrasPorSerie(
    "graficoTiempos",
    "Técnico",
    ["Respuesta promedio", "Duración promedio"],
    conDatos.map(fila => [
      fila.nombre,
      celda(fila.respuesta),
      celda(fila.duracion)
    ]),
    {
      isStacked: false,
      hAxis: { format: "#.#", title: unidad.nombre }
    }
  );
}

function opcionesBase() {
  return {
    fontName: "Arial",
    fontSize: 13,
    backgroundColor: "transparent",
    legend: { position: "none" },
    tooltip: { textStyle: { color: "#17243b" } }
  };
}

function mostrarSinDatos(contenedor) {
  contenedor.replaceChildren(
    crearElemento(
      "p",
      "No hay datos en el período seleccionado.",
      "vacio"
    )
  );
}

// Barras horizontales de una sola serie, con el valor al final de cada barra.
// filas: [[etiqueta, cantidad], ...]
function dibujarBarras(contenedorId, titulo, filas, opciones = {}) {
  const contenedor = $(contenedorId);

  if (!filas.some(([, cantidad]) => cantidad > 0)) {
    mostrarSinDatos(contenedor);
    return;
  }

  contenedor.replaceChildren();

  const datos = google.visualization.arrayToDataTable([
    [titulo, "Averías", { role: "annotation" }],
    ...filas.map(([etiqueta, cantidad]) => [etiqueta, cantidad, cantidad])
  ]);

  new google.visualization.BarChart(contenedor).draw(datos, {
    ...opcionesBase(),
    colors: [COLORES_GRAFICOS[0]],
    bar: { groupWidth: "60%" },
    chartArea: { left: 110, top: 10, right: 30, bottom: 35 },
    hAxis: {
      minValue: 0,
      format: "0",
      gridlines: { color: "#e2e8f0" },
      minorGridlines: { count: 0 },
      baselineColor: "#cbd5e1",
      textStyle: { color: "#64748b" }
    },
    vAxis: {
      textStyle: { color: "#17243b" }
    },
    annotations: {
      alwaysOutside: true,
      textStyle: { color: "#17243b", fontSize: 12 }
    },
    ...opciones
  });
}

// Barras horizontales con una serie por cada elemento de "series".
// Por defecto se apilan; con { isStacked: false } quedan agrupadas.
// filas: [[etiqueta, valorSerie1, valorSerie2, ...], ...]
// Cada valor puede ser un número, null o { v: número, f: "texto" }.
function dibujarBarrasPorSerie(contenedorId, titulo, series, filas, opciones = {}) {
  const contenedor = $(contenedorId);

  const numero = valor =>
    valor !== null && typeof valor === "object" ? valor.v : valor;

  if (!filas.some(([, ...valores]) => valores.some(valor => numero(valor) > 0))) {
    mostrarSinDatos(contenedor);
    return;
  }

  contenedor.replaceChildren();

  const datos = google.visualization.arrayToDataTable([
    [titulo, ...series],
    ...filas
  ]);

  new google.visualization.BarChart(contenedor).draw(datos, {
    ...opcionesBase(),
    isStacked: true,
    colors: COLORES_GRAFICOS.slice(0, series.length),
    legend: {
      position: "top",
      alignment: "end",
      textStyle: { color: "#17243b" }
    },
    bar: { groupWidth: "60%" },
    chartArea: { left: 130, top: 35, right: 30, bottom: 50 },
    vAxis: {
      textStyle: { color: "#17243b" }
    },
    ...opciones,
    // El eje se combina para poder cambiar solo el formato o el título.
    hAxis: {
      minValue: 0,
      format: "0",
      gridlines: { color: "#e2e8f0" },
      minorGridlines: { count: 0 },
      baselineColor: "#cbd5e1",
      textStyle: { color: "#64748b" },
      titleTextStyle: { color: "#64748b", italic: false },
      ...(opciones.hAxis || {})
    }
  });
}

// Gráfico de dona con etiquetas directas (cantidad y porcentaje).
// filas: [[etiqueta, cantidad], ...]
function dibujarDona(contenedorId, titulo, filas, opciones = {}) {
  const contenedor = $(contenedorId);

  if (!filas.some(([, cantidad]) => cantidad > 0)) {
    mostrarSinDatos(contenedor);
    return;
  }

  contenedor.replaceChildren();

  const datos = google.visualization.arrayToDataTable([
    [titulo, "Averías"],
    ...filas
  ]);

  new google.visualization.PieChart(contenedor).draw(datos, {
    ...opcionesBase(),
    pieHole: 0.55,
    colors: COLORES_GRAFICOS.slice(0, filas.length),
    // Borde blanco para separar visualmente las porciones.
    pieSliceBorderColor: "#ffffff",
    pieSliceText: "none",
    legend: {
      position: "labeled",
      labeledValueText: "both",
      textStyle: { color: "#17243b" }
    },
    chartArea: { left: 20, top: 20, right: 20, bottom: 20 },
    ...opciones
  });
}
