import "dotenv/config";
import { test, expect, Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
const db = new PrismaClient();
const suffix = Date.now().toString();
const title = `Electricista E2E ${suffix}`;
async function register(
  page: Page,
  role: "CLIENTE" | "CONTRATISTA",
  slug: string,
) {
  await page.goto("/registro");
  if (role === "CONTRATISTA")
    await page.getByRole("button", { name: "Ofrezco servicios" }).click();
  await page.getByLabel("Nombre completo").fill(`Prueba ${slug}`);
  await page
    .getByLabel("Correo electrónico")
    .fill(`e2e-${suffix}-${slug}@test.invalid`);
  await page.getByLabel("Teléfono").fill("8095550123");
  await page
    .getByLabel("Municipio", { exact: false })
    .fill("Santo Domingo de Guzmán");
  if (role === "CONTRATISTA") {
    await page.getByLabel("Especialidad").fill("Electricidad residencial");
    await page.getByLabel("Años de experiencia").fill("5");
  }
  await page
    .getByLabel("Contraseña", { exact: false })
    .fill("E2ePassword2026!");
  await page.getByLabel(/Acepto el uso/).check();
  await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  await expect(page).toHaveURL("/app");
}
async function confirm(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
}
test.afterAll(async () => {
  const users = await db.user.findMany({
    where: { email: { startsWith: `e2e-${suffix}-` } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  const requests = await db.serviceRequest.findMany({
    where: { OR: [{ clientId: { in: ids } }, { contractorId: { in: ids } }] },
    select: { id: true },
  });
  const rids = requests.map((r) => r.id);
  await db.review.deleteMany({ where: { requestId: { in: rids } } });
  await db.payment.deleteMany({ where: { requestId: { in: rids } } });
  await db.userReport.deleteMany({ where: { authorId: { in: ids } } });
  await db.serviceRequest.deleteMany({ where: { id: { in: rids } } });
  await db.servicePublication.deleteMany({
    where: { contractorId: { in: ids } },
  });
  await db.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
test("client and contractor share a real service journey", async ({
  browser,
}) => {
  const cc = await browser.newContext(),
    tc = await browser.newContext();
  const client = await cc.newPage(),
    contractor = await tc.newPage();
  const errors: string[] = [];
  for (const page of [client, contractor])
    page.on("pageerror", (error) => errors.push(error.message));
  await register(contractor, "CONTRATISTA", "contratista");
  await contractor
    .getByRole("link", { name: "Publicar un servicio", exact: true })
    .click();
  await contractor.getByLabel("Título del servicio").fill(title);
  await contractor
    .getByLabel("Categoría")
    .selectOption({ label: "Electricidad" });
  await contractor
    .getByLabel("Descripción")
    .fill(
      "Revisión de circuitos residenciales y reparación de instalaciones para pruebas de extremo a extremo.",
    );
  await contractor.getByLabel("Municipio").fill("Santo Domingo de Guzmán");
  await contractor.getByLabel("Precio inicial").fill("1800.25");
  await contractor
    .getByRole("button", { name: "Publicar servicio", exact: true })
    .click();
  await expect(contractor).toHaveURL("/app/servicios");
  await expect(contractor.getByRole("heading", { name: title })).toBeVisible();
  await register(client, "CLIENTE", "cliente");
  await client.goto(`/buscar?q=${encodeURIComponent(title)}`);
  await client.getByRole("link", { name: "Ver perfil" }).click();
  await client
    .getByRole("button", { name: "Solicitar servicio", exact: true })
    .click();
  await client
    .getByLabel("Describe el trabajo")
    .fill(
      "Necesito revisar los tomacorrientes de la cocina y cambiar un interruptor.",
    );
  await client
    .getByLabel("Dirección del servicio")
    .fill("Calle ficticia E2E número 25");
  await client.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(client).toHaveURL(/\/app\/solicitudes\/[^/]+$/);
  const requestUrl = new URL(client.url()).pathname;
  await expect(
    client.getByText("Pendiente", { exact: true }).first(),
  ).toBeVisible();
  await contractor.goto("/app/solicitudes");
  await contractor
    .getByRole("link")
    .filter({ has: contractor.getByRole("heading", { name: title }) })
    .click();
  await confirm(contractor, "Aceptar solicitud");
  await client.reload();
  await expect(
    client.getByText("Aceptada", { exact: true }).first(),
  ).toBeVisible();
  await client.getByRole("link", { name: "Abrir conversación" }).click();
  await client
    .getByLabel("Tu mensaje")
    .fill("Hola, podemos coordinar para mañana.");
  await client.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    client
      .getByText("Hola, podemos coordinar para mañana.", { exact: true })
      .last(),
  ).toBeVisible();
  await contractor.goto(requestUrl);
  await contractor.getByRole("link", { name: "Abrir conversación" }).click();
  await expect(
    contractor
      .getByText("Hola, podemos coordinar para mañana.", { exact: true })
      .last(),
  ).toBeVisible();
  await contractor
    .getByLabel("Tu mensaje")
    .fill("Perfecto. Te envío una propuesta de cita.");
  await contractor.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(
    client
      .getByText("Perfecto. Te envío una propuesta de cita.", { exact: true })
      .last(),
  ).toBeVisible();
  await contractor.goto(requestUrl);
  await contractor.getByRole("button", { name: "Proponer cita" }).click();
  const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  await contractor.getByLabel("Fecha y hora").fill(`${future}T10:00`);
  await contractor.getByLabel("Monto del servicio").fill("1900.29");
  await contractor.getByRole("button", { name: "Enviar propuesta" }).click();
  await expect(
    contractor.getByText("Propuesta", { exact: true }),
  ).toBeVisible();
  await client.goto(requestUrl);
  await client.getByLabel("Método de pago").selectOption("CASH");
  await client.getByRole("button", { name: "Confirmar cita y precio" }).click();
  await expect(
    client.getByText("Agendada", { exact: true }).first(),
  ).toBeVisible();
  await contractor.reload();
  await confirm(contractor, "Iniciar trabajo");
  await confirm(contractor, "Confirmar efectivo recibido");
  await confirm(contractor, "Marcar trabajo realizado");
  await client.reload();
  await confirm(client, "Confirmar servicio completado");
  await client
    .getByLabel("Tu opinión")
    .fill("Excelente comunicación y un trabajo bien realizado.");
  await client.getByRole("button", { name: "Publicar opinión" }).click();
  await expect(
    client.getByText("Gracias. Tu opinión fue publicada."),
  ).toBeVisible();
  await contractor.goto("/app/opiniones");
  await expect(
    contractor.getByText("Excelente comunicación y un trabajo bien realizado."),
  ).toBeVisible();
  await client.goto("/app/reportes");
  await client.getByRole("button", { name: "Crear reporte" }).click();
  await client
    .getByLabel("Persona relacionada")
    .selectOption({ label: "Prueba contratista" });
  await client
    .getByLabel("Describe lo que sucedió")
    .fill(
      "Reporte ficticio usado únicamente para verificar el recorrido de prueba.",
    );
  await client.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(client.getByText("Reporte guardado.")).toBeVisible();
  await client.getByRole("button", { name: "Editar", exact: true }).click();
  await client
    .getByLabel("Describe lo que sucedió")
    .fill(
      "Reporte ficticio actualizado para verificar la persistencia y edición.",
    );
  await client.getByRole("button", { name: "Actualizar reporte" }).click();
  await expect(
    client.getByText(
      "Reporte ficticio actualizado para verificar la persistencia y edición.",
    ),
  ).toBeVisible();
  await confirm(client, "Eliminar reporte");
  await expect(
    client.getByText(
      "Reporte ficticio actualizado para verificar la persistencia y edición.",
    ),
  ).not.toBeVisible();
  mkdirSync("docs/screenshots", { recursive: true });
  await client.setViewportSize({ width: 1440, height: 900 });
  await client.goto(requestUrl);
  await expect(
    client.getByText("Completada", { exact: true }).first(),
  ).toBeVisible();
  await client.screenshot({
    path: "docs/screenshots/solicitud-cliente-1440.png",
    fullPage: true,
  });
  await client.setViewportSize({ width: 390, height: 844 });
  await client.goto("/app");
  await expect(
    client.getByRole("heading", { name: /Hola, Prueba/ }),
  ).toBeVisible();
  expect(
    await client.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await client.screenshot({
    path: "docs/screenshots/cliente-390.png",
    fullPage: true,
  });
  await client.getByRole("button", { name: "Abrir menú", exact: true }).click();
  await client
    .getByRole("navigation", { name: "Mi espacio" })
    .getByRole("link", { name: "Mi perfil", exact: true })
    .click();
  await client
    .getByLabel("Nombre completo")
    .fill("Cliente de prueba actualizado");
  await client.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(client.getByText("Perfil actualizado.")).toBeVisible();
  await client.goto("/app/servicios");
  await expect(client).toHaveURL("/app");
  await contractor.setViewportSize({ width: 1440, height: 900 });
  await contractor.goto("/app");
  await expect(
    contractor.getByRole("heading", { name: /Hola, Prueba/ }),
  ).toBeVisible();
  await contractor.screenshot({
    path: "docs/screenshots/contratista-1440.png",
    fullPage: true,
  });
  await contractor
    .getByRole("button", { name: "Cerrar sesión", exact: true })
    .click();
  await expect(contractor).toHaveURL("/");
  await contractor.goto("/app");
  await expect(contractor).toHaveURL("/login");
  expect(errors).toEqual([]);
  await cc.close();
  await tc.close();
});
test("protected routes and public error states", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL("/login");
  const response = await page.request.get("/api/handly/requests");
  expect(response.status()).toBe(401);
  const invalidOrigin = await page.request.post("/api/handly/register", {
    data: {},
    headers: { Origin: "https://malicious.invalid" },
  });
  expect(invalidOrigin.status()).toBe(403);
  await page.goto("/buscar?q=ServicioInexistente123456");
  await expect(page.getByText("Aún no hay resultados")).toBeVisible();
  await page.goto("/buscar");
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(
    page.getByText("El mapa estará disponible al configurar Google Maps"),
  ).toBeVisible();
});
test("desktop, tablet and mobile layouts remain usable", async ({ page }) => {
  mkdirSync("docs/screenshots", { recursive: true });
  const issues: string[] = [];
  page.on("pageerror", (e) => issues.push(e.message));
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Tu próximo proyecto/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ver perfil" }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/inicio-${width}.png`,
      fullPage: true,
    });
    await page.goto("/buscar");
    await expect(
      page.getByRole("link", { name: "Ver perfil" }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/buscar-${width}.png`,
      fullPage: true,
    });
    await page.goto("/registro?rol=CONTRATISTA");
    await expect(page.getByLabel("Especialidad")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(issues).toEqual([]);
});
