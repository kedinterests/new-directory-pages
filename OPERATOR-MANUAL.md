# MRF Directory System: Operator's Manual

## How It Works (The Big Picture)

All directory content lives in a Google Spreadsheet. The spreadsheet has several tabs: **Companies**, **Sites**, **Ads**, and **Categories**. When you make changes, nothing goes live until you trigger a refresh. The refresh pushes your spreadsheet data to the live website.

**To trigger a refresh after any change:** In the spreadsheet, click the **Directory** menu at the top and choose **Refresh site from this sheet**. A toast notification will appear confirming success. Changes are live within seconds.

---

## Adding a Company

Go to the **Companies** tab. Add a new row and fill in the following columns:

| Column | What it is |
|---|---|
| **name** | Company name as it should appear on the site |
| **category** | Choose from the dropdown (must match a category in the Categories tab) |
| **tagline** | Short one-liner shown under the company name |
| **description_short** | 1-2 sentence description shown on the card |
| **plan** | `premium` for paying/featured listings, `free` for basic listings |
| **website_url** | Full URL including https:// |
| **logo_url** | Direct URL to the company logo image |
| **contact_email** | Email address |
| **contact_phone** | Phone number, digits only (e.g. `4325551234`) |
| **counties** | Which county pages to show this company on (see below) |
| **nationwide?** | `TRUE` if this company should appear on the nationwide directory |
| **hidden** | Leave blank normally. Enter `TRUE` to hide without deleting. |

**Setting counties:** Enter comma-separated county slugs (e.g. `reeves-county-texas, midland-county-texas`). To show on all counties in a state, enter `state:TX`. To show on every county, enter `*`. If the company is nationwide only, leave this blank and set `nationwide?` to `TRUE`.

**Premium vs. free:** Premium listings appear before free listings within each category.

Trigger a refresh when done.

---

## Editing a Company

Find the company's row in the **Companies** tab, edit the relevant cells, and trigger a refresh.

---

## Hiding or Removing a Company

- **To hide temporarily:** Set the **hidden** column to `TRUE`. The company stays in the sheet but won't show on the site.
- **To remove permanently:** Delete the row. Trigger a refresh.

---

## Adding a New County Directory (Site)

Go to the **Sites** tab and add a new row:

| Column | What it is |
|---|---|
| **slug** | URL-friendly name, all lowercase with hyphens (e.g. `reeves-county-texas`) |
| **division_type** | `county` for most sites; `parish` for Louisiana; `national` for a nationwide page |
| **division_name** | The county or area name (e.g. `Reeves`) |
| **state** | Two-letter state abbreviation (e.g. `TX`) |
| **page_title** | Heading shown at the top of the directory page |
| **return_url** | The URL of the "back" link, usually `https://www.mineralrightsforum.com/` |
| **directory_intro** | Intro paragraph shown on the page. Use `{display_name}` where you want the county name to appear automatically. |
| **seo_title** | The page title that appears in Google search results |
| **seo_description** | The description snippet shown in Google search results |
| **category_order** | Leave blank to use the Categories tab order |
| **theme** | Leave as `default` |

After saving, make sure any companies that should appear on this page have its slug in their **counties** column. Trigger a refresh.

---

## Changing a Directory's SEO Title or Description

Go to the **Sites** tab, find the row for that directory, and update the **seo_title** and/or **seo_description** columns. Trigger a refresh.

---

## Changing the Intro Text on a Directory Page

Go to the **Sites** tab, find the row for that directory, and edit the **directory_intro** column. You can use `{display_name}` anywhere in the text and it will be replaced automatically with the county/area name. Trigger a refresh.

---

## Managing Categories

All category management happens in the **Categories** tab.

### Changing the order of categories
Reorder the rows in the **Categories** tab. The top row is displayed first on the directory pages. Row 1 is the header -- don't move that. Trigger a refresh.

### Adding a new category
Add a new row in the **Categories** tab with the category name. Then go to the **Companies** tab and assign companies to it using the category dropdown. Trigger a refresh.

### Renaming a category
Change the name in the **Categories** tab. Then update every company in the **Companies** tab that uses the old name -- the dropdown will show the new name once you click the cell. Trigger a refresh.

> **Important:** The category name in the Companies tab must exactly match the name in the Categories tab or those companies will be uncategorized on the live site.

---

## Adding an Advertiser (Sponsored Card)

Advertisers appear as a card at the top of a category section. Go to the **Ads** tab and add a row:

| Column | What it is |
|---|---|
| **active** | `TRUE` to show the ad, `FALSE` to pause it |
| **category** | Which category section to show the ad in (must match exactly) |
| **image_url** | Direct URL to the ad banner image |
| **link** | The URL the banner links to when clicked |
| **priority** | A number. Higher numbers appear first if multiple ads are in the same category. |
| **counties** | Which county pages to show this ad on. Leave blank to show on all pages. |

Trigger a refresh when done.

---

## Pausing or Removing an Advertiser

- **To pause:** Set the **active** column to `FALSE`.
- **To remove:** Delete the row.

Trigger a refresh.

---

## After Any Change: Always Refresh

No change goes live until you run **Directory → Refresh site from this sheet**. If the refresh succeeds, the toast will say how many sites were updated and how long it took. If it fails, it will show an error message -- let Chris know if that happens.
