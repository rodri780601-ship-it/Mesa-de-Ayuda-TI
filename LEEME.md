# Mesa de Ayuda TI · CONAF

Sistema de tickets de atención del Departamento de Informática, Oficina Central de la Corporación Nacional Forestal.

## Estructura

```
mesa-ayuda-ti/
├── index.html          Portada de acceso y aplicación (una sola página)
├── css/estilos.css     Estilos, paleta institucional y tipografía
├── js/datos.js         Capa de datos: usuarios, roles, sesión y tickets
├── js/app.js           Interfaz: portal de funcionarios y consola de soporte
├── docs/               Manual de usuario en PDF (enlazado desde la portada)
└── assets/             Carpeta para los logos oficiales (ver assets/LEEME.txt)
```

## Cómo probarlo

Abra `index.html` en Chrome, Edge o Firefox. No requiere instalación.
Si el navegador restringe archivos locales, sírvalo con cualquier servidor web; por ejemplo, desde la carpeta: `python -m http.server 8080` y abra http://localhost:8080.

Cuentas de demostración:

| Rol | Correo | Contraseña |
|---|---|---|
| Autoridad (Director/a Ejecutivo/a) | autoridad.demo@conaf.cl | Conaf2026! |
| Directivo (Gerente/a) | directivo.demo@conaf.cl | Conaf2026! |
| Jefatura (Jefe/a de Departamento) | jefatura.demo@conaf.cl | Conaf2026! |
| Funcionario/a (Profesional) | funcionario.demo@conaf.cl | Conaf2026! |
| Usuario TI 1 | soporte.demo@conaf.cl | Soporte2026! |
| Usuario TI 2 | tecnico.demo@conaf.cl | Soporte2026! |

En la portada, los funcionarios ingresan en el recuadro "Para solicitar un ticket de atención, ingrese los siguientes datos". Los Usuarios TI ingresan con el botón **Usuario TI** de la esquina superior derecha.

El sistema se inicia con tickets de ejemplo, marcados como "EJ". Un Usuario TI puede eliminarlos desde el aviso en la casilla, y generar un nuevo lote con el botón **+ Generar ejemplos** de la Casilla de solicitudes (8 solicitudes ficticias de distintos niveles del organigrama, sin cuenta de solicitante asociada). Para volver al estado inicial, borre los datos del sitio en el navegador (claves `mati.*` en localStorage).

Si el navegador tiene datos de una versión anterior, al abrir el sistema las cuentas de administrador pasan a Usuario TI (la cuenta `admin.demo@conaf.cl` queda desactivada) y las cuentas sin cargo quedan como "Profesional". Los tickets antiguos conservan su prioridad hasta que un Usuario TI indique el cargo del solicitante.

## Perfiles

**Funcionarios**
- Crean su cuenta desde la portada con su correo @conaf.cl, indicando su cargo, o la crea un Usuario TI.
- Registran solicitudes indicando categoría, asunto, descripción, equipo y urgencia. La prioridad la define su cargo.
- Hacen seguimiento de sus solicitudes: ven el avance (Recibida, Asignada, En atención, Resuelta, Cerrada), quién las atiende, la prioridad, el plazo y el historial.
- Ven las respuestas y la solución, pero no las notas internas.
- Agregan comentarios y, cuando se resuelve, confirman la solución (cierra el ticket) o la rechazan (lo reabre).
- Pueden pedir la **eliminación** de una solicitud no cerrada, indicando obligatoriamente el motivo. Solo se elimina si un Usuario TI lo acepta; mientras tanto sigue vigente y el funcionario puede retirar el pedido.

**Usuario TI (profesionales del Departamento de Informática)**
No existe un administrador formal: todos los Usuarios TI tienen los mismos privilegios de administración, incluidos los que se creen después.
- **Casilla de solicitudes:** todas las solicitudes llegan a una sola casilla, ordenada de mayor a menor prioridad según el organigrama (ver abajo) y separada por nivel. Vistas: abiertas, sin asignar, asignadas a mí, plazo vencido, en espera, resueltas sin confirmar, cerradas y todas. También se puede ordenar por vencimiento o por fecha.
- Cada Usuario TI elige qué solicitud responder con **Asignarme** (en la fila de la casilla o en el detalle), y queda asignada a su perfil. Con **Reasignar** (en el detalle) la pasa a otro Usuario TI o la devuelve a la casilla sin asignar, con un motivo opcional que queda como nota interna; el seguimiento registra de quién a quién se reasignó. Si registra un avance en una solicitud sin asignar, queda asignada a su perfil.
- Cambian estado, categoría, cargo del solicitante y prioridad (ajuste manual cuando el caso lo justifica; queda registrado en el seguimiento).
- Registran notas internas, respuestas al solicitante y la solución, con respuestas predefinidas.
- Resuelven los pedidos de eliminación (vista **Eliminación solicitada**): **Aceptar y eliminar** o **No aceptar**, con una respuesta opcional al solicitante. Una solicitud eliminada no se borra del registro: sale de la casilla, de los indicadores, de la exportación y del portal del funcionario, y queda consultable en la vista **Eliminadas** con el motivo, la fecha y quién la aceptó.
- Registran tickets recibidos por teléfono, correo o en forma presencial. Si el correo del solicitante tiene cuenta, se completan sus datos y su cargo, y el ticket aparece en su portal.
- Indicadores: solicitudes abiertas, vencidas, cumplimiento de plazo, tiempo medio de resolución, tendencia semanal y distribución por categoría, Usuario TI, nivel del solicitante, unidad y estado. Exportación del registro a CSV (separado por punto y coma, para Excel).
- Usuarios: crear cuentas (incluidos nuevos Usuarios TI), definir cargo y perfil, desactivar y asignar contraseñas temporales (se obliga a cambiarlas en el primer ingreso). Nadie puede quitarse a sí mismo el perfil de Usuario TI ni desactivar su propia cuenta.

## Prioridad según el organigrama (agosto de 2026)

La prioridad de cada solicitud se asigna automáticamente según el cargo de quien solicita la asistencia:

| Nivel | Cargos | Prioridad | Plazo |
|---|---|---|---|
| Autoridad superior | Director/a Ejecutivo/a, Subdirector/a Ejecutivo/a | P1 Máxima | 4 h |
| Directivo | Fiscal, Jefe/a de Gabinete, Secretarios/as de Secretaría, Auditor/a Interno/a, Gerentes/as, Directores/as Regionales | P2 Alta | 8 h |
| Jefatura | Jefes/as de Departamento, Unidad, Programa, Oficina Provincial y del Centro de Semillas Genéticas y Entomología | P3 Media | 24 h |
| Funcionario/a | Profesional, Técnico/a, Administrativo/a, Auxiliar | P4 Normal | 72 h |

En la casilla, las solicitudes se ordenan por nivel (P1 primero). Dentro de un mismo nivel se ordenan según la posición del cargo en el organigrama, en el orden de la tabla (por ejemplo, Director/a antes que Subdirector/a, Fiscal antes que Gerente/a), y a igual cargo, la más antigua primero.

Los plazos son horas corridas desde el registro. Los cargos, su orden, los niveles y los plazos se configuran en `js/datos.js` (`CATALOGOS.cargos`, `CATALOGOS.niveles` y `CATALOGOS.prioridades`). La urgencia que indica el funcionario es informativa: orienta al equipo TI, que puede ajustar la prioridad a mano.

En la maqueta, el cargo lo declara cada funcionario al crear su cuenta y un Usuario TI puede corregirlo en **Usuarios**. En producción, el cargo debe venir de una fuente oficial (Gerencia de Desarrollo de las Personas o Active Directory) para que nadie eleve su propia prioridad.

## Configuración

En `js/datos.js`, objeto `CONFIG`:
- `contactoSoporte`: anexo, correo y horario que se muestran en la portada. Los campos vacíos no se muestran.
- `dominioCorreo`: dominio permitido para las cuentas (conaf.cl).
- `prefijoTicket`: prefijo del número de ticket (TI-2026-0001).

En `CATALOGOS` se definen las categorías, unidades, canales, plazos y respuestas predefinidas.

Los colores institucionales están en el bloque `:root` al inicio de `css/estilos.css`.

## Importante: paso a producción

Esta versión es un **prototipo funcional**. Muestra en la parte superior un aviso de maqueta para revisión: elimine el bloque `aviso-maqueta` de `index.html` al pasar a producción. Guarda todo en el `localStorage` del navegador, por lo que:

1. **Los datos no se comparten**: cada computador o navegador tiene su propio registro.
2. **La autenticación no es segura**: las contraseñas se verifican en el navegador. No use contraseñas reales.

Para usarlo en la institución se necesita un servidor. Todas las funciones del objeto `Datos` en `js/datos.js` son asíncronas, por lo que se pueden reemplazar por llamadas `fetch()` a una API sin modificar `app.js`. Endpoints sugeridos:

| Función | Método y ruta |
|---|---|
| `ingresar`, `salir`, `usuarioActual` | `POST /api/sesion`, `DELETE /api/sesion`, `GET /api/sesion` |
| `registrar`, `cambiarClave` | `POST /api/usuarios/registro`, `PUT /api/usuarios/yo/clave` |
| `listarUsuarios`, `guardarUsuario` | `GET /api/usuarios`, `POST/PUT /api/usuarios/:id` (solo Usuario TI) |
| `listarTickets` | `GET /api/tickets` (Usuario TI recibe la casilla completa; a funcionarios se les entregan solo sus solicitudes, sin notas internas) |
| `crearTicket` | `POST /api/tickets` (el número correlativo y la prioridad según el cargo registrado los asigna el servidor) |
| `actualizarTicket` | `PATCH /api/tickets/:id` (solo Usuario TI; "Asignarme" es un PATCH con `tecnico` igual al usuario en sesión) |
| `comentar`, `confirmarSolucion` | `POST /api/tickets/:id/comentarios`, `POST /api/tickets/:id/confirmacion` |
| `solicitarEliminacion`, `retirarEliminacion` | `POST /api/tickets/:id/eliminacion` (motivo obligatorio), `DELETE /api/tickets/:id/eliminacion` (solo el solicitante) |
| `resolverEliminacion` | `PUT /api/tickets/:id/eliminacion` (solo Usuario TI; aceptar marca el ticket como eliminado sin borrarlo) |

Recomendaciones:
- Autenticar contra el Active Directory institucional (LDAP o Azure AD / Entra ID) en lugar de contraseñas propias.
- Validar permisos en el servidor: el filtrado por rol en la interfaz no es una medida de seguridad.
- Enviar notificaciones por correo al crear, asignar y resolver tickets.

Si se prefiere no desarrollar el servidor, las plataformas open source **GLPI** u **osTicket** cubren estas funciones con ingreso de tickets por correo e integración con LDAP. Este prototipo sirve para acordar el flujo, las categorías y los plazos antes de configurarlas.

## Identidad visual

- Barra superior e inferior con el azul y el rojo del Gobierno de Chile, y verde CONAF como color principal.
- Tipografía Roboto Slab (títulos), Roboto (texto) y Roboto Mono (números de ticket), cargadas desde Google Fonts.
- Controles de tamaño de texto (A+, A−, A) y tema claro u oscuro, como en la Oficina Virtual de CONAF.
- Logos: ver `assets/LEEME.txt`. Mientras no estén los archivos, la cabecera muestra los nombres en texto.

Valide los colores y el uso de logos con la Secretaría de Comunicaciones según las normas gráficas vigentes de CONAF y del Gobierno de Chile.
