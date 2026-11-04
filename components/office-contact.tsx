"use client";
import { createContext, useContext } from "react";
import { contact, getContactLinks } from "@/lib/data";
import type { SiteContact } from "@/types/site";

/** Nilai awal statis lib/data.ts; ContactProvider menimpanya dengan data API. */
export const ContactContext = createContext<SiteContact>(contact);
export const useContact = () => useContext(ContactContext);

// Untuk server component (task panel, kebijakan privasi) yang tidak bisa memanggil hook.
export function ContactAddress() {
  return <>{useContact().address}</>;
}
export function ContactHours() {
  return <>{useContact().hours}</>;
}

export function ContactNumber() {
  const values = useContact();
  const { phone } = getContactLinks(values);
  return (
    <div className="contact-number">
      <p>{values.contactName}</p>
      {phone ? (
        <div className="contact-actions">
          <a href={`tel:+${phone}`}>+{phone}</a>
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">
            Chat WhatsApp<span className="sr-only"> (dibuka di tab baru)</span>
          </a>
        </div>
      ) : (
        <p>Nomor kontak segera diumumkan.</p>
      )}
    </div>
  );
}

export function OfficeContact({ titleId }: { titleId?: string }) {
  const values = useContact();
  const { mapsEmbedUrl, mapsLinkUrl } = getContactLinks(values);
  return (
    <div className={`home-contact-card${mapsEmbedUrl ? " has-map" : ""}`}>
      <div>
        <h2 id={titleId}>Kantor Desa Watuagung</h2>
        <p>{values.address}</p>
        <p>{values.hours}</p>
        <ContactNumber />
        {mapsLinkUrl && (
          <a className="home-bottom-button" href={mapsLinkUrl} target="_blank" rel="noopener noreferrer">
            Buka di Google Maps<span className="sr-only"> (dibuka di tab baru)</span>
          </a>
        )}
      </div>
      {mapsEmbedUrl && (
        <iframe
          className="home-contact-map"
          src={mapsEmbedUrl}
          title="Peta lokasi Balai Desa Watuagung"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
}
