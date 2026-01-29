// src/app/api/projects/meta/route.ts
import { NextResponse } from "next/server";
import {
  getProjectTree,
  getProjects,
  getInvClasses,
  getPriorities,
  getProjAreas,
  getProjConditions,
  getProjGroups,
} from "../../../../lib/db/queries";

export const runtime = "nodejs";

export async function GET() {
  const [treeRows, projects, inv_classes, priorities, proj_areas, proj_conditions, proj_groups] =
    await Promise.all([
      getProjectTree(),
      getProjects(),
      getInvClasses(),
      getPriorities(),
      getProjAreas(),
      getProjConditions(),
      getProjGroups(),
    ]);

  // flat -> tree
  const map = new Map<string, { project_code: string; project_name: string; wbs: { wbs_code: string; wbs_name: string }[] }>();

  for (const r of treeRows) {
    if (!map.has(r.project_code)) {
      map.set(r.project_code, {
        project_code: r.project_code,
        project_name: r.project_name,
        wbs: [],
      });
    }
    if (r.wbs_code) {
      map.get(r.project_code)!.wbs.push({
        wbs_code: r.wbs_code,
        wbs_name: r.wbs_name,
      });
    }
  }

  const tree = Array.from(map.values()).sort((a, b) =>
    a.project_code.localeCompare(b.project_code)
  );

  for (const p of tree) {
    p.wbs.sort((a, b) => a.wbs_code.localeCompare(b.wbs_code));
  }

  return NextResponse.json({
    ok: true,
    tree,
    projects,
    lookups: {
      inv_classes,
      priorities,
      proj_areas,
      proj_conditions,
      proj_groups,
    },
  });
}
