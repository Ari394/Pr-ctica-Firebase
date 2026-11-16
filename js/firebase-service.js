
"use strict";

// Servicio preparado para conectar Firebase.
// Requiere inicializar Firebase antes de utilizarlo.

const FirebaseService = (() => {
  let db = null;
  let storage = null;
  let firestoreAPI = null;
  let storageAPI = null;

  function configurar(database, almacenamiento, firestore, storageFns) {
    db = database;
    storage = almacenamiento;
    firestoreAPI = firestore;
    storageAPI = storageFns;
  }

  function verificarConexion() {
    if (!db || !storage || !firestoreAPI || !storageAPI) {
      throw new Error("Firebase todavía no está configurado.");
    }
  }

  async function subirImagen(archivo, usuarioId) {
    verificarConexion();

    if (!archivo) return null;

    const ruta = `incidencias/${usuarioId}/${crypto.randomUUID()}-${archivo.name}`;

    const referencia = storageAPI.ref(storage, ruta);
    await storageAPI.uploadBytes(referencia, archivo);

    return await storageAPI.getDownloadURL(referencia);
  }

  async function crearAveria(averia) {
    verificarConexion();

    const referencia = firestoreAPI.doc(
      db, "averias", averia.id
    );

    await firestoreAPI.setDoc(referencia, averia);
    return averia;
  }

  async function obtenerAveriasUsuario(usuarioId) {
    verificarConexion();

    const consulta = firestoreAPI.query(
      firestoreAPI.collection(db, "averias"),
      firestoreAPI.where("usuarioId", "==", usuarioId)
    );

    const resultado = await firestoreAPI.getDocs(consulta);

    return resultado.docs.map(documento => ({
      ...documento.data(),
      id: documento.id
    }));
  }

  async function obtenerAveria(id) {
    verificarConexion();

    const referencia = firestoreAPI.doc(db, "averias", id);
    const resultado = await firestoreAPI.getDoc(referencia);

    return resultado.exists()
      ? { ...resultado.data(), id: resultado.id }
      : null;
  }

  async function actualizarAveria(id, cambios) {
    verificarConexion();

    const referencia = firestoreAPI.doc(db, "averias", id);
    await firestoreAPI.updateDoc(referencia, cambios);
  }

  async function aceptarSolucion(id) {
    return actualizarAveria(id, {
      conformidad: "Aceptada",
      motivoRechazo: null,
      fechaConformidad: new Date().toISOString(),
      estado: "Cerrado"
    });
  }

  async function rechazarSolucion(id, motivo) {
    if (!motivo || !motivo.trim()) {
      throw new Error("El motivo del rechazo es obligatorio.");
    }

    return actualizarAveria(id, {
      conformidad: "Rechazada",
      motivoRechazo: motivo.trim(),
      fechaConformidad: new Date().toISOString(),
      estado: "Rechazado"
    });
  }

  return {
    configurar,
    subirImagen,
    crearAveria,
    obtenerAveriasUsuario,
    obtenerAveria,
    actualizarAveria,
    aceptarSolucion,
    rechazarSolucion
  };
})();
