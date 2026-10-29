/* =====================================================================
   Mesa de Ayuda TI · CONAF — Capa de datos
   ---------------------------------------------------------------------
   PROTOTIPO: guarda usuarios, sesión y tickets en el navegador
   (localStorage). Sirve para validar el flujo con el equipo, pero los
   datos NO se comparten entre equipos ni navegadores y la autenticación
   en el cliente NO es segura.

   Para producción, reemplace las funciones de `Datos` por llamadas a un
   servidor (API REST) con autenticación institucional (Active Directory
   / LDAP o ClaveÚnica). Todas las funciones ya son asíncronas, por lo
   que la interfaz (app.js) no necesita cambios. Ver LEEME.md.
   ===================================================================== */
(function (global) {
  "use strict";

  /* ---------------- Configuración institucional ---------------- */
  const CONFIG = {
    institucion: "Corporación Nacional Forestal",
    sigla: "CONAF",
    area: "Departamento de Informática · Oficina Central",
    sistema: "Mesa de Ayuda TI",
    dominioCorreo: "conaf.cl",          // solo se aceptan correos de este dominio
    contactoSoporte: {                  // complete con los datos reales; vacío = no se muestra
      anexo: "",
      correo: "",
      horario: "Lunes a viernes, 08:30 a 17:30"
    },
    prefijoTicket: "TI"
  };

  /* ---------------- Catálogos ---------------- */
  const CATALOGOS = {
    categorias: ["Equipos y periféricos", "Impresoras y escáner", "Red e internet", "Correo y Office 365",
      "Cuentas y accesos", "Sistemas institucionales", "Software y licencias",
      "Telefonía y videoconferencia", "Seguridad informática", "Otro"],
    canales: ["Mesa web", "Correo", "Teléfono / anexo", "Presencial", "Chat"],
    unidades: ["Dirección Ejecutiva", "Fiscalía", "Auditoría Interna", "Secretaría de Comunicaciones",
      "Gerencia de Finanzas y Administración", "Gerencia de Desarrollo de las Personas",
      "Gerencia de Desarrollo y Fomento Forestal", "Gerencia de Fiscalización y Evaluación Ambiental",
      "Gerencia de Protección contra Incendios Forestales", "Gerencia de Áreas Silvestres Protegidas",
      "Departamento de Informática", "Oficina de Partes"],
    estados: [
      { k: "nuevo", l: "Nuevo", c: "c-info" }, { k: "asignado", l: "Asignado", c: "c-marca" },
      { k: "curso", l: "En curso", c: "c-marca" }, { k: "espera", l: "En espera", c: "c-warn" },
      { k: "resuelto", l: "Resuelto", c: "c-ok" }, { k: "cerrado", l: "Cerrado", c: "c-neu" }],
    niveles: [{ k: 1, l: "Alto" }, { k: 2, l: "Medio" }, { k: 3, l: "Bajo" }],
    impactoAyuda: { 1: "Alto: una unidad completa o un servicio crítico", 2: "Medio: varias personas", 3: "Bajo: una persona" },
    urgenciaAyuda: { 1: "Alta: no puedo trabajar", 2: "Media: tengo una alternativa temporal", 3: "Baja: puede esperar" },
    prioridades: {
      1: { l: "P1 Crítica", c: "c-crit", h: 4 }, 2: { l: "P2 Alta", c: "c-warn", h: 8 },
      3: { l: "P3 Media", c: "c-info", h: 24 }, 4: { l: "P4 Baja", c: "c-neu", h: 72 }
    },
    matriz: { "1-1": 1, "1-2": 2, "1-3": 3, "2-1": 2, "2-2": 3, "2-3": 4, "3-1": 3, "3-2": 4, "3-3": 4 },
    respuestas: [
      { t: "Solicitar más información", x: "Para avanzar con tu solicitud necesitamos: captura del mensaje de error, nombre del equipo (o N° de inventario) y la hora aproximada en que ocurrió." },
      { t: "Reinicio y verificación", x: "Se reinició el equipo y se verificó el funcionamiento junto a la persona solicitante. El servicio quedó operativo." },
      { t: "Restablecer contraseña", x: "Se restableció la contraseña de la cuenta institucional. Debes cambiarla en el primer inicio de sesión y no compartirla." },
      { t: "Escalado a proveedor", x: "El caso fue escalado al proveedor externo. Actualizaremos este ticket cuando tengamos respuesta." },
      { t: "Instalación de software", x: "Se instaló el software solicitado con licencia institucional y se validó su funcionamiento." }
    ]
  };
  const prioridadDe = (imp, urg) => CATALOGOS.matriz[imp + "-" + urg] || 3;

  /* ---------------- Almacenamiento local ---------------- */
  const K = { usuarios: "mati.usuarios", tickets: "mati.tickets", seq: "mati.secuencia", sesion: "mati.sesion", init: "mati.inicializado" };
  const leer = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } };
  const escribir = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); };
  const ahora = () => new Date().toISOString();
  const uid = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clon = (o) => JSON.parse(JSON.stringify(o));

  async function hash(texto, sal) {
    const datos = new TextEncoder().encode(sal + "::" + texto);
    if (global.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", datos);
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    }
    // Respaldo para navegadores sin crypto.subtle (no criptográfico; solo prototipo)
    let h = 2166136261; for (const b of datos) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
    return "fnv" + h.toString(16);
  }

  function error(code, message) { const e = new Error(message); e.code = code; return e; }
  const normCorreo = (c) => String(c || "").trim().toLowerCase();
  const correoValido = (c) => new RegExp("^[^@\\s]+@" + CONFIG.dominioCorreo.replace(".", "\\.") + "$").test(c);

  function publicoUsuario(u) { if (!u) return null; const { hash, sal, ...r } = u; return clon(r); }

  /* ---------------- Datos iniciales de demostración ---------------- */
  async function inicializar() {
    if (leer(K.init, false)) return;
    const usuarios = [];
    const crearDemo = async (o, pw) => { const sal = Math.random().toString(36).slice(2); usuarios.push(Object.assign({ id: uid("u"), activo: true, creado: ahora(), demo: true, sal, hash: await hash(pw, sal) }, o)); };
    await crearDemo({ nombre: "Soporte TI (demostración)", correo: "soporte.demo@conaf.cl", unidad: "Departamento de Informática", rol: "admin", anexo: "" }, "Soporte2026!");
    await crearDemo({ nombre: "Técnico de turno (demostración)", correo: "tecnico.demo@conaf.cl", unidad: "Departamento de Informática", rol: "admin", anexo: "" }, "Soporte2026!");
    await crearDemo({ nombre: "Funcionario/a (demostración)", correo: "funcionario.demo@conaf.cl", unidad: "Gerencia de Desarrollo y Fomento Forestal", rol: "funcionario", anexo: "" }, "Conaf2026!");
    escribir(K.usuarios, usuarios);

    // Tickets de ejemplo, marcados como tales; el administrador puede eliminarlos.
    const [adm, tec, fun] = usuarios;
    const H = 36e5, n0 = Date.now(), y = new Date().getFullYear();
    let seq = 0; const tickets = [];
    const mk = (hAtras, o, extra) => {
      seq++; const creado = new Date(n0 - hAtras * H).toISOString(); const p = prioridadDe(o.imp, o.urg);
      const t = Object.assign({
        id: uid("t"), num: `${CONFIG.prefijoTicket}-${y}-${String(seq).padStart(4, "0")}`, anio: y, seq, ejemplo: true,
        tipo: "Incidente", canal: "Mesa web", descripcion: "", inventario: "", prio: p, creado, actualizado: creado,
        vence: new Date(Date.parse(creado) + CATALOGOS.prioridades[p].h * H).toISOString(),
        resuelto: null, cerrado: null, solucion: "", tecnico: null, creadoPor: fun.id, solicitanteId: fun.id,
        solicitante: { nombre: fun.nombre, unidad: fun.unidad, correo: fun.correo, anexo: "", ubic: "" },
        historial: [{ t: creado, by: fun.id, tipo: "sistema", texto: "Solicitud creada" }]
      }, o, { prio: p });
      if (extra) extra(t, H);
      tickets.push(t); return t;
    };
    const resolver = (hDesp, tecId) => (t, H) => { t.tecnico = tecId; t.resuelto = new Date(Date.parse(t.creado) + hDesp * H).toISOString(); t.actualizado = t.resuelto; t.solucion = "Solución registrada (ejemplo)."; t.historial.push({ t: t.resuelto, by: tecId, tipo: "solucion", texto: t.solucion }); };
    const otro = (nombre, unidad) => ({ solicitanteId: null, creadoPor: adm.id, canal: "Teléfono / anexo", solicitante: { nombre, unidad, correo: "", anexo: "", ubic: "" } });
    mk(500, Object.assign(otro("Persona de ejemplo", "Oficina de Partes"), { asunto: "Reemplazo de tóner", categoria: "Impresoras y escáner", estado: "cerrado", imp: 3, urg: 3 }), resolver(10, tec.id));
    mk(330, Object.assign(otro("Persona de ejemplo", "Secretaría de Comunicaciones"), { asunto: "VPN no conecta desde casa", categoria: "Red e internet", estado: "cerrado", imp: 3, urg: 1 }), resolver(6, adm.id));
    mk(200, { asunto: "Nuevo funcionario: crear cuenta y preparar equipo", tipo: "Requerimiento", categoria: "Cuentas y accesos", estado: "cerrado", imp: 3, urg: 2 }, resolver(20, tec.id));
    mk(120, Object.assign(otro("Persona de ejemplo", "Gerencia de Áreas Silvestres Protegidas"), { asunto: "Buzón compartido no sincroniza en Outlook", categoria: "Correo y Office 365", estado: "cerrado", imp: 2, urg: 2 }), resolver(31, adm.id));
    mk(26, Object.assign(otro("Persona de ejemplo", "Gerencia de Desarrollo de las Personas"), { asunto: "Correo sospechoso con adjunto reportado", categoria: "Seguridad informática", estado: "resuelto", imp: 1, urg: 2 }), resolver(5, tec.id));
    mk(30, Object.assign(otro("Persona de ejemplo", "Fiscalía"), { asunto: "Error al firmar documentos en el sistema de gestión documental", categoria: "Sistemas institucionales", estado: "curso", tecnico: adm.id, imp: 2, urg: 1 }));
    mk(20, { asunto: "Instalar QGIS en notebook de terreno", tipo: "Requerimiento", categoria: "Software y licencias", estado: "espera", tecnico: tec.id, imp: 3, urg: 3, descripcion: "Necesito QGIS para salida a terreno la próxima semana." },
      (t, H) => t.historial.push({ t: new Date(Date.parse(t.creado) + 2 * H).toISOString(), by: tec.id, tipo: "respuesta", texto: "Estamos esperando la aprobación de la jefatura para instalar software en el equipo." }));
    mk(5, Object.assign(otro("Persona de ejemplo", "Oficina de Partes"), { asunto: "Impresora multifuncional atasca papel en bandeja 2", categoria: "Impresoras y escáner", estado: "asignado", tecnico: tec.id, imp: 2, urg: 2 }));
    mk(1.2, Object.assign(otro("Persona de ejemplo", "Gerencia de Protección contra Incendios Forestales"), { asunto: "Sin acceso a internet en el piso 3, ala norte", categoria: "Red e internet", estado: "curso", tecnico: adm.id, imp: 1, urg: 1, descripcion: "Ningún equipo del ala norte tiene conexión desde las 8:30." }));
    mk(0.5, { asunto: "No puedo ingresar a la intranet", categoria: "Cuentas y accesos", estado: "nuevo", imp: 3, urg: 1 });
    escribir(K.tickets, tickets);
    escribir(K.seq, { anio: y, n: seq });
    escribir(K.init, true);
  }

  /* ---------------- Sesión y usuarios ---------------- */
  function sesion() { const s = leer(K.sesion, null); if (!s) return null; const u = leer(K.usuarios, []).find(x => x.id === s.id && x.activo); return u ? publicoUsuario(u) : null; }

  const Datos = {
    CONFIG, CATALOGOS, prioridadDe,
    inicializar,

    async usuarioActual() { await inicializar(); return sesion(); },

    async ingresar(correo, clave, rol) {
      await inicializar();
      correo = normCorreo(correo);
      const u = leer(K.usuarios, []).find(x => x.correo === correo);
      if (!u || u.hash !== await hash(clave, u.sal)) throw error("credenciales", "El correo o la contraseña no son correctos.");
      if (!u.activo) throw error("inactivo", "Tu cuenta está desactivada. Contacta al Departamento de Informática.");
      if (u.rol !== rol) throw error("rol", rol === "admin"
        ? "Esta cuenta es de funcionario/a. Ingresa por la opción Funcionarios."
        : "Esta cuenta es del equipo de soporte. Ingresa por la opción Administración.");
      escribir(K.sesion, { id: u.id, desde: ahora() });
      return publicoUsuario(u);
    },

    async salir() { localStorage.removeItem(K.sesion); },

    async registrar({ nombre, correo, unidad, anexo, clave }) {
      await inicializar();
      correo = normCorreo(correo);
      if (!nombre || !unidad) throw error("datos", "Completa tu nombre y tu unidad.");
      if (!correoValido(correo)) throw error("correo", `Usa tu correo institucional (@${CONFIG.dominioCorreo}).`);
      if (!clave || clave.length < 8) throw error("clave", "La contraseña debe tener al menos 8 caracteres.");
      const us = leer(K.usuarios, []);
      if (us.some(x => x.correo === correo)) throw error("existe", "Ya existe una cuenta con ese correo.");
      const sal = Math.random().toString(36).slice(2);
      const u = { id: uid("u"), nombre: nombre.trim(), correo, unidad: unidad.trim(), anexo: (anexo || "").trim(), rol: "funcionario", activo: true, creado: ahora(), sal, hash: await hash(clave, sal) };
      us.push(u); escribir(K.usuarios, us);
      // vincula solicitudes previas registradas por soporte con ese correo
      const ts = leer(K.tickets, []); let cambio = false;
      ts.forEach(t => { if (!t.solicitanteId && normCorreo(t.solicitante && t.solicitante.correo) === correo) { t.solicitanteId = u.id; cambio = true; } });
      if (cambio) escribir(K.tickets, ts);
      escribir(K.sesion, { id: u.id, desde: ahora() });
      return publicoUsuario(u);
    },

    async cambiarClave(actual, nueva) {
      const yo = sesion(); if (!yo) throw error("sesion", "Tu sesión terminó. Vuelve a ingresar.");
      const us = leer(K.usuarios, []); const u = us.find(x => x.id === yo.id);
      if (u.hash !== await hash(actual, u.sal)) throw error("credenciales", "La contraseña actual no es correcta.");
      if (!nueva || nueva.length < 8) throw error("clave", "La nueva contraseña debe tener al menos 8 caracteres.");
      u.sal = Math.random().toString(36).slice(2); u.hash = await hash(nueva, u.sal); u.debeCambiar = false;
      escribir(K.usuarios, us);
    },

    /* Solo administradores */
    async listarUsuarios() { const yo = sesion(); if (!yo || yo.rol !== "admin") throw error("permiso", "Sin permiso."); return leer(K.usuarios, []).map(publicoUsuario); },
    async listarTecnicos() { return leer(K.usuarios, []).filter(u => u.rol === "admin" && u.activo).map(u => ({ id: u.id, nombre: u.nombre })); },
    async nombres() { const m = {}; leer(K.usuarios, []).forEach(u => m[u.id] = u.nombre); return m; },
    async guardarUsuario(datos) {
      const yo = sesion(); if (!yo || yo.rol !== "admin") throw error("permiso", "Sin permiso.");
      const us = leer(K.usuarios, []); const correo = normCorreo(datos.correo);
      if (!datos.nombre || !datos.unidad) throw error("datos", "Completa nombre y unidad.");
      if (!correoValido(correo)) throw error("correo", `El correo debe ser @${CONFIG.dominioCorreo}.`);
      if (us.some(x => x.correo === correo && x.id !== datos.id)) throw error("existe", "Ya existe una cuenta con ese correo.");
      if (datos.id) {
        const u = us.find(x => x.id === datos.id);
        if (u.id === yo.id && (datos.rol !== "admin" || datos.activo === false)) throw error("propio", "No puedes quitarte el rol de administrador ni desactivar tu propia cuenta.");
        Object.assign(u, { nombre: datos.nombre.trim(), correo, unidad: datos.unidad.trim(), anexo: (datos.anexo || "").trim(), rol: datos.rol, activo: datos.activo !== false });
        if (datos.clave) { if (datos.clave.length < 8) throw error("clave", "La contraseña temporal debe tener al menos 8 caracteres."); u.sal = Math.random().toString(36).slice(2); u.hash = await hash(datos.clave, u.sal); u.debeCambiar = true; }
      } else {
        if (!datos.clave || datos.clave.length < 8) throw error("clave", "Define una contraseña temporal de al menos 8 caracteres.");
        const sal = Math.random().toString(36).slice(2);
        us.push({ id: uid("u"), nombre: datos.nombre.trim(), correo, unidad: datos.unidad.trim(), anexo: (datos.anexo || "").trim(), rol: datos.rol, activo: true, creado: ahora(), sal, hash: await hash(datos.clave, sal), debeCambiar: true });
      }
      escribir(K.usuarios, us);
    },

    /* ---------------- Tickets ---------------- */
    async listarTickets() {
      const yo = sesion(); if (!yo) throw error("sesion", "Tu sesión terminó.");
      const ts = leer(K.tickets, []);
      if (yo.rol === "admin") return clon(ts);
      // funcionarios: solo lo suyo y sin notas internas
      return clon(ts.filter(t => t.solicitanteId === yo.id)).map(t => { t.historial = (t.historial || []).filter(h => h.tipo !== "nota"); return t; });
    },

    async crearTicket(d) {
      const yo = sesion(); if (!yo) throw error("sesion", "Tu sesión terminó.");
      const ts = leer(K.tickets, []); const y = new Date().getFullYear();
      let s = leer(K.seq, { anio: y, n: 0 }); if (s.anio !== y) s = { anio: y, n: 0 };
      s.n++; escribir(K.seq, s);
      const creado = ahora();
      const esAdmin = yo.rol === "admin";
      const imp = esAdmin ? +d.imp || 3 : 3, urg = +d.urg || 2, prio = prioridadDe(imp, urg);
      let solicitanteId = esAdmin ? null : yo.id;
      if (esAdmin && d.solicitante && d.solicitante.correo) { const v = leer(K.usuarios, []).find(u => u.correo === normCorreo(d.solicitante.correo)); if (v) solicitanteId = v.id; }
      const t = {
        id: uid("t"), num: `${CONFIG.prefijoTicket}-${y}-${String(s.n).padStart(4, "0")}`, anio: y, seq: s.n,
        asunto: d.asunto, descripcion: d.descripcion || "", tipo: d.tipo || "Incidente", categoria: d.categoria,
        canal: esAdmin ? d.canal : "Mesa web", inventario: d.inventario || "",
        solicitante: esAdmin ? d.solicitante : { nombre: yo.nombre, unidad: yo.unidad, correo: yo.correo, anexo: d.anexo || yo.anexo || "", ubic: d.ubic || "" },
        solicitanteId, imp, urg, prio, estado: esAdmin && d.tecnico ? "asignado" : "nuevo", tecnico: esAdmin ? (d.tecnico || null) : null,
        creadoPor: yo.id, creado, actualizado: creado,
        vence: new Date(Date.parse(creado) + CATALOGOS.prioridades[prio].h * 36e5).toISOString(),
        resuelto: null, cerrado: null, solucion: "",
        historial: [{ t: creado, by: yo.id, tipo: "sistema", texto: esAdmin ? "Ticket registrado por soporte" : "Solicitud creada" }]
      };
      ts.push(t); escribir(K.tickets, ts);
      return clon(t);
    },

    /* Cambios de un administrador: campos + entrada de historial */
    async actualizarTicket(id, campos, entrada) {
      const yo = sesion(); if (!yo || yo.rol !== "admin") throw error("permiso", "Solo el equipo de soporte puede modificar tickets.");
      const ts = leer(K.tickets, []); const t = ts.find(x => x.id === id); if (!t) throw error("no_existe", "El ticket ya no existe.");
      const tAhora = ahora();
      Object.assign(t, campos, { actualizado: tAhora });
      if ("imp" in campos || "urg" in campos) { t.prio = prioridadDe(t.imp, t.urg); t.vence = new Date(Date.parse(t.creado) + CATALOGOS.prioridades[t.prio].h * 36e5).toISOString(); }
      (Array.isArray(entrada) ? entrada : entrada ? [entrada] : []).forEach(e => t.historial.push(Object.assign({ t: tAhora, by: yo.id }, e)));
      escribir(K.tickets, ts);
      return clon(t);
    },

    /* Acciones del funcionario sobre su propia solicitud */
    async comentar(id, texto) {
      const yo = sesion(); const ts = leer(K.tickets, []); const t = ts.find(x => x.id === id);
      if (!yo || !t || (yo.rol !== "admin" && t.solicitanteId !== yo.id)) throw error("permiso", "Sin permiso sobre esta solicitud.");
      const tA = ahora(); t.historial.push({ t: tA, by: yo.id, tipo: "comentario", texto }); t.actualizado = tA;
      if (t.estado === "espera") { t.estado = "curso"; t.historial.push({ t: tA, by: yo.id, tipo: "sistema", texto: "Estado: En curso (respuesta del solicitante)" }); }
      escribir(K.tickets, ts);
    },
    async confirmarSolucion(id, conforme, texto) {
      const yo = sesion(); const ts = leer(K.tickets, []); const t = ts.find(x => x.id === id);
      if (!yo || !t || t.solicitanteId !== yo.id) throw error("permiso", "Sin permiso sobre esta solicitud.");
      if (t.estado !== "resuelto") throw error("estado", "La solicitud no está marcada como resuelta.");
      const tA = ahora();
      if (conforme) { t.estado = "cerrado"; t.cerrado = tA; t.historial.push({ t: tA, by: yo.id, tipo: "sistema", texto: "Solución confirmada por el solicitante. Ticket cerrado." }); }
      else { t.estado = "curso"; t.resuelto = null; t.historial.push({ t: tA, by: yo.id, tipo: "comentario", texto: texto || "El problema no está resuelto." }, { t: tA, by: yo.id, tipo: "sistema", texto: "Reabierto por el solicitante" }); }
      t.actualizado = tA; escribir(K.tickets, ts);
    },

    async eliminarEjemplos() {
      const yo = sesion(); if (!yo || yo.rol !== "admin") throw error("permiso", "Sin permiso.");
      escribir(K.tickets, leer(K.tickets, []).filter(t => !t.ejemplo));
    },
    async hayEjemplos() { return leer(K.tickets, []).some(t => t.ejemplo); },

    /* Avisa cuando otra pestaña del mismo navegador cambia los datos */
    alCambiar(fn) { global.addEventListener("storage", e => { if (e.key && e.key.startsWith("mati.")) fn(e.key); }); }
  };

  global.Datos = Datos;
})(window);
