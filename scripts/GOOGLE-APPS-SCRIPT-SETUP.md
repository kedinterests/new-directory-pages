# Google Apps Script Setup Instructions

## File Locations

All scripts are now in `/scripts/` folder of your GitHub repository:

- **refresh.gs** — Refresh endpoint & authorization functions
- **counties-sidebar.gs** — Counties multi-select sidebar logic
- **data-export.gs** — Data export for /refresh endpoint (doGet)
- **CountiesSidebar.html** — Sidebar UI template
- **appsscript.json** — Manifest with permissions declared

## ⚠️ Authorization Fix (Why Refresh is Failing)

The error "You do not have permission to call UrlFetchApp.fetch" occurs because Apps Script needs to be **properly deployed as a web app** and **re-authorized** to gain the external request permission.

### Step 1: Delete Old Script & Start Fresh

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1KHAw1w5_1ykLpsIsSiICHyCUnaf1yLYYBqTYfvrXwrw/
2. Go to **Extensions → Apps Script**
3. At the top left, click the project name dropdown
4. Select **Project Settings** (gear icon at bottom left)
5. Copy the **Script ID** (you'll need this in step 4)
6. Back in the Apps Script editor, **delete ALL current code** from each file
7. Delete any unused files in the editor

### Step 2: Copy Scripts into Apps Script

For each `.gs` and `.html` file in the `/scripts/` folder:

1. Click the **+** button next to "Files" in the Apps Script editor
2. Choose **Create new file** → **Google Apps Script** (for `.gs` files) or **HTML** (for `.html`)
3. Name it exactly: `refresh.gs`, `counties-sidebar.gs`, `data-export.gs`, `CountiesSidebar.html`
4. Copy the entire content from the corresponding file in `/scripts/` folder
5. Paste into the Apps Script editor

**Order to create/update:**
1. CountiesSidebar.html (copy all content)
2. refresh.gs (copy all content)
3. counties-sidebar.gs (copy all content)
4. data-export.gs (copy all content)

### Step 3: Update the Manifest

1. In the Apps Script editor, click **< > Project Settings**
2. Near the bottom, check the box for **"Show 'appsscript.json' manifest file"**
3. Click the **appsscript.json** tab that appears
4. Delete all current content
5. Copy **entire content** from `/scripts/appsscript.json`
6. Paste and save (Ctrl+S / Cmd+S)

Your manifest should now have:
```json
{
  "timeZone": "America/New_York",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request"
  ]
}
```

### Step 4: Deploy as Web App (This Triggers Authorization)

1. At the top of the Apps Script editor, click **Deploy** (or + Deploy)
2. Click **New deployment**
3. At the top, click the dropdown and select **Web app**
4. Fill in:
   - **Execute as:** Your email address
   - **Who has access:** Anyone (to allow the /refresh endpoint to work)
5. Click **Deploy**
6. **Important:** When it says "Review permissions", click **Review permissions**
7. Select your Google account
8. You'll see a warning "Google hasn't verified this app" — click **Allow** (this is normal for scripts you create)
9. Copy the deployment URL (you might not need it, but save it)
10. Click **Done**

### Step 5: Authorize the Refresh Function

Now that the web app is deployed, the permissions are registered. Test the refresh:

1. Back in your Google Sheet, go to **Extensions → Apps Script**
2. In the editor, click on the `refreshDirectory` function name
3. Click the **▶ Run** button (or press Ctrl+Shift+Enter)
4. When prompted, **choose your Google account**
5. A popup will appear: **"Google hasn't verified this app"** — click **Allow**

This will fully authorize the script with the `external_request` permission.

### Step 6: Test Everything

1. In the Google Sheet, go to **Directory** menu (top menu bar)
2. Click **Set refresh key…** and enter your REFRESH_KEY
3. Click **Refresh site from this sheet**
   - Should see a toast notification saying "Pushing sheet data..."
   - Should complete successfully with a green "Directory refreshed" message
4. Try **Select counties (multi-select)**
   - Select a cell in the Companies sheet, counties column (J)
   - Choose some counties or "All Alabama" (state:AL)
   - Click Apply
   - Cell should now have `state:AL` (NOT `"", state:AL`)

## If Refresh Still Fails

Try this nuclear option (complete re-auth):

1. Go back to Apps Script editor
2. Click **Project Settings** (gear icon, bottom left)
3. Copy the Script ID
4. In your browser address bar, go to:
   ```
   https://script.google.com/home/my?authuser=<email>
   ```
5. Find this project in the list, click the 3-dot menu, and **Remove** it
6. Delete all files from the Apps Script editor
7. Start over from **Step 2** above

## File References

If you ever need to update the scripts:
- Edit the corresponding `.gs` or `.html` file in `/scripts/`
- Go back to Apps Script editor
- Click on that file's tab
- Delete all content
- Re-copy from the `/scripts/` file
- Save (Ctrl+S / Cmd+S)

The Apps Script editor does NOT sync with the file system automatically — you must manually copy/paste to keep them in sync.
