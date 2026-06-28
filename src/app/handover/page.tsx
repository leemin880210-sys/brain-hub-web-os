import { Suspense } from "react";
import { HandoverClient } from "@/components/handover-client";

export default function HandoverPage() {
  return (
    <Suspense fallback={<main className="shell">Loading handover...</main>}>
      <HandoverClient />
    </Suspense>
  );
}
