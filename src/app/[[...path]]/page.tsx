import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/infrastructure/auth";
import { Handly } from "@/ui/handly";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path = [] } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const allowedPublic =
    !path.length ||
    ["login", "registro", "buscar", "profesionales"].includes(path[0]);
  if (!allowedPublic && path[0] !== "app") notFound();
  const user = await currentUser();
  if (path[0] === "app" && !user) redirect("/login");
  if (
    path[0] === "app" &&
    path[1] === "servicios" &&
    user?.role !== "CONTRATISTA"
  )
    redirect("/app");
  return (
    <Handly
      initialQuery={query.toString()}
      user={user ? { id: user.id, name: user.name, role: user.role } : null}
    />
  );
}
