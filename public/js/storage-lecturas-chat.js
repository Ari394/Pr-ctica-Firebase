"use strict";

// Almacenamiento temporal de las lecturas de chat del administrador.
// Posteriormente será reemplazado por Firebase Firestore.
//
// Los mensajes se guardan con RepositorioAverias (los mismos que usa
// el panel del técnico). Aquí solo se guarda, por avería, la fecha del
// último mensaje que el administrador ya leyó: { [averiaId]: fechaISO }.

const RepositorioLecturasChat = (() => {
  const CLAVE = "helpdesk_chat_lecturas_admin_v1";

  function obtenerTodas() {
    try {
      const datos = JSON.parse(
        localStorage.getItem(CLAVE) || "{}"
      );

      return datos && typeof datos === "object" && !Array.isArray(datos)
        ? datos
        : {};
    } catch (error) {
      console.error("Error al leer lecturas de chat:", error);
      return {};
    }
  }

  function marcarLeida(averiaId, fecha) {
    const lecturas = obtenerTodas();

    // Solo se guarda si avanza, para no disparar eventos
    // "storage" innecesarios en otras pestañas.
    if (lecturas[averiaId] && lecturas[averiaId] >= fecha) {
      return;
    }

    lecturas[averiaId] = fecha;

    localStorage.setItem(
      CLAVE,
      JSON.stringify(lecturas)
    );
  }

  return {
    obtenerTodas,
    marcarLeida
  };
})();
