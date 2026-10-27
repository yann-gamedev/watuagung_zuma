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
export type ServiceCode = "SKU" | "DOMISILI" | "SKTM" | "KTP_KK";
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
  /** null = perubahan status; ACCESS_CODE_RESET = kode akses dibuat ulang (status tidak berubah). */
  action: "ACCESS_CODE_RESET" | null;
  from_status: Status | null;
  to_status: Status;
  note: string | null;
  staff_name: string | null;
  created_at: string;
}
/** Hanya respons detail terotorisasi; jangan simpan ke storage atau log. */
export interface StaffApplicationDetail extends StaffApplication, Omit<Submission, "nama_usaha" | "jenis_usaha" | "alamat_usaha" | "telepon" | "tempat_lahir" | "tanggal_lahir" | "jenis_kelamin"> {
  telepon?: string;
  tempat_lahir?: string;
  tanggal_lahir?: string;
  jenis_kelamin?: string;
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
export interface Submission {
  jenis_surat: ServiceCode;
  nama: string;
  nik: string;
  no_kk: string;
  tempat_lahir: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  alamat: string;
  rt: string;
  rw: string;
  telepon: string;
  nama_usaha?: string;
  jenis_usaha?: string;
  alamat_usaha?: string;
  keperluan: string;
}
export interface Receipt {
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
