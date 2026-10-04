import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Handly · Profesionales para tu hogar",
  description:
    "Encuentra servicios técnicos y coordina tu próximo trabajo en República Dominicana.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
