import { z } from "zod";
import { attachmentKinds, attachmentKindLabels, serviceCodes, statuses, type Submission, type SubmissionAttachments, type Receipt, type StatusReceipt } from "@/types/pelayanan";
import { submissionSchema } from "@/lib/validation";
// An explicit demo build must never contact an API, even with a stale API URL.
export const apiBase = process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  ? undefined
  : process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
export const isDemo = !apiBase;
const receiptSchema = z.object({ success: z.literal(true), request_id: z.string().min(1), status: z.enum(statuses), lookup_secret: z.string().optional(), requires_neighborhood_approval: z.boolean().optional(), jenis_surat: z.enum(serviceCodes).optional() });
const attachmentListSchema = z.array(z.enum(attachmentKinds));
const key = "watuagung-demo-receipts-v1";
export class SubmissionValidationError extends Error {
  constructor(public readonly errors: Record<string, string[]>, message?: string) {
    super(message || Object.values(errors).flat().join(" ") || "Periksa kembali isian dan lampiran Anda.");
    this.name = "SubmissionValidationError";
  }
}
export const THROTTLE_FALLBACK_MESSAGE = "Terlalu banyak percobaan. Tunggu sekitar 1 menit, lalu coba lagi.";
export async function apiRequest<T>(path: string, options: RequestInit = {}, pdf = false): Promise<T> {
  if (!apiBase) throw new Error("API tidak tersedia dalam mode simulasi.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${apiBase}${path}`, { ...options, headers: { Accept: "application/json", "Content-Type": "application/json", ...options.headers }, signal: controller.signal, cache: "no-store" });
    if (pdf && response.ok) {
      if (!response.headers.get("Content-Type")?.includes("application/pdf")) throw new Error("Berkas surat tidak dapat dibaca. Coba lagi atau hubungi petugas.");
      return await response.blob() as T;
    }
    const body = (await response.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };
    if (!response.ok) {
      if (response.status === 422 && body.errors) throw new Error(Object.values(body.errors).flat().join(" "));
      // 429 server memakai ApiThrottleError (bahasa Indonesia + waktu tunggu); pesan bawaan Inggris/proxy diganti.
      if (response.status === 429 && (!body.message || /too many/i.test(body.message))) throw new Error(THROTTLE_FALLBACK_MESSAGE);
      throw new Error(body.message || "Layanan belum dapat dihubungi. Coba lagi nanti.");
    }
    return body as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Waktu tunggu habis. Periksa koneksi lalu coba lagi.");
    // fetch gagal total (offline, DNS, CORS) melempar TypeError berbahasa Inggris, mis. "Failed to fetch".
    if (error instanceof TypeError) throw new Error("Server belum dapat dihubungi. Periksa koneksi internet lalu coba lagi.");
    throw error;
  } finally { clearTimeout(timeout); }
}
function demoRecords(): Receipt[] {
  try {
    const parsed = z.array(receiptSchema).safeParse(JSON.parse(localStorage.getItem(key) || "[]"));
    return parsed.success ? parsed.data : [];
  } catch { return []; }
}
function uploadMultipart<T>(path: string, form: FormData, schema: z.ZodType<T>, onProgress?: (percent: number | null) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase}${path}`);
    xhr.timeout = 120000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = (event) => onProgress?.(event.lengthComputable && event.total > 0 ? Math.min(100, Math.round(event.loaded / event.total * 100)) : null);
    xhr.onerror = () => reject(new Error('Pengajuan gagal dikirim. Periksa koneksi internet lalu coba lagi.'));
    xhr.ontimeout = () => reject(new Error('Waktu unggah habis. Periksa koneksi internet lalu coba lagi.'));
    xhr.onabort = () => reject(new Error('Pengiriman dibatalkan. Coba kirim pengajuan kembali.'));
    xhr.onload = () => {
      try {
        if (xhr.status === 413) throw new Error('Ukuran lampiran terlalu besar untuk server. Kecilkan ukuran file lalu coba lagi.');
        let body: unknown;
        try { body = JSON.parse(xhr.responseText); } catch {
          if (xhr.status === 422) throw new SubmissionValidationError({});
          throw new Error('Respons layanan tidak dapat dibaca. Coba lagi nanti.');
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          const failure = z.object({ message: z.string().optional(), errors: z.record(z.string(), z.array(z.string())).optional() }).safeParse(body);
          if (xhr.status === 422) throw new SubmissionValidationError(failure.success ? failure.data.errors || {} : {}, failure.success ? failure.data.message : undefined);
          throw new Error(failure.success && failure.data.message || 'Layanan belum dapat dihubungi. Coba lagi nanti.');
        }
        const receipt = schema.parse(body);
        onProgress?.(100);
        resolve(receipt);
      } catch (error) { reject(error); }
    };
    onProgress?.(null);
    xhr.send(form);
  });
}
const demoDownloaded = new Set<string>();
const demoDeadline = new Date(Date.now() + 30 * 86400000).toISOString();
export const pelayananService = {
  async downloadLetter(id: string, secret?: string): Promise<Blob> {
    if (apiBase) {
      if (!secret?.trim()) throw new Error('Masukkan kode akses pengajuan.');
      return apiRequest<Blob>('/applications/letter', { method: 'POST', body: JSON.stringify({ request_id: id, lookup_secret: secret }) }, true);
    }
    if (!['REQ-2026-000005', 'REQ-2026-000006'].includes(id)) throw new Error('Surat belum tersedia untuk diunduh.');
    // Demo PDF contains no citizen data, signature, stamp, or operational QR.
    const stream = 'BT /F1 18 Tf 50 780 Td (SIMULASI - BUKAN SURAT RESMI) Tj 0 -30 Td (Contoh unduhan Desa Watuagung. Data fiktif.) Tj ET';
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = objects.map((object, index) => { const offset = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; return offset; });
    const xref = pdf.length;
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    demoDownloaded.add(id);
    return new Blob([pdf], { type: 'application/pdf' });
  },
  async submit(data: Submission, attachments: SubmissionAttachments, onProgress?: (percent: number | null) => void): Promise<Receipt> {
    // Demo checks form fields first, matching the existing validation contract.
    const parsed = !apiBase ? submissionSchema.safeParse(data) : undefined;
    if (parsed && !parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join(' '));
    const errors: Record<string, string[]> = {};
    for (const kind of attachmentKinds) {
      if (!(attachments?.[kind] instanceof Blob) || !attachments[kind].size) errors[`lampiran.${kind}`] = [`${attachmentKindLabels[kind]} wajib dilampirkan.`];
    }
    if (Object.keys(errors).length) throw new SubmissionValidationError(errors);
    if (apiBase) {
      const form = new FormData();
      for (const [field, value] of Object.entries(data)) if (value !== undefined && value !== null) form.append(field, String(value));
      for (const kind of attachmentKinds) form.append(`lampiran[${kind}]`, attachments[kind]);
      return uploadMultipart('/applications', form, receiptSchema.extend({ lookup_secret: z.string().min(1), requires_neighborhood_approval: z.boolean(), lampiran: attachmentListSchema }), onProgress);
    }
    onProgress?.(0);
    await new Promise((resolve) => setTimeout(resolve, 325));
    onProgress?.(50);
    await new Promise((resolve) => setTimeout(resolve, 325));
    const result: Receipt = { success: true, request_id: `REQ-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, status: 'SUBMITTED', requires_neighborhood_approval: false, jenis_surat: data.jenis_surat };
    try { localStorage.setItem(key, JSON.stringify([...demoRecords().slice(-49), result])); }
    catch { throw new Error('Penyimpanan simulasi tidak tersedia. Izinkan penyimpanan browser lalu coba lagi.'); }
    onProgress?.(100);
    return result;
  },
  async replaceAttachments(id: string, secret: string, attachments: Partial<SubmissionAttachments>, onProgress?: (percent: number | null) => void): Promise<StatusReceipt> {
    if (!apiBase) throw new Error('Penggantian lampiran tidak tersedia dalam mode simulasi.');
    if (!secret.trim()) throw new Error('Masukkan kode akses pengajuan.');
    const selected = attachmentKinds.filter((kind) => attachments?.[kind] !== undefined);
    const errors: Record<string, string[]> = {};
    if (!selected.length) errors.lampiran = ['Pilih minimal satu lampiran yang akan diganti.'];
    for (const kind of selected) {
      if (!(attachments[kind] instanceof Blob) || !attachments[kind].size) errors[`lampiran.${kind}`] = [`${attachmentKindLabels[kind]} wajib dilampirkan.`];
    }
    if (Object.keys(errors).length) throw new SubmissionValidationError(errors);
    const form = new FormData();
    form.append('request_id', id);
    form.append('lookup_secret', secret);
    for (const kind of selected) form.append(`lampiran[${kind}]`, attachments[kind]!);
    return uploadMultipart('/applications/attachments', form, z.object({ success: z.literal(true), request_id: z.string().min(1), status: z.literal('NEED_REVISION'), lampiran: attachmentListSchema }), onProgress);
  },
  async getStatus(id: string, secret?: string): Promise<StatusReceipt> {
    if (apiBase) {
      if (!secret) throw new Error('Masukkan kode akses pengajuan.');
      return receiptSchema.extend({ requires_neighborhood_approval: z.boolean(), jenis_surat: z.enum(serviceCodes), lampiran: attachmentListSchema.optional(), catatan: z.string().nullable().optional(), letter_number: z.string().nullable().optional(), letter_available: z.boolean(), letter_available_until: z.string().datetime({ offset: true }).nullable() }).parse(await apiRequest('/applications/status', { method: 'POST', body: JSON.stringify({ request_id: id, lookup_secret: secret }) }));
    }
    await new Promise((resolve) => setTimeout(resolve, 650));
    const record = demoRecords().find((item) => item.request_id === id);
    if (record) return record;
    const examples: Record<string, (typeof statuses)[number]> = { 'REQ-2026-000001': 'PROCESSING', 'REQ-2026-000002': 'NEED_REVISION', 'REQ-2026-000003': 'APPROVED', 'REQ-2026-000004': 'REJECTED', 'REQ-2026-000005': 'READY_FOR_PICKUP', 'REQ-2026-000006': 'COMPLETED', 'REQ-2026-000007': 'SUBMITTED', 'REQ-2026-000008': 'VERIFIED' };
    if (examples[id]) return { success: true, request_id: id, status: demoDownloaded.has(id) ? 'COMPLETED' : examples[id], letter_available: ['REQ-2026-000005', 'REQ-2026-000006'].includes(id), letter_available_until: ['REQ-2026-000005', 'REQ-2026-000006'].includes(id) ? demoDeadline : null, requires_neighborhood_approval: false, jenis_surat: id.endsWith('000007') ? 'SKTM' : 'DOMISILI', catatan: examples[id] === 'NEED_REVISION' ? 'Contoh: dusun dan alamat perlu dilengkapi.' : examples[id] === 'REJECTED' ? 'Contoh: pengajuan tidak memenuhi persyaratan.' : undefined };
    throw new Error('Nomor pengajuan tidak ditemukan. Periksa kembali nomor Anda.');
  },
};
