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
          <p>Siapkan dokumen di bawah ini sebelum mengajukan.</p>
        </div>
        {!fullRequirements && (
          <Link className="home-all-services" href="/pelayanan">
            Lihat semua layanan <ArrowRight size={22} aria-hidden="true" />
          </Link>
        )}
      </div>
      <ul className="home-service-list">
        {services.map((service) => (
          <li key={service.slug} className="home-service-item">
            <div className="home-service-copy">
              <h3>{service.title}</h3>
              {fullRequirements ? (
                <div className="service-full-requirements">
                  <p>Persyaratan</p>
                  <ul>
                    {service.requirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="home-service-requirements">
                  Syarat: {service.requirements.join(", ")}
                </p>
              )}
              <p className="home-service-time">{fullRequirements ? "Estimasi waktu: " : "Selesai "}{service.time}</p>
            </div>
            <Link
              className="home-service-apply"
              href={`/pelayanan/${service.slug}`}
              aria-label={`Ajukan ${service.title}`}
            >
              <span>Ajukan</span>
              <ChevronRight size={24} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
      <p className="home-service-note">Persyaratan dan waktu masih contoh.</p>
    </section>
  );
}
