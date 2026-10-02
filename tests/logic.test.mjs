import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildBackup,
  buildCallFlow,
  buildScript,
  computeKpis,
  filterLeads,
  instagramUrl,
  nextLead,
  normalizeLead,
  normalizeLeads,
  parseBackup,
  progressOf,
  telHref,
  waHref,
  waHrefText,
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

function fake(overrides = {}) {
  return normalizeLead({
    id: "ex-01",
    empresa: "Agropecuária Exemplo Ltda",
    nome_proprietario: "João Exemplo",
    segmento: "Insumos agrícolas",
    cidade: "Ribeirão Preto",
    uf: "SP",
    telefone: "(00) 00000-0000",
    status_site: "sem site",
    prioridade: "alta",
    concorrente_no_google: "Agro Concorrente Exemplo",
    ...overrides,
  });
}

test("lista publicada continua alinhada ao CSV", () => {
  const leads = normalizeLeads(json);
  assert.equal(leads.length, json.length);
  assert.ok(leads.length > 8);
  assert.ok(leads.every((lead) => lead.id));
});

test("busca ignora acento e filtros combinam", () => {
  const leads = normalizeLeads([
    fake(),
    fake({ id: "ex-02", nome_proprietario: "Maria Exemplo", cidade: "Sorriso", uf: "MT", segmento: "Sementes", prioridade: "alta" }),
    fake({ id: "ex-03", nome_proprietario: "Pedro Exemplo", cidade: "Londrina", uf: "PR", status_site: "site fraco", prioridade: "média", concorrente_no_google: "" }),
    fake({ id: "ex-05", nome_proprietario: "Ana Exemplo", cidade: "Rio Verde", uf: "GO", prioridade: "média" }),
  ]);
  assert.deepEqual(filterLeads(leads, {}, { q: "joao" }).map((lead) => lead.id), ["ex-01"]);
  assert.deepEqual(filterLeads(leads, {}, { cidade: "Sorriso/MT" }).map((lead) => lead.id), ["ex-02"]);
  assert.equal(filterLeads(leads, {}, { prioridade: "alta" }).length, 2);
  assert.deepEqual(filterLeads(leads, {}, { status_site: "site fraco" }).map((lead) => lead.id), ["ex-03"]);
  const progress = { "ex-05": { status: "Interessado", notas: "", retornar_em: "" } };
  assert.deepEqual(filterLeads(leads, progress, { status_contato: "Interessado" }).map((lead) => lead.id), ["ex-05"]);
  assert.deepEqual(filterLeads(leads, {}, {}).map((lead) => lead.id), ["ex-01", "ex-02", "ex-03", "ex-05"]);
});

test("telefone brasileiro vira tel:+55 e wa.me só com dígitos", () => {
  assert.equal(telHref("(00) 00000-0000"), "tel:+5500000000000");
  assert.equal(telHref("(16) 99999-0000"), "tel:+5516999990000");
  assert.equal(telHref("1633334444"), "tel:+551633334444");
  assert.equal(telHref("+55 (16) 99999-0000"), "tel:+5516999990000");
  assert.equal(telHref("016999990000"), "tel:+5516999990000");
  assert.equal(telHref("(016) 3333-4444"), "tel:+551633334444");
  assert.equal(telHref(""), "");

  const lead = fake();
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
  const joao = fake();
  const semConcorrente = fake({ id: "ex-03", concorrente_no_google: "" });
  const semDono = fake({ id: "ex-04", nome_proprietario: "" });
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
  const leads = normalizeLeads([
    fake(),
    fake({ id: "ex-02", prioridade: "alta" }),
    fake({ id: "ex-04", prioridade: "alta" }),
    fake({ id: "ex-06", prioridade: "alta" }),
    fake({ id: "ex-08", prioridade: "alta" }),
    fake({ id: "ex-03", prioridade: "média" }),
  ]);
  assert.deepEqual(computeKpis(leads, {}), {
    total: 6,
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
    total: 6,
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

test("sem roteiro personalizado usa o fluxo padrão e omite Instagram", () => {
  const flow = buildCallFlow(fake());
  assert.equal(flow.personalized, false);
  assert.deepEqual(flow.stages.map((stage) => stage.titulo), [
    "Abertura",
    "Gancho da perda",
    "Pergunta",
    "Escuta",
    "Fechamento leve",
  ]);
  assert.equal(flow.stages[0].linhas[0], "Oi, João Exemplo, é o Marcos.");
  assert.match(flow.stages[1].linhas.join(" "), /é a Agro Concorrente Exemplo/);
  assert.equal(flow.stages.filter((stage) => stage.pausa).length, 4);
  assert.equal(flow.stages.at(-1).pausa, false);
  assert.equal(flow.objecoes[0].objecao, "Já recebo muita ligação disso");
  assert.equal(flow.whatsapp, waMessage(fake()));
  assert.equal(flow.diagnostico.length, 0);
});

test("fixture personalizado ramifica, esconde instagram vazio e aceita os dois formatos", () => {
  const sample = JSON.parse(readFileSync(new URL("../data/sample-roteiro.json", import.meta.url), "utf8"));
  const lead = normalizeLead(sample);
  const flow = buildCallFlow(lead);
  assert.equal(flow.personalized, true);
  assert.deepEqual(flow.diagnostico, sample.diagnostico);
  assert.deepEqual(flow.stages.map((stage) => stage.titulo), [
    "Abertura",
    "Gancho da perda",
    "Instagram",
    "Pergunta",
    "Escuta",
    "Fechamento leve",
  ]);
  assert.deepEqual(flow.stages[0].ramos.map((ramo) => ramo.rotulo), ["sim", "ocupado", "quem fala?"]);
  assert.match(flow.stages[0].ramos[1].linhas.join(" "), /WhatsApp/);
  assert.equal(flow.stages[3].linhas.length, 2);
  assert.equal(flow.stages[4].ramos.length, 3);
  assert.equal(flow.objecoes.length, 2);
  assert.match(flow.whatsapp, /João Exemplo/);
  assert.match(flow.dica, /17h30/);
  const href = waHrefText(lead.telefone, flow.whatsapp);
  assert.ok(href.startsWith("https://wa.me/5500000000000?text="));
  assert.equal(decodeURIComponent(href.split("text=")[1]), flow.whatsapp);

  const parcial = buildCallFlow(fake({
    roteiro: { abertura: "Oi, João. Só um achado." },
    diagnostico: "Google mostra o concorrente",
  }));
  assert.equal(parcial.stages[0].linhas[0], "Oi, João. Só um achado.");
  assert.match(parcial.stages[1].linhas.join(" "), /Agro Concorrente Exemplo/);
  assert.equal(parcial.stages.some((stage) => stage.id === "instagram"), false);
  assert.deepEqual(parcial.diagnostico, ["Google mostra o concorrente"]);

  const formatos = buildCallFlow(fake({
    roteiro: {
      gancho_instagram: "   ",
      escuta: ["Ele fala de indicação.", "Ele fala de preço."],
      objecoes: { "está caro": "Não é preço agora. É cliente que não chega." },
    },
  }));
  assert.equal(formatos.stages.some((stage) => stage.id === "instagram"), false);
  assert.deepEqual(formatos.stages.find((stage) => stage.id === "escuta").linhas, [
    "Ele fala de indicação.",
    "Ele fala de preço.",
  ]);
  assert.equal(formatos.objecoes[0].objecao, "está caro");
  assert.match(formatos.objecoes[0].linhas.join(" "), /não chega/);
  assert.equal(buildCallFlow(fake({ roteiro: "texto solto" })).personalized, false);
  assert.equal(buildCallFlow(fake({ roteiro: {} })).personalized, false);
});
