import { apiBase } from "@/services/pelayanan";

export const SESSION_EXPIRED_MESSAGE = "Sesi berakhir, silakan masuk lagi.";

/** Server menolak token (dicabut, kedaluwarsa, atau tidak ada). */
export class AdminUnauthorizedError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = "AdminUnauthorizedError";
  }
}

export class AdminSiteNotFoundError extends Error {}

/** 422 bagian situs: server mengirim `data.phone`; disimpan relatif `data` (`phone`, `blocks.0.title`). */
export class AdminValidationError extends Error {
  fields: Record<string, string[]>;
  constructor(errors: Record<string, string[]>) {
    super("Periksa kembali isian yang ditandai.");
    this.fields = Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field.replace(/^data\./, ""), messages]));
  }
}

/** Gagal menghubungi server, bukan penolakan token. */
export class AdminNetworkError extends Error {
  constructor(message = "Server belum dapat dihubungi. Periksa koneksi lalu coba lagi.") {
    super(message);
    this.name = "AdminNetworkError";
  }
}

/**
 * Permintaan ke API petugas dengan bearer token. Transport pelayanan warga
 * (services/pelayanan.ts) sengaja tidak dipakai agar status 401 bisa dibedakan.
 */
export async function adminFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await send(path, token, options);
  // Berkas (PDF/PNG) dikembalikan sebagai Blob; token tetap di header, tidak pernah di URL.
  if (!response.headers.get("Content-Type")?.includes("json")) return (await response.blob()) as T;
  return (await response.json().catch(() => ({}))) as T;
}

async function send(path: string, token: string, options: RequestInit): Promise<Response> {
  if (!apiBase) throw new AdminNetworkError("Panel petugas tidak aktif pada demo.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        // FormData menentukan Content-Type multipart sendiri.
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new AdminNetworkError("Waktu tunggu habis. Periksa koneksi lalu coba lagi.");
    throw new AdminNetworkError();
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401) throw new AdminUnauthorizedError();
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };
    if (path.startsWith("/staff/site/")) {
      if (response.status === 404) throw new AdminSiteNotFoundError("Bagian situs belum diisi.");
      if (response.status === 403) throw new Error("Akun ini tidak memiliki akses untuk tindakan tersebut.");
      if (response.status === 422 && body.errors) throw new AdminValidationError(body.errors);
      throw new Error("Bagian situs gagal diproses. Coba lagi nanti.");
    }
    // Berita memakai pesan server apa adanya, termasuk validasi foto dan 404.
    if (/^\/staff\/posts(?:[/?]|$)/.test(path)) throw new Error(body.errors ? Object.values(body.errors).flat().join(" ") : body.message || "Berita gagal diproses. Coba lagi nanti.");
    if (response.status === 403) throw new Error("Akun ini tidak memiliki akses untuk tindakan tersebut.");
    // Pesan bawaan Laravel untuk 404 berbahasa Inggris dan menyebut nama model internal.
    if (response.status === 404) throw new Error("Permohonan tidak ditemukan. Periksa nomor atau kembali ke daftar.");
    if (response.status === 422 && body.errors) throw new Error(Object.values(body.errors).flat().join(" "));
    throw new Error(body.message || "Layanan belum dapat dihubungi. Coba lagi nanti.");
  }
  return response;
}

export type AdminRequestSession = {
  token: string;
  /** Dipanggil saat server membalas 401; menghapus sesi dan kembali ke login. */
  onUnauthorized: (token: string) => void;
};

/** adminFetch + penghapusan sesi otomatis bila token ditolak. */
export async function adminRequest<T>(session: AdminRequestSession, path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await adminFetch<T>(path, session.token, options);
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) session.onUnauthorized(session.token);
    throw error;
  }
}
