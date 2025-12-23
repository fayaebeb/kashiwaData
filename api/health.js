import { getContainerClient, getContainerName, assertAuthorized } from "../lib/blobZip.js";

export default async function handler(req, res) {
  try {
    assertAuthorized(req);
    const exists = await getContainerClient().exists();
    res.status(200).json({ ok: true, container: getContainerName(), exists });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    res.status(statusCode).json({ ok: false, error: String(error?.message || error) });
  }
}

