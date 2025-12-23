import { assertAuthorized, listBlobs } from "../lib/blobZip.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60
};

export default async function handler(req, res) {
  try {
    assertAuthorized(req);
    const prefix = typeof req.query?.prefix === "string" ? req.query.prefix : "";
    const limitRaw = typeof req.query?.limit === "string" ? req.query.limit : "";
    const limit = Math.max(1, Math.min(500, Number(limitRaw) || 50));
    const blobs = await listBlobs({ prefix, limit });
    res.status(200).json({ ok: true, prefix, count: blobs.length, blobs });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ ok: false, error: String(error?.message || error) });
  }
}

