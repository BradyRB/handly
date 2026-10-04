"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Form } from "./form";
import { api, useData, currency, date, datetime } from "./api";
import {
  Badge,
  Heading,
  State,
  ServiceCard,
  RequestRow,
  locationFields,
  type Viewer,
} from "./shared";
import {
  ClipboardList,
  CalendarDays,
  CheckCircle2,
  Wrench,
  Plus,
  Wallet,
  Clock,
} from "lucide-react";
import { publication } from "@/domain/validation";
import type {
  Service,
  Request,
  Category,
  Appointment,
  Payment,
  Review,
} from "./types";
import { labels } from "./api";
export function Dashboard({ user }: { user: NonNullable<Viewer> }) {
  const results = useData<Request[]>("requests");
  const services = useData<Service[]>(
    user.role === "CLIENTE" ? "search" : null,
  );
  const active =
    results.data?.filter(
      (r) => !["COMPLETED", "REJECTED", "CANCELLED"].includes(r.status),
    ) ?? [];
  return (
    <>
      <Heading
        eyebrow={
          user.role === "CLIENTE"
            ? "TU ESPACIO PERSONAL"
            : "TU NEGOCIO, ORGANIZADO"
        }
        title={`Hola, ${user.name.split(" ")[0]}.`}
        text={
          user.role === "CLIENTE"
            ? "Démosle forma a eso que tienes pendiente."
            : "Aquí empiezan tus próximos trabajos."
        }
      />
      <div className="dashboard-banner">
        <div>
          <h2>
            {user.role === "CLIENTE"
              ? "¿Qué resolvemos hoy?"
              : "Tu experiencia merece ser vista."}
          </h2>
          <p>
            {user.role === "CLIENTE"
              ? "Encuentra a la persona indicada para tu hogar."
              : "Publica tus servicios y recibe nuevas solicitudes."}
          </p>
          <Button asChild>
            <Link
              href={
                user.role === "CLIENTE" ? "/buscar" : "/app/servicios/nuevo"
              }
            >
              {user.role === "CLIENTE"
                ? "Explorar profesionales"
                : "Publicar un servicio"}
            </Link>
          </Button>
        </div>
        <Wrench size={86} strokeWidth={1} />
      </div>
      <div className="stat-grid">
        <div>
          <ClipboardList />
          <span>Solicitudes activas</span>
          <strong>{active.length}</strong>
        </div>
        <div>
          <CalendarDays />
          <span>Servicios agendados</span>
          <strong>
            {results.data?.filter((r) => r.status === "SCHEDULED").length ?? 0}
          </strong>
        </div>
        <div>
          <CheckCircle2 />
          <span>Trabajos completados</span>
          <strong>
            {results.data?.filter((r) => r.status === "COMPLETED").length ?? 0}
          </strong>
        </div>
      </div>
      <section className="section-block">
        <div className="section-heading">
          <h2>Tus solicitudes recientes</h2>
          <Link href="/app/solicitudes" className="text-link">
            Ver solicitudes
          </Link>
        </div>
        <State
          {...results}
          empty={!results.data?.length}
          onRetry={results.refresh}
        >
          {results.data?.slice(0, 4).map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              contractor={user.role === "CONTRATISTA"}
            />
          ))}
        </State>
      </section>
      {user.role === "CLIENTE" && (
        <section className="section-block">
          <div className="section-heading">
            <h2>Profesionales para tu próximo proyecto</h2>
            <Link href="/buscar" className="text-link">
              Explorar
            </Link>
          </div>
          <State {...services} onRetry={services.refresh}>
            <div className="service-grid">
              {services.data?.slice(0, 3).map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          </State>
        </section>
      )}
    </>
  );
}

export function Requests({ user }: { user: NonNullable<Viewer> }) {
  const result = useData<Request[]>("requests", 10000);
  const [status, setStatus] = useState("");
  const rows = result.data?.filter((r) => !status || r.status === status);
  return (
    <>
      <Heading
        title={
          user.role === "CLIENTE" ? "Mis solicitudes" : "Solicitudes recibidas"
        }
        text="Cada acuerdo, desde el primer contacto hasta el trabajo terminado."
      />
      <label className="inline-filter">
        Estado
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          {[
            "PENDING",
            "ACCEPTED",
            "SCHEDULED",
            "IN_PROGRESS",
            "AWAITING_CONFIRMATION",
            "COMPLETED",
            "REJECTED",
            "CANCELLED",
          ].map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
      </label>
      <State {...result} empty={!rows?.length} onRetry={result.refresh}>
        {rows?.map((r) => (
          <RequestRow
            key={r.id}
            request={r}
            contractor={user.role === "CONTRATISTA"}
          />
        ))}
      </State>
    </>
  );
}

export function Publications({ id }: { id?: string }) {
  const result = useData<Service[]>("publications");
  const cats = useData<Category[]>("categories");
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const editing =
    id && id !== "nuevo" ? result.data?.find((s) => s.id === id) : null;
  if (id)
    return (
      <>
        <Link href="/app/servicios" className="back-link">
          Volver a mis servicios
        </Link>
        <Heading
          title={id === "nuevo" ? "Publicar un servicio" : "Editar servicio"}
          text="Explica qué haces, dónde trabajas y tu precio inicial."
        />
        <State
          loading={result.loading || cats.loading}
          error={result.error || cats.error}
          onRetry={() => {
            result.refresh();
            cats.refresh();
          }}
        >
          {id !== "nuevo" && !editing ? (
            <p>Publicación no encontrada.</p>
          ) : (
            <div className="form-panel">
              <Form
                schema={publication}
                fields={[
                  { name: "title", label: "Título del servicio" },
                  {
                    name: "categoryId",
                    label: "Categoría",
                    options: (cats.data ?? []).map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  },
                  {
                    name: "description",
                    label: "Descripción",
                    type: "textarea",
                  },
                  ...locationFields,
                  {
                    name: "basePrice",
                    label: "Precio inicial (RD$)",
                    hint: "El monto final se acuerda en la cita.",
                  },
                  {
                    name: "visible",
                    label: "Publicación visible en búsquedas",
                    type: "checkbox",
                    required: false,
                  },
                ]}
                initial={
                  editing
                    ? { ...editing }
                    : {
                        province: "Distrito Nacional",
                        visible: true,
                        categoryId: cats.data?.[0]?.id,
                      }
                }
                submit={
                  id === "nuevo" ? "Publicar servicio" : "Guardar publicación"
                }
                onSubmit={async (data) => {
                  await api(
                    id === "nuevo" ? "publications" : `publications/${id}`,
                    id === "nuevo" ? "POST" : "PATCH",
                    data,
                  );
                  router.push("/app/servicios");
                }}
              />
            </div>
          )}
        </State>
      </>
    );
  return (
    <>
      <Heading title="Mis servicios" text="Haz visible lo que sabes hacer.">
        <Button asChild>
          <Link href="/app/servicios/nuevo">
            <Plus size={18} />
            Publicar servicio
          </Link>
        </Button>
      </Heading>
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      <State {...result} empty={!result.data?.length} onRetry={result.refresh}>
        {result.data?.map((s) => (
          <article className="publication-row" key={s.id}>
            <div>
              <p className="eyebrow">
                {s.category.name} · {s.visible ? "Visible" : "Oculta"}
              </p>
              <h3>{s.title}</h3>
              <p>
                {s.municipality}, {s.province} · Desde {currency(s.basePrice)}
              </p>
            </div>
            <div className="actions">
              <Button asChild variant="secondary">
                <Link href={`/app/servicios/${s.id}`}>Editar</Link>
              </Button>
              <Confirm
                label="Eliminar"
                danger
                description="La publicación dejará de aparecer. Las solicitudes existentes conservarán su historial."
                onConfirm={async () => {
                  await api(`publications/${s.id}`, "DELETE");
                  setNotice("Publicación eliminada.");
                  result.refresh();
                }}
              />
            </div>
          </article>
        ))}
      </State>
    </>
  );
}

export function Agenda() {
  const result = useData<Appointment[]>("appointments");
  return (
    <>
      <Heading
        title="Mi agenda"
        text="Fechas, lugares y acuerdos para tus próximos servicios."
      />
      <State {...result} empty={!result.data?.length} onRetry={result.refresh}>
        {result.data?.map((a) => (
          <Link
            className="agenda-row"
            key={a.id}
            href={`/app/solicitudes/${a.requestId}`}
          >
            <div className="calendar-icon">
              <CalendarDays size={28} />
            </div>
            <div>
              <h3>{a.request?.serviceTitle}</h3>
              <p>
                <Clock size={16} />
                {datetime(a.startsAt)}
              </p>
              <p>{a.address}</p>
            </div>
            <div>
              <Badge status={a.status} />
              <p>{currency(a.amount)}</p>
            </div>
          </Link>
        ))}
      </State>
    </>
  );
}

export function Payments() {
  const result = useData<Payment[]>("payments");
  return (
    <>
      <Heading
        title="Pagos"
        text="Consulta los montos y el estado de pago de tus servicios."
      />
      <p className="test-notice">
        Los pagos con tarjeta funcionan en modo de prueba. Los registros de
        demostración no representan cargos reales.
      </p>
      <State {...result} empty={!result.data?.length} onRetry={result.refresh}>
        {result.data?.map((p) => (
          <Link
            className="payment-row"
            key={p.id}
            href={`/app/solicitudes/${p.requestId}`}
          >
            <Wallet size={27} />
            <div>
              <h3>{p.request?.serviceTitle}</h3>
              <p>
                {p.method === "CASH"
                  ? "Efectivo"
                  : p.adapter === "development"
                    ? "Tarjeta · simulación"
                    : "Tarjeta · Stripe de prueba"}
                {p.paidAt ? ` · ${date(p.paidAt)}` : ""}
              </p>
            </div>
            <strong>{currency(p.amount)}</strong>
            <Badge status={p.status} />
          </Link>
        ))}
      </State>
    </>
  );
}

export function Reviews({ user }: { user: NonNullable<Viewer> }) {
  const result = useData<Review[]>("reviews");
  return (
    <>
      <Heading
        title={
          user.role === "CLIENTE" ? "Mis opiniones" : "Opiniones recibidas"
        }
        text={
          user.role === "CLIENTE"
            ? "Tu experiencia ayuda a otras personas a elegir. Opina desde el detalle de una solicitud completada."
            : "La experiencia de tus clientes, después de cada trabajo."
        }
      />
      <State {...result} empty={!result.data?.length} onRetry={result.refresh}>
        {result.data?.map((r) => (
          <article className="review-row" key={r.id}>
            <div className="section-heading">
              <strong>
                {user.role === "CLIENTE" ? r.contractor.name : r.author.name}
              </strong>
              <span className="rating">
                {"★".repeat(r.rating)}
                <span className="sr-only"> {r.rating} de 5</span>
              </span>
            </div>
            <h3>{r.request.serviceTitle}</h3>
            <p>{r.comment}</p>
            <small>{date(r.createdAt)}</small>
          </article>
        ))}
      </State>
    </>
  );
}
