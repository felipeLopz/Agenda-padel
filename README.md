# Agenda de Pádel

Aplicación web interna para que un profesor de pádel gestione sus clases: alta/edición
de clases grupales e individuales, control de cobros, vista anual y semanal, **base de
alumnos con fichas** y búsqueda. Reemplaza al prototipo `agenda-padel.html` de un solo
archivo por una versión organizada en componentes, más fácil de mantener y ampliar.

## Alumnos (base de datos)

Los alumnos son entidades propias con ficha: nombre y apellido, foto (opcional, se sube
desde el celular y se guarda comprimida), teléfono, nivel (principiante / intermedio /
avanzado / competición), cumpleaños, notas privadas, etiquetas libres y estado
activo/archivado. Desde la pestaña **Alumnos** se listan, buscan y filtran (por nombre o
etiqueta, por nivel y por estado), se crean, editan y archivan.

- **Clases vinculadas**: al cargar una clase, el campo de alumno autocompleta contra las
  fichas existentes. Al elegir una, la clase queda vinculada por id; también se puede
  escribir un nombre suelto y crear su ficha al vuelo. El nombre se muestra **en vivo**:
  si se corrige en la ficha, se actualiza en todo el historial.
- **Historial por alumno**: dentro de la ficha se listan todas sus clases con su parte
  prorrateada (precio de la clase ÷ cantidad de alumnos) y un resumen de montos.
- **WhatsApp**: botón en la ficha que abre `wa.me` con el teléfono del alumno.

### Montos: total vs. parte prorrateada

- **Agenda del día** y **vista semanal** muestran el **precio total de la clase**.
- **Ficha del alumno** y **Buscar alumno** muestran la **parte prorrateada** de cada
  alumno (precio ÷ cantidad de participantes), para que los números coincidan al cobrarle
  a cada uno. En clases individuales ambas cifras son iguales.

## Estadísticas y reportes (pestaña Stats)

Sección de métricas que **lee los datos existentes** (no cambia nada), con selector de
período (un mes o todo el año) y comparación con el período anterior:

- Clases del período (con variación % vs el anterior), cobrado, pendiente.
- Ranking de asistencia (alumnos que más vienen), franjas horarias más/menos usadas.
- Grupales vs individuales (dona), ingresos por tipo, promedio de alumnos por grupal.
- Tasa de ocupación (franjas usadas / disponibles, descontando bloqueos).
- Ingresos y clases mes a mes (gráficos de línea).
- Deudores: se **enlaza** al ranking que ya vive en Caja (no se duplica).
- **Gráficos propios en SVG/CSS** (barras, línea, dona) con la paleta, sin librería.
- **Exportar** el reporte del período a **CSV** (abre en Excel) y **PDF** (reusa jsPDF).
- **Tasa de ocupación**: se calcula sobre los **días laborales** configurados (no todo el
  calendario). Disponibles = días laborales del período × franjas por día − bloqueos.

## Calidad de vida

- **Horario configurable**: en Configuración se eligen los **días laborales** y la **franja
  horaria** (inicio/fin). La agenda y la ocupación usan esa configuración. Salvaguarda: si
  achicás el horario, las horas que ya tengan clase se siguen mostrando (no se esconden).
- **Tema claro / oscuro**: interruptor (☀/🌙) en la barra superior; recuerda la elección.
  El oscuro ("Estadio Nocturno") sigue por defecto.
- **Buscador general**: un solo buscador encuentra **alumnos, clases y pagos** a la vez
  (por nombre, tema de clase, concepto o monto) y navega al resultado.
- **Deshacer**: tras una acción importante (borrar clase/serie/pago/pack/gasto, archivar
  alumno, mover clase) aparece un aviso **"Deshacer"** por unos segundos que restaura el
  estado previo (1 nivel).
- **Duplicar clase**: botón ⧉ en la agenda del día para copiar una clase a otro día/hora
  (alumnos, precio, descuentos, duración y contenido; arranca sin cobrar).
- **Recordatorio de respaldo**: si hace más de 7 días que no exportás, un banner te ofrece
  descargar una copia. (No guarda copias internas: empuja al export manual.)

## Contenido deportivo

- **Contenido de la clase**: temas trabajados como chips con sugerencias de pádel
  (saque, bandeja, víbora, pared de fondo…) o texto libre. Se ven en la agenda del día.
- **Objetivos por alumno** (en la ficha): con seguimiento, se marcan como *en progreso* o
  *cumplido*.
- **Notas de evolución** (en la ficha): registro con fecha para seguir el progreso.
- **Adjuntos** (clase y alumno): **fotos** comprimidas (como la foto de perfil, guardadas
  en localStorage) y **videos por enlace** (no se sube el archivo — pesa demasiado para
  localStorage —, se pega la URL de YouTube/Drive/etc.).

## Agenda avanzada (recurrencias, bloqueos, feriados, duraciones, estados)

- **Clases recurrentes**: al crear una clase se puede marcar "Repetir" (cada N semanas,
  hasta una fecha o una cantidad). Se generan clases reales, cada una con el mismo
  `seriesId`. Editar/borrar una clase de la serie no toca las demás; al editar hay un
  "Aplicar los cambios a toda la serie", y al borrar se ofrece borrar toda la serie.
- **Copiar una semana**: desde la vista semanal, "Copiar semana" lleva todas las clases a
  la semana que contenga la fecha elegida. Avisa cuántas franjas del destino ya tienen
  clase: **esas se omiten** (nunca se pisan). Las copias arrancan sin cobrar (los pagos no
  se copian) y en estado confirmada.
- **Bloquear horarios / días**: se puede bloquear un día completo o franjas puntuales (con
  motivo). Las franjas bloqueadas se ven distintas; es un **bloqueo blando**: avisa pero
  permite cargar igual ("Cargar igual").
- **Feriados argentinos**: se marcan automáticamente (calculados por año, incluidos los
  movibles de Pascua). Es solo una marca visual: se puede dar clase igual. No incluye los
  puentes turísticos ni los traslados por decreto.
- **Duración variable**: 30/45/60/90/120 min (default 60). La agenda del día muestra el
  rango horario ("10:00–11:30") y la **vista semanal** ubica cada clase como un bloque en su
  horario exacto, con **altura proporcional a la duración** (ver "Agenda de tiempo real").
- **Estados de clase**: confirmada, tentativa, cancelada o ausente, distinguidos
  visualmente. Una clase **cancelada no genera plata** (no cuenta deuda, cobro ni
  facturación); las demás cuentan como siempre.
- **Reprogramar (mover)**: "Mover" en la agenda del día (elegir día y hora) o **arrastrar**
  la clase en la vista semanal. Se conservan alumnos, precio, descuentos y pagos (los
  pagos atados a la clase se re-apuntan a la nueva franja).
- **Huecos libres**: en la vista semanal, "Ver huecos" resalta las franjas libres (sin
  clase ni bloqueo) para ubicar rápido un alumno nuevo.

## Plata: pagos, packs, gastos y recibos

El estado **cobrado/pendiente ya no es un toggle** por clase: se **deriva de los pagos**
registrados. Cada clase se calcula **Pagada / Parcial / Impaga** (verde / ámbar / rojo) a
partir de los pagos, la cobertura de packs y los descuentos. El "un toque = cobrado" se
mantiene: en la agenda del día, el botón **Cobrar** de una clase registra un pago del
saldo con el medio por defecto (y **Deshacer** lo revierte).

- **Deuda por alumno**: la ficha muestra el **saldo**; la pestaña **Caja** tiene el
  **ranking de deudores** y el **total adeudado**.
- **Pagos parciales**: se registra cualquier monto; el saldo baja. Los pagos con
  `classRef` (cobro de una clase) saldan esa clase; los pagos libres (desde la ficha) se
  aplican **FIFO**, a la deuda más vieja primero.
- **Medios de pago**: configurables en Configuración (efectivo, transferencia, Mercado
  Pago, y los que se agreguen). En Caja se ve **cuánto entró por cada medio**.
- **Packs (bonos prepagos)**: se compran por adelantado (N clases). Cada clase que toma el
  alumno **consume 1 crédito automáticamente** (de la más vieja a la más nueva) y esa
  clase no se vuelve a cobrar. La ficha muestra las **clases restantes** y avisa cuando el
  pack está **por agotarse** o **agotado**.
- **Descuentos** (dos formas que conviven):
  - **Fijo de ficha**: permanente en el alumno (% o monto), aplica a todas sus clases.
  - **Puntual de clase**: una sola vez, en el participante de una clase concreta.
  - **Combinación**: se encadenan, **primero el fijo, después el puntual** (el puntual se
    calcula sobre el precio ya descontado por el fijo). La agenda muestra de dónde viene
    cada uno (`−X% ficha`, `−X% puntual`).
- **Recibos PDF**: cada pago genera un recibo `.pdf` (con jsPDF) descargable/compartible.
- **Gastos y ganancia neta**: se cargan gastos (alquiler, pelotas…); Caja muestra la
  **ganancia neta** (ingresos cobrados − gastos) por mes y por año.
- **Cierre de caja del día**: cuánto entró, por qué medios y lo pendiente; de hoy o de un
  día pasado.
- **Proyección del mes**: según lo agendado (cobrado + pendiente), cuánto se va a facturar.

## Stack

- [Vite](https://vitejs.dev/) + [React 19](https://react.dev/) + TypeScript.
- Sin backend ni base de datos: los datos viven en `localStorage` del navegador.
- Una sola dependencia funcional: [jsPDF](https://github.com/parallax/jsPDF) para los
  recibos (se carga con `import()` dinámico, así no pesa en la carga inicial). Sin
  librerías de UI.

## Estructura del proyecto

```
src/
  types.ts              Tipos de datos (v3, con pagos/packs/gastos/medios/descuentos)
  lib/
    money.ts            Cerebro financiero: estado derivado, saldos, packs, totales, caja
    migrate.ts          Migración en cadena v1 → v2 → v3
    students.ts         Helpers de alumnos (nombre en vivo, autocompletado, etc.)
    discount.ts         Aplicación y encadenado de descuentos
    receipt.ts          Recibos PDF (jsPDF, import dinámico)
    date / format / pricing / image / id / constants / storage
  state/                Estado global (Context + reducer), ledger memoizado, persistencia
  components/           Header, vistas (anual/semanal/alumnos/caja) y todos los modales
  styles/global.css     Tema "Estadio Nocturno" (azules/negro/naranja)
  App.tsx               Orquesta qué vista y qué modal está abierto
  main.tsx              Punto de entrada
```

El catálogo de precios y las clases NO se editan a mano en el código (a diferencia del
otro proyecto de este mismo cliente): todo se administra desde la propia interfaz y se
guarda en el navegador.

## Cómo correrlo en desarrollo

Requiere [Node.js](https://nodejs.org/) instalado.

```bash
npm install
npm run dev
```

Abrir la URL que muestra la terminal (por defecto **http://localhost:5173**).

## Cómo generar el build de producción

```bash
npm run build
```

Esto valida los tipos de TypeScript y genera una carpeta `dist/` con archivos
estáticos (HTML/CSS/JS) listos para publicar en cualquier hosting. Para previsualizar
ese build localmente:

```bash
npm run preview
```

## Cómo desplegarlo

`dist/` es un sitio 100% estático, así que cualquiera de estas opciones sirve:

- **Vercel / Netlify**: conectar el repo (o arrastrar la carpeta `dist/`), build command
  `npm run build`, output directory `dist`. Deploy automático en cada push, igual que el
  otro proyecto de este cliente.
- **Cualquier hosting estático** (GitHub Pages, un servidor propio, etc.): subir el
  contenido de `dist/` tal cual.

No hace falta servidor con Node corriendo en producción: es solo HTML/CSS/JS.

## Datos: persistencia y respaldo

- Los datos (precios + clases + alumnos) se guardan automáticamente en `localStorage`
  del navegador, bajo la clave `agenda-padel:data`. Si se borra el caché del navegador o
  se cambia de dispositivo, se pierden — por eso conviene exportar seguido.
- **Exportar**: botón "⬇ Exportar JSON" en Configuración. Descarga un archivo en el
  formato v2 (incluye `students`), útil como respaldo y para pasar datos entre
  dispositivos.
- **Importar**: botón "⬆ Importar JSON" en Configuración. Acepta tanto el formato v2 como
  los archivos viejos v1 del prototipo. Importar **reemplaza** todos los datos actuales
  del dispositivo — la app pide confirmación antes de hacerlo.

### Formato del archivo (v10)

> Desde v10 (agenda de tiempo real), la **clave de cada clase dentro del día** es la hora de
> inicio **en minutos** desde la medianoche (9:00 = `"540"`, 9:30 = `"570"`), y los pagos
> referencian la clase por `{ day, start }` (antes `{ day, hour }`). El resto es igual.

```jsonc
{
  "version": 10,
  "prices": { "grupal": 4000, "indiv": 12000 },
  "students": {
    "<id>": {
      "id": "<id>",
      "firstName": "Ana",
      "lastName": "Pérez",
      "photo": "data:image/jpeg;base64,...",   // opcional
      "phone": "2613900039",                    // opcional
      "level": "principiante",                  // principiante | intermedio | avanzado | competicion
      "birthday": "2000-05-14",                 // opcional, "YYYY-MM-DD"
      "notes": "mejorar el revés",              // opcional
      "tags": ["zurdo", "paga puntual"],
      "discount": { "type": "percent", "value": 20 }, // opcional: descuento fijo (percent|fixed)
      "objectives": [                           // v5, opcional: objetivos con seguimiento
        { "id": "<id>", "text": "Mejorar la bandeja", "status": "progreso", "createdAt": "..." }
      ],
      "progressNotes": [                        // v5, opcional: notas de evolución
        { "id": "<id>", "date": "2026-07-11", "text": "Mejoró la salida de pared" }
      ],
      "attachments": [                          // v5, opcional: fotos/videos del alumno
        { "id": "<id>", "kind": "foto", "dataUrl": "data:image/jpeg;base64,...", "createdAt": "..." },
        { "id": "<id>", "kind": "video", "url": "https://youtu.be/...", "createdAt": "..." }
      ],
      "active": true,
      "createdAt": "2026-07-11T00:00:00.000Z"
    }
  },
  "days": {
    "2026-6-15": {                              // clave "AÑO-MES-DIA", mes desde 0
      "570": {                                  // clave = inicio en MINUTOS (570 = 9:30) — v10
        "type": "grupal",                       // grupal | indiv
        "participants": [
          { "studentId": "<id>", "name": "Ana Pérez",
            "discount": { "type": "fixed", "value": 1000 } }, // opcional: descuento puntual
          { "studentId": null, "name": "Invitado" }            // nombre suelto sin ficha
        ],
        "price": 8000,                          // precio de lista de la clase (sin `paid`)
        "duration": 90,                         // v4, opcional (minutos; ausente = 60)
        "state": "confirmada",                  // v4, opcional: confirmada|tentativa|cancelada|ausente
        "seriesId": "<id>",                     // v4, opcional: pertenencia a una serie recurrente
        "content": ["Saque", "Bandeja"],        // v5, opcional: temas trabajados
        "attachments": [                        // v5, opcional: fotos/videos de la clase
          { "id": "<id>", "kind": "video", "url": "https://youtu.be/...", "createdAt": "..." }
        ]
      }
    }
  },
  "blocks": {                                   // v4: bloqueos de disponibilidad por día
    "2026-6-21": { "fullDay": true, "reason": "Vacaciones" },   // día completo
    "2026-6-22": { "hours": [7, 8], "reason": "Turno médico" }  // o franjas puntuales
  },
  "payments": {                                 // libro de pagos (plata que entró)
    "<id>": {
      "id": "<id>", "studentId": "<id>",
      "date": "2026-07-15",                     // "YYYY-MM-DD"
      "amount": 4000, "methodId": "efectivo",
      "concept": "Cobro de clase",
      "kind": "clase",                          // clase | pack | ajuste
      "classRef": { "day": "2026-6-15", "start": 570 }, // opcional (cobro de una clase; start en minutos)
      "packId": "<id>"                          // opcional (si es compra de pack)
    }
  },
  "packs": {                                    // bonos prepagos
    "<id>": { "id": "<id>", "studentId": "<id>", "totalClasses": 8,
              "price": 32000, "purchaseDate": "2026-07-01", "methodId": "transferencia" }
  },
  "expenses": {                                 // gastos del profesor
    "<id>": { "id": "<id>", "date": "2026-07-01", "concept": "Alquiler cancha", "amount": 15000 }
  },
  "paymentMethods": [                           // medios configurables
    { "id": "efectivo", "label": "Efectivo" },
    { "id": "transferencia", "label": "Transferencia" },
    { "id": "mercadopago", "label": "Mercado Pago" }
  ],
  "settings": {
    "defaultMethodId": "efectivo",
    "packLowThreshold": 2,
    "workDays": [1, 2, 3, 4, 5],   // v6: días laborales (0=domingo … 6=sábado); default L-V
    "startHour": 7,                // v6: inicio de la jornada
    "endHour": 16,                 // v6: fin inclusive
    "theme": "dark",               // v6: 'dark' | 'light'
    "lastExportAt": "2026-07-11T00:00:00.000Z" // v6: para el recordatorio de respaldo
  }
}
```

El PIN/bloqueo **no** se implementó (se descartó); no hay datos de PIN en el formato.

Las "clases restantes" de un pack, los feriados y el estado cobrado/pendiente de cada
clase **no se guardan**: se derivan (ver `src/lib/money.ts` y `src/lib/holidays.ts`).

### Compatibilidad con los formatos viejos (v1 → v2 → v3 → v4 → v5 → v6 → … → v10)

Al **cargar** el localStorage o **importar** un archivo, la app migra en cadena y sin
perder datos (`src/lib/migrate.ts`, idempotente):

- **v1** (clases con `names: string[]`, sin alumnos) → crea una ficha por nombre distinto
  (deduplicando sin distinguir mayúsculas/espacios) y vincula las clases.
- **v2** (clases con `paid`) → por cada clase marcada cobrada, **sintetiza un pago** por
  participante (monto = su parte, fecha = la de la clase, medio = Efectivo) y quita `paid`.
  Así los totales de cobrado/pendiente/facturación quedan **idénticos** a v2, y las clases
  antes cobradas se ven "Pagadas". Agrega los medios de pago y los libros (pagos/packs/
  gastos) vacíos.
- **v3 → v4** → agrega `blocks: {}` y conserva `duration`/`state`/`seriesId` si vienen. No
  toca nada más: las clases sin esos campos usan los defaults (60 min, confirmada), así los
  totales y toda la lógica de plata quedan **idénticos** a v3.
- **v4 → v5** → conserva los campos nuevos si vienen (contenido y adjuntos de clase;
  objetivos, notas de evolución y adjuntos del alumno). No agrega ni cambia nada más: los
  datos v4 quedan **idénticos** (los campos nuevos son opcionales y no afectan la plata ni
  las vistas). Las estadísticas solo **leen** datos ya existentes.
- **v5 → v6** → completa en `settings` el horario y los días laborales (default lunes a
  viernes, 7–16), el tema (oscuro) y `lastExportAt`. No toca clases, alumnos ni plata: los
  datos v5 quedan **idénticos**. El cambio de la **ocupación** (ahora sobre días laborales)
  es intencional, no afecta totales ni la lógica de plata.
- **v6 → v7/v8/v9** → categoría de pádel (1ra–8va) + nivel del alumno, precio propio por
  alumno en grupal, y recordatorio por turno. Campos opcionales: los datos viejos quedan
  **idénticos** (la plata no cambia).
- **v9 → v10** (agenda de tiempo real) → la clave de cada clase pasa de la **hora entera**
  (7..16) a los **minutos** de inicio (se multiplica por 60: 9 → 540), y los `classRef` de
  los pagos de `{ day, hour }` a `{ day, start }`. La conversión corre **una sola vez**,
  gateada por la versión del origen (no se re-multiplica al recargar). Los importes, pagos,
  packs, estados y totales quedan **idénticos**: solo cambia cómo se ubica cada clase en el
  tiempo. Idempotente y sin pérdida de datos.

## Decisiones tomadas

- **React + TypeScript en vez de vanilla JS**: se eligió por pedido explícito para
  facilitar el mantenimiento de las múltiples vistas y modales que interactúan entre sí
  (vista anual, semanal, agenda del día, formulario de clase, buscador, configuración),
  a costa de un paso de build (`npm run build`) que sigue siendo tan simple de desplegar
  como el HTML suelto original.
- **Semana de lunes a domingo** en la vista semanal (convención habitual en Argentina).
- **El precio sugerido no sobreescribe un importe ya editado a mano**: al tocar el campo
  "Importe" una vez, deja de recalcularse aunque se agreguen o quiten alumnos.
- **Los precios de Configuración son solo el valor por defecto** para clases nuevas; no
  modifican el importe de clases ya cargadas.
- **Nombre "en vivo"**: las clases guardan el `studentId`; el nombre que se muestra sale
  siempre de la ficha actual, así corregir un nombre se refleja en todo el historial. Los
  nombres sueltos (sin ficha) se guardan como texto.
- **Los alumnos se archivan, no se borran** (`active: false`), para no romper el historial
  de clases pasadas. Los archivados no aparecen en el autocompletado de clases nuevas.
- **Las fotos se comprimen** (máx. 512 px, JPEG) antes de guardarse, porque `localStorage`
  tiene poca cuota y se almacenan dentro del JSON.
- **El estado de cobro se deriva de los pagos** (una sola fuente de verdad), en vez de un
  toggle manual. Toda la lógica de plata vive en `src/lib/money.ts` y se recalcula en un
  memo del contexto ante cada cambio.
- **Devengado vs. percibido**: los totales por período (barra anual, pie de mes) son
  *devengados* (según las clases del período); Caja (ingresos por medio, cierre, ganancia
  neta) es *percibido* (según la fecha real de los pagos). Coinciden para datos migrados.
- **Solo se rastrea la plata de alumnos con ficha**: un nombre suelto (`studentId: null`)
  cuenta para el precio de la clase pero no genera deuda ni cobro.
- **Los packs se consumen FIFO** (clase más vieja primero, desde la fecha de compra) y el
  monto se cobra al comprarlos (prepago); esas clases no se vuelven a cobrar.
- **Agenda de tiempo real (v10)**: la clase deja de estar atada a la hora en punto. Empieza
  a **cualquier horario** (9:30, 10:15, …) y ocupa su **rango real** [inicio, inicio+duración).
  La clave de cada clase dentro del día pasó de la hora entera a los **minutos de inicio**
  desde la medianoche (9:00 = "540"). La **vista semanal** es un calendario continuo (bloques
  posicionados por hora, altura proporcional a la duración; tocar un hueco crea, arrastrar
  reprograma). **No se permiten solapamientos**: al crear/mover/duplicar/copiar/repetir a un
  rango ocupado se avisa y se propone el próximo horario libre. El horario y los días
  laborales configurables se mantienen. Migración v9→v10 automática, sin perder nada.
- **Las recurrencias se materializan**: generan clases reales con `seriesId` (no una regla
  que se evalúa después). Más simple y coherente con el modelo por franja.
- **Cancelada = sin plata; tentativa/ausente = cuentan**: solo la clase cancelada se
  excluye de deuda, cobro y facturación. La "ausente" (no vino) se cobra igual.
- **Bloqueos blandos**: bloquear un día/franja avisa pero permite cargar clase igual.
- **Feriados**: solo los nacionales calculables (fijos + movibles de Pascua); no los
  puentes turísticos ni los traslados por decreto. Es una marca, no un bloqueo.
- **Gráficos propios sin librería** (SVG/CSS), para no sumar dependencias ni peso.
- **"Ingresos" en Stats = cobrado sobre las clases del período** (mismo criterio que la
  barra anual), no lo percibido por fecha de pago; así coincide con lo que ya se ve.
- **Ocupación = franjas usadas / disponibles**, con disponibles = **días laborales** del
  período × franjas por día − bloqueos (v6). Los días laborales y el horario son
  configurables en Configuración (default lunes a viernes, 7–16).
- **Videos por enlace, no por archivo**: subir un video reventaría la cuota de
  localStorage; se guarda la URL. Las fotos sí se guardan comprimidas.
- **El contenido/adjuntos de una clase son por-clase** (no se propagan al editar toda una
  serie recurrente).
- **Tema oscuro por defecto** (el actual "Estadio Nocturno"); el claro es la alternativa.
  La preferencia se guarda en `settings.theme` y se exporta con el resto.
- **Deshacer de 1 nivel**: guarda un único snapshot de la última acción importante; hacer
  otra acción reemplaza el snapshot anterior. Restaurar aplica `LOAD` del snapshot completo.
- **Sin PIN/bloqueo** (descartado por pedido): no hay pantalla de bloqueo ni datos de PIN.
- **Backup automático = recordatorio**, sin copias internas: un banner empuja al export
  manual si hace >7 días. Es la opción más simple y no ocupa cuota de localStorage.
