/** Kontrak API direktori UMKM warga. Lihat docs/integrasi.md § UMKM. */
export const businessCategories = [
  "makanan_minuman",
  "kerajinan",
  "pertanian_peternakan",
  "jasa",
  "perdagangan",
  "lainnya",
] as const;
export type BusinessCategory = (typeof businessCategories)[number];
export const businessHamlets = ["Watuagung", "Talang", "Sekar"] as const;
export type BusinessHamlet = (typeof businessHamlets)[number];
export type BusinessStatus = "draft" | "published";

/**
 * Item GET /businesses dan GET /businesses/{slug}. `description` teks biasa (render sebagai teks, bukan HTML).
 * `owner_name` dan `whatsapp` HANYA ada bila pemilik memberi izin; tanpa izin key-nya tidak dikirim sama sekali.
 */
export interface PublicBusiness {
  slug: string;
  name: string;
  category: BusinessCategory;
  category_label: string;
  description: string;
  hamlet: BusinessHamlet | null;
  /** URL publik foto hasil encode ulang; null bila belum ada. */
  photo_url: string | null;
  published_at: string;
  owner_name?: string | null;
  /** Format 62… digit saja; pakai untuk tautan wa.me. */
  whatsapp?: string | null;
}
export interface PublicBusinessesPage {
  data: PublicBusiness[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** GET /staff/businesses: semua status kecuali terhapus. Tanpa deskripsi dan TANPA kontak pemilik. */
export interface StaffBusiness extends Omit<PublicBusiness, "published_at" | "description" | "owner_name" | "whatsapp"> {
  id: number;
  status: BusinessStatus;
  published_at: string | null;
  consent_public_contact: boolean;
  updated_at: string;
}
/** GET/POST/PATCH /staff/businesses/{id}, POST/DELETE …/photo. */
export interface StaffBusinessDetail extends StaffBusiness {
  description: string;
  owner_name: string | null;
  whatsapp: string | null;
  created_at: string;
}
export interface StaffBusinessesPage {
  data: StaffBusiness[];
  current_page: number;
  last_page: number;
  total: number;
}

/** POST /staff/businesses (name, category, description, status wajib); PATCH /staff/businesses/{id} (sebagian). */
export interface StaffBusinessInput {
  name: string;
  category: BusinessCategory;
  description: string;
  status: BusinessStatus;
  hamlet?: BusinessHamlet | null;
  owner_name?: string | null;
  whatsapp?: string | null;
  /** Bawaan false. Wajib atas izin tertulis/lisan pemilik sebelum dicentang. */
  consent_public_contact?: boolean;
}
/** POST /staff/businesses/{id}/photo: FormData `file`, jangan tetapkan Content-Type sendiri. */
export interface StaffBusinessPhotoInput {
  file: File;
}
export type StaffBusinessPhotoResponse = StaffBusinessDetail;
