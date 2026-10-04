import Stripe from "stripe";
import { db } from "./db";
import { Actor, invariant, participant, moneyToMinor } from "@/domain/rules";
export interface PaymentGateway {
  checkout(input: {
    id: string;
    attempt: number;
    amount: string;
    title: string;
    requestId: string;
  }): Promise<{ id: string; url: string }>;
}
export function stripeClient() {
  invariant(
    process.env.PAYMENT_ADAPTER === "stripe" &&
      process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"),
    "El proveedor de tarjetas de prueba no está configurado.",
    503,
  );
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}
export class StripeTestGateway implements PaymentGateway {
  async checkout(input: {
    id: string;
    attempt: number;
    amount: string;
    title: string;
    requestId: string;
  }) {
    const origin = process.env.NEXTAUTH_URL!;
    const result = await stripeClient().checkout.sessions.create(
      {
        mode: "payment",
        allowed_payment_method_types: ["card"],
        client_reference_id: input.id,
        metadata: { paymentId: input.id },
        line_items: [
          {
            price_data: {
              currency: "dop",
              unit_amount: moneyToMinor(input.amount),
              product_data: { name: input.title },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/app/solicitudes/${input.requestId}?pago=pendiente`,
        cancel_url: `${origin}/app/solicitudes/${input.requestId}?pago=cancelado`,
      },
      { idempotencyKey: `handly-${input.id}-${input.attempt}` },
    );
    invariant(result.url, "El proveedor no devolvió una página de pago.", 502);
    return { id: result.id, url: result.url };
  }
}
export async function checkout(
  actor: Actor,
  id: string,
  gateway: PaymentGateway = new StripeTestGateway(),
) {
  stripeClient();
  const payment = await db.$transaction(
    async (tx) => {
      const request = await tx.serviceRequest.findUnique({
        where: { id },
        include: { payment: true, appointment: true },
      });
      invariant(request, "Solicitud no encontrada.", 404);
      participant(actor, request);
      invariant(
        actor.id === request.clientId && actor.role === "CLIENTE",
        "Solo el cliente puede pagar.",
        403,
      );
      invariant(
        ["SCHEDULED", "IN_PROGRESS", "AWAITING_CONFIRMATION"].includes(
          request.status,
        ) && request.appointment?.status === "CONFIRMED",
        "Confirma primero el acuerdo.",
        409,
      );
      const payment = request.payment;
      invariant(
        payment?.method === "CARD" && payment.adapter === "stripe-test",
        "Método de pago inválido.",
        409,
      );
      invariant(
        ["PENDING", "FAILED", "PROCESSING"].includes(payment.status),
        "El pago ya se registró.",
        409,
      );
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: "PROCESSING" },
      });
      return { ...updated, title: request.serviceTitle };
    },
    { isolationLevel: "Serializable" },
  );
  try {
    const result = await gateway.checkout({
      id: payment.id,
      attempt: payment.attempt,
      amount: payment.amount.toString(),
      title: payment.title,
      requestId: id,
    });
    await db.payment.update({
      where: { id: payment.id },
      data: { providerSessionId: result.id },
    });
    return { url: result.url };
  } catch (e) {
    /* Keep PROCESSING: provider may have created a session; retry uses the same idempotency key. */ throw e;
  }
}
export async function processWebhook(raw: string, signature: string) {
  invariant(process.env.STRIPE_WEBHOOK_SECRET, "Webhook no configurado.", 503);
  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(
      raw,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError)
      invariant(false, "Firma del proveedor inválida.", 400);
    throw error;
  }
  if (
    ![
      "checkout.session.completed",
      "checkout.session.expired",
      "checkout.session.async_payment_failed",
    ].includes(event.type)
  )
    return;
  const session = event.data.object as Stripe.Checkout.Session;
  invariant(session.livemode === false, "Solo se admiten eventos de prueba.");
  await db.$transaction(
    async (tx) => {
      if (await tx.paymentEvent.findUnique({ where: { id: event.id } })) return;
      const payment = await tx.payment.findUnique({
        where: { id: session.metadata?.paymentId ?? "" },
      });
      invariant(
        payment && payment.adapter === "stripe-test",
        "Pago desconocido.",
      );
      invariant(
        session.client_reference_id === payment.id &&
          session.currency === "dop" &&
          session.amount_total === moneyToMinor(payment.amount.toString()),
        "Los datos del proveedor no coinciden.",
      );
      // A stale expiry must never overwrite a successful or newer payment attempt.
      if (
        payment.providerSessionId &&
        payment.providerSessionId !== session.id
      ) {
        await tx.paymentEvent.create({ data: { id: event.id } });
        return;
      }
      if (payment.status !== "PAID") {
        const paid =
          event.type === "checkout.session.completed" &&
          session.payment_status === "paid";
        if (paid || event.type !== "checkout.session.completed") {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: paid ? "PAID" : "FAILED",
              paidAt: paid ? new Date() : null,
              providerSessionId: session.id,
              ...(!paid && { attempt: { increment: 1 } }),
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: "stripe-test",
              action: paid ? "PAYMENT_WEBHOOK_PAID" : "PAYMENT_WEBHOOK_FAILED",
              resourceId: payment.id,
            },
          });
        }
      }
      await tx.paymentEvent.create({ data: { id: event.id } });
    },
    { isolationLevel: "Serializable" },
  );
}
