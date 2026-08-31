# Contexto operativo de MVD CAPEX ERP

Aplica a todo el repositorio. Leer este archivo una vez y después abrir solo los archivos relacionados. Mantener aquí únicamente arquitectura, contratos y reglas de negocio vigentes.

## Stack y datos

- Next.js 16.1 App Router + React 19 + TypeScript estricto. Rutas `src/app`, componentes `src/components`, lógica/tipos/validación `src/lib`, estáticos `public`, scripts `scripts`; alias `@/*` a raíz.
- UI compartida: `Button`, `Input`, `Select`, `Table`; estilos globales en `src/app/globals.css`.
- Frontend → backend externo mediante `src/lib/apiClient.ts`; usa `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_API_KEY` y `x-api-key`.
- No inventar rutas, payloads, fechas, batch ni semántica de borrado: revisar siempre el endpoint/código existente. Algunos endpoints aceptan `{ rows: [...] }`; los componentes actuales de Activos Fijos agrupan inserciones en lotes de hasta 100 filas cuando el endpoint correspondiente ya trabaja con `rows`.
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
  - Flota: área `fleet`; solo `FLEET_PASSWORD_L2`, con scopes `fleet_mgmt` y `fleet_units`; ruta inicial `/fleet/mgmt`.
  - TI: `ti`, `DTI_PASSWORD`, `/ti`.
- TI además tiene una sesión interna de roles en `mvd_ti_session`, con `PASS_TI` y `PASS_JEFES`, endpoints `/api/ti/auth/login|logout|me` y duración de 8 horas.
- Nunca exponer ni registrar valores de contraseñas, claves API o secretos.

## Convenciones de interfaz

- Mantener identidad azul Veta Dorada, `panel`/`panel-inner`, `Table`, `capex-th`/`capex-td`, headers/identificadores sticky y scroll interno en tablas anchas.
- Edición: original y borrador separados; verde=válida/preparada, rojo=inválida; validar antes del POST.
- En tablas editables grandes usar `FastCellInput`: mientras tiene foco conserva estado local para no perder escritura por rerenders; sincroniza el `value` externo al enfocar, aplica `sanitize` en cada cambio, permite `normalizeOnBlur` antes del commit y ejecuta `onLiveChange` dentro de `startTransition` solo cuando se necesite respuesta inmediata.
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

- Rutas `/fleet/mgmt` y `/fleet/units`; componentes `FleetMgmForm` y `FleetUnitsPermits`.
- Gestión consume `/api/logistics/flota/req` y guarda lotes en `/api/logistics/flota/web`. Sus editables incluyen odómetro y tipo de requerimiento; este último admite selección múltiple y se guarda como arreglo JSON serializado en `req_type`.
- Unidades/permisos consume y actualiza `/api/logistics/flota/soat-rtv`.
- El middleware conserva scopes separados para Gestión y Unidades, ambos concedidos por el acceso L2.

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

Scope `fixassets`; rutas `/fixassets/new|catalogue|depreciation|export`; componentes `src/components/fixassets`. Mantener la UI compacta azul petróleo y las reglas de foco/scroll definidas en cada vista. No redondear ni convertir campos por inferencia: los drafts numéricos permiten hasta 6 decimales donde la validación actual lo admite; las vistas monetarias suelen mostrarse a 2 decimales y la exportación contable formatea el T.C. a 6 decimales.

### Contratos

- `/api/actfij/veta`: fuente de altas; incluye cuenta, `comp_date`, subdiario, comprobante, anexo, documento, descripción, CAPEX, `usd_amount`, `pen_amount` y T.C.
- `/api/actfij/catalogue` + `/catalogue/insert`: catálogo; `MERGE` por `asset_code`; `null` no borra por `COALESCE`. El frontend usa lotes de hasta 100 filas con `{ rows: [...] }` y `source_name: "WEB"` en altas/ediciones.
- `/api/actfij/deprec` + `/deprec/insert`: depreciación; clave funcional `asset_code + period_date(EOM)`. El POST actual recibe `{ currency: "PEN" | "USD", rows: [...] }` y el frontend envía lotes de hasta 100 filas.
- `/api/actfij/mapping` + `/mapping/insert`: mapping por `origin_account_code`; el GET también aporta `correlative_start`, usado por Nuevos Activos para la clase/prefijo del COD. En el preview de Catálogo solo se modifica `deprec_rate_pct`; `No deprecia` queda bloqueado. El guardado del preview usa lotes de hasta 100 filas.
- `/api/actfij/ceco`: mapping `cost_center_code → descripción`. En UI mostrar `CODIGO - DESCRIPCION`; en drafts/payload conservar solo el código validado.
- `/api/actfij/deprec/export`: vista de provisión contable para Concar.
- `/api/actfij/deprec/export/detail`: detalle de activos de una fila de exportación; parámetros usados por UI: `period`, `account`, `ceco`, `debit_credit`.
- `/api/actfij/concar-real`: registros reales de Concar usados para detectar provisiones ya existentes y calcular el siguiente número de comprobante.

### Alta desde Veta

- `FixAssetsNew.tsx` carga en paralelo Veta, catálogo, CECO y mapping.
- Ficha complementaria: `location_name`, `assigned_to`, `area_name`, `brand`, `model`, `serial_number`, `cost_center_code`, `depreciation_method`, `asset_comment`. No pedir `asset_type`, `operation_date` ni `asset_situation`; guardar `asset_situation="OPERATIVO"`.
- `acquisition_date <- comp_date`; `operation_date` = primer día del mes siguiente.
- Todo texto editable de grilla/ficha se normaliza a MAYÚSCULAS antes del POST. CECO se sanitiza a máximo 6 caracteres alfanuméricos y debe existir en `/api/actfij/ceco` si no queda vacío.
- Campos reutilizables de la ficha usan autocomplete con distinct del catálogo + borradores; se permiten valores nuevos salvo CECO, que debe existir.
- La ficha complementaria se renderiza dentro del flujo vertical de la página, debajo de las tablas. Al abrirla la página deja de forzar altura cerrada y puede crecer para que el panel no tape las grillas.
- La ficha corresponde a un único activo a la vez. Clic en una fila no existente alterna abrir/cerrar su ficha; la fila enfocada se sombrea en azul. Enfocar o hacer clic en una celda editable fuerza la ficha abierta sin disparar el toggle de fila. No usar checks ni selección múltiple.
- Alta existente = `subjournal_code + voucher_number + annex_code + document_number`; mostrar el COD ya registrado, bloquear toda la fila y oscurecerla. Tras guardar, actualizar localmente catálogo/códigos para que esas filas ya no vuelvan a entrar al lote.
- COD: exactamente 7 dígitos. Los primeros 3 son la clase y deben coincidir con `mapping.correlative_start` de la `account_code` de la fila; los últimos 4 son correlativo.
- Ya no se ingresa una clase manual ni existe la lógica de `Asignar siguientes`. Para cada fila visible, no existente y con `correlative_start` válido de 3 dígitos, el componente propone automáticamente el siguiente COD libre de su clase.
- La propuesta automática ordena candidatos por prefijo, `comp_date`, `line_description` e índice original; respeta los COD ya existentes y los COD pendientes ya asignados en otros drafts.
- Validación de COD: no existente en catálogo, no repetido entre borradores, prefijo igual al mapping de la cuenta y secuencia continua desde el máximo existente de la clase. Una clase sin registros empieza en `0001`; varias altas simultáneas de la misma clase deben formar la secuencia sin saltos.
- Mientras se enfoca/escribe un COD, el hint de la ficha muestra el último COD del catálogo que empieza con el prefijo activo, su `asset_description` y el siguiente COD obligatorio calculado para la clase.
- Editables en grilla: `asset_code`, `line_description`, `capex_code`, `usd_amount`, `pen_amount`, `exc_rate`. Para una fila nueva, PEN y USD deben ser números válidos; T.C. puede quedar vacío.
- Al abrir/refrescar, el filtro vuelve al año y mes actual de Lima; en el año actual no se ofrecen meses futuros. El rango `Mes desde`/`Mes hasta` es inclusivo sobre `comp_date`.
- La vista se divide en Activos normales (`capex_code` original vacío) y Activos CAPEX (`capex_code` original con valor). Ambas grillas comparten la altura disponible con scroll interno en escritorio; CAPEX se ordena ascendentemente por `capex_code`.
- Las grillas usan fondo azul petróleo, headers compactos y tipografía de 11 px; la columna COD es sticky.
- Mapeo de alta: `asset_code <- COD`, `origin_account_code <- account_code`, `capex_code <- capex_code`, `subjournal_code <- subjournal_code`, `voucher_number <- voucher_number`, `annex_code <- annex_code`, `annex_description <- annex_description`, `document_number <- document_number`, `asset_description <- line_description`, `acquisition_date <- comp_date`, `operation_date <- primer día del mes siguiente`, `exc_rate <- exc_rate`, `asset_ini_cost_pen <- pen_amount`, `asset_ini_cost_usd <- usd_amount`. Los opcionales de ficha se envían como `null` si quedan vacíos; `asset_situation` siempre se envía `OPERATIVO`; `asset_type` no se captura ni se envía desde Nuevos Activos.
- Guardar toma todas las filas visibles con COD no vacío que todavía no existan por identidad de origen; no hay selección manual. Envía el catálogo en lotes de hasta 100 filas y, si todo termina bien, resetea los drafts de esas filas.

### Catálogo

- `FixAssetsCat.tsx` carga catálogo + CECO, conserva original y draft por `asset_code`, pagina 100 filas y solo envía filas modificadas.
- La vista combina búsqueda global con filtro inclusivo por Fecha de adquisición (`Año adquisición`, `Mes desde`, `Mes hasta`). La búsqueda global evalúa todas las columnas visibles usando los valores vigentes de los drafts.
- Cada encabezado tiene filtro/ordenamiento estilo Excel. El menú permite ordenar asc/desc, buscar valores distintos, seleccionar/deseleccionar valores, aplicar operadores personalizados por tipo (`text|number|date`) y limpiar el filtro de esa columna.
- Los menús de filtro se renderizan con `createPortal` y `position: fixed`, se reposicionan en scroll/resize y se mantienen dentro del viewport para que nunca queden cortados por el contenedor con scroll. Clic fuera del botón o popup cierra el menú.
- El botón global `Limpiar filtros` limpia los filtros por columna y el ordenamiento y vuelve a página 1; no borra la búsqueda global ni el rango de adquisición.
- COD y Descripción activo son las dos primeras columnas y permanecen sticky.
- El GET muestra también cuenta/descripción origen, cuentas/descripciones de depreciación 1/2, tasa y costos iniciales PEN/USD.
- Editables: `location_name`, `capex_code`, `asset_description`, `assigned_to`, `area_name`, `brand`, `model`, `serial_number`, `color`, `cost_center_code`, `acquisition_date`, `operation_date`, `disposal_date`, `exc_rate`, `asset_ini_cost_pen`, `asset_ini_cost_usd`, `depreciation_method`, `asset_situation`, `asset_comment`. `asset_type` se muestra pero es de solo lectura; `deprec_rate_pct` también se muestra como referencia y no se edita en la grilla principal.
- `asset_situation` se edita mediante select con vacío, `OPERATIVO` y `DEPRECIADO`.
- Textos editables se normalizan a MAYÚSCULAS antes del POST. Ubicación, asignado, área, marca, modelo, serie, CECO, método y comentario usan autocomplete con distinct + borradores. CECO muestra su descripción mapeada y solo acepta códigos existentes.
- `Actualizar mapping` abre un modal independiente con `/api/actfij/mapping`; muestra cuenta origen, grupo, denominación, cuentas de depreciación, tasa y tipo de activo. Solo `deprec_rate_pct` es editable; las filas `No deprecia` quedan deshabilitadas. Guardar tasas usa `{ rows: [...] }` en lotes de hasta 100.

### Depreciación

- `FixAssetsDepr.tsx` carga depreciación, mapping y catálogo. Del catálogo obtiene por COD `origin_account_code`, `asset_situation`, `cost_center_code` y `exc_rate`; la grilla se ordena por `asset_code` ascendente.
- El buscador global filtra por COD, descripción o CECO. Año/mes solo muestran periodos existentes hasta el periodo contable habilitado.
- El GET incluye `asset_type`, pero la columna no se muestra. `Tipo de activo` ofrece `LR`, `DUP` y `No deprecia`; default solo `LR`. `Situación` default solo `OPERATIVO`; `DEPRECIADO` aparece cuando exista pero permanece desmarcado inicialmente.
- `Tipo de activo`, `Grupo`, `Denominación` y `Situación` son facets dependientes: cada cambio recalcula las opciones compatibles de los demás según periodo/búsqueda/datos. Cada multiselect alterna `Seleccionar todos`/`Deseleccionar todos` y se cierra al hacer clic fuera.
- Cambiar cualquiera de esos facets o año/mes limpia selección e histórico. Las selecciones iniciales `LR` y `OPERATIVO` deben preservarse mientras las opciones todavía estén vacías durante la primera carga.
- Además de los facets, cada encabezado visible tiene filtro/ordenamiento estilo Excel, calculado sobre los valores actuales de draft y la moneda visible. Aplicar un filtro de columna limpia la selección. `Limpiar filtros` limpia filtros por columna y ordenamiento.
- Los menús de filtros de encabezado usan `createPortal`/`position: fixed`, se reposicionan con scroll/resize, respetan el viewport y se cierran al click fuera para evitar que el popup se corte dentro de la grilla.
- La vista alterna `PEN`/`USD` con `Ver en USD`/`Ver en PEN`. Cambiar moneda limpia la selección, conserva los datos de ambas monedas y reutiliza las mismas columnas visuales mediante el mapeo PEN→USD.
- Estado de envío por moneda: `source_name="WEB"` cuenta como enviado en ambas; `WEB_PEN` solo PEN; `WEB_USD` solo USD. La UI muestra contadores permanentes PEN/USD y filtros clicables `Enviadas <moneda>`, `Pendientes <moneda>`, `Inválidas`, `Correctas para enviar`.
- Para activos `LR`, una moneda ya enviada deja de ser editable/seleccionable para esa moneda. `DUP` sigue siendo editable en el periodo habilitado aunque ya tenga source de esa moneda. `No deprecia` siempre es consulta: sin checkbox, sin inputs y nunca entra al guardado.
- Solo el periodo contable habilitado según Lima es editable: días 1–10 → mes calendario anterior; desde el día 11 → mes calendario actual. Los demás periodos son consulta. Refrescar selecciona el último periodo disponible que no exceda ese periodo contable.
- Cada fila editable tiene checkbox y por defecto ninguna está seleccionada. Editar una celda selecciona automáticamente esa fila; también puede seleccionarse manualmente. El checkbox del encabezado alterna todas las filas editables visibles después de todos los filtros activos.
- `Usar datos de vista` agrega a la selección todas las filas editables visibles; `Seleccionar manuales` agrega las filas visibles con cambios en el draft; `Limpiar selección` vacía el lote. Ninguno de esos botones modifica los cálculos por sí mismo.
- Al hacer clic en una fila fuera del check/celda editable se abre/cierra debajo de la grilla el histórico del COD. Enfocar/clicar una celda editable fuerza el histórico abierto sin activar el toggle de fila. Al abrir histórico la página crece verticalmente y la grilla principal conserva altura suficiente; la fila focalizada se resalta en azul.
- El histórico usa la moneda activa. En USD, `Depr. reclas.` y `Depr. ajuste` se muestran como `—` porque no existe contraparte USD en el contrato actual; las demás variaciones/valores/saldos usan sus campos USD.
- La vista compacta oculta por defecto las cuatro variaciones y tres ajustes de depreciación; `Mostrar ajustes` los expone. Los filtros de encabezado y sus valores disponibles corresponden solo a las columnas visibles en ese momento.
- Check, COD y Descripción activo son sticky. La tabla incluye fila de totales sobre las filas visibles/filtradas; los totales usan la moneda activa y los drafts vigentes.
- T.C. se toma del catálogo por `asset_code` para mostrarlo en la grilla/histórico y actualmente es de solo lectura en UI.
- Campos de edición PEN: `applied_rate_pct`, `acquisition_var_pen`, `disposal_var_pen`, `reclass_var_pen`, `adjustment_var_pen`, `reclass_depr_pen`, `adjustment_depr_pen`, `disposal_depr_pen`, `depreciation_amount_pen`, `exc_rate` dentro del draft/payload. En UI `exc_rate` no es editable.
- Campos de edición USD: `applied_rate_pct`, `acquisition_var_usd`, `disposal_var_usd`, `reclass_var_usd`, `adjustment_var_usd`, `disposal_depr_usd`, `depreciation_amount_usd`, `exc_rate` dentro del draft/payload. No hay `reclass_depr_usd` ni `adjustment_depr_usd` en el componente actual.
- Regla LR: `applied_rate_pct` es editable y `depreciation_amount_*` no se edita directamente; cambiar tasa o cualquiera de las cuatro variaciones de la moneda recalcula el monto de depreciación.
- Regla DUP: `applied_rate_pct` no es editable y `depreciation_amount_*` sí; al cambiar el monto, la tasa se deriva como `(monto * 12) / valor_final` cuando el valor final es distinto de cero.
- Preview PEN: `valor_final = asset_base_value + acquisition_var_pen + disposal_var_pen + reclass_var_pen + adjustment_var_pen`; `depr_acum = depreciation_base_pen + reclass_depr_pen + adjustment_depr_pen + disposal_depr_pen + depreciation_amount_pen`; `saldo = valor_final - depr_acum`.
- Preview USD: `valor_final = asset_base_value_usd + acquisition_var_usd + disposal_var_usd + reclass_var_usd + adjustment_var_usd`; `depr_acum = depreciation_base_usd + disposal_depr_usd + depreciation_amount_usd`; `saldo = valor_final - depr_acum`.
- Tasa→monto en ambas monedas: `valor_final * (applied_rate_pct / 12)`, limitada al saldo disponible antes de la depreciación del periodo. En PEN el saldo previo resta base + reclas/ajuste/baja de depreciación; en USD resta base + baja de depreciación.
- Guardar envía solo las filas seleccionadas que sigan editables para la moneda activa, con `{ currency, rows }` en lotes de hasta 100. Si hay fallo parcial, conserva localmente las filas ya confirmadas y las saca de selección; las pendientes permanecen seleccionadas.
- Después de guardar, si el T.C. del draft difiere del original, intenta sincronizar `exc_rate` a Catálogo con `/api/actfij/catalogue/insert`; un fallo de esa sincronización se reporta por COD sin revertir la depreciación ya guardada.

### Exportación de depreciación

- `FixAssetsExport.tsx` carga en paralelo `/api/actfij/deprec/export`, `/api/actfij/catalogue` y `/api/actfij/concar-real`. Al cargar selecciona el periodo más reciente disponible de la vista de exportación.
- Filtros principales: Año, Mes y un único buscador por cuenta contable, CECO o COD. Buscar por COD cruza el catálogo: para filas Debe (`D`) coincide por `deprec_acc_code_fir + cost_center_code`; para Haber usa `deprec_acc_code_sec` por cuenta.
- Las filas se ordenan Debe antes que Haber, luego por cuenta y centro de costo.
- Una fila se considera ya existente en Concar por la combinación normalizada `fecha_comprobante + cuenta_contable + codigo_centro_costo`. Las existentes se muestran en verde, cuentan en `Existentes` y se excluyen de `exportableRows` y de los totales/export principal.
- El Excel principal exporta solo filas nuevas. Antes de escribir cada fila sustituye `numero_comprobante` por el siguiente comprobante numérico encontrado en `/api/actfij/concar-real` para la misma `fecha_comprobante`; conserva al menos 6 dígitos y usa el número de la vista como fallback si no hay comprobantes numéricos previos.
- El archivo principal se llama `depreciacion_<año>_<mes>.xlsx`, hoja `Depreciación`, e incluye antes de los datos las filas `Campo`, `Restricciones` y `Tamaño/Formato`. Valores numéricos se exportan como números; `tipo_cambio` usa formato de 6 decimales y los demás importes 2.
- La tabla principal muestra totales de `importe_original`, `importe_dolares` e `importe_soles` calculados solo sobre filas exportables.
- Clic en una fila abre/cierra debajo de la grilla su detalle. Para Debe el detalle se consulta por cuenta + CECO; para Haber por cuenta y `ceco` vacío. El panel no se superpone: al abrirlo la página crece y la fila focalizada se resalta.
- El detalle muestra COD, descripción, cuenta origen, grupo, denominación, cuenta de depreciación, CECO, `depreciation_amount_pen`, T.C. y `depreciation_amount_usd`. El USD mostrado/exportado es el campo USD recibido del detalle, no una conversión hecha por el frontend.
- El botón `Exportar Excel` del detalle está junto a `Cerrar detalle`; genera una hoja `Detalle` con esas 10 columnas y nombre `detalle_depreciacion_<periodo>_<cuenta>[_<ceco>].xlsx`.

## Verificación

- Cambios relevantes: `npx eslint <archivos tocados>` + `npm run build`; `npm run lint` solo para auditoría global.
- No incluir cambios ajenos. Commit + push a rama activa salvo indicación contraria.
- Warning de múltiples `package-lock.json`/root inferido de Next.js es conocido.
- Actualizar este archivo solo si cambia arquitectura, auth, rutas, contratos o reglas durables.
