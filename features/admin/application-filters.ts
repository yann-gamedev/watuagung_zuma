import { services } from "@/lib/data";
import { statuses, type ServiceCode, type Status } from "@/types/pelayanan";

export type ApplicationSection = "permohonan" | "persetujuan" | "surat" | "antrean-rt" | "antrean-rw";
export type ApplicationSort = "terbaru" | "terlama";
export type ApplicationFilters = {
  q: string;
  status: Status | "";
  jenis_surat: ServiceCode | "";
  sort: ApplicationSort;
  page: number;
  view?: "pending" | "all";
};
type SearchParamsReader = { get: (name: string) => string | null };

export const APPLICATION_SEARCH_MAX_LENGTH = 100;
export const applicationServiceLabels: Record<ServiceCode, string> = Object.fromEntries(
  services.map((service) => [service.code, service.title]),
) as Record<ServiceCode, string>;

/** Never use a URL-provided path as a navigation destination. */
export function parseApplicationSection(value: string | null | undefined): ApplicationSection {
  return value === "surat" || value === "persetujuan" || value === "antrean-rt" || value === "antrean-rw" ? value : "permohonan";
}

export function parseApplicationFilters(params: SearchParamsReader, section: ApplicationSection = "permohonan"): ApplicationFilters {
  const rawStatus = params.get("status");
  let status: Status | "" = statuses.includes(rawStatus as Status) ? rawStatus as Status : "";
  if (section === "persetujuan") status = "WAITING_APPROVAL";
  if (section === "surat" && status !== "APPROVED" && status !== "READY_FOR_PICKUP") status = "";
  const neighborhood = section === "antrean-rt" || section === "antrean-rw";
  const view = params.get("view") === "all" ? "all" : "pending";
  if (neighborhood) status = view === "all" ? "" : section === "antrean-rt" ? "SUBMITTED" : "RT_APPROVED";
  const service = params.get("jenis_surat");
  const rawPage = params.get("page") ?? "1";
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    q: (params.get("q") ?? "").trim().slice(0, APPLICATION_SEARCH_MAX_LENGTH),
    status,
    jenis_surat: services.some((item) => item.code === service) && !(neighborhood && service === "SKU") ? service as ServiceCode : "",
    ...(neighborhood ? { view } : {}),
    sort: params.get("sort") === "terlama" ? "terlama" : "terbaru",
    page: Number.isSafeInteger(page) && page >= 1 && page <= 2147483647 ? page : 1,
  };
}

/** Whitelist and normalize every value, including values supplied by callers. */
export function buildApplicationQuery(filters: ApplicationFilters, section: ApplicationSection = "permohonan"): URLSearchParams {
  const safe = parseApplicationFilters(new URLSearchParams({
    q: filters.q, status: filters.status, jenis_surat: filters.jenis_surat,
    sort: filters.sort, page: String(filters.page), view: filters.view ?? "pending",
  }), parseApplicationSection(section));
  const query = new URLSearchParams();
  if (safe.view === "all") query.set("view", "all");
  if (safe.q) query.set("q", safe.q);
  if (safe.status) query.set("status", safe.status);
  if (safe.jenis_surat) query.set("jenis_surat", safe.jenis_surat);
  query.set("sort", safe.sort);
  query.set("page", String(safe.page));
  return query;
}

export function buildApplicationsHref(section: ApplicationSection, filters: ApplicationFilters): string {
  const safeSection = parseApplicationSection(section);
  return `/admin/${safeSection}/?${buildApplicationQuery(filters, safeSection)}`;
}

export function buildApplicationDetailHref(requestId: string, section: ApplicationSection, filters: ApplicationFilters): string {
  const safeSection = parseApplicationSection(section);
  const query = new URLSearchParams({ id: requestId, from: safeSection });
  buildApplicationQuery(filters, safeSection).forEach((value, key) => query.set(key, value));
  return `/admin/permohonan/detail/?${query}`;
}

export function buildApplicationsApiPath(section: ApplicationSection, filters: ApplicationFilters): string {
  const safeSection = parseApplicationSection(section);
  const query = buildApplicationQuery(filters, safeSection);
  query.delete("view");
  if (safeSection === "surat" && !query.has("status")) {
    query.append("statuses[]", "APPROVED");
    query.append("statuses[]", "READY_FOR_PICKUP");
  }
  return `/staff/applications?${query}`;
}
