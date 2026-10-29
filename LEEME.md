# Mesa de Ayuda TI · CONAF

Sistema de tickets de atención del Departamento de Informática, Oficina Central de la Corporación Nacional Forestal.

## Estructura

```
mesa-ayuda-ti/
├── index.html          Portada de acceso y aplicación (una sola página)
├── css/estilos.css     Estilos, paleta institucional y tipografía
├── js/datos.js         Capa de datos: usuarios, roles, sesión y tickets
├── js/app.js           Interfaz: portal de funcionarios y consola de soporte
└── assets/             Carpeta para los logos oficiales (ver assets/LEEME.txt)
```

## Cómo probarlo

Abra `index.html` en Chrome, Edge o Firefox. No requiere instalación.
Si el navegador restringe archivos locales, sírvalo con cualquier servidor web; por ejemplo, desde la carpeta: `python -m http.server 8080` y abra http://localhost:8080.

Cuentas de demostración:

| Rol | Correo | Contraseña |
|---|---|---|
| Funcionario/a | funcionario.demo@conaf.cl | Conaf2026! |
| Soporte TI | soporte.demo@conaf.cl | Soporte2026! |
| Soporte TI | tecnico.demo@conaf.cl | Soporte2026! |

El sistema se inicia con tickets de ejemplo, marcados como "EJ". Un usuario de soporte puede eliminarlos desde el aviso en la bandeja. Para volver al estado inicial, borre los datos del sitio en el navegador (claves `mati.*` en localStorage).

## Roles

**Funcionarios**
- Crean su cuenta desde la portada con su correo @conaf.cl, o la crea un administrador.
- Registran solicitudes indicando categoría, asunto, descripción, equipo y urgencia.
- Ven solo sus propias solicitudes, el estado, quién las atiende y el plazo.
- Ven las respuestas y la solución de soporte, pero no las notas internas.
- Agregan comentarios y, cuando soporte resuelve, confirman la solución (cierra el ticket) o la rechazan (lo reabre).

**Soporte TI (administración)**
- Bandeja con vistas: abiertos, asignados a mí, sin asignar, plazo vencido, en espera, resueltos sin confirmar, cerrados.
- Registran tickets recibidos por teléfono, correo o en forma presencial. Si el correo del solicitante tiene cuenta, el ticket aparece en su portal.
- Asignan técnico, cambian estado y categoría, y ajustan impacto y urgencia, lo que recalcula la prioridad y el plazo.
- Registran notas internas, respuestas al solicitante y la solución, con respuestas predefinidas.
- Indicadores: tickets abiertos, vencidos, cumplimiento de plazo, tiempo medio de resolución, tendencia semanal y distribución por categoría, técnico, unidad y estado. Exportación del registro a CSV (separado por punto y coma, para Excel).
- Usuarios: crear cuentas, asignar rol, desactivar y definir contraseñas temporales (se obliga a cambiarlas en el primer ingreso).

## Prioridad y plazos (matriz ITIL)

| Impacto \ Urgencia | Alta | Media | Baja |
|---|---|---|---|
| Alto | P1 | P2 | P3 |
| Medio | P2 | P3 | P4 |
| Bajo | P3 | P4 | P4 |

Plazos de resolución: P1 4 h, P2 8 h, P3 24 h y P4 72 h, en horas corridas desde el registro. Se configuran en `js/datos.js` (`CATALOGOS.prioridades`).

Cuando un funcionario registra una solicitud, el impacto queda en "Bajo" y la prioridad se calcula con la urgencia que indica. Soporte puede ajustar el impacto después.

## Configuración

En `js/datos.js`, objeto `CONFIG`:
- `contactoSoporte`: anexo, correo y horario que se muestran en la portada. Los campos vacíos no se muestran.
- `dominioCorreo`: dominio permitido para las cuentas (conaf.cl).
- `prefijoTicket`: prefijo del número de ticket (TI-2026-0001).

En `CATALOGOS` se definen las categorías, unidades, canales, plazos y respuestas predefinidas.

Los colores institucionales están en el bloque `:root` al inicio de `css/estilos.css`.

## Importante: paso a producción

Esta versión es un **prototipo funcional**. Guarda todo en el `localStorage` del navegador, por lo que:

1. **Los datos no se comparten**: cada computador o navegador tiene su propio registro.
2. **La autenticación no es segura**: las contraseñas se verifican en el navegador. No use contraseñas reales.

Para usarlo en la institución se necesita un servidor. Todas las funciones del objeto `Datos` en `js/datos.js` son asíncronas, por lo que se pueden reemplazar por llamadas `fetch()` a una API sin modificar `app.js`. Endpoints sugeridos:

| Función | Método y ruta |
|---|---|
| `ingresar`, `salir`, `usuarioActual` | `POST /api/sesion`, `DELETE /api/sesion`, `GET /api/sesion` |
| `registrar`, `cambiarClave` | `POST /api/usuarios/registro`, `PUT /api/usuarios/yo/clave` |
| `listarUsuarios`, `guardarUsuario` | `GET /api/usuarios`, `POST/PUT /api/usuarios/:id` (solo soporte) |
| `listarTickets` | `GET /api/tickets` (el servidor filtra por rol y oculta las notas internas a funcionarios) |
| `crearTicket` | `POST /api/tickets` (el número correlativo lo asigna el servidor) |
| `actualizarTicket` | `PATCH /api/tickets/:id` (solo soporte) |
| `comentar`, `confirmarSolucion` | `POST /api/tickets/:id/comentarios`, `POST /api/tickets/:id/confirmacion` |

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
