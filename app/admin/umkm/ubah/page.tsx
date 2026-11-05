import { Suspense } from "react";
import { BusinessEditPage } from "@/features/admin/business-editor";

export const metadata = { title: "Sunting UMKM" };
export default function Page() {
  return <Suspense fallback={<p role="status">Memuat UMKM…</p>}><BusinessEditPage /></Suspense>;
}
