import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "./db";
import { credentials } from "@/domain/validation";
import { invariant } from "@/domain/rules";
import { rateLimit } from "./rate-limit";
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(input) {
        const parsed = credentials.safeParse(input);
        if (!parsed.success) return null;
        await rateLimit(`login:${parsed.data.email}`, 10);
        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        // Constant-cost comparison for unknown accounts as well.
        const valid = await compare(
          parsed.data.password,
          user?.passwordHash ??
            "$2b$12$xUYMK3DBTfu.Od9DX.Ou..heTlGHGE0UpMkjoCZJuLDuECmDfJiKq",
        );
        if (!user || user.deletedAt || !valid) return null;
        const current = await db.$transaction(async (tx) => {
          const updated = await tx.user.update({
            where: { id: user.id },
            data: { sessionVersion: { increment: 1 } },
          });
          await tx.auditLog.create({
            data: { actorId: user.id, action: "LOGIN", resourceId: user.id },
          });
          return updated;
        });
        return {
          id: current.id,
          email: current.email,
          name: current.name,
          role: current.role,
          sessionVersion: current.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role;
      session.user.sessionVersion = token.sessionVersion;
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.sub)
        await db.user.updateMany({
          where: { id: token.sub, sessionVersion: token.sessionVersion },
          data: { sessionVersion: { increment: 1 } },
        });
    },
  },
};
export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id) return null;
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (
    !user ||
    user.deletedAt ||
    user.sessionVersion !== session.user.sessionVersion
  )
    return null;
  return user;
}
export async function requireActor() {
  const user = await currentUser();
  invariant(user, "Inicia sesión para continuar.", 401);
  return { id: user.id, role: user.role };
}
