import { createHash } from "node:crypto";
import { db } from "./db";
import { DomainError } from "@/domain/rules";
export async function rateLimit(
  identity: string,
  maximum: number,
  windowSeconds = 600,
) {
  const key = createHash("sha256")
    .update(`${process.env.NEXTAUTH_SECRET}:${identity}`)
    .digest("hex");
  const now = new Date();
  const resetsAt = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key", "count", "resetsAt") VALUES (${key}, 1, ${resetsAt}) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."resetsAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END, "resetsAt" = CASE WHEN "RateLimit"."resetsAt" <= ${now} THEN ${resetsAt} ELSE "RateLimit"."resetsAt" END RETURNING "count"`;
  if (rows[0].count > maximum)
    throw new DomainError("Demasiados intentos. Intenta más tarde.", 429);
}
