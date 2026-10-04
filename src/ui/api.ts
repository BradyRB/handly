"use client";
import { useCallback, useEffect, useState } from "react";
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/handly/${path}`, {
    method,
    headers:
      method === "GET" ? undefined : { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(data ?? {}),
    signal,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "No pudimos completar la operación.");
  return result as T;
}
export function useData<T>(path: string | null, interval = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (!path) {
      setData(null);
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setData(null);
    setError("");
    async function read() {
      try {
        const value = await api<T>(path!, "GET", undefined, abort.signal);
        if (!abort.signal.aborted) {
          setData(value);
          setError("");
        }
      } catch (e) {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "Error de conexión.");
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }
    void read();
    const timer = interval
      ? setInterval(() => {
          if (document.visibilityState === "visible") void read();
        }, interval)
      : null;
    return () => {
      abort.abort();
      if (timer) clearInterval(timer);
    };
  }, [path, tick, interval]);
  return { data, error, loading, refresh };
}
export const currency = (value: string | number) =>
  `RD$ ${Number(value).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const date = (value: string) =>
  new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
export const datetime = (value: string) =>
  new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const labels: Record<string, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  SCHEDULED: "Agendada",
  IN_PROGRESS: "En curso",
  AWAITING_CONFIRMATION: "Por confirmar",
  COMPLETED: "Completada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  PROPOSED: "Propuesta",
  CONFIRMED: "Confirmada",
  PAID: "Pagado",
  PROCESSING: "En proceso",
  FAILED: "Fallido",
  OPEN: "Abierto",
  CLOSED: "Cerrado",
};
