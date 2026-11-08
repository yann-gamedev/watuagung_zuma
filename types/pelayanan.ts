/** Kontrak sampul berita tersedia bersama tipe berita; multipart, bukan JSON. */
export type { StaffPostCoverInput, StaffPostCoverResponse } from "./posts";
export type { BusinessCategory, BusinessHamlet, BusinessStatus, PublicBusiness, PublicBusinessesPage, StaffBusiness, StaffBusinessDetail, StaffBusinessesPage, StaffBusinessInput, StaffBusinessPhotoInput, StaffBusinessPhotoResponse } from "./business";
export type { SiteSectionKey, EditableSiteSectionKey, SiteSectionData, SiteSectionResponse, SiteSectionUpdate, SiteSectionInput, SiteVideo, SiteVideos, SiteVideoInput, SiteVideosInput, SiteSectionImageResponse, SiteSectionDocumentResponse, SiteTransparency, SiteStructure, SiteBudget, SiteBudgetLine } from "./site";

export const statuses = [
  "SUBMITTED",
  "RT_APPROVED",
  "RW_APPROVED",
  "VERIFIED",
  "PROCESSING",
  "WAITING_APPROVAL",
  "APPROVED",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "REJECTED",
  "NEED_REVISION",
] as const;
export type Status = (typeof statuses)[number];
/** Semua kode jenis surat yang dapat muncul di data (cermin `LetterType.php`). */
export const serviceCodes = ["SKU", "DOMISILI", "SKTM", "KTP_KK", "BELUM_MENIKAH", "KERAMAIAN", "KEHILANGAN", "UMUM"] as const;
export type ServiceCode = (typeof serviceCodes)[number];
/** Jenis yang dapat diajukan; SKU dan KTP_KK hanya ada pada data lama (POST = 422). */
export const offeredServiceCodes = ["DOMISILI", "SKTM", "BELUM_MENIKAH", "KERAMAIAN", "KEHILANGAN", "UMUM"] as const satisfies readonly ServiceCode[];
export type OfferedServiceCode = (typeof offeredServiceCodes)[number];
/** Pilihan baku pengajuan; validasi sebenarnya di `backend/app/Domain/LetterSubmission.php`. */
export const dusunOptions = ["Watuagung", "Talang", "Sekar"] as const;
export const agamaOptions = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Kepercayaan terhadap Tuhan YME"] as const;
export const kewarganegaraanOptions = ["WNI", "WNA"] as const;
export const statusPerkawinanOptions = ["Belum Kawin", "Kawin", "Cerai Hidup", "Cerai Mati"] as const;
export const pendidikanOptions = [
  "Tidak/Belum Sekolah", "Belum Tamat SD/Sederajat", "Tamat SD/Sederajat", "SLTP/Sederajat", "SLTA/Sederajat",
  "Diploma I/II", "Akademi/Diploma III/Sarjana Muda", "Diploma IV/Strata I", "Strata II", "Strata III",
] as const;
export type Dusun = (typeof dusunOptions)[number];
export type Agama = (typeof agamaOptions)[number];
export type Kewarganegaraan = (typeof kewarganegaraanOptions)[number];
export type StatusPerkawinan = (typeof statusPerkawinanOptions)[number];
export type Pendidikan = (typeof pendidikanOptions)[number];
export type StaffLoginRequest = { password: string } & (
  | { username: string; email?: never }
  | { email: string; username?: never }
);
export type StaffRole = "staff" | "village_head" | "admin" | "rt_head" | "rw_head";
/** Metadata daftar petugas; tidak memuat NIK, KK, telepon, atau alamat. */
export interface StaffApplication {
  request_id: string;
  nama: string;
  jenis_surat: ServiceCode;
  status: Status;
  created_at: string;
  allowed_transitions: Status[];
  can_reset_access_code: boolean;
}
export interface StaffApplicationEvent {
  /**
   * null = perubahan status; ACCESS_CODE_RESET = kode akses dibuat ulang; STATEMENT_EDITED = isi keterangan UMUM
   * disunting (note "Isi keterangan disunting"). Keduanya tanpa perubahan status.
   */
  action: "ACCESS_CODE_RESET" | "STATEMENT_EDITED" | null;
  from_status: Status | null;
  to_status: Status;
  note: string | null;
  staff_name: string | null;
  created_at: string;
}
/** Hanya respons detail terotorisasi; jangan simpan ke storage atau log. */
export interface StaffApplicationDetail extends StaffApplication, Pick<Submission, "nama" | "nik" | "no_kk" | "alamat" | "rt" | "rw" | "keperluan"> {
  telepon?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin?: string;
  /** Hanya peran kantor; agama dan status perkawinan didekripsi server. null pada data lama. */
  agama?: Agama | null;
  status_perkawinan?: StatusPerkawinan | null;
  kewarganegaraan?: Kewarganegaraan | null;
  pendidikan?: Pendidikan | null;
  pekerjaan?: string | null;
  /** null pada data lama (sebelum enam jenis surat final). */
  dusun: Dusun | null;
  barang_hilang: string | null;
  acara: string | null;
  tempat_acara: string | null;
  /** "YYYY-MM-DD". */
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  jenis_hiburan: string | null;
  /** Versi yang dicetak; dapat disunting petugas. */
  isi_keterangan: string | null;
  /** Teks asli dari warga, tidak pernah berubah. */
  isi_keterangan_awal: string | null;
  /** Dari server: UMUM, peran staff/admin, status sebelum WAITING_APPROVAL. */
  can_edit_isi_keterangan: boolean;
  nama_usaha: string | null;
  jenis_usaha: string | null;
  alamat_usaha: string | null;
  catatan: string | null;
  updated_at: string;
  can_reset_access_code: boolean;
  history: StaffApplicationEvent[];
  /** Hanya peran kantor; nomor batal tetap tersimpan. */
  letter_numbers?: LetterNumber[];
  /** Hanya peran kantor; null sampai Kepala Desa menyetujui. */
  letter?: LetterFile | null;
}
/** Surat final; kode verifikasi tidak pernah dikirim ke panel. */
export interface LetterFile {
  approved_at: string;
  /** null bila PDF otomatis belum berhasil dibuat; dibuat ulang saat diunduh. */
  source: "generated" | "uploaded" | null;
  sha256: string | null;
  file_updated_at: string | null;
  /** Diisi bila PDF dihapus oleh retensi (`applications:purge`); unduhan lalu 410. */
  file_purged_at: string | null;
}
/** GET /verify/{kode}, publik: tanpa NIK, alamat, isi surat, atau nomor pengajuan. */
export interface LetterVerification {
  number: string | null;
  jenis_surat: ServiceCode;
  issued_at: string;
  /** Contoh "S*** W********". */
  nama: string;
  status: "valid" | "revoked";
}
/** Kode baru hanya ada di respons ini; jangan simpan ke storage atau log. */
export interface StaffAccessCodeResponse {
  success: true;
  request_id: string;
  lookup_secret: string;
}
/** GET /staff/summary; seluruh hitungan mengikuti wilayah/jenis surat pengguna. */
export interface StaffSummary {
  by_status: Record<Status, number>;
  my_queue: number;
  today: number;
  oldest: Pick<StaffApplication, "request_id" | "nama" | "jenis_surat" | "status" | "created_at" | "allowed_transitions">[];
}
export interface StaffApplicationsPage {
  data: StaffApplication[];
  current_page: number;
  last_page: number;
  total: number;
}
export interface StaffAccessCodeResponse {
  success: true;
  request_id: string;
  lookup_secret: string;
}
/** PATCH /staff/applications/{id}/isi-keterangan, body `{ isi_keterangan }` (2–500 karakter). */
export interface StaffStatementResponse {
  success: true;
  request_id: string;
  isi_keterangan: string;
  can_edit_isi_keterangan: boolean;
}
export interface StaffStatusResponse {
  success: true;
  request_id: string;
  status: Status;
  catatan: string | null;
  allowed_transitions: Status[];
}
export interface StaffLoginResponse {
  token: string;
  must_change_password: boolean;
  user: { name: string; role: StaffRole };
}
/** GET /staff/me. Akun lama boleh belum punya username. */
export interface StaffProfile {
  features: { neighborhood_approval: boolean };
  name: string;
  username: string | null;
  role: StaffRole;
  rt: string | null;
  rw: string | null;
  must_change_password: boolean;
}
/** GET /staff/users — hanya untuk admin. */
export interface StaffUser {
  id: number;
  name: string;
  username: string | null;
  role: StaffRole;
  rt: string | null;
  rw: string | null;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
}
export interface StaffAccountWarning {
  role: "rt_head" | "rw_head";
  rt: string | null;
  rw: string;
  pending: number;
}
export interface StaffUsersResponse {
  data: StaffUser[];
  warnings: StaffAccountWarning[];
}
export interface StaffPasswordRequest {
  old_password: string;
  password: string;
}
/**
 * POST /applications. Wajib per jenis (lihat docs/integrasi.md): dusun untuk semua jenis; agama,
 * status_perkawinan, pendidikan, pekerjaan untuk semua kecuali KERAMAIAN; isian khusus hanya untuk
 * jenisnya (dikirim untuk jenis lain = 422). Opsional di sini hanya sampai formulir S3 diperbarui.
 */
export interface Submission {
  jenis_surat: ServiceCode;
  nama: string;
  nik: string;
  no_kk: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  dusun?: Dusun;
  alamat: string;
  rt: string;
  rw: string;
  telepon: string;
  /** Bawaan server WNI bila kosong. */
  kewarganegaraan?: Kewarganegaraan;
  agama?: Agama;
  status_perkawinan?: StatusPerkawinan;
  pendidikan?: Pendidikan;
  /** Teks bebas, maksimal 60 karakter. */
  pekerjaan?: string;
  /** Data lama SKU; tidak dapat diajukan lagi. */
  nama_usaha?: string;
  jenis_usaha?: string;
  alamat_usaha?: string;
  /** KEHILANGAN, maksimal 200. */
  barang_hilang?: string;
  /** KERAMAIAN: acara/tempat/hiburan maksimal 120; tanggal "YYYY-MM-DD", mulai >= hari ini, rentang <= 7 hari. */
  acara?: string;
  tempat_acara?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  jenis_hiburan?: string;
  /** UMUM, maksimal 500. */
  isi_keterangan?: string;
  keperluan: string;
}
export interface Receipt {
  /** Dihitung LetterType server; opsional hanya untuk bukti demo lama. */
  requires_neighborhood_approval?: boolean;
  success: true;
  request_id: string;
  status: Status;
  lookup_secret?: string;
  /** Receipt demo lama belum menyimpan jenis surat. */
  jenis_surat?: ServiceCode;
}
export interface StatusReceipt extends Receipt {
  catatan?: string | null;
  letter_number?: string | null;
}
export interface LetterNumber {
  number: string;
  status: "issued" | "void";
  void_reason: string | null;
  issued_at: string;
}
export interface LetterRegisterEntry extends Omit<LetterNumber, "void_reason"> {
  jenis_surat: ServiceCode;
  nama: string;
}
export interface LetterRegisterPage {
  data: LetterRegisterEntry[];
  current_page: number;
  last_page: number;
  total: number;
}
export interface RequestRecord extends Receipt {
  nama: string;
  jenis_surat: ServiceCode;
  tanggal: string;
  catatan?: string;
}
