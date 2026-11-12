"use client";

import { YouTubeEmbed } from "@/components/youtube-embed";
import { videos } from "@/lib/data";
import { youtubeId, youtubeWatchUrl } from "@/lib/youtube";
import type { SiteVideoInput, SiteVideos, SiteVideosInput } from "@/types/site";
import { Field, SiteForm } from "./site-form";
import styles from "./news.module.css";

const empty: SiteVideoInput = { url: "", title: "" };
const slots = [
  { slot: "profile", title: "Video profil desa", place: "beranda (di atas Kabar desa) dan halaman Profil Desa" },
  { slot: "tutorial", title: "Video tutorial pengajuan surat", place: "halaman Pelayanan Desa, di atas Layanan surat yang tersedia" },
] as const;
const labels = { profile: "Video profil desa", tutorial: "Video tutorial pengajuan surat", url: "Link YouTube", title: "Judul video" };

// Server menyimpan ID saja; panel menampilkannya kembali sebagai link watch. Link + judul kosong = tanpa video.
const toInput = (data: SiteVideos): SiteVideosInput => ({
  profile: data.profile ? { url: youtubeWatchUrl(data.profile.youtubeId), title: data.profile.title } : empty,
  tutorial: data.tutorial ? { url: youtubeWatchUrl(data.tutorial.youtubeId), title: data.tutorial.title } : empty,
});

export function VideoEditor() {
  return <SiteForm section="videos" name="video" publicHref="/profil/" initial={toInput(videos)} prepare={toInput} labels={labels}
    intro={<p>Unggah video ke kanal YouTube resmi desa lebih dulu, lalu tempel link-nya di sini. Website hanya memuat video setelah warga menekan tombol putar.</p>}>
    {(value, setValue) => <>{slots.map(({ slot, title, place }) => {
      const video = value[slot] ?? empty;
      const set = (next: SiteVideoInput) => setValue({ ...value, [slot]: next });
      const id = youtubeId(video.url);
      return <fieldset className={styles.fields} key={slot}><legend>{title}</legend>
        <p>Tampil di {place}. Kosongkan bila belum ada video; bagian ini tidak ditampilkan di website.</p>
        <Field path={`${slot}.url`} label="Link YouTube" value={video.url} max={2048} optional inputMode="url"
          hint="Di YouTube: Bagikan → Salin link. Bisa link youtube.com/watch?v=…, youtu.be/…, youtube.com/shorts/…, atau youtube.com/embed/…."
          onChange={(url) => set({ ...video, url })} />
        <Field path={`${slot}.title`} label="Judul video" value={video.title} max={160} optional
          hint="Dibaca pembaca layar dan tampil di bawah video. Contoh: Profil Desa Watuagung."
          onChange={(text) => set({ ...video, title: text })} />
        {id ? <div>
          <p>Pratinjau</p>
          <YouTubeEmbed key={id} youtubeId={id} title={video.title || title} />
        </div> : video.url.trim() && <p>Pratinjau muncul setelah link YouTube valid.</p>}
        <div className={styles.actions}>
          <button type="button" className="btn btn-secondary" disabled={!video.url && !video.title} onClick={() => set(empty)}>
            Hapus video<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        </div>
      </fieldset>;
    })}</>}
  </SiteForm>;
}
