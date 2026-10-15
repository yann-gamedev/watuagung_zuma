import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { services } from "@/lib/data";

export function ServiceList() {
  return (
    <section className="container home-services" aria-labelledby="services-title">
      <div className="home-section-heading">
        <div>
          <h2 id="services-title">Layanan surat yang tersedia</h2>
          <p>Siapkan dokumen di bawah ini sebelum mengajukan.</p>
        </div>
        <Link className="home-all-services" href="/pelayanan">
          Lihat semua layanan <ArrowRight size={22} aria-hidden="true" />
        </Link>
      </div>
      <ul className="home-service-list">
        {services.map((service) => (
          <li key={service.slug} className="home-service-item">
            <div className="home-service-copy">
              <h3>{service.title}</h3>
              <p className="home-service-requirements">
                Syarat: {service.requirements.join(", ")}
              </p>
              <p className="home-service-time">Selesai {service.time}</p>
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
