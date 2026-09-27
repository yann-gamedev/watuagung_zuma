export const metadata = {
  title: "Panel Petugas Desa",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">Lewati ke konten</a>
      <div className="admin-layout"><main id="main" className="admin-main">{children}</main></div>
    </>
  );
}
