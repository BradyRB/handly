import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page">
      <h1>Esta página no existe</h1>
      <Link href="/" className="btn btn-primary">
        Ir al inicio
      </Link>
    </main>
  );
}
