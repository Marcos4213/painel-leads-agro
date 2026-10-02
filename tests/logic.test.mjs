import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildBackup,
  buildScript,
  computeKpis,
  filterLeads,
  instagramUrl,
  nextLead,
  normalizeLeads,
  parseBackup,
  progressOf,
  telHref,
  waHref,
  waMessage,
} from "../js/logic.js";
import { leadsFromCsv, parseCsv } from "../scripts/csv-to-json.mjs";

const csv = readFileSync(new URL("../data/leads.csv", import.meta.url), "utf8");
const json = JSON.parse(readFileSync(new URL("../data/leads.json", import.meta.url), "utf8"));

test("CSV de exemplo gera o mesmo JSON publicado", () => {
  assert.deepEqual(leadsFromCsv(csv), json);
});

test("CSV com vírgula entre aspas e aspas escapadas", () => {
  const rows = parseCsv('nome,obs\n"Ana","disse ""oi"", e saiu"\n');
  assert.deepEqual(rows, [
    ["nome", "obs"],
    ["Ana", 'disse "oi", e saiu'],
  ]);
});

test("lista de exemplo tem 8 leads fictícios e alta prioridade primeiro", () => {
  const leads = normalizeLeads(json);
  assert.equal(leads.length, 8);
  assert.ok(leads.every((lead) => /exemplo/i.test(lead.empresa)));
  assert.ok(leads.every((lead) => lead.telefone.startsWith("(00)")));
  const sorted = filterLeads(leads, {}, {});
  assert.deepEqual(
    sorted.map((lead) => lead.id),
    ["ex-01", "ex-02", "ex-04", "ex-06", "ex-08", "ex-03", "ex-05", "ex-07"],
  );
});

test("busca ignora acento e filtros combinam", () => {
  const leads = normalizeLeads(json);
  assert.deepEqual(filterLeads(leads, {}, { q: "joao" }).map((lead) => lead.id), ["ex-01"]);
  assert.deepEqual(filterLeads(leads, {}, { cidade: "Sorriso/MT" }).map((lead) => lead.id), ["ex-02"]);
  assert.equal(filterLeads(leads, {}, { prioridade: "alta" }).length, 5);
  assert.deepEqual(filterLeads(leads, {}, { status_site: "site fraco" }).map((lead) => lead.id), ["ex-06", "ex-03"]);
  const progress = { "ex-05": { status: "Interessado", notas: "", retornar_em: "" } };
  assert.deepEqual(filterLeads(leads, progress, { status_contato: "Interessado" }).map((lead) => lead.id), ["ex-05"]);
});

test("telefone brasileiro vira tel:+55 e wa.me só com dígitos", () => {
  assert.equal(telHref("(00) 00000-0000"), "tel:+5500000000000");
  assert.equal(telHref("(16) 99999-0000"), "tel:+5516999990000");
  assert.equal(telHref("1633334444"), "tel:+551633334444");
  assert.equal(telHref("+55 (16) 99999-0000"), "tel:+5516999990000");
  assert.equal(telHref("016999990000"), "tel:+5516999990000");
  assert.equal(telHref("(016) 3333-4444"), "tel:+551633334444");
  assert.equal(telHref(""), "");

  const lead = normalizeLeads(json)[0];
  const href = waHref(lead);
  assert.ok(href.startsWith("https://wa.me/5500000000000?text="));
  const text = decodeURIComponent(href.split("text=")[1]);
  assert.match(text, /João Exemplo/);
  assert.match(text, /Agropecuária Exemplo Ltda/);
  assert.equal(text, waMessage(lead));
});

test("instagram aceita @, handle ou URL", () => {
  assert.equal(instagramUrl("@exemplo.ficticio"), "https://instagram.com/exemplo.ficticio");
  assert.equal(instagramUrl("https://instagram.com/exemplo.ficticio/"), "https://instagram.com/exemplo.ficticio/");
  assert.equal(instagramUrl(""), "");
});

test("roteiro preenche o lead e troca o concorrente vazio", () => {
  const leads = normalizeLeads(json);
  const joao = leads.find((lead) => lead.id === "ex-01");
  const semConcorrente = leads.find((lead) => lead.id === "ex-03");
  const semDono = leads.find((lead) => lead.id === "ex-04");
  const script = buildScript(joao).map((step) => step.texto).join("\n");

  assert.match(script, /^Oi, João Exemplo, é o Marcos\./);
  assert.match(script, /Fiz uma busca hoje de Insumos agrícolas em Ribeirão Preto/);
  assert.match(script, /quem aparece é a Agro Concorrente Exemplo/);
  assert.match(script, /A Agropecuária Exemplo Ltda não aparece/);
  assert.match(script, /está ligando pra eles/);
  assert.match(script, /chega mais por indicação ou pelo Instagram\?/);
  assert.match(script, /como ficaria a Agropecuária Exemplo Ltda aparecendo ali/);
  assert.match(script, /nem vou te vender por telefone/);

  const fallback = buildScript(semConcorrente).find((step) => step.id === "gancho").texto;
  assert.match(fallback, /quem aparece são outras empresas da região/);
  assert.match(fallback, /ligando pra elas/);
  assert.doesNotMatch(fallback, /é a outras/);

  assert.match(buildScript(semDono)[0].texto, /^Oi, é o Marcos\./);
});

test("KPIs, próximo lead e backup", () => {
  const leads = normalizeLeads(json);
  assert.deepEqual(computeKpis(leads, {}), {
    total: 8,
    alta: 5,
    contatados: 0,
    interessados: 0,
    fechados: 0,
  });

  const progress = {
    "ex-01": { status: "Liguei - sem resposta", notas: "caixa postal", retornar_em: "" },
    "ex-02": { status: "Interessado", notas: "", retornar_em: "2026-10-03" },
    "ex-08": { status: "Fechado", notas: "", retornar_em: "" },
  };
  assert.deepEqual(computeKpis(leads, progress), {
    total: 8,
    alta: 5,
    contatados: 3,
    interessados: 1,
    fechados: 1,
  });

  assert.equal(nextLead(leads, progress, "ex-04").id, "ex-06");
  assert.equal(nextLead(leads, progress, "ex-06").id, "ex-04");
  assert.equal(nextLead(leads, {}, null).id, "ex-01");

  const allCalled = {};
  for (const lead of leads) allCalled[lead.id] = { status: "Sem interesse", notas: "", retornar_em: "" };
  assert.equal(nextLead(leads, allCalled, null).reason, "none");
  assert.deepEqual(nextLead(leads, { "ex-02": progress["ex-02"], "ex-08": progress["ex-08"], "ex-01": progress["ex-01"], "ex-06": { status: "Retornar", notas: "", retornar_em: "" } }, "ex-04"), {
    id: "ex-04",
    reason: "only",
  });

  const backup = buildBackup(leads, progress, new Date("2026-10-02T12:00:00.000Z"));
  assert.equal(backup.app, "painel-leads-agro");
  assert.equal(backup.progress["ex-01"].notas, "caixa postal");
  assert.deepEqual(parseBackup(backup)["ex-02"], progressOf(progress, "ex-02"));
  assert.equal(parseBackup({ "ex-09": { status: "inventar", notas: 12, retornar_em: "amanhã" } })["ex-09"].status, "Não contatado");
  assert.throws(() => parseBackup({ app: "painel-leads-agro", exported_at: "x" }), /progress/);
});
