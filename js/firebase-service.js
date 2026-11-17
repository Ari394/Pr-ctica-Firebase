"use strict";

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

  async function agregarEnColeccion(nombre, elemento) {
    verificarConexion();

    const referencia = firestoreAPI.doc(db, nombre, elemento.id);
    await firestoreAPI.setDoc(referencia, elemento);

    return elemento;
  }

  async function listarPorAveria(nombre, averiaId) {
    verificarConexion();

    const consulta = firestoreAPI.query(
      firestoreAPI.collection(db, nombre),
      firestoreAPI.where("averiaId", "==", averiaId)
    );

    const resultado = await firestoreAPI.getDocs(consulta);

    return resultado.docs
      .map(documento => ({ ...documento.data(), id: documento.id }))
      .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  }

  async function obtenerAveriasTecnico(tecnicoId) {
    verificarConexion();

    const consulta = firestoreAPI.query(
      firestoreAPI.collection(db, "averias"),
      firestoreAPI.where("tecnicoId", "==", tecnicoId)
    );

    const resultado = await firestoreAPI.getDocs(consulta);

    return resultado.docs.map(documento => ({
      ...documento.data(),
      id: documento.id
    }));
  }

  async function obtenerAveriaTecnico(id, tecnicoId) {
    const averia = await obtenerAveria(id);

    return averia && averia.tecnicoId === tecnicoId
      ? averia
      : null;
  }

  async function actualizarAveriaTecnico(id, tecnicoId, cambios) {
    const averia = await obtenerAveriaTecnico(id, tecnicoId);

    if (!averia) {
      throw new Error("No se encontró la avería asignada.");
    }

    const {
      id: _id,
      usuarioId: _usuarioId,
      tecnicoId: _tecnicoId,
      ...permitidos
    } = cambios;

    await actualizarAveria(id, permitidos);

    return { ...averia, ...permitidos };
  }

  function dataUrlABlob(dataUrl) {
    const [cabecera, base64] = dataUrl.split(",");
    const tipo = cabecera.match(/data:(.*?);base64/)[1];
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);

    for (let i = 0; i < binario.length; i++) {
      bytes[i] = binario.charCodeAt(i);
    }

    return new Blob([bytes], { type: tipo });
  }

  async function agregarEvidencia(evidencia) {
    verificarConexion();

    let url = evidencia.url;

    if (typeof url === "string" && url.startsWith("data:")) {
      const ruta =
        `incidencias/${evidencia.tecnicoId}/evidencias/${evidencia.id}`;

      const referencia = storageAPI.ref(storage, ruta);
      await storageAPI.uploadBytes(referencia, dataUrlABlob(url));
      url = await storageAPI.getDownloadURL(referencia);
    }

    return agregarEnColeccion("evidencias", { ...evidencia, url });
  }

  async function agregarIntervencion(intervencion) {
    return agregarEnColeccion("intervenciones", intervencion);
  }

  async function obtenerIntervenciones(averiaId) {
    return listarPorAveria("intervenciones", averiaId);
  }

  async function obtenerEvidencias(averiaId) {
    return listarPorAveria("evidencias", averiaId);
  }

  async function agregarMensaje(mensaje) {
    return agregarEnColeccion("mensajes", mensaje);
  }

  async function obtenerMensajes(averiaId) {
    return listarPorAveria("mensajes", averiaId);
  }

  return {
    configurar,
    subirImagen,
    crearAveria,
    obtenerAveriasUsuario,
    obtenerAveria,
    actualizarAveria,
    aceptarSolucion,
    rechazarSolucion,
    obtenerAveriasTecnico,
    obtenerAveriaTecnico,
    actualizarAveriaTecnico,
    agregarIntervencion,
    obtenerIntervenciones,
    agregarEvidencia,
    obtenerEvidencias,
    agregarMensaje,
    obtenerMensajes
  };
})();