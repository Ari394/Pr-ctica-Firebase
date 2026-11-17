"use strict";

// Vista del administrador para atender los chats de los técnicos.
// Usa las funciones auxiliares definidas en admin.js.
//
// Hay una conversación por avería, entre el administrador y el técnico
// asignado. El panel del técnico solo permite escribir en las averías
// asignadas, por lo que dos técnicos no pueden conversar entre ellos.

// Valor de autorRol en los mensajes del administrador.
const ROL_ADMIN = "Administrador";

const LONGITUD_MAXIMA_MENSAJE = 1000;

// Avería cuya conversación está abierta.
let conversacionActiva = null;

document.addEventListener("DOMContentLoaded", iniciarChats);

function iniciarChats() {
  $("formChat").addEventListener("submit", enviarMensajeChat);

  // Enter envía; Shift + Enter agrega un salto de línea.
  $("textoChat").addEventListener("keydown", evento => {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      $("formChat").requestSubmit();
    }
  });

  // Recibe los cambios que el técnico hace en otras pestañas
  // (mensajes nuevos o cambios de estado de la avería).
  window.addEventListener("storage", () => {
    if ($("seccionChats").classList.contains("oculto")) {
      actualizarContadorChats();
    } else {
      mostrarChats();
    }
  });

  actualizarContadorChats();
}

function generarIdMensaje() {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Una conversación por cada avería con técnico asignado o con mensajes.
async function obtenerConversacionesAdmin() {
  const averias = RepositorioAverias.obtenerTodas();
  const lecturas = RepositorioLecturasChat.obtenerTodas();

  const conversaciones = await Promise.all(
    averias.map(async averia => {
      const mensajes = await RepositorioAverias.obtenerMensajes(averia.id);
      const ultimaLectura = lecturas[averia.id] || "";

      return {
        averia,
        mensajes,
        ultimoMensaje: mensajes[mensajes.length - 1] || null,
        // Las fechas ISO se pueden comparar como texto.
        noLeidos: mensajes.filter(
          mensaje =>
            mensaje.autorRol !== ROL_ADMIN &&
            mensaje.fecha > ultimaLectura
        ).length
      };
    })
  );

  return conversaciones
    .filter(conversacion =>
      conversacion.averia.tecnicoId ||
      conversacion.mensajes.length
    )
    .map(conversacion => ({
      ...conversacion,
      actividad:
        conversacion.ultimoMensaje?.fecha ||
        conversacion.averia.fechaAsignacion ||
        conversacion.averia.fechaCreacion
    }))
    .sort((a, b) =>
      Number(b.noLeidos > 0) - Number(a.noLeidos > 0) ||
      new Date(b.actividad) - new Date(a.actividad)
    );
}

function pintarContadorChats(conversaciones) {
  const total = conversaciones.reduce(
    (suma, conversacion) => suma + conversacion.noLeidos,
    0
  );

  const contador = $("contadorChats");

  contador.textContent = total > 99 ? "99+" : String(total);
  contador.classList.toggle("oculto", total === 0);
}

async function actualizarContadorChats() {
  try {
    pintarContadorChats(await obtenerConversacionesAdmin());
  } catch (error) {
    console.error("Error al contar mensajes:", error);
  }
}

function abrirConversacion(averiaId) {
  conversacionActiva = averiaId;
  mostrarSeccion("chats");
}

async function mostrarChats() {
  try {
    const conversaciones = await obtenerConversacionesAdmin();

    const activa = conversaciones.find(
      conversacion => conversacion.averia.id === conversacionActiva
    ) || null;

    if (activa && activa.noLeidos > 0) {
      RepositorioLecturasChat.marcarLeida(
        activa.averia.id,
        activa.ultimoMensaje.fecha
      );

      activa.noLeidos = 0;
    }

    const conMensajesNuevos = conversaciones.filter(
      conversacion => conversacion.noLeidos > 0
    ).length;

    $("conteoChats").textContent =
      textoCantidad(conversaciones.length, "conversación", "conversaciones") +
      ` · ${conMensajesNuevos} con mensajes nuevos.`;

    mostrarListaConversaciones(conversaciones);
    mostrarConversacionActiva(activa);
    pintarContadorChats(conversaciones);
  } catch (error) {
    mostrarMensaje("No se pudieron cargar los chats.", true);
    console.error(error);
  }
}

function mostrarListaConversaciones(conversaciones) {
  const lista = $("listaConversaciones");
  lista.replaceChildren();

  if (!conversaciones.length) {
    mostrarVacio(
      lista,
      "No hay conversaciones. Se crean al asignar un técnico."
    );
    return;
  }

  conversaciones.forEach(conversacion => {
    const { averia, ultimoMensaje, noLeidos } = conversacion;

    const boton = crearElemento(
      "button",
      "",
      averia.id === conversacionActiva
        ? "conversacion activa"
        : "conversacion"
    );

    boton.type = "button";

    const superior = crearElemento("div", "", "conversacion-superior");

    superior.appendChild(
      crearElemento("strong", averia.tecnicoNombre || "Sin técnico asignado")
    );

    if (noLeidos > 0) {
      superior.appendChild(
        crearElemento("span", String(noLeidos), "contador")
      );
    }

    boton.append(
      superior,
      crearElemento("span", averia.titulo, "conversacion-averia"),
      crearElemento(
        "span",
        ultimoMensaje
          ? `${ultimoMensaje.autorNombre}: ${ultimoMensaje.texto}`
          : "Sin mensajes todavía",
        "conversacion-vista-previa"
      )
    );

    boton.addEventListener("click", async () => {
      conversacionActiva = averia.id;
      await mostrarChats();
      $("textoChat").focus();
    });

    lista.appendChild(boton);
  });
}

function mostrarConversacionActiva(conversacion) {
  $("chatVacio").classList.toggle("oculto", conversacion !== null);
  $("chatContenido").classList.toggle("oculto", conversacion === null);

  if (!conversacion) {
    return;
  }

  const { averia, mensajes } = conversacion;

  $("chatTitulo").textContent =
    averia.tecnicoNombre || "Sin técnico asignado";

  $("chatSubtitulo").textContent =
    `${averia.titulo} · ${averia.estado}`;

  const contenedor = $("chatMensajes");
  contenedor.replaceChildren();

  if (!mensajes.length) {
    contenedor.appendChild(
      crearElemento(
        "p",
        "Todavía no hay mensajes en esta conversación.",
        "chat-sin-mensajes"
      )
    );
  }

  mensajes.forEach(mensaje => {
    const burbuja = crearElemento(
      "div",
      "",
      mensaje.autorRol === ROL_ADMIN
        ? "mensaje-chat propio"
        : "mensaje-chat"
    );

    burbuja.append(
      crearElemento("p", mensaje.texto),
      crearElemento(
        "small",
        `${mensaje.autorNombre} · ${textoFecha(mensaje.fecha)}`
      )
    );

    contenedor.appendChild(burbuja);
  });

  contenedor.scrollTop = contenedor.scrollHeight;

  // Sin técnico asignado no hay con quién conversar:
  // solo se puede consultar el historial.
  const puedeEscribir = Boolean(averia.tecnicoId);

  $("formChat").classList.toggle("oculto", !puedeEscribir);
  $("chatSoloLectura").classList.toggle("oculto", puedeEscribir);
}

async function enviarMensajeChat(evento) {
  evento.preventDefault();

  if (!conversacionActiva) {
    return;
  }

  const texto = $("textoChat").value.trim();

  if (!texto) {
    mostrarMensaje("Escribí un mensaje antes de enviar.", true);
    return;
  }

  if (texto.length > LONGITUD_MAXIMA_MENSAJE) {
    mostrarMensaje(
      `El mensaje supera los ${LONGITUD_MAXIMA_MENSAJE} caracteres.`,
      true
    );
    return;
  }

  const averia = RepositorioAverias.obtenerPorIdComoAdmin(
    conversacionActiva
  );

  if (!averia || !averia.tecnicoId) {
    mostrarMensaje(
      "La avería no tiene un técnico asignado.",
      true
    );
    return;
  }

  try {
    // Mismo formato que los mensajes del panel del técnico.
    await RepositorioAverias.agregarMensaje({
      id: generarIdMensaje(),
      averiaId: averia.id,
      autorId: ADMIN_ACTUAL.uid,
      autorNombre: ADMIN_ACTUAL.nombre,
      autorRol: ROL_ADMIN,
      texto,
      fecha: new Date().toISOString()
    });

    $("formChat").reset();
    await mostrarChats();
    $("textoChat").focus();
  } catch (error) {
    mostrarMensaje("No se pudo enviar el mensaje.", true);
    console.error(error);
  }
}
