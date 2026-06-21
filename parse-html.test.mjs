import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHtml } from "./parse-html.mjs";

// A trimmed-down fixture mirroring Google Sheets' "Web page" export structure:
// a header row, a colspan'd category banner, and data rows whose Map and Notes
// cells carry real <a href> links plus softmerge-wrapped coords/address.
const FIXTURE = `<table class="waffle"><tbody>
<tr><th class="row-headers-background"><div>1</div></th><td class="s0">Place</td><td class="s0">From Kingston</td><td class="s0">From Scranton</td><td class="s0">From Canadensis</td><td class="s0">Map / Link</td><td class="s0">Notes</td><td class="s0">Coordinates</td><td class="s0">Address</td></tr>
<tr><th class="row-headers-background"><div>2</div></th><td class="s1" colspan="6">Fruit Picking</td><td></td><td></td></tr>
<tr><th class="row-headers-background"><div>3</div></th><td class="s2">Smith&#39; Berry farm</td><td class="s3">17 min</td><td class="s3">1 hr 8 min</td><td class="s3"></td><td class="s4"><a target="_blank" href="https://www.google.com/maps/search/?api=1&amp;query=Smith&amp;query_place_id=ChIJabc">Map</a></td><td class="s2">Closed Sundays. It&#39;s great</td><td class="s5 softmerge"><div class="softmerge-inner">41.347395, -75.873371</div></td><td class="s6 softmerge"><div class="softmerge-inner">1589 W 8th St, Wyoming, PA 18644</div></td></tr>
<tr><th class="row-headers-background"><div>4</div></th><td class="s2">Whistle Pig</td><td class="s3">27 min</td><td class="s3">46 min</td><td class="s3">1 hr 21 min</td><td class="s4"><a target="_blank" href="https://www.google.com/maps/search/?api=1&amp;query=Whistle&amp;query_place_id=ChIJdef">Map</a></td><td class="s7"><a target="_blank" href="http://www.whistlepigpumpkin.com/">raspberries http://www.whistlepigpumpkin.com/</a></td><td class="s5 softmerge"><div class="softmerge-inner">41.420397, -76.045333</div></td><td class="s6"></td></tr>
<tr><th class="row-headers-background"><div>5</div></th><td class="s1" colspan="6">Resources</td><td></td><td></td></tr>
<tr><th class="row-headers-background"><div>6</div></th><td class="s2">general list</td><td class="s3"></td><td class="s3"></td><td class="s3"></td><td class="s4"><a target="_blank" href="https://example.com/blueberries">Link</a></td><td class="s2"></td><td class="s5"></td><td class="s6"></td></tr>
</tbody></table>`;

test("groups items under category banners, skipping the header row", () => {
    const { categories } = parseHtml(FIXTURE);
    assert.deepEqual(
        categories.map((c) => `${c.name}:${c.items.length}`),
        ["Fruit Picking:2", "Resources:1"],
    );
});

test("emits the standard origins", () => {
    const { origins } = parseHtml(FIXTURE);
    assert.deepEqual(origins, [
        { id: "kingston", label: "Kingston" },
        { id: "scranton", label: "Scranton" },
        { id: "canadensis", label: "Canadensis" },
    ]);
});

test("parses drive times to minutes, with null for blanks", () => {
    const [smith] = parseHtml(FIXTURE).categories[0].items;
    assert.deepEqual(smith.times, { kingston: 17, scranton: 68, canadensis: null });
});

test("uses the Map cell's href as the map url, decoding entities", () => {
    const [smith] = parseHtml(FIXTURE).categories[0].items;
    assert.equal(
        smith.map,
        "https://www.google.com/maps/search/?api=1&query=Smith&query_place_id=ChIJabc",
    );
    assert.ok(!smith.map.includes("&amp;"));
});

test("decodes entities in text fields", () => {
    const [smith] = parseHtml(FIXTURE).categories[0].items;
    assert.equal(smith.name, "Smith' Berry farm");
    assert.equal(smith.notes, "Closed Sundays. It's great");
});

test("parses coordinates and address from softmerge cells", () => {
    const [smith] = parseHtml(FIXTURE).categories[0].items;
    assert.deepEqual(smith.coordinates, { lat: 41.347395, lng: -75.873371 });
    assert.equal(smith.address, "1589 W 8th St, Wyoming, PA 18644");
});

test("captures a link inside a Notes cell as the website", () => {
    const whistle = parseHtml(FIXTURE).categories[0].items[1];
    assert.equal(whistle.website, "http://www.whistlepigpumpkin.com/");
    assert.equal(whistle.notes, "raspberries http://www.whistlepigpumpkin.com/");
    assert.equal(whistle.address, null);
});

test("website is null when the Notes cell has no link", () => {
    const [smith] = parseHtml(FIXTURE).categories[0].items;
    assert.equal(smith.website, null);
});

test("a non-maps link in the Map/Link cell is kept verbatim", () => {
    const resource = parseHtml(FIXTURE).categories[1].items[0];
    assert.equal(resource.map, "https://example.com/blueberries");
    assert.equal(resource.coordinates, null);
    assert.equal(resource.address, null);
});

// Smoke-test against the real export so structural drift is caught.
test("parses the real data.html export", () => {
    const data = parseHtml(readFileSync(new URL("./data.html", import.meta.url), "utf8"));
    assert.equal(data.categories.length, 19);
    const items = data.categories.flatMap((c) => c.items);
    assert.equal(items.length, 184);
    assert.ok(items.every((i) => i.map.startsWith("http")));
});
