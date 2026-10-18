import { Suspense } from "react";
import { ApplicationDetail } from "@/features/admin/application-detail";

export default function Page() {
  return <Suspense fallback={<p role="status">Memuat detail permohonan...</p>}><ApplicationDetail /></Suspense>;
}
