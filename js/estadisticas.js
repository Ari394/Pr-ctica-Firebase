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

  const averias = filtrarAverias(
    RepositorioAverias.obtenerTodas(),
    periodo
  );

  $("periodoEstadisticas").textContent =
    `${textoPeriodo(periodo)} · ` +
    textoCantidad(averias.length, "avería reportada", "averías reportadas") +
    ".";

  mostrarIndicadoresPeriodo(averias);

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

  const contenedor = $("indicadoresPeriodo");
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

  dibujarBarrasApiladas(
    "graficoDepartamentos",
    "Departamento",
    TIPOS,
    calcularPorDepartamento(averias).map(fila => [
      fila.departamento,
      fila.hardware,
      fila.software
    ])
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

// Barras horizontales apiladas: una serie por cada elemento de "series".
// filas: [[etiqueta, valorSerie1, valorSerie2, ...], ...]
function dibujarBarrasApiladas(contenedorId, titulo, series, filas, opciones = {}) {
  const contenedor = $(contenedorId);

  if (!filas.some(([, ...valores]) => valores.some(valor => valor > 0))) {
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
    chartArea: { left: 130, top: 35, right: 30, bottom: 35 },
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
    ...opciones
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
