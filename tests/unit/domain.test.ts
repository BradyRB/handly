import { describe, it, expect } from "vitest";
import {
  transition,
  participant,
  canReview,
  moneyToMinor,
} from "@/domain/rules";
import {
  registration,
  publication,
  appointment,
  review,
} from "@/domain/validation";
const client = { id: "client", role: "CLIENTE" as const },
  contractor = { id: "contractor", role: "CONTRATISTA" as const };
const pending = {
  clientId: "client",
  contractorId: "contractor",
  status: "PENDING" as const,
};
describe("request lifecycle and ownership", () => {
  it("lets only the assigned contractor accept", () => {
    expect(() => transition(contractor, pending, "ACCEPTED")).not.toThrow();
    expect(() => transition(client, pending, "ACCEPTED")).toThrow();
  });
  it("rejects non-participant access", () =>
    expect(() =>
      participant({ id: "stranger", role: "CLIENTE" }, pending),
    ).toThrow());
  it("rejects skipping scheduling and work", () =>
    expect(() => transition(contractor, pending, "COMPLETED")).toThrow());
  it("allows client cancellation before work", () =>
    expect(() =>
      transition(client, { ...pending, status: "SCHEDULED" }, "CANCELLED"),
    ).not.toThrow());
  it("prevents cancellation during work", () =>
    expect(() =>
      transition(client, { ...pending, status: "IN_PROGRESS" }, "CANCELLED"),
    ).toThrow());
  it("requires client confirmation after contractor completion", () => {
    expect(() =>
      transition(
        contractor,
        { ...pending, status: "IN_PROGRESS" },
        "AWAITING_CONFIRMATION",
      ),
    ).not.toThrow();
    expect(() =>
      transition(
        client,
        { ...pending, status: "AWAITING_CONFIRMATION" },
        "COMPLETED",
      ),
    ).not.toThrow();
  });
  it("prevents reopening terminal states", () =>
    expect(() =>
      transition(contractor, { ...pending, status: "COMPLETED" }, "ACCEPTED"),
    ).toThrow());
});
describe("review policy", () => {
  it("requires a completed service", () =>
    expect(() => canReview(client, pending, false)).toThrow());
  it("requires the actual client", () =>
    expect(() =>
      canReview(contractor, { ...pending, status: "COMPLETED" }, false),
    ).toThrow());
  it("prevents duplicate reviews", () =>
    expect(() =>
      canReview(client, { ...pending, status: "COMPLETED" }, true),
    ).toThrow());
  it("accepts the completed client service", () =>
    expect(() =>
      canReview(client, { ...pending, status: "COMPLETED" }, false),
    ).not.toThrow());
});
describe("financial safety and validation", () => {
  it("converts exact decimals to integer minor units", () => {
    expect(moneyToMinor("1200.01")).toBe(120001);
    expect(moneyToMinor("0.29")).toBe(29);
  });
  it.each(["0", "-1", "1.234", "Infinity", "1e4"])(
    "rejects unsafe amounts %s",
    (value) => expect(() => moneyToMinor(value)).toThrow(),
  );
  it("requires consent and complex passwords at registration", () => {
    const valid = {
      name: "Test User",
      email: "test@example.com",
      password: "StrongPassword10",
      role: "CLIENTE",
      phone: "8095550123",
      province: "Distrito Nacional",
      municipality: "Santo Domingo de Guzmán",
      consent: true,
    };
    expect(registration.safeParse(valid).success).toBe(true);
    expect(registration.safeParse({ ...valid, consent: false }).success).toBe(
      false,
    );
    expect(
      registration.safeParse({ ...valid, password: "password" }).success,
    ).toBe(false);
  });
  it("rejects invalid publication category data, price and province", () =>
    expect(
      publication.safeParse({
        title: "x",
        basePrice: "-5",
        province: "Invalid",
      }).success,
    ).toBe(false));
  it("rejects past appointments", () =>
    expect(
      appointment.safeParse({
        startsAt: "2020-01-01T12:00:00Z",
        address: "Calle Ejemplo 123",
        amount: "1500",
      }).success,
    ).toBe(false));
  it("rejects ratings outside the range", () =>
    expect(
      review.safeParse({
        rating: 6,
        comment: "Una opinión suficientemente larga.",
      }).success,
    ).toBe(false));
});
