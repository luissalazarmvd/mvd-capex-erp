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
| Acceso y scopes | `middleware.ts`, `src/lib/auth/session.ts` | Cookie `mvd_auth`, HMAC y guards por módulo |
| Login/logout general | `src/app/api/auth/*`, `src/lib/logout.ts` | Sesión del portal y cierre de sesión |
| Portal corporativo | `src/app/(portal)/page.tsx`, `src/app/(portal)/PortalClient.tsx` | Acceso inicial y `/api/access-check` |
| Cliente backend externo | `src/lib/apiClient.ts` | Base URL, `x-api-key`, GET/POST/download |
| UI compartida | `src/components/ui/*` | `Button`, `Input`, `Select`, `Table` |
| Estilos globales | `src/app/globals.css` | Tokens y clases compartidas |
| Shell global | `src/app/layout.tsx` | Fuentes, metadata y layout raíz |

## Módulos y entrypoints

| Módulo | Rutas | Componentes/lógica principales | API a localizar |
| --- | --- | --- | --- |
| CAPEX | `src/app/(capex)/projects`, `budget`, `forecast`, `progress`, `reports` | `src/components/capex/*`, `src/lib/types/capex.ts`, `src/lib/domain/*`, `src/lib/validation/*`; persistencia local en `src/lib/db/*` | Buscar las llamadas desde cada página/componente; no compartir payloads entre Budget, Forecast, Progress y WBS por su similitud visual |
| Planta | `src/app/planta/guardia`, `datos-guardia`, `leyes`, `carbon`, `reports` | `src/components/planta/*` | `/api/planta/*`; relaciones por `shift_id` |
| Refinería | `src/app/refinery/campaign`, `consumption`, `entries`, `production`, `reports` | `src/components/refinery/*` | `/api/refineria/*` (el backend usa `refineria`) |
| Trazabilidad | `src/app/traceability/upload`, `entries`, `status`, `conta` | `src/components/traceability/*` | `/api/traceability/*` y contratos localizados desde el formulario correspondiente |
| Compliance | `src/app/compliance/downloads/page.tsx` | `src/components/compliance/*` | `/api/compliance/*` y descargas de trazabilidad usadas por la vista |
| Logística | `src/app/logistics/downloads/page.tsx` | `src/components/logistics/*` | `/api/logistics/*` |
| Flota | `src/app/fleet/mgmt`, `units` | `src/components/fleet/FleetMgmForm.tsx`, `FleetUnitsPermits.tsx` | Buscar bajo `/api/logistics/flota/*` desde cada componente |
| Sostenibilidad | `src/app/sustainability/igafom`, `providers` | `src/components/sustainability/*` | `/api/sustainability/*` |
| Activos Fijos | `src/app/fixassets/new`, `catalogue`, `depreciation`, `export` | `src/components/fixassets/FixAssetsNew.tsx`, `FixAssetsCat.tsx`, `FixAssetsDepr.tsx`, `FixAssetsExport.tsx`, `FixAssetsAudit.tsx`, `FastCellInput.tsx` | `/api/actfij/*`; consultar la sección detallada de Activos Fijos en `AGENTS.md` antes de cambiar contratos o lifecycle |
| TI / eficiencia | `src/app/ti/page.tsx` | Página autocontenida con portfolio, cálculos, EN/FR y exportación Excel | Proxies locales en `src/app/api/ti-*`, `src/app/api/ai`, `src/app/api/web`; datos operativos externos `/api/dti/*` se localizan dentro de la página |

## Recetas de búsqueda acotada

- Cambio visual de una ruta: abrir `page.tsx`, seguir sus imports a `src/components/<módulo>` y buscar las clases exactas en `src/app/globals.css`.
- Cambio de datos o guardado: buscar `apiGet|apiPost|apiDownload|fetch` únicamente en la página y componente afectados; revisar el payload existente antes de modificarlo.
- Cambio de autenticación o acceso: revisar `middleware.ts`, `src/lib/auth/session.ts`, el layout del módulo y `src/app/api/auth/*`.
- Tabla editable: revisar el componente completo del flujo, su separación original/draft y `FastCellInput` cuando exista; no inferir reglas desde otra tabla.
- TI: comenzar y, salvo importaciones explícitas, permanecer en `src/app/ti/page.tsx`.
- Activos Fijos: abrir solo el componente de la subruta solicitada y luego los endpoints `/api/actfij/*` que ese componente invoque.

Ejemplos útiles:

```powershell
rg -n "api(Get|Post|Download)|fetch" src/app/<ruta> src/components/<modulo>
rg -n "<nombre_de_campo_o_endpoint>" src/app/<ruta> src/components/<modulo> src/lib
```

## Verificación y entrega

- Lint acotado: `npx eslint <archivos TypeScript/TSX modificados>`.
- Validación integral: `npm run build`.
- Integridad del diff: `git diff --check` y `git status --short`.
- Preservar archivos modificados por el usuario que no pertenezcan a la tarea; al hacer commit, añadir rutas explícitas.

## Mantenimiento del mapa

Actualizar este archivo solo si cambia alguno de estos puntos: nueva ruta o módulo, componente propietario principal, ubicación de lógica compartida, familia de endpoints, autenticación o comandos de verificación. No copiar aquí reglas detalladas ya cubiertas por `AGENTS.md`.
