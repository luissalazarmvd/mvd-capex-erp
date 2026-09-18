// src/app/page.tsx
import type { ComponentProps } from "react";
import PortalPage from "./(portal)/page";

export default function Home(props: ComponentProps<typeof PortalPage>) {
  return <PortalPage {...props} />;
}
