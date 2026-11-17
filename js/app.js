
"use strict";

const USUARIO_ACTUAL = {
  uid: "usuario-demo-001",
  nombre: "Usuario de prueba"
};

let averiaSeleccionada = null;

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", iniciar);

function iniciar() {
  $("fecha").value = fechaLocal();

  $("btnRegistro").addEventListener("click", () => {
    mostrarSeccion("registro");
  });

  $("btnListado").addEventListener("click", () => {
    mostrarSeccion("listado");
  });

  $("btnVolver").addEventListener("click", () => {
    mostrarSeccion("listado");
  });

  $("formAveria").addEventListener("submit", registrarAveria);

  $("buscar").addEventListener("input", mostrarListado);

  $("filtroEstado").addEventListener(
    "change",
    mostrarListado
  );

  $("btnAceptar").addEventListener(
    "click",
    aceptarSolucion
  );

  $("btnRechazar").addEventListener("click", () => {
    $("formRechazo").classList.remove("oculto");
    $("motivoRechazo").focus();
  });

  $("formRechazo").addEventListener(
    "submit",
    rechazarSolucion
  );

  mostrarSeccion("registro");
}

function fechaLocal() {
  const fecha = new Date();

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");

  return `${anio}-${mes}-${dia}`;
}

function mostrarSeccion(nombre) {
  $("seccionRegistro").classList.toggle(
    "oculto",
    nombre !== "registro"
  );

  $("seccionListado").classList.toggle(
    "oculto",
    nombre !== "listado"
  );

  $("seccionDetalle").classList.toggle(
    "oculto",
    nombre !== "detalle"
  );

  $("btnRegistro").classList.toggle(
    "activo",
    nombre === "registro"
  );

  $("btnListado").classList.toggle(
    "activo",
    nombre !== "registro"
  );

  if (nombre === "listado") {
    mostrarListado();
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

function generarId() {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return `av-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function leerImagen(archivo) {
  return new Promise((resolve, reject) => {
    if (!archivo) {
      resolve(null);
      return;
    }

    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!tiposPermitidos.includes(archivo.type)) {
      reject(
        new Error("Seleccioná una imagen JPG, PNG o WEBP.")
      );
      return;
    }

    if (archivo.size > 1024 * 1024) {
      reject(
        new Error("La imagen no debe superar 1 MB.")
      );
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

async function registrarAveria(evento) {
  evento.preventDefault();

  const titulo = $("titulo").value.trim();
  const descripcion = $("descripcion").value.trim();
  const departamento = $("departamento").value;
  const tipo = $("tipo").value;
  const fecha = $("fecha").value;

  if (
    !titulo ||
    !descripcion ||
    !departamento ||
    !tipo ||
    !fecha
  ) {
    mostrarMensaje(
      "Completá todos los campos obligatorios.",
      true
    );
    return;
  }

  if (fecha > fechaLocal()) {
    mostrarMensaje(
      "La fecha no puede ser futura.",
      true
    );
    return;
  }

  try {
    const imagen = await leerImagen(
      $("imagen").files[0]
    );

    const averia = {
      id: generarId(),
      usuarioId: USUARIO_ACTUAL.uid,
      titulo,
      descripcion,
      departamento,
      tipo,
      fechaReporte: fecha,
      fechaCreacion: new Date().toISOString(),
      imagen,
      estado: "Pendiente",
      tecnicoId: null,
      tecnicoNombre: null,
      observaciones: [],
      fechaResolucion: null,
      conformidad: null,
      motivoRechazo: null,
      fechaConformidad: null
    };

    RepositorioAverias.crear(averia);

    $("formAveria").reset();
    $("fecha").value = fechaLocal();

    mostrarSeccion("listado");

    mostrarMensaje(
      "¡Avería registrada correctamente!"
    );
  } catch (error) {
    mostrarMensaje(
      error.name === "QuotaExceededError"
        ? "No hay espacio suficiente en el navegador."
        : error.message,
      true
    );
  }
}

function crearElemento(
  etiqueta,
  texto,
  clase = ""
) {
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

function mostrarListado() {
  const lista = $("listaAverias");
  lista.replaceChildren();

  const busqueda = $("buscar")
    .value.trim().toLowerCase();

  const filtro = $("filtroEstado").value;

  const averias = RepositorioAverias
    .obtenerPorUsuario(USUARIO_ACTUAL.uid)
    .filter(averia =>
      (!filtro || averia.estado === filtro) &&
      (
        averia.titulo.toLowerCase().includes(busqueda) ||
        averia.id.toLowerCase().includes(busqueda)
      )
    )
    .sort(
      (a, b) =>
        new Date(b.fechaCreacion) -
        new Date(a.fechaCreacion)
    );

  if (!averias.length) {
    lista.appendChild(
      crearElemento(
        "p",
        "No hay averías que coincidan con la búsqueda.",
        "vacio"
      )
    );
    return;
  }

  averias.forEach(averia => {
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

    datos.appendChild(
      crearElemento("h3", averia.titulo)
    );

    datos.appendChild(
      crearElemento(
        "p",
        `${averia.tipo} · ${averia.departamento}`
      )
    );

    datos.appendChild(
      crearElemento(
        "p",
        `Fecha: ${textoFecha(averia.fechaReporte)}`
      )
    );

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
    lista.appendChild(tarjeta);
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

  dato.appendChild(
    crearElemento("strong", titulo)
  );

  dato.appendChild(
    crearElemento(
      "span",
      valor ?? "No disponible"
    )
  );

  contenedor.appendChild(dato);
}

function verDetalle(id) {
  const averia = RepositorioAverias.obtenerPorId(
    id,
    USUARIO_ACTUAL.uid
  );

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

  contenido.appendChild(
    crearElemento("h2", averia.titulo)
  );

  contenido.appendChild(
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

  agregarDato(
    datos,
    "Número de reporte",
    averia.id
  );

  agregarDato(
    datos,
    "Departamento",
    averia.departamento
  );

  agregarDato(
    datos,
    "Tipo de avería",
    averia.tipo
  );

  agregarDato(
    datos,
    "Fecha",
    textoFecha(averia.fechaReporte)
  );

  agregarDato(
    datos,
    "Técnico asignado",
    averia.tecnicoNombre || "Sin asignar"
  );

  agregarDato(
    datos,
    "Fecha de resolución",
    textoFecha(averia.fechaResolucion)
  );

  contenido.appendChild(datos);

  contenido.appendChild(
    crearElemento("h3", "Descripción")
  );

  contenido.appendChild(
    crearElemento("p", averia.descripcion)
  );

  if (averia.imagen) {
    contenido.appendChild(
      crearElemento("h3", "Fotografía")
    );

    const imagen = document.createElement("img");

    imagen.src = averia.imagen;
    imagen.alt = "Fotografía adjunta a la avería";
    imagen.className = "foto-averia";

    contenido.appendChild(imagen);
  }

  contenido.appendChild(
    crearElemento(
      "h3",
      "Observaciones del técnico"
    )
  );

  const observaciones = averia.observaciones || [];

  if (observaciones.length === 0) {
    contenido.appendChild(
      crearElemento(
        "p",
        "Todavía no hay observaciones."
      )
    );
  } else {
    observaciones.forEach(observacion => {
      const bloque = crearElemento(
        "div",
        "",
        "dato"
      );

      bloque.appendChild(
        crearElemento(
          "strong",
          `${observacion.autor} · ${textoFecha(observacion.fecha)}`
        )
      );

      bloque.appendChild(
        crearElemento(
          "p",
          observacion.texto
        )
      );

      contenido.appendChild(bloque);
    });
  }

  if (averia.conformidad) {
    contenido.appendChild(
      crearElemento(
        "h3",
        "Respuesta del usuario"
      )
    );

    contenido.appendChild(
      crearElemento(
        "p",
        averia.conformidad === "Aceptada"
          ? "Solución aceptada."
          : `Solución rechazada: ${averia.motivoRechazo}`
      )
    );
  }

  $("accionesSolucion").classList.toggle(
    "oculto",
    averia.estado !== "Resuelto" ||
    averia.conformidad !== null
  );

  $("formRechazo").classList.add("oculto");
  $("formRechazo").reset();

  mostrarSeccion("detalle");
}

function aceptarSolucion() {
  const averia = RepositorioAverias.obtenerPorId(
    averiaSeleccionada,
    USUARIO_ACTUAL.uid
  );

  if (
    !averia ||
    averia.estado !== "Resuelto" ||
    averia.conformidad
  ) {
    mostrarMensaje(
      "Esta avería no permite confirmar la solución.",
      true
    );
    return;
  }

  if (
    !confirm(
      "¿Confirmás que el problema fue solucionado?"
    )
  ) {
    return;
  }

  try {
    RepositorioAverias.actualizar(
      averia.id,
      USUARIO_ACTUAL.uid,
      {
        conformidad: "Aceptada",
        motivoRechazo: null,
        fechaConformidad: new Date().toISOString(),
        estado: "Cerrado"
      }
    );

    verDetalle(averia.id);

    mostrarMensaje(
      "Solución aceptada correctamente."
    );
  } catch (error) {
    mostrarMensaje(error.message, true);
  }
}

function rechazarSolucion(evento) {
  evento.preventDefault();

  const motivo = $("motivoRechazo")
    .value.trim();

  if (!motivo) {
    mostrarMensaje(
      "Debés indicar el motivo del rechazo.",
      true
    );
    return;
  }

  const averia = RepositorioAverias.obtenerPorId(
    averiaSeleccionada,
    USUARIO_ACTUAL.uid
  );

  if (
    !averia ||
    averia.estado !== "Resuelto" ||
    averia.conformidad
  ) {
    mostrarMensaje(
      "No se puede rechazar esta solución.",
      true
    );
    return;
  }

  try {
    RepositorioAverias.actualizar(
      averia.id,
      USUARIO_ACTUAL.uid,
      {
        conformidad: "Rechazada",
        motivoRechazo: motivo,
        fechaConformidad: new Date().toISOString(),
        estado: "Rechazado"
      }
    );

    verDetalle(averia.id);

    mostrarMensaje(
      "Rechazo registrado correctamente."
    );
  } catch (error) {
    mostrarMensaje(error.message, true);
  }
}
