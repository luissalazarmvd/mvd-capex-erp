// src/lib/validation/wbs.ts
export function isProjectCode(x: string): boolean {
  return /^\d{2}$/.test(String(x ?? "").trim());
}

export function isWbsCode(x: string): boolean {
  return /^\d{2}\.\d{2}$/.test(String(x ?? "").trim());
}

export function wbsBelongsToProject(wbs_code: string, project_code: string): boolean {
  const w = String(wbs_code ?? "").trim();
  const p = String(project_code ?? "").trim();
  if (!isWbsCode(w) || !isProjectCode(p)) return false;
  return w.startsWith(p + ".");
}
