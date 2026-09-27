import { notFound } from "next/navigation";
import { services } from "@/lib/data";
import { PageHeading, PublicShell } from "@/components/site";
import { ApplicationForm } from "@/features/pelayanan/application-form";
export function generateStaticParams() {
  return services.map((s) => ({ service: s.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  return {
    title: services.find((s) => s.slug === service)?.title || "Layanan",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  const item = services.find((s) => s.slug === service);
  if (!item) notFound();
  return (
    <PublicShell>
      <PageHeading
        eyebrow="PENGAJUAN LAYANAN"
        title={item.title}
        intro="Isi data berikut dengan lengkap. Simpan nomor pengajuan untuk memantau proses pelayanan."
      />
      <section className="section container">
        <ApplicationForm code={item.code} />
      </section>
    </PublicShell>
  );
}
