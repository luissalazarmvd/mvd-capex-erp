# Contexto operativo de MVD CAPEX ERP

Aplica a todo el repositorio. Leer este archivo una vez y después abrir solo los archivos relacionados. Mantener aquí únicamente arquitectura, contratos y reglas de negocio vigentes.

## Stack y datos

- Next.js 16.1 App Router + React 19 + TypeScript estricto. Rutas `src/app`, componentes `src/components`, lógica/tipos/validación `src/lib`, estáticos `public`, scripts `scripts`; alias `@/*` a raíz.
- UI compartida: `Button`, `Input`, `Select`, `Table`; estilos globales en `src/app/globals.css`.
- Frontend → backend externo mediante `src/lib/apiClient.ts`; usa `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_API_KEY` y `x-api-key`.
- No inventar rutas, payloads, fechas, batch ni semántica de borrado: revisar siempre el endpoint/código existente. Algunos endpoints aceptan `{ rows: [...] }`; Activos Fijos inserta una fila por POST.
- Comandos: `npm run dev|build|start|lint`. No agregar nuevos errores ESLint.

## Autenticación, portal y seguridad de rutas

- `/` renderiza `src/app/(portal)/PortalClient.tsx`; antes de habilitar accesos valida la red corporativa con `https://MVDLMPRDAT01.dgm.pe:3443/api/access-check`.
- Login general: `POST /api/auth/login`, cookie firmada `mvd_auth`, HMAC con `AUTH_SECRET`, duración de 12 horas.
- `middleware.ts` limpia sesiones al regresar a `/`, permite recursos/API y protege páginas por scopes.
- `LogoutLink` llama `src/lib/logout.ts`, elimina sesiones y vuelve al portal.
- Áreas, scopes, variables y rutas iniciales:
  - CAPEX: `capex`, `CAPEX_PASSWORD`, `/projects`.
  - Planta: `planta`, `PLANTA_PASSWORD`, `/planta/guardia`.
  - Refinería: `refinery`, `REFINERY_PASSWORD`, `/refinery/campaign`.
  - Trazabilidad: `traceability`, `TRACEABILITY_PASSWORD`, `/traceability/entries`.
  - Compliance: `compliance`, `COMPLIANCE_PASSWORD`, `/compliance/downloads`.
  - Logística: `logistics`, `LOGISTICS_PASSWORD`, `/logistics/downloads`.
  - Sostenibilidad: `sustainability`, `SUSTAINABILITY_PASSWORD`, `/sustainability/igafom`.
  - Activos Fijos: `fixassets`, `FIXASSETS_PASSWORD`, `/fixassets/new`.
  - Flota: área `fleet`; `FLEET_PASSWORD_L1` da `fleet_offices`; `FLEET_PASSWORD_L2` da `fleet_offices`, `fleet_mgmt` y `fleet_units`; ruta inicial `/fleet/offices`.
  - TI: `ti`, `DTI_PASSWORD`, `/ti`.
- TI además tiene una sesión interna de roles en `mvd_ti_session`, con `PASS_TI` y `PASS_JEFES`, endpoints `/api/ti/auth/login|logout|me` y duración de 8 horas.
- Nunca exponer ni registrar valores de contraseñas, claves API o secretos.

## Convenciones de interfaz

- Mantener identidad azul Veta Dorada, `panel`/`panel-inner`, `Table`, `capex-th`/`capex-td`, headers/identificadores sticky y scroll interno en tablas anchas.
- Edición: original y borrador separados; verde=válida/preparada, rojo=inválida; validar antes del POST.
- En tablas editables grandes usar `FastCellInput`: estado local al escribir y commit al blur; `onLiveChange` solo cuando se necesite respuesta inmediata y diferida con `startTransition`.
- Aplicar consistentemente cambios de patrones reutilizados (multiselect, seleccionar/deseleccionar todo, click fuera, filtros dependientes, selección de filas) en componentes equivalentes.
- Preservar cambios ajenos del worktree.

## Otros módulos

- **CAPEX** (`src/app/(capex)`, `src/components/capex`): Proyectos, Budget, Forecast, EV y Reportes.
- `/projects`: árbol de proyectos/WBS, metadatos y mantenimiento. Endpoints principales `/api/projects/meta`, `/api/projects/upsert`, `/api/wbs/upsert`, `/api/capex/mapping`.
- `/budget`: matrices ORIG/SOC por periodos. Usa `/api/budget/latest`, `/api/budget/upsert`, `/api/export/budget-orig|budget-soc`.
- `/forecast`: matriz forecast. Usa `/api/forecast/latest`, `/api/forecast/upsert`, `/api/forecast/reset`, `/api/export/forecast`.
- `/progress`: earned value/progreso y carga de actuals Veta/detalle. Usa `/api/progress/latest`, `/api/ev/upsert`, `/api/export/ev`, `/api/capex/actual-veta` y `/api/capex/actual-det`.
- `/reports`: Power BI embebido.
- `MapImpExp.tsx` administra mapping WBS/detalle mediante `/api/capex/mapping/wbs`, `/api/capex/mapping-det` y `/api/capex/mapping/replace`.
- Reglas de códigos, periodos y validación en `src/lib/domain`, `src/lib/types/capex.ts` y `src/lib/validation`.

### Planta

- Rutas/componentes en `src/app/planta` y `src/components/planta`.
- Navegación: `/planta/guardia`, `/planta/datos-guardia`, `/planta/leyes`, `/planta/carbon`, `/planta/reports`.
- Guardia crea/actualiza turnos, pilas y lookups (`/api/planta/lookups`, guardias, pilas y reemplazos).
- Datos de Guardia consolida producción, bolas, reactivos y duración usando `ProduccionPanel`, `BolasPanel`, `ReactivosPanel` y `DuracionPanel`.
- Leyes mantiene producción y relave.
- Carbones gestiona datos mensuales, top 5 días, cantidades y resúmenes de tanques.
- Reportes combina `BalanceTable`, `CarbonTable` y `CarbonTableSum`; también consulta resúmenes/ensayes.
- Mantener las relaciones por `shift_id` y revisar los payloads de cada panel antes de modificar cálculos.

## Módulo Refinería

- Rutas en `src/app/refinery`, componentes en `src/components/refinery`.
- Navegación: campaña, consumos, entrada de stock, producción y reportes.
- Familias principales de endpoints: `/api/refineria/campaigns`, `/campaign/upsert`, `/consumption`, `/consumption/insert`, `/entries`, `/entries/insert`, `/stock`, `/reagents`, `/mapping`, `/cons-stock-subpro`.
- Importación/exportación está en `CampImpExp`, `ConsImpExp` y `ProdImpExp`; stock/subproductos en `StockTable` y `ConsSubStock`.
- `CampRunML` y `OptTable` usan `/api/refineria/ml/status`, `/ml/run` y `/cons-ml-web`.
- Reportes genera/descarga Excel; preservar el vínculo entre campañas, consumos, entradas y producción.

## Módulo Trazabilidad

- Rutas/componentes en `src/app/traceability` y `src/components/traceability`.
- `/traceability/upload`: Datos Valorización (`TraceabilityComerForm`).
- `/traceability/entries`: Validar Datos (`TraceabilityEntryForm`).
- `/traceability/status`: Mineral No Disponible (`TraceabilityStatusForm`).
- `/traceability/conta`: Lotes Pagados (`TraceabilityContaForm`).
- Endpoints principales: `/api/traceability`, `/api/traceability/web/insert`, `/api/traceability/status`, `/api/traceability/status/web/insert`, `/api/traceability/conta`, `/api/traceability/conta/target` y `/target/insert`. Aunque el GET pueda entregar campos adicionales, Lotes Pagados muestra y exporta únicamente las columnas definidas en su componente.
- `TraceabilityContaForm` alterna entre `Por lote` (`GET /api/traceability/conta`) y `Pagos` (`GET /api/traceability/conta/payments`). Cada modo conserva su propio conjunto de columnas y datos; filtros, ordenamiento, paginación y el Excel se calculan exclusivamente desde la vista activa. El Excel de Pagos se llama `pagos_<desde>_<hasta>.xlsx` y contiene `pay_usd` como `Pago USD`.
- Los formularios manejan tablas grandes, borradores, selección/edición y guardado por filas; conservar las claves de negocio usadas por cada vista.
- `TraceabilityEntryForm` trabaja con borradores por `lot`, pagina 100 filas y permite filtrar por rango de `entry_date`, buscador global y estado de valorización `Todas`, `Inválidas`, `Correctas` o `Pendientes`. También permite ordenar las columnas configuradas como ordenables y el Excel se genera sobre todo el conjunto filtrado, no únicamente sobre la página visible.
- En `TraceabilityEntryForm`, si `TMS` está vacío y existen `TMH` y `H2O`, se calcula automáticamente como `TMH * ((100 - H2O) / 100)`. La validación USD compara el monto calculado con `Factura USD` y acepta una diferencia absoluta máxima de `0.02`; una fila editada inválida impide guardar.
- `Guardar` en `TraceabilityEntryForm` envía únicamente filas modificadas a `/api/traceability/web/insert`, usa un mismo `updated_at` para el lote, admite resultados parciales mediante `Promise.allSettled` y al terminar vuelve a cargar los datos.

## Módulo Compliance

- Ruta `/compliance/downloads`; componentes en `src/components/compliance`.
- `ComplianceProveeminExp`: `/api/compliance/format-proveemin` (GET y POST con `rows`).
- `ComplianceROCExp`: `/api/compliance/buy` y `/api/compliance/sell`.
- `ComplianceTraceabilityExp`: consulta `/api/traceability` para exportaciones.
- La página organiza formatos y exportaciones; mantener plantillas/columnas esperadas por Excel/PDF.

## Módulo Logística

- Ruta `/logistics/downloads`, tema oscuro y componentes en `src/components/logistics`.
- `LogisticsReqStatusTable`: `/api/logistics/req-status` y `/api/logistics/req-status/web`.
- `LogisticsMRATable`: `/api/logistics/mra/stg`, `/api/logistics/mra/dim` y POST de dimensión.
- `LogisticsStockTable`: `/api/logistics/mra/stock-vis` + dimensión; soporta filtros/importación/exportación Excel.
- La página también contiene Power BI embebido. Conservar búsqueda, paginación, filtros y flujos Excel de las tablas existentes.

## Módulo Flota

- Rutas `/fleet/offices`, `/fleet/mgmt`, `/fleet/units`; componentes `FleetOffForm`, `FleetMgmForm` y `FleetUnitsPermits`.
- Sedes y Gestión consumen `/api/logistics/flota/req` y guardan lotes en `/api/logistics/flota/web`.
- Unidades/permisos consume y actualiza `/api/logistics/flota/soat-rtv`.
- El middleware distingue permisos de nivel 1/2; no convertirlos en un único scope genérico.

## Módulo Sostenibilidad

- Rutas `/sustainability/igafom` y `/sustainability/providers`.
- `SustainabilityIGAFOMTable`: `/api/sustainability/igafom`.
- `SustainabilityProvTable`: GET/POST `/api/sustainability/prov-padron`.
- Son tablas de mantenimiento con filtros, borradores, validación y feedback; preservar claves y campos obligatorios definidos en cada componente.

## Módulo Eficiencia Operacional TI

- Página monolítica `src/app/ti/page.tsx`, además de rutas locales bajo `src/app/api/ti*`, `api/ai/insight` y `api/web/search`.
- Tickets se obtienen mediante el proxy `/api/ti-tickets`; feedback usa `/api/ti-feedback`.
- Copiloto de tickets: `/api/ai/insight`, `OPENAI_API_KEY`, Responses API y fallback dummy.
- Búsqueda web: `/api/web/search`, `BRAVE_SEARCH_API_KEY` y allowlist de dominios técnicos.
- Los proxies están diseñados para degradar con respuestas vacías/dummy sin romper la interfaz.

## Módulo Activos Fijos y Depreciación

Scope `fixassets`; rutas `/fixassets/new|catalogue|depreciation|export`; componentes `src/components/fixassets`. POST con `source_name: "WEB"` y una fila por request. Montos/tasas a 2 decimales.

### Contratos

- `/api/actfij/veta`: fuente de altas; incluye cuenta, `comp_date`, subdiario, comprobante, anexo, documento, descripción, CAPEX, montos y T.C.
- `/api/actfij/catalogue` + `/catalogue/insert`: catálogo; `MERGE` por `asset_code`; `null` no borra por `COALESCE`.
- `/api/actfij/deprec` + `/deprec/insert`: depreciación; `MERGE` por `asset_code + period_date(EOM)`.
- `/api/actfij/mapping` + `/mapping/insert`: mapping por `origin_account_code`; desde UI solo se modifica `deprec_rate_pct`; `No deprecia` bloqueado.
- `/api/actfij/ceco`: mapping `cost_center_code → descripción`. Mostrar `CODIGO - DESCRIPCION`; POST solo código.

### Alta desde Veta

- `FixAssetsNew.tsx` carga Veta, catálogo y CECO.
- Ficha complementaria: `location_name`, `assigned_to`, `area_name`, `brand`, `model`, `serial_number`, `cost_center_code`, `depreciation_method`, `asset_comment`. No pedir `asset_type`, `operation_date` ni `asset_situation`; guardar `asset_situation="OPERATIVO"`.
- `acquisition_date <- comp_date`; `operation_date` = primer día del mes siguiente.
- Todo texto editable de grilla/ficha se normaliza a MAYÚSCULAS antes del POST.
- CECO: autocomplete `CODIGO - DESCRIPCION`, hint inferior con descripción y payload solo `cost_center_code`.
- La ficha complementaria se renderiza dentro del flujo vertical de la página, debajo de las tablas, en lugar de superponerse. Al abrirla la página puede aumentar su alto para mantener visible la fila seleccionada y evitar que el panel tape Activos normales o Activos CAPEX.
- Campos reutilizables de la ficha usan autocomplete con distinct existentes + borradores; se permiten valores nuevos.
- La ficha complementaria corresponde a un único activo a la vez. Al hacer clic en cualquier parte vacía de una fila se focaliza/abre su ficha y la fila queda sombreada en azul; repetir el clic en la misma fila la cierra. Enfocar, editar o volver a hacer clic en cualquiera de sus celdas editables fuerza la apertura de la ficha, incluso si ya estaba focalizada; el clic de la celda no activa el toggle de la fila. El panel no toma el foco ni interrumpe la escritura. No usar checks ni selección múltiple. El hint de COD se muestra dentro de la ficha activa y refleja el COD de esa fila, incluyendo el último correlativo del catálogo y el siguiente obligatorio.
- Para acelerar altas de una misma clase, se ingresa una clase de 3 dígitos y `Asignar siguientes` completa los COD vacíos de las filas visibles con correlativos consecutivos. La validación acepta varias altas simultáneas si, como conjunto, forman la secuencia continua después del máximo existente. Las filas que ya fueron dadas de alta no participan en esta asignación.
- COD: exactamente 7 dígitos, no existente en catálogo y no repetido entre borradores. Los primeros 3 dígitos son la clase y los últimos 4 el correlativo; para cada clase solo se acepta el siguiente correlativo después del máximo existente, sin saltos. Varias altas simultáneas de una clase deben formar una secuencia continua. Una clase sin registros empieza en `0001`. Solo filas con COD que todavía no existen en catálogo entran al guardado.
- Alta existente = `subjournal_code + voucher_number + annex_code + document_number`; mostrar COD, bloquear fila y oscurecerla. Tras guardar actualizar ese estado localmente.
- Editables: `line_description`, `capex_code`, `pen_amount`, `exc_rate`.
- Al abrir/cargar, el filtro usa año actual y mes actual tanto en “desde” como en “hasta”.
- La vista se divide en Activos normales (`capex_code` original vacío) y Activos CAPEX (`capex_code` original con valor), conservando la misma lógica de alta.
- Activos normales y Activos CAPEX se muestran uno encima del otro, compartiendo la altura disponible y usando scroll interno para evitar scroll vertical de página en escritorio.
- Sus grillas usan el mismo fondo azul petróleo, encabezados, densidad y tipografía de 11 px que Depreciación y Catálogo.
- La tabla Activos CAPEX se ordena ascendentemente por `capex_code`.
- Mientras se escribe un COD, un hint inferior muestra solo el COD más alto/último del catálogo que empieza con ese prefijo y su `asset_description`; si no hay coincidencia, lo indica.
- La columna COD es sticky.
- Mapeo: `asset_code <- COD`, `origin_account_code <- account_code`, `capex_code <- capex_code`, `subjournal_code <- subjournal_code`, `voucher_number <- voucher_number`, `annex_code <- annex_code`, `annex_description <- annex_description`, `document_number <- document_number`, `asset_description <- line_description`, `acquisition_date <- comp_date`, `operation_date <- primer día del mes siguiente a comp_date`, `exc_rate <- exc_rate`, `asset_ini_cost_pen <- pen_amount`. Los campos opcionales de la ficha empiezan vacíos y se envían como `null` si no se completan; la excepción es `asset_situation`, que se guarda siempre como `OPERATIVO` en el alta. `asset_type` no se captura ni se envía desde la ficha de Nuevos Activos.
- Filtro inclusivo por año y rango de meses sobre `comp_date`.

### Catálogo

- `FixAssetsCat.tsx` solo envía filas modificadas y tiene búsqueda global.
- La vista permite filtrar por Fecha de adquisición mediante `Año adquisición`, `Mes desde` y `Mes hasta`; el rango de meses es inclusivo. Este filtro se combina con la búsqueda global.
- COD y Descripción activo son las dos primeras columnas y permanecen sticky.
- Editables: `location_name`, `capex_code`, `asset_description`, `assigned_to`, `area_name`, `brand`, `model`, `serial_number`, `color`, `cost_center_code`, `acquisition_date`, `operation_date`, `disposal_date`, `exc_rate`, `asset_ini_cost_pen`, `depreciation_method`, `asset_situation`, `asset_comment`. `asset_type` se muestra pero es de solo lectura. `asset_situation` se edita mediante un select con vacío, `OPERATIVO` y `DEPRECIADO`.
- Textos editables se normalizan a MAYÚSCULAS antes del POST. Ubicación, asignado, área, marca, modelo, serie, CECO, método y comentario usan autocomplete con distinct + borradores. CECO muestra `CODIGO - DESCRIPCION`, conserva solo código en draft/payload y toma descripción de `/api/actfij/ceco`.

### Depreciación

- `FixAssetsDepr.tsx` filtra año/mes y ordena por `asset_code` ascendente.
- El GET de depreciación incluye `asset_type`, pero la columna no se muestra. `Tipo de activo` es un multiselect con opciones disponibles entre `LR`, `DUP` y `No deprecia`; por defecto queda seleccionado únicamente `LR`. `Situación` también es multiselect y por defecto queda seleccionado únicamente `OPERATIVO`; cuando existan activos `DEPRECIADO`, ese estado debe aparecer como opción pero permanecer desmarcado hasta que el usuario lo seleccione expresamente.
- Depreciación carga también el catálogo y `GET /api/actfij/mapping` para relacionar cada COD con su `origin_account_code` y `asset_situation`. Los cuatro selectores `Tipo de activo`, `Grupo`, `Denominación` y `Situación` son dependientes: modificar cualquiera recalcula las opciones compatibles de los demás según los datos disponibles, mapping, periodo y búsqueda. Cada multiselect permite `Seleccionar todos`/`Deseleccionar todos`, y hacer clic fuera del selector lo cierra.
- Cambiar cualquiera de los filtros de depreciación limpia la selección de filas y el histórico focalizado. Las selecciones iniciales `LR` y `OPERATIVO` deben preservarse mientras las opciones todavía están vacías durante la primera carga.
- Los activos `No deprecia` pueden mostrarse si entran en el filtro, pero son de solo lectura: no tienen checkbox de envío, no se pueden editar y nunca se guardan como depreciación.
- Al hacer clic en una fila de depreciación fuera de su checkbox y de sus celdas editables, se abre debajo de la grilla principal el histórico de ese COD: todos los periodos anteriores al año/mes seleccionado, con tasa, las cuatro variaciones de valor, los tres ajustes de depreciación, valores y saldos calculados. El histórico ya no se superpone sobre la tabla: al abrirlo la página aumenta verticalmente y mantiene una altura suficiente para la grilla principal, evitando tapar la fila seleccionada. La fila enfocada queda sombreada en azul; repetir el clic en ella cierra el histórico. Enfocar, editar o volver a hacer clic en una celda editable fuerza su apertura, aun si ya corresponde a la fila activa, sin quitar el foco de la celda ni activar el toggle de la fila. El panel usa el mismo fondo, tamaño de letra y formato de tabla que la grilla principal.
- Cada fila tiene checkbox de envío y por defecto ninguna está seleccionada. Editar cualquier celda marca automáticamente el check de esa fila; también se puede seleccionar manualmente una fila sin editar. El guardado envía todos los campos aceptados por el POST para cada fila seleccionada.
- Contadores/filtros `Cargadas`, `Pendientes`, `Inválidas`, `Correctas para enviar`: usar estilo compacto de `TraceabilityEntryForm`; click filtra y segundo click limpia. `Cargadas`=`source_name==="WEB"`; `Pendientes`=resto; inválidas/correctas según selección+validación. Respetan todos los filtros y tras POST exitoso la fila pasa localmente a `source_name="WEB"`.
- Solo el periodo contable habilitado según hora de Lima es editable y seleccionable para envío. Del día 1 al 10 de cada mes permanece habilitado el mes calendario anterior; desde el día 11 queda habilitado el mes calendario actual. Los demás periodos se muestran en modo consulta, sin inputs ni checks habilitados. Por ejemplo, el 24-08-2026 se puede editar y guardar `2026-08`, mientras que el 05-09-2026 todavía corresponde editar `2026-08`.
- Los botones `Usar datos de vista` y `Seleccionar manuales` ayudan a armar el lote visible: el primero selecciona filas cuyo origen trae tasa o monto de depreciación distinto de cero; el segundo selecciona los borradores modificados por el usuario. Ninguno cambia por sí mismo los valores calculados.
- El checkbox del encabezado selecciona o desmarca todas las filas editables visibles después de aplicar periodo, búsqueda, Tipo de activo, Grupo, Denominación y Situación; las filas `No deprecia` nunca entran en esa selección.
- Tiene un único buscador por COD o descripción. Check, COD y Descripción activo son sticky.
- La vista compacta oculta por defecto las cuatro variaciones y tres ajustes de depreciación; “Mostrar ajustes” vuelve a exponer las siete columnas. La vista compacta conserva valores y cálculos de esas columnas.
- Al pie de la grilla visible hay una fila de totales para Valor base, Deprec. base, Valor final, Depr. periodo, Depr. acum. y Saldo; al mostrar ajustes incluye también las cuatro variaciones y los tres ajustes de depreciación. Los totales se calculan sobre las filas visibles y respetan periodo, búsqueda, Tipo de activo, Grupo, Denominación, Situación y borradores vigentes.
- Usar anchos/celdas compactos y el fondo azul petróleo del contenedor para reducir ruido visual y scroll horizontal.
- Cambiar año/mes, refrescar o completar un guardado limpia la selección.
- Editables directamente en la grilla: `applied_rate_pct`, las cuatro variaciones `*_var_pen` y los tres ajustes `*_depr_pen`. `depreciation_amount_pen` se calcula automáticamente y `exc_rate` se muestra actualmente como solo lectura.
- Fórmulas de preview:
  - `asset_final_value = asset_base_value + acquisition_var_pen + disposal_var_pen + reclass_var_pen + adjustment_var_pen`.
  - `depreciation_cum_amount_pen = depreciation_base_pen + reclass_depr_pen + adjustment_depr_pen + disposal_depr_pen + depreciation_amount_pen`.
  - `asset_balance_pen = asset_final_value - depreciation_cum_amount_pen`.
  - Tasa a monto: `asset_final_value * (applied_rate_pct / 12)`, limitada al saldo disponible antes de la depreciación del periodo.
  - Cambiar `applied_rate_pct` o cualquiera de los cuatro `*_var_pen` recalcula automáticamente `depreciation_amount_pen` usando la tasa vigente.
- Si el guardado por filas falla parcialmente, las depreciaciones ya confirmadas se conservan como guardadas y salen de la selección; las pendientes permanecen seleccionadas. Si solo falla la sincronización de `exc_rate` al catálogo, se informa el COD afectado sin revertir la depreciación ya guardada.
- `FixAssetsCat.tsx` incorpora una ventana de preview `Actualizar mapping`: carga `/api/actfij/mapping`, no muestra `updated_at` y permite cambiar/guardar únicamente la tasa de depreciación de cada cuenta origen.

## Verificación

- Cambios relevantes: `npx eslint <archivos tocados>` + `npm run build`; `npm run lint` solo para auditoría global.
- No incluir cambios ajenos. Commit + push a rama activa salvo indicación contraria.
- Warning de múltiples `package-lock.json`/root inferido de Next.js es conocido.
- Actualizar este archivo solo si cambia arquitectura, auth, rutas, contratos o reglas durables.
