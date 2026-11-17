
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

// Control de inicialización y actualización de los chats.
let chatsIniciados = false;
let temporizadorChats = null;
let actualizacionChatsEnCurso = false;

// Control de lectura del administrador.
// Se conserva localmente porque todavía no existe un servicio
// de lecturas compartidas en Firebase.
const CLAVE_LECTURAS_ADMIN = "helpdesk_lecturas_admin_firebase";

document.addEventListener("DOMContentLoaded", iniciarChats);

function iniciarChats() {
  if (chatsIniciados) {
    return;
  }

  chatsIniciados = true;

  $("formChat").addEventListener("submit", enviarMensajeChat);

  // Enter envía; Shift + Enter agrega un salto de línea.
  $("textoChat").addEventListener("keydown", evento => {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      $("formChat").requestSubmit();
    }
  });

  // Actualizar cuando el usuario administrador esté autenticado.
  window.addEventListener("usuario-autenticado", () => {
    if (window.USUARIO_FIREBASE?.rol === "administrador") {
      actualizarContadorChats();
      iniciarActualizacionChats();
    }
  });

  // Actualizar cuando el administrador regrese a la pestaña.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && firebaseChatsDisponible()) {
      actualizarChatsVisibles();
    }
  });

  // Mantener compatibilidad con cambios locales.
  window.addEventListener("storage", () => {
    if (firebaseChatsDisponible()) {
      actualizarChatsVisibles();
    }
  });

  // Si la autenticación ya terminó, iniciar inmediatamente.
  if (firebaseChatsDisponible()) {
    actualizarContadorChats();
    iniciarActualizacionChats();
  }
}

function firebaseChatsDisponible() {
  return (
    window.USUARIO_FIREBASE?.rol === "administrador" &&
    typeof FirebaseService !== "undefined"
  );
}

function iniciarActualizacionChats() {
  if (temporizadorChats !== null) {
    return;
  }

  // Consultar periódicamente para detectar mensajes nuevos.
  // No utiliza localStorage como fuente de mensajes.
  temporizadorChats = setInterval(() => {
    if (document.hidden || !firebaseChatsDisponible()) {
      return;
    }

    actualizarChatsVisibles();
  }, 5000);
}

async function actualizarChatsVisibles() {
  if (actualizacionChatsEnCurso) {
    return;
  }

  actualizacionChatsEnCurso = true;

  try {
    if ($("seccionChats").classList.contains("oculto")) {
      await actualizarContadorChats();
    } else {
      await mostrarChats();
    }
  } finally {
    actualizacionChatsEnCurso = false;
  }
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

// Lecturas del administrador.
// Se guardan por usuario para no mezclar administradores distintos.
function obtenerClaveLecturasAdmin() {
  const usuarioId = window.USUARIO_FIREBASE?.uid || "admin";

  return `${CLAVE_LECTURAS_ADMIN}_${usuarioId}`;
}

function obtenerLecturasAdmin() {
  try {
    const guardado = localStorage.getItem(
      obtenerClaveLecturasAdmin()
    );

    return guardado ? JSON.parse(guardado) : {};
  } catch (error) {
    console.error("Error al leer las lecturas del chat:", error);
    return {};
  }
}

function marcarConversacionLeida(averiaId, fecha) {
  if (!averiaId || !fecha) {
    return;
  }

  try {
    const lecturas = obtenerLecturasAdmin();

    lecturas[averiaId] = fecha;

    localStorage.setItem(
      obtenerClaveLecturasAdmin(),
      JSON.stringify(lecturas)
    );
  } catch (error) {
    console.error("Error al marcar el chat como leído:", error);
  }
}

// Una conversación por cada avería con técnico asignado o con mensajes.
// Las averías y los mensajes se consultan directamente en Firestore.
async function obtenerConversacionesAdmin() {
  if (!firebaseChatsDisponible()) {
    return [];
  }

  const averias = await FirebaseService.obtenerTodasAverias();

  const lecturas = obtenerLecturasAdmin();

  // Las conversaciones pertenecen a averías con técnico asignado.
  // Se incluyen también averías antiguas que tengan historial
  // de asignaciones, aunque actualmente no tengan técnico.
  const averiasConConversacion = averias.filter(averia =>
    averia.tecnicoId ||
    (Array.isArray(averia.historialAsignaciones) &&
      averia.historialAsignaciones.length > 0)
  );

  const conversaciones = await Promise.all(
    averiasConConversacion.map(async averia => {
      const mensajes = await FirebaseService.obtenerMensajes(
        averia.id
      );

      const ultimaLectura = lecturas[averia.id] || "";

      return {
        averia,
        mensajes,
        ultimoMensaje: mensajes[mensajes.length - 1] || null,

        // Las fechas ISO se pueden comparar como texto.
        noLeidos: mensajes.filter(mensaje =>
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
  if (!firebaseChatsDisponible()) {
    return;
  }

  try {
    const conversaciones = await obtenerConversacionesAdmin();

    pintarContadorChats(conversaciones);
  } catch (error) {
    console.error("Error al contar mensajes:", error);
  }
}

function abrirConversacion(averiaId) {
  conversacionActiva = averiaId;

  mostrarSeccion("chats");
}

async function mostrarChats() {
  if (!firebaseChatsDisponible()) {
    return;
  }

  try {
    const conversaciones = await obtenerConversacionesAdmin();

    const activa = conversaciones.find(
      conversacion =>
        conversacion.averia.id === conversacionActiva
    ) || null;

    if (activa && activa.noLeidos > 0) {
      marcarConversacionLeida(
        activa.averia.id,
        activa.ultimoMensaje.fecha
      );

      activa.noLeidos = 0;
    }

    const conMensajesNuevos = conversaciones.filter(
      conversacion => conversacion.noLeidos > 0
    ).length;

    $("conteoChats").textContent =
      textoCantidad(
        conversaciones.length,
        "conversación",
        "conversaciones"
      ) +
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
    const {
      averia,
      ultimoMensaje,
      noLeidos
    } = conversacion;

    const boton = crearElemento(
      "button",
      "",
      averia.id === conversacionActiva
        ? "conversacion activa"
        : "conversacion"
    );

    boton.type = "button";

    const superior = crearElemento(
      "div",
      "",
      "conversacion-superior"
    );

    superior.appendChild(
      crearElemento(
        "strong",
        averia.tecnicoNombre || "Sin técnico asignado"
      )
    );

    if (noLeidos > 0) {
      superior.appendChild(
        crearElemento("span", String(noLeidos), "contador")
      );
    }

    boton.append(
      superior,
      crearElemento(
        "span",
        averia.titulo,
        "conversacion-averia"
      ),
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
  $("chatVacio").classList.toggle(
    "oculto",
    conversacion !== null
  );

  $("chatContenido").classList.toggle(
    "oculto",
    conversacion === null
  );

  if (!conversacion) {
    return;
  }

  const {
    averia,
    mensajes
  } = conversacion;

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

  $("formChat").classList.toggle(
    "oculto",
    !puedeEscribir
  );

  $("chatSoloLectura").classList.toggle(
    "oculto",
    puedeEscribir
  );
}

async function enviarMensajeChat(evento) {
  evento.preventDefault();

  if (!conversacionActiva) {
    return;
  }

  const texto = $("textoChat").value.trim();

  if (!texto) {
    mostrarMensaje(
      "Escribí un mensaje antes de enviar.",
      true
    );
    return;
  }

  if (texto.length > LONGITUD_MAXIMA_MENSAJE) {
    mostrarMensaje(
      `El mensaje supera los ${LONGITUD_MAXIMA_MENSAJE} caracteres.`,
      true
    );
    return;
  }

  if (!firebaseChatsDisponible()) {
    mostrarMensaje(
      "La sesión del administrador no está disponible.",
      true
    );
    return;
  }

  try {
    // Consultar la avería real desde Firestore.
    const averia = await FirebaseService.obtenerAveria(
      conversacionActiva
    );

    if (!averia || !averia.tecnicoId) {
      mostrarMensaje(
        "La avería no tiene un técnico asignado.",
        true
      );
      return;
    }

    // Obtener los datos reales del administrador autenticado.
    const administrador = window.USUARIO_FIREBASE;

    if (!administrador || administrador.rol !== "administrador") {
      mostrarMensaje(
        "No se pudo verificar al administrador.",
        true
      );
      return;
    }

    // Guardar el mensaje en la colección mensajes de Firestore.
    // Se conserva el mismo formato utilizado por el técnico.
    await FirebaseService.agregarMensaje({
      id: generarIdMensaje(),
      averiaId: averia.id,
      autorId: administrador.uid,
      autorNombre: administrador.nombre,
      autorRol: ROL_ADMIN,
      texto,
      fecha: new Date().toISOString()
    });

    $("formChat").reset();

    await mostrarChats();

    $("textoChat").focus();

  } catch (error) {
    mostrarMensaje(
      "No se pudo enviar el mensaje.",
      true
    );

    console.error(error);
  }
}
