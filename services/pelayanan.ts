import { z } from "zod";
import { statuses, type Submission, type Receipt } from "@/types/pelayanan";
// An explicit demo build must never contact an API, even with a stale API URL.
export const apiBase = process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  ? undefined
  : process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
export const isDemo = !apiBase;
const receiptSchema = z.object({ success: z.literal(true), request_id: z.string().min(1), status: z.enum(statuses), lookup_secret: z.string().optional() });
const key = "watuagung-demo-receipts-v1";
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!apiBase) throw new Error("API tidak tersedia dalam mode simulasi.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${apiBase}${path}`, { ...options, headers: { Accept: "application/json", "Content-Type": "application/json", ...options.headers }, signal: controller.signal, cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };
    if (!response.ok) {
      if (response.status === 422 && body.errors) throw new Error(Object.values(body.errors).flat().join(" "));
      throw new Error(body.message || "Layanan belum dapat dihubungi. Coba lagi nanti.");
    }
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Waktu tunggu habis. Periksa koneksi lalu coba lagi.");
    throw error;
  } finally { clearTimeout(timeout); }
}
function demoRecords(): Receipt[] {
  try {
    const parsed = z.array(receiptSchema).safeParse(JSON.parse(localStorage.getItem(key) || "[]"));
    return parsed.success ? parsed.data : [];
  } catch { return []; }
}
export const pelayananService = {
  async submit(data: Submission): Promise<Receipt> {
    if (apiBase) return receiptSchema.extend({ lookup_secret: z.string().min(1) }).parse(await apiRequest('/applications', { method: 'POST', body: JSON.stringify(data) }));
    await new Promise((resolve) => setTimeout(resolve, 650));
    const result: Receipt = { success: true, request_id: `REQ-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: 'SUBMITTED' };
    try { localStorage.setItem(key, JSON.stringify([...demoRecords().slice(-49), result])); }
    catch { throw new Error('Penyimpanan simulasi tidak tersedia. Izinkan penyimpanan browser lalu coba lagi.'); }
    return result;
  },
  async getStatus(id: string, secret?: string): Promise<Receipt & { catatan?: string | null }> {
    if (apiBase) {
      if (!secret) throw new Error('Masukkan kode akses pengajuan.');
      return receiptSchema.extend({ catatan: z.string().nullable().optional() }).parse(await apiRequest('/applications/status', { method: 'POST', body: JSON.stringify({ request_id: id, lookup_secret: secret }) }));
    }
    await new Promise((resolve) => setTimeout(resolve, 650));
    const record = demoRecords().find((item) => item.request_id === id);
    if (record) return record;
    const examples: Record<string, (typeof statuses)[number]> = { 'REQ-2026-000001': 'PROCESSING', 'REQ-2026-000002': 'NEED_REVISION', 'REQ-2026-000003': 'APPROVED', 'REQ-2026-000004': 'REJECTED' };
    if (examples[id]) return { success: true, request_id: id, status: examples[id], catatan: examples[id] === 'NEED_REVISION' ? 'Contoh: alamat usaha perlu dilengkapi.' : examples[id] === 'REJECTED' ? 'Contoh: pengajuan tidak memenuhi persyaratan.' : undefined };
    throw new Error('Nomor pengajuan tidak ditemukan. Periksa kembali nomor Anda.');
  },
};
