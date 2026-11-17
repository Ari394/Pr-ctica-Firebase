
"use strict";

import {
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  doc,
  setDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Esperar a que Firebase esté configurado
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

const formulario = document.getElementById("formRegistro");
const mensaje = document.getElementById("mensajeAuth");

function mostrarMensaje(texto) {
  mensaje.textContent = texto;
}

formulario.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const nombre = document.getElementById("nombre").value.trim();
  const correo = document.getElementById("correo").value.trim();
  const password = document.getElementById("password").value;
  const confirmarPassword =
    document.getElementById("confirmarPassword").value;

  if (!nombre) {
    mostrarMensaje("Ingresá tu nombre completo.");
    return;
  }

  if (password !== confirmarPassword) {
    mostrarMensaje("Las contraseñas no coinciden.");
    return;
  }

  const boton = formulario.querySelector("button[type='submit']");
  boton.disabled = true;

  try {
    mostrarMensaje("Creando cuenta...");

    // Crear usuario en Firebase Authentication
    const credenciales = await createUserWithEmailAndPassword(
      auth,
      correo,
      password
    );

    // Guardar perfil en Firestore
    await setDoc(
      doc(db, "usuarios", credenciales.user.uid),
      {
        nombre: nombre,
        correo: credenciales.user.email,
        rol: "usuario",
        fechaRegistro: Timestamp.now()
      }
    );

    mostrarMensaje("Cuenta creada correctamente.");

    // Cerrar la sesión para que ingrese desde el login
    await signOut(auth);

    window.location.href = "login.html";

  } catch (error) {
    console.error("Error al registrar:", error);

    if (error.code === "auth/email-already-in-use") {
      mostrarMensaje("Este correo ya está registrado.");
    } else if (error.code === "auth/weak-password") {
      mostrarMensaje("La contraseña es demasiado débil.");
    } else if (error.code === "auth/invalid-email") {
      mostrarMensaje("El correo electrónico no es válido.");
    } else if (error.code === "permission-denied") {
      mostrarMensaje("No se pudo guardar el perfil. Revisá las reglas de Firestore.");
    } else {
      mostrarMensaje("No se pudo crear la cuenta. Intentá nuevamente.");
    }

  } finally {
    boton.disabled = false;
  }
});
