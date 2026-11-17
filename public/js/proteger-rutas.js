
"use strict";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc,
  getDoc
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

// Verificar sesión y rol
onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    window.location.replace("login.html");
    return;
  }

  try {
    const referencia = doc(db, "usuarios", usuario.uid);
    const resultado = await getDoc(referencia);

    if (!resultado.exists()) {
      window.location.replace("login.html");
      return;
    }

    const datos = resultado.data();

    
   
const paginaActual = window.location.pathname.split("/").pop();

const rutasPorRol = {
  usuario: "index.html",
  tecnico: "tecnico.html",
  administrador: "admin.html"
};

const rutaPermitida = rutasPorRol[datos.rol];

if (!rutaPermitida) {
  await signOut(auth);
  window.location.replace("login.html");
  return;
}

const pagina = paginaActual || "index.html";

if (pagina !== rutaPermitida) {
  window.location.replace(rutaPermitida);
  return;
}


    // Compartir el usuario autenticado con app.js
    window.USUARIO_FIREBASE = {
      uid: usuario.uid,
      nombre: datos.nombre,
      correo: usuario.email,
      rol: datos.rol
    };

    // Avisar que la autenticación terminó
    window.dispatchEvent(new Event("usuario-autenticado"));

  } catch (error) {
    console.error("Error al verificar el usuario:", error);
    window.location.replace("login.html");
  }
});


const btnCerrarSesion = document.getElementById("btnCerrarSesion");

if (btnCerrarSesion) {
  btnCerrarSesion.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.replace("login.html");
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert("No se pudo cerrar sesión. Inténtalo nuevamente.");
    }
  });
}
