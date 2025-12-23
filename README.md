# Azure Blob “Download All” Site

This is a tiny local web app that lets you download all blobs in an Azure Blob Storage container in **one click**. The server streams a ZIP file to your browser (no need to manually download blobs one by one).

## Setup

1) Install dependencies:

```bash
npm install
```

2) Create a `.env` file:

```bash
cp .env.example .env
```

3) Fill in:

- `AZURE_STORAGE_CONNECTION_STRING`
- `AZURE_STORAGE_CONTAINER_NAME`
- Optional: `DOWNLOAD_ALL_TOKEN` (recommended if you deploy/share the URL)

## Run

```bash
npm start
```

Open:

- `http://localhost:3000`

## Deploy on Vercel

Yes — this repo includes Vercel Serverless Functions in `api/` plus a static UI in `public/`.

1) Push this folder to GitHub (or any git remote).
2) In Vercel: **New Project** → import the repo.
3) In Vercel Project Settings → **Environment Variables**, add:
   - `AZURE_STORAGE_CONNECTION_STRING`
   - `AZURE_STORAGE_CONTAINER_NAME`
   - `DOWNLOAD_ALL_TOKEN` (strongly recommended)
4) Deploy, then share the URL with your team.

If `DOWNLOAD_ALL_TOKEN` is set, team members must paste it into the “Access token” field on the page.

## Usage

- Click **Download ZIP** to download everything.
- Optional: enter a `prefix` (like `folder/subfolder/`) to only download blobs under that path.
- If you set `DOWNLOAD_ALL_TOKEN`, paste the same value into the “Access token” field on the page.

## Troubleshooting

- If the page shows a console error about `addEventListener` on `null`, hard-refresh and redeploy (you may be on an older cached HTML). This repo now guards against that in `public/index.html`.
- Open `/api/health` in a new tab (or click **Health**) to confirm connectivity; if `DOWNLOAD_ALL_TOKEN` is set, include `?token=...`.
- Open `/api/list?limit=5` to confirm the app can list blobs (add `&prefix=...` and/or `&token=...` as needed).
- If `/api/health` or `/api/list` returns `401`, your `DOWNLOAD_ALL_TOKEN` is set but the UI token is missing/wrong.
- If they return `500`, check Vercel function logs—most commonly it’s a missing/incorrect `AZURE_STORAGE_CONNECTION_STRING` or wrong container name.
- Local debugging: when running `npm start`, the terminal should show `Listening on http://localhost:3000 ...` and each request logs like `GET /api/health -> 200 (...)`. If you see nothing, the server isn’t starting (or Node isn’t installed in the environment you’re running it from).

## Notes

- Keep secrets server-side. Do not put account keys in browser code.
- Large containers can take time; the ZIP is streamed, so it won’t load everything into memory.
- Vercel functions have execution time limits; very large containers may time out. If you hit that, deploy the same code on Azure (Container Apps / App Service) or generate a ZIP in Azure (Functions) and serve it from Blob Storage.
