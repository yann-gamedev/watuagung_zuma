import { Suspense } from "react";
import { PublicShell } from "@/components/site";
import { BusinessDetailPage } from "@/features/umkm/business-detail";

export const metadata = { title: "UMKM Watuagung" };
export default function Page() {
  return <PublicShell><Suspense fallback={<section className="section container"><p role="status">Memuat UMKM…</p></section>}><BusinessDetailPage /></Suspense></PublicShell>;
}
