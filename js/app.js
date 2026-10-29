/* =====================================================================
   Mesa de Ayuda TI · CONAF — Interfaz
   Portada de acceso por rol, portal de funcionarios y consola de soporte.
   Depende de js/datos.js (objeto global `Datos`).
   ===================================================================== */
(function () {
  "use strict";
  const { CONFIG, CATALOGOS: C } = Datos;
  const EST = Object.fromEntries(C.estados.map(e => [e.k, e]));
  const ABIERTO = new Set(["nuevo", "asignado", "curso", "espera"]);
  const TZ = "America/Santiago";

  /* ---------------- utilidades ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fFH = new Intl.DateTimeFormat("es-CL", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const fF = new Intl.DateTimeFormat("es-CL", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
  const fechaHora = iso => iso ? fFH.format(new Date(iso)) : "—";
  const fecha = iso => iso ? fF.format(new Date(iso)) : "—";
  const dur = ms => { const a = Math.abs(ms), h = a / 36e5; if (h < 1) return Math.max(1, Math.round(a / 6e4)) + " min"; if (h < 48) return (h < 10 ? h.toFixed(1).replace(".", ",") : Math.round(h)) + " h"; return Math.round(h / 24) + " d"; };
  const iniciales = n => String(n || "?").split(/\s+/).filter(w => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "?";
  function aviso(msg) { const r = $("#capa-aviso"); r.innerHTML = ""; const d = document.createElement("div"); d.className = "toast"; d.setAttribute("role", "status"); d.textContent = msg; r.appendChild(d); clearTimeout(aviso.t); aviso.t = setTimeout(() => d.remove(), 3400); }
  function plazo(t, ahora = Date.now()) {
    if (!t.vence) return { k: "", txt: "—" };
    const v = Date.parse(t.vence), ini = Date.parse(t.creado);
    if (t.resuelto) { const ok = Date.parse(t.resuelto) <= v; return { k: ok ? "hecho" : "vencido", ok, txt: ok ? "Dentro de plazo" : "Fuera de plazo" }; }
    if (t.estado === "cerrado") return { k: "hecho", txt: "Cerrado" };
    const resta = v - ahora;
    if (resta < 0) return { k: "vencido", txt: "Vencido hace " + dur(resta) };
    return { k: resta < (v - ini) * 0.25 ? "riesgo" : "", txt: "Vence en " + dur(resta) };
  }
  const franja = p => ({ 1: "var(--crit)", 2: "var(--warn)", 3: "var(--info)", 4: "var(--linea)" }[p] || "var(--linea)");
  const chipEstado = e => { const s = EST[e] || EST.nuevo; return `<span class="chip ${s.c}">${s.l}</span>`; };
  const chipPrio = p => { const x = C.prioridades[p] || C.prioridades[3]; return `<span class="prio ${x.c}">${x.l}</span>`; };
  const opciones = (arr, sel) => arr.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(sel) ? " selected" : ""}>${esc(l)}</option>`).join("");

  /* ---------------- estado ---------------- */
  const S = { yo: null, tickets: [], nombres: {}, tecnicos: [], vista: null, cola: "abiertos", abierto: null, filtroMis: "abiertas", ejemplos: false };
  const nombre = id => (id && S.nombres[id]) || "";

  /* ---------------- cabecera: fecha, texto, tema ---------------- */
  const hoy = new Intl.DateTimeFormat("es-CL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  $("#fecha-hoy").textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);
  const guardarPref = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } };
  $$("[data-texto]").forEach(b => b.addEventListener("click", () => {
    const actual = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--escala")) || 1;
    const nuevo = b.dataset.texto === "mas" ? Math.min(1.3, actual + .1) : b.dataset.texto === "menos" ? Math.max(.9, actual - .1) : 1;
    document.documentElement.style.setProperty("--escala", nuevo.toFixed(2)); guardarPref("mati.texto", nuevo === 1 ? null : nuevo.toFixed(2));
  }));
  $("#btn-tema").addEventListener("click", () => {
    const oscuro = document.documentElement.getAttribute("data-theme") ? document.documentElement.getAttribute("data-theme") === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const nuevo = oscuro ? "light" : "dark"; document.documentElement.setAttribute("data-theme", nuevo); guardarPref("mati.tema", nuevo);
  });
  $("#lista-unidades").innerHTML = C.unidades.map(u => `<option value="${esc(u)}"></option>`).join("");
  (function contacto() {
    const c = CONFIG.contactoSoporte; let h = "";
    if (c.horario) h += `<dt>Horario de soporte</dt><dd>${esc(c.horario)}</dd>`;
    if (c.anexo) h += `<dt>Anexo</dt><dd class="mono">${esc(c.anexo)}</dd>`;
    if (c.correo) h += `<dt>Correo</dt><dd>${esc(c.correo)}</dd>`;
    $("#contacto-soporte").innerHTML = h;
  })();

  /* menú de usuario */
  $("#usuario-btn").addEventListener("click", e => { e.stopPropagation(); const m = $("#usuario-menu"); m.hidden = !m.hidden; $("#usuario-btn").setAttribute("aria-expanded", String(!m.hidden)); });
  document.addEventListener("click", () => { $("#usuario-menu").hidden = true; $("#usuario-btn").setAttribute("aria-expanded", "false"); });
  $("#usuario-menu").addEventListener("click", async e => {
    const a = e.target.closest("[data-accion]"); if (!a) return;
    if (a.dataset.accion === "salir") { await Datos.salir(); S.yo = null; history.replaceState(null, "", location.pathname); mostrarPortada(); aviso("Sesión cerrada"); }
    if (a.dataset.accion === "clave") modalClave();
  });

  /* ================= PORTADA ================= */
  const TIT_INGRESO = "Para solicitar un ticket de atención, ingrese los siguientes datos";
  function verFormulario(registro) {
    $("#form-ingreso").hidden = registro; $("#form-registro").hidden = !registro;
    $("#acceso-tit").textContent = registro ? "Crea tu cuenta" : TIT_INGRESO;
    $("#in-error").textContent = ""; $("#rg-error").textContent = "";
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".ver-clave"); if (!b) return;
    const i = document.getElementById(b.dataset.ver); const ver = i.type === "password"; i.type = ver ? "text" : "password";
    b.textContent = ver ? "Ocultar" : "Ver"; b.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
  });
  $("#ir-registro").addEventListener("click", () => { verFormulario(true); $("#rg-nombre").focus(); });
  $("#volver-ingreso").addEventListener("click", () => verFormulario(false));
  $$("[data-staff]").forEach(b => b.addEventListener("click", () => modalStaff(b.dataset.staff)));

  $("#form-ingreso").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#in-error"); err.textContent = "";
    const correo = $("#in-correo").value, clave = $("#in-clave").value;
    if (!correo || !clave) { err.textContent = "Ingresa tu correo y tu contraseña."; return; }
    const b = $("#in-btn"); b.disabled = true;
    try { S.yo = await Datos.ingresar(correo, clave, "funcionario"); $("#in-clave").value = ""; await entrar(true); }
    catch (x) { err.textContent = x.message; }
    finally { b.disabled = false; }
  });

  /* ingreso del administrador del sistema y de los profesionales de soporte */
  function modalStaff(rol) {
    const adm = rol === "admin";
    modal(`<h2>${adm ? "Ingreso del administrador del sistema" : "Ingreso de soporte"}</h2>
      <p class="rol-desc" style="margin:-6px 0 14px">${adm ? "Recibe los tickets, los asigna a los profesionales de soporte, administra usuarios y revisa indicadores."
        : "Profesionales del Departamento de Informática: revisa y atiende los tickets que el administrador asignó a tu perfil."}</p>
      <form id="m-form" novalidate>
        <div class="campo"><label for="ms-correo">Correo institucional</label><input type="email" id="ms-correo" autocomplete="username" placeholder="nombre.apellido@conaf.cl"></div>
        <div class="campo"><label for="ms-clave">Contraseña</label><div class="clave-wrap"><input type="password" id="ms-clave" autocomplete="current-password"><button type="button" class="ver-clave" data-ver="ms-clave" aria-label="Mostrar contraseña">Ver</button></div></div>
        <p class="msg-error" id="m-err" role="alert"></p>
        <div class="pie-acciones"><button type="button" class="btn fantasma" data-cerrar-modal>Cancelar</button><button type="submit" class="btn ${adm ? "azul" : "primario"}" id="ms-btn">Ingresar</button></div>
        <p class="pie-form">${adm ? "Si olvidaste tu contraseña, contacta a otro administrador del sistema." : "Tu cuenta la crea el administrador del sistema."}</p></form>`,
      v => $("#m-form", v).addEventListener("submit", async e => {
        e.preventDefault(); const err = $("#m-err"); err.textContent = "";
        const correo = $("#ms-correo").value, clave = $("#ms-clave").value;
        if (!correo || !clave) { err.textContent = "Ingresa tu correo y tu contraseña."; return; }
        $("#ms-btn").disabled = true;
        try { S.yo = await Datos.ingresar(correo, clave, rol); $("#capa-modal").innerHTML = ""; await entrar(true); }
        catch (x) { err.textContent = x.message; $("#ms-btn").disabled = false; }
      }), adm ? "modo-admin" : "modo-soporte");
  }
  $("#form-registro").addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#rg-error"); err.textContent = "";
    try {
      S.yo = await Datos.registrar({ nombre: $("#rg-nombre").value, correo: $("#rg-correo").value, unidad: $("#rg-unidad").value, anexo: $("#rg-anexo").value, clave: $("#rg-clave").value });
      e.target.reset(); await entrar(true); aviso("Cuenta creada. Bienvenido/a.");
    } catch (x) { err.textContent = x.message; }
  });

  function mostrarPortada() {
    $("#portada").hidden = false; $("#app").hidden = true; $("#menu-usuario").hidden = true; $("#nav-app").hidden = true; $("#acceso-staff").hidden = false;
    cerrarPanel(true); $("#capa-modal").innerHTML = "";
    verFormulario(false); document.title = "Mesa de Ayuda TI · CONAF";
  }

  /* ================= APLICACIÓN ================= */
  const NAV = {
    admin: [{ k: "bandeja", l: "Bandeja de tickets" }, { k: "indicadores", l: "Indicadores" }, { k: "usuarios", l: "Usuarios" }, { k: "nuevo", l: "+ Registrar ticket", cls: "nav-nuevo" }],
    soporte: [{ k: "bandeja", l: "Mis tickets asignados" }],
    funcionario: [{ k: "mis-solicitudes", l: "Mis solicitudes" }, { k: "nueva-solicitud", l: "+ Nueva solicitud", cls: "nav-nuevo" }]
  };
  const ROL = { admin: "Administrador del sistema", soporte: "Soporte TI", funcionario: "Funcionario/a" };
  const esStaff = () => S.yo.rol !== "funcionario";
  async function entrar(nuevaSesion) {
    $("#portada").hidden = true; $("#app").hidden = false; $("#menu-usuario").hidden = false; $("#nav-app").hidden = false; $("#acceso-staff").hidden = true;
    $("#usuario-nombre").textContent = S.yo.nombre; $("#usuario-ini").textContent = iniciales(S.yo.nombre);
    $("#usuario-rol").textContent = S.yo.rol === "funcionario" ? S.yo.unidad : ROL[S.yo.rol];
    $("#usuario-ini").style.background = { admin: "var(--gob-azul)", soporte: "var(--verde-2)", funcionario: "var(--verde)" }[S.yo.rol];
    if (nuevaSesion) { S.cola = "abiertos"; F.tec = ""; history.replaceState(null, "", location.pathname + "#" + NAV[S.yo.rol][0].k); }
    await cargar();
    ruta();
    if (S.yo.debeCambiar) { modalClave(true); }
  }
  async function cargar() {
    S.tickets = await Datos.listarTickets();
    S.nombres = await Datos.nombres();
    if (S.yo.rol === "admin") { S.tecnicos = await Datos.listarTecnicos(); S.ejemplos = await Datos.hayEjemplos(); }
  }
  function ruta() {
    if (!S.yo) return;
    const h = location.hash.slice(1);
    const vistas = NAV[S.yo.rol].map(n => n.k);
    if (h.startsWith("t-")) { if (!S.vista) S.vista = vistas[0]; pintar(); abrirPanel(h); return; }
    cerrarPanel(true);
    S.vista = vistas.includes(h) ? h : vistas[0];
    pintar();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", ruta);
  function pintarNav() {
    const vencidos = esStaff() ? S.tickets.filter(t => ABIERTO.has(t.estado) && plazo(t).k === "vencido").length : 0;
    $("#nav-in").innerHTML = NAV[S.yo.rol].map(n => `<a href="#${n.k}" class="${n.cls || ""}"${n.k === S.vista ? ' aria-current="page"' : ""}>${esc(n.l)}${n.k === "bandeja" && vencidos ? `<span class="badge" title="Tickets con plazo vencido">${vencidos}</span>` : ""}</a>`).join("");
  }
  function pintar() {
    pintarNav(); pintarAvisos();
    const v = S.vista;
    document.title = (NAV[S.yo.rol].find(n => n.k === v) || {}).l.replace("+ ", "") + " · Mesa de Ayuda TI";
    if (v === "bandeja") vistaBandeja();
    else if (v === "indicadores") vistaIndicadores();
    else if (v === "usuarios") vistaUsuarios();
    else if (v === "nuevo") vistaNuevo(true);
    else if (v === "nueva-solicitud") vistaNuevo(false);
    else vistaMis();
  }
  function pintarAvisos() {
    const r = $("#avisos");
    if (S.yo.rol === "admin" && S.ejemplos) {
      r.innerHTML = `<div class="aviso"><span><b>Datos de ejemplo.</b> Hay tickets ficticios (marcados EJ) para mostrar el funcionamiento.</span><button type="button" class="btn" id="borrar-ej">Eliminar tickets de ejemplo</button></div>`;
      $("#borrar-ej").addEventListener("click", () => confirmar("Eliminar tickets de ejemplo", "Se eliminarán todos los tickets marcados como ejemplo. Los tickets reales no se modifican.", "Eliminar", async () => { await Datos.eliminarEjemplos(); await cargar(); pintar(); aviso("Tickets de ejemplo eliminados"); }));
    } else r.innerHTML = "";
  }

  /* ---------------- ADMIN: bandeja ---------------- */
  const COLAS = [
    { k: "abiertos", l: "Abiertos", f: t => ABIERTO.has(t.estado) },
    { k: "sin", l: "Sin asignar", f: t => ABIERTO.has(t.estado) && !t.tecnico, solo: "admin", alerta: true },
    { k: "vencidos", l: "Plazo vencido", f: t => ABIERTO.has(t.estado) && plazo(t).k === "vencido", alerta: true },
    { k: "espera", l: "En espera", f: t => t.estado === "espera" },
    { k: "resueltos", l: "Resueltos sin confirmar", f: t => t.estado === "resuelto" },
    { k: "cerrados", l: "Cerrados", f: t => t.estado === "cerrado" },
    { k: "todos", l: "Todos", f: () => true }];
  const colas = () => COLAS.filter(c => !c.solo || c.solo === S.yo.rol);
  const F = { prio: "", cat: "", tec: "", q: "", orden: "plazo" };
  function vistaBandeja() {
    const adm = S.yo.rol === "admin";
    if (!adm) F.tec = "";
    $("#vista").innerHTML = `
      ${adm ? "" : `<div class="encabezado"><div><h1>Mis tickets asignados</h1><p class="sub">Tickets que el administrador del sistema asignó a tu perfil. Registra el avance y la solución en cada uno.</p></div></div>`}
      <div class="bandeja">
        <aside class="filtros" aria-label="Filtros">
          <div class="grupo"><h3>Vistas</h3><div class="colas" id="colas"></div></div>
          <div class="campo"><label for="f-prio">Prioridad</label><select id="f-prio"><option value="">Todas</option>${opciones([1, 2, 3, 4].map(p => [p, C.prioridades[p].l]), F.prio)}</select></div>
          <div class="campo"><label for="f-cat">Categoría</label><select id="f-cat"><option value="">Todas</option>${opciones(C.categorias.map(c => [c, c]), F.cat)}</select></div>
          ${adm ? `<div class="campo"><label for="f-tec">Profesional de soporte</label><select id="f-tec"><option value="">Todos</option><option value="__sin"${F.tec === "__sin" ? " selected" : ""}>Sin asignar</option>${opciones(S.tecnicos.map(t => [t.id, t.nombre]), F.tec)}</select></div>` : ""}
        </aside>
        <div style="min-width:0">
          <div class="barra-lista">
            <h2 id="cola-tit"></h2><span class="cuenta" id="cola-n"></span>
            <input type="search" id="f-q" class="buscar" placeholder="Buscar N°, asunto, solicitante o unidad" aria-label="Buscar tickets" value="${esc(F.q)}">
            <select id="f-orden" aria-label="Ordenar">${opciones([["plazo", "Vence primero"], ["nuevos", "Más recientes"], ["prio", "Mayor prioridad"]], F.orden)}</select>
          </div>
          <div class="lista" id="lista" role="list"></div>
        </div>
      </div>`;
    [["#f-prio", "prio"], ["#f-cat", "cat"], ["#f-tec", "tec"], ["#f-orden", "orden"]].filter(([s]) => $(s)).forEach(([s, k]) => $(s).addEventListener("change", e => { F[k] = e.target.value; pintarLista(); }));
    $("#f-q").addEventListener("input", e => { F.q = e.target.value; pintarLista(); });
    $("#colas").addEventListener("click", e => { const b = e.target.closest("[data-cola]"); if (b) { S.cola = b.dataset.cola; pintarLista(); } });
    $("#lista").addEventListener("click", e => { const f = e.target.closest(".fila[data-id]"); if (f) location.hash = f.dataset.id; });
    $("#lista").addEventListener("keydown", e => { if (e.key === "Enter") { const f = e.target.closest(".fila[data-id]"); if (f) location.hash = f.dataset.id; } });
    pintarLista();
  }
  function pintarLista() {
    if (!$("#lista")) return;
    $("#colas").innerHTML = colas().map(c => { const n = S.tickets.filter(c.f).length; return `<button type="button" data-cola="${c.k}" aria-pressed="${S.cola === c.k}" class="${c.alerta && n ? "alerta" : ""}"><span>${c.l}</span><span class="n">${n}</span></button>`; }).join("");
    const cola = colas().find(c => c.k === S.cola) || COLAS[0];
    const q = F.q.trim().toLowerCase();
    let arr = S.tickets.filter(cola.f).filter(t => (!F.prio || String(t.prio) === F.prio) && (!F.cat || t.categoria === F.cat) && (!F.tec || (F.tec === "__sin" ? !t.tecnico : t.tecnico === F.tec)));
    if (q) arr = arr.filter(t => [t.num, t.asunto, t.solicitante && t.solicitante.nombre, t.solicitante && t.solicitante.unidad, t.descripcion, t.inventario].join(" ").toLowerCase().includes(q));
    arr.sort(F.orden === "nuevos" ? (a, b) => b.creado.localeCompare(a.creado) : F.orden === "prio" ? (a, b) => a.prio - b.prio || a.vence.localeCompare(b.vence)
      : (a, b) => (ABIERTO.has(a.estado) ? 0 : 1) - (ABIERTO.has(b.estado) ? 0 : 1) || a.vence.localeCompare(b.vence));
    $("#cola-tit").textContent = cola.l; $("#cola-n").textContent = arr.length + (arr.length === 1 ? " ticket" : " tickets");
    if (!arr.length) { $("#lista").innerHTML = `<div class="vacio"><h3>No hay tickets en esta vista</h3><p>${S.tickets.length ? "Prueba otra vista o quita los filtros." : S.yo.rol === "admin" ? "Registra el primero con «+ Registrar ticket»." : "Cuando el administrador del sistema asigne un ticket a tu perfil, aparecerá aquí."}</p></div>`; return; }
    $("#lista").innerHTML = `<div class="fila cab" aria-hidden="true"><span>N°</span><span>Asunto / solicitante</span><span>Prioridad</span><span class="c-est">Estado</span><span class="c-tec">Asignado a</span><span class="c-plazo">Plazo</span></div>` +
      arr.map(t => { const p = plazo(t); return `<div class="fila" role="listitem" tabindex="0" data-id="${esc(t.id)}" style="--franja:${franja(t.prio)}">
        <span class="num">${esc(t.num)}${t.ejemplo ? '<span class="etq-ej">EJ</span>' : ""}</span>
        <span class="asunto"><b>${esc(t.asunto)}</b><span>${esc(t.solicitante && t.solicitante.unidad)}${t.solicitante && t.solicitante.nombre ? " · " + esc(t.solicitante.nombre) : ""} · ${esc(t.categoria)}</span></span>
        <span class="c-prio">${chipPrio(t.prio)}</span>
        <span class="c-est">${chipEstado(t.estado)}</span>
        <span class="quien c-tec">${t.tecnico ? esc(nombre(t.tecnico)) : '<span class="sin">Sin asignar</span>'}</span>
        <span class="plazo ${p.k} c-plazo">${esc(p.txt)}</span></div>`; }).join("");
  }

  /* ---------------- FUNCIONARIO: avance de la solicitud ---------------- */
  const PASOS = ["Recibida", "Asignada", "En atención", "Resuelta", "Cerrada"];
  const PASO = { nuevo: 0, asignado: 1, curso: 2, espera: 2, resuelto: 3, cerrado: 4 };
  function progreso(t, compacto) {
    const i = PASO[t.estado] ?? 0;
    const et = k => k === i && t.estado === "espera" ? "En espera" : PASOS[k];
    return `<ol class="progreso${compacto ? " compacto" : ""}" aria-label="Avance de la solicitud: paso ${i + 1} de ${PASOS.length}, ${et(i)}">${PASOS.map((_, k) =>
      `<li class="${k < i || t.estado === "cerrado" ? "hecho" : k === i ? "actual" : ""}"${k === i ? ' aria-current="step"' : ""}><span>${et(k)}</span></li>`).join("")}</ol>`;
  }

  /* ---------------- FUNCIONARIO: mis solicitudes ---------------- */
  function vistaMis() {
    const abiertas = S.tickets.filter(t => ABIERTO.has(t.estado));
    const porConfirmar = S.tickets.filter(t => t.estado === "resuelto");
    const cerradas = S.tickets.filter(t => t.estado === "cerrado");
    const lista = (S.filtroMis === "abiertas" ? S.tickets.filter(t => t.estado !== "cerrado") : S.tickets).slice().sort((a, b) => b.actualizado.localeCompare(a.actualizado));
    const nombrePila = S.yo.nombre.split(" ")[0];
    $("#vista").innerHTML = `
      <div class="encabezado"><div><h1>Hola, ${esc(nombrePila)}</h1><p class="sub">Estas son tus solicitudes al Departamento de Informática.</p></div>
        <div class="acciones"><a class="btn primario" href="#nueva-solicitud">+ Nueva solicitud</a></div></div>
      <div class="resumen-mis">
        <div class="res"><div class="v">${abiertas.length}</div><div class="l">En atención</div></div>
        <div class="res"><div class="v" style="color:${porConfirmar.length ? "var(--ok)" : "inherit"}">${porConfirmar.length}</div><div class="l">Resueltas por confirmar</div></div>
        <div class="res"><div class="v">${cerradas.length}</div><div class="l">Cerradas</div></div>
      </div>
      <div class="barra-lista"><h2>Solicitudes</h2>
        <div class="segmento" role="group" aria-label="Mostrar" style="margin-left:auto">
          <button type="button" data-f="abiertas" aria-pressed="${S.filtroMis === "abiertas"}">Vigentes</button>
          <button type="button" data-f="todas" aria-pressed="${S.filtroMis === "todas"}">Todas</button></div></div>
      <div class="mis" id="mis">${lista.length ? lista.map(t => {
        const ult = (t.historial || []).filter(h => h.tipo !== "sistema").slice(-1)[0];
        return `<article class="tarjeta" tabindex="0" data-id="${esc(t.id)}" style="--franja:${t.estado === "resuelto" ? "var(--ok)" : franja(t.prio)}">
          <div class="t-top"><span class="t-num">${esc(t.num)}</span>${chipEstado(t.estado)}${t.ejemplo ? '<span class="etq-ej">EJ</span>' : ""}</div>
          <span class="plazo" style="justify-self:end;color:var(--tenue)">Actualizado ${esc(fechaHora(t.actualizado))}</span>
          <h3>${esc(t.asunto)}</h3>
          ${progreso(t, true)}
          <div class="t-meta"><span>${esc(t.categoria)}</span><span>Creada ${esc(fecha(t.creado))}</span>${t.tecnico ? `<span>Atiende: ${esc(nombre(t.tecnico))}</span>` : ""}
            ${t.estado === "resuelto" ? '<span class="t-accion">Revisa la solución y confírmala</span>' : ult && ult.tipo === "respuesta" ? '<span style="color:var(--gob-azul);font-weight:700">Soporte te respondió</span>' : ""}</div>
        </article>`; }).join("") : `<div class="vacio lista"><h3>${S.tickets.length ? "No tienes solicitudes vigentes" : "Aún no tienes solicitudes"}</h3><p>Cuando necesites ayuda del Departamento de Informática, crea una con «Nueva solicitud».</p></div>`}</div>`;
    $$(".segmento button").forEach(b => b.addEventListener("click", () => { S.filtroMis = b.dataset.f; vistaMis(); }));
    $("#mis").addEventListener("click", e => { const c = e.target.closest("[data-id]"); if (c) location.hash = c.dataset.id; });
    $("#mis").addEventListener("keydown", e => { if (e.key === "Enter") { const c = e.target.closest("[data-id]"); if (c) location.hash = c.dataset.id; } });
  }

  /* ---------------- formulario de solicitud (ambos roles) ---------------- */
  function vistaNuevo(esAdmin) {
    const niv = C.niveles;
    $("#vista").innerHTML = `
      <div class="encabezado"><div><h1>${esAdmin ? "Registrar ticket" : "Nueva solicitud"}</h1>
        <p class="sub">${esAdmin ? "Ingresa la solicitud tal como llegó a soporte. El número y el plazo se asignan al guardar." : "Cuéntanos qué necesitas. Recibirás un número de ticket para seguir el avance."}</p></div></div>
      <div class="form-grid">
        <form class="tarjeta-form" id="form-nuevo" novalidate>
          ${esAdmin ? `<fieldset><legend>Solicitante</legend>
            <div class="campo"><label for="n-nombre">Nombre <span class="req">*</span></label><input type="text" id="n-nombre" autocomplete="off"></div>
            <div class="campo"><label for="n-unidad">Unidad / Gerencia <span class="req">*</span></label><input type="text" id="n-unidad" list="lista-unidades" autocomplete="off"></div>
            <div class="campo"><label for="n-correo">Correo institucional</label><input type="email" id="n-correo" autocomplete="off" placeholder="nombre.apellido@conaf.cl"><span class="ayuda">Si tiene cuenta, verá el ticket en su portal.</span></div>
            <div class="campo"><label for="n-anexo">Anexo / teléfono</label><input type="text" id="n-anexo" autocomplete="off"></div>
            <div class="campo"><label for="n-ubic">Ubicación</label><input type="text" id="n-ubic" autocomplete="off" placeholder="Piso, oficina o puesto"></div>
            <div class="campo"><label for="n-canal">Canal de ingreso</label><select id="n-canal">${opciones(C.canales.map(c => [c, c]), "Teléfono / anexo")}</select></div>
          </fieldset>` : ""}
          <fieldset><legend>${esAdmin ? "Solicitud" : "¿Qué necesitas?"}</legend>
            <div class="campo"><label for="n-tipo">Tipo</label><select id="n-tipo">${opciones([["Incidente", "Algo dejó de funcionar (incidente)"], ["Requerimiento", "Necesito algo nuevo o un cambio (requerimiento)"]])}</select></div>
            <div class="campo"><label for="n-cat">Categoría <span class="req">*</span></label><select id="n-cat"><option value="">Selecciona…</option>${opciones(C.categorias.map(c => [c, c]))}</select></div>
            <div class="campo doble"><label for="n-asunto">Asunto <span class="req">*</span></label><input type="text" id="n-asunto" maxlength="140" autocomplete="off" placeholder="Ej.: La impresora del piso 4 no imprime"></div>
            <div class="campo doble"><label for="n-desc">Descripción${esAdmin ? "" : ' <span class="req">*</span>'}</label><textarea id="n-desc" rows="5" placeholder="Qué ocurre, desde cuándo, qué equipo o sistema, mensaje de error si aparece"></textarea></div>
            <div class="campo"><label for="n-inv">N° de inventario del equipo</label><input type="text" id="n-inv" autocomplete="off"><span class="ayuda">Etiqueta adhesiva del equipo, si aplica.</span></div>
            ${esAdmin ? `<div class="campo"><label for="n-tec">Asignar a</label><select id="n-tec"><option value="">Sin asignar</option>${opciones(S.tecnicos.map(t => [t.id, t.id === S.yo.id ? t.nombre + " (yo)" : t.nombre]))}</select></div>`
              : `<div class="campo"><label for="n-anexo">Anexo de contacto</label><input type="text" id="n-anexo" autocomplete="off" value="${esc(S.yo.anexo || "")}"></div>
                 <div class="campo doble"><label for="n-ubic">Ubicación</label><input type="text" id="n-ubic" autocomplete="off" placeholder="Piso, oficina o puesto"></div>`}
          </fieldset>
          ${esAdmin ? `<fieldset><legend>Prioridad (impacto × urgencia)</legend>
            <div class="campo"><label for="n-imp">Impacto</label><select id="n-imp">${opciones(niv.map(n => [n.k, C.impactoAyuda[n.k]]), 3)}</select></div>
            <div class="campo"><label for="n-urg">Urgencia</label><select id="n-urg">${opciones(niv.map(n => [n.k, C.urgenciaAyuda[n.k]]), 2)}</select></div></fieldset>`
            : `<fieldset><legend>¿Qué tan urgente es?</legend><div class="urgencias">${niv.map(n => `<label><input type="radio" name="n-urg" value="${n.k}"${n.k === 2 ? " checked" : ""}> <span>${esc(C.urgenciaAyuda[n.k])}</span></label>`).join("")}</div></fieldset>`}
          <div class="pie-acciones"><span class="msg" id="n-msg" role="alert"></span>
            <a class="btn fantasma" href="#${esAdmin ? "bandeja" : "mis-solicitudes"}">Cancelar</a>
            <button type="submit" class="btn primario" id="n-guardar">${esAdmin ? "Crear ticket" : "Enviar solicitud"}</button></div>
        </form>
        <aside class="lateral">${esAdmin ? `<h3>Prioridad resultante</h3><p>Matriz ITIL de impacto y urgencia.</p>
            <div style="overflow-x:auto"><table class="matriz" id="matriz"></table></div><ul class="plazos" id="plazos"></ul>
            <p style="margin-top:10px">Plazo de resolución en horas corridas desde el registro.</p>`
          : `<h3>Antes de enviar</h3><p>Reinicia el equipo si el problema lo permite: resuelve muchos casos.</p>
            <p>Indica el N° de inventario y una captura del error si puedes describirla.</p>
            <p>Si tu solicitud afecta a toda tu unidad, menciónalo en la descripción: soporte ajustará la prioridad.</p>
            <ul class="plazos">${[1, 2, 3, 4].map(k => `<li>${chipPrio(k)}<span class="mono">${C.prioridades[k].h} h</span></li>`).join("")}</ul>
            <p style="margin-top:10px">Plazos de resolución comprometidos según prioridad.</p>`}</aside>
      </div>`;
    if (esAdmin) {
      const matriz = () => {
        const i = +$("#n-imp").value, u = +$("#n-urg").value, p = Datos.prioridadDe(i, u);
        $("#matriz").innerHTML = `<thead><tr><th>Impacto \\ Urgencia</th>${C.niveles.map(n => `<th>${n.l}</th>`).join("")}</tr></thead><tbody>` +
          C.niveles.map(im => `<tr><th>${im.l}</th>${C.niveles.map(ur => { const q = Datos.prioridadDe(im.k, ur.k); return `<td class="${C.prioridades[q].c}${im.k === i && ur.k === u ? " on" : ""}">P${q}</td>`; }).join("")}</tr>`).join("") + "</tbody>";
        $("#plazos").innerHTML = [1, 2, 3, 4].map(k => `<li${k === p ? ' style="font-weight:700"' : ""}>${chipPrio(k)}<span class="mono">${C.prioridades[k].h} h</span></li>`).join("");
      };
      $("#n-imp").addEventListener("change", matriz); $("#n-urg").addEventListener("change", matriz); matriz();
    }
    $("#form-nuevo").addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $("#n-msg"); msg.textContent = ""; msg.style.color = "var(--crit)";
      $$("[aria-invalid]", e.target).forEach(x => x.removeAttribute("aria-invalid"));
      const req = esAdmin ? [["#n-nombre", "nombre del solicitante"], ["#n-unidad", "unidad"], ["#n-cat", "categoría"], ["#n-asunto", "asunto"]] : [["#n-cat", "categoría"], ["#n-asunto", "asunto"], ["#n-desc", "descripción"]];
      const faltan = req.filter(([s]) => !$(s).value.trim());
      if (faltan.length) { faltan.forEach(([s]) => $(s).setAttribute("aria-invalid", "true")); msg.textContent = "Falta: " + faltan.map(f => f[1]).join(", ") + "."; $(faltan[0][0]).focus(); return; }
      const d = { tipo: $("#n-tipo").value, categoria: $("#n-cat").value, asunto: $("#n-asunto").value.trim(), descripcion: $("#n-desc").value.trim(), inventario: $("#n-inv").value.trim() };
      if (esAdmin) Object.assign(d, { canal: $("#n-canal").value, imp: $("#n-imp").value, urg: $("#n-urg").value, tecnico: $("#n-tec").value || null,
        solicitante: { nombre: $("#n-nombre").value.trim(), unidad: $("#n-unidad").value.trim(), correo: $("#n-correo").value.trim(), anexo: $("#n-anexo").value.trim(), ubic: $("#n-ubic").value.trim() } });
      else Object.assign(d, { urg: (e.target.querySelector("input[name=n-urg]:checked") || {}).value || 2, anexo: $("#n-anexo").value.trim(), ubic: $("#n-ubic").value.trim() });
      $("#n-guardar").disabled = true;
      try { const t = await Datos.crearTicket(d); await cargar(); aviso((esAdmin ? "Ticket " : "Solicitud ") + t.num + " creada"); S.vista = esAdmin ? "bandeja" : "mis-solicitudes"; location.hash = t.id; }
      catch (x) { msg.textContent = x.message || "No se pudo guardar. Intenta de nuevo."; }
      finally { const b = $("#n-guardar"); if (b) b.disabled = false; }
    });
  }

  /* ---------------- panel de detalle ---------------- */
  function cerrarPanel(silencio) {
    S.abierto = null; $("#capa-panel").innerHTML = ""; document.body.style.overflow = "";
    if (!silencio && location.hash.startsWith("#t-")) history.replaceState(null, "", location.pathname + "#" + S.vista);
  }
  function abrirPanel(id) {
    const t = S.tickets.find(x => x.id === id);
    if (!t) { cerrarPanel(); aviso("Ese ticket no existe o no tienes acceso."); return; }
    S.abierto = id; pintarPanel();
  }
  const etiquetaTipo = { nota: "Nota interna", respuesta: "Respuesta de soporte", solucion: "Solución", comentario: "Comentario del solicitante" };
  function pintarPanel() {
    const t = S.tickets.find(x => x.id === S.abierto); if (!t) return cerrarPanel();
    // adm: personal de informática (administrador o soporte); esAdmin: solo el administrador del sistema
    const adm = esStaff(), esAdmin = S.yo.rol === "admin", s = t.solicitante || {}, p = plazo(t);
    const borrador = $("#d-texto") ? $("#d-texto").value : "", tipoB = $("#d-tipo") ? $("#d-tipo").value : (adm ? "nota" : "");
    $("#capa-panel").innerHTML = `<div class="velo" data-cerrar></div>
      <aside class="panel" role="dialog" aria-modal="true" aria-labelledby="d-tit">
        <div class="panel-cab">
          <div class="panel-top"><span class="num">${esc(t.num)}</span>${t.ejemplo ? '<span class="etq-ej">EJEMPLO</span>' : ""}<button class="btn fantasma cerrar" type="button" data-cerrar>Cerrar ✕</button></div>
          <h2 id="d-tit">${esc(t.asunto)}</h2>
          <div class="chips">${chipEstado(t.estado)}${chipPrio(t.prio)}<span class="chip c-neu">${esc(t.tipo)}</span><span class="plazo ${p.k}">${esc(p.txt)}</span></div>
        </div>
        <div class="panel-cuerpo">
          ${adm ? `<div class="ctrl">
            <div class="campo"><label for="d-estado">Estado</label><select id="d-estado">${opciones(C.estados.map(e => [e.k, e.l]), t.estado)}</select></div>
            <div class="campo"><label for="d-cat">Categoría</label><select id="d-cat">${opciones(C.categorias.map(c => [c, c]), t.categoria)}</select></div>
            ${esAdmin ? `<div class="campo"><label for="d-tec">Asignar a profesional de soporte</label><select id="d-tec"><option value="">Sin asignar</option>${opciones(S.tecnicos.map(x => [x.id, x.nombre]).concat(t.tecnico && !S.tecnicos.some(x => x.id === t.tecnico) ? [[t.tecnico, nombre(t.tecnico) + " (sin rol de soporte)"]] : []), t.tecnico || "")}</select></div>
            <div class="campo"><label for="d-imp">Impacto / urgencia</label><div class="par"><select id="d-imp" aria-label="Impacto">${opciones(C.niveles.map(n => [n.k, "Imp. " + n.l]), t.imp)}</select><select id="d-urg" aria-label="Urgencia">${opciones(C.niveles.map(n => [n.k, "Urg. " + n.l]), t.urg)}</select></div></div>`
              : `<p class="nota-ctrl">La asignación y la prioridad las define el administrador del sistema.</p>`}
          </div>` : ""}
          ${adm ? "" : progreso(t)}
          ${!adm && t.estado === "resuelto" ? `<div class="confirmar"><p><b>Soporte marcó tu solicitud como resuelta.</b> ¿Quedó solucionado?</p>
            <textarea id="d-rechazo" rows="2" placeholder="Si no quedó resuelto, cuéntanos qué sigue pasando (opcional)"></textarea>
            <div class="pie-acciones" style="justify-content:flex-start"><button type="button" class="btn primario" id="d-conforme">Sí, cerrar la solicitud</button><button type="button" class="btn" id="d-reabrir">No, sigue el problema</button></div></div>` : ""}
          <div class="seccion"><h3>${adm ? "Solicitante" : "Datos de la solicitud"}</h3><dl class="datos">
            ${adm ? `<dt>Nombre</dt><dd>${esc(s.nombre || "—")}${t.solicitanteId ? "" : ' <span class="sin">(sin cuenta en el portal)</span>'}</dd><dt>Unidad</dt><dd>${esc(s.unidad || "—")}</dd>${s.correo ? `<dt>Correo</dt><dd>${esc(s.correo)}</dd>` : ""}` : ""}
            ${s.anexo ? `<dt>Anexo</dt><dd class="mono">${esc(s.anexo)}</dd>` : ""}${s.ubic ? `<dt>Ubicación</dt><dd>${esc(s.ubic)}</dd>` : ""}
            <dt>Categoría</dt><dd>${esc(t.categoria)}</dd>${adm ? `<dt>Canal</dt><dd>${esc(t.canal)}</dd>` : ""}
            ${t.inventario ? `<dt>Inventario</dt><dd class="mono">${esc(t.inventario)}</dd>` : ""}
            <dt>Registrada</dt><dd>${fechaHora(t.creado)}${adm && t.creadoPor && t.creadoPor !== t.solicitanteId ? " por " + esc(nombre(t.creadoPor)) : ""}</dd>
            <dt>Atiende</dt><dd>${t.tecnico ? esc(nombre(t.tecnico)) : '<span class="sin">Por asignar</span>'}</dd>
            <dt>Plazo</dt><dd>${fechaHora(t.vence)}</dd>
            ${t.resuelto ? `<dt>Resuelta</dt><dd>${fechaHora(t.resuelto)} · ${dur(Date.parse(t.resuelto) - Date.parse(t.creado))}</dd>` : ""}
          </dl></div>
          ${t.descripcion ? `<div class="seccion"><h3>Descripción</h3><div class="texto">${esc(t.descripcion)}</div></div>` : ""}
          ${t.solucion && (t.estado === "resuelto" || t.estado === "cerrado") ? `<div class="seccion"><h3>Solución</h3><div class="texto sol">${esc(t.solucion)}</div></div>` : ""}
          <div class="seccion"><h3>Seguimiento</h3><ol class="linea-tiempo">${(t.historial || []).slice().reverse().map(h => `<li class="t-${h.tipo}">
            <div class="meta"><span>${fechaHora(h.t)}</span>${h.by ? `<b>${esc(nombre(h.by) || "Usuario")}</b>` : ""}${etiquetaTipo[h.tipo] ? `<span class="${h.tipo === "nota" ? "tipo-nota" : ""}">${etiquetaTipo[h.tipo]}</span>` : ""}</div>
            <div class="${h.tipo === "sistema" ? "sis" : "txt"}">${esc(h.texto)}</div></li>`).join("")}</ol></div>
          ${t.estado === "cerrado" && !adm ? "" : `<div class="redactar">
            ${adm ? `<div class="fila-r"><select id="d-tipo" aria-label="Tipo de registro">${opciones([["nota", "Nota interna (no la ve el solicitante)"], ["respuesta", "Respuesta al solicitante"], ["solucion", "Solución (marca como resuelto)"]], tipoB)}</select>
              <select id="d-predef" aria-label="Respuesta predefinida"><option value="">Respuesta predefinida…</option>${opciones(C.respuestas.map((r, i) => [i, r.t]))}</select></div>` : `<label for="d-texto" style="font-size:.86rem;color:var(--tenue)">Agregar un comentario para soporte</label>`}
            <textarea id="d-texto" rows="3" placeholder="${adm ? "Avance, lo que se hizo o lo que se respondió" : "Información adicional, respuesta a una consulta de soporte…"}"></textarea>
            <div class="fila-r" style="justify-content:space-between"><div class="fila-r">
              ${adm && t.estado === "resuelto" ? '<button type="button" class="btn" data-estado="cerrado">Cerrar ticket</button>' : ""}
              ${adm && (t.estado === "resuelto" || t.estado === "cerrado") ? '<button type="button" class="btn" data-estado="curso">Reabrir</button>' : ""}</div>
              <button type="button" class="btn primario" id="d-agregar">${adm ? "Agregar al seguimiento" : "Enviar comentario"}</button></div>
            <span class="msg-error" id="d-msg"></span></div>`}
        </div>
      </aside>`;
    document.body.style.overflow = "hidden";
    if ($("#d-texto")) $("#d-texto").value = borrador;
    $$("[data-cerrar]", $("#capa-panel")).forEach(b => b.addEventListener("click", () => cerrarPanel()));
    const guardar = async (fn, okMsg) => { try { await fn(); await cargar(); pintar(); pintarPanel(); if (okMsg) aviso(okMsg); } catch (x) { aviso(x.message || "No se pudo guardar."); await cargar(); pintarPanel(); } };
    if (adm) {
      $("#d-estado").addEventListener("change", e => {
        const v = e.target.value;
        if (v === "resuelto" && !t.solucion) { e.target.value = t.estado; $("#d-tipo").value = "solucion"; $("#d-texto").focus(); $("#d-msg").textContent = "Para resolver, escribe la solución y agrégala al seguimiento."; return; }
        guardar(() => cambiarEstado(t, v));
      });
      if (esAdmin) {
        $("#d-tec").addEventListener("change", e => { const v = e.target.value || null; const c = { tecnico: v };
          if (v && t.estado === "nuevo") c.estado = "asignado"; if (!v && t.estado === "asignado") c.estado = "nuevo";
          guardar(() => Datos.actualizarTicket(t.id, c, { tipo: "sistema", texto: v ? "Asignado a " + nombre(v) : "Asignación retirada" }), v ? "Ticket asignado a " + nombre(v) : null); });
        const prio = () => { const imp = +$("#d-imp").value, urg = +$("#d-urg").value; guardar(() => Datos.actualizarTicket(t.id, { imp, urg }, { tipo: "sistema", texto: "Prioridad: " + C.prioridades[Datos.prioridadDe(imp, urg)].l })); };
        $("#d-imp").addEventListener("change", prio); $("#d-urg").addEventListener("change", prio);
      }
      $("#d-cat").addEventListener("change", e => guardar(() => Datos.actualizarTicket(t.id, { categoria: e.target.value }, { tipo: "sistema", texto: "Categoría: " + e.target.value })));
      $("#d-predef").addEventListener("change", e => { const r = C.respuestas[+e.target.value]; if (r) { const ta = $("#d-texto"); ta.value = ta.value ? ta.value + "\n" + r.x : r.x; ta.focus(); } e.target.value = ""; });
      $$("[data-estado]", $("#capa-panel")).forEach(b => b.addEventListener("click", () => guardar(() => cambiarEstado(t, b.dataset.estado))));
      $("#d-agregar").addEventListener("click", () => {
        const texto = $("#d-texto").value.trim(), tipo = $("#d-tipo").value;
        if (!texto) { $("#d-msg").textContent = "Escribe el texto antes de agregarlo."; $("#d-texto").focus(); return; }
        const c = {}, ent = [{ tipo, texto }];
        if (tipo === "solucion") Object.assign(c, { solucion: texto, estado: "resuelto", resuelto: new Date().toISOString() });
        else if (!esAdmin && t.estado === "asignado") { c.estado = "curso"; ent.push({ tipo: "sistema", texto: "Estado: En curso" }); }
        $("#d-texto").value = "";
        guardar(() => Datos.actualizarTicket(t.id, c, ent), tipo === "solucion" ? t.num + " resuelto" : "Seguimiento agregado");
      });
    } else {
      if ($("#d-agregar")) $("#d-agregar").addEventListener("click", () => {
        const texto = $("#d-texto").value.trim(); if (!texto) { $("#d-msg").textContent = "Escribe tu comentario."; return; }
        $("#d-texto").value = ""; guardar(() => Datos.comentar(t.id, texto), "Comentario enviado a soporte");
      });
      if ($("#d-conforme")) {
        $("#d-conforme").addEventListener("click", () => guardar(() => Datos.confirmarSolucion(t.id, true), "Solicitud cerrada. Gracias."));
        $("#d-reabrir").addEventListener("click", () => guardar(() => Datos.confirmarSolucion(t.id, false, $("#d-rechazo").value.trim()), "Solicitud reabierta"));
      }
    }
  }
  function cambiarEstado(t, v) {
    if (v === t.estado) return Promise.resolve();
    const c = { estado: v }; const ahora = new Date().toISOString();
    if (v === "cerrado") c.cerrado = ahora;
    if (ABIERTO.has(v) && (t.estado === "resuelto" || t.estado === "cerrado")) { c.resuelto = null; c.cerrado = null; }
    return Datos.actualizarTicket(t.id, c, { tipo: "sistema", texto: "Estado: " + EST[v].l + ((t.estado === "resuelto" || t.estado === "cerrado") && ABIERTO.has(v) ? " (reabierto)" : "") });
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape") { if ($("#capa-modal").innerHTML) $("#capa-modal").innerHTML = ""; else if (S.abierto) cerrarPanel(); } });

  /* ---------------- ADMIN: indicadores ---------------- */
  let periodo = 30;
  function vistaIndicadores() {
    $("#vista").innerHTML = `
      <div class="encabezado"><div><h1>Indicadores de soporte</h1><p class="sub">Calculados sobre todos los tickets registrados.</p></div>
        <div class="acciones"><select id="i-per" aria-label="Período" style="width:auto">${opciones([[30, "Últimos 30 días"], [90, "Últimos 90 días"], [365, "Últimos 12 meses"]], periodo)}</select>
          <button type="button" class="btn" id="i-csv">Exportar registro (CSV)</button></div></div>
      <div class="kpis" id="kpis"></div>
      <div class="graficos">
        <div class="graf ancho"><h3>Ingresados y resueltos por semana</h3><p class="sub">Últimas 10 semanas</p>
          <div class="leyenda"><span><i style="background:var(--verde)"></i>Ingresados</span><span><i style="background:color-mix(in srgb,var(--verde) 35%,transparent)"></i>Resueltos</span></div><div class="caja-svg" id="g-sem"></div></div>
        <div class="graf"><h3>Por categoría</h3><p class="sub">Abiertos ahora y resueltos en el período</p>
          <div class="leyenda"><span><i style="background:var(--verde)"></i>Abiertos</span><span><i style="background:color-mix(in srgb,var(--verde) 35%,transparent)"></i>Resueltos</span></div><div class="barras" id="g-cat"></div></div>
        <div class="graf"><h3>Carga por técnico</h3><p class="sub">Tickets abiertos asignados</p><div class="barras" id="g-tec"></div></div>
        <div class="graf"><h3>Por unidad solicitante</h3><p class="sub">Ingresados en el período</p><div class="barras" id="g-uni"></div></div>
        <div class="graf"><h3>Estado actual</h3><p class="sub">Tickets no cerrados</p><div class="barras" id="g-est"></div></div>
      </div>`;
    $("#i-per").addEventListener("change", e => { periodo = +e.target.value; vistaIndicadores(); });
    $("#i-csv").addEventListener("click", exportarCSV);
    const T = S.tickets, ahora = Date.now(), desde = ahora - periodo * 864e5;
    const abiertos = T.filter(t => ABIERTO.has(t.estado)), venc = abiertos.filter(t => plazo(t, ahora).k === "vencido");
    const res = T.filter(t => t.resuelto && Date.parse(t.resuelto) >= desde), ing = T.filter(t => Date.parse(t.creado) >= desde);
    const ok = res.filter(t => Date.parse(t.resuelto) <= Date.parse(t.vence));
    const prom = res.length ? res.reduce((s, t) => s + (Date.parse(t.resuelto) - Date.parse(t.creado)), 0) / res.length : null;
    $("#kpis").innerHTML = [
      { l: "Abiertos", v: abiertos.length, s: abiertos.filter(t => !t.tecnico).length + " sin asignar" },
      { l: "Plazo vencido", v: venc.length, s: "tickets abiertos", a: venc.length > 0 },
      { l: "Ingresados", v: ing.length, s: "en " + periodo + " días" },
      { l: "Cumplimiento de plazo", v: res.length ? Math.round(ok.length / res.length * 100) + "%" : "—", s: ok.length + " de " + res.length + " resueltos" },
      { l: "Tiempo medio de resolución", v: prom === null ? "—" : dur(prom), s: "desde el registro" }
    ].map(k => `<div class="kpi${k.a ? " alerta" : ""}"><div class="l">${k.l}</div><div class="v">${k.v}</div><div class="s">${k.s}</div></div>`).join("");
    // semanas
    const W = 10, sem = 7 * 864e5, ini = ahora - W * sem, a = Array(W).fill(0), b = Array(W).fill(0);
    T.forEach(t => { const c = Date.parse(t.creado); if (c >= ini) a[Math.min(W - 1, Math.floor((c - ini) / sem))]++; if (t.resuelto) { const r = Date.parse(t.resuelto); if (r >= ini) b[Math.min(W - 1, Math.floor((r - ini) / sem))]++; } });
    const mx = Math.max(1, ...a, ...b), paso = mx <= 5 ? 1 : mx <= 10 ? 2 : Math.ceil(mx / 5), tope = Math.ceil(mx / paso) * paso;
    const w = 760, h = 210, pl = 30, pb = 26, pt = 10, cw = (w - pl - 8) / W, y = v => pt + (h - pt - pb) * (1 - v / tope);
    const fdm = new Intl.DateTimeFormat("es-CL", { timeZone: TZ, day: "2-digit", month: "2-digit" });
    let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" style="min-width:520px;display:block" role="img" aria-label="Tickets ingresados y resueltos por semana">`;
    for (let v = 0; v <= tope; v += paso) svg += `<line x1="${pl}" x2="${w - 8}" y1="${y(v)}" y2="${y(v)}" stroke="var(--linea)"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    for (let i = 0; i < W; i++) { const x = pl + i * cw, bw = Math.min(16, cw * .3);
      svg += `<rect x="${x + cw / 2 - bw - 1}" y="${y(a[i])}" width="${bw}" height="${y(0) - y(a[i])}" fill="var(--verde)"><title>${a[i]} ingresados</title></rect>`;
      svg += `<rect x="${x + cw / 2 + 1}" y="${y(b[i])}" width="${bw}" height="${y(0) - y(b[i])}" fill="color-mix(in srgb,var(--verde) 35%,transparent)"><title>${b[i]} resueltos</title></rect>`;
      svg += `<text x="${x + cw / 2}" y="${h - 8}" text-anchor="middle">${fdm.format(new Date(ini + i * sem))}</text>`; }
    $("#g-sem").innerHTML = svg + "</svg>";
    barras($("#g-cat"), C.categorias.map(c => ({ l: c, a: abiertos.filter(t => t.categoria === c).length, b: res.filter(t => t.categoria === c).length })).filter(r => r.a + r.b).sort((x, z) => (z.a + z.b) - (x.a + x.b)), true);
    const tm = {}; abiertos.forEach(t => { const k = t.tecnico || "__sin"; tm[k] = (tm[k] || 0) + 1; });
    barras($("#g-tec"), Object.entries(tm).map(([k, n]) => ({ l: k === "__sin" ? "Sin asignar" : nombre(k), a: n })).sort((x, z) => z.a - x.a));
    const um = {}; ing.forEach(t => { const k = (t.solicitante && t.solicitante.unidad) || "Sin unidad"; um[k] = (um[k] || 0) + 1; });
    barras($("#g-uni"), Object.entries(um).map(([l, n]) => ({ l, a: n })).sort((x, z) => z.a - x.a).slice(0, 8));
    barras($("#g-est"), C.estados.filter(e => e.k !== "cerrado").map(e => ({ l: e.l, a: T.filter(t => t.estado === e.k).length })));
  }
  function barras(el, filas, dos) {
    const mx = Math.max(1, ...filas.map(r => r.a + (r.b || 0)));
    el.innerHTML = filas.length ? filas.map(r => `<div class="barra"><span class="et" title="${esc(r.l)}">${esc(r.l)}</span><span class="pista"><span class="rel" style="width:${r.a / mx * 100}%"></span>${dos ? `<span class="rel b2" style="width:${(r.b || 0) / mx * 100}%"></span>` : ""}</span><span class="val">${r.a + (r.b || 0)}</span></div>`).join("")
      : `<p class="sub" style="margin:0">Sin datos en el período.</p>`;
  }
  function exportarCSV() {
    const cols = ["N°", "Creado", "Tipo", "Categoría", "Asunto", "Solicitante", "Unidad", "Correo", "Anexo", "Canal", "Prioridad", "Estado", "Técnico", "Plazo", "Resuelto", "Cumple plazo", "Horas a resolución", "Solución", "Ejemplo"];
    const q = v => { const s = String(v ?? ""); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const dt = iso => iso ? new Date(iso).toLocaleString("es-CL", { timeZone: TZ }) : "";
    const filas = S.tickets.slice().sort((a, b) => a.creado.localeCompare(b.creado)).map(t => [t.num, dt(t.creado), t.tipo, t.categoria, t.asunto, t.solicitante && t.solicitante.nombre, t.solicitante && t.solicitante.unidad, t.solicitante && t.solicitante.correo, t.solicitante && t.solicitante.anexo, t.canal,
      C.prioridades[t.prio] && C.prioridades[t.prio].l, EST[t.estado] && EST[t.estado].l, nombre(t.tecnico), dt(t.vence), dt(t.resuelto),
      t.resuelto ? (Date.parse(t.resuelto) <= Date.parse(t.vence) ? "Sí" : "No") : "", t.resuelto ? ((Date.parse(t.resuelto) - Date.parse(t.creado)) / 36e5).toFixed(1).replace(".", ",") : "", t.solucion, t.ejemplo ? "Sí" : ""]);
    const csv = "﻿" + [cols, ...filas].map(r => r.map(q).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `tickets-ti-conaf-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    aviso("Registro exportado");
  }

  /* ---------------- ADMIN: usuarios ---------------- */
  async function vistaUsuarios() {
    const us = await Datos.listarUsuarios();
    const orden = { admin: 0, soporte: 1, funcionario: 2 }, activos = r => us.filter(u => u.rol === r && u.activo).length;
    us.sort((a, b) => orden[a.rol] - orden[b.rol] || a.nombre.localeCompare(b.nombre, "es"));
    const carga = {}; S.tickets.forEach(t => { if (t.tecnico && ABIERTO.has(t.estado)) carga[t.tecnico] = (carga[t.tecnico] || 0) + 1; });
    $("#vista").innerHTML = `
      <div class="encabezado"><div><h1>Usuarios</h1><p class="sub">${activos("admin")} ${activos("admin") === 1 ? "administrador" : "administradores"}, ${activos("soporte")} de soporte y ${activos("funcionario")} funcionarios activos. Los funcionarios también pueden crear su cuenta desde la portada.</p></div>
        <div class="acciones"><button type="button" class="btn primario" id="u-nuevo">+ Nuevo usuario</button></div></div>
      <div class="tabla-wrap"><table class="tabla">
        <thead><tr><th>Nombre</th><th>Correo</th><th>Unidad</th><th>Rol</th><th>Estado</th><th>Abiertos asignados</th><th></th></tr></thead>
        <tbody>${us.map(u => `<tr class="${u.activo ? "" : "inactivo"}">
          <td>${esc(u.nombre)}${u.id === S.yo.id ? " <span class='sin'>(tú)</span>" : ""}${u.demo ? '<span class="etq-ej">DEMO</span>' : ""}</td>
          <td>${esc(u.correo)}</td><td>${esc(u.unidad)}</td>
          <td><span class="chip ${{ admin: "rol-adm", soporte: "c-marca", funcionario: "c-neu" }[u.rol]}">${ROL[u.rol]}</span></td>
          <td>${u.activo ? "Activo" : "Desactivado"}</td>
          <td class="mono">${u.rol === "soporte" ? (carga[u.id] || 0) : "—"}</td>
          <td><button type="button" class="btn" data-editar="${esc(u.id)}">Editar</button></td></tr>`).join("")}</tbody></table></div>`;
    $("#u-nuevo").addEventListener("click", () => modalUsuario(null));
    $$("[data-editar]").forEach(b => b.addEventListener("click", () => modalUsuario(us.find(u => u.id === b.dataset.editar))));
  }

  /* ---------------- modales ---------------- */
  function modal(html, alAbrir, cls) {
    $("#capa-modal").innerHTML = `<div class="modal-velo"><div class="modal${cls ? " " + cls : ""}" role="dialog" aria-modal="true">${html}</div></div>`;
    const v = $(".modal-velo"); v.addEventListener("click", e => { if (e.target === v) $("#capa-modal").innerHTML = ""; });
    $$("[data-cerrar-modal]", v).forEach(b => b.addEventListener("click", () => $("#capa-modal").innerHTML = ""));
    alAbrir && alAbrir(v); const f = v.querySelector("input,select,textarea,button"); f && f.focus();
  }
  function confirmar(titulo, texto, boton, accion) {
    modal(`<h2>${esc(titulo)}</h2><p>${esc(texto)}</p><div class="pie-acciones"><button type="button" class="btn fantasma" data-cerrar-modal>Cancelar</button><button type="button" class="btn primario" id="m-ok">${esc(boton)}</button></div>`,
      v => $("#m-ok", v).addEventListener("click", async () => { $("#capa-modal").innerHTML = ""; await accion(); }));
  }
  function modalClave(obligatorio) {
    modal(`<h2>Cambiar contraseña</h2>${obligatorio ? '<p class="sub" style="margin:-6px 0 12px;color:var(--tenue)">Tu cuenta tiene una contraseña temporal. Define una nueva para continuar.</p>' : ""}
      <form id="m-form" novalidate>
        <div class="campo"><label for="m-actual">Contraseña actual</label><input type="password" id="m-actual" autocomplete="current-password"></div>
        <div class="campo"><label for="m-nueva">Nueva contraseña (mínimo 8 caracteres)</label><input type="password" id="m-nueva" autocomplete="new-password"></div>
        <div class="campo"><label for="m-rep">Repite la nueva contraseña</label><input type="password" id="m-rep" autocomplete="new-password"></div>
        <p class="msg-error" id="m-err"></p>
        <div class="pie-acciones">${obligatorio ? "" : '<button type="button" class="btn fantasma" data-cerrar-modal>Cancelar</button>'}<button type="submit" class="btn primario">Guardar contraseña</button></div></form>`,
      v => $("#m-form", v).addEventListener("submit", async e => {
        e.preventDefault(); const err = $("#m-err");
        if ($("#m-nueva").value !== $("#m-rep").value) { err.textContent = "Las contraseñas nuevas no coinciden."; return; }
        try { await Datos.cambiarClave($("#m-actual").value, $("#m-nueva").value); S.yo.debeCambiar = false; $("#capa-modal").innerHTML = ""; aviso("Contraseña actualizada"); }
        catch (x) { err.textContent = x.message; }
      }));
  }
  function modalUsuario(u) {
    const nuevo = !u; u = u || { nombre: "", correo: "", unidad: "", anexo: "", rol: "funcionario", activo: true };
    modal(`<h2>${nuevo ? "Nuevo usuario" : "Editar usuario"}</h2><form id="m-form" novalidate>
        <div class="campo"><label for="mu-nombre">Nombre y apellido</label><input type="text" id="mu-nombre" value="${esc(u.nombre)}"></div>
        <div class="campo"><label for="mu-correo">Correo institucional</label><input type="email" id="mu-correo" value="${esc(u.correo)}" placeholder="nombre.apellido@conaf.cl"></div>
        <div class="dos"><div class="campo"><label for="mu-unidad">Unidad</label><input type="text" id="mu-unidad" list="lista-unidades" value="${esc(u.unidad)}"></div>
          <div class="campo"><label for="mu-anexo">Anexo</label><input type="text" id="mu-anexo" value="${esc(u.anexo || "")}"></div></div>
        <div class="campo"><label for="mu-rol">Rol</label><select id="mu-rol">${opciones([["funcionario", "Funcionario/a: crea y sigue sus solicitudes"], ["soporte", "Soporte TI: atiende los tickets asignados a su perfil"], ["admin", "Administrador del sistema: asigna tickets y gestiona usuarios"]], u.rol)}</select></div>
        <div class="campo"><label for="mu-clave">${nuevo ? "Contraseña temporal" : "Nueva contraseña temporal (dejar vacío para no cambiar)"}</label><input type="text" id="mu-clave" autocomplete="off"><span class="ayuda">La persona deberá cambiarla al ingresar.</span></div>
        ${nuevo ? "" : `<label class="check"><input type="checkbox" id="mu-activo"${u.activo ? " checked" : ""}> Cuenta activa</label>`}
        <p class="msg-error" id="m-err"></p>
        <div class="pie-acciones"><button type="button" class="btn fantasma" data-cerrar-modal>Cancelar</button><button type="submit" class="btn primario">Guardar</button></div></form>`,
      v => $("#m-form", v).addEventListener("submit", async e => {
        e.preventDefault();
        try {
          await Datos.guardarUsuario({ id: u.id, nombre: $("#mu-nombre").value, correo: $("#mu-correo").value, unidad: $("#mu-unidad").value, anexo: $("#mu-anexo").value, rol: $("#mu-rol").value, clave: $("#mu-clave").value, activo: nuevo ? true : $("#mu-activo").checked });
          $("#capa-modal").innerHTML = ""; await cargar(); vistaUsuarios(); aviso("Usuario guardado");
        } catch (x) { $("#m-err").textContent = x.message; }
      }));
  }

  /* ---------------- sincronización y arranque ---------------- */
  Datos.alCambiar(async () => {
    const u = await Datos.usuarioActual();
    if (!u) { if (S.yo) { S.yo = null; mostrarPortada(); } return; }
    if (!S.yo || u.id !== S.yo.id) { S.yo = u; return entrar(true); }
    await cargar();
    const escribiendo = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!escribiendo) { pintar(); if (S.abierto) pintarPanel(); }
  });
  setInterval(() => { if (S.yo && S.vista === "bandeja") { pintarNav(); pintarLista(); } }, 60000);

  (async () => {
    try { S.yo = await Datos.usuarioActual(); }
    catch (e) { S.yo = null; }
    if (S.yo) entrar(false); else mostrarPortada();
  })();
})();
