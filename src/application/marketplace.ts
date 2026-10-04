import { Prisma, PrismaClient } from "@prisma/client";
import { hash, compare } from "bcryptjs";
import { z } from "zod";
import * as validate from "@/domain/validation";
import {
  Actor,
  invariant,
  participant,
  transition,
  canReview,
  terminalStatuses,
  DomainError,
} from "@/domain/rules";
type Tx = Prisma.TransactionClient;
const publicUser = {
  id: true,
  name: true,
  province: true,
  municipality: true,
  contractorProfile: true,
} as const;
const requestInclude = {
  client: { select: publicUser },
  contractor: { select: publicUser },
  conversation: true,
  appointment: true,
  payment: true,
  review: true,
} as const;
function role(actor: Actor, expected: Actor["role"]) {
  invariant(
    actor.role === expected,
    "Tu cuenta no puede realizar esta acción.",
    403,
  );
}
const audit = (tx: Tx, actorId: string, action: string, resourceId: string) =>
  tx.auditLog.create({ data: { actorId, action, resourceId } });
/** The application layer receives its database adapter; domain policies remain pure. */
export function marketplace(db: PrismaClient) {
  async function serial<T>(
    actor: Actor,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await db.$transaction(
          async (tx) => {
            invariant(
              await tx.user.findFirst({
                where: { id: actor.id, role: actor.role, deletedAt: null },
                select: { id: true },
              }),
              "Tu cuenta no está disponible.",
              401,
            );
            return work(tx);
          },
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        )
          continue;
        throw error;
      }
    }
    throw new DomainError("Conflicto de edición. Intenta otra vez.", 409);
  }
  async function ownedRequest(tx: Tx, actor: Actor, id: string) {
    const request = await tx.serviceRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
    invariant(request, "Solicitud no encontrada.", 404);
    participant(actor, request);
    return request;
  }
  return {
    async register(input: unknown) {
      const data = validate.registration.parse(input);
      const passwordHash = await hash(data.password, 12);
      return db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: data.email,
            passwordHash,
            name: data.name,
            phone: data.phone,
            province: data.province,
            municipality: data.municipality,
            role: data.role,
            ...(data.role === "CLIENTE"
              ? { clientProfile: { create: {} } }
              : {
                  contractorProfile: {
                    create: {
                      bio: data.bio,
                      specialty: data.specialty,
                      experienceYears: data.experienceYears,
                    },
                  },
                }),
          },
          select: { id: true, role: true },
        });
        await audit(tx, user.id, "REGISTER", user.id);
        return user;
      });
    },
    async profile(actor: Actor) {
      return db.user.findUnique({
        where: { id: actor.id },
        select: { ...publicUser, email: true, phone: true, role: true },
      });
    },
    async updateProfile(actor: Actor, input: unknown) {
      const data = validate.profile.parse(input);
      return serial(actor, async (tx) => {
        const user = await tx.user.update({
          where: { id: actor.id },
          data: {
            name: data.name,
            phone: data.phone,
            province: data.province,
            municipality: data.municipality,
          },
          select: { id: true },
        });
        if (actor.role === "CONTRATISTA") {
          const latitude = data.latitude ?? null,
            longitude = data.longitude ?? null;
          invariant(
            (latitude === null) === (longitude === null),
            "Incluye ambas coordenadas o deja ambas vacías.",
          );
          await tx.contractorProfile.update({
            where: { userId: actor.id },
            data: {
              bio: data.bio,
              specialty: data.specialty,
              experienceYears: data.experienceYears,
              latitude,
              longitude,
            },
          });
        }
        await audit(tx, actor.id, "UPDATE_PROFILE", actor.id);
        return user;
      });
    },
    async deleteAccount(actor: Actor, input: unknown) {
      const { password } = z
        .object({ password: z.string().min(1).max(72) })
        .parse(input);
      return serial(actor, async (tx) => {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: actor.id },
        });
        invariant(
          await compare(password, user.passwordHash),
          "Contraseña incorrecta.",
          403,
        );
        const active = await tx.serviceRequest.count({
          where: {
            OR: [{ clientId: actor.id }, { contractorId: actor.id }],
            status: { notIn: terminalStatuses },
          },
        });
        invariant(
          !active,
          "Finaliza o cancela tus solicitudes activas antes de eliminar la cuenta.",
          409,
        );
        await tx.servicePublication.updateMany({
          where: { contractorId: actor.id },
          data: { visible: false, deletedAt: new Date() },
        });
        await tx.contractorProfile.updateMany({
          where: { userId: actor.id },
          data: {
            bio: "",
            specialty: "",
            experienceYears: 0,
            latitude: null,
            longitude: null,
          },
        });
        await tx.user.update({
          where: { id: actor.id },
          data: {
            deletedAt: new Date(),
            email: `deleted-${actor.id}@invalid.local`,
            name: "Cuenta eliminada",
            phone: "",
            province: "",
            municipality: "",
            passwordHash: "",
            sessionVersion: { increment: 1 },
          },
        });
        await audit(tx, actor.id, "DELETE_ACCOUNT", actor.id);
        return { deleted: true };
      });
    },
    async categories() {
      return db.serviceCategory.findMany({ orderBy: { name: "asc" } });
    },
    async search(query: URLSearchParams) {
      const q = (query.get("q") ?? "").trim().slice(0, 100),
        province = query.get("province") ?? "",
        category = query.get("category") ?? "";
      const minRating = z.coerce
        .number()
        .min(0)
        .max(5)
        .parse(query.get("rating") || 0);
      const maxPrice = query.get("maxPrice");
      if (maxPrice) validate.amount.parse(maxPrice);
      const rows = await db.servicePublication.findMany({
        where: {
          visible: true,
          deletedAt: null,
          contractor: { deletedAt: null },
          ...(province && { province }),
          ...(category && { category: { slug: category } }),
          ...(maxPrice && { basePrice: { lte: maxPrice } }),
          ...(q && {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { contractor: { name: { contains: q, mode: "insensitive" } } },
            ],
          }),
        },
        include: {
          category: true,
          contractor: {
            select: {
              ...publicUser,
              receivedReviews: { select: { rating: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const services = rows
        .map(({ contractor, ...row }) => {
          const ratings = contractor.receivedReviews;
          const rating = ratings.length
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : null;
          const { receivedReviews: _, ...person } = contractor;
          return {
            ...row,
            contractor: person,
            rating,
            reviewCount: ratings.length,
          };
        })
        .filter((s) => !minRating || (s.rating ?? 0) >= minRating);
      return query.get("sort") === "price"
        ? services.sort((a, b) => a.basePrice.comparedTo(b.basePrice))
        : services;
    },
    async contractor(id: string) {
      const person = await db.user.findFirst({
        where: { id, role: "CONTRATISTA", deletedAt: null },
        select: {
          ...publicUser,
          publications: {
            where: { visible: true, deletedAt: null },
            include: { category: true },
          },
          receivedReviews: {
            include: { author: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      });
      invariant(person, "Profesional no encontrado.", 404);
      const aggregate = await db.review.aggregate({
        where: { contractorId: id },
        _avg: { rating: true },
        _count: true,
      });
      return {
        ...person,
        rating: aggregate._avg.rating,
        reviewCount: aggregate._count,
      };
    },
    async publications(actor: Actor) {
      role(actor, "CONTRATISTA");
      return db.servicePublication.findMany({
        where: { contractorId: actor.id, deletedAt: null },
        include: { category: true },
        orderBy: { createdAt: "desc" },
      });
    },
    async savePublication(actor: Actor, input: unknown, id?: string) {
      role(actor, "CONTRATISTA");
      const data = validate.publication.parse(input);
      return serial(actor, async (tx) => {
        if (id)
          invariant(
            await tx.servicePublication.findFirst({
              where: { id, contractorId: actor.id, deletedAt: null },
            }),
            "Publicación no encontrada.",
            404,
          );
        invariant(
          await tx.serviceCategory.findUnique({
            where: { id: data.categoryId },
          }),
          "Categoría no válida.",
        );
        const publication = id
          ? await tx.servicePublication.update({ where: { id }, data })
          : await tx.servicePublication.create({
              data: { ...data, contractorId: actor.id },
            });
        await audit(
          tx,
          actor.id,
          id ? "UPDATE_PUBLICATION" : "CREATE_PUBLICATION",
          publication.id,
        );
        return publication;
      });
    },
    async deletePublication(actor: Actor, id: string) {
      role(actor, "CONTRATISTA");
      return serial(actor, async (tx) => {
        const result = await tx.servicePublication.updateMany({
          where: { id, contractorId: actor.id, deletedAt: null },
          data: { deletedAt: new Date(), visible: false },
        });
        invariant(result.count === 1, "Publicación no encontrada.", 404);
        await audit(tx, actor.id, "DELETE_PUBLICATION", id);
        return { deleted: true };
      });
    },
    async createRequest(actor: Actor, input: unknown) {
      role(actor, "CLIENTE");
      const data = validate.serviceRequest.parse(input);
      return serial(actor, async (tx) => {
        const publication = await tx.servicePublication.findFirst({
          where: {
            id: data.publicationId,
            visible: true,
            deletedAt: null,
            contractor: { deletedAt: null },
          },
        });
        invariant(publication, "Este servicio ya no está disponible.", 404);
        invariant(
          publication.contractorId !== actor.id,
          "No puedes solicitar tu propio servicio.",
        );
        const request = await tx.serviceRequest.create({
          data: {
            ...data,
            clientId: actor.id,
            contractorId: publication.contractorId,
            serviceTitle: publication.title,
            conversation: { create: {} },
          },
          include: requestInclude,
        });
        await audit(tx, actor.id, "CREATE_REQUEST", request.id);
        return request;
      });
    },
    async requests(actor: Actor) {
      return db.serviceRequest.findMany({
        where:
          actor.role === "CLIENTE"
            ? { clientId: actor.id }
            : { contractorId: actor.id },
        include: requestInclude,
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    },
    async request(actor: Actor, id: string) {
      return db.$transaction((tx) => ownedRequest(tx, actor, id));
    },
    async changeStatus(actor: Actor, id: string, input: unknown) {
      const { status } = z
        .object({
          status: z.enum([
            "ACCEPTED",
            "REJECTED",
            "IN_PROGRESS",
            "AWAITING_CONFIRMATION",
            "COMPLETED",
            "CANCELLED",
          ]),
        })
        .parse(input);
      return serial(actor, async (tx) => {
        const request = await ownedRequest(tx, actor, id);
        transition(actor, request, status);
        if (status === "COMPLETED")
          invariant(
            request.payment?.status === "PAID",
            "El pago debe estar registrado antes de confirmar la finalización.",
            409,
          );
        if (status === "CANCELLED") {
          invariant(
            !request.payment ||
              !["PAID", "PROCESSING"].includes(request.payment.status),
            "No se puede cancelar un servicio pagado o con un pago en curso.",
            409,
          );
          await tx.appointment.updateMany({
            where: { requestId: id },
            data: { status: "CANCELLED" },
          });
        }
        const result = await tx.serviceRequest.update({
          where: { id },
          data: { status, version: { increment: 1 } },
          include: requestInclude,
        });
        await audit(tx, actor.id, `REQUEST_${status}`, id);
        return result;
      });
    },
    async conversations(actor: Actor) {
      return db.conversation.findMany({
        where: {
          request: { OR: [{ clientId: actor.id }, { contractorId: actor.id }] },
        },
        include: {
          request: {
            include: {
              client: { select: publicUser },
              contractor: { select: publicUser },
            },
          },
          messages: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
          },
        },
        orderBy: { request: { updatedAt: "desc" } },
        take: 100,
      });
    },
    async messages(actor: Actor, id: string, before?: string) {
      const conversation = await db.conversation.findUnique({
        where: { id },
        include: {
          request: {
            include: {
              client: { select: publicUser },
              contractor: { select: publicUser },
            },
          },
        },
      });
      invariant(conversation, "Conversación no encontrada.", 404);
      participant(actor, conversation.request);
      let cursor: { createdAt: Date; id: string } | null = null;
      if (before) {
        cursor = await db.message.findFirst({
          where: { id: before, conversationId: id },
          select: { createdAt: true, id: true },
        });
        invariant(cursor, "Cursor inválido.");
      }
      const messages = await db.message.findMany({
        where: {
          conversationId: id,
          ...(cursor && {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      return {
        ...conversation,
        messages: messages.reverse(),
        hasMore: messages.length === 100,
      };
    },
    async sendMessage(actor: Actor, id: string, input: unknown) {
      const { body } = validate.message.parse(input);
      return serial(actor, async (tx) => {
        const conversation = await tx.conversation.findUnique({
          where: { id },
          include: { request: true },
        });
        invariant(conversation, "Conversación no encontrada.", 404);
        participant(actor, conversation.request);
        invariant(
          !["REJECTED", "CANCELLED"].includes(conversation.request.status),
          "La conversación de esta solicitud está cerrada.",
          409,
        );
        const result = await tx.message.create({
          data: { body, conversationId: id, senderId: actor.id },
        });
        await audit(tx, actor.id, "SEND_MESSAGE", result.id);
        return result;
      });
    },
    async appointments(actor: Actor) {
      return db.appointment.findMany({
        where: {
          request: { OR: [{ clientId: actor.id }, { contractorId: actor.id }] },
        },
        include: {
          request: {
            include: {
              client: { select: publicUser },
              contractor: { select: publicUser },
            },
          },
        },
        orderBy: { startsAt: "asc" },
        take: 100,
      });
    },
    async proposeAppointment(actor: Actor, id: string, input: unknown) {
      role(actor, "CONTRATISTA");
      const data = validate.appointment.parse(input);
      return serial(actor, async (tx) => {
        const request = await ownedRequest(tx, actor, id);
        invariant(request.contractorId === actor.id, "No autorizado.", 403);
        invariant(
          ["ACCEPTED", "SCHEDULED"].includes(request.status),
          "Primero acepta la solicitud. La agenda solo se edita antes de iniciar el trabajo.",
          409,
        );
        invariant(
          !request.payment ||
            !["PAID", "PROCESSING"].includes(request.payment.status),
          "No puedes cambiar un acuerdo pagado o con pago en curso.",
          409,
        );
        const startsAt = new Date(data.startsAt);
        const end = new Date(startsAt.getTime() + 60 * 60 * 1000);
        const start = new Date(startsAt.getTime() - 60 * 60 * 1000);
        const conflict = await tx.appointment.findFirst({
          where: {
            requestId: { not: id },
            status: { not: "CANCELLED" },
            startsAt: { gt: start, lt: end },
            request: {
              contractorId: actor.id,
              status: { notIn: terminalStatuses },
            },
          },
        });
        invariant(
          !conflict,
          "Ya tienes una cita en ese horario. Deja al menos una hora entre servicios.",
          409,
        );
        const result = await tx.appointment.upsert({
          where: { requestId: id },
          create: { ...data, startsAt, requestId: id },
          update: { ...data, startsAt, status: "PROPOSED" },
        });
        await tx.payment.deleteMany({
          where: { requestId: id, status: { in: ["PENDING", "FAILED"] } },
        });
        await tx.serviceRequest.update({
          where: { id },
          data: { status: "ACCEPTED", version: { increment: 1 } },
        });
        await audit(tx, actor.id, "PROPOSE_APPOINTMENT", result.id);
        return result;
      });
    },
    async confirmAppointment(actor: Actor, id: string, input: unknown) {
      role(actor, "CLIENTE");
      const { method } = z
        .object({ method: z.enum(["CASH", "CARD"]) })
        .parse(input);
      return serial(actor, async (tx) => {
        const request = await ownedRequest(tx, actor, id);
        invariant(request.clientId === actor.id, "No autorizado.", 403);
        invariant(
          request.status === "ACCEPTED" &&
            request.appointment?.status === "PROPOSED",
          "No hay una propuesta pendiente.",
          409,
        );
        invariant(
          request.appointment.startsAt > new Date(),
          "La fecha propuesta ya pasó. Pide una nueva cita.",
          409,
        );
        await tx.appointment.update({
          where: { requestId: id },
          data: { status: "CONFIRMED" },
        });
        const adapter =
          method === "CASH"
            ? "cash"
            : process.env.PAYMENT_ADAPTER === "stripe"
              ? "stripe-test"
              : "development";
        await tx.payment.create({
          data: {
            requestId: id,
            amount: request.appointment.amount,
            method,
            adapter,
          },
        });
        const result = await tx.serviceRequest.update({
          where: { id },
          data: { status: "SCHEDULED", version: { increment: 1 } },
          include: requestInclude,
        });
        await audit(tx, actor.id, "CONFIRM_APPOINTMENT", id);
        return result;
      });
    },
    async cancelAppointment(actor: Actor, id: string) {
      return serial(actor, async (tx) => {
        const request = await ownedRequest(tx, actor, id);
        invariant(
          ["ACCEPTED", "SCHEDULED"].includes(request.status) &&
            request.appointment &&
            request.appointment.status !== "CANCELLED",
          "Esta cita no se puede cancelar.",
          409,
        );
        invariant(
          !request.payment ||
            !["PAID", "PROCESSING"].includes(request.payment.status),
          "No se puede cancelar una cita pagada o con pago en curso.",
          409,
        );
        await tx.payment.deleteMany({ where: { requestId: id } });
        await tx.appointment.update({
          where: { requestId: id },
          data: { status: "CANCELLED" },
        });
        await tx.serviceRequest.update({
          where: { id },
          data: { status: "ACCEPTED", version: { increment: 1 } },
        });
        await audit(tx, actor.id, "CANCEL_APPOINTMENT", id);
        return { cancelled: true };
      });
    },
    async payments(actor: Actor) {
      return db.payment.findMany({
        where: {
          request: { OR: [{ clientId: actor.id }, { contractorId: actor.id }] },
        },
        include: { request: { select: { id: true, serviceTitle: true } } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
    },
    async recordPayment(actor: Actor, id: string, input: unknown) {
      const { confirm } = z.object({ confirm: z.literal(true) }).parse(input);
      return serial(actor, async (tx) => {
        const request = await ownedRequest(tx, actor, id);
        const payment = request.payment;
        invariant(
          payment && request.appointment?.status === "CONFIRMED",
          "Confirma el acuerdo antes de registrar el pago.",
          409,
        );
        invariant(
          ["SCHEDULED", "IN_PROGRESS", "AWAITING_CONFIRMATION"].includes(
            request.status,
          ),
          "El servicio no admite pagos.",
          409,
        );
        invariant(
          payment.status === "PENDING" || payment.status === "FAILED",
          "El pago ya fue registrado o está en curso.",
          409,
        );
        if (payment.method === "CASH") {
          invariant(
            actor.id === request.contractorId && actor.role === "CONTRATISTA",
            "Solo el contratista puede confirmar la recepción de efectivo.",
            403,
          );
          invariant(
            ["IN_PROGRESS", "AWAITING_CONFIRMATION"].includes(request.status),
            "Inicia el trabajo antes de confirmar efectivo.",
            409,
          );
        } else {
          invariant(
            actor.id === request.clientId && actor.role === "CLIENTE",
            "Solo el cliente puede pagar.",
            403,
          );
          invariant(
            payment.adapter === "development" &&
              process.env.PAYMENT_ADAPTER === "development",
            "Utiliza el pago seguro con el proveedor.",
            409,
          );
        }
        const result = await tx.payment.update({
          where: { requestId: id },
          data: { status: confirm ? "PAID" : "PENDING", paidAt: new Date() },
        });
        await audit(
          tx,
          actor.id,
          payment.method === "CASH" ? "RECEIVE_CASH" : "SIMULATE_TEST_PAYMENT",
          id,
        );
        return result;
      });
    },
    async createReview(actor: Actor, id: string, input: unknown) {
      const data = validate.review.parse(input);
      return serial(actor, async (tx) => {
        const request = await ownedRequest(tx, actor, id);
        canReview(actor, request, !!request.review);
        const result = await tx.review.create({
          data: {
            ...data,
            requestId: id,
            authorId: actor.id,
            contractorId: request.contractorId,
          },
        });
        await audit(tx, actor.id, "CREATE_REVIEW", result.id);
        return result;
      });
    },
    async reviews(actor: Actor) {
      return db.review.findMany({
        where:
          actor.role === "CLIENTE"
            ? { authorId: actor.id }
            : { contractorId: actor.id },
        include: {
          author: { select: publicUser },
          contractor: { select: publicUser },
          request: { select: { serviceTitle: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    },
    async reports(actor: Actor) {
      return db.userReport.findMany({
        where: { authorId: actor.id },
        include: { target: { select: publicUser } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    },
    async saveReport(actor: Actor, input: unknown, id?: string) {
      const data = validate.report.parse(input);
      return serial(actor, async (tx) => {
        invariant(
          data.targetId !== actor.id,
          "No puedes reportar tu propia cuenta.",
        );
        invariant(
          await tx.user.findFirst({
            where: { id: data.targetId, deletedAt: null },
          }),
          "Usuario no encontrado.",
          404,
        );
        if (id) {
          const previous = await tx.userReport.findFirst({
            where: { id, authorId: actor.id, status: "OPEN" },
          });
          invariant(previous, "Reporte no encontrado o cerrado.", 404);
          invariant(
            previous.targetId === data.targetId,
            "No puedes cambiar la persona reportada.",
          );
        }
        const related = await tx.serviceRequest.count({
          where: {
            OR: [
              { clientId: actor.id, contractorId: data.targetId },
              { contractorId: actor.id, clientId: data.targetId },
            ],
          },
        });
        invariant(
          related,
          "Puedes reportar a personas con quienes tienes una solicitud de servicio.",
          403,
        );
        const result = id
          ? await tx.userReport.update({ where: { id }, data })
          : await tx.userReport.create({
              data: { ...data, authorId: actor.id },
            });
        await audit(
          tx,
          actor.id,
          id ? "UPDATE_REPORT" : "CREATE_REPORT",
          result.id,
        );
        return result;
      });
    },
    async deleteReport(actor: Actor, id: string) {
      return serial(actor, async (tx) => {
        const result = await tx.userReport.deleteMany({
          where: { id, authorId: actor.id, status: "OPEN" },
        });
        invariant(result.count === 1, "Reporte no encontrado o cerrado.", 404);
        await audit(tx, actor.id, "DELETE_REPORT", id);
        return { deleted: true };
      });
    },
  };
}
