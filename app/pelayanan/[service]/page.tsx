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
        parent={{ label: "Pelayanan Desa", href: "/pelayanan" }}
      />
      <section className="section container service-page service-detail">
        <aside className="service-preparation" aria-labelledby="preparation-title">
          <h2 id="preparation-title">Siapkan dulu</h2>
          <ul>
            {item.requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
          <p className="service-estimate"><strong>Estimasi waktu:</strong> {item.time}</p>
          <p className="service-example">Persyaratan dan estimasi waktu ini masih contoh, bukan ketentuan resmi desa. Gunakan data fiktif saat mencoba formulir.</p>
        </aside>
        <ApplicationForm code={item.code} />
      </section>
    </PublicShell>
  );
}
