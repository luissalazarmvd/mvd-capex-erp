"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { logoutAndReturnToPortal } from "@/src/lib/logout";

type LogoutLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "href" | "onClick"
> & {
  children: ReactNode;
};

export default function LogoutLink({ children, ...props }: LogoutLinkProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (loggingOut) return;

    setLoggingOut(true);
    await logoutAndReturnToPortal();
  }

  return (
    <Link
      {...props}
      href="/"
      prefetch={false}
      aria-disabled={loggingOut || undefined}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
