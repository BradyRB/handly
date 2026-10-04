"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  Search,
  Wrench,
  ClipboardList,
  MessageCircle,
  CalendarDays,
  Wallet,
  Star,
  Shield,
  UserRound,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, Heading, type Viewer } from "./shared";
import { Landing, Auth, Discovery, Contractor } from "./public";
import {
  Dashboard,
  Requests,
  Publications,
  Agenda,
  Payments,
  Reviews,
} from "./workspace";
import { RequestDetail } from "./request-detail";
import { Messages } from "./messages";
import { Reports, Profile } from "./account";
export function Handly({
  user,
  initialQuery,
}: {
  user: Viewer;
  initialQuery: string;
}) {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  const inApp = parts[0] === "app";
  const [mobile, setMobile] = useState(false);
  const contractor = user?.role === "CONTRATISTA";
  const nav = [
    {
      href: "/app",
      name: contractor ? "Resumen" : "Mi inicio",
      Icon: LayoutDashboard,
    },
    ...(contractor
      ? [{ href: "/app/servicios", name: "Mis servicios", Icon: Wrench }]
      : [{ href: "/buscar", name: "Buscar profesionales", Icon: Search }]),
    {
      href: "/app/solicitudes",
      name: contractor ? "Solicitudes recibidas" : "Mis solicitudes",
      Icon: ClipboardList,
    },
    { href: "/app/mensajes", name: "Mensajes", Icon: MessageCircle },
    { href: "/app/agenda", name: "Agenda", Icon: CalendarDays },
    { href: "/app/pagos", name: "Pagos", Icon: Wallet },
    {
      href: "/app/opiniones",
      name: contractor ? "Opiniones recibidas" : "Mis opiniones",
      Icon: Star,
    },
    { href: "/app/reportes", name: "Reportes", Icon: Shield },
    {
      href: "/app/perfil",
      name: contractor ? "Perfil profesional" : "Mi perfil",
      Icon: UserRound,
    },
  ];
  let content: React.ReactNode;
  if (!parts.length) content = <Landing user={user} />;
  else if (parts[0] === "login" || parts[0] === "registro")
    content = (
      <Auth
        key={`${path}?${initialQuery}`}
        register={parts[0] === "registro"}
        initialRole={new URLSearchParams(initialQuery).get("rol")}
      />
    );
  else if (parts[0] === "buscar")
    content = <Discovery key={initialQuery} initialQuery={initialQuery} />;
  else if (parts[0] === "profesionales" && parts[1])
    content = <Contractor id={parts[1]} user={user} />;
  else if (inApp && user) {
    if (!parts[1]) content = <Dashboard user={user} />;
    else if (parts[1] === "servicios")
      content = <Publications key={path} id={parts[2]} />;
    else if (parts[1] === "solicitudes")
      content = parts[2] ? (
        <RequestDetail key={parts[2]} id={parts[2]} user={user} />
      ) : (
        <Requests user={user} />
      );
    else if (parts[1] === "mensajes")
      content = <Messages key={parts[2] ?? "list"} id={parts[2]} user={user} />;
    else if (parts[1] === "agenda") content = <Agenda />;
    else if (parts[1] === "pagos") content = <Payments />;
    else if (parts[1] === "opiniones") content = <Reviews user={user} />;
    else if (parts[1] === "reportes")
      content = (
        <Reports
          user={user}
          initialTarget={new URLSearchParams(initialQuery).get("target")}
        />
      );
    else if (parts[1] === "perfil") content = <Profile user={user} />;
  }
  return (
    <>
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>
      <header className={`topbar ${inApp ? "app-topbar" : ""}`}>
        <Link href={inApp ? "/app" : "/"} className="brand">
          <span className="brand-mark">h</span>handly
          <span className="brand-dot">.</span>
        </Link>
        <nav aria-label="Navegación principal" className="public-nav">
          <Link href="/buscar">Explorar servicios</Link>
          {!user && (
            <Link href="/registro?rol=CONTRATISTA">Ofrece tus servicios</Link>
          )}
        </nav>
        <div className="header-actions">
          {user ? (
            <Link className="account-link" href="/app">
              <Avatar person={user} />
              <span>{user.name.split(" ")[0]}</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="login-link">
                Iniciar sesión
              </Link>
              <Button asChild>
                <Link href="/registro">Crear cuenta</Link>
              </Button>
            </>
          )}
          {inApp && (
            <Button
              variant="ghost"
              className="mobile-menu"
              aria-label={mobile ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X /> : <Menu />}
            </Button>
          )}
        </div>
      </header>
      {inApp && user ? (
        <div className="app-shell">
          <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
            <div className="sidebar-caption">
              TU ESPACIO · {contractor ? "CONTRATISTA" : "CLIENTE"}
            </div>
            <nav aria-label="Mi espacio">
              {nav.map(({ href, name, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={
                    path === href || (href !== "/app" && path.startsWith(href))
                      ? "page"
                      : undefined
                  }
                  onClick={() => setMobile(false)}
                >
                  <Icon size={20} />
                  {name}
                </Link>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <p>
                Todo tu trabajo,
                <br />
                <strong>en un solo lugar.</strong>
              </p>
              <button onClick={() => void signOut({ callbackUrl: "/" })}>
                <LogOut size={18} />
                Cerrar sesión
              </button>
            </div>
          </aside>
          <main id="main" className="workspace">
            {content ?? <Heading title="Página no encontrada" />}
          </main>
        </div>
      ) : (
        <main id="main">
          {content ?? (
            <div className="page">
              <Heading title="Página no encontrada" />
            </div>
          )}
        </main>
      )}
      {!inApp && (
        <footer className="footer">
          <Link href="/" className="brand">
            handly.
          </Link>
          <span>Servicios locales. Acuerdos claros.</span>
          <span>República Dominicana · RD$</span>
        </footer>
      )}
    </>
  );
}
