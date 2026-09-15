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
- UI compartida en `src/components/ui`: `Button`, `Input`, `Select` (nativo), `Dropdown` (botón + menú propio), `Table`, `Pager`, `TopNav`, `FastCellInput`, `ExcelHeaderFilter`/`ExcelFilters`; estilos globales en `src/app/globals.css`. Un control que se repite en dos módulos va ahí, no como copia local.
- Antes de modificar un flujo revisar siempre componente + endpoint actual. No inventar rutas, payloads, claves, fechas ni semántica de borrado.
- Endpoints que aceptan `rows` suelen enviarse en lotes de hasta 100 filas.
- Mantener original y draft separados en tablas editables. Verde = válida/modificada; rojo = inválida.
- En tablas grandes usar `FastCellInput` (`src/components/ui/FastCellInput.tsx`) para evitar pérdida de escritura por rerenders.
- Los filtros estilo Excel usan popup con `createPortal` + `position: fixed`, deben mantenerse dentro del viewport y cerrarse al click fuera.
- En filtros Excel numéricos, los valores disponibles se normalizan a 2 decimales antes de agruparlos: valores distintos que redondean igual pertenecen a una sola opción.
- Para montar filtros Excel en una tabla nueva usar `useExcelColumnFilters` de `src/components/ui/ExcelFilters.tsx`, que envuelve `ExcelHeaderFilter` (`src/components/ui/ExcelHeaderFilter.tsx`, única implementación; no duplicarla en el módulo). Es una capa de vista: se aplica **después** del pipeline que alimenta las exportaciones, de modo que Excel y PDF siguen recibiendo las mismas filas que antes.

## Sistema visual

Toda la presentación se resuelve por tokens en `src/app/globals.css`; los componentes no deben introducir escalas propias.

- Paleta y tipografía del Manual de Marca Veta Dorada 2026. Azul `#0067AC` y dorado `#C69214` son invariables; los tonos secundarios salen del manual.
- Superficies: `--s-canvas` → `--s-1` → `--s-2` → `--s-3`, más `--s-sunken` para campos. Se sube por luminancia, no por saturación. Los alias históricos (`--bg`, `--panel`, `--panel2`, `--text`, `--muted`, `--border`) siguen existiendo y apuntan a esa escala.
- Cada layout de módulo declara `data-module="<módulo>"` en su div raíz; eso fija `--mod` y `--mod-soft`. El acento pinta la franja superior de la cabecera, el hover de fila y el embudo de filtro activo. Las familias cromáticas agrupan por dominio: cian = transporte, verde = operaciones y ambiente, azul/dorado = patrimonio, gris = administrativo.
- Tipografía Exo, pesos 300/400/500/600 y tope en 700. No reintroducir 800/900.
- `<select>` nativos: `globals.css` les da superficie opaca (`--s-1`) al control y a sus `<option>` dentro de `[data-module]` y en `.input`/`.select`, porque Chrome usa el `background-color` del select para la lista desplegable y un fondo translúcido sale gris. No poner `background` translúcido inline en un `<select>`; un tinte de estado va en `backgroundImage`. `colorScheme: "dark"` se reserva para `input[type=date]`, donde aclara el icono del calendario.
- Radios: `--r-1` 6, `--r-2` 10, `--r-3` 14, `--r-pill`. No agregar pasos intermedios.
- Gráficos: las series toman color de `--chart-1`…`--chart-5` en ese orden fijo (cian, dorado, azul, púrpura, verde; validado para daltonismo sobre `--s-1`) y el resto se agrupa en «Otros» con `--chart-other`; nunca generar más tonos ni recolorear al filtrar. Estados (cerrado/abierto/pendiente) usan `--brand-success`/`--brand-blue-light`/`--brand-warning`, no la escala de series. Marcas finas (barras ≤ 24 px con remate redondeado, líneas de 2 px), grilla sólida con `--line`, sin doble eje; cada gráfico ofrece tooltip y tabla «Ver datos».
- Formato condicional de grillas: verde `#33521f` válida/modificada, `#3b5f24` seleccionada, rojo `#6b2e14` inválida, ámbar `#5a4210` editada, `#143444` foco, `#071a24` ya enviada. Los tres estados comparten banda de luminancia para que ninguno domine sobre los otros.
- Los colores que alimentan exportaciones no son de presentación y no deben tocarse: `upGreen`/`downRed` y los literales de `setFill(...)` en `CarbonTable.tsx` y `CarbonTableSum.tsx` mantienen los valores que se ven en el Excel generado.
- `src/app/ti/page.tsx` (Eficiencia Operacional TI) tiene su propio sistema claro, autocontenido en sus clases `ti-*`. Queda fuera del sistema visual general.
- Preservar cambios ajenos del worktree.
- Verificación de cambios: `npx eslint <archivos>` y `npm run build`.
- No exponer contraseñas, API keys ni secretos.

## Higiene del repositorio

El repositorio contiene solo lo que la aplicación necesita para compilar y desplegarse: `src`, `public`, configuración de Next/ESLint/TypeScript, `AGENTS.md`, `CLAUDE.md`, `README.md` y `docs/REPOSITORY_MAP.md`.

- No crear archivos de pruebas (`tests/`, `*.test.*`, `*.spec.*`), fixtures, scripts sueltos (`scripts/`), páginas o rutas de previsualización, datos de ejemplo, capturas ni documentos adicionales. La verificación es únicamente `npx eslint` y `npm run build`; una comprobación puntual se hace con un archivo temporal fuera del repositorio o se borra antes de terminar la tarea.
- No añadir carpetas de herramientas (`.claude/`, `.vscode/`, etc.) ni configuraciones locales al árbol.
- No dejar código de depuración, `console.log`, componentes sin uso ni copias locales de algo que ya existe en `src/components/ui`.
- Si una tarea genera un artefacto temporal, eliminarlo y dejar `git status` limpio de restos antes de dar por terminada la tarea.

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
- Kardex TRJ: `trjkardex_sum|trjkardex_guides|trjkardex_quotes` → `/kardex/sum`, `/kardex/guides` o `/kardex/quotes`
- TI: `ti` → `/ti`
- V-Ai: `vai` → `/vai` (`VAI_PASSWORD`; prototipo sin permisos individuales)

Kardex TRJ usa cuatro niveles de acceso: `TRJKARDEX_PASSWORD_L1` habilita Resumen, Guías y Valorización; `TRJKARDEX_PASSWORD_L2` habilita solo Guías; `TRJKARDEX_PASSWORD_L3` habilita solo Valorización; y `TRJKARDEX_PASSWORD_L4` habilita solo Resumen.

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
Rutas `upload`, `entries`, `status`, `conta`, `cm-inputs`.
Las tablas tienen filtros, edición, Excel y claves propias.
`TraceabilityEntryForm` calcula TMS automáticamente si corresponde y tolera diferencia USD máxima absoluta de `0.02`.
Guardar envía solo filas modificadas.

`TraceabilityCmInputsForm` usa `GET /api/traceability/cm/entrydate`; solo `entry_date_2` es editable, no puede ser anterior a `entry_date` ni posterior a la fecha actual de Lima, y el upsert `POST /api/traceability/cm/entrydate/insert` recibe `lot` y `entry_date_2`. El POST debe volver a consultar el `entry_date` vigente del lote y rechazar la escritura antes del `MERGE` cuando la relación sea inválida; el frontend conserva además la validación inmediata y asocia cualquier rechazo del backend a la fila correspondiente. Mientras una fecha editada no se guarde, los filtros y la búsqueda continúan evaluando su valor persistido para mantener visible la fila bajo el filtro que la originó. Su mapping usa `GET /api/traceability/cm/ruccon-map` y `POST /api/traceability/cm/ruccon-map/insert`: `ruc + concession_code` son la identidad de solo lectura y se editan `office_name`, `zone_name` y `office_code`.

La exportación Excel de CM Inputs incluye todas las filas cargadas por `GET /api/traceability/cm/entrydate` y todas las columnas de la tabla principal, independientemente de los filtros y la página visibles.

Sin orden manual, CM Inputs muestra primero las filas sin `entry_date_2`, y su modal de mapping muestra primero las filas sin `office_name`. Una ordenación elegida desde los filtros Excel sustituye esa prioridad predeterminada.

En el mapping CM, los valores editables están restringidos a estos catálogos:

- `office_name`: `ABANCAY`, `CARHUAMAYO`, `CHALA`, `CHIMBOTE`, `COLQUEMARCA`, `HUANCA`, `ISPACAS`, `JULIACA`, `LAS LOMAS`, `NAZCA`, `PEDREGAL`, `SECOCHA`, `TRUJILLO`.
- `zone_name`: `Sur`, `Norte`, `Sur Aqp`.
- `office_code`: `C`, `L`, `P`, `S`, `T`.

Al seleccionar `office_name`, el formulario propone `zone_name` y `office_code` así: `ABANCAY→Sur/L`, `CARHUAMAYO→Norte/L`, `CHALA→Sur Aqp/C`, `CHIMBOTE→Norte/L`, `COLQUEMARCA→Sur/L`, `HUANCA→Sur/L`, `ISPACAS→Sur Aqp/P`, `JULIACA→Sur/L`, `LAS LOMAS→Norte/L`, `NAZCA→Sur/L`, `PEDREGAL→Sur Aqp/P`, `SECOCHA→Sur Aqp/S`, `TRUJILLO→Norte/T`. Zona y código continúan editables después de la propuesta automática.

### Compliance
Ruta `/compliance/downloads`. Mantener exactamente las columnas esperadas por los formatos Excel/PDF y contratos `/api/compliance/*`.

### Logística / Flota
Logística usa `/api/logistics/*`.
Flota separa Gestión y Unidades por scopes. No agregar campos obligatorios que el flujo actual permita completar independientemente.
`FleetMgmForm` ofrece filtros tipo Excel en cada columna visible; evalúan los valores actuales de los drafts, normalizan los valores numéricos a 2 decimales y mantienen los filtros generales de fechas, estado y búsqueda.

Combustible y recorridos de Flota exponen únicamente lectura mediante estos GET existentes:

- `/api/logistics/flota/units`: catálogo GPS, una fila por `vehicle_id`.
- `/api/logistics/flota/fuel-units`: ficha técnica actual, una fila por placa.
- `/api/logistics/flota/fuel`: todos los vales de abastecimiento, una fila por vale.
- `/api/logistics/flota/fuel-alerts`: únicamente vales cuyo abastecimiento supera la capacidad aplicable.
- `/api/logistics/flota/dist`: recorrido GPS, una fila por `gps_identifier + cal_date`.
- `/api/logistics/flota/dist-cons-rat`: cruce diario heredado, una fila por `plate + cal_date`.
- `/api/logistics/flota/fuel-summary`: resumen por `plate + group_name + día|mes`; `grain=month`, `apply_factor=0` y `vehicle_only=0` son los defaults del endpoint.

Los filtros `from`/`to` son inclusivos y se aplican antes de agrupar. Según el endpoint también existen `plate`, `group_name`, `brand`, `model`, `cost_center`, `type_fuel`, `gas_station`, `driver_name` y `status_name`. Sin fechas se devuelve todo el histórico y no existe paginación oculta.

Semántica durable para V-Ai:

- `qty` y `tank_capacity` están en galones. `odometer_km` es recorrido diario GPS, no odómetro acumulado.
- El exceso de tanque se calcula por vale; nunca como `SUM(qty_día) - capacidad`. Excluye placas `GAL*`, `MULTICAR` y marcas `GALONERA`/`OTROS`.
- El factor multiplica la autonomía y divide la referencia de l/100 km; no modifica la capacidad del tanque.
- Aunque el endpoint conserva `apply_factor=0` como default técnico, las fuentes resumen de V-Ai llaman `apply_factor=1`; mantienen `vehicle_only=0` para incluir todo el consumo y costo.
- Los ratios y porcentajes se recalculan desde sus sumas base. No sumar ni promediar ratios. Los campos `*_pct` son fracciones (`0.15 = 15 %`).
- Galoneras y otros conservan consumo y costo, pero no generan métricas de eficiencia.
- `price_usd` es un alias heredado de `total` y no acredita moneda USD. `cost_pen` y `cost_usd` dependen de `currency_code` y no convierten monedas.
- No imputar S/ 23.70 cuando falte precio. Los costos teóricos y desviaciones económicas quedan `null` sin precio PEN verificable.
- Para consolidar un KPI PEN, `SUM(non_pen_or_unpriced_count)` debe ser cero. `cost_pen_known` es solo el subtotal de importes identificados.
- `fuel-summary` combina el alcance de `dist-cons-rat` con todos los vales fechados con placa, sin inventar kilómetros para vales fuera del cruce. Para detalle diario usa `grain=day`.
- `group_name` se presenta al usuario como `Sede`. `potential_savings_pen` se presenta como `Ahorro potencial`.
- `status_name` clasifica `Galonera / Otro`, `Tanqueo anómalo`, `Sin ratio`, `Sobreconsumo`, `Revisar datos` y `OK`, pero sus umbrales actuales no son oficiales: V-Ai no lo usa en dashboards normales ni en conclusiones salvo petición explícita. La estimación frente a ficha técnica no demuestra ahorro realizado ni uso indebido.
- El catálogo V-Ai separa catálogo GPS, ficha técnica, vales, alertas por vale, recorridos GPS, cruce heredado y resúmenes analíticos diario/mensual. Usar vales para auditoría individual, resumen diario para fechas exactas o rangos menores a un mes y resumen mensual para tendencias de meses completos.
- Las métricas de eficiencia del resumen (`l_100km`, costo/km y autonomía real) se consolidan desde sumas base o ponderaciones declaradas; sus campos de fila permanecen como atributos no agregables.
- Un dashboard genérico de combustible prioriza galones, costos PEN/USD separados, costo promedio por galón por moneda, consumo y costo promedio por vehículo y cantidad de vehículos. El detalle de eficiencia prioriza placa, sede, km/gal, galones, costo por moneda, costo/gal y km totales. `dist-cons-rat` queda disponible solo para consultas explícitas del cruce heredado.

### Sostenibilidad
IGAFOM y padrón de proveedores. Preservar claves y validaciones existentes.

### Kardex TRJ
Rutas `/kardex/sum`, `/kardex/guides` y `/kardex/quotes`, con componentes en `src/components/trj-kardex`. `TRJKardexSum` consume `/api/trjkar`, `/api/trjkar/guides` y `/api/trjkar/invo` para detalle y estadísticas.

- Facturas WEB: `stg.finance_trjkar_invo_web`, PK `(ruc, document_number)`, fecha e importe USD propios. `dw.v_finance_trjkar_invo_get` cruza con el histórico normalizado por RUC/documento y expone `amount_usd_con`, `subledger_num`, `comp_num` y `secu_num`. Se conserva la selección de la línea contable más reciente; el histórico de cuenta 631111/subdiario 820 es registro contable, no prueba de pago bancario.
- Facturas: serie alfanumérica de cuatro caracteres (incluye E001 y FPP1), guion y diez dígitos. `dw.v_finance_trjkar_veta_hist` completa los ceros del correlativo sin truncar números inválidos. Las guías mantienen su formato `XX##-##########`.
- `TRJKardexQuotes` organiza la valorización por factura: transportista histórico → buscar guías abiertas sin factura → vincular una o varias. El transportista se elige escribiendo nombre o RUC (`datalist`); el texto resuelve al RUC cuando coincide con una opción o cuando solo una lo contiene. El número de factura usa la misma máscara de escritura que el número de guía (`invoiceDisplayValue`/`invoiceEditValue` en `src/lib/trjKardex.ts`): serie, guion y correlativo a diez dígitos rellenado con ceros. `TRJKardexQuoteEditor` conserva la edición de llegada y tarifa por guía. El resumen muestra USD ingresado, suma de guías y diferencia, incluyendo la vista previa de la guía en edición.
- `/api/trjkar/invo/insert` crea/vincula hasta 100 guías del mismo RUC por transacción. Repetir una vinculación exige la misma fecha e importe de la factura existente; `/invo/update` cambia esos datos explícitamente. No editar `document_number` desde `/guides/insert`. Cambiar el RUC de una guía vinculada exige desvincularla primero.
- `status_name varchar(20)` en guías: `ABIERTO` por defecto y `CERRADO` tras `/invo/close`, con confirmación escrita `cerrar`. El cierre afecta todas las guías de esa factura; muestra la diferencia para confirmar, sin imponer una tolerancia de conciliación adicional. No existe reapertura.
- Las guías cerradas y sus lotes son solo consulta en frontend y backend. El bloqueo también protege PERD y sus recálculos. Las escrituras de Kardex comparten un bloqueo transaccional para impedir carreras con el cierre.
- `/invo/unlink` quita una guía de una factura abierta sin borrar datos. `/invo/delete`, con `eliminar`, borra la factura y limpia su `document_number` en las guías; conserva guías y lotes. Una factura con guías cerradas no permite modificaciones ni borrado.
- `/guides/delete`, con `eliminar`, borra una guía abierta y todos sus lotes asociados, incluyendo PERD; conserva la factura. Los lotes pertenecen a la guía por FK y las guías vinculadas referencian la PK de la factura.
- Estadísticas: guías únicas, lotes operativos sin PERD, importes de factura contados una sola vez por RUC/documento; semanas de lunes a domingo. Filtros generales por fecha de salida en guías y fecha de documento en facturas. Filtros Excel de Resumen se aplican solo a la tabla de detalle. `kardexStatistics` (`src/lib/trjKardex.ts`) también entrega, por período y en total, merma (`tmh_departure − tmh_arrival`, solo guías con llegada > 0), horas de tránsito (`arrival_date − departure_date`), tarifa USD/TMH ponderada (`amount_usd / tmh_departure` de guías con importe), facturas por período, estado de guías (cerrada / abierta con factura / sin factura), salidas por día de semana, USD por transportista y TMH de lotes LIMPIEZA y PERD (`isCleanupLot`; LIMPIEZA suma dentro de las TMH enviadas, PERD queda fuera). No se agrupa por origen: la carga sale siempre del mismo lugar. Los gráficos viven en `src/components/trj-kardex/KardexCharts.tsx`; las tarjetas KPI muestran su desglose en un tooltip al pasar el puntero, y en los rankings y anillos seleccionables (estado, transportista, lotes por guía) elegir un elemento reemplaza «Ver datos» por el detalle de las guías o lotes que lo componen.
- Exportar Excel en Guías y Valorización (`exportKardexWorkbook`, `src/lib/trjKardexExport.ts`): un libro con hojas Guías, Lotes y Facturas con todo lo cargado —sin filtros— y todas las columnas del backend salvo `created_at` y `updated_at`; Guías consulta `/api/trjkar/invo` al momento de exportar.

### TI
Página principal `src/app/ti/page.tsx`, tickets, feedback, copiloto IA y búsqueda técnica. Los proxies pueden degradar a respuestas vacías/dummy sin romper UI.

El portafolio de eficiencia se presenta íntegramente en inglés y francés. Para la iniciativa ejecutada `Fixed Assets & Depreciation Platform`:

- Fuente: `GET /api/dti/actfij-fin`; agrupar filas por mes de `document_date`.
- Proceso anterior: 20 min de preparación por mes + 10 min por fila; proceso actual: 2 min por mes sin depender del número de filas.
- La referencia laboral editable inicia en USD 10/MH y el resumen usa el promedio de filas de los meses activos.
- El sistema anterior costaba USD 3,827.54 al año y fue pagado hasta 2025. En 2026 se reconoce el importe anual completo como costo evitado, equivalente a USD 318.96/mes solo para combinar run-rates; no se registra como gasto real en las filas históricas mensuales de 2026.
- La tabla mensual conserva su fila de totales para volumen, MH y ahorro laboral; el costo evitado del sistema se presenta por separado y se incluye en el ahorro anual total.

### V-Ai (prototipo)
Ruta `/vai`, layout `data-module="vai"`. Toda la interfaz está consolidada en `src/components/vai/Vai.tsx` y toda la lógica compartida en `src/lib/vai.ts`; la integración privada con OpenAI vive en `src/app/api/vai/generate/route.ts`. Genera dashboards a partir de lenguaje natural sobre un catálogo controlado.

- Catálogo (sección `CATALOG` de `src/lib/vai.ts`): solo metadatos —id, área, endpoint GET existente, vista SQL, granularidad, fecha predeterminada, campos con rol (`dimension`/`date`/`measure`/`attribute`), métricas con agregación declarada, exclusiones fijas, reglas y `access.scopes` reservado para permisos futuros—. Un importe de cabecera repetido por fila de detalle se expone como `attribute`, nunca como métrica sumable. Ninguna fuente de escritura entra al catálogo. El alcance habilitado es Kardex TRJ, Trazabilidad, Activos Fijos, Planta, Refinería, Logística y Flota; Sostenibilidad, CAPEX, Compliance y TI quedan fuera de V-Ai.
- Privacidad: OpenAI recibe únicamente el índice del catálogo, los metadatos de las fuentes candidatas (preselección local por área y términos en `selectCandidateSources`), las preferencias y el prompt. Nunca filas, importes, nombres de registros ni credenciales. El modelo `VAI_OPENAI_MODEL` y la API key `API_OPEN_AI` existen solo en `POST /api/vai/generate`, protegido por cookie `mvd_auth` con scope `vai` mediante `src/lib/auth/session.ts`.
- El modelo devuelve una especificación JSON (sección `SPEC` de `src/lib/vai.ts`, schema v1: título, fuentes ≤ 3, filtros ≤ 6, widgets ≤ 10 de tipo `kpi|line|bar|rank|donut|table`); `validateModelOutput` descarta server-side todo lo que no exista en el catálogo y reporta lo omitido al usuario. Sin SQL ni React generados por el modelo; sin URLs ni endpoints fuera del catálogo; sin cruces entre fuentes en v1.
- Datos reales: el navegador consulta cada fuente por su `endpoint` del catálogo vía `apiClient`; la sección `ENGINE` de `src/lib/vai.ts` filtra y agrega en cliente reutilizando `KardexCharts`. Filtros, «Actualizar datos», abrir, renombrar y eliminar no llaman a OpenAI.
- Fechas: `date_range` conserva límites inclusivos `from`/`to` en ISO para períodos absolutos; los presets relativos se resuelven con la fecha actual de Lima. Al abrir una definición anterior sin límites, un único mes/año explícito en el filtro o prompt permite recuperar el período solicitado. Para fuentes de eventos sin período explícito, `validateModelOutput` agrega el rango 2026-01-01 hasta la fecha actual de Lima sobre `defaultDateField`; las fuentes snapshot no reciben ese filtro.
- Resúmenes de tablas: se calculan sobre todas las filas filtradas, antes de paginar. `summaries` admite `auto|sum|avg|min|max|none` por columna; `auto` respeta la agregación del catálogo y recalcula promedios ponderados/razones sobre los registros originales. Solo las medidas numéricas llevan resumen; nunca sumar identificadores, fechas ni atributos de cabecera repetidos.
- Barras y rankings de V-Ai ofrecen escala automática, lineal o logarítmica base 10. Automática usa log cuando los valores positivos abarcan al menos tres órdenes de magnitud; con ceros o negativos conserva lineal y siempre identifica la escala logarítmica.
- Exportaciones de V-Ai: PDF del dashboard o de cada bloque y Excel de tablas/cifras de gráficos, generados en cliente sin llamar a OpenAI. Incluyen todas las páginas de las filas filtradas y sus resúmenes; las tablas respetan también sus filtros de columna. PDF usa fondo hasta el borde y páginas de ancho adaptable, sin encabezados/pies del navegador. Excel conserva tipos y formatos numéricos.
- Persistencia: `stg.vai_dashboards_web` (solo definición: nombre, prompt, `spec_json`, `schema_version`, `source_ids`; `owner_key`/`visibility` reservados). Endpoints `GET /api/vai/dashboards`, `GET /api/vai/dashboards/:dashboard_id`, `POST /api/vai/dashboards/insert` (crea o actualiza) y `POST /api/vai/dashboards/delete`. Al abrir, `parseStoredSpec` revalida contra el catálogo vigente.
- Prompt limitado a `VAI_PROMPT_MAX` (1200) en frontend y backend.
- Reglas de presentación globales: PEN y USD van en gráficos separados; los nulos categóricos aparecen como `Sin dato` y los numéricos se excluyen de agregaciones; las comparaciones por sede, área, proveedor o responsable no tienen restricciones adicionales.
- Fechas de negocio predeterminadas: Kardex de guías → `guide_date`; Trazabilidad ingresados/procesados/valorizados/facturados/pagados → `entry_date`/`process_date`/`valuation_date`/`doc_date`/`payment_date`; Activos de un período → `acquisition_date`; Planta → `shift_date`; Refinería de campañas → `campaign_date`, consumos → `consumption_date`; Logística de requerimientos/compras/entregas → `req_date`/`po_date`/`delivery_date`; mantenimiento de Flota → `req_date`.
- Trazabilidad: `lot_usd` de `/api/traceability` es monto valorizado. Au y Ag se ponderan por TMS; humedad y USD/TMS usan promedio simple. Sin `valuation_date` es sin valorización y sin `payment_date` es sin pago.
- Activos Fijos: la foto actual no se filtra por fecha salvo petición explícita de adquisición, operación o baja. Activo = saldo positivo; totalmente depreciado = saldo cero; baja = saldo y valor cero. La fuente mensual principal es depreciación; la relación al catálogo es `asset_code`, pero V-Ai v1 no ejecuta el cruce.
- Planta: `shift_date` pertenece al inicio de la guardia, incluido el turno nocturno. Usar los KPIs del balance; recuperaciones y NaCN/TMS se recalculan desde sumas base. Turno y supervisor son clasificadores.
- Refinería: `campaign_date` es inicio referencial; leyes Au/Ag se ponderan por carbón seco; stock es total a la fecha; cada reactivo conserva su unidad y solo se suma consigo mismo. Los GET catalogados no exponen costos de campaña, por lo que V-Ai debe reportarlos como no disponibles.
- Logística: la fuente devuelve requerimientos activos. Sin `po_date` es sin OC y sin `delivery_date` es sin envío. Cantidades se consolidan por material, precio unitario USD se pondera por cantidad ordenada y los tiempos requerimiento→OC, OC→entrega estimada y OC→entrega real se expresan en días calendario.
- Flota: placa es la identidad principal. El monto de OC repetido entre ítems se suma una sola vez por `po_num`; permanencia en taller usa días calendario. SOAT/RTV conserva los estados `Vencido`, `Por Renovar <15d`, `Por Renovar <30d`, `Activo` y `Sin Fecha`.

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

Mantener UI compacta, headers/identificadores sticky y scroll interno de las grillas, sobre los tokens de superficie descritos en «Sistema visual».

## Contratos principales

- `GET /api/actfij/veta`: fuente de nuevos activos.
- `GET /api/actfij/veta-vr` y `POST /api/actfij/veta-vr/insert`: detalle VR.
- `GET /api/actfij/soft-po`: relación de órdenes de servicio con el origen contable.
- `GET /api/actfij/catalogue` y `POST /api/actfij/catalogue/insert`: catálogo.
- `POST /api/actfij/catalogue/reclassify`: traslado/reclasificación.
- `POST /api/actfij/catalogue/dispose`: baja.
- `GET /api/actfij/deprec`, `POST /api/actfij/deprec/insert`, `POST /api/actfij/deprec/delete`: depreciación.
- `GET /api/actfij/mapping` y `POST /api/actfij/mapping/insert`: mapping de cuenta, tasa, tipo de activo y `correlative_start`.
- `/api/actfij/ceco`: maestro de centros de costo.
- `/api/actfij/account`: maestro de cuentas.
- `/api/actfij/deprec/export` y `/deprec/export/detail`: provisión Concar.
- `/api/actfij/concar-real`: provisiones reales.
- `/api/actfij/audit` y `/api/actfij/audit/:id`: auditoría.

## Nuevos Activos

`FixAssetsNew.tsx` carga Veta desde 2026, catálogo, VR, CECO, mapping y órdenes de servicio de `soft-po`.

### Clasificación de filas

- `NA`: informativa, no se guarda.
- Descripción que contiene `BAJA`: informativa, no se guarda como alta.
- `VR`: puede consolidarse como paquete; el usuario puede revisar/excluir líneas del detalle.
- Las demás filas son altas normales.

Una fila ya existente por identidad de origen queda bloqueada:
`subjournal_code + voucher_number + sequence_number + annex_code + document_number`.

Para VR:
- las filas sin `BAJA` se agrupan por `account_code + capex_code`; la ausencia de CAPEX forma el grupo normal de la cuenta;
- el detalle ya persistido en `veta-vr` tiene prioridad para resolver el COD existente;
- el fallback por grupo solo considera filas de catálogo con `source_name = VR`.

`po_num` se propone desde `soft-po` usando la misma identidad contable completa de cinco campos; no volver a vincular únicamente por proveedor/documento.

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
Las tablas de activos normales y CAPEX permiten ocultar independientemente las filas ya guardadas; si todas sus filas quedan ocultas, el panel correspondiente se contrae.

---

## Catálogo

`FixAssetsCat.tsx` carga catálogo, depreciación auxiliar, VR, Veta, `soft-po`, CECO, cuentas y mapping.

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

### Históricos y órdenes de servicio

`po_num` es editable. Al cargar, si está vacío, se completa desde `soft-po` solo por identidad contable completa:
`subjournal_code + voucher_number + sequence_number + annex_code + document_number`.

Para filas `source_name = HISTORIC` también son editables esos cinco campos contables. Los campos que el usuario va modificando, incluido `po_num`, se acumulan como criterios de búsqueda; solo cuando existe un único registro distinto en `soft-po` se autocompletan OS, subdiario, comprobante, secuencia, anexo, descripción del anexo y documento. No completar si la coincidencia es ambigua.

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
Consulta `/api/actfij/mapping`, guarda mediante `/api/actfij/mapping/insert` por lotes y recarga el catálogo después de guardar.
No modificar otras columnas desde ese modal salvo cambio explícito de requerimiento.

### Exportaciones del catálogo

- Los Excel PEN, USD y completo exportan las filas visibles.
- El reporte CAPEX omite activos con saldo cero en ambas monedas, crea una hoja por `capex_code` y agrupa por `po_num`.
- Para el reporte CAPEX, la OS se resuelve desde el draft, luego por `soft-po` usando la identidad contable completa y finalmente como `SIN MAPEO`; Veta aporta la fecha de documento por esa misma identidad.

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

Un saldo final negativo en la moneda activa, evaluado a 2 decimales, invalida la fila aunque no esté seleccionada: se muestra en rojo, entra al contador/filtro de inválidas y no puede enviarse.

La tasa derivada desde la depreciación puede sincronizarse para periodos históricos al cambiar de moneda, pero no debe sobrescribir `applied_rate_pct` del periodo editable.

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
- catálogo: `WEB`, `VR`, `TRASLADO`, `HISTORIC`
- depreciación: `VIRTUAL`, `WEB[_PEN|_USD]`, lifecycle BAJA/RECLA y variantes por moneda/BOTH.

Las filas de depreciación `VIRTUAL` no cuentan como historial real; en el periodo vigente tampoco deben presentarse como una moneda ya cargada.

Antes de modificar vistas SQL o endpoints revisar cómo cada `source_name` participa en Depreciación y Exportación.

---

## Cobertura de filtros tipo Excel

Tienen filtro por columna: Kardex (Guías, Cotizaciones), Activos Fijos (Nuevos, Catálogo, Depreciación), Flota (Gestión, Unidades y Permisos), Trazabilidad (Ingresos, CM Inputs, Estado, Comercial, Contabilidad), Logística (MRA, Requerimientos, Stock), Refinería (Stock de insumos, Consumo por subproceso, Consumos por campaña) y Sostenibilidad (IGAFOM, Padrón de proveedores).

No los llevan, por razones de forma de los datos —no por omisión—; documentarlo antes de agregarlos:

- Vistas previas de importación (`*ImpExp`, `ComplianceProveeminExp`, el preview de `FleetUnitsPermits`): son la validación antes de guardar; un filtro escondería filas inválidas.
- `FixAssetsExport`: la tabla **es** el payload del Excel de provisión Concar; filtrarla la desincronizaría de sus totales y del archivo.
- `FixAssetsAudit`: paginación en servidor; un filtro de cliente solo alcanzaría la página visible.
- `BalanceTable`, `CarbonTable`, `CarbonTableSum`, `planta/carbon`: cabeceras combinadas y agrupación por `rowSpan`.
- `OptTable`, `WbsMatrix`: estructuras de árbol/matriz; filtrar filas rompería la jerarquía.
- `planta/guardia`: formulario de captura, no tabla de consulta.

## Regla final

Actualizar este archivo únicamente cuando cambien:
- arquitectura
- auth/scopes
- rutas o contratos
- tablas/campos persistentes relevantes
- reglas de negocio durables
- los tokens o reglas del sistema visual

No agregar aquí valores CSS sueltos, nombres de estados React ni implementación temporal: el sistema visual se documenta por tokens y reglas, no por declaraciones individuales.
