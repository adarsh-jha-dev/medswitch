# Day 1 — Target Vetting (Step 2)

Date: 2026-08-17. Compliance scope for all scraping: **public product and category pages only** — no login, no cart/checkout, no account pages, no filtered/query-string search endpoints where robots.txt disallows them.

## Pincode (held constant everywhere)

**Kolkata GPO — 700001.** Indian pharmacy MRP/selling-price/stock vary by delivery pincode. PharmEasy exposes this as a header/UI pincode selector ("Express delivery to [Select Pincode]") — the collector must set this once (cookie/localStorage after the pincode API call) before reading price/stock, not per-request. Jan Aushadhi (PMBI) prices are **not pincode-dependent** — they're a fixed nationwide MRP cap list, so 700001 doesn't apply there, but we keep it as the standard pincode for retailer 1 across all Day 1 runs.

## Therapeutic categories in scope

- **Antihypertensives** — amlodipine, telmisartan
- **Antidiabetics** — metformin, glimepiride
- **Analgesics** — paracetamol, diclofenac

---

## Retailer #1 picked: PharmEasy (pharmeasy.in)

**Why:** Of the four retailers checked (1mg, Netmeds, PharmEasy, Apollo Pharmacy), PharmEasy has the cleanest scrape surface: a raw `curl` fetch (no JS execution) of a product page returns a ~575KB page with an explicit `__NEXT_DATA__` Next.js SSR JSON blob containing already-structured fields (`activeIngredient`, `strengthValue`, `strengthUnit`, price), vs. Netmeds' ~3.4MB Vue page with client-side "shimmer" placeholders for pincode-dependent delivery/stock data, and vs. Apollo/1mg which are workable but either less consistently structured or under a more restrictive robots.txt (1mg blocks many named site sections). PharmEasy's URL pattern is a single consistent scheme (`/online-medicine-order/<slug>-<id>`), unlike Netmeds which mixes `/prescriptions/<slug>` and `/product/<slug>-<hash>-<id>`. robots.txt only blocks account/cart/checkout/search-all/diagnostics — product and category pages are open, and a sitemap exists.

### robots.txt summary — pharmeasy.in

Confirmed via `curl https://pharmeasy.in/robots.txt`:
```
User-agent: *
Disallow: /account/  /cart/  /checkout/  /order/  /order-success/  /payment/
Disallow: /healthcare  /home  /upload-prescription  /offers/*  /search/all*
Disallow: /diagnostics/*  /diagnostic-test/*  /api/  /pe-care/*  /new-home-page
Sitemap: https://pharmeasy.in/sitemap.xml
```
Product pages (`/online-medicine-order/...`), molecule pages (`/molecules/...`), and category pages (`/health-care/<category>-<id>`, note the hyphen — distinct from disallowed `/healthcare`) are **not** disallowed.
**Compliance note:** scraping is limited to these open product/category/molecule pages at pincode 700001; no login, cart, checkout, account, or `/search/all*` endpoints are touched.

**Sitemap:** exists, `https://pharmeasy.in/sitemap.xml` returns HTTP 200.

### Category / search URL pattern & pagination

- Molecule/salt page (best discovery entry point per generic, lists brand variants): `https://pharmeasy.in/molecules/<slug>-<id>`, e.g. `https://pharmeasy.in/molecules/telmisartan-amlodipine-9302`. Lists ~5 branded products inline plus a "View More Medicines" link (no `?page=` param observed — it's a single link-through, not numbered pagination).
- Wellness/OTC category page: `https://pharmeasy.in/health-care/<category-name>-<id>`, e.g. `https://pharmeasy.in/health-care/anti-diabetic-medicines-909`, `https://pharmeasy.in/health-care/pain-relief-743`. Has Sort/Filter controls but **no visible numbered pagination or `?page=` query param** — appears to load a fixed set per category (or infinite scroll for larger categories); no page-2 URL was found. Note: this category namespace returns OTC/wellness items (juices, supplements), not prescription drug listings — for prescription drugs the molecule page or direct product URL (found via WebSearch/sitemap) is more reliable.
- Product page: `https://pharmeasy.in/online-medicine-order/<slug>-<id>`.

### 5 real product pages checked (PharmEasy)

1. **Telma AM Tablet** (telmisartan+amlodipine, antihypertensive) — `https://pharmeasy.in/online-medicine-order/telma-am-40-5mg-tablet-15-s-11797`
   - Composition: "Telmisartan(40.0 Mg)+Amlodipine(5.0 Mg)" in the Product Summary "Salt Content" row.
   - Manufacturer: "GLENMARK PHARMACEUTICALS" in the "Made by" field and Manufacturer Details section.
   - MRP: ₹341.72 (struck through); Selling price: ₹256.29 (25% OFF badge).
   - Stock: no explicit out-of-stock label; "Add to cart" button present = in stock.
   - Pack size: "15 Tablet(s) in Strip" in the product title/summary.

2. **Glycomet 500mg Tablet** (metformin, antidiabetic) — `https://pharmeasy.in/online-medicine-order/glycomet-500mg-strip-of-10-tablets-49207`
   - Composition: "Metformin Hydrochloride(500.0 Mg)" — Product Summary "Salt Content" row.
   - Manufacturer: "USV PVT LTD" — "Made by" field; also "Brand: GLYCOMET" / "Manufacturer Name: USV PVT LTD" in Manufacturer Details section at page bottom.
   - MRP: ₹19.59; Selling price: ₹14.69 (25% OFF), ₹1.47/tablet.
   - Stock: not explicitly labeled on-page (no out-of-stock banner seen).
   - Pack size: "10 Tablet(s) in Strip".

3. **Glimestar 2 MG Tablet** (glimepiride, antidiabetic) — `https://pharmeasy.in/online-medicine-order/glimestar-2mg-strip-of-10-tablets-48860`
   - Composition: "Glimepiride(2.0 Mg)".
   - Manufacturer: "MANKIND PHARMACEUTICALS LTD", address "Doring Block, Bermiok Elaka, South-Sikkim 737126" in Manufacturer Details.
   - MRP: ₹39.75; Selling price: ₹30.61 (23% off), ₹3.06/tablet.
   - Stock: not explicitly stated; order dependent on "current pharmacy stock levels" per boilerplate text.
   - Pack size: 10 tablets/strip. Expiry shown separately: "July 2027".

4. **Dolo 650 Tablet** (paracetamol, analgesic) — `https://pharmeasy.in/online-medicine-order/dolo-650mg-strip-of-15-tablets-44140`
   - Composition: "Paracetamol / Acetaminophen(650.0 Mg)".
   - Manufacturer: "MICRO LABS"; brand "DOLO".
   - MRP: ₹32.12; Selling price: ₹24.09 (25% off), ₹1.61/tablet.
   - Stock: no explicit flag; expiry "October 2029" shown as freshness proxy.
   - Pack size: "15 Tablet(s) in Strip".

5. **Diclofen 50 MG Tablet** (diclofenac, analgesic) — `https://pharmeasy.in/online-medicine-order/diclofen-50mg-tab-15-s-219613`
   - Composition: "Diclofenac(50.0 Mg)".
   - Manufacturer: "ZYDUS HEALTHCARE LIMITED".
   - MRP: ₹32.29; Selling price: ₹20.02 (38% off), ₹1.33/tablet.
   - Stock: **"Out of Stock"** shown explicitly — confirms the stock-status element is present and populated (not always "in stock") on this site, useful as a real example of the disallowed/blocked state.
   - Pack size: "15 Tablet(s) in Strip".

All five fields (composition, manufacturer, MRP, selling price, pack size) consistently live in a "Product Summary" panel near the top of the page, and are duplicated inside the page's embedded `__NEXT_DATA__` JSON (fields seen: `activeIngredient`, `strengthUnit`, `strengthValue`, `mrp`/selling price, manufacturer name) — so a collector can parse either the rendered summary panel or the JSON blob directly from server HTML, no JS execution required.

---

## Site #2: Jan Aushadhi (official PMBI price list)

**Correct official domain found:** `janaushadhi.gov.in` is PMBI's newer public-facing portal, but it is a pure client-side React SPA (`<div id="root"></div>`, bundle `main.2dce30b4.js`) — a raw HTTP fetch returns almost no content without executing JS. Its own "Product Portfolio" links (and its footer logo link) point to the actual data source: **`www.pmbi.co.in`** (Pharmaceuticals & Medical Devices Bureau of India), specifically **`https://www.pmbi.co.in/ProductList.aspx`** ("Product & MRP List") — a legacy server-rendered ASP.NET WebForms page. This is the page vetted and used as retailer/site #2. It is public, no login required, and states "Total nos. of Product in PMBI basket: 2439".

### robots.txt summary — pmbi.co.in and janaushadhi.gov.in

- `https://www.pmbi.co.in/robots.txt` → **HTTP 404** (no robots.txt file exists on this domain at all).
- `https://janaushadhi.gov.in/robots.txt` → HTTP 200 but the SPA's catch-all router serves the same `index.html` shell for every path, i.e. there is no dedicated robots.txt content either — no crawl directives are declared.
**Compliance note:** absence of a robots.txt file is treated as no crawl restriction declared; scraping is still limited in practice to the public, no-login `ProductList.aspx` search/list page (and its printable results) — no admin, franchise-login (`/login-to-kendra`), or "Apply for Kendra" pages are touched.

**Sitemap:** none found — `https://www.pmbi.co.in/sitemap.xml` returns HTTP 404. There is no per-product URL scheme; the entire catalog lives behind one search/list page.

### Category / search URL pattern & pagination

`ProductList.aspx` is not a set of per-product pages — it's a single ASP.NET WebForms page with a search box ("Search by Drug Code/Product Name/Unit Size/MRP") and an "Export to PDF" button. There is **no GET-based pagination or query-string filtering**; querying it requires an HTTP POST to `https://www.pmbi.co.in/ProductList.aspx` carrying the ASP.NET postback fields (`__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`, all scraped from a prior GET) plus `ctl00$Bppi_body$txtSearch=<term>` and `ctl00$Bppi_body$btnSearch=Search`. Verified working: a POST search for "Metformin" returned 76 result rows in a single response (no further pagination needed for typical generic-name searches — result sets for one generic name are small enough to return in one page). A secondary page, `SortingView.aspx`, offers the same data sortable by "MRP Lowest to Highest / Highest to Lowest / Generic Name wise" but was not required for Day 1.

Result table columns (confirmed from a live search response): **Sr. No. | Drug Code | Generic Name | Unit Size | MRP (in Rs.)**. There is no manufacturer, brand, or stock-status column — PMBI's list is a nationwide MRP price cap by generic composition, not a live retailer inventory.

### 5 real product entries checked (Jan Aushadhi / PMBI, via POST search)

1. **Metformin Hydrochloride Tablets IP 500mg** (antidiabetic) — Drug Code **145**, Unit Size **10's**, MRP **₹6.19**. (search term: `Metformin`)
2. **Telmisartan Tablets IP 40mg** (antihypertensive) — Drug Code **300**, Unit Size **10's**, MRP **₹11.25**. (search term: `Telmisartan`)
3. **Telmisartan 40mg and Amlodipine 5mg Tablets IP** (antihypertensive combo) — Drug Code **417**, Unit Size **15's**, MRP **₹22.69**. (search term: `Amlodipine`)
4. **Paracetamol Tablets IP 500mg** (analgesic) — Drug Code **23**, Unit Size **10's**, MRP **₹6.57**. (search term: `Paracetamol`)
5. **Diclofenac Sodium Prolonged Release Tablets IP 100mg** (analgesic) — Drug Code **9**, Unit Size **10's**, MRP **₹11.35**. (search term: `Diclofenac`)

For all five, composition = the "Generic Name" cell (the drug name string itself, e.g. "Metformin Hydrochloride Tablets IP 500mg" — dose is embedded in the name, not a separate field), pack size = "Unit Size" cell, price = "MRP (in Rs.)" cell. No manufacturer or stock field exists on this page — Jan Aushadhi Kendra stock/manufacturer would require a separate per-Kendra lookup not covered by this page, out of scope for Day 1.
