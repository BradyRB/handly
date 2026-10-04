import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { marketplace } from "@/application/marketplace";
import { db } from "@/infrastructure/db";
import { requireActor } from "@/infrastructure/auth";
import { checkout, processWebhook } from "@/infrastructure/payments";
import { rateLimit } from "@/infrastructure/rate-limit";
import { DomainError, invariant } from "@/domain/rules";
const app = marketplace(db);
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
async function handler(
  req: NextRequest,
  context: { params: Promise<{ segments?: string[] }> },
) {
  const started = performance.now();
  try {
    const { segments = [] } = await context.params;
    const [resource, id, action] = segments;
    const method = req.method;
    invariant(segments.length <= 3, "Ruta no encontrada.", 404);
    if (resource === "webhook" && method === "POST") {
      invariant(
        Number(req.headers.get("content-length") ?? 0) < 100000,
        "Petición demasiado grande.",
        413,
      );
      const raw = await req.text();
      invariant(raw.length < 100000, "Petición demasiado grande.", 413);
      await processWebhook(raw, req.headers.get("stripe-signature") ?? "");
      return NextResponse.json({ received: true });
    }
    if (method !== "GET") {
      const origin = req.headers.get("origin");
      const allowed = new URL(process.env.NEXTAUTH_URL!).origin;
      // Browser mutations must include the trusted origin; Auth.js has its own CSRF protection.
      invariant(origin === allowed, "Origen de solicitud no autorizado.", 403);
      invariant(
        req.headers.get("content-type")?.includes("application/json"),
        "Usa contenido JSON.",
        415,
      );
    }
    const body = async () => {
      const raw = await req.text();
      invariant(raw.length <= 16000, "Petición demasiado grande.", 413);
      try {
        return JSON.parse(raw);
      } catch {
        throw new DomainError("JSON inválido.");
      }
    };
    let result: unknown;
    if (method === "GET" && resource === "categories" && !id)
      result = await app.categories();
    else if (method === "GET" && resource === "search" && !id)
      result = await app.search(req.nextUrl.searchParams);
    else if (method === "GET" && resource === "contractors" && id && !action)
      result = await app.contractor(id);
    else if (method === "POST" && resource === "register" && !id) {
      await rateLimit(
        `register:${req.headers.get("x-forwarded-for") ?? "local"}`,
        20,
        3600,
      );
      result = await app.register(await body());
    } else {
      const actor = await requireActor();
      if (method !== "GET") await rateLimit(`mutation:${actor.id}`, 90, 60);
      if (resource === "profile" && !id) {
        if (method === "GET") result = await app.profile(actor);
        else if (method === "PATCH")
          result = await app.updateProfile(actor, await body());
        else if (method === "DELETE")
          result = await app.deleteAccount(actor, await body());
      } else if (resource === "publications" && !action) {
        if (method === "GET" && !id) result = await app.publications(actor);
        else if (method === "POST" && !id)
          result = await app.savePublication(actor, await body());
        else if (method === "PATCH" && id)
          result = await app.savePublication(actor, await body(), id);
        else if (method === "DELETE" && id)
          result = await app.deletePublication(actor, id);
      } else if (resource === "requests") {
        if (method === "GET" && !action)
          result = id
            ? await app.request(actor, id)
            : await app.requests(actor);
        else if (method === "POST" && !id)
          result = await app.createRequest(actor, await body());
        else if (method === "PATCH" && id && action === "status")
          result = await app.changeStatus(actor, id, await body());
        else if (method === "PUT" && id && action === "appointment")
          result = await app.proposeAppointment(actor, id, await body());
        else if (method === "DELETE" && id && action === "appointment")
          result = await app.cancelAppointment(actor, id);
        else if (method === "POST" && id && action === "confirm")
          result = await app.confirmAppointment(actor, id, await body());
        else if (method === "POST" && id && action === "payment")
          result = await app.recordPayment(actor, id, await body());
        else if (method === "POST" && id && action === "checkout")
          result = await checkout(actor, id);
        else if (method === "POST" && id && action === "review")
          result = await app.createReview(actor, id, await body());
      } else if (resource === "conversations") {
        if (method === "GET" && !id) result = await app.conversations(actor);
        else if (method === "GET" && id && !action)
          result = await app.messages(
            actor,
            id,
            req.nextUrl.searchParams.get("before") ?? undefined,
          );
        else if (method === "POST" && id && action === "messages")
          result = await app.sendMessage(actor, id, await body());
      } else if (method === "GET" && !id && resource === "appointments")
        result = await app.appointments(actor);
      else if (method === "GET" && !id && resource === "payments")
        result = await app.payments(actor);
      else if (method === "GET" && !id && resource === "reviews")
        result = await app.reviews(actor);
      else if (resource === "reports" && !action) {
        if (method === "GET" && !id) result = await app.reports(actor);
        else if (method === "POST" && !id)
          result = await app.saveReport(actor, await body());
        else if (method === "PATCH" && id)
          result = await app.saveReport(actor, await body(), id);
        else if (method === "DELETE" && id)
          result = await app.deleteReport(actor, id);
      }
    }
    invariant(result !== undefined, "Ruta no encontrada.", 404);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        "Server-Timing": `app;dur=${Math.round(performance.now() - started)}`,
      },
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Datos inválidos.",
          fields: error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    if (error instanceof DomainError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        {
          error:
            "Este registro ya existe. Verifica los datos o recarga la página.",
        },
        { status: 409 },
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      return NextResponse.json(
        { error: "Otra operación cambió los datos. Intenta nuevamente." },
        { status: 409 },
      );
    console.error("handly_api_error", {
      path: req.nextUrl.pathname,
      type: error instanceof Error ? error.name : "Unknown",
    });
    return NextResponse.json(
      { error: "No pudimos completar la operación. Intenta nuevamente." },
      { status: 500 },
    );
  }
}
export {
  handler as GET,
  handler as POST,
  handler as PATCH,
  handler as PUT,
  handler as DELETE,
};
