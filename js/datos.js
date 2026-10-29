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

   Perfiles: "soporte" (Usuario TI: todos tienen los mismos privilegios
   de administración) y "funcionario" (crea y sigue sus solicitudes).
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
    // Unidades según el organigrama institucional (agosto de 2026)
    unidades: ["Dirección Ejecutiva", "Subdirección Ejecutiva", "Fiscalía", "Jefatura de Gabinete",
      "Secretaría de Asuntos Institucionales", "Auditoría Interna", "Secretaría de Comunicaciones", "Secretaría de Política Forestal",
      "Programa de Empleo", "Secretaría de Asuntos Indígenas", "Secretaría de Relaciones Internacionales",
      "Unidad de Participación Ciudadana y Transparencia", "Unidad de Igualdad de Género y Diversidades",
      "Unidad de Información y Análisis", "Unidad de Seguridad Informática",
      "Gerencia de Fiscalización Forestal y Evaluación Ambiental", "Gerencia de Bosques y Cambio Climático",
      "Gerencia de Áreas Protegidas", "Gerencia de Finanzas y Administración", "Departamento de Informática",
      "Gerencia de Desarrollo de las Personas", "Gerencia de Protección contra Incendios Forestales",
      "Dirección Regional", "Oficina Provincial", "Oficina Provincial de Isla de Pascua"],
    // Cargo del solicitante → nivel jerárquico del organigrama → prioridad (n = P1..P4).
    // El orden de la lista es el orden de atención dentro de un mismo nivel.
    niveles: {
      1: "Autoridad superior",
      2: "Directivo",
      3: "Jefatura",
      4: "Funcionario/a"
    },
    cargos: [
      { k: "director", l: "Director/a Ejecutivo/a", n: 1 },
      { k: "subdirector", l: "Subdirector/a Ejecutivo/a", n: 1 },
      { k: "fiscal", l: "Fiscal", n: 2 },
      { k: "gabinete", l: "Jefe/a de Gabinete", n: 2 },
      { k: "secretario", l: "Secretario/a de Secretaría (Asuntos Institucionales, Comunicaciones, Política Forestal, Asuntos Indígenas, Relaciones Internacionales)", n: 2 },
      { k: "auditor", l: "Auditor/a Interno/a", n: 2 },
      { k: "gerente", l: "Gerente/a", n: 2 },
      { k: "regional", l: "Director/a Regional", n: 2 },
      { k: "jefe-depto", l: "Jefe/a de Departamento", n: 3 },
      { k: "jefe-unidad", l: "Jefe/a de Unidad", n: 3 },
      { k: "jefe-centro", l: "Jefe/a del Centro de Semillas Genéticas y Entomología", n: 3 },
      { k: "jefe-programa", l: "Jefe/a de Programa", n: 3 },
      { k: "jefe-provincial", l: "Jefe/a de Oficina Provincial", n: 3 },
      { k: "profesional", l: "Profesional", n: 4 },
      { k: "tecnico", l: "Técnico/a", n: 4 },
      { k: "administrativo", l: "Administrativo/a", n: 4 },
      { k: "auxiliar", l: "Auxiliar", n: 4 }
    ],
    estados: [
      { k: "nuevo", l: "Nuevo", c: "c-info" }, { k: "asignado", l: "Asignado", c: "c-marca" },
      { k: "curso", l: "En curso", c: "c-marca" }, { k: "espera", l: "En espera", c: "c-warn" },
      { k: "resuelto", l: "Resuelto", c: "c-ok" }, { k: "cerrado", l: "Cerrado", c: "c-neu" }],
    urgenciaAyuda: { 1: "Alta: no puedo trabajar", 2: "Media: tengo una alternativa temporal", 3: "Baja: puede esperar" },
    prioridades: {
      1: { l: "P1 Máxima", c: "c-crit", h: 4 }, 2: { l: "P2 Alta", c: "c-warn", h: 8 },
      3: { l: "P3 Media", c: "c-info", h: 24 }, 4: { l: "P4 Normal", c: "c-neu", h: 72 }
    },
    respuestas: [
      { t: "Solicitar más información", x: "Para avanzar con tu solicitud necesitamos: captura del mensaje de error, nombre del equipo (o N° de inventario) y la hora aproximada en que ocurrió." },
      { t: "Reinicio y verificación", x: "Se reinició el equipo y se verificó el funcionamiento junto a la persona solicitante. El servicio quedó operativo." },
      { t: "Restablecer contraseña", x: "Se restableció la contraseña de la cuenta institucional. Debes cambiarla en el primer inicio de sesión y no compartirla." },
      { t: "Escalado a proveedor", x: "El caso fue escalado al proveedor externo. Actualizaremos este ticket cuando tengamos respuesta." },
      { t: "Instalación de software", x: "Se instaló el software solicitado con licencia institucional y se validó su funcionamiento." }
    ]
  };
  const cargoDe = k => CATALOGOS.cargos.find(c => c.k === k) || null;
  const prioridadDe = cargo => (cargoDe(cargo) || { n: 4 }).n;   // la prioridad es el nivel jerárquico del cargo
  // posición del cargo en el organigrama (0 = Director/a Ejecutivo/a); desempata dentro de un mismo nivel
  const rangoDe = cargo => { const i = CATALOGOS.cargos.findIndex(c => c.k === cargo); return i < 0 ? CATALOGOS.cargos.length : i; };
  const venceDe = (creado, prio) => new Date(Date.parse(creado) + CATALOGOS.prioridades[prio].h * 36e5).toISOString();

  /* ---------------- Almacenamiento local ---------------- */
  const K = { usuarios: "mati.usuarios", tickets: "mati.tickets", seq: "mati.secuencia", sesion: "mati.sesion", init: "mati.inicializado", version: "mati.version" };
  const VERSION = 5;   // 3: perfil único Usuario TI y prioridad según cargo · 4: sin cuenta de demostración de jefatura · 5: sin cargo Asesor/a
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
  const esTI = (u) => !!u && u.rol === "soporte";

  function publicoUsuario(u) { if (!u) return null; const { hash, sal, ...r } = u; return clon(r); }

  /* ---------------- Datos iniciales de demostración ---------------- */
  const usuarioDemo = async (o, pw) => { const sal = Math.random().toString(36).slice(2); return Object.assign({ id: uid("u"), activo: true, creado: ahora(), demo: true, sal, hash: await hash(pw, sal) }, o); };

  /* Datos guardados por versiones anteriores */
  async function migrar() {
    if (leer(K.version, 1) >= VERSION) return;
    const us = leer(K.usuarios, []).filter(u => !(u.demo && u.correo === "jefatura.demo@conaf.cl"));
    us.forEach(u => {
      if (u.rol === "admin") { u.rol = "soporte"; if (u.demo && u.correo === "admin.demo@conaf.cl") u.activo = false; }
      if (!cargoDe(u.cargo)) u.cargo = "profesional";
    });
    escribir(K.usuarios, us);
    const s = leer(K.sesion, null); if (s && !us.some(u => u.id === s.id)) localStorage.removeItem(K.sesion);
    escribir(K.version, VERSION);
  }

  async function inicializar() {
    if (leer(K.init, false)) return migrar();
    // Dos profesionales del Departamento de Informática con los mismos privilegios
    const usuarios = [
      await usuarioDemo({ nombre: "Usuario TI 1 (demostración)", correo: "soporte.demo@conaf.cl", unidad: "Departamento de Informática", cargo: "profesional", rol: "soporte", anexo: "" }, "Soporte2026!"),
      await usuarioDemo({ nombre: "Usuario TI 2 (demostración)", correo: "tecnico.demo@conaf.cl", unidad: "Departamento de Informática", cargo: "tecnico", rol: "soporte", anexo: "" }, "Soporte2026!"),
      await usuarioDemo({ nombre: "Funcionario/a (demostración)", correo: "funcionario.demo@conaf.cl", unidad: "Gerencia de Bosques y Cambio Climático", cargo: "profesional", rol: "funcionario", anexo: "" }, "Conaf2026!")];
    escribir(K.usuarios, usuarios);
    escribir(K.version, VERSION);

    // Tickets de ejemplo, marcados como tales; un Usuario TI puede eliminarlos.
    const [sop, tec, fun] = usuarios;
    const H = 36e5, n0 = Date.now(), y = new Date().getFullYear();
    let seq = 0; const tickets = [];
    const mk = (hAtras, o, extra) => {
      seq++; const creado = new Date(n0 - hAtras * H).toISOString(); const cargo = o.cargo || fun.cargo, p = prioridadDe(cargo);
      const t = Object.assign({
        id: uid("t"), num: `${CONFIG.prefijoTicket}-${y}-${String(seq).padStart(4, "0")}`, anio: y, seq, ejemplo: true,
        tipo: "Incidente", canal: "Mesa web", descripcion: "", inventario: "", urg: 2, creado, actualizado: creado,
        resuelto: null, cerrado: null, solucion: "", tecnico: null, creadoPor: fun.id, solicitanteId: fun.id,
        solicitante: { nombre: fun.nombre, unidad: fun.unidad, correo: fun.correo, anexo: "", ubic: "" },
        historial: [{ t: creado, by: fun.id, tipo: "sistema", texto: "Solicitud creada" }]
      }, o, { cargo, prio: p, prioManual: false, vence: venceDe(creado, p) });
      if (extra) extra(t, H);
      tickets.push(t); return t;
    };
    const resolver = (hDesp, tecId) => (t, H) => { t.tecnico = tecId; t.resuelto = new Date(Date.parse(t.creado) + hDesp * H).toISOString(); t.actualizado = t.resuelto; t.solucion = "Solución registrada (ejemplo)."; t.historial.push({ t: t.resuelto, by: tecId, tipo: "solucion", texto: t.solucion }); };
    const otro = (nombre, unidad, cargo) => ({ solicitanteId: null, creadoPor: sop.id, canal: "Teléfono / anexo", cargo, solicitante: { nombre, unidad, correo: "", anexo: "", ubic: "" } });
    mk(500, Object.assign(otro("Persona de ejemplo", "Gerencia de Finanzas y Administración", "administrativo"), { asunto: "Reemplazo de tóner", categoria: "Impresoras y escáner", estado: "cerrado" }), resolver(10, tec.id));
    mk(330, Object.assign(otro("Persona de ejemplo", "Secretaría de Comunicaciones", "secretario"), { asunto: "VPN no conecta desde casa", categoria: "Red e internet", estado: "cerrado" }), resolver(6, sop.id));
    mk(200, { asunto: "Nuevo funcionario: crear cuenta y preparar equipo", tipo: "Requerimiento", categoria: "Cuentas y accesos", estado: "cerrado" }, resolver(20, tec.id));
    mk(120, Object.assign(otro("Persona de ejemplo", "Gerencia de Áreas Protegidas", "jefe-depto"), { asunto: "Buzón compartido no sincroniza en Outlook", categoria: "Correo y Office 365", estado: "cerrado" }), resolver(31, sop.id));
    mk(26, Object.assign(otro("Persona de ejemplo", "Gerencia de Desarrollo de las Personas", "profesional"), { asunto: "Correo sospechoso con adjunto reportado", categoria: "Seguridad informática", estado: "resuelto" }), resolver(5, tec.id));
    mk(30, Object.assign(otro("Persona de ejemplo", "Fiscalía", "fiscal"), { asunto: "Error al firmar documentos en el sistema de gestión documental", categoria: "Sistemas institucionales", estado: "curso", tecnico: sop.id, urg: 1 }));
    mk(20, { asunto: "Instalar QGIS en notebook de terreno", tipo: "Requerimiento", categoria: "Software y licencias", estado: "espera", tecnico: tec.id, urg: 3, descripcion: "Necesito QGIS para salida a terreno la próxima semana." },
      (t, H) => t.historial.push({ t: new Date(Date.parse(t.creado) + 2 * H).toISOString(), by: tec.id, tipo: "respuesta", texto: "Estamos esperando la aprobación de la jefatura para instalar software en el equipo." }));
    mk(5, Object.assign(otro("Persona de ejemplo", "Gerencia de Finanzas y Administración", "administrativo"), { asunto: "Impresora multifuncional atasca papel en bandeja 2", categoria: "Impresoras y escáner", estado: "asignado", tecnico: tec.id }));
    mk(3, Object.assign(otro("Persona de ejemplo", "Oficina Provincial", "jefe-provincial"), { asunto: "Sin conexión al sistema de gestión documental", categoria: "Sistemas institucionales", estado: "nuevo" }));
    mk(1.2, Object.assign(otro("Persona de ejemplo", "Gerencia de Protección contra Incendios Forestales", "gerente"), { asunto: "Sin acceso a internet en la oficina de la gerencia", categoria: "Red e internet", estado: "nuevo", urg: 1, descripcion: "Ningún equipo de la gerencia tiene conexión desde las 8:30." }));
    mk(0.8, Object.assign(otro("Persona de ejemplo", "Dirección Ejecutiva", "director"), { asunto: "Proyector de la sala de reuniones no detecta el notebook", categoria: "Equipos y periféricos", estado: "nuevo", urg: 1 }));
    mk(0.5, { asunto: "No puedo ingresar a la intranet", categoria: "Cuentas y accesos", estado: "nuevo", urg: 1 });
    escribir(K.tickets, tickets);
    escribir(K.seq, { anio: y, n: seq });
    escribir(K.init, true);
  }

  /* ---------------- Sesión y usuarios ---------------- */
  function sesion() { const s = leer(K.sesion, null); if (!s) return null; const u = leer(K.usuarios, []).find(x => x.id === s.id && x.activo); return u ? publicoUsuario(u) : null; }
  function exigirTI() { const yo = sesion(); if (!esTI(yo)) throw error("permiso", "Solo un Usuario TI puede realizar esta acción."); return yo; }

  const Datos = {
    CONFIG, CATALOGOS, prioridadDe, cargoDe, rangoDe,
    inicializar,

    async usuarioActual() { await inicializar(); return sesion(); },

    async ingresar(correo, clave, rol) {
      await inicializar();
      correo = normCorreo(correo);
      const u = leer(K.usuarios, []).find(x => x.correo === correo);
      if (!u || u.hash !== await hash(clave, u.sal)) throw error("credenciales", "El correo o la contraseña no son correctos.");
      if (!u.activo) throw error("inactivo", "Tu cuenta está desactivada. Contacta al Departamento de Informática.");
      if (u.rol !== rol) throw error("rol", u.rol === "funcionario"
        ? "Esta cuenta es de funcionario/a. Ingresa desde el formulario de la portada."
        : "Esta cuenta es de Usuario TI. Ingresa con el botón «Usuario TI» de la esquina superior derecha.");
      escribir(K.sesion, { id: u.id, desde: ahora() });
      return publicoUsuario(u);
    },

    async salir() { localStorage.removeItem(K.sesion); },

    async registrar({ nombre, correo, unidad, cargo, anexo, clave }) {
      await inicializar();
      correo = normCorreo(correo);
      if (!nombre || !unidad) throw error("datos", "Completa tu nombre y tu unidad.");
      if (!cargoDe(cargo)) throw error("cargo", "Selecciona tu cargo.");
      if (!correoValido(correo)) throw error("correo", `Usa tu correo institucional (@${CONFIG.dominioCorreo}).`);
      if (!clave || clave.length < 8) throw error("clave", "La contraseña debe tener al menos 8 caracteres.");
      const us = leer(K.usuarios, []);
      if (us.some(x => x.correo === correo)) throw error("existe", "Ya existe una cuenta con ese correo.");
      const sal = Math.random().toString(36).slice(2);
      const u = { id: uid("u"), nombre: nombre.trim(), correo, unidad: unidad.trim(), cargo, anexo: (anexo || "").trim(), rol: "funcionario", activo: true, creado: ahora(), sal, hash: await hash(clave, sal) };
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

    /* Solo Usuario TI */
    async listarUsuarios() { exigirTI(); return leer(K.usuarios, []).map(publicoUsuario); },
    async listarTecnicos() { return leer(K.usuarios, []).filter(u => u.rol === "soporte" && u.activo).map(u => ({ id: u.id, nombre: u.nombre })); },
    async nombres() { const m = {}; leer(K.usuarios, []).forEach(u => m[u.id] = u.nombre); return m; },
    async guardarUsuario(datos) {
      const yo = exigirTI();
      const us = leer(K.usuarios, []); const correo = normCorreo(datos.correo);
      if (!datos.nombre || !datos.unidad) throw error("datos", "Completa nombre y unidad.");
      if (!cargoDe(datos.cargo)) throw error("cargo", "Selecciona el cargo.");
      if (!correoValido(correo)) throw error("correo", `El correo debe ser @${CONFIG.dominioCorreo}.`);
      if (us.some(x => x.correo === correo && x.id !== datos.id)) throw error("existe", "Ya existe una cuenta con ese correo.");
      const campos = { nombre: datos.nombre.trim(), correo, unidad: datos.unidad.trim(), cargo: datos.cargo, anexo: (datos.anexo || "").trim(), rol: datos.rol === "soporte" ? "soporte" : "funcionario" };
      if (datos.id) {
        const u = us.find(x => x.id === datos.id);
        if (u.id === yo.id && (campos.rol !== "soporte" || datos.activo === false)) throw error("propio", "No puedes quitarte el perfil de Usuario TI ni desactivar tu propia cuenta.");
        Object.assign(u, campos, { activo: datos.activo !== false });
        if (datos.clave) { if (datos.clave.length < 8) throw error("clave", "La contraseña temporal debe tener al menos 8 caracteres."); u.sal = Math.random().toString(36).slice(2); u.hash = await hash(datos.clave, u.sal); u.debeCambiar = true; }
      } else {
        if (!datos.clave || datos.clave.length < 8) throw error("clave", "Define una contraseña temporal de al menos 8 caracteres.");
        const sal = Math.random().toString(36).slice(2);
        us.push(Object.assign({ id: uid("u"), activo: true, creado: ahora(), sal, hash: await hash(datos.clave, sal), debeCambiar: true }, campos));
      }
      escribir(K.usuarios, us);
    },

    /* ---------------- Tickets: un solo repositorio para todo el equipo TI ---------------- */
    async listarTickets() {
      const yo = sesion(); if (!yo) throw error("sesion", "Tu sesión terminó.");
      const ts = leer(K.tickets, []);
      if (esTI(yo)) return clon(ts);
      // funcionarios: solo lo suyo, sin eliminadas ni notas internas
      return clon(ts.filter(t => t.solicitanteId === yo.id && !t.eliminado)).map(t => { t.historial = (t.historial || []).filter(h => h.tipo !== "nota"); return t; });
    },

    async crearTicket(d) {
      const yo = sesion(); if (!yo) throw error("sesion", "Tu sesión terminó.");
      const ts = leer(K.tickets, []); const y = new Date().getFullYear();
      let s = leer(K.seq, { anio: y, n: 0 }); if (s.anio !== y) s = { anio: y, n: 0 };
      s.n++; escribir(K.seq, s);
      const creado = ahora();
      const ti = esTI(yo);
      let solicitanteId = ti ? null : yo.id, cargo = ti ? d.cargo : yo.cargo;
      if (ti && d.solicitante && d.solicitante.correo) { const v = leer(K.usuarios, []).find(u => u.correo === normCorreo(d.solicitante.correo)); if (v) { solicitanteId = v.id; if (!cargoDe(cargo)) cargo = v.cargo; } }
      if (!cargoDe(cargo)) cargo = "profesional";
      const prioManual = ti && !!+d.prio, prio = prioManual ? +d.prio : prioridadDe(cargo);
      const t = {
        id: uid("t"), num: `${CONFIG.prefijoTicket}-${y}-${String(s.n).padStart(4, "0")}`, anio: y, seq: s.n,
        asunto: d.asunto, descripcion: d.descripcion || "", tipo: d.tipo || "Incidente", categoria: d.categoria,
        canal: ti ? d.canal : "Mesa web", inventario: d.inventario || "",
        solicitante: ti ? d.solicitante : { nombre: yo.nombre, unidad: yo.unidad, correo: yo.correo, anexo: d.anexo || yo.anexo || "", ubic: d.ubic || "" },
        solicitanteId, cargo, urg: +d.urg || 2, prio, prioManual, estado: ti && d.tecnico ? "asignado" : "nuevo", tecnico: ti ? (d.tecnico || null) : null,
        creadoPor: yo.id, creado, actualizado: creado, vence: venceDe(creado, prio),
        resuelto: null, cerrado: null, solucion: "",
        historial: [{ t: creado, by: yo.id, tipo: "sistema", texto: (ti ? "Ticket registrado por soporte" : "Solicitud creada") + ` · ${CATALOGOS.prioridades[prio].l}${prioManual ? " (asignada manualmente)" : " según cargo"}` }]
      };
      ts.push(t); escribir(K.tickets, ts);
      return clon(t);
    },

    /* Cambios de un Usuario TI: campos + entrada de historial */
    async actualizarTicket(id, campos, entrada) {
      const yo = exigirTI();
      const ts = leer(K.tickets, []); const t = ts.find(x => x.id === id); if (!t) throw error("no_existe", "El ticket ya no existe.");
      if (t.eliminado) throw error("eliminado", "La solicitud fue eliminada.");
      const tAhora = ahora();
      Object.assign(t, campos, { actualizado: tAhora });
      // la prioridad sigue al cargo salvo que un Usuario TI la haya fijado a mano
      if ("cargo" in campos && !t.prioManual) t.prio = prioridadDe(t.cargo);
      if ("prioManual" in campos && !t.prioManual) t.prio = prioridadDe(t.cargo);
      if ("prio" in campos || "cargo" in campos || "prioManual" in campos) t.vence = venceDe(t.creado, t.prio);
      (Array.isArray(entrada) ? entrada : entrada ? [entrada] : []).forEach(e => t.historial.push(Object.assign({ t: tAhora, by: yo.id }, e)));
      escribir(K.tickets, ts);
      return clon(t);
    },

    /* Acciones del funcionario sobre su propia solicitud */
    async comentar(id, texto) {
      const yo = sesion(); const ts = leer(K.tickets, []); const t = ts.find(x => x.id === id);
      if (!yo || !t || !(esTI(yo) || t.solicitanteId === yo.id)) throw error("permiso", "Sin permiso sobre esta solicitud.");
      if (t.eliminado) throw error("eliminado", "La solicitud fue eliminada.");
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

    /* Eliminación: el funcionario la pide con un motivo y un Usuario TI la acepta o la rechaza.
       Una solicitud eliminada no se borra: queda marcada para trazabilidad y sale de las listas. */
    async solicitarEliminacion(id, motivo) {
      const yo = sesion(); const ts = leer(K.tickets, []); const t = ts.find(x => x.id === id);
      if (!yo || !t || t.solicitanteId !== yo.id || t.eliminado) throw error("permiso", "Sin permiso sobre esta solicitud.");
      motivo = String(motivo || "").trim();
      if (motivo.length < 5) throw error("motivo", "Indica el motivo para eliminar la solicitud.");
      if (t.estado === "cerrado") throw error("estado", "Una solicitud cerrada no se puede eliminar.");
      if (t.eliminacion && t.eliminacion.estado === "pendiente") throw error("pendiente", "Ya pediste eliminar esta solicitud.");
      const tA = ahora();
      t.eliminacion = { estado: "pendiente", motivo, t: tA, by: yo.id };
      t.historial.push({ t: tA, by: yo.id, tipo: "eliminacion", texto: "Pidió eliminar la solicitud. Motivo: " + motivo });
      t.actualizado = tA; escribir(K.tickets, ts);
    },
    async retirarEliminacion(id) {
      const yo = sesion(); const ts = leer(K.tickets, []); const t = ts.find(x => x.id === id);
      if (!yo || !t || t.solicitanteId !== yo.id || !t.eliminacion || t.eliminacion.estado !== "pendiente") throw error("permiso", "No hay un pedido de eliminación pendiente.");
      const tA = ahora(); t.eliminacion = null;
      t.historial.push({ t: tA, by: yo.id, tipo: "sistema", texto: "Retiró el pedido de eliminación" });
      t.actualizado = tA; escribir(K.tickets, ts);
    },
    async resolverEliminacion(id, aceptar, respuesta) {
      const yo = exigirTI(); const ts = leer(K.tickets, []); const t = ts.find(x => x.id === id);
      if (!t || !t.eliminacion || t.eliminacion.estado !== "pendiente") throw error("estado", "La solicitud no tiene un pedido de eliminación pendiente.");
      const tA = ahora(); respuesta = String(respuesta || "").trim();
      if (aceptar) {
        t.eliminacion.estado = "aceptada";
        t.eliminado = { t: tA, by: yo.id, motivo: t.eliminacion.motivo };
        t.historial.push({ t: tA, by: yo.id, tipo: "sistema", texto: "Eliminación aceptada por " + yo.nombre + (respuesta ? ". " + respuesta : "") });
      } else {
        t.eliminacion = null;
        t.historial.push({ t: tA, by: yo.id, tipo: "respuesta", texto: "No se aceptó eliminar la solicitud" + (respuesta ? ": " + respuesta : ".") });
      }
      t.actualizado = tA; escribir(K.tickets, ts);
    },

    async eliminarEjemplos() {
      exigirTI();
      escribir(K.tickets, leer(K.tickets, []).filter(t => !t.ejemplo));
    },
    async hayEjemplos() { return leer(K.tickets, []).some(t => t.ejemplo); },

    /* Avisa cuando otra pestaña del mismo navegador cambia los datos */
    alCambiar(fn) { global.addEventListener("storage", e => { if (e.key && e.key.startsWith("mati.")) fn(e.key); }); }
  };

  global.Datos = Datos;
})(window);
