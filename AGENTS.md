# Contexto operativo de MVD CAPEX ERP

Este archivo cubre **todo el repositorio**, no solo un módulo. Antes de implementar cambios, revisarlo y después abrir únicamente los archivos directamente relacionados con la solicitud. Actualizarlo cuando cambien arquitectura, rutas, autenticación, contratos del backend o reglas de negocio importantes.

## Stack y estructura

- Next.js 16.1 con App Router, React 19 y TypeScript estricto; alias `@/*` apunta a la raíz del repositorio.
- Código de rutas en `src/app`, componentes de negocio en `src/components`, utilidades/tipos/validaciones en `src/lib`, recursos estáticos en `public` y scripts en `scripts`.
- Fuentes Exo locales configuradas en `src/app/layout.tsx`; paleta y estilos globales en `src/app/globals.css`.
- UI base compartida: `src/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx` y `Table.tsx`.
- Dependencias relevantes: `mssql`, `xlsx`, `exceljs`, `react-pdf`, `jspdf`, `jspdf-autotable` y `html2canvas`.
- Comandos: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`.
- Existe deuda técnica previa de ESLint, principalmente `no-explicit-any` y algunos hooks, en módulos históricos. No introducir errores nuevos y ejecutar al menos lint dirigido a los archivos tocados más build.

## Comunicación con datos y backend

- El frontend consume el backend externo mediante `src/lib/apiClient.ts`.
- Variables requeridas: `NEXT_PUBLIC_API_BASE_URL` y `NEXT_PUBLIC_API_KEY`; la clave se envía como `x-api-key`.
- `apiGet`, `apiPost` y `apiDownload` normalizan errores cuando HTTP falla o el JSON trae `ok: false`.
- Varios módulos llaman directamente al backend desde componentes cliente. No inventar rutas proxy locales salvo que la arquitectura del módulo ya las use.
- `src/lib/db/sql.ts`, `queries.ts` y `upserts.ts` contienen acceso SQL/utilidades históricas del dominio CAPEX.
- `src/lib/domain`, `src/lib/types/capex.ts` y `src/lib/validation` contienen periodos, reglas, tipos y validaciones de proyectos/WBS, budget, forecast y progress.
- Antes de cambiar payloads, revisar el endpoint consumido: algunos aceptan `{ rows: [...] }`, mientras Activos Fijos acepta una fila por POST.

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

- Mantener la identidad azul Veta Dorada, paneles `panel`/`panel-inner`, tablas `Table`, encabezados `capex-th`, celdas `capex-td` y controles UI compartidos.
- Logística aplica el override oscuro `logistics-theme`.
- Las áreas usan `layout.tsx` con logo, navegación interna e `Inicio` mediante `LogoutLink`.
- Tablas anchas: contenedor con scroll, encabezado sticky, anchos explícitos y feedback de carga/vacío.
- En pantallas de edición, conservar borrador y original separados; verde significa fila preparada/válida, rojo fila preparada con error.
- Evitar letras en entradas numéricas, validar antes del POST y desactivar Guardar si el conjunto que será enviado contiene errores.
- Para tablas editables grandes de Activos Fijos usar `FastCellInput.tsx`: la escritura queda en estado local y se confirma al salir de la celda, evitando rerenderizar toda la tabla por cada tecla.
- Preservar cambios del usuario no relacionados y no hacer operaciones destructivas sobre el worktree.

## Módulo CAPEX

- Grupo de rutas `src/app/(capex)` y componentes `src/components/capex`; layout/nav: Proyectos, Budget, Forecast, EV y Reportes.
- `/projects`: árbol de proyectos/WBS, metadatos y mantenimiento. Endpoints principales `/api/projects/meta`, `/api/projects/upsert`, `/api/wbs/upsert`, `/api/capex/mapping`.
- `/budget`: matrices ORIG/SOC por periodos. Usa `/api/budget/latest`, `/api/budget/upsert`, `/api/export/budget-orig|budget-soc`.
- `/forecast`: matriz forecast. Usa `/api/forecast/latest`, `/api/forecast/upsert`, `/api/forecast/reset`, `/api/export/forecast`.
- `/progress`: earned value/progreso y carga de actuals Veta/detalle. Usa `/api/progress/latest`, `/api/ev/upsert`, `/api/export/ev`, `/api/capex/actual-veta` y `/api/capex/actual-det`.
- `/reports`: Power BI embebido.
- `MapImpExp.tsx` administra mapping WBS/detalle mediante `/api/capex/mapping/wbs`, `/api/capex/mapping-det` y `/api/capex/mapping/replace`.
- Reglas centrales: códigos de proyecto/WBS, periodos desde `202601`, validaciones monetarias y porcentajes en `src/lib/domain` y `src/lib/validation`.

## Módulo Planta

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
- Endpoints principales: `/api/traceability`, `/api/traceability/web/insert`, `/api/traceability/status`, `/api/traceability/status/web/insert`, `/api/traceability/conta`, `/api/traceability/conta/target` y `/target/insert`.
- Los formularios manejan tablas grandes, borradores, selección/edición y guardado por filas; conservar las claves de negocio usadas por cada vista.

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

- Scope `fixassets`; rutas y páginas en `src/app/fixassets`; componentes en `src/components/fixassets`.
- Navegación: `/fixassets/new`, `/fixassets/catalogue`, `/fixassets/depreciation`, `/fixassets/export` (placeholder).
- Todos sus POST envían `source_name: "WEB"`; el backend también lo fuerza en los `MERGE`.
- Sus endpoints de inserción aceptan **una fila por solicitud**, no arrays.
- Todos los montos/tasas se muestran con dos decimales. El valor numérico vigente del borrador es el que entra al payload.
- Los selects usan fondo azul oscuro y texto blanco. Las columnas identificadoras permanecen sticky durante el scroll horizontal.

### Contratos del backend

- `GET /api/actfij/veta`: `account_code`, `account_description`, `comp_date`, `subjournal_code`, `voucher_number`, `annex_code`, `annex_description`, `document_type`, `document_number`, `document_date`, `voucher_description`, `line_description`, `capex_code`, `debit_credit`, `usd_amount`, `pen_amount`, `exc_rate`.
- `GET /api/actfij/catalogue`: catálogo completo con `asset_code` único.
- `POST /api/actfij/catalogue/insert`: `MERGE` por `asset_code`; requiere ese campo. En update usa `COALESCE`, por lo que `null` no borra un valor almacenado.
- `GET /api/actfij/deprec`: filas por activo/periodo.
- `POST /api/actfij/deprec/insert`: `MERGE` por `asset_code` + fin de mes de `period_date`; requiere ambos.

### Alta desde Veta

- `FixAssetsNew.tsx` carga Veta y catálogo en paralelo.
- COD: exactamente 7 dígitos, no existente en catálogo y no repetido entre borradores. Solo filas con COD entran al guardado.
- Editables: `line_description`, `capex_code`, `pen_amount`, `exc_rate`.
- Al abrir/cargar, el filtro usa año actual y mes actual tanto en “desde” como en “hasta”.
- La vista se divide en Activos normales (`capex_code` original vacío) y Activos CAPEX (`capex_code` original con valor), conservando la misma lógica de alta.
- Mientras se escribe un COD, un preview inferior filtra en vivo los códigos ya usados del catálogo que empiezan con ese prefijo.
- La columna COD es sticky.
- Mapeo: `asset_code <- COD`, `origin_account_code <- account_code`, `capex_code <- capex_code`, `subjournal_code <- subjournal_code`, `voucher_number <- voucher_number`, `annex_code <- annex_code`, `annex_description <- annex_description`, `document_number <- document_number`, `asset_description <- line_description`, `acquisition_date <- document_date`, `exc_rate <- exc_rate`, `asset_ini_cost_pen <- pen_amount`. Campos “front” empiezan en `null`.
- Filtro inclusivo por año y rango de meses sobre `comp_date`.

### Catálogo

- `FixAssetsCat.tsx` solo envía filas modificadas y tiene búsqueda global.
- COD y Descripción activo son las dos primeras columnas y permanecen sticky.
- Editables: `location_name`, `capex_code`, `asset_description`, `asset_type`, `assigned_to`, `area_name`, `brand`, `model`, `serial_number`, `color`, `cost_center_code`, `acquisition_date`, `operation_date`, `disposal_date`, `exc_rate`, `asset_ini_cost_pen`, `depreciation_method`, `asset_situation`, `asset_comment`.

### Depreciación

- `FixAssetsDepr.tsx` filtra año/mes y ordena por `asset_code` ascendente.
- Cada fila tiene checkbox de envío y por defecto ninguna está seleccionada. Editar cualquier celda marca automáticamente el check de esa fila; también se puede seleccionar manualmente una fila sin editar. El guardado envía todos los campos aceptados por el POST para cada fila seleccionada.
- El checkbox del encabezado selecciona o desmarca todas las filas visibles según periodo y búsqueda.
- Tiene un único buscador por COD o descripción. Check, COD y Descripción activo son sticky.
- Cambiar año/mes, refrescar o completar un guardado limpia la selección.
- Editables: `applied_rate_pct`, cuatro `*_var_pen`, tres `*_depr_pen`, `depreciation_amount_pen`, `exc_rate`.
- Fórmulas de preview:
  - `asset_final_value = asset_base_value + acquisition_var_pen + disposal_var_pen + reclass_var_pen + adjustment_var_pen`.
  - `depreciation_cum_amount_pen = depreciation_base_pen + reclass_depr_pen + adjustment_depr_pen + disposal_depr_pen + depreciation_amount_pen`.
  - `asset_balance_pen = asset_final_value - depreciation_cum_amount_pen`.
  - Tasa a monto: `asset_final_value * (applied_rate_pct / 12)`, limitada al saldo disponible antes de la depreciación del periodo.
  - Monto a tasa: `depreciation_amount_pen * 12 / asset_final_value`.
  - Cambiar cualquiera de los cuatro `*_var_pen` recalcula valor final y depreciación del periodo con la tasa vigente.
- Si una fila seleccionada cambió `exc_rate`, además del POST de depreciación se actualiza ese `asset_code` mediante `/api/actfij/catalogue/insert`.

## Verificación y mantenimiento

- Ejecutar `npx eslint <archivos tocados>` y `npm run build` después de cambios relevantes; ejecutar `npm run lint` cuando se necesite auditar el repositorio completo.
- El build puede advertir sobre múltiples `package-lock.json` y root inferido por Next.js; es una advertencia conocida, no un error de compilación.
- No asumir contratos de backend, formatos de fecha, capacidad batch ni semántica de borrado; revisar código/contrato antes de cambiar.
- Si se agrega una nueva área, actualizar portal, tipo `Area`, login, variables, scopes de middleware, layout, rutas y este archivo.
