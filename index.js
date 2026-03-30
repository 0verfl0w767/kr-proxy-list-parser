const fs = require("fs/promises");
const cheerio = require("cheerio");

const DEFAULT_URL =
  "https://proxydb.net/?country=KR&protocol=http&sort_column_id=uptime&sort_order_desc=true";
const OUTPUT_FILE = "proxy.json";

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function extractPortCandidates(portText) {
  const matches = portText.match(/\d+/g);
  return matches || [];
}

function buildProxyObject(cells, rank) {
  const portCandidates = extractPortCandidates(cells[1] || "");

  return {
    rank,
    ip: cells[0] || "",
    port: portCandidates.at(-1) || "",
    portRaw: cells[1] || "",
    protocol: cells[2] || "",
    country: cells[3] || "",
    anonymity: cells[4] || "",
    uptime: cells[5] || "",
    responseTime: cells[6] || "",
    lastChecked: cells[8] || cells[7] || "",
  };
}

async function parseTopProxyRows(url, topN = 5) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Find tbody rows with enough cells to represent the proxy table.
  const rows = $("tbody tr")
    .filter((_, tr) => $(tr).find("td").length >= 7)
    .slice(0, topN);

  if (rows.length === 0) {
    throw new Error(
      "No proxy rows found in tbody. The page structure may have changed.",
    );
  }

  return rows
    .map((index, tr) => {
      const cells = $(tr)
        .find("td")
        .map((_, td) => normalizeText($(td).text()))
        .get();

      return buildProxyObject(cells, index + 1);
    })
    .get();
}

async function main() {
  const url = process.argv[2] || DEFAULT_URL;

  try {
    const items = await parseTopProxyRows(url, 5);

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(items, null, 2), "utf8");

    console.log(`Saved ${items.length} rows to ${OUTPUT_FILE}`);
    console.log(JSON.stringify(items, null, 2));
  } catch (error) {
    console.error("Parse failed:", error.message);
    process.exit(1);
  }
}

main();
