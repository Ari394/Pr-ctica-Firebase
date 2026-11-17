
"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import * as firestoreAPI from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

import * as storageAPI from "https://www.gstatic.com/firebasejs/12.6.0/firebase-storage.js";

// Configuración de nuestro proyecto HelpDesk
const firebaseConfig = {
  apiKey: "AIzaSyBtzMpDbEszxHjELMugNiB35eSjK_O4ku4",
  authDomain: "practica-firebase-helpdesk.firebaseapp.com",
  projectId: "practica-firebase-helpdesk",
  storageBucket: "practica-firebase-helpdesk.firebasestorage.app",
  messagingSenderId: "558283127311",
  appId: "1:558283127311:web:5e9759f4a9aa5a7fe0017a"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Servicios que utilizaremos
const auth = getAuth(app);
const db = firestoreAPI.getFirestore(app);
const storage = storageAPI.getStorage(app);

// Conectar con las funciones existentes del proyecto
if (typeof FirebaseService !== "undefined") {
  FirebaseService.configurar(
    db,
    storage,
    firestoreAPI,
    storageAPI
  );
}

// Compartir Authentication para los próximos módulos
window.HelpDeskFirebase = {
  auth,
  db,
  storage,
  firestoreAPI,
  storageAPI
};
window.dispatchEvent(new Event("firebase-ready"));

console.log("Firebase configurado correctamente");
