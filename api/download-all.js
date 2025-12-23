import { assertAuthorized, streamZipOfContainer } from "../lib/blobZip.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 300
};

export default async function handler(req, res) {
  try {
    assertAuthorized(req);
    const prefix = typeof req.query?.prefix === "string" ? req.query.prefix : "";
    await streamZipOfContainer({ req, res, prefix });
  } catch (error) {
    if (!res.headersSent) {
      const statusCode = Number(error?.statusCode) || 500;
      res.status(statusCode).json({ ok: false, error: String(error?.message || error) });
      return;
    }
    res.destroy(error);
  }
}

