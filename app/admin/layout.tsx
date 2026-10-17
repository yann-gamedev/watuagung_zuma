import { AdminSessionProvider } from "@/features/admin/session";
import { AdminShell } from "@/features/admin/shell";
export const metadata = {
  title: "Panel Petugas Desa",
  robots: { index: false, follow: false },
};
// Layout tetap terpasang saat berpindah route admin, sehingga sesi tidak hilang.
// Mode demo, pemeriksaan sesi, dan login tampil tanpa sidebar (lihat AdminShell).
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">Lewati ke konten</a>
      <AdminSessionProvider>
        <AdminShell>{children}</AdminShell>
      </AdminSessionProvider>
    </>
  );
}
