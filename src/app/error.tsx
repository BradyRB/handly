"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page">
      <h1>No pudimos cargar esta página</h1>
      <p>Intenta de nuevo en unos momentos.</p>
      <button className="btn btn-primary" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}
