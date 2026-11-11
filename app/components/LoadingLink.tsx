"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import BlindcapLoading from "./BlindcapLoading";

function PendingNavigation() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="blindcap-navigation-status">
      <BlindcapLoading compact label="Opening page…" />
    </span>
  );
}

export default function LoadingLink({ children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <PendingNavigation />
    </Link>
  );
}
