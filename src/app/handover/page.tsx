import { Suspense } from "react";
import { HandoverClient } from "@/components/handover-client";

export default function HandoverPage() {
  return (
    <Suspense fallback={<main className="shell">正在加载接管数据...</main>}>
      <HandoverClient />
    </Suspense>
  );
}
