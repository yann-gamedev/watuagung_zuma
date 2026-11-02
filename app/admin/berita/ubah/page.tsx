import { Suspense } from "react";
import { NewsEditPage } from "@/features/admin/news-editor";

export default function Page() {
  return <Suspense fallback={<p role="status">Memuat berita…</p>}><NewsEditPage /></Suspense>;
}
