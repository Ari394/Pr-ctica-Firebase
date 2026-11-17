"use strict";

// Administrador temporal hasta integrar Firebase Authentication.
const ADMIN_ACTUAL = {
  uid: "admin-demo-001",
  nombre: "Administrador de prueba"
};

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

  document
    .querySelectorAll(".navegacion button[data-seccion]")
    .forEach(boton => {
      boton.classList.toggle(
        "activo",
        boton.dataset.seccion === nombre
      );
    });

  if (nombre === "resumen") {
    mostrarResumen();
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

function contarPorEstado(averias, ...estados) {
  return averias.filter(
    averia => estados.includes(averia.estado)
  ).length;
}

function mostrarResumen() {
  const averias = RepositorioAverias.obtenerTodas();
  const tecnicos = RepositorioTecnicos.obtenerTodos();

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
