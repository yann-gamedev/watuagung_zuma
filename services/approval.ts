import { z } from "zod";
import { apiBase } from "@/services/pelayanan";
import { serviceCodes, type ApprovalDecisionRequest, type ApprovalDecisionResponse, type ApprovalPreview, type NotificationVerifyResponse } from "@/types/pelayanan";

/**
 * Klien publik E3/E4: persetujuan Kepala Desa lewat tautan email dan verifikasi email notifikasi.
 * Token selalu di body POST, tidak pernah di URL API. Status HTTP dipertahankan karena halaman membedakan
 * 410 (tautan tidak berlaku), 422 (PIN salah / isian), dan 423 (tautan dikunci).
 */
export class ApprovalError extends Error {
  constructor(message: string, public readonly status: number, public readonly attemptsLeft?: number) {
    super(message);
    this.name = "ApprovalError";
  }
}

const previewSchema = z.object({
  request_id: z.string().min(1),
  jenis_surat: z.enum(serviceCodes),
  jenis_surat_label: z.string(),
  nama: z.string(),
  submitted_at: z.string(),
  verified_by: z.string().nullable(),
  letter_number: z.string().nullable(),
  head_name: z.string(),
  expires_at: z.string(),
  pin_attempts_left: z.number().int().min(0),
});
const decisionSchema = z.object({
  success: z.literal(true),
  request_id: z.string().min(1),
  status: z.enum(["READY_FOR_PICKUP", "REJECTED"]),
  letter_number: z.string().nullable(),
  message: z.string(),
});
const verifySchema = z.object({ success: z.literal(true), message: z.string() });
const errorSchema = z.object({ message: z.string().optional(), errors: z.record(z.string(), z.array(z.string())).optional(), pin_attempts_left: z.number().int().min(0).optional() });

const fallback: Record<number, string> = {
  410: "Tautan sudah tidak berlaku.",
  423: "Tautan dikunci karena PIN salah 5 kali.",
  429: "Terlalu banyak percobaan. Tunggu sekitar 1 menit, lalu coba lagi.",
};

async function post(path: string, body: unknown, pdf = false): Promise<unknown> {
  if (!apiBase) throw new ApprovalError("Fitur ini tidak aktif pada mode simulasi.", 0);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: "POST",
      headers: { Accept: pdf ? "application/pdf, application/json" : "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new ApprovalError("Waktu tunggu habis. Periksa koneksi lalu coba lagi.", 0);
    throw new ApprovalError("Server belum dapat dihubungi. Periksa koneksi internet lalu coba lagi.", 0);
  } finally {
    clearTimeout(timeout);
  }
  if (response.ok && pdf) {
    if (!response.headers.get("Content-Type")?.includes("application/pdf")) throw new ApprovalError("Draf surat tidak dapat dibaca. Coba lagi.", response.status);
    return response.blob();
  }
  const raw: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const parsed = errorSchema.safeParse(raw);
    const data = parsed.success ? parsed.data : {};
    // 422 isian (alasan wajib, format PIN) lebih jelas lewat pesan per kolom; PIN salah memakai pesan server.
    const fieldMessage = data.errors ? Object.values(data.errors).flat().join(" ") : "";
    const message = response.status === 429 && (!data.message || /too many/i.test(data.message))
      ? fallback[429]
      : (data.pin_attempts_left === undefined && fieldMessage) || data.message || fallback[response.status] || "Layanan belum dapat dihubungi. Coba lagi nanti.";
    throw new ApprovalError(message, response.status, data.pin_attempts_left);
  }
  return raw;
}

async function postJson<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await post(path, body));
  if (!parsed.success) throw new ApprovalError("Respons server tidak dikenali. Coba lagi atau buka panel admin.", 200);
  return parsed.data;
}

export const approvalService = {
  preview: (token: string): Promise<ApprovalPreview> => postJson("/approvals/preview", { token }, previewSchema),
  async draft(token: string): Promise<Blob> {
    return (await post("/approvals/draft", { token }, true)) as Blob;
  },
  decide: (request: ApprovalDecisionRequest): Promise<ApprovalDecisionResponse> => postJson("/approvals/decide", request, decisionSchema),
  /** `query` = `window.location.search` halaman /verifikasi-email/ apa adanya (bertanda tangan). */
  verifyEmail: (query: string): Promise<NotificationVerifyResponse> => postJson(`/notifications/verify${query}`, {}, verifySchema),
};
