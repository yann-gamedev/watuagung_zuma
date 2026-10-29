/** Kontrak API berita (C1–C2). Lihat docs/integrasi.md § Berita. */
export const postCategories = [
  "kegiatan_desa",
  "pemerintahan",
  "pembangunan",
  "pemberdayaan",
  "layanan_publik",
  "ekonomi_lokal",
  "pengumuman",
] as const;
export type PostCategory = (typeof postCategories)[number];
export type PostStatus = "draft" | "published";

/** Item GET /posts. `body` hanya di detail; teks biasa, render sebagai teks (bukan HTML). */
export interface PublicPost {
  slug: string;
  title: string;
  category: PostCategory;
  category_label: string;
  summary: string;
  published_at: string;
  /** URL publik sampul hasil encode ulang; null bila belum ada atau dihapus. */
  cover_url: string | null;
}
export interface PublicPostDetail extends PublicPost {
  body: string;
}
export interface PublicPostsPage {
  data: PublicPost[];
  current_page: number;
  last_page: number;
  total: number;
}

/** GET /staff/posts: semua status kecuali terhapus; `published_at` null bila belum pernah terbit. */
export interface StaffPost extends Omit<PublicPost, "published_at"> {
  id: number;
  status: PostStatus;
  published_at: string | null;
  updated_at: string;
}
export interface StaffPostDetail extends StaffPost {
  body: string;
  created_at: string;
}
export interface StaffPostsPage {
  data: StaffPost[];
  current_page: number;
  last_page: number;
  total: number;
}
/** POST /staff/posts/{id}/cover: kirim file lewat FormData, jangan tetapkan Content-Type sendiri. */
export interface StaffPostCoverInput {
  file: File;
}
/** POST dan DELETE /staff/posts/{id}/cover: 200, detail lengkap dengan cover_url terbaru. */
export type StaffPostCoverResponse = StaffPostDetail;

/** POST /staff/posts (semua wajib); PATCH /staff/posts/{id} (sebagian). */
export interface StaffPostInput {
  title: string;
  category: PostCategory;
  summary: string;
  body: string;
  status: PostStatus;
}
