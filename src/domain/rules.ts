export type Role = "CLIENTE" | "CONTRATISTA";
export type Actor = { id: string; role: Role };
export type Status =
  | "PENDING"
  | "ACCEPTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "AWAITING_CONFIRMATION"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";
export type RequestIdentity = {
  clientId: string;
  contractorId: string;
  status: Status;
};
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function invariant(
  condition: unknown,
  message: string,
  status = 400,
): asserts condition {
  if (!condition) throw new DomainError(message, status);
}
export function participant(actor: Actor, request: RequestIdentity) {
  invariant(
    actor.id === request.clientId || actor.id === request.contractorId,
    "No tienes acceso a este recurso.",
    403,
  );
}
export function transition(
  actor: Actor,
  request: RequestIdentity,
  next: Status,
) {
  participant(actor, request);
  const contractor =
    actor.id === request.contractorId && actor.role === "CONTRATISTA";
  const client = actor.id === request.clientId && actor.role === "CLIENTE";
  const allowed = contractor
    ? {
        PENDING: ["ACCEPTED", "REJECTED"],
        SCHEDULED: ["IN_PROGRESS"],
        IN_PROGRESS: ["AWAITING_CONFIRMATION"],
      }
    : client
      ? {
          PENDING: ["CANCELLED"],
          ACCEPTED: ["CANCELLED"],
          SCHEDULED: ["CANCELLED"],
          AWAITING_CONFIRMATION: ["COMPLETED"],
        }
      : {};
  invariant(
    (allowed as Partial<Record<Status, string[]>>)[request.status]?.includes(
      next,
    ),
    "Este cambio de estado no está permitido.",
    409,
  );
}
export function canReview(
  actor: Actor,
  request: RequestIdentity,
  hasReview: boolean,
) {
  invariant(
    actor.role === "CLIENTE" && actor.id === request.clientId,
    "Solo el cliente de este trabajo puede opinar.",
    403,
  );
  invariant(
    request.status === "COMPLETED",
    "Primero confirma la finalización del servicio.",
    409,
  );
  invariant(!hasReview, "Ya enviaste una opinión para este servicio.", 409);
}
export function moneyToMinor(value: string): number {
  invariant(
    /^\d{1,9}(\.\d{1,2})?$/.test(value),
    "Monto inválido. Usa hasta dos decimales.",
  );
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  invariant(
    result > 0 && Number.isSafeInteger(result),
    "El monto debe ser positivo.",
  );
  return result;
}
export const terminalStatuses: Status[] = [
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
];
