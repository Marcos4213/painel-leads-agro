import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { leadFieldOrder, normalizeLeads } from "../js/logic.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = dirname(scriptDir);

export function parseCsv(text) {
  let source = String(text ?? "");
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }

  if (inQuotes) throw new Error("CSV com aspas sem fechar.");
  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}

export function leadsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((cell) => cell.trim());
  const objects = rows.slice(1).map((cells) => {
    const lead = {};
    header.forEach((key, index) => {
      if (!key) return;
      lead[key] = cells[index] ?? "";
    });
    return lead;
  });
  return normalizeLeads(objects).map(orderLead);
}

export function orderLead(lead) {
  const ordered = {};
  for (const key of leadFieldOrder()) ordered[key] = lead[key];
  return ordered;
}

function main() {
  const input = resolve(process.argv[2] || resolve(root, "data/leads.csv"));
  const output = resolve(process.argv[3] || resolve(root, "data/leads.json"));
  const leads = leadsFromCsv(readFileSync(input, "utf8"));
  writeFileSync(output, `${JSON.stringify(leads, null, 2)}\n`);
  console.log(`${leads.length} leads escritos em ${output}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
