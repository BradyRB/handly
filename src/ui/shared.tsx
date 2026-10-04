"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Zap,
  Droplets,
  Wind,
  Paintbrush,
  Hammer,
  Sparkles,
  MapPin,
  Star,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Field } from "./form";
import { currency, date, labels } from "./api";
import type { Person, Service, Request } from "./types";
import { provinces } from "@/domain/validation";
export type Viewer = {
  id: string;
  name: string;
  role: "CLIENTE" | "CONTRATISTA";
} | null;
export const categories = [
  { slug: "electricidad", name: "Electricidad", Icon: Zap },
  { slug: "plomeria", name: "Plomería", Icon: Droplets },
  { slug: "aire-acondicionado", name: "Aire acondicionado", Icon: Wind },
  { slug: "pintura", name: "Pintura", Icon: Paintbrush },
  { slug: "carpinteria", name: "Carpintería", Icon: Hammer },
  { slug: "limpieza", name: "Limpieza", Icon: Sparkles },
];
export const provinceOptions = provinces.map((p) => ({ value: p, label: p }));
export const locationFields: Field[] = [
  { name: "province", label: "Provincia", options: provinceOptions },
  {
    name: "municipality",
    label: "Municipio",
    placeholder: "Santo Domingo de Guzmán",
  },
];
export function Avatar({
  person,
  large = false,
}: {
  person: Person | { name: string };
  large?: boolean;
}) {
  return (
    <span
      className={`avatar ${large ? "avatar-large" : ""}`}
      aria-hidden="true"
    >
      {person.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")}
    </span>
  );
}

export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function Heading({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {text && <p className="muted">{text}</p>}
      </div>
      {children}
    </div>
  );
}

export function State({
  loading,
  error,
  empty,
  children,
  onRetry,
}: {
  loading: boolean;
  error: string;
  empty?: boolean;
  children: React.ReactNode;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <div role="status" className="loading">
        <span className="spinner" />
        Cargando…
      </div>
    );
  if (error)
    return (
      <div className="empty">
        <p role="alert">{error}</p>
        {onRetry && <Button onClick={onRetry}>Reintentar</Button>}
      </div>
    );
  if (empty)
    return (
      <div className="empty">
        <Wrench size={32} />
        <h3>Aún no hay resultados</h3>
        <p>Cuando registres actividad, aparecerá aquí.</p>
      </div>
    );
  return <>{children}</>;
}

export function ServiceCard({ service }: { service: Service }) {
  const Icon =
    categories.find((c) => c.slug === service.category.slug)?.Icon ?? Wrench;
  return (
    <article className="service-card">
      <div className={`service-cover cover-${service.category.slug}`}>
        <Icon size={54} strokeWidth={1.3} />
        <span>{service.category.name}</span>
      </div>
      <div className="service-card-body">
        <div className="person-line">
          <Avatar person={service.contractor} />
          <div>
            <strong>{service.contractor.name}</strong>
            <p>{service.municipality}</p>
          </div>
          {service.rating != null && (
            <span className="rating">
              <Star size={15} fill="currentColor" />
              {service.rating.toFixed(1)}
            </span>
          )}
        </div>
        <h3>
          <Link href={`/profesionales/${service.contractor.id}`}>
            {service.title}
          </Link>
        </h3>
        <p className="clamp">{service.description}</p>
        <div className="card-footer">
          <span>
            Desde <strong>{currency(service.basePrice)}</strong>
          </span>
          <Link
            href={`/profesionales/${service.contractor.id}`}
            className="text-link"
          >
            Ver perfil
          </Link>
        </div>
      </div>
    </article>
  );
}

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  return (
    <form
      className={`search-bar ${compact ? "compact" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        router.push(
          `/buscar?${new URLSearchParams({ q: String(data.get("q") ?? ""), province: String(data.get("province") ?? "") })}`,
        );
      }}
    >
      <div>
        <Search size={21} />
        <label className="sr-only" htmlFor={compact ? "compact-q" : "home-q"}>
          ¿Qué servicio necesitas?
        </label>
        <input
          id={compact ? "compact-q" : "home-q"}
          name="q"
          placeholder="¿Qué servicio necesitas?"
        />
      </div>
      <div>
        <MapPin size={21} />
        <label
          className="sr-only"
          htmlFor={compact ? "compact-province" : "home-province"}
        >
          Provincia
        </label>
        <select
          id={compact ? "compact-province" : "home-province"}
          name="province"
        >
          <option value="">Toda República Dominicana</option>
          {provinces.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <Button type="submit">Buscar profesionales</Button>
    </form>
  );
}

export function RequestRow({
  request: r,
  contractor,
}: {
  request: Request;
  contractor: boolean;
}) {
  const person = contractor ? r.client : r.contractor;
  return (
    <Link href={`/app/solicitudes/${r.id}`} className="request-row">
      <Avatar person={person} />
      <div>
        <h3>{r.serviceTitle}</h3>
        <p>
          {person.name} · {date(r.createdAt)}
        </p>
      </div>
      <Badge status={r.status} />
    </Link>
  );
}
