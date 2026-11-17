
"use strict";

let USUARIO_ACTUAL = null;

let averiaSeleccionada = null;

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("usuario-autenticado", () => {
    USUARIO_ACTUAL = window.USUARIO_FIREBASE;
    iniciar();
  });

  if (window.USUARIO_FIREBASE) {
    USUARIO_ACTUAL = window.USUARIO_FIREBASE;
    iniciar();
  }
});

function iniciar() {
  $("fecha").value = fechaLocal();

  $("btnRegistro").addEventListener("click", () => {
    mostrarSeccion("registro");
  });

  $("btnListado").addEventListener("click", () => {
    mostrarSeccion("listado");
  });
  
  $("btnPerfil").addEventListener("click", () => {
    mostrarSeccion("perfil");
  });


  $("btnVolver").addEventListener("click", () => {
    mostrarSeccion("listado");
  });

  $("formAveria").addEventListener("submit", registrarAveria);
  
  $("formPerfil").addEventListener("submit", guardarPerfil);


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


function cargarPerfil() {
  const usuario = window.USUARIO_FIREBASE;

  if (!usuario) {
    console.warn("Todavía no se ha cargado el usuario.");
    return;
  }

  $("perfilNombre").value = usuario.nombre || "";
  $("perfilCorreo").value = usuario.correo || "";
  $("perfilRol").value = usuario.rol || "";
}


async function guardarPerfil(evento) {
  evento.preventDefault();

  const usuario = window.USUARIO_FIREBASE;
  const firebase = window.HelpDeskFirebase;

  if (!usuario || !firebase) {
    alert("No se pudo obtener la información del usuario.");
    return;
  }

  const nuevoNombre = $("perfilNombre").value.trim();

  if (!nuevoNombre || nuevoNombre.length > 100) {
    alert("El nombre debe tener entre 1 y 100 caracteres.");
    return;
  }

  try {
    const referencia = firebase.firestoreAPI.doc(
      firebase.db,
      "usuarios",
      usuario.uid
    );

    await firebase.firestoreAPI.updateDoc(referencia, {
      nombre: nuevoNombre
    });

    window.USUARIO_FIREBASE.nombre = nuevoNombre;

    alert("Perfil actualizado correctamente.");

  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
    alert("No se pudieron guardar los cambios.");
  }
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

  $("seccionPerfil").classList.toggle(
    "oculto",
    nombre !== "perfil"
  );

  $("btnRegistro").classList.toggle(
    "activo",
    nombre === "registro"
  );

  $("btnListado").classList.toggle(
    "activo",
    nombre === "listado" || nombre === "detalle"
  );

  $("btnPerfil").classList.toggle(
    "activo",
    nombre === "perfil"
  );

  if (nombre === "listado") {
    mostrarListado();
  }

  if (nombre === "perfil") {
  cargarPerfil();
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
    const imagen = null;

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

   await FirebaseService.crearAveria(averia);

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

async function mostrarListado() {
  const lista = $("listaAverias");
  lista.replaceChildren();

  const busqueda = $("buscar")
    .value.trim().toLowerCase();

  const filtro = $("filtroEstado").value;

  const averiasUsuario =
  await FirebaseService.obtenerAveriasUsuario(USUARIO_ACTUAL.uid);

const averias = averiasUsuario
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


async function verDetalle(id) {
  try {
    const averia = await FirebaseService.obtenerAveria(id);

    if (!averia || averia.usuarioId !== USUARIO_ACTUAL.uid) {
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
      averia.conformidad != null
    );

    $("formRechazo").classList.add("oculto");
    $("formRechazo").reset();

    mostrarSeccion("detalle");

  } catch (error) {
    mostrarMensaje(
      "No se pudo cargar la avería: " + error.message,
      true
    );
  }
}


async function aceptarSolucion() {
  try {
    const averia = await FirebaseService.obtenerAveria(
      averiaSeleccionada
    );

    if (
      !averia ||
      averia.usuarioId !== USUARIO_ACTUAL.uid ||
      averia.estado !== "Resuelto" ||
      averia.conformidad
    ) {
      mostrarMensaje(
        "Esta avería no permite confirmar la solución.",
        true
      );
      return;
    }

    if (!confirm("¿Confirmás que el problema fue solucionado?")) {
      return;
    }

    await FirebaseService.aceptarSolucion(averia.id);

    await verDetalle(averia.id);

    mostrarMensaje("Solución aceptada correctamente.");

  } catch (error) {
    mostrarMensaje(error.message, true);
  }
}

async function rechazarSolucion(evento) {
  evento.preventDefault();

  const motivo = $("motivoRechazo").value.trim();

  if (!motivo) {
    mostrarMensaje(
      "Debés indicar el motivo del rechazo.",
      true
    );
    return;
  }

  try {
    const averia = await FirebaseService.obtenerAveria(
      averiaSeleccionada
    );

    if (
      !averia ||
      averia.usuarioId !== USUARIO_ACTUAL.uid ||
      averia.estado !== "Resuelto" ||
      averia.conformidad
    ) {
      mostrarMensaje(
        "No se puede rechazar esta solución.",
        true
      );
      return;
    }

    await FirebaseService.rechazarSolucion(
      averia.id,
      motivo
    );

    await verDetalle(averia.id);

    mostrarMensaje("Rechazo registrado correctamente.");

  } catch (error) {
    mostrarMensaje(error.message, true);
  }
}
