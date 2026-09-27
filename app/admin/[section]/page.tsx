import { notFound } from "next/navigation";
import { AdminDashboard } from "@/features/admin/dashboard";
const sections = [
  "permohonan",
  "surat",
  "berita",
  "pengumuman",
  "potensi",
  "statistik",
  "pengaturan",
];
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <AdminDashboard section={section} />;
}
