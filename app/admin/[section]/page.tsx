import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ApplicationsTable } from "@/features/admin/applications-table";
// Hanya modul yang sudah berfungsi. Halaman konten dibuat ulang saat modulnya dikerjakan.
const sections = ["permohonan", "surat", "persetujuan"] as const;
type Section = (typeof sections)[number];
export const dynamicParams = false;
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section as Section)) notFound();
  return <Suspense fallback={<p role="status">Memuat daftar permohonan…</p>}>
    <ApplicationsTable key={section} section={section as Section} />
  </Suspense>;
}
