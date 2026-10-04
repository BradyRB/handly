"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Form } from "./form";
import { api, useData, currency, date, datetime } from "./api";
import { Avatar, Badge, Heading, State, type Viewer } from "./shared";
import { MapPin, MessageCircle } from "lucide-react";
import { review } from "@/domain/validation";
import type { Request } from "./types";
import { labels } from "./api";
export function RequestDetail({
  id,
  user,
}: {
  id: string;
  user: NonNullable<Viewer>;
}) {
  const result = useData<Request>(`requests/${id}`, 10000);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const contractor = user.role === "CONTRATISTA";
  const change = async (status: string) => {
    await api(`requests/${id}/status`, "PATCH", { status });
    setNotice("Estado actualizado.");
    result.refresh();
  };
  return (
    <>
      <Link href="/app/solicitudes" className="back-link">
        Volver a solicitudes
      </Link>
      <State {...result} onRetry={result.refresh}>
        {result.data &&
          (() => {
            const r = result.data;
            const person = contractor ? r.client : r.contractor;
            const editable =
              ["ACCEPTED", "SCHEDULED"].includes(r.status) &&
              !["PAID", "PROCESSING"].includes(r.payment?.status ?? "");
            return (
              <>
                <Heading
                  eyebrow={`SOLICITUD · ${date(r.createdAt)}`}
                  title={r.serviceTitle}
                >
                  <Badge status={r.status} />
                </Heading>
                {notice && (
                  <p role="status" className="success">
                    {notice}
                  </p>
                )}
                <div className="request-progress">
                  {[
                    "PENDING",
                    "ACCEPTED",
                    "SCHEDULED",
                    "IN_PROGRESS",
                    "COMPLETED",
                  ].map((s, i) => (
                    <div
                      key={s}
                      className={
                        [
                          "PENDING",
                          "ACCEPTED",
                          "SCHEDULED",
                          "IN_PROGRESS",
                          "AWAITING_CONFIRMATION",
                          "COMPLETED",
                        ].indexOf(r.status) >= i
                          ? "done"
                          : ""
                      }
                    >
                      <span>{i + 1}</span>
                      {labels[s]}
                    </div>
                  ))}
                </div>
                <div className="detail-columns">
                  <div>
                    <section className="section-block">
                      <h2>Detalles del trabajo</h2>
                      <p className="preserve">{r.description}</p>
                      <p className="detail-location">
                        <MapPin size={20} />
                        {r.address}
                        <br />
                        {r.municipality}, {r.province}
                      </p>
                    </section>
                    <section className="section-block">
                      <h2>Agenda y acuerdo</h2>
                      {r.appointment && r.appointment.status !== "CANCELLED" ? (
                        <>
                          <Badge status={r.appointment.status} />
                          <dl className="detail-list">
                            <div>
                              <dt>Fecha y hora</dt>
                              <dd>{datetime(r.appointment.startsAt)}</dd>
                            </div>
                            <div>
                              <dt>Lugar</dt>
                              <dd>{r.appointment.address}</dd>
                            </div>
                            <div>
                              <dt>Monto propuesto</dt>
                              <dd>{currency(r.appointment.amount)}</dd>
                            </div>
                          </dl>
                          {!contractor &&
                            r.appointment.status === "PROPOSED" &&
                            r.status === "ACCEPTED" && (
                              <Form
                                fields={[
                                  {
                                    name: "method",
                                    label: "Método de pago",
                                    options: [
                                      { value: "CASH", label: "Efectivo" },
                                      {
                                        value: "CARD",
                                        label: "Tarjeta · modo de prueba",
                                      },
                                    ],
                                  },
                                ]}
                                initial={{ method: "CASH" }}
                                submit="Confirmar cita y precio"
                                onSubmit={async (data) => {
                                  await api(
                                    `requests/${id}/confirm`,
                                    "POST",
                                    data,
                                  );
                                  setNotice("Cita y precio confirmados.");
                                  result.refresh();
                                }}
                              />
                            )}
                        </>
                      ) : (
                        <p className="muted">
                          {r.status === "PENDING"
                            ? "El profesional debe aceptar tu solicitud antes de coordinar una cita."
                            : "Todavía no hay una cita propuesta."}
                        </p>
                      )}
                      {editable && (
                        <div className="actions">
                          {contractor && (
                            <Button
                              variant="secondary"
                              onClick={() => setEditing(!editing)}
                            >
                              {r.appointment?.status !== "CANCELLED" &&
                              r.appointment
                                ? "Editar propuesta"
                                : "Proponer cita"}
                            </Button>
                          )}
                          {r.appointment &&
                            r.appointment.status !== "CANCELLED" && (
                              <Confirm
                                danger
                                label="Cancelar cita"
                                description="Se cancela esta cita. La solicitud permanece aceptada para coordinar un nuevo acuerdo."
                                onConfirm={async () => {
                                  await api(
                                    `requests/${id}/appointment`,
                                    "DELETE",
                                  );
                                  result.refresh();
                                }}
                              />
                            )}
                        </div>
                      )}
                      {contractor && editable && editing && (
                        <Form
                          fields={[
                            {
                              name: "startsAt",
                              label: "Fecha y hora (República Dominicana)",
                              type: "datetime-local",
                            },
                            { name: "address", label: "Lugar del encuentro" },
                            {
                              name: "amount",
                              label: "Monto del servicio (RD$)",
                            },
                          ]}
                          initial={{
                            address: r.appointment?.address ?? r.address,
                            amount: r.appointment?.amount ?? "",
                            startsAt: r.appointment
                              ? new Date(
                                  new Date(r.appointment.startsAt).getTime() -
                                    4 * 60 * 60 * 1000,
                                )
                                  .toISOString()
                                  .slice(0, 16)
                              : "",
                          }}
                          submit="Enviar propuesta"
                          onSubmit={async (data) => {
                            await api(`requests/${id}/appointment`, "PUT", {
                              ...data,
                              startsAt: new Date(
                                `${data.startsAt}:00-04:00`,
                              ).toISOString(),
                            });
                            setEditing(false);
                            setNotice(
                              "Propuesta enviada. El cliente debe confirmar el nuevo acuerdo.",
                            );
                            result.refresh();
                          }}
                        />
                      )}
                    </section>
                    {r.payment && (
                      <section className="section-block">
                        <h2>Pago del servicio</h2>
                        <div className="payment-summary">
                          <strong>{currency(r.payment.amount)}</strong>
                          <Badge status={r.payment.status} />
                        </div>
                        <p>
                          {r.payment.method === "CASH"
                            ? "Efectivo · el profesional confirma la recepción."
                            : "Tarjeta · entorno de pruebas."}
                        </p>
                        {r.payment.adapter === "development" && (
                          <p className="test-notice">
                            Pago de demostración. No se solicita una tarjeta ni
                            se realiza ningún cargo real.
                            {r.payment.status === "PAID"
                              ? " El pago mostrado fue simulado."
                              : ""}
                          </p>
                        )}
                        {r.payment.adapter === "stripe-test" && (
                          <p className="test-notice">
                            Stripe en modo de prueba. No se realizan cargos
                            reales.
                          </p>
                        )}
                        {["PENDING", "FAILED", "PROCESSING"].includes(
                          r.payment.status,
                        ) &&
                          r.payment.method === "CARD" &&
                          !contractor && (
                            <>
                              {r.payment.adapter === "development" ? (
                                <Confirm
                                  label="Simular pago de prueba"
                                  description="Esto registra un pago simulado para probar el recorrido. No realiza cargos reales."
                                  onConfirm={async () => {
                                    await api(
                                      `requests/${id}/payment`,
                                      "POST",
                                      { confirm: true },
                                    );
                                    result.refresh();
                                  }}
                                />
                              ) : (
                                <Confirm
                                  label="Abrir pago seguro de prueba"
                                  description="Se abrirá la página de Stripe en modo de prueba. El estado se actualiza al recibir el webhook del proveedor."
                                  onConfirm={async () => {
                                    const response = await api<{ url: string }>(
                                      `requests/${id}/checkout`,
                                      "POST",
                                    );
                                    window.location.assign(response.url);
                                  }}
                                />
                              )}
                            </>
                          )}
                        {r.payment.status === "PENDING" &&
                          contractor &&
                          r.payment.method === "CASH" &&
                          ["IN_PROGRESS", "AWAITING_CONFIRMATION"].includes(
                            r.status,
                          ) && (
                            <Confirm
                              label="Confirmar efectivo recibido"
                              description={`Confirma que recibiste ${currency(r.payment.amount)} por este servicio.`}
                              onConfirm={async () => {
                                await api(`requests/${id}/payment`, "POST", {
                                  confirm: true,
                                });
                                result.refresh();
                              }}
                            />
                          )}
                      </section>
                    )}
                    {!contractor && r.status === "COMPLETED" && !r.review && (
                      <section className="section-block">
                        <h2>¿Cómo fue tu experiencia?</h2>
                        <Form
                          schema={review}
                          fields={[
                            {
                              name: "rating",
                              label: "Calificación",
                              options: [5, 4, 3, 2, 1].map((n) => ({
                                value: String(n),
                                label: `${n} ${n === 1 ? "estrella" : "estrellas"}`,
                              })),
                            },
                            {
                              name: "comment",
                              label: "Tu opinión",
                              type: "textarea",
                            },
                          ]}
                          initial={{ rating: "5" }}
                          submit="Publicar opinión"
                          onSubmit={async (data) => {
                            await api(`requests/${id}/review`, "POST", data);
                            setNotice("Gracias. Tu opinión fue publicada.");
                            result.refresh();
                          }}
                        />
                      </section>
                    )}
                    {r.review && (
                      <section className="section-block">
                        <h2>Opinión del servicio</h2>
                        <span className="rating">
                          {"★".repeat(r.review.rating)}
                        </span>
                        <p>{r.review.comment}</p>
                      </section>
                    )}
                  </div>
                  <aside className="request-aside">
                    <div className="person-summary">
                      <Avatar person={person} large />
                      <h3>{person.name}</h3>
                      <p>{contractor ? "Cliente" : "Tu profesional"}</p>
                      {r.conversation && (
                        <Button asChild>
                          <Link href={`/app/mensajes/${r.conversation.id}`}>
                            <MessageCircle size={18} />
                            Abrir conversación
                          </Link>
                        </Button>
                      )}
                    </div>
                    <div className="request-actions">
                      <h3>Siguiente paso</h3>
                      {contractor && r.status === "PENDING" && (
                        <>
                          <Confirm
                            label="Aceptar solicitud"
                            description="La solicitud quedará aceptada para coordinar los detalles con el cliente."
                            onConfirm={() => change("ACCEPTED")}
                          />
                          <Confirm
                            danger
                            label="Rechazar solicitud"
                            description="Esta solicitud quedará rechazada."
                            onConfirm={() => change("REJECTED")}
                          />
                        </>
                      )}
                      {contractor && r.status === "SCHEDULED" && (
                        <Confirm
                          label="Iniciar trabajo"
                          description="Confirma que comienzas el servicio acordado con el cliente."
                          onConfirm={() => change("IN_PROGRESS")}
                        />
                      )}{" "}
                      {contractor && r.status === "IN_PROGRESS" && (
                        <Confirm
                          label="Marcar trabajo realizado"
                          description="El cliente deberá confirmar que el servicio fue completado."
                          onConfirm={() => change("AWAITING_CONFIRMATION")}
                        />
                      )}{" "}
                      {!contractor && r.status === "AWAITING_CONFIRMATION" && (
                        <Confirm
                          label="Confirmar servicio completado"
                          description="Confirma que recibiste el servicio acordado. El pago debe estar registrado."
                          onConfirm={() => change("COMPLETED")}
                        />
                      )}{" "}
                      {!contractor &&
                        ["PENDING", "ACCEPTED", "SCHEDULED"].includes(
                          r.status,
                        ) && (
                          <Confirm
                            danger
                            label="Cancelar solicitud"
                            description="La solicitud quedará cancelada. Puedes crear otra cuando la necesites."
                            onConfirm={() => change("CANCELLED")}
                          />
                        )}{" "}
                      {["ACCEPTED", "AWAITING_CONFIRMATION"].includes(
                        r.status,
                      ) && (
                        <p className="muted">
                          {r.status === "ACCEPTED"
                            ? "Coordina una cita y confirma el monto antes de comenzar."
                            : "El trabajo espera la confirmación del cliente."}
                        </p>
                      )}
                      {["COMPLETED", "CANCELLED", "REJECTED"].includes(
                        r.status,
                      ) && (
                        <p className="muted">Este recorrido ha finalizado.</p>
                      )}
                    </div>
                    <Link
                      className="text-link report-link"
                      href={`/app/reportes?target=${person.id}`}
                    >
                      Reportar un problema
                    </Link>
                  </aside>
                </div>
              </>
            );
          })()}
      </State>
    </>
  );
}
