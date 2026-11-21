import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { services } from "@/lib/data";

export function ServiceList({ fullRequirements = false }: { fullRequirements?: boolean }) {
  return (
    <section
      className={fullRequirements ? "service-catalog" : "container home-services"}
      aria-labelledby="services-title"
    >
      <div className="home-section-heading">
        <div>
          <h2 id="services-title">Layanan surat yang tersedia</h2>
          <p>Pilih jenis surat dan baca persyaratan pengajuannya.</p>
        </div>
        {!fullRequirements && (
          <Link className="home-all-services" href="/pelayanan">
            Lihat semua layanan <ArrowRight size={22} aria-hidden="true" />
          </Link>
        )}
      </div>
      <ul className="home-service-list">
        {services.map((service) => {
          const office = service.mode === "office";
          return (
          <li key={service.slug} className="home-service-item">
            <div className="home-service-copy">
              <h3>{service.title}</h3>
              {office && <span className="task-badge">Layanan di kantor</span>}
              {fullRequirements ? (
                <div className="service-full-requirements">
                  <p>{office ? "Dokumen yang dibawa ke Balai Desa — menunggu konfirmasi desa" : "Persyaratan sementara — menunggu konfirmasi desa"}</p>
                  <ul>
                    {service.requirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="home-service-requirements">
                  {office ? "Dibawa ke Balai Desa" : "Syarat sementara"}: {service.requirements.join(", ")}
                </p>
              )}
              <p className="home-service-time">Waktu pelayanan: {service.time}</p>
            </div>
            <Link
              className="home-service-apply"
              href={`/pelayanan/${service.slug}`}
              aria-label={office ? `${service.title}: datang ke Balai Desa` : `Ajukan ${service.title} online`}
            >
              <span>{office ? "Datang ke Balai Desa" : "Ajukan online"}</span>
              <ChevronRight size={24} aria-hidden="true" />
            </Link>
          </li>
          );
        })}
      </ul>
      <p className="home-service-note">Untuk layanan online, unggah tiga dokumen persyaratan, lalu unduh surat melalui Cek Status Surat setelah tersedia. Izin Keramaian diurus langsung di Balai Desa.</p>
    </section>
  );
}
