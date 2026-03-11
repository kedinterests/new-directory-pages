# Create New Cloudflare Pages Project for Directory

Use this guide to create a **new** Pages project (separate from any existing county-directory project).

---

## Step 1: Create the Pages Project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages**
2. Click **Create** → **Pages** → **Connect to Git**
3. Select **GitHub** and authorize if needed
4. Choose repository: **`kedinterests/new-directory-pages`**
5. Click **Begin setup**

---

## Step 2: Configure Build Settings

| Setting | Value |
|---------|-------|
| **Project name** | `directory-mineralrightsforum` (or your choice) |
| **Production branch** | `main` |
| **Build command** | `npm run build` |
| **Build output directory** | `public` |

Click **Save and Deploy** (first deploy may fail until env vars are set — that's OK).

---

## Step 3: Create KV Namespace

1. In Cloudflare Dashboard → **Workers & Pages** → **KV**
2. Click **Create namespace**
3. Name: `DIRECTORIES_KV`
4. Click **Add**
5. Copy the **Namespace ID** (you'll bind it in Step 5)

---

## Step 4: Add Environment Variables

1. Go to your new Pages project → **Settings** → **Environment variables**
2. Add these for **Production** (and Preview if you use it):

| Variable | Value | Encrypted |
|----------|-------|-----------|
| `MASTER_SHEET_URL` | `https://script.google.com/macros/s/AKfycbyNw8dj3BQacyiVEg7ZdcBILTyeRWa2acl0sdNfOQ49JIyttGMqqnilCJmlBa9aa38/exec` | No |
| `REFRESH_KEY` | *(generate with `openssl rand -hex 32`)* | Yes |

---

## Step 5: Bind KV Namespace

`DIRECTORIES_KV` is a **binding**, not an env var. Add it in Pages:

1. Pages project → **Settings** → **Functions**
2. Under **KV namespace bindings**, click **Add binding**
3. **Variable name:** `DIRECTORIES_KV`
4. **KV namespace:** Select the namespace you created in Step 3
5. Save

---

## Step 6: Add Custom Domain

1. Pages project → **Settings** → **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `directory.mineralrightsforum.com`
4. Cloudflare will add the CNAME and SSL automatically (if the zone is on Cloudflare)

---

## Step 7: Trigger Deploy

After env vars and KV are set:

1. **Deployments** tab → **Retry deployment** on the latest build, or
2. Push a small change to `main` to trigger a new deploy

---

## Step 8: Run Refresh

Once the site is live:

```bash
# Replace YOUR_REFRESH_KEY with the value you set
# Use --max-time 90 to avoid indefinite hang
curl -X POST https://directory.mineralrightsforum.com/refresh \
  -H "X-Refresh-Key: YOUR_REFRESH_KEY" --max-time 90
```

Or use the `.pages.dev` URL if the custom domain isn't ready yet:

```bash
curl -X POST https://YOUR_PROJECT.pages.dev/refresh \
  -H "X-Refresh-Key: YOUR_REFRESH_KEY" --max-time 90
```

Expected response: `{"status":"ok","sites_updated":695,"duration_ms":...}`

**Note:** The refresh function uses batched KV writes (50 sites per batch) to complete within the Cloudflare Functions timeout.

---

## Step 9: Verify

- **Index:** https://directory.mineralrightsforum.com/
- **County page:** https://directory.mineralrightsforum.com/reeves-county-texas
- **Health:** https://directory.mineralrightsforum.com/health

**Note:** Pages load and data flow works, but styling is minimal/placeholder for now.
