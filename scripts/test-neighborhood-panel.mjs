import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Compile actual source in memory, like test-admin-news.mjs; no generated files.
const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const react = JSON.stringify(import.meta.resolve("react"));
const session = dataUrl("export const useAdminSession = () => globalThis.__adminSession; export const can = (user, ability) => user?.abilities.includes(ability) ?? false;");
const stubs = {
  "next/image": dataUrl(`import { createElement } from ${react}; export default ({ src, alt }) => createElement("img", { src, alt });`),
  "next/link": dataUrl(`import { createElement } from ${react}; export default ({ href, children, ...rest }) => createElement("a", { href, ...rest }, children);`),
  "next/navigation": dataUrl('export const usePathname = () => "/admin/";'),
  "@/components/site-header": dataUrl('export const normalizePath = (path) => (path ?? "/").replace(/\\/+$/, "") || "/";'),
  "@/features/admin/session": session,
  "./session": session,
  "./accounts.module.css": dataUrl("export default new Proxy({}, { get: (_, key) => String(key) });"),
  "./shell.module.css": dataUrl("export default new Proxy({}, { get: (_, key) => String(key) });"),
  "@/services/pelayanan": dataUrl("export const apiBase = ''; export const apiRequest = async () => { throw new Error('unused'); };"),
  "./api": dataUrl("export const adminFetch = async () => {}; export const adminRequest = async () => {}; export class AdminUnauthorizedError extends Error {}; export const SESSION_EXPIRED_MESSAGE = '';"),
};
function load(path, extraExports = "") {
  let code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: path,
  }).outputText + extraExports;
  for (const name of ["react", "react/jsx-runtime", "lucide-react", "zod"]) {
    code = code.replaceAll(JSON.stringify(name), JSON.stringify(import.meta.resolve(name)));
  }
  for (const [name, url] of Object.entries(stubs)) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  return import(dataUrl(code));
}

const user = (role, neighborhood_approval) => ({
  abilities: ["panel", ...(role === "kim" ? [] : ["applications:manage"]), ...(["staff", "admin", "kim"].includes(role) ? ["media:manage"] : []), ...(["staff", "admin"].includes(role) ? ["site:manage"] : [])],
  features: { neighborhood_approval }, name: "Petugas Contoh", username: "contoh", role,
  rt: role === "rt_head" ? "001" : null, rw: role === "rt_head" || role === "rw_head" ? "002" : null, must_change_password: false,
});
const as = (role, flag) => { globalThis.__adminSession = { user: user(role, flag), request: () => new Promise(() => {}) }; };
const hrefs = (html) => [...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
const options = (html, id) => [...(html.split(`id="${id}"`)[1].split("</select>")[0].matchAll(/<option value="([^"]*)"/g))].map((m) => m[1]);

// Profile flag is mandatory boolean.
const { profileSchema } = await load("features/admin/session.tsx", "\nexport { profileSchema };");
for (const flag of [false, true]) assert.equal(profileSchema.parse(user("staff", flag)).features.neighborhood_approval, flag);
for (const features of [undefined, {}, { neighborhood_approval: "false" }, { neighborhood_approval: 0 }, { neighborhood_approval: null }]) {
  assert.equal(profileSchema.safeParse({ ...user("staff", false), features }).success, false, JSON.stringify(features));
}

// Sidebar: RT/RW queue only when flag true; office roles never see queues.
const { AdminSidebar, canAccessAdminPath, adminLinks } = await load("components/admin-sidebar.tsx");
const sidebar = (role, flag) => { as(role, flag); return hrefs(renderToStaticMarkup(createElement(AdminSidebar, { open: false, onClose() {} }))).slice(1); };
assert.deepEqual(sidebar("rt_head", false), ["/admin"]);
assert.deepEqual(sidebar("rt_head", true), ["/admin", "/admin/antrean-rt"]);
assert.deepEqual(sidebar("rw_head", false), ["/admin"]);
assert.deepEqual(sidebar("rw_head", true), ["/admin", "/admin/antrean-rw"]);
for (const role of ["staff", "village_head", "admin"]) for (const flag of [false, true]) {
  const links = sidebar(role, flag);
  assert.ok(!links.some((href) => href.includes("antrean")), `${role} ${flag}: no queue`);
  assert.equal(links.includes("/admin/akun"), role === "admin");
}

// KIM: only media menus/routes; returned abilities, not role names, grant access.
assert.deepEqual(sidebar("kim", false), ["/admin/berita", "/admin/umkm"]);
for (const { href } of adminLinks) assert.equal(canAccessAdminPath(user("kim", false), href), ["/admin/berita", "/admin/umkm"].includes(href), href);
for (const path of ["/admin/berita/tulis/", "/admin/berita/ubah/", "/admin/umkm/tambah/", "/admin/umkm/ubah/"]) assert.ok(canAccessAdminPath(user("kim", false), path), path);
assert.equal(canAccessAdminPath(user("kim", false), "/admin/permohonan/detail/"), false);
assert.equal(canAccessAdminPath({ ...user("admin", false), abilities: ["panel"] }, "/admin/berita/"), false);
assert.equal(canAccessAdminPath(user("village_head", false), "/admin/konten/"), false);
assert.equal(profileSchema.safeParse({ ...user("kim", false), abilities: undefined }).success, false);
assert.equal(profileSchema.safeParse({ ...user("kim", false), abilities: ["unknown"] }).success, false);

// Accounts: role choices follow flag in filter and create/edit forms.
const office = ["staff", "village_head", "admin", "kim"];
const all = ["staff", "village_head", "admin", "kim", "rt_head", "rw_head"];
const { AccountsManager, AccountForm } = await load("features/admin/accounts.tsx", "\nexport { AccountForm };");
for (const [flag, expected] of [[false, office], [true, all]]) {
  as("admin", flag);
  assert.deepEqual(options(renderToStaticMarkup(createElement(AccountsManager)), "account-role-filter"), ["", ...expected], `filter ${flag}`);
  const form = (editor) => renderToStaticMarkup(createElement(AccountForm, { editor, lockRole: false, onCreate() {}, onUpdate() {}, onReset() {}, onCancel() {} }));
  const create = form({ mode: "create" });
  assert.ok(create.includes("Buat akun"));
  assert.deepEqual(options(create, create.match(/id="([^"]+-role)"/)[1]), expected, `create ${flag}`);
  const legacy = form({ mode: "edit", user: { ...user("rt_head", flag), id: 7, is_active: false, last_login_at: null } });
  const roleId = legacy.match(/id="([^"]+-role)"/)[1];
  // Legacy role stays selected so a name-only edit never silently changes the role.
  assert.deepEqual(options(legacy, roleId), flag ? all : [...office, "rt_head"], `edit ${flag}`);
  assert.match(legacy.split(`id="${roleId}"`)[1], /<option value="rt_head" selected=""/, `legacy RT role kept ${flag}`);
  assert.ok(legacy.includes("-rt\""), `RT field ${flag}`);
}
as("staff", true);
assert.ok(renderToStaticMarkup(createElement(AccountsManager)).includes("Halaman ini tidak tersedia untuk peran Anda."));
console.log("PASS: profile abilities/flag required, KIM media-only menus/routes, RT/RW queues gated, account role choices 4 (off) vs 6 (on).");
