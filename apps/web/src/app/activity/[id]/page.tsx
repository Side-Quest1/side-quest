import { Suspense } from "react";
import { ActivityClient } from "./view";

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ActivityClient id={id} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Loading activity…</p>}>
      <Detail params={params} />
    </Suspense>
  );
}
