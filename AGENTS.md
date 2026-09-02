# MVD CAPEX ERP — AGENTS.md

Aplica a todo el repositorio. Leer este archivo una vez y luego abrir únicamente los archivos relacionados con la tarea. Mantener aquí arquitectura, contratos y reglas de negocio durables; no documentar detalles triviales de implementación.

## Inicio obligatorio y navegación eficiente

Al comenzar cada tarea en este repositorio:

1. Leer este `AGENTS.md` una sola vez.
2. Leer `docs/REPOSITORY_MAP.md` antes de buscar o abrir código.
3. Usar el mapa para limitar la inspección a la ruta, componente, librería y endpoint del flujo solicitado.
4. Abrir primero la página y el componente principal del flujo; después localizar con `rg` únicamente sus llamadas API, tipos y reglas importadas.
5. No recorrer todo `src`, `.next`, `node_modules`, archivos generados ni el lockfile salvo que la tarea sea transversal o cambie dependencias.

Si una modificación cambia rutas, ownership de módulos, entrypoints, endpoints principales o comandos de verificación, actualizar también `docs/REPOSITORY_MAP.md`. Las reglas de negocio durables continúan documentándose en este archivo.

## Stack y reglas generales

- Next.js 16.1 App Router + React 19 + TypeScript estricto.
- `src/app`: rutas; `src/components`: componentes; `src/lib`: lógica/tipos/validación.
- Frontend consume backend externo mediante `src/lib/apiClient.ts` usando `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_API_KEY` y `x-api-key`.
- UI compartida: `Button`, `Input`, `Select`, `Table`; estilos globales en `src/app/globals.css`.
- Antes de modificar un flujo revisar siempre componente + endpoint actual. No inventar rutas, payloads, claves, fechas ni semántica de borrado.
- Endpoints que aceptan `rows` suelen enviarse en lotes de hasta 100 filas.
- Mantener original y draft separados en tablas editables. Verde = válida/modificada; rojo = inválida.
- En tablas grandes usar `FastCellInput` para evitar pérdida de escritura por rerenders.
- Los filtros estilo Excel usan popup con `createPortal` + `position: fixed`, deben mantenerse dentro del viewport y cerrarse al click fuera.
- En filtros Excel numéricos, los valores disponibles se normalizan a 2 decimales antes de agruparlos: valores distintos que redondean igual pertenecen a una sola opción.
- Preservar cambios ajenos del worktree.
- Verificación de cambios: `npx eslint <archivos>` y `npm run build`.
- No exponer contraseñas, API keys ni secretos.

## Auth y scopes

Login general mediante `/api/auth/login`, cookie `mvd_auth`, HMAC `AUTH_SECRET`, duración 12 h. `middleware.ts` protege por scopes.

- CAPEX: `capex` → `/projects`
- Planta: `planta` → `/planta/guardia`
- Refinería: `refinery` → `/refinery/campaign`
- Trazabilidad: `traceability` → `/traceability/entries`
- Compliance: `compliance` → `/compliance/downloads`
- Logística: `logistics` → `/logistics/downloads`
- Sostenibilidad: `sustainability` → `/sustainability/igafom`
- Activos Fijos: `fixassets` → `/fixassets/new`
- Flota: `fleet_mgmt|fleet_units` → `/fleet/mgmt`
- TI: `ti` → `/ti`

El portal `/` valida primero acceso corporativo mediante `/api/access-check`.

## Otros módulos

### CAPEX
Rutas principales `/projects`, `/budget`, `/forecast`, `/progress`, `/reports`.
Mantener contratos existentes para proyectos/WBS, Budget ORIG/SOC, Forecast, EV/Actual y mapping CAPEX.

### Planta
Componentes en `src/components/planta`. Relaciones basadas en `shift_id`.
Incluye Guardia, Datos de Guardia, Leyes, Carbones y Reportes. Revisar payload específico de cada panel antes de cambiar cálculos.

### Refinería
Campañas, consumos, entradas, producción, stock, mapping y ML.
Endpoints bajo `/api/refineria/*`. Preservar relaciones campaña → consumo → stock/producción.

### Trazabilidad
Rutas `upload`, `entries`, `status`, `conta`.
Las tablas tienen filtros, edición, Excel y claves propias.
`TraceabilityEntryForm` calcula TMS automáticamente si corresponde y tolera diferencia USD máxima absoluta de `0.02`.
Guardar envía solo filas modificadas.

### Compliance
Ruta `/compliance/downloads`. Mantener exactamente las columnas esperadas por los formatos Excel/PDF y contratos `/api/compliance/*`.

### Logística / Flota
Logística usa `/api/logistics/*`.
Flota separa Gestión y Unidades por scopes. No agregar campos obligatorios que el flujo actual permita completar independientemente.

### Sostenibilidad
IGAFOM y padrón de proveedores. Preservar claves y validaciones existentes.

### TI
Página principal `src/app/ti/page.tsx`, tickets, feedback, copiloto IA y búsqueda técnica. Los proxies pueden degradar a respuestas vacías/dummy sin romper UI.

El portafolio de eficiencia se presenta íntegramente en inglés y francés. Para la iniciativa ejecutada `Fixed Assets & Depreciation Platform`:

- Fuente: `GET /api/dti/actfij-fin`; agrupar filas por mes de `document_date`.
- Proceso anterior: 20 min de preparación por mes + 10 min por fila; proceso actual: 2 min por mes sin depender del número de filas.
- La referencia laboral editable inicia en USD 10/MH y el resumen usa el promedio de filas de los meses activos.
- El sistema anterior costaba USD 3,827.54 al año y fue pagado hasta 2025. En 2026 se reconoce el importe anual completo como costo evitado, equivalente a USD 318.96/mes solo para combinar run-rates; no se registra como gasto real en las filas históricas mensuales de 2026.
- La tabla mensual conserva su fila de totales para volumen, MH y ahorro laboral; el costo evitado del sistema se presenta por separado y se incluye en el ahorro anual total.

---

# Activos Fijos y Depreciación

Scope `fixassets`.

Rutas:
- `/fixassets/new`
- `/fixassets/catalogue`
- `/fixassets/depreciation`
- `/fixassets/export`

Componentes:
- `FixAssetsNew.tsx`
- `FixAssetsCat.tsx`
- `FixAssetsDepr.tsx`
- `FixAssetsExport.tsx`
- `FixAssetsAudit.tsx`
- `FastCellInput.tsx`

Mantener UI compacta azul petróleo, headers/identificadores sticky y scroll interno de las grillas.

## Contratos principales

- `GET /api/actfij/veta`: fuente de nuevos activos.
- `GET /api/actfij/veta-vr` y `POST /api/actfij/veta-vr/insert`: detalle VR.
- `GET /api/actfij/catalogue` y `POST /api/actfij/catalogue/insert`: catálogo.
- `POST /api/actfij/catalogue/reclassify`: traslado/reclasificación.
- `POST /api/actfij/catalogue/dispose`: baja.
- `GET /api/actfij/deprec`, `POST /api/actfij/deprec/insert`, `POST /api/actfij/deprec/delete`: depreciación.
- `/api/actfij/mapping`: mapping de cuenta, tasa, tipo de activo y `correlative_start`.
- `/api/actfij/ceco`: maestro de centros de costo.
- `/api/actfij/account`: maestro de cuentas.
- `/api/actfij/deprec/export` y `/deprec/export/detail`: provisión Concar.
- `/api/actfij/concar-real`: provisiones reales.
- `/api/actfij/audit` y `/api/actfij/audit/:id`: auditoría.

## Nuevos Activos

`FixAssetsNew.tsx` carga Veta, catálogo, VR, CECO y mapping.

### Clasificación de filas

- `NA`: informativa, no se guarda.
- Descripción que contiene `BAJA`: informativa, no se guarda como alta.
- `VR`: puede consolidarse como paquete; el usuario puede revisar/excluir líneas del detalle.
- Las demás filas son altas normales.

Una fila ya existente por identidad de origen queda bloqueada:
`subjournal_code + voucher_number + annex_code + document_number`.

Para VR también se controla el detalle ya mapeado para no volver a enviarlo.

### COD

- Exactamente 7 dígitos.
- Primeros 3 = `mapping.correlative_start` de la cuenta.
- Últimos 4 = correlativo.
- No puede existir en catálogo ni repetirse entre drafts.
- La secuencia por clase debe ser continua desde el máximo existente.
- El componente propone automáticamente los siguientes COD válidos.
- Guardado individual solo se habilita para el siguiente correlativo realmente disponible de la clase, evitando huecos.

### Campos y fechas

Editables en grilla: COD, descripción, CAPEX, USD, PEN y T.C.

Ficha complementaria:
`location_name`, `assigned_to`, `area_name`, `brand`, `model`, `serial_number`, `cost_center_code`, `depreciation_method`, `asset_comment`.

CECO debe existir en maestro si se informa. Textos se normalizan a MAYÚSCULAS.

Al crear catálogo:
- `origin_account_code <- account_code`
- `asset_description <- line_description`
- `comp_date <- Veta.comp_date`
- `acquisition_date <- Veta.comp_date`
- `operation_date <- primer día del mes siguiente`
- `asset_ini_cost_pen <- pen_amount`
- `asset_ini_cost_usd <- usd_amount`
- `asset_situation = OPERATIVO`
- `source_name = VR` para paquetes VR; caso normal `WEB`.

`comp_date` es la fecha contable original y no debe depender de posteriores modificaciones de `acquisition_date`.

### Guardado

- El botón global guarda todas las filas válidas candidatas.
- Cada fila válida dispone también de Guardar individual.
- Ambos reutilizan `/api/actfij/catalogue/insert`.
- VR guarda primero las líneas necesarias en `/veta-vr/insert`.
- Lotes máximos de 100.
- Tras guardar se actualiza el estado local para que la fila pase inmediatamente a existente y no vuelva a enviarse.

### Filtros

Filtros tipo Excel por columna.
En columnas numéricas los valores del selector se redondean/agruparán a 2 decimales.

---

## Catálogo

`FixAssetsCat.tsx` carga catálogo, depreciación auxiliar, VR, CECO, cuentas y mapping.

Mantiene `originals` y `drafts` por `asset_code`; página de 100 filas.

### Columnas y edición

`Fecha Contable` corresponde a `comp_date`:
- visible,
- filtro tipo fecha,
- solo lectura.

`Fecha adquisición` (`acquisition_date`) continúa editable independientemente.

Principales editables:
- ubicación
- CAPEX
- descripción
- asignado
- área
- marca/modelo/serie/color
- CECO
- fechas adquisición/operación/baja
- T.C.
- costos iniciales PEN/USD
- método
- situación
- comentario

`asset_type` se muestra como referencia y no se edita en la grilla principal.

`asset_situation`: vacío, `OPERATIVO`, `DEPRECIADO`.

CECO muestra descripción pero el payload conserva el código.

### Filas modificadas

- Una modificación válida se marca verde.
- Una modificación inválida se marca roja.
- Toda fila editada aparece automáticamente al inicio de la tabla, incluso si existe ordenamiento Excel.
- `Correctas para enviar: N` muestra el número de filas modificadas válidas.
- Al pulsarlo se alterna la vista para mostrar únicamente esas filas.
- Guardar envía solo filas modificadas y válidas.

### Filtros

Todos los encabezados soportan filtro/orden Excel.
Los filtros numéricos agrupan valores por representación a 2 decimales.
`Limpiar filtros` borra filtros por columna, orden y vista de correctas.

### VR

Si un COD tiene detalle en `finance_actfij_veta_vr`, la fila permite abrir el detalle asociado.

### Traslado y baja

Las filas pueden seleccionarse para:
- `Traslado`: crea un nuevo activo mediante `/catalogue/reclassify`.
- `Baja`: usa `/catalogue/dispose`.

Estas operaciones también generan las variaciones correspondientes en depreciación y manejan `source_name` específico de lifecycle (`WEB_RECLA*`, `WEB_BAJA*`).

Respetar siempre las validaciones del backend para correlativo, cuenta, CECO, fechas y valores.

### Mapping

`Actualizar mapping` permite editar `deprec_rate_pct`.
Usa `/api/actfij/mapping` y guarda por lotes.
No modificar otras columnas desde ese modal salvo cambio explícito de requerimiento.

---

## Depreciación

`FixAssetsDepr.tsx` carga depreciación + catálogo + mapping.

### Periodo

Solo el periodo contable habilitado es editable:
- días 1–10 de Lima → mes anterior
- desde día 11 → mes actual.

Otros periodos son consulta.

### Filtros

Incluye:
- año/mes
- tipo de activo
- grupo
- denominación
- situación
- filtros Excel por columna

Defaults:
- Tipo activo: `LR`
- Situación: `OPERATIVO`

Los facets son dependientes.

Los filtros numéricos Excel agrupan/muestran valores a 2 decimales.

### Moneda y source_name

Alterna PEN/USD.

Estados enviados reconocen:
- `WEB`: ambas monedas
- `WEB_PEN`
- `WEB_USD`
- `WEB_BAJA_PEN|USD|BOTH`
- `WEB_RECLA_PEN|USD|BOTH`

Las operaciones de baja/reclasificación no deben impedir cargar la depreciación de una moneda que todavía no haya sido enviada.

Para `LR`, una moneda ya enviada queda bloqueada.
`DUP` puede seguir editable según reglas vigentes.
`NO DEPRECIA` es solo consulta.

### Edición y cálculo

Editar una celda selecciona la fila.

LR:
- tasa editable
- depreciación calculada automáticamente.

DUP:
- depreciación editable
- tasa derivada.

Preview PEN:
`valor_final = base + adquisición + baja + reclasificación + ajuste`

`depr_acum = base_depr + reclas_depr + ajuste_depr + baja_depr + depreciación_periodo`

`saldo = valor_final - depr_acum`

USD usa la misma lógica con los campos USD disponibles; no inventar campos USD inexistentes.

`Correctas para enviar` muestra y filtra las filas válidas pendientes.

Guardar usa `{ currency, rows }` en lotes de hasta 100.

`deprec/delete` solo debe afectar la moneda y periodo permitidos, preservando información lifecycle de la otra moneda.

---

## Exportación de depreciación

`FixAssetsExport.tsx` carga:
- `/deprec/export`
- `/catalogue`
- `/concar-real`

Filtra por periodo y buscador de cuenta/CECO/COD.

Una provisión ya existente en Concar se identifica por combinación normalizada de:
`fecha_comprobante + cuenta_contable + codigo_centro_costo`.

Existentes:
- se muestran en verde,
- no entran al Excel principal,
- no entran a sus totales.

El Excel principal usa el siguiente número de comprobante disponible para la fecha correspondiente.

Formato:
- T.C.: 6 decimales
- importes: 2 decimales

El detalle por fila usa `/deprec/export/detail` y muestra los activos que componen la provisión.

No recalcular USD en frontend si el endpoint ya entrega `depreciation_amount_usd`.

---

## Auditoría Activos Fijos

`FixAssetsAudit.tsx` se reutiliza desde las vistas de Activos Fijos.

Consulta `/api/actfij/audit` con:
- tabla
- operación I/U/D
- búsqueda
- fecha desde/hasta
- paginación

El detalle `/api/actfij/audit/:auditId` muestra before/after y puede resolver descripciones por COD.

Las operaciones que modifican tablas Activos Fijos deben conservar `auditSql(...)` y el contexto de auditoría existente.

---

## Backend Activos Fijos

`stg.finance_actfij_catalogue` incluye `comp_date date NULL`.

Regla:
- Nuevos Activos llena `comp_date` con la fecha contable de Veta.
- `/catalogue/insert` permite `comp_date` al crear.
- Una edición normal del catálogo no debe sobrescribir `comp_date`.
- `acquisition_date` sí puede modificarse posteriormente.

`source_name` identifica tanto origen como estado de carga. No reemplazarlo indiscriminadamente:
- catálogo: `WEB`, `VR`, `TRASLADO`
- depreciación: `WEB[_PEN|_USD]`, lifecycle BAJA/RECLA y variantes por moneda/BOTH.

Antes de modificar vistas SQL o endpoints revisar cómo cada `source_name` participa en Depreciación y Exportación.

## Regla final

Actualizar este archivo únicamente cuando cambien:
- arquitectura
- auth/scopes
- rutas o contratos
- tablas/campos persistentes relevantes
- reglas de negocio durables

No agregar aquí detalles de CSS, nombres de estados React ni implementación temporal.
