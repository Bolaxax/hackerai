// Production server for the self-hosted Coolify deploy (see selfhost/README.md).
//
// Under `next start`, route handlers see request.url as the bind address
// (http(s)://localhost:3000/...), so the WorkOS /callback redirect and other
// request.url-based redirects would leave the public domain behind the proxy.
// Giving Next the public hostname and port keeps request.url on the public
// origin while this process listens on 0.0.0.0:PORT.
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import next from "next";

const publicOrigin =
  process.env.PUBLIC_ORIGIN?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim();
if (!publicOrigin) {
  throw new Error(
    "Set NEXT_PUBLIC_BASE_URL (or PUBLIC_ORIGIN) to the public URL.",
  );
}
const origin = new URL(publicOrigin);
const listenPort = Number(process.env.PORT || 3000);
const publicPort = Number(
  origin.port || (origin.protocol === "https:" ? 443 : 80),
);
const shutdownGraceMs = 25_000;

// Forwarded Server Actions call back into this process, as under `next start`.
process.env.__NEXT_PRIVATE_ORIGIN = `http://127.0.0.1:${listenPort}`;

const app = next({
  dev: false,
  dir: fileURLToPath(new URL("..", import.meta.url)),
  hostname: origin.hostname,
  port: publicPort,
});
const handle = app.getRequestHandler();
await app.prepare();

const server = createServer((req, res) => handle(req, res));
server.listen(listenPort, "0.0.0.0", () => {
  console.log(`HackerAI on 0.0.0.0:${listenPort} serving ${origin.origin}`);
});

// Stop accepting connections and let in-flight requests finish, but exit
// before the container runtime escalates to SIGKILL.
const shutdown = (signal) => {
  console.log(`${signal} received, draining connections`);
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => process.exit(0), shutdownGraceMs).unref();
};
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
