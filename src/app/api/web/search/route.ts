import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOW_DOMAINS = [
  "learn.microsoft.com",
  "support.microsoft.com",
  "docs.microsoft.com",
  "cisco.com",
  "fortinet.com",
  "paloaltonetworks.com",
  "dell.com",
  "hp.com",
  "lenovo.com",
  "logitech.com",
  "intel.com",
  "amd.com",
];

function hostFromUrl(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isAllowed(url: string) {
  const host = hostFromUrl(url);
  if (!host) return false;
  return ALLOW_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();

    // placeholder: si no hay query, normal
    if (!q) return NextResponse.json({ ok: true, data: [] });

    const BRAVE_KEY = process.env.BRAVE_SEARCH_API_KEY?.trim();

    // placeholder: si no hay key, no falles
    if (!BRAVE_KEY) return NextResponse.json({ ok: true, data: [] });

    const siteFilter = ALLOW_DOMAINS.map((d) => `site:${d}`).join(" OR ");
    const query = `(${siteFilter}) ${q}`.slice(0, 450);

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(
      query
    )}&count=8&search_lang=es`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": BRAVE_KEY,
      },
      cache: "no-store",
    });

    // placeholder: si Brave falla, no mates tu app
    if (!r.ok) return NextResponse.json({ ok: true, data: [] });

    const json = await r.json();
    const results = (json?.web?.results ?? []) as Array<any>;

    const data = results
      .map((x) => {
        const url = String(x?.url ?? "");
        return {
          title: String(x?.title ?? "").trim(),
          url,
          snippet: String(x?.description ?? "").trim(),
          host: hostFromUrl(url),
        };
      })
      .filter((x) => x.url && isAllowed(x.url))
      .slice(0, 3);

    return NextResponse.json({ ok: true, data });
  } catch {
    // placeholder: no crash
    return NextResponse.json({ ok: true, data: [] });
  }
}