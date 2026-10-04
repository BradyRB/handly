import "next-auth";
import "next-auth/jwt";
import type { Role } from "@/domain/rules";
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: Role;
      sessionVersion: number;
    };
  }
  interface User {
    role: Role;
    sessionVersion: number;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    sessionVersion: number;
  }
}
