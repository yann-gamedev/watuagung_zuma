"use client";

import { contact, getContactLinks } from "@/lib/data";
import type { SiteContact } from "@/types/site";
import { Field, SiteForm } from "./site-form";
import styles from "./news.module.css";

const labels = { address: "Alamat", hours: "Jam pelayanan", contactName: "Nama kontak", phone: "Nomor", mapsEmbedUrl: "URL sematan peta", mapsLinkUrl: "Link Google Maps" };

export function ContactEditor() {
  return <SiteForm section="contact" name="kontak kantor" publicHref="/kontak/" initial={contact} labels={labels}
    intro={<p>Kosongkan nomor atau peta yang belum tersedia. Website lalu menampilkan &quot;Nomor kontak segera diumumkan.&quot; dan tidak menampilkan peta.</p>}>
    {(value: SiteContact, setValue) => {
      const set = (key: keyof SiteContact) => (next: string) => setValue({ ...value, [key]: next });
      const { mapsEmbedUrl } = getContactLinks(value);
      return <>
        <Field path="address" label="Alamat" value={value.address} max={1000} multiline hint="Alamat kantor desa seperti tertulis di papan nama." onChange={set("address")} />
        <Field path="hours" label="Jam pelayanan" value={value.hours} max={200} hint="Contoh: Hari kerja, 08.00–13.00 WIB. Tulis nama hari hanya bila sudah dipastikan." onChange={set("hours")} />
        <Field path="contactName" label="Nama kontak" value={value.contactName} max={160} hint="Nama layanan atau petugas yang sudah memberi izin namanya ditampilkan." onChange={set("contactName")} />
        <Field path="phone" label="Nomor" value={value.phone} max={15} optional inputMode="numeric"
          hint="Format 62…, contoh 6281234567890. Hanya angka, tanpa +, spasi, atau tanda hubung. Nomor ini dipakai untuk telepon dan WhatsApp; jangan isi nomor rekaan." onChange={set("phone")} />
        <Field path="mapsEmbedUrl" label="URL sematan peta" value={value.mapsEmbedUrl} max={2048} optional inputMode="url"
          hint="Di Google Maps: cari Balai Desa → Bagikan → Sematkan peta → salin isi src saja (diawali https://www.google.com/maps/embed?), bukan seluruh kode iframe." onChange={set("mapsEmbedUrl")} />
        {mapsEmbedUrl && <figure className={styles.mapPreview}>
          <iframe src={mapsEmbedUrl} title="Pratinjau peta kantor desa" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          <figcaption>Pratinjau peta</figcaption>
        </figure>}
        <Field path="mapsLinkUrl" label="Link Google Maps" value={value.mapsLinkUrl} max={2048} optional inputMode="url"
          hint="Di Google Maps: Bagikan → Salin link (diawali https://maps.app.goo.gl/ atau https://www.google.com/maps/). Dipakai untuk tombol Buka di Google Maps." onChange={set("mapsLinkUrl")} />
      </>;
    }}
  </SiteForm>;
}
