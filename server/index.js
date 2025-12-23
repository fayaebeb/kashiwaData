import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  assertAuthorized,
  getContainerClient,
  getContainerName,
  listBlobs,
  streamZipOfContainer
} from "../lib/blobZip.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const app = express();

app.disable("x-powered-by");

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    // eslint-disable-next-line no-console
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`);
  });
  next();
});

app.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

app.use(
  express.static(path.join(__dirname, "../public"), {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
    }
  })
);

app.get("/api/health", async (_req, res) => {
  try {
    assertAuthorized(_req);
    const exists = await getContainerClient().exists();
    res.json({ ok: true, container: getContainerName(), exists });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/list", async (req, res) => {
  try {
    assertAuthorized(req);
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";
    const limitRaw = typeof req.query.limit === "string" ? req.query.limit : "";
    const limit = Math.max(1, Math.min(500, Number(limitRaw) || 50));
    const blobs = await listBlobs({ prefix, limit });
    res.json({ ok: true, prefix, count: blobs.length, blobs });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ ok: false, error: String(error?.message || error) });
  }
});

app.get("/api/download-all", async (req, res) => {
  try {
    assertAuthorized(req);
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";
    await streamZipOfContainer({ req, res, prefix });
  } catch (error) {
    if (!res.headersSent) {
      const statusCode = Number(error?.statusCode) || 500;
      res.status(statusCode).json({ ok: false, error: String(error?.message || error) });
      return;
    }
    res.destroy(error);
  }
});

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `Listening on http://localhost:${PORT} (container=${getContainerName()}, token=${process.env.DOWNLOAD_ALL_TOKEN ? "on" : "off"})`
  );
});

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `Port ${PORT} is already in use. Stop the other process or set PORT to a free port (e.g. PORT=3001).`
    );
    process.exit(1);
  }
  throw err;
});
