# CLAUDE.md

**Este archivo no contiene reglas propias. Lee [`AGENTS.md`](AGENTS.md) y síguelo: manda AGENTS.md.**

Orden de arranque para cualquier tarea en este repositorio:

1. Leer `AGENTS.md` completo, una sola vez.
2. Leer `docs/REPOSITORY_MAP.md` antes de buscar o abrir código.
3. Limitar la inspección a la ruta, componente, librería y endpoint del flujo solicitado.

Si algo de este archivo llegara a contradecir a `AGENTS.md`, vale `AGENTS.md`.

Las reglas durables —arquitectura, auth y scopes, contratos de API, reglas de negocio por módulo, sistema visual y cobertura de filtros— viven en `AGENTS.md`. Actualízalo ahí, no aquí.

Verificación antes de dar por terminada una tarea: `npx eslint <archivos>` y `npm run build`.
