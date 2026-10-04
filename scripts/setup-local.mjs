import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env")) {
  console.log(".env existente; no se sobrescribe.");
} else {
  const password = randomBytes(24).toString("hex");
  writeFileSync(
    ".env",
    `DATABASE_URL="postgresql://handly:${password}@127.0.0.1:55432/handly?schema=public"\nNEXTAUTH_URL="http://localhost:3000"\nNEXTAUTH_SECRET="${randomBytes(48).toString("hex")}"\nPAYMENT_ADAPTER="development"\nNEXT_PUBLIC_GOOGLE_MAPS_KEY=""\n`,
  );
  console.log("Configuración local generada con secretos aleatorios.");
}
