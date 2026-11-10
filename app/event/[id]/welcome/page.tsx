"use client";
import { use } from "react";
import EventWelcome from "@/app/components/EventWelcome";
export default function Welcome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <EventWelcome id={id} />;
}
