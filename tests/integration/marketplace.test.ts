import "dotenv/config";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";
import { marketplace } from "@/application/marketplace";
import { authOptions } from "@/infrastructure/auth";
import { rateLimit } from "@/infrastructure/rate-limit";
import Stripe from "stripe";
import { checkout, processWebhook } from "@/infrastructure/payments";
const db = new PrismaClient(),
  app = marketplace(db);
const ids: string[] = [];
const suffix = `${Date.now()}`;
let client: { id: string; role: "CLIENTE" },
  contractor: { id: string; role: "CONTRATISTA" },
  stranger: { id: string; role: "CLIENTE" },
  categoryId: string,
  publicationId: string,
  requestId: string,
  conversationId: string;
const base = {
  password: "IntegrationTest10!",
  phone: "8095550101",
  province: "Distrito Nacional" as const,
  municipality: "Santo Domingo de Guzmán",
  consent: true,
};
const service = () => ({
  categoryId,
  title: `Electricidad QA ${suffix}`,
  description:
    "Revisión de instalaciones y circuitos eléctricos residenciales para pruebas.",
  province: "Distrito Nacional",
  municipality: "Santo Domingo de Guzmán",
  basePrice: "1500.25",
  visible: true,
});
beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error("Pruebas integradas permitidas solo en base local.");
  categoryId = (await db.serviceCategory.findFirstOrThrow()).id;
  client = (await app.register({
    ...base,
    name: "Cliente QA",
    email: `client-${suffix}@test.invalid`,
    role: "CLIENTE",
  })) as typeof client;
  ids.push(client.id);
  contractor = (await app.register({
    ...base,
    name: "Contratista QA",
    email: `contractor-${suffix}@test.invalid`,
    role: "CONTRATISTA",
  })) as typeof contractor;
  ids.push(contractor.id);
  stranger = (await app.register({
    ...base,
    name: "Persona QA",
    email: `stranger-${suffix}@test.invalid`,
    role: "CLIENTE",
  })) as typeof stranger;
  ids.push(stranger.id);
});
afterAll(async () => {
  const requests = await db.serviceRequest.findMany({
    where: { OR: [{ clientId: { in: ids } }, { contractorId: { in: ids } }] },
    select: { id: true },
  });
  const requestIds = requests.map((r) => r.id);
  await db.review.deleteMany({ where: { requestId: { in: requestIds } } });
  await db.payment.deleteMany({ where: { requestId: { in: requestIds } } });
  await db.userReport.deleteMany({ where: { authorId: { in: ids } } });
  await db.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
  await db.servicePublication.deleteMany({
    where: { contractorId: { in: ids } },
  });
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
describe.sequential("full persistent marketplace", () => {
  it("registers both roles and hashes passwords", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: client.id } });
    expect(user.passwordHash).not.toBe(base.password);
    expect(await compare(base.password, user.passwordHash)).toBe(true);
  });
  it("authenticates valid credentials and rejects wrong passwords", async () => {
    const provider = authOptions.providers[0] as unknown as {
      options: {
        authorize: (credentials: unknown) => Promise<{ id: string } | null>;
      };
    };
    expect(
      await provider.options.authorize({
        email: `client-${suffix}@test.invalid`,
        password: "WrongPassword",
      }),
    ).toBeNull();
    expect(
      (
        await provider.options.authorize({
          email: `client-${suffix}@test.invalid`,
          password: base.password,
        })
      )?.id,
    ).toBe(client.id);
  });
  it("creates and edits a publication with role and ownership protection", async () => {
    await expect(app.savePublication(client, service())).rejects.toThrow();
    const created = await app.savePublication(contractor, service());
    publicationId = created.id;
    const updated = await app.savePublication(
      contractor,
      { ...service(), basePrice: "1600.10" },
      created.id,
    );
    expect(updated.basePrice.toFixed(2)).toBe("1600.10");
    await expect(
      app.savePublication(
        { id: stranger.id, role: "CONTRATISTA" },
        service(),
        created.id,
      ),
    ).rejects.toThrow();
  });
  it("searches real rows with location, category and visibility", async () => {
    expect(
      (
        await app.search(
          new URLSearchParams({ q: suffix, province: "Distrito Nacional" }),
        )
      ).map((s) => s.id),
    ).toContain(publicationId);
    expect(
      await app.search(
        new URLSearchParams({ q: suffix, province: "Santiago" }),
      ),
    ).toHaveLength(0);
    await app.savePublication(
      contractor,
      { ...service(), visible: false },
      publicationId,
    );
    expect(await app.search(new URLSearchParams({ q: suffix }))).toHaveLength(
      0,
    );
    await expect(
      app.createRequest(client, {
        publicationId,
        description: "Necesito revisar un circuito de mi cocina.",
        address: "Calle de pruebas número 25",
        province: base.province,
        municipality: base.municipality,
      }),
    ).rejects.toThrow();
    await app.savePublication(contractor, service(), publicationId);
  });
  it("delivers a client request to the actual contractor", async () => {
    const request = await app.createRequest(client, {
      publicationId,
      description: "Necesito revisar un circuito de mi cocina.",
      address: "Calle de pruebas número 25",
      province: base.province,
      municipality: base.municipality,
    });
    requestId = request.id;
    conversationId = request.conversation!.id;
    expect((await app.requests(contractor)).map((r) => r.id)).toContain(
      requestId,
    );
    expect((await app.requests(stranger)).map((r) => r.id)).not.toContain(
      requestId,
    );
    await expect(app.request(stranger, requestId)).rejects.toThrow();
  });
  it("rejects invalid transitions and accepts the assigned contractor", async () => {
    await expect(
      app.changeStatus(client, requestId, { status: "ACCEPTED" }),
    ).rejects.toThrow();
    await expect(
      app.changeStatus(contractor, requestId, { status: "COMPLETED" }),
    ).rejects.toThrow();
    expect(
      (await app.changeStatus(contractor, requestId, { status: "ACCEPTED" }))
        .status,
    ).toBe("ACCEPTED");
  });
  it("persists ordered messages and denies outsiders", async () => {
    const m = await app.sendMessage(client, conversationId, {
      body: "Hola, coordinemos el servicio.",
    });
    await app.sendMessage(contractor, conversationId, {
      body: "Claro, prepararé una propuesta.",
    });
    const chat = await app.messages(client, conversationId);
    expect(chat.messages).toHaveLength(2);
    expect(chat.messages[0].id).toBe(m.id);
    await expect(app.messages(stranger, conversationId)).rejects.toThrow();
    await expect(
      app.sendMessage(stranger, conversationId, { body: "Intrusión" }),
    ).rejects.toThrow();
  });
  it("manages proposed, edited, cancelled and confirmed appointments", async () => {
    const proposal = {
      startsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
      address: "Calle de pruebas número 25",
      amount: "1600.10",
    };
    await expect(
      app.proposeAppointment(client, requestId, proposal),
    ).rejects.toThrow();
    await app.proposeAppointment(contractor, requestId, proposal);
    await app.proposeAppointment(contractor, requestId, {
      ...proposal,
      amount: "1700.29",
    });
    await app.cancelAppointment(client, requestId);
    expect((await app.request(client, requestId)).appointment?.status).toBe(
      "CANCELLED",
    );
    await app.proposeAppointment(contractor, requestId, proposal);
    expect(
      (await app.confirmAppointment(client, requestId, { method: "CASH" }))
        .status,
    ).toBe("SCHEDULED");
    await expect(
      app.proposeAppointment(stranger, requestId, proposal),
    ).rejects.toThrow();
  });
  it("requires payment and customer completion before review", async () => {
    await expect(
      app.createReview(client, requestId, {
        rating: 5,
        comment: "Muy buen servicio y buena comunicación.",
      }),
    ).rejects.toThrow();
    await app.changeStatus(contractor, requestId, { status: "IN_PROGRESS" });
    await app.changeStatus(contractor, requestId, {
      status: "AWAITING_CONFIRMATION",
    });
    await expect(
      app.changeStatus(client, requestId, { status: "COMPLETED" }),
    ).rejects.toThrow();
    await expect(
      app.recordPayment(client, requestId, { confirm: true }),
    ).rejects.toThrow();
    await app.recordPayment(contractor, requestId, { confirm: true });
    await app.changeStatus(client, requestId, { status: "COMPLETED" });
    await expect(
      app.createReview(stranger, requestId, {
        rating: 5,
        comment: "Muy buen servicio y buena comunicación.",
      }),
    ).rejects.toThrow();
    await app.createReview(client, requestId, {
      rating: 5,
      comment: "Muy buen servicio y buena comunicación.",
    });
    await expect(
      app.createReview(client, requestId, {
        rating: 4,
        comment: "No debe permitirse esta reseña duplicada.",
      }),
    ).rejects.toThrow();
    expect((await app.contractor(contractor.id)).rating).toBe(5);
  });
  it("enforces report author ownership and relationship requirements", async () => {
    const data = {
      targetId: contractor.id,
      reason: "Otro",
      detail: "Comentario suficientemente detallado para comprobar el reporte.",
    };
    const report = await app.saveReport(client, data);
    await expect(app.saveReport(stranger, data, report.id)).rejects.toThrow();
    await expect(app.deleteReport(stranger, report.id)).rejects.toThrow();
    await app.saveReport(
      client,
      {
        ...data,
        detail: "Comentario actualizado con detalles adicionales del caso.",
      },
      report.id,
    );
    expect(await app.reports(client)).toHaveLength(1);
    await app.deleteReport(client, report.id);
  });
  it("enforces atomic rate limits", async () => {
    const key = `qa-${suffix}`;
    await rateLimit(key, 2);
    await rateLimit(key, 2);
    await expect(rateLimit(key, 2)).rejects.toThrow();
  });
  it("revokes earlier sessions on login and invalidates the active session on logout", async () => {
    const provider = authOptions.providers[0] as unknown as {
      options: {
        authorize: (
          credentials: unknown,
        ) => Promise<{ id: string; sessionVersion: number } | null>;
      };
    };
    const before = (
      await db.user.findUniqueOrThrow({ where: { id: client.id } })
    ).sessionVersion;
    const authenticated = await provider.options.authorize({
      email: `client-${suffix}@test.invalid`,
      password: base.password,
    });
    expect(authenticated!.sessionVersion).toBe(before + 1);
    const event = authOptions.events?.signOut as unknown as (input: {
      token: { sub: string; sessionVersion: number };
    }) => Promise<void>;
    await event({
      token: { sub: client.id, sessionVersion: authenticated!.sessionVersion },
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: client.id } }))
        .sessionVersion,
    ).toBe(before + 2);
  });
  it("labels and persists development card payments while preventing duplicates and unsafe edits", async () => {
    process.env.PAYMENT_ADAPTER = "development";
    const request = await app.createRequest(client, {
      publicationId,
      description: "Nueva prueba de pago con tarjeta en modo de desarrollo.",
      address: "Calle de pruebas número 28",
      province: base.province,
      municipality: base.municipality,
    });
    await app.changeStatus(contractor, request.id, { status: "ACCEPTED" });
    await app.proposeAppointment(contractor, request.id, {
      startsAt: new Date(Date.now() + 86400000 * 6).toISOString(),
      address: "Calle de pruebas número 28",
      amount: "1200.29",
    });
    await app.confirmAppointment(client, request.id, { method: "CARD" });
    await expect(
      app.recordPayment(contractor, request.id, { confirm: true }),
    ).rejects.toThrow();
    const payment = await app.recordPayment(client, request.id, {
      confirm: true,
    });
    expect(payment.adapter).toBe("development");
    expect(payment.status).toBe("PAID");
    expect(payment.amount.toFixed(2)).toBe("1200.29");
    await expect(
      app.recordPayment(client, request.id, { confirm: true }),
    ).rejects.toThrow();
    await expect(app.cancelAppointment(client, request.id)).rejects.toThrow();
    await expect(
      app.deleteAccount(client, { password: base.password }),
    ).rejects.toThrow();
    await app.changeStatus(contractor, request.id, { status: "IN_PROGRESS" });
    await app.changeStatus(contractor, request.id, {
      status: "AWAITING_CONFIRMATION",
    });
    await app.changeStatus(client, request.id, { status: "COMPLETED" });
  });
  it("validates Stripe test signatures, amounts, event idempotency and stale expiry without network calls", async () => {
    const oldAdapter = process.env.PAYMENT_ADAPTER,
      oldKey = process.env.STRIPE_SECRET_KEY,
      oldSecret = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.PAYMENT_ADAPTER = "stripe";
    process.env.STRIPE_SECRET_KEY = "sk_test_local-signature-fixture";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_local-fixture";
    let paymentId = "";
    try {
      const request = await app.createRequest(client, {
        publicationId,
        description: "Nueva prueba de webhook firmado y pago en sandbox.",
        address: "Calle de pruebas número 29",
        province: base.province,
        municipality: base.municipality,
      });
      await app.changeStatus(contractor, request.id, { status: "ACCEPTED" });
      await app.proposeAppointment(contractor, request.id, {
        startsAt: new Date(Date.now() + 86400000 * 7).toISOString(),
        address: "Calle de pruebas número 29",
        amount: "2500.29",
      });
      await app.confirmAppointment(client, request.id, { method: "CARD" });
      const result = await checkout(client, request.id, {
        checkout: async (input) => {
          paymentId = input.id;
          return {
            id: "cs_test_local",
            url: "https://checkout.stripe.com/c/pay/local-fixture",
          };
        },
      });
      expect(result.url).toContain("checkout.stripe.com");
      const event = {
        id: `evt_test_${suffix}`,
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_local",
            livemode: false,
            client_reference_id: paymentId,
            metadata: { paymentId },
            currency: "dop",
            amount_total: 250029,
            payment_status: "paid",
          },
        },
      };
      await expect(
        processWebhook(JSON.stringify(event), "invalid"),
      ).rejects.toThrow();
      const wrong = JSON.stringify({
        ...event,
        data: { object: { ...event.data.object, amount_total: 1 } },
      });
      await expect(
        processWebhook(
          wrong,
          Stripe.webhooks.generateTestHeaderString({
            payload: wrong,
            secret: process.env.STRIPE_WEBHOOK_SECRET,
          }),
        ),
      ).rejects.toThrow();
      const raw = JSON.stringify(event),
        signature = Stripe.webhooks.generateTestHeaderString({
          payload: raw,
          secret: process.env.STRIPE_WEBHOOK_SECRET,
        });
      await processWebhook(raw, signature);
      await processWebhook(raw, signature);
      expect(
        (await db.payment.findUniqueOrThrow({ where: { id: paymentId } }))
          .status,
      ).toBe("PAID");
      expect(await db.paymentEvent.count({ where: { id: event.id } })).toBe(1);
      const expired = JSON.stringify({
        ...event,
        id: `evt_expired_${suffix}`,
        type: "checkout.session.expired",
      });
      await processWebhook(
        expired,
        Stripe.webhooks.generateTestHeaderString({
          payload: expired,
          secret: process.env.STRIPE_WEBHOOK_SECRET,
        }),
      );
      expect(
        (await db.payment.findUniqueOrThrow({ where: { id: paymentId } }))
          .status,
      ).toBe("PAID");
      await app.changeStatus(contractor, request.id, { status: "IN_PROGRESS" });
      await app.changeStatus(contractor, request.id, {
        status: "AWAITING_CONFIRMATION",
      });
      await app.changeStatus(client, request.id, { status: "COMPLETED" });
    } finally {
      process.env.PAYMENT_ADAPTER = oldAdapter;
      if (oldKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = oldKey;
      if (oldSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = oldSecret;
      await db.paymentEvent.deleteMany({
        where: { id: { in: [`evt_test_${suffix}`, `evt_expired_${suffix}`] } },
      });
    }
  });
  it("anonymizes accounts and hides their publications", async () => {
    await app.deleteAccount(contractor, { password: base.password });
    const user = await db.user.findUniqueOrThrow({
      where: { id: contractor.id },
    });
    expect(user.deletedAt).not.toBeNull();
    expect(user.name).toBe("Cuenta eliminada");
    expect(await app.search(new URLSearchParams({ q: suffix }))).toHaveLength(
      0,
    );
  });
});
