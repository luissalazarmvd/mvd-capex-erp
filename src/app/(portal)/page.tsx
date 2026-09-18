// src/app/(portal)/page.tsx
import PortalClient from "./PortalClient";

type PortalPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

// `next` se resuelve en el servidor en lugar de useSearchParams: así la
// cabecera con el logo VAi viaja en el HTML y su animación no se reinicia
// cuando el cliente hidrata.
export default async function PortalPage({ searchParams }: PortalPageProps) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : null;
  return <PortalClient nextPath={nextPath} />;
}
