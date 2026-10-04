"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Form, type Field } from "./form";
import { api, useData, currency, date } from "./api";
import {
  Avatar,
  Heading,
  State,
  ServiceCard,
  categories,
  locationFields,
  type Viewer,
} from "./shared";
import { signIn } from "next-auth/react";
import {
  CheckCircle2,
  MapPin,
  MessageCircle,
  CalendarDays,
  Star,
  Wrench,
  UserRound,
  Zap,
  Wind,
  Paintbrush,
  ClipboardList,
} from "lucide-react";
import { provinces, registration, serviceRequest } from "@/domain/validation";
import type { Service, Professional, Request } from "./types";
import { SearchBar } from "./shared";
import { GoogleMap } from "./map";
export function Landing({ user }: { user: Viewer }) {
  const services = useData<Service[]>("search");
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">
            <span /> HECHO PARA REPÚBLICA DOMINICANA
          </p>
          <h1>
            Tu próximo proyecto
            <br />
            empieza con{" "}
            <em>
              la persona
              <br className="desktop-break" /> indicada.
            </em>
          </h1>
          <p className="hero-description">
            Encuentra profesionales cerca de ti. Conversa, coordina y dale a tu
            hogar el cuidado que necesita.
          </p>
          <SearchBar />
          <div className="hero-note">
            <CheckCircle2 size={17} />
            Elige el servicio. Acuerda los detalles. Tú decides.
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-side-title">ENCUENTRA TU SOLUCIÓN</div>
          <div className="hero-service">
            <Zap size={32} />
            <div>
              <strong>Ese arreglo pendiente.</strong>
              <span>Electricidad para tu hogar</span>
            </div>
          </div>
          <div className="hero-service">
            <Wind size={32} />
            <div>
              <strong>Un espacio más cómodo.</strong>
              <span>Mantenimiento y climatización</span>
            </div>
          </div>
          <div className="hero-service">
            <Paintbrush size={32} />
            <div>
              <strong>Un nuevo comienzo.</strong>
              <span>Pintura y renovación</span>
            </div>
          </div>
          <div className="hero-side-footer">
            <MapPin size={18} />
            De tu barrio a todo el país.
          </div>
        </div>
      </section>
      <section className="page landing-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">¿QUÉ TIENES EN MENTE?</p>
            <h2>Una mano para cada tarea</h2>
          </div>
          <Link href="/buscar" className="text-link">
            Ver todos los servicios
          </Link>
        </div>
        <div className="category-grid">
          {categories.map(({ slug, name, Icon }) => (
            <Link key={slug} href={`/buscar?category=${slug}`}>
              <span>
                <Icon size={29} strokeWidth={1.6} />
              </span>
              <strong>{name}</strong>
            </Link>
          ))}
        </div>
      </section>
      <section className="page landing-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PROFESIONALES LOCALES</p>
            <h2>Conoce quién puede ayudarte</h2>
          </div>
          <span className="muted">El precio final se acuerda contigo</span>
        </div>
        <State
          {...services}
          empty={!services.data?.length}
          onRetry={services.refresh}
        >
          <div className="service-grid">
            {services.data?.slice(0, 3).map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        </State>
      </section>
      <section className="how-section">
        <div className="page">
          <h2>Menos vueltas. Más soluciones.</h2>
          <div className="steps">
            <div>
              <span>01</span>
              <h3>Encuentra a tu profesional</h3>
              <p>
                Busca por servicio y provincia. Conoce su experiencia y las
                opiniones de otros clientes.
              </p>
            </div>
            <div>
              <span>02</span>
              <h3>Conversa y acuerda</h3>
              <p>
                Describe el trabajo, coordina la visita y confirma el precio
                antes de empezar.
              </p>
            </div>
            <div>
              <span>03</span>
              <h3>Hazlo realidad</h3>
              <p>
                Sigue tu solicitud, registra el pago y comparte tu experiencia
                al terminar.
              </p>
            </div>
          </div>
        </div>
      </section>
      {!user && (
        <section className="page contractor-cta">
          <div>
            <p className="eyebrow">TU TALENTO TIENE UN LUGAR</p>
            <h2>
              Lo que sabes hacer,
              <br />
              al alcance de más personas.
            </h2>
            <p>
              Publica tus servicios y organiza tus solicitudes desde Handly.
            </p>
          </div>
          <Button asChild>
            <Link href="/registro?rol=CONTRATISTA">
              Registrarme como contratista
            </Link>
          </Button>
        </section>
      )}
    </>
  );
}

export function Auth({
  register: isRegister,
  initialRole,
}: {
  register: boolean;
  initialRole: string | null;
}) {
  const router = useRouter();
  const [role, setRole] = useState<"CLIENTE" | "CONTRATISTA">(() =>
    initialRole === "CONTRATISTA" ? "CONTRATISTA" : "CLIENTE",
  );
  const fields: Field[] = isRegister
    ? [
        { name: "name", label: "Nombre completo" },
        { name: "email", label: "Correo electrónico", type: "email" },
        {
          name: "phone",
          label: "Teléfono",
          type: "tel",
          placeholder: "809-555-0123",
        },
        ...locationFields,
        ...(role === "CONTRATISTA"
          ? [
              { name: "specialty", label: "Especialidad" },
              {
                name: "experienceYears",
                label: "Años de experiencia",
                type: "number",
                min: 0,
                max: 70,
              },
            ]
          : []),
        {
          name: "password",
          label: "Contraseña",
          type: "password",
          hint: "Al menos 10 caracteres, mayúsculas, minúsculas y números.",
        },
        {
          name: "consent",
          label:
            "Acepto el uso de mis datos para gestionar mi cuenta, solicitudes y comunicaciones en Handly.",
          type: "checkbox",
          required: false,
        },
      ]
    : [
        { name: "email", label: "Correo electrónico", type: "email" },
        { name: "password", label: "Contraseña", type: "password" },
      ];
  return (
    <section className="auth-page">
      <div className="auth-story">
        <p className="eyebrow">CONEXIONES QUE RESUELVEN</p>
        <h1>
          {isRegister
            ? "Tu próxima oportunidad empieza aquí."
            : "Qué bueno tenerte de vuelta."}
        </h1>
        <p>
          {isRegister
            ? "Un espacio para encontrar ayuda o compartir lo que sabes hacer."
            : "Tus conversaciones, acuerdos y próximos servicios, en un mismo lugar."}
        </p>
        <Wrench size={70} strokeWidth={1} />
      </div>
      <div className="auth-form">
        <Heading
          title={isRegister ? "Crea tu cuenta" : "Inicia sesión"}
          text={
            isRegister
              ? "Completa tus datos para comenzar."
              : "Accede a tu espacio de Handly."
          }
        />
        {isRegister && (
          <div
            className="role-selector"
            role="group"
            aria-label="Tipo de cuenta"
          >
            <button
              aria-pressed={role === "CLIENTE"}
              onClick={() => setRole("CLIENTE")}
            >
              <UserRound />
              Necesito un servicio
            </button>
            <button
              aria-pressed={role === "CONTRATISTA"}
              onClick={() => setRole("CONTRATISTA")}
            >
              <Wrench />
              Ofrezco servicios
            </button>
          </div>
        )}
        <Form
          key={role}
          fields={fields}
          initial={{ province: "Distrito Nacional", experienceYears: "0" }}
          submit={isRegister ? "Crear mi cuenta" : "Entrar a mi cuenta"}
          onSubmit={async (data) => {
            if (isRegister) {
              const result = registration.safeParse({ ...data, role });
              if (!result.success)
                throw new Error(result.error.issues[0].message);
              await api("register", "POST", result.data);
            }
            const result = await signIn("credentials", {
              email: data.email,
              password: data.password,
              redirect: false,
            });
            if (result?.error)
              throw new Error(
                "Correo o contraseña incorrectos. Si has hecho varios intentos, espera unos minutos.",
              );
            router.push("/app");
            router.refresh();
          }}
        />
        <p className="auth-switch">
          {isRegister ? "¿Ya tienes una cuenta?" : "¿Primera vez en Handly?"}{" "}
          <Link href={isRegister ? "/login" : "/registro"}>
            {isRegister ? "Inicia sesión" : "Crea una cuenta"}
          </Link>
        </p>
      </div>
    </section>
  );
}

export function Discovery({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState("list");
  const results = useData<Service[]>(`search?${query}`);
  const initial = new URLSearchParams(query);
  return (
    <div className="page discovery">
      <Heading
        eyebrow="ENCUENTRA TU PRÓXIMO PROFESIONAL"
        title="La ayuda que necesitas, cerca de ti."
      />
      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const params = new URLSearchParams();
          data.forEach((v, k) => {
            if (v) params.set(k, String(v));
          });
          setQuery(params.toString());
          window.history.replaceState(null, "", `/buscar?${params}`);
        }}
      >
        <label>
          Servicio o profesional
          <input
            name="q"
            defaultValue={initial.get("q") ?? ""}
            placeholder="Electricista, plomero…"
          />
        </label>
        <label>
          Categoría
          <select name="category" defaultValue={initial.get("category") ?? ""}>
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Provincia
          <select name="province" defaultValue={initial.get("province") ?? ""}>
            <option value="">Todas las provincias</option>
            {provinces.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Precio máximo (RD$)
          <input
            name="maxPrice"
            inputMode="decimal"
            placeholder="Sin límite"
            defaultValue={initial.get("maxPrice") ?? ""}
          />
        </label>
        <label>
          Calificación
          <select name="rating" defaultValue={initial.get("rating") ?? ""}>
            <option value="">Todas</option>
            <option value="4">4 o más</option>
            <option value="4.5">4.5 o más</option>
          </select>
        </label>
        <label>
          Ordenar
          <select name="sort" defaultValue={initial.get("sort") ?? ""}>
            <option value="">Más recientes</option>
            <option value="price">Menor precio</option>
          </select>
        </label>
        <Button type="submit">Aplicar filtros</Button>
      </form>
      <div className="results-toolbar">
        <p>
          <strong>{results.data?.length ?? 0}</strong> servicios disponibles
        </p>
        <div className="segmented" aria-label="Vista de resultados">
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <ClipboardList size={17} />
            Lista
          </button>
          <button aria-pressed={view === "map"} onClick={() => setView("map")}>
            <MapPin size={17} />
            Mapa
          </button>
        </div>
      </div>
      <State
        {...results}
        empty={!results.data?.length}
        onRetry={results.refresh}
      >
        {view === "map" ? (
          <GoogleMap services={results.data ?? []} />
        ) : (
          <div className="service-grid">
            {results.data?.map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          </div>
        )}
      </State>
      <p className="muted results-note">
        Precios iniciales de referencia. El alcance y monto final se acuerdan
        antes de iniciar. Hasta 100 resultados por búsqueda.
      </p>
    </div>
  );
}

export function Contractor({ id, user }: { id: string; user: Viewer }) {
  const result = useData<Professional>(`contractors/${id}`);
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div className="page">
      <Link href="/buscar" className="back-link">
        Volver a profesionales
      </Link>
      <State {...result} onRetry={result.refresh}>
        {result.data && (
          <>
            <div className="professional-head">
              <Avatar person={result.data} large />
              <div>
                <p className="eyebrow">
                  {result.data.contractorProfile?.specialty}
                </p>
                <h1>{result.data.name}</h1>
                <p>
                  <MapPin size={17} />
                  {result.data.municipality}, {result.data.province}
                </p>
                <p className="rating">
                  <Star size={18} fill="currentColor" />
                  {result.data.rating
                    ? result.data.rating.toFixed(1)
                    : "Sin calificación"}{" "}
                  · {result.data.reviewCount} opiniones
                </p>
              </div>
            </div>
            <div className="detail-columns">
              <div>
                <section className="section-block">
                  <h2>Conoce a tu profesional</h2>
                  <p className="preserve">
                    {result.data.contractorProfile?.bio ||
                      "Este profesional aún no ha agregado su presentación."}
                  </p>
                  <p className="muted">
                    {result.data.contractorProfile?.experienceYears ?? 0} años
                    de experiencia declarada
                  </p>
                </section>
                <section className="section-block">
                  <h2>Servicios disponibles</h2>
                  {result.data.publications.length ? (
                    result.data.publications.map((s) => (
                      <article className="service-row" key={s.id}>
                        <div>
                          <span className="eyebrow">{s.category.name}</span>
                          <h3>{s.title}</h3>
                          <p>{s.description}</p>
                          <strong>Desde {currency(s.basePrice)}</strong>
                        </div>
                        {user?.role === "CLIENTE" ? (
                          <Button onClick={() => setSelected(s.id)}>
                            Solicitar servicio
                          </Button>
                        ) : !user ? (
                          <Button asChild>
                            <Link href="/login">Entrar para solicitar</Link>
                          </Button>
                        ) : (
                          <span className="muted">Para cuentas cliente</span>
                        )}
                      </article>
                    ))
                  ) : (
                    <p>No hay publicaciones disponibles.</p>
                  )}
                </section>
                <section className="section-block">
                  <h2>Opiniones de clientes</h2>
                  {result.data.receivedReviews.length ? (
                    result.data.receivedReviews.map((r) => (
                      <article className="review-row" key={r.id}>
                        <strong>{r.author.name}</strong>
                        <span className="rating">
                          {"★".repeat(r.rating)}
                          <span className="sr-only"> {r.rating} de 5</span>
                        </span>
                        <p>{r.comment}</p>
                        <small>{date(r.createdAt)}</small>
                      </article>
                    ))
                  ) : (
                    <p className="muted">
                      Aún no hay opiniones de servicios completados.
                    </p>
                  )}
                </section>
              </div>
              <aside className="info-panel">
                <h3>Acuerdos claros desde el inicio</h3>
                <ul>
                  <li>
                    <MessageCircle />
                    Describe tu trabajo y conversa con el profesional.
                  </li>
                  <li>
                    <CalendarDays />
                    Confirma el lugar, la fecha y el precio.
                  </li>
                  <li>
                    <Star />
                    Comparte tu experiencia al completar el servicio.
                  </li>
                </ul>
              </aside>
            </div>
            {selected && (
              <section className="request-form section-block" id="request-form">
                <Heading
                  title="Cuéntanos qué necesitas"
                  text={
                    result.data.publications.find((p) => p.id === selected)
                      ?.title
                  }
                >
                  <Button variant="ghost" onClick={() => setSelected(null)}>
                    Cerrar
                  </Button>
                </Heading>
                <Form
                  fields={[
                    {
                      name: "description",
                      label: "Describe el trabajo",
                      type: "textarea",
                    },
                    ...locationFields,
                    {
                      name: "address",
                      label: "Dirección del servicio",
                      hint: "Solo se comparte con el profesional de esta solicitud.",
                    },
                  ]}
                  initial={{
                    province: result.data.province,
                    municipality: result.data.municipality,
                  }}
                  submit="Enviar solicitud"
                  onSubmit={async (data) => {
                    const payload = serviceRequest.parse({
                      ...data,
                      publicationId: selected,
                    });
                    const request = await api<Request>(
                      "requests",
                      "POST",
                      payload,
                    );
                    router.push(`/app/solicitudes/${request.id}`);
                  }}
                />
              </section>
            )}
          </>
        )}
      </State>
    </div>
  );
}
