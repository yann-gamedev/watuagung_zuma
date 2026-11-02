import { contact, getContactLinks } from "@/lib/data";

export function ContactNumber() {
  const { phone } = getContactLinks();
  return (
    <div className="contact-number">
      <p>{contact.contactName}</p>
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
  const { mapsEmbedUrl, mapsLinkUrl } = getContactLinks();
  return (
    <div className={`home-contact-card${mapsEmbedUrl ? " has-map" : ""}`}>
      <div>
        <h2 id={titleId}>Kantor Desa Watuagung</h2>
        <p>{contact.address}</p>
        <p>{contact.hours}</p>
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
