import { readFileSync, writeFileSync } from 'node:fs';

const raw = readFileSync('Updated list - nepa outings(1).csv', 'utf8');

// --- Minimal RFC-4180 CSV parser (handles quoted fields, embedded commas/quotes/newlines) ---
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(raw);
const header = rows.shift();

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
  return m ? m[0].replace(/[.,)]+$/, '') : null;
}

// Build a Google Maps search link. The source "Map" column has no real URL,
// so we search by place name + any address-ish text from the notes, biased to PA.
function mapUrl(name, notes) {
  // Try to find an address fragment in the notes (e.g. "350 Cliff St, Scranton, PA 18503")
  let query = name;
  const addr = notes && notes.match(/\d{1,5}[^,|]*(?:Rd|St|Ave|Blvd|Dr|Hwy|Ln|Way|Wy|Pkwy|Trail|Trl|Sq|Pike|Cir)\.?[^|]*?,?\s*[A-Z][a-z]+,?\s*[A-Z]{2}\s*\d{5}/);
  if (addr) query = `${name} ${addr[0]}`;
  else query = `${name}, PA`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

const categories = [];
let current = null;

for (const r of rows) {
  const [place, kingston, scranton, canadensis, mapCol, notes] = r.map((x) => (x ?? '').trim());
  if (!place) continue;

  const kMin = toMinutes(kingston);
  const sMin = toMinutes(scranton);
  const cMin = toMinutes(canadensis);

  // A pure category header has no times, no map link, and no notes.
  const isHeader = !kMin && !sMin && !cMin && !mapCol && !notes;
  if (isHeader) {
    current = { name: place, items: [] };
    categories.push(current);
    continue;
  }

  if (!current) {
    current = { name: 'Other', items: [] };
    categories.push(current);
  }

  current.items.push({
    name: place,
    times: { kingston: kMin, scranton: sMin, canadensis: cMin },
    map: mapUrl(place, notes),
    website: extractUrl(notes),
    notes: notes || '',
  });
}

const out = {
  origins: [
    { id: 'kingston', label: 'Kingston' },
    { id: 'scranton', label: 'Scranton' },
    { id: 'canadensis', label: 'Canadensis' },
  ],
  categories,
};

writeFileSync('nepa-outings/src/app/outings.json', JSON.stringify(out, null, 2));

const itemCount = categories.reduce((n, c) => n + c.items.length, 0);
console.log(`Parsed ${categories.length} categories, ${itemCount} items.`);
console.log(categories.map((c) => `  ${c.name} (${c.items.length})`).join('\n'));
