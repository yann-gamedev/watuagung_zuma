"use client";

import { useEffect, useState } from "react";
import { videos } from "@/lib/data";
import { getSiteSection } from "@/services/site";
import type { SiteVideo as Video, SiteVideos } from "@/types/site";
import { YouTubeEmbed } from "./youtube-embed";

/** GET /site/videos di browser; demo/404/galat memakai `videos` lib/data.ts. Tanpa video → tidak dirender. */
export function SiteVideo({ slot, heading, className }: { slot: keyof SiteVideos; heading: string; className?: string }) {
  const [video, setVideo] = useState<Video | null>(videos[slot]);
  useEffect(() => {
    let active = true;
    getSiteSection("videos").then((result) => { if (active && result) setVideo(result[slot]); });
    return () => { active = false; };
  }, [slot]);
  if (!video) return null;
  const id = `video-${slot}-title`;
  return <section className={`site-video${className ? ` ${className}` : ""}`} aria-labelledby={id}>
    <h2 id={id}>{heading}</h2>
    <YouTubeEmbed key={video.youtubeId} youtubeId={video.youtubeId} title={video.title} />
    <p className="site-video-title">{video.title}</p>
  </section>;
}
