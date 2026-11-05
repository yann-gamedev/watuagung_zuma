"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { YOUTUBE_ID, youtubeEmbedUrl, youtubeThumbnailUrl } from "@/lib/youtube";

/**
 * Gambar mini dulu; iframe youtube-nocookie baru dimuat setelah tombol diklik (hemat kuota).
 * Pasang `key={youtubeId}` di pemanggil agar video baru kembali ke gambar mini.
 */
export function YouTubeEmbed({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => { if (playing) frame.current?.focus(); }, [playing]);
  if (!YOUTUBE_ID.test(youtubeId)) return null;
  return <div className="youtube-embed">
    {playing ? <iframe ref={frame} src={youtubeEmbedUrl(youtubeId)} title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      : <button type="button" className="youtube-embed-play" onClick={() => setPlaying(true)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- gambar mini YouTube eksternal, static export */}
        <img src={youtubeThumbnailUrl(youtubeId)} alt="" loading="lazy" decoding="async" />
        <span className="youtube-embed-label"><Play size={24} aria-hidden="true" />Putar video<span className="sr-only">: {title}</span></span>
      </button>}
  </div>;
}
