/** Cermin SiteSectionRules::youtubeId (server tetap penentu; 422 bila beda). */
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const youtubeHosts = ["youtube.com", "www.youtube.com", "m.youtube.com"];

/** ID 11 karakter dari youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/; selain itu null. */
export function youtubeId(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 2048 || /[\s\p{Cc}]/u.test(text) || !URL.canParse(text)) return null;
  const url = new URL(text);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
  let id: string | null = null;
  if (url.hostname === "youtu.be") id = url.pathname.match(/^\/([^/]+)\/?$/)?.[1] ?? null;
  else if (youtubeHosts.includes(url.hostname)) {
    if (/^\/watch\/?$/.test(url.pathname)) id = url.searchParams.get("v");
    else id = url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)\/?$/)?.[1] ?? null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export const youtubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeThumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const youtubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
