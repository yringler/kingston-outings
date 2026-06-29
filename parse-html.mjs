import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Parses the Google Sheets "Web page" HTML export (data.html) into outings.json.
// Unlike the old CSV export, this preserves hyperlinks: the Map column's google
// maps URL and any link embedded in a Notes cell.

// --- HTML helpers -----------------------------------------------------------

// Decode the handful of HTML entities Sheets emits (named + numeric).
function decodeEntities(str) {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&apos;/g, "'");
}

// Strip tags from a cell's inner HTML and return its decoded text content.
function textOf(html) {
    return decodeEntities(html.replace(/<[^>]*>/g, "")).trim();
}

// First href in a fragment, decoded, or null.
function hrefOf(html) {
    const m = html.match(/href="([^"]*)"/);
    return m ? decodeEntities(m[1]) : null;
}

// Split a <tr>...</tr> fragment into its <td> cells' inner HTML, in order.
// (The leading <th> row-header is intentionally ignored.) colspan is captured
// so category banner rows — a single colspan'd cell — can be recognised.
function cellsOf(rowHtml) {
    const cells = [];
    const re = /<td\b([^>]*)>([\s\S]*?)<\/td>/g;
    let m;
    while ((m = re.exec(rowHtml))) {
        const attrs = m[1];
        const colspanMatch = attrs.match(/colspan="(\d+)"/);
        cells.push({
            html: m[2],
            colspan: colspanMatch ? parseInt(colspanMatch[1], 10) : 1,
        });
    }
    return cells;
}

// --- Value parsing (shared with the old CSV parser) -------------------------

// Convert "1 hr 19 min" / "42 min" / "1 hr" / "2 hr 5 min" -> total minutes
function toMinutes(str) {
    if (!str) return null;
    const s = str.trim();
    if (!s) return null;
    let mins = 0;
    const hr = s.match(/(\d+)\s*hr/);
    const mn = s.match(/(\d+)\s*min/);
    if (hr) mins += parseInt(hr[1], 10) * 60;
    if (mn) mins += parseInt(mn[1], 10);
    return mins || null;
}

// Pull a website URL out of free-text notes, if any
function extractUrl(notes) {
    if (!notes) return null;
    const m = notes.match(/https?:\/\/[^\s|]+/);
    return m ? m[0].replace(/[.,)]+$/, "") : null;
}

// Normalise the Google Maps BusinessStatus cell. Only the two "closed" states
// are recorded in the sheet; an empty/operational cell maps to null.
function parseStatus(str) {
    const s = (str || "").trim().toUpperCase();
    if (s === "CLOSED_TEMPORARILY" || s === "CLOSED_PERMANENTLY") return s;
    return null;
}

// Parse a "lat, lng" string into { lat, lng }, or null if not present/valid.
function parseCoordinates(str) {
    if (!str) return null;
    const m = str.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!m) return null;
    return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
}

// Build a Google Maps search link as a fallback when the Map cell has no link.
// Prefer exact coordinates, then the known address, then place name + any
// address-ish text from the notes, biased to PA.
function fallbackMapUrl(name, notes, coords, address) {
    if (coords) {
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coords.lat},${coords.lng}`)}`;
    }
    let query;
    if (address) {
        query = `${name} ${address}`;
    } else {
        const addr = notes.match(
            /\d{1,5}[^,|]*(?:Rd|St|Ave|Blvd|Dr|Hwy|Ln|Way|Wy|Pkwy|Trail|Trl|Sq|Pike|Cir)\.?[^|]*?,?\s*[A-Z][a-z]+,?\s*[A-Z]{2}\s*\d{5}/,
        );
        query = addr ? `${name} ${addr[0]}` : `${name}, PA`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// --- Main parse -------------------------------------------------------------

export function parseHtml(rawHtml) {
    const tbody = rawHtml.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (!tbody) throw new Error("No <tbody> found in HTML export");

    const rowHtmls = tbody[1].split(/(?=<tr\b)/).filter((r) => /<tr\b/.test(r));

    const categories = [];
    let current = null;
    let seenHeader = false;

    for (const rowHtml of rowHtmls) {
        const cells = cellsOf(rowHtml);
        if (!cells.length) continue;

        const place = textOf(cells[0].html);
        if (!place) continue;

        // First populated row is the column header ("Place | From Kingston | ...").
        if (!seenHeader && place === "Place") {
            seenHeader = true;
            continue;
        }

        // A category banner is a single cell spanning the row (colspan > 1) with
        // no per-column data after it.
        const isCategory =
            cells[0].colspan > 1 && cells.slice(1).every((c) => !textOf(c.html));
        if (isCategory) {
            current = { name: place, items: [] };
            categories.push(current);
            continue;
        }

        if (!current) {
            current = { name: "Other", items: [] };
            categories.push(current);
        }

        const kMin = toMinutes(textOf(cells[1]?.html ?? ""));
        const sMin = toMinutes(textOf(cells[2]?.html ?? ""));
        const cMin = toMinutes(textOf(cells[3]?.html ?? ""));

        const mapHref = cells[4] ? hrefOf(cells[4].html) : null;

        const notesCell = cells[5];
        const notes = notesCell ? textOf(notesCell.html) : "";
        const notesHref = notesCell ? hrefOf(notesCell.html) : null;

        const coordinates = parseCoordinates(textOf(cells[6]?.html ?? ""));
        const address = textOf(cells[7]?.html ?? "") || null;
        const status = parseStatus(textOf(cells[8]?.html ?? ""));

        current.items.push({
            name: place,
            times: { kingston: kMin, scranton: sMin, canadensis: cMin },
            map: mapHref || fallbackMapUrl(place, notes, coordinates, address),
            website: notesHref || extractUrl(notes),
            notes,
            coordinates,
            address,
            status,
        });
    }

    return {
        origins: [
            { id: "kingston", label: "Kingston" },
            { id: "scranton", label: "Scranton" },
            { id: "canadensis", label: "Canadensis" },
        ],
        categories,
    };
}

// --- Run as a script --------------------------------------------------------

function main() {
    const raw = readFileSync("data.html", "utf8");
    const out = parseHtml(raw);

    writeFileSync(
        "nepa-outings/src/app/outings.json",
        JSON.stringify(out, null, 2),
    );

    const itemCount = out.categories.reduce((n, c) => n + c.items.length, 0);
    console.log(`Parsed ${out.categories.length} categories, ${itemCount} items.`);
    console.log(
        out.categories.map((c) => `  ${c.name} (${c.items.length})`).join("\n"),
    );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    main();
}
