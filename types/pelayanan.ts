export const statuses = [
  "SUBMITTED",
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
export type StaffRole = "staff" | "village_head" | "admin";
/** Metadata daftar petugas; tidak memuat NIK, KK, telepon, atau alamat. */
export interface StaffApplication {
  request_id: string;
  nama: string;
  jenis_surat: ServiceCode;
  status: Status;
  created_at: string;
  allowed_transitions: Status[];
}
export interface StaffApplicationEvent {
  from_status: Status | null;
  to_status: Status;
  note: string | null;
  staff_name: string | null;
  created_at: string;
}
/** Hanya respons detail terotorisasi; jangan simpan ke storage atau log. */
export interface StaffApplicationDetail extends StaffApplication, Omit<Submission, "nama_usaha" | "jenis_usaha" | "alamat_usaha"> {
  nama_usaha: string | null;
  jenis_usaha: string | null;
  alamat_usaha: string | null;
  catatan: string | null;
  updated_at: string;
  history: StaffApplicationEvent[];
}
export interface StaffApplicationsPage {
  data: StaffApplication[];
  current_page: number;
  last_page: number;
  total: number;
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
  user: { name: string; role: StaffRole };
}
/** GET /staff/me. Akun lama boleh belum punya username. */
export interface StaffProfile {
  name: string;
  username: string | null;
  role: StaffRole;
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
}
export interface RequestRecord extends Receipt {
  nama: string;
  jenis_surat: ServiceCode;
  tanggal: string;
  catatan?: string;
}
