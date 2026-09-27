"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="container section">
      <h1>Halaman belum dapat dimuat.</h1>
      <p className="my-5">Silakan coba kembali.</p>
      <button className="btn" onClick={reset}>
        Coba lagi
      </button>
    </main>
  );
}
