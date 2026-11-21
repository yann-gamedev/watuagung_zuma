import type { SocialPlatform } from "@/types/posts";

/**
 * Cermin tampilan dari backend/app/Domain/SocialPlatform.php; server tetap yang memutuskan.
 * Dipakai untuk pesan galat di panel dan untuk menyaring respons publik sebelum dijadikan tautan.
 */
export const socialPlatformInfo: Record<SocialPlatform, { label: string; hosts: readonly string[]; example: string }> = {
  instagram: { label: "Instagram", hosts: ["instagram.com", "www.instagram.com"], example: "https://www.instagram.com/p/…" },
  tiktok: { label: "TikTok", hosts: ["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"], example: "https://www.tiktok.com/@…/video/…" },
  youtube: { label: "YouTube", hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"], example: "https://youtu.be/…" },
  facebook: { label: "Facebook", hosts: ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch"], example: "https://www.facebook.com/…" },
};

export function isSocialLink(platform: SocialPlatform, value: string): boolean {
  if (value.length > 500 || !URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.port && socialPlatformInfo[platform].hosts.includes(url.hostname.toLowerCase());
}
