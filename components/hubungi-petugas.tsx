"use client";
import { MessageCircle } from "lucide-react";
import { useContact } from "@/components/office-contact";
import { getContactLinks } from "@/lib/data";

export function HubungiPetugas({ requestId }: { requestId?: string }) {
  const contact = useContact();
  const { phone } = getContactLinks(contact);
  const message = "Halo, saya butuh bantuan pengajuan surat di website Desa Watuagung."
    + (requestId && /^REQ-\d{4}-[A-Z0-9]{6,36}$/.test(requestId) && requestId === requestId.trim() ? ` Nomor pengajuan: ${requestId}.` : "");

  return (
    <div className="content-card">
      <h3>Hubungi Petugas</h3>
      <p>{contact.contactName}</p>
      <p>{contact.hours}</p>
      {phone ? (
        <a className="btn btn-secondary" href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={22} aria-hidden="true" /> Chat WhatsApp
          <span className="sr-only"> (dibuka di tab baru)</span>
        </a>
      ) : (
        <><p>Nomor kontak segera diumumkan. Silakan hubungi kantor desa.</p><p>{contact.address}</p></>
      )}
      <p>Jangan kirim kode akses rahasia, NIK, atau nomor KK melalui WhatsApp.</p>
    </div>
  );
}
