# MVD CAPEX ERP — mapa rápido del repositorio

Este archivo es el índice operativo que debe leerse inmediatamente después de `AGENTS.md`. Su objetivo es ubicar el flujo correcto sin revisar el proyecto completo. Las reglas de negocio y contratos detallados viven en `AGENTS.md`; aquí solo se documentan entrypoints y ownership.

## Ruta mínima para cualquier cambio

1. Identificar el módulo en la tabla inferior.
2. Abrir su `page.tsx` y el componente principal que importa.
3. Buscar solo dentro de esos archivos las llamadas `apiGet`, `apiPost`, `apiDownload` o `fetch` y abrir el contrato actual antes de editar.
4. Abrir `src/lib` únicamente si el flujo importa lógica, tipos o validación desde allí.
5. Consultar `src/app/globals.css` solo cuando el cambio sea visual o afecte una clase compartida.

## Núcleo compartido

| Tema | Abrir primero | Alcance |
| --- | --- | --- |
| Acceso y scopes | `middleware.ts`, `src/lib/auth/session.ts` | Cookie `mvd_auth`, HMAC y guards por módulo; `sessionWithScope` protege route handlers locales |
| Login/logout general | `src/app/api/auth/*`, `src/lib/logout.ts` | Sesión del portal y cierre de sesión |
| Portal corporativo | `src/app/(portal)/page.tsx`, `src/app/(portal)/PortalClient.tsx` | Acceso inicial y `/api/access-check`; la página lee `next` en el servidor y muestra la marca VAi (`VaiLogo` + «Veta Analytics & Intelligence») |
| Cliente backend externo | `src/lib/apiClient.ts` | Base URL, `x-api-key`, GET/POST/download |
| UI compartida | `src/components/ui/*` | `Button`, `Input`, `Select`, `Dropdown`, `Table`, `Pager`, `TopNav`, `FastCellInput`, `ExcelHeaderFilter`, `ExcelFilters`, gráficos SVG en `Charts.tsx`, logo animado VAi en `VaiLogo.tsx` |
| Filtros tipo Excel | `src/components/ui/ExcelFilters.tsx`, `src/components/ui/ExcelHeaderFilter.tsx` | Hook `useExcelColumnFilters` + popup de columna |
| Estilos globales | `src/app/globals.css` | Tokens del sistema visual y clases compartidas |
| Shell global | `src/app/layout.tsx` | Fuentes, metadata y layout raíz |

## Módulos y entrypoints

| Módulo | Rutas | Componentes/lógica principales | API a localizar |
| --- | --- | --- | --- |
| CAPEX | `src/app/(capex)/projects`, `budget`, `forecast`, `progress`, `reports` | `src/components/capex/*`, `src/lib/types/capex.ts`, `src/lib/domain/*`, `src/lib/validation/*`; persistencia local en `src/lib/db/*` | Buscar las llamadas desde cada página/componente; no compartir payloads entre Budget, Forecast, Progress y WBS por su similitud visual |
| Planta | `src/app/planta/guardia`, `datos-guardia`, `leyes`, `carbon`, `reports` | `src/components/planta/*` | `/api/planta/*`; relaciones por `shift_id` |
| Refinería | `src/app/refinery/campaign`, `consumption`, `entries`, `production`, `reports` | `src/components/refinery/*` | `/api/refineria/*` (el backend usa `refineria`) |
| Trazabilidad | `src/app/traceability/upload`, `entries`, `status`, `conta`, `cm-inputs` | `src/components/traceability/*`; CM Inputs en `TraceabilityCmInputsForm.tsx` | `/api/traceability/*` y contratos localizados desde el formulario correspondiente |
| Compliance | `src/app/compliance/downloads/page.tsx` | `src/components/compliance/*` | `/api/compliance/*` y descargas de trazabilidad usadas por la vista |
| Logística | `src/app/logistics/downloads/page.tsx` | `src/components/logistics/*` | `/api/logistics/*` |
| Flota | `src/app/fleet/mgmt`, `units` | `src/components/fleet/FleetMgmForm.tsx`, `FleetUnitsPermits.tsx`; metadatos para V-Ai en `src/lib/vai.ts` | Gestión/documentos bajo `/api/logistics/flota/*`; combustible y recorridos: `/units`, `/fuel-units`, `/fuel`, `/fuel-alerts`, `/dist`, `/dist-cons-rat`, `/fuel-summary` |
| Sostenibilidad | `src/app/sustainability/igafom`, `providers` | `src/components/sustainability/*` | `/api/sustainability/*` |
| Kardex TRJ | `src/app/kardex/sum`, `guides`, `quotes` | `src/components/trj-kardex/TRJKardexSum.tsx`, `TRJKardexGuides.tsx`, `TRJKardexQuotes.tsx`, `TRJKardexQuoteEditor.tsx`, `TRJKardexTopNav.tsx`; gráficos compartidos en `src/components/ui/Charts.tsx`; normalización y estadísticas en `src/lib/trjKardex.ts`; Excel de Guías/Valorización en `src/lib/trjKardexExport.ts` | `/api/trjkar`, `/guides`, `/invo`, `/ruc-history`, `/sgm-hist`; escrituras `/guides/insert`, `/guides/delete`, `/lots/*`, `/invo/insert`, `/invo/update`, `/invo/unlink`, `/invo/close`, `/invo/delete` |
| Activos Fijos | `src/app/fixassets/new`, `catalogue`, `depreciation`, `export` | `src/components/fixassets/FixAssetsNew.tsx`, `FixAssetsCat.tsx`, `FixAssetsDepr.tsx`, `FixAssetsExport.tsx`, `FixAssetsAudit.tsx`; celdas con `src/components/ui/FastCellInput.tsx` | `/api/actfij/*`; consultar la sección detallada de Activos Fijos en `AGENTS.md` antes de cambiar contratos o lifecycle |
| TI / eficiencia | `src/app/ti/page.tsx` | Página autocontenida con portfolio, cálculos, EN/FR y exportación Excel | Proxies locales en `src/app/api/ti-*`, `src/app/api/ai`, `src/app/api/web`; datos operativos externos `/api/dti/*` se localizan dentro de la página |
| V-Ai | `src/app/vai` | Interfaz completa en `src/components/vai/Vai.tsx`; gráficos compartidos en `src/components/ui/Charts.tsx`; catálogo, fechas, spec/validación, motor, persistencia y exportaciones en `src/lib/vai.ts`; escalas compartidas en `src/lib/chartScale.ts`; OpenAI solo en `src/app/api/vai/generate/route.ts`; guard de scope en `src/lib/auth/session.ts` | `POST /api/vai/generate` (route local, única llamada a OpenAI); persistencia externa `/api/vai/dashboards*`; datos por la capa analítica read-only `/api/vai/*` declarada en `src/lib/vai.ts` (Kardex, Trazabilidad, Finanzas, Activos Fijos, Planta, Refinería, Logística y Flota); Sostenibilidad, CAPEX, Compliance y TI no forman parte del catálogo V-Ai |

## Recetas de búsqueda acotada

- Cambio visual de una ruta: abrir `page.tsx`, seguir sus imports a `src/components/<módulo>` y buscar las clases exactas en `src/app/globals.css`. Los colores, pesos y radios salen de los tokens de `:root`; no introducir valores sueltos.
- Acento de un módulo: está en el `data-module` del layout del módulo y en la tabla `[data-module="…"]` de `src/app/globals.css`.
- Montar filtros tipo Excel: `src/components/ui/ExcelFilters.tsx`; aplicarlos después del pipeline que alimenta la exportación.
- Cambio de datos o guardado: buscar `apiGet|apiPost|apiDownload|fetch` únicamente en la página y componente afectados; revisar el payload existente antes de modificarlo.
- Cambio de autenticación o acceso: revisar `middleware.ts`, `src/lib/auth/session.ts`, el layout del módulo y `src/app/api/auth/*`.
- Tabla editable: revisar el componente completo del flujo, su separación original/draft y `FastCellInput` (`src/components/ui`) cuando exista; no inferir reglas desde otra tabla.
- Control repetido entre módulos (paginador, navegación de módulo, dropdown, filtro Excel): vive en `src/components/ui`; el módulo solo lo importa.
- TI: comenzar y, salvo importaciones explícitas, permanecer en `src/app/ti/page.tsx`.
- Activos Fijos: abrir solo el componente de la subruta solicitada y luego los endpoints `/api/actfij/*` que ese componente invoque.
- Activos Fijos, identidad contable u OS: revisar juntos `FixAssetsNew.tsx` y `FixAssetsCat.tsx`; ambos relacionan Veta, catálogo y `soft-po` mediante subdiario, comprobante, secuencia, anexo y documento.

Ejemplos útiles:

```powershell
rg -n "api(Get|Post|Download)|fetch" src/app/<ruta> src/components/<modulo>
rg -n "<nombre_de_campo_o_endpoint>" src/app/<ruta> src/components/<modulo> src/lib
```

## Verificación y entrega

- Backend/SQL V-Ai externo: copia de trabajo de `server.js` en `MVD-BOF-DTI-010 - VAi/01_SQL/server.js` (el usuario la traslada al backend real); un solo bloque `(DESDE ACA V-AI)…(HASTA ACA V-AI)` al final de `server.js` (persistencia de dashboards + datasets GET `/api/vai/*`); tabla en `01_Tables/stg_vai_all.sql`; vistas analíticas propias de V-Ai (Flota, Finanzas, Planta y Refinería) en `MVD-BOF-DTI-010 - VAi/01_SQL/02_Views/dw_v_dti_vai_*.sql`.
- Backend/SQL Kardex externo: carpeta `MVD-BOF-FIN-010 - Trazabilidad TRJ/02_SQL`. `server.js` contiene los bloques `FINANZAS KARDEX TRJ - HELPERS` y `FINANZAS KARDEX TRJ - ENDPOINTS`; tablas en `01_Tables/stg_all.sql` y una vista por archivo en `02_Views`. Orden de aplicación en `02_SQL/README_KARDEX_TRJ.md`.
- Lint acotado: `npx eslint <archivos TypeScript/TSX modificados>`.
- Validación integral: `npm run build`.
- Integridad del diff: `git diff --check` y `git status --short`.
- Preservar archivos modificados por el usuario que no pertenezcan a la tarea; al hacer commit, añadir rutas explícitas.

## Mantenimiento del mapa

Actualizar este archivo solo si cambia alguno de estos puntos: nueva ruta o módulo, componente propietario principal, ubicación de lógica compartida, familia de endpoints, autenticación o comandos de verificación. No copiar aquí reglas detalladas ya cubiertas por `AGENTS.md`.
