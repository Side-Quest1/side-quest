"use client";
import dynamic from "next/dynamic";
const Connected = dynamic(() => import("../../connected"), { ssr: false });
export function ActivityClient({ id }: { id: string }) {
  return <Connected activityId={id} />;
}
