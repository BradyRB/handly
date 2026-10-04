"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Service } from "./types";
type MapInstance = { fitBounds(bounds: unknown): void };
type GoogleApi = {
  maps: {
    Map: new (element: HTMLElement, options: unknown) => MapInstance;
    Marker: new (options: unknown) => {
      addListener(event: string, callback: () => void): void;
      setMap(map: null): void;
    };
    LatLngBounds: new () => {
      extend(position: { lat: number; lng: number }): void;
    };
  };
};
declare global {
  interface Window {
    google?: GoogleApi;
    gm_authFailure?: () => void;
  }
}
let loading: Promise<void> | undefined;
function loadGoogle(key: string) {
  if (window.google?.maps) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=quarterly`;
    script.async = true;
    const timer = setTimeout(
      () =>
        reject(
          new Error("El mapa está tardando demasiado. Intenta nuevamente."),
        ),
      15000,
    );
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      loading = undefined;
      reject(new Error("No pudimos conectar con Google Maps."));
    };
    document.head.appendChild(script);
  });
  return loading;
}
export function GoogleMap({ services }: { services: Service[] }) {
  const target = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const located = services.filter(
    (s) =>
      s.contractor.contractorProfile?.latitude != null &&
      s.contractor.contractorProfile.longitude != null,
  );
  useEffect(() => {
    if (!key || !target.current) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    const markers: { setMap(map: null): void }[] = [];
    setBusy(true);
    setError("");
    window.gm_authFailure = () =>
      setError(
        "Google Maps no está disponible. Puedes continuar con la lista de profesionales.",
      );
    void loadGoogle(key)
      .then(() => {
        if (cancelled || !target.current || !window.google) return;
        const google = window.google;
        const map = new google.maps.Map(target.current, {
          center: { lat: 18.7357, lng: -70.1627 },
          zoom: 8,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const bounds = new google.maps.LatLngBounds();
        for (const s of located) {
          const position = {
            lat: s.contractor.contractorProfile!.latitude!,
            lng: s.contractor.contractorProfile!.longitude!,
          };
          bounds.extend(position);
          const marker = new google.maps.Marker({
            map,
            position,
            title: `${s.contractor.name} · ${s.title}`,
          });
          markers.push(marker);
          marker.addListener("click", () => {
            window.location.assign(`/profesionales/${s.contractor.id}`);
          });
        }
        if (located.length > 1) map.fitBounds(bounds);
        setBusy(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Mapa no disponible.");
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
      markers.forEach((m) => m.setMap(null));
      delete window.gm_authFailure;
    };
  }, [key, services]);
  return (
    <div className="map-layout">
      <div className="map-surface">
        {!key ? (
          <div className="map-unavailable">
            <MapPin size={46} />
            <h2>El mapa estará disponible al configurar Google Maps</h2>
            <p>
              Mientras tanto, encuentra profesionales por provincia y municipio
              en la lista.
            </p>
          </div>
        ) : (
          <>
            <div className="google-map" ref={target} />
            {busy && (
              <p className="map-overlay" role="status">
                Cargando mapa…
              </p>
            )}
            {error && (
              <p role="alert" className="map-overlay error">
                {error}
              </p>
            )}
          </>
        )}
      </div>
      <aside>
        <h3>Profesionales en esta búsqueda</h3>
        {services.map((s) => (
          <Link
            key={s.id}
            className="map-person"
            href={`/profesionales/${s.contractor.id}`}
          >
            <strong>{s.contractor.name}</strong>
            <span>{s.title}</span>
            <small>
              {s.municipality}, {s.province}
            </small>
          </Link>
        ))}
        <p className="muted">
          Las ubicaciones son zonas aproximadas de servicio.{" "}
          {services.length - located.length > 0
            ? `${services.length - located.length} servicios aún no tienen coordenadas.`
            : ""}
        </p>
      </aside>
    </div>
  );
}
