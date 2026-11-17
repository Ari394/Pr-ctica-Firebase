
"use strict";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const { auth, db } = await new Promise((resolve) => {
  if (window.HelpDeskFirebase) {
    resolve(window.HelpDeskFirebase);
  } else {
    window.addEventListener(
      "firebase-ready",
      () => resolve(window.HelpDeskFirebase),
      { once: true }
    );
  }
});

const formulario = document.getElementById("formLogin");
const mensaje = document.getElementById("mensajeAuth");

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const correo = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value;

  try {
    mostrarMensaje("Iniciando sesión...");

    // Autenticar usuario
    const credenciales = await signInWithEmailAndPassword(
      auth,
      correo,
      password
    );

    // Consultar perfil en Firestore
    const referencia = doc(db, "usuarios", credenciales.user.uid);
    const resultado = await getDoc(referencia);

    if (!resultado.exists()) {
      await auth.signOut();
      mostrarMensaje("No se encontró el perfil del usuario.");
      return;
    }

    const datos = resultado.data();

    // Redirigir según el rol
    if (datos.rol === "usuario") {
      window.location.href = "index.html";
    } else if (datos.rol === "tecnico") {
      window.location.href = "tecnico.html";
    } else if (datos.rol === "administrador") {
      window.location.href = "admin.html";
    } else {
      await auth.signOut();
      mostrarMensaje("El usuario no tiene un rol válido.");
    }

  } catch (error) {
    console.error("Error de autenticación:", error.code || error.message);
    mostrarMensaje("No se pudo iniciar sesión. Revisá tus credenciales.");
  }
});
