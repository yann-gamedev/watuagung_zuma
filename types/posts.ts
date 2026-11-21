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
/** Tautan unggahan berita yang sama di media sosial (opsional per berita). Server membatasi https + host resmi. */
export const socialPlatforms = ["instagram", "tiktok", "youtube", "facebook"] as const;
export type SocialPlatform = (typeof socialPlatforms)[number];
export type SocialLinkColumn = `${SocialPlatform}_url`;

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
/** Foto tambahan di dalam artikel; rasio asli, tampil setelah paragraf ke-1/2/3. */
export interface PublicPostImage {
  url: string;
  caption: string | null;
}
export interface StaffPostImage extends PublicPostImage {
  id: number;
}
export interface PublicPostDetail extends PublicPost {
  body: string;
  images: PublicPostImage[];
  /** true: tampilkan "© {tahun terbit} KIM Desa Watuagung" di akhir berita. */
  show_copyright: boolean;
  /** Hanya platform yang terisi; `{}` bila tidak ada. */
  social_links: Partial<Record<SocialPlatform, string>>;
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
export interface StaffPostDetail extends StaffPost, Record<SocialLinkColumn, string | null> {
  body: string;
  images: StaffPostImage[];
  created_at: string;
  show_copyright: boolean;
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
/** POST /staff/posts/{id}/images: multipart `file` + `caption` opsional (maks. 3 foto per berita). */
export interface StaffPostImageInput {
  file: File;
  caption?: string;
}
/** PATCH /staff/posts/{id}/images/{imageId}: `caption` null atau string ≤200 karakter. */
export interface StaffPostImageCaptionInput {
  caption: string | null;
}
/** Semua mutasi foto tambahan mengembalikan detail berita terbaru. */
export type StaffPostImageResponse = StaffPostDetail;

/** POST /staff/posts (semua wajib); PATCH /staff/posts/{id} (sebagian). */
export interface StaffPostInput {
  title: string;
  category: PostCategory;
  summary: string;
  body: string;
  status: PostStatus;
  /** Opsional; bawaan false. */
  show_copyright?: boolean;
  /** Opsional; null atau "" mengosongkan. https dan host resmi platform, maks. 500 karakter (lainnya 422). */
  instagram_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  facebook_url?: string | null;
}
