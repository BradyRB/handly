import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const url = new URL(process.env.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname))
  throw new Error("Solo PostgreSQL local.");
const pg = new EmbeddedPostgres({
  databaseDir: resolve(".local/postgres"),
  user: url.username,
  password: url.password,
  port: Number(url.port),
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (e) => console.error(String(e)),
});
if (!existsSync(".local/postgres/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const name = url.pathname.slice(1);
if (!/^[a-z_]+$/.test(name)) throw new Error("Nombre de base inválido.");
if (
  !(await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name]))
    .rowCount
)
  await pg.createDatabase(name);
await client.end();
console.log(
  `PostgreSQL listo en 127.0.0.1:${url.port}. Datos persistentes en .local/postgres.`,
);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    await pg.stop();
    process.exit(0);
  });
setInterval(() => {}, 60000);
