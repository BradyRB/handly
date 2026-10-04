"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Form } from "./form";
import { api, useData, date } from "./api";
import {
  Avatar,
  Badge,
  Heading,
  State,
  locationFields,
  type Viewer,
} from "./shared";
import { signOut } from "next-auth/react";
import { Plus } from "lucide-react";
import { profile, report } from "@/domain/validation";
import type { Request, Report, UserProfile } from "./types";
export function Reports({
  user,
  initialTarget,
}: {
  user: NonNullable<Viewer>;
  initialTarget: string | null;
}) {
  const result = useData<Report[]>("reports");
  const requests = useData<Request[]>("requests");
  const [editing, setEditing] = useState<Report | null>(null);
  const [show, setShow] = useState(Boolean(initialTarget));
  const [notice, setNotice] = useState("");
  const people =
    requests.data
      ?.map((r) => (user.role === "CLIENTE" ? r.contractor : r.client))
      .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i) ?? [];
  return (
    <>
      <Heading
        title="Mis reportes"
        text="Cuéntanos si hubo un comportamiento inapropiado en un servicio."
      >
        <Button
          onClick={() => {
            setEditing(null);
            setShow(!show);
          }}
        >
          <Plus size={18} />
          Crear reporte
        </Button>
      </Heading>
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {show && (
        <div className="form-panel">
          <h2>{editing ? "Editar reporte" : "Nuevo reporte"}</h2>
          <Form
            key={editing?.id ?? "new"}
            schema={report}
            fields={[
              {
                name: "targetId",
                label: "Persona relacionada con el servicio",
                options: [
                  { value: "", label: "Selecciona una persona" },
                  ...people.map((p) => ({ value: p.id, label: p.name })),
                ],
              },
              {
                name: "reason",
                label: "Motivo",
                options: [
                  "Comportamiento inapropiado",
                  "Incumplimiento del acuerdo",
                  "Información engañosa",
                  "Otro",
                ].map((s) => ({ value: s, label: s })),
              },
              {
                name: "detail",
                label: "Describe lo que sucedió",
                type: "textarea",
              },
            ]}
            initial={
              editing
                ? { ...editing }
                : {
                    targetId: initialTarget ?? "",
                    reason: "Comportamiento inapropiado",
                  }
            }
            submit={editing ? "Actualizar reporte" : "Enviar reporte"}
            onSubmit={async (data) => {
              await api(
                editing ? `reports/${editing.id}` : "reports",
                editing ? "PATCH" : "POST",
                data,
              );
              setShow(false);
              setNotice("Reporte guardado.");
              result.refresh();
            }}
          />
        </div>
      )}
      <State {...result} empty={!result.data?.length} onRetry={result.refresh}>
        {result.data?.map((r) => (
          <article key={r.id} className="report-row">
            <div>
              <Badge status={r.status} />
              <h3>{r.reason}</h3>
              <p>
                Sobre {r.target.name} · {date(r.createdAt)}
              </p>
              <p className="preserve">{r.detail}</p>
            </div>
            {r.status === "OPEN" && (
              <div className="actions">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(r);
                    setShow(true);
                  }}
                >
                  Editar
                </Button>
                <Confirm
                  danger
                  label="Eliminar reporte"
                  description="Este reporte se eliminará de tu historial."
                  onConfirm={async () => {
                    await api(`reports/${r.id}`, "DELETE");
                    result.refresh();
                  }}
                />
              </div>
            )}
          </article>
        ))}
      </State>
    </>
  );
}

export function Profile({ user }: { user: NonNullable<Viewer> }) {
  const router = useRouter();
  const result = useData<UserProfile>("profile");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <Heading
        title={
          user.role === "CONTRATISTA" ? "Mi perfil profesional" : "Mi perfil"
        }
        text="Mantén tus datos al día para coordinar tus servicios."
      />
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <State {...result} onRetry={result.refresh}>
        {result.data && (
          <div className="form-panel">
            <div className="profile-email">
              <Avatar person={result.data} />
              <div>
                <strong>{result.data.email}</strong>
                <p>
                  {user.role === "CLIENTE"
                    ? "Cuenta cliente"
                    : "Cuenta contratista"}
                </p>
              </div>
            </div>
            <Form
              fields={[
                { name: "name", label: "Nombre completo" },
                { name: "phone", label: "Teléfono", type: "tel" },
                ...locationFields,
                ...(user.role === "CONTRATISTA"
                  ? [
                      { name: "specialty", label: "Especialidad" },
                      {
                        name: "bio",
                        label: "Presentación profesional",
                        type: "textarea",
                        required: false,
                      },
                      {
                        name: "experienceYears",
                        label: "Años de experiencia",
                        type: "number",
                        min: 0,
                        max: 70,
                      },
                      {
                        name: "latitude",
                        label: "Latitud de tu zona pública",
                        required: false,
                        hint: "Ubicación aproximada de servicio. Evita tu domicilio privado.",
                      },
                      {
                        name: "longitude",
                        label: "Longitud de tu zona pública",
                        required: false,
                      },
                    ]
                  : []),
              ]}
              initial={{
                ...result.data,
                ...result.data.contractorProfile,
                latitude: result.data.contractorProfile?.latitude ?? "",
                longitude: result.data.contractorProfile?.longitude ?? "",
              }}
              onSubmit={async (data) => {
                const payload = {
                  ...data,
                  latitude: data.latitude === "" ? null : data.latitude,
                  longitude: data.longitude === "" ? null : data.longitude,
                };
                await api("profile", "PATCH", profile.parse(payload));
                setNotice("Perfil actualizado.");
                router.refresh();
              }}
            />
          </div>
        )}
      </State>
      <section className="danger-zone">
        <h2>Eliminar cuenta</h2>
        <p>
          La cuenta se desactiva y tus datos de perfil se anonimizan. Las
          transacciones e historial de servicios se conservan. Debes cerrar tus
          solicitudes activas primero.
        </p>
        <Button variant="danger" onClick={() => setDeleting(!deleting)}>
          Quiero eliminar mi cuenta
        </Button>
        {deleting && (
          <Form
            fields={[
              {
                name: "password",
                label: "Confirma tu contraseña",
                type: "password",
              },
            ]}
            submit="Eliminar mi cuenta definitivamente"
            onSubmit={async (data) => {
              await api("profile", "DELETE", data);
              await signOut({ callbackUrl: "/" });
            }}
          />
        )}
      </section>
    </>
  );
}
