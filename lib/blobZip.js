import dotenv from "dotenv";
import archiver from "archiver";
import { BlobServiceClient } from "@azure/storage-blob";

// Load `.env` for local development, and override any existing process.env values.
// This avoids surprises when users have stale AZURE_* vars set globally.
dotenv.config({ override: true });

let cachedContainerClient;

export function getContainerClient() {
  if (cachedContainerClient) return cachedContainerClient;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

  if (!connectionString) throw new Error("Missing env AZURE_STORAGE_CONNECTION_STRING");
  if (!containerName) throw new Error("Missing env AZURE_STORAGE_CONTAINER_NAME");

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  cachedContainerClient = blobServiceClient.getContainerClient(containerName);
  return cachedContainerClient;
}

export function getContainerName() {
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
  if (!containerName) throw new Error("Missing env AZURE_STORAGE_CONTAINER_NAME");
  return containerName;
}

export function assertAuthorized(req) {
  const requiredToken = process.env.DOWNLOAD_ALL_TOKEN;
  if (!requiredToken) return;

  const headerToken = req.headers["x-download-token"];
  const queryToken = typeof req.query?.token === "string" ? req.query.token : undefined;
  const token = Array.isArray(headerToken) ? headerToken[0] : headerToken || queryToken;

  if (token !== requiredToken) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    throw error;
  }
}

export async function streamZipOfContainer({ req, res, prefix }) {
  const containerClient = getContainerClient();
  const containerName = getContainerName();

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeFilename(containerName)}${prefix ? `_${safeFilename(prefix)}` : ""}.zip"`
  );
  res.setHeader("Cache-Control", "no-store");
  res.flushHeaders?.();

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("warning", (err) => {
    if (err?.code === "ENOENT") return;
    res.destroy(err);
  });
  archive.on("error", (err) => {
    res.destroy(err);
  });

  req.on?.("close", () => {
    if (!res.writableEnded) archive.abort();
  });

  archive.pipe(res);

  // Emit some content immediately so browsers start the download even if listing is slow.
  archive.append(
    JSON.stringify(
      { container: containerName, prefix, startedAt: new Date().toISOString() },
      null,
      2
    ) + "\n",
    { name: "_download-info.json" }
  );

  try {
    let foundAny = false;
    for await (const blobItem of containerClient.listBlobsFlat({ prefix })) {
      if (isDirectoryPlaceholder(blobItem)) continue;
      foundAny = true;

      const blobClient = containerClient.getBlobClient(blobItem.name);
      const downloadResponse = await blobClient.download();
      const body = downloadResponse.readableStreamBody;
      if (!body) continue;

      archive.append(body, { name: blobItem.name });
    }

    if (!foundAny) {
      archive.append(
        `No blobs found in container "${containerName}"${prefix ? ` with prefix "${prefix}"` : ""}.\n`,
        { name: "README.txt" }
      );
    }
  } catch (error) {
    archive.append(
      `Failed while building the ZIP.\n\n${String(error?.stack || error?.message || error)}\n`,
      { name: "_ERROR.txt" }
    );
  } finally {
    await archive.finalize();
  }
}

export async function listBlobs({ prefix = "", limit = 50 }) {
  const containerClient = getContainerClient();

  const results = [];
  for await (const blobItem of containerClient.listBlobsFlat({ prefix })) {
    if (isDirectoryPlaceholder(blobItem)) continue;
    results.push({
      name: blobItem.name,
      size: blobItem.properties?.contentLength ?? null,
      lastModified: blobItem.properties?.lastModified?.toISOString?.() ?? null
    });
    if (results.length >= limit) break;
  }
  return results;
}

function isDirectoryPlaceholder(blobItem) {
  const name = blobItem?.name;
  const size = blobItem?.properties?.contentLength;
  return typeof name === "string" && name.endsWith("/") && (size === 0 || size == null);
}

function safeFilename(value) {
  return String(value).replaceAll(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "download";
}
