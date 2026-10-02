/**
 * Funções puras do painel: dados, telefone, filtros, roteiro e backup.
 * Sem DOM, para poder testar no Node e reutilizar no navegador.
 */

export const STATUSES = [
  "Não contatado",
  "Liguei - sem resposta",
  "Retornar",
  "Interessado",
  "Videochamada marcada",
  "Proposta enviada",
  "Fechado",
  "Sem interesse",
];

export const SITE_STATUSES = ["sem site", "site fora do ar", "site fraco"];

export const CALL_TIPS = [
  "Ligar entre 6h30 e 7h30, ou depois das 17h30. De dia, o dono do agro está no campo.",
  "Chame o dono pelo nome.",
];

export const STORAGE_KEY = "painel-leads-agro-v1";

const LEAD_KEYS = [
  "id",
  "empresa",
  "nome_proprietario",
  "fonte_proprietario",
  "cnpj",
  "segmento",
  "cidade",
  "uf",
  "telefone",
  "instagram",
  "facebook",
  "status_site",
  "nota_google",
  "avaliacoes",
  "prioridade",
  "concorrente_no_google",
  "observacao",
];

export function fold(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseScore(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseCount(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

export function fallbackId(lead, index) {
  const base = [lead.cnpj, lead.empresa, lead.cidade, String(index)]
    .filter(Boolean)
    .join("-");
  const slug = fold(base).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `lead-${index + 1}`;
}

export function normalizeLead(raw, index = 0) {
  const source = raw && typeof raw === "object" ? raw : {};
  const lead = {
    id: clean(source.id),
    empresa: clean(source.empresa),
    nome_proprietario: clean(source.nome_proprietario),
    fonte_proprietario: clean(source.fonte_proprietario),
    cnpj: clean(source.cnpj),
    segmento: clean(source.segmento),
    cidade: clean(source.cidade),
    uf: clean(source.uf).toUpperCase(),
    telefone: clean(source.telefone),
    instagram: clean(source.instagram),
    facebook: clean(source.facebook),
    status_site: clean(source.status_site).toLowerCase(),
    nota_google: parseScore(source.nota_google),
    avaliacoes: parseCount(source.avaliacoes),
    prioridade: clean(source.prioridade).toLowerCase(),
    concorrente_no_google: clean(source.concorrente_no_google),
    observacao: clean(source.observacao),
  };
  const previa = clean(source.previa_url);
  if (previa) lead.previa_url = previa;
  const diagnostico = diagnosticoList(source.diagnostico);
  if (diagnostico.length) lead.diagnostico = diagnostico;
  if (source.roteiro && typeof source.roteiro === "object" && !Array.isArray(source.roteiro)) {
    lead.roteiro = source.roteiro;
  }
  if (!lead.id) lead.id = fallbackId(lead, index);
  return lead;
}

export function extractLeadArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.leads)) return data.leads;
  throw new Error("O arquivo de leads precisa ser uma lista JSON.");
}

export function normalizeLeads(list) {
  if (!Array.isArray(list)) throw new Error("O arquivo de leads precisa ser uma lista JSON.");
  const seen = new Set();
  return list.map((raw, index) => {
    const lead = normalizeLead(raw, index);
    let id = lead.id;
    let n = 2;
    while (seen.has(id)) id = `${lead.id}-${n++}`;
    seen.add(id);
    lead.id = id;
    return lead;
  });
}

export function leadFieldOrder() {
  return LEAD_KEYS.slice();
}

export function priorityRank(value) {
  const n = fold(value);
  if (n === "alta") return 0;
  if (n === "media") return 1;
  return 2;
}

export function priorityLabel(value) {
  const n = fold(value);
  if (n === "alta") return "Alta";
  if (n === "media") return "Média";
  if (!clean(value)) return "Sem prioridade";
  return clean(value);
}

export function siteStatusLabel(value) {
  const n = fold(value);
  if (n === "sem site") return "Sem site";
  if (n === "site fora do ar") return "Fora do ar";
  if (n === "site fraco") return "Site fraco";
  if (!clean(value)) return "Site não informado";
  return clean(value);
}

export function placeLabel(lead) {
  if (lead.cidade && lead.uf) return `${lead.cidade}/${lead.uf}`;
  return lead.cidade || lead.uf || "Cidade não informada";
}

export function sortLeads(leads) {
  return leads
    .map((lead, index) => ({ lead, index }))
    .sort((a, b) => {
      const rank = priorityRank(a.lead.prioridade) - priorityRank(b.lead.prioridade);
      if (rank !== 0) return rank;
      return a.index - b.index;
    })
    .map((item) => item.lead);
}

export function isExampleLead(lead) {
  return /exemplo/i.test(
    [lead.empresa, lead.nome_proprietario, lead.observacao, lead.fonte_proprietario].join(" "),
  );
}

export function isExampleDataset(leads) {
  return leads.some(isExampleLead);
}

/**
 * Dígitos para tel:+55… e wa.me/55…
 * Aceita número nacional (10 ou 11 dígitos), com zero de operadora,
 * ou já com DDI 55. O DDD fictício 00 dos exemplos não é tratado como tronco.
 */
export function brazilDigits(phone) {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;

  if (d.startsWith("0")) {
    const rest = d.slice(1);
    const ddd = rest.slice(0, 2);
    const validDdd = /^(1[1-9]|[2-9]\d)$/.test(ddd);
    if ((rest.length === 10 || rest.length === 11) && validDdd) d = rest;
  }

  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return `55${d}`;
}

export function telHref(phone) {
  const digits = brazilDigits(phone);
  return digits ? `tel:+${digits}` : "";
}

export function waMessage(lead) {
  const nome = clean(lead.nome_proprietario);
  const empresa = clean(lead.empresa) || "sua empresa";
  const segmento = clean(lead.segmento) || "empresas do agro";
  const cidade = clean(lead.cidade) || clean(lead.uf) || "sua região";
  const oi = nome ? `Oi, ${nome}!` : "Oi!";
  return `${oi} Aqui é o Marcos. Segue o print da busca de ${segmento} em ${cidade} e uma ideia de como ficaria a ${empresa} aparecendo no Google. Se não fizer sentido, pode ignorar.`;
}

export function waHref(lead) {
  const digits = brazilDigits(lead.telefone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(waMessage(lead))}`;
}

export function safeHttpUrl(value) {
  const v = clean(value);
  if (!v) return "";
  try {
    const url = new URL(v);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

export function previewUrl(lead, progress) {
  if (progress && typeof progress.previa_url === "string") return progress.previa_url.trim();
  return clean(lead?.previa_url);
}

export function followupMessage(lead) {
  const nome = clean(lead?.nome_proprietario);
  const empresa = scriptCompany(lead || {});
  const segmento = scriptSegment(lead || {});
  const cidade = scriptPlace(lead || {});
  const oi = nome ? `Oi, ${nome}!` : "Oi!";
  const previa = safeHttpUrl(lead?.previa_url);
  const link = previa ? ` Prévia do site: ${previa}` : "";
  return `${oi} Aqui é o Marcos. Fica confirmada a chamada de vídeo de 15 minutos para eu te mostrar a prévia do site da ${empresa}. Dia e horário: [dia e hora]. Enquanto isso, segue o print da busca de ${segmento} em ${cidade}.${link}`;
}

export function previewWaMessage(lead, url) {
  const href = safeHttpUrl(url);
  if (!href) return "";
  const nome = clean(lead?.nome_proprietario);
  const empresa = scriptCompany(lead || {});
  const oi = nome ? `Oi, ${nome}!` : "Oi!";
  return `${oi} Aqui é o Marcos. Segue a prévia do site da ${empresa}, com os produtos de vocês: ${href}`;
}

export function instagramUrl(value) {
  const v = clean(value);
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/^instagram\.com\//i, "").replace(/\/$/, "");
  return handle ? `https://instagram.com/${encodeURIComponent(handle)}` : "";
}

export function facebookUrl(value) {
  const v = clean(value);
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/\/$/, "");
  return handle ? `https://facebook.com/${encodeURIComponent(handle)}` : "";
}

function scriptPlace(lead) {
  return clean(lead.cidade) || clean(lead.uf) || "sua região";
}

function scriptSegment(lead) {
  return clean(lead.segmento) || "empresas do agro";
}

function scriptCompany(lead) {
  return clean(lead.empresa) || "sua empresa";
}

export function buildScript(lead) {
  const nome = clean(lead.nome_proprietario);
  const segmento = scriptSegment(lead);
  const cidade = scriptPlace(lead);
  const empresa = scriptCompany(lead);
  const concorrente = clean(lead.concorrente_no_google);
  const abertura = nome ? `Oi, ${nome}, é o Marcos.` : "Oi, é o Marcos.";

  const gancho = concorrente
    ? `Quando o produtor procura ${segmento} em ${cidade} no Google, quem aparece é a ${concorrente}. A ${empresa} não aparece. Quem está procurando agora, com dinheiro na mão, está ligando pra eles. Não estou dizendo que você vende mal, pelo contrário, só que esse cliente nem chega até você.`
    : `Quando o produtor procura ${segmento} em ${cidade} no Google, quem aparece são outras empresas da região. A ${empresa} não aparece. Quem está procurando agora, com dinheiro na mão, está ligando pra elas. Não estou dizendo que você vende mal, pelo contrário, só que esse cliente nem chega até você.`;

  return [
    {
      id: "abertura",
      titulo: "Abertura",
      texto: `${abertura} Vou ser rápido, sei que você deve receber ligação de vendedor o dia todo. Não estou te vendendo nada agora. Fiz uma busca hoje de ${segmento} em ${cidade} e reparei numa coisa que acho que você vai querer saber. Posso te falar em 30 segundos?`,
    },
    { id: "gancho", titulo: "Gancho da perda", texto: gancho },
    {
      id: "pergunta",
      titulo: "Pergunta",
      texto: "Hoje, quando alguém novo te procura, chega mais por indicação ou pelo Instagram?",
    },
    {
      id: "fechamento",
      titulo: "Fechamento leve",
      texto: `Eu já montei uma prévia do site da ${empresa}, com os produtos de vocês. Posso te mostrar em 15 minutinhos numa chamada de vídeo? Fica melhor amanhã cedo, umas 7h, ou no fim da tarde, depois das 17h30?`,
    },
    {
      id: "objecao",
      titulo: "Objeção: já recebo muita ligação disso",
      texto: "Imagino. Por isso nem vou te vender por telefone, só te mando o print e você decide.",
    },
  ];
}

export function asLines(value) {
  if (Array.isArray(value)) return value.flatMap(asLines);
  if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
  if (typeof value !== "string") return [];
  const text = value.trim();
  if (!text) return [];
  if (text.length <= 120 && !text.includes("\n")) return [text];
  return text
    .split(/\n+/)
    .flatMap((part) => {
      const bits = part.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
      return bits.length ? bits : [part.trim()].filter(Boolean);
    })
    .filter(Boolean);
}

export function diagnosticoList(value) {
  if (Array.isArray(value)) return value.flatMap((item) => asLines(item));
  return asLines(value);
}

function messageText(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean).join("\n");
  }
  return "";
}

function branchesFrom(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value)
    .map(([rotulo, fala]) => ({
      rotulo: String(rotulo).trim(),
      linhas: asLines(fala),
    }))
    .filter((item) => item.rotulo && item.linhas.length);
}

function objectionsFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string" && item.trim()) return { objecao: item.trim(), linhas: [] };
        if (!item || typeof item !== "object") return null;
        const objecao = clean(item.objecao ?? item["objeção"] ?? item.objection ?? item.titulo ?? "");
        const linhas = asLines(item.resposta ?? item.answer ?? item.fala ?? "");
        if (!objecao && !linhas.length) return null;
        return { objecao: objecao || "Objeção", linhas };
      })
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return branchesFrom(value).map((item) => ({ objecao: item.rotulo, linhas: item.linhas }));
  }
  return [];
}

function parseEscuta(value) {
  if (Array.isArray(value)) return { linhas: asLines(value), ramos: [] };
  if (value && typeof value === "object") return { linhas: [], ramos: branchesFrom(value) };
  if (typeof value === "string") return { linhas: asLines(value), ramos: [] };
  return { linhas: [], ramos: [] };
}

function readRoteiro(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const escuta = parseEscuta(raw.escuta);
  const parsed = {
    abertura: asLines(raw.abertura),
    espera: branchesFrom(raw.espera_abertura),
    gancho_perda: asLines(raw.gancho_perda),
    gancho_instagram: asLines(raw.gancho_instagram),
    pergunta: asLines(raw.pergunta_engajamento),
    escuta,
    fechamento: asLines(raw.fechamento_leve),
    agendamento: asLines(raw.agendamento),
    objecoes: objectionsFrom(raw.objecoes),
    whatsapp: messageText(raw.mensagem_whatsapp_followup),
    dica: typeof raw.dica === "string" ? raw.dica.trim() : asLines(raw.dica).join(" "),
  };
  const useful = parsed.abertura.length
    || parsed.espera.length
    || parsed.gancho_perda.length
    || parsed.gancho_instagram.length
    || parsed.pergunta.length
    || parsed.escuta.linhas.length
    || parsed.escuta.ramos.length
    || parsed.fechamento.length
    || parsed.agendamento.length
    || parsed.objecoes.length
    || parsed.whatsapp
    || parsed.dica;
  return useful ? parsed : null;
}

function genericPieces(lead) {
  const steps = buildScript(lead);
  const byId = Object.fromEntries(steps.map((step) => [step.id, step.texto]));
  return {
    abertura: asLines(byId.abertura),
    gancho: asLines(byId.gancho),
    pergunta: asLines(byId.pergunta),
    escuta: ["Deixe ele falar.", "Não preencha o silêncio."],
    fechamento: asLines(byId.fechamento),
    objecoes: genericObjections(),
  };
}

function genericObjections() {
  return [
    {
      objecao: "Já recebo muita ligação disso",
      linhas: asLines("Imagino. Por isso nem vou te vender por telefone, só te mando o print e você decide."),
    },
    {
      objecao: "não tenho tempo pra reunião",
      linhas: asLines("São 15 minutos. Amanhã cedo, umas 7h, ou depois das 17h30. Se não gostar da prévia, a gente encerra."),
    },
    {
      objecao: "manda por WhatsApp mesmo",
      linhas: asLines("Mando o print. A prévia fica melhor em 15 minutos de vídeo, no horário que você puder."),
    },
    {
      objecao: "não pedi site nenhum",
      linhas: asLines("Verdade, fiz por conta própria porque vi o potencial. Se não gostar, sem compromisso."),
    },
  ];
}

export function buildCallFlow(lead) {
  const generic = genericPieces(lead || {});
  const custom = readRoteiro(lead?.roteiro);
  const personalized = Boolean(custom);
  const escuta = custom?.escuta || { linhas: [], ramos: [] };
  const escutaLinhas = escuta.ramos.length
    ? (escuta.linhas.length ? escuta.linhas : ["Escute até o fim."])
    : (escuta.linhas.length ? escuta.linhas : generic.escuta);

  const stages = [];
  const push = (stage) => {
    stages.push({ ramos: [], pausa: true, kicker: "", ...stage, numero: stages.length + 1 });
  };
  push({
    id: "abertura",
    titulo: "Abertura",
    linhas: custom?.abertura.length ? custom.abertura : generic.abertura,
    ramos: custom?.espera || [],
  });
  push({
    id: "gancho",
    titulo: "Gancho da perda",
    linhas: custom?.gancho_perda.length ? custom.gancho_perda : generic.gancho,
  });
  if (custom?.gancho_instagram.length) {
    push({ id: "instagram", titulo: "Instagram", linhas: custom.gancho_instagram });
  }
  push({
    id: "pergunta",
    titulo: "Pergunta",
    kicker: "Deixe ele falar",
    linhas: custom?.pergunta.length ? custom.pergunta : generic.pergunta,
  });
  push({
    id: "escuta",
    titulo: "Escuta",
    kicker: escuta.ramos.length ? "Como ele respondeu?" : "",
    linhas: personalized ? escutaLinhas : generic.escuta,
    ramos: escuta.ramos,
  });
  const agenda = custom?.agendamento || [];
  push({
    id: "fechamento",
    titulo: "Fechamento leve",
    linhas: custom?.fechamento.length ? custom.fechamento : generic.fechamento,
    pausa: agenda.length > 0,
  });
  if (agenda.length) {
    push({
      id: "agendamento",
      titulo: "Agendar videochamada",
      linhas: agenda,
      pausa: false,
    });
  }

  const dica = custom?.dica || CALL_TIPS.join("\n");
  return {
    personalized,
    diagnostico: diagnosticoList(lead?.diagnostico),
    dica,
    stages,
    objecoes: custom?.objecoes.length ? custom.objecoes : generic.objecoes,
    whatsapp: custom?.whatsapp || followupMessage(lead || {}),
  };
}

export function scriptPlainText(lead) {
  const flow = buildCallFlow(lead);
  const parts = [];
  if (flow.diagnostico.length) {
    parts.push(`O que vi\n${flow.diagnostico.map((item) => `• ${item}`).join("\n")}`);
  }
  if (flow.dica) parts.push(`Dica\n${flow.dica}`);
  for (const stage of flow.stages) {
    let block = `${stage.numero}. ${stage.titulo}\n${stage.linhas.join("\n")}`;
    if (stage.pausa) block += "\n\nPAUSA: espere a resposta";
    if (stage.ramos.length) {
      block += `\n\n${stage.ramos.map((ramo) => `Se disser "${ramo.rotulo}":\n${ramo.linhas.join("\n")}`).join("\n\n")}`;
    }
    parts.push(block);
  }
  if (flow.objecoes.length) {
    parts.push(`Objeções\n${flow.objecoes.map((item) => `${item.objecao}\n${item.linhas.join("\n")}`).join("\n\n")}`);
  }
  if (flow.whatsapp) parts.push(`Mensagem pós-ligação\n${flow.whatsapp}`);
  return parts.join("\n\n");
}

export function waHrefText(phone, text) {
  const digits = brazilDigits(phone);
  const message = typeof text === "string" ? text.trim() : "";
  if (!digits || !message) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function hookSummary(lead) {
  const segmento = scriptSegment(lead);
  const cidade = scriptPlace(lead);
  const empresa = scriptCompany(lead);
  if (clean(lead.concorrente_no_google)) {
    return `Quem busca ${segmento} em ${cidade} encontra ${lead.concorrente_no_google}. A ${empresa} não aparece.`;
  }
  return `Quem busca ${segmento} em ${cidade} encontra outras empresas da região. A ${empresa} não aparece.`;
}

function videoWhen(value) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(typeof value === "string" ? value.trim() : "");
  return match ? match[1] : "";
}

export function normalizeProgress(raw) {
  const status = STATUSES.includes(raw?.status) ? raw.status : "Não contatado";
  const notas = typeof raw?.notas === "string" ? raw.notas : "";
  const retornar = typeof raw?.retornar_em === "string" ? raw.retornar_em : "";
  const progress = {
    status,
    notas,
    retornar_em: /^\d{4}-\d{2}-\d{2}$/.test(retornar) ? retornar : "",
    videochamada_em: videoWhen(raw?.videochamada_em),
  };
  if (typeof raw?.previa_url === "string") progress.previa_url = raw.previa_url.trim();
  return progress;
}

export function emptyProgress() {
  return { status: "Não contatado", notas: "", retornar_em: "", videochamada_em: "" };
}

export function progressOf(progress, id) {
  return normalizeProgress(progress?.[id]);
}

export function computeKpis(leads, progress) {
  let alta = 0;
  let contatados = 0;
  let interessados = 0;
  let videochamadas = 0;
  let fechados = 0;
  for (const lead of leads) {
    if (fold(lead.prioridade) === "alta") alta += 1;
    const status = progressOf(progress, lead.id).status;
    if (status !== "Não contatado") contatados += 1;
    if (status === "Interessado") interessados += 1;
    if (status === "Videochamada marcada") videochamadas += 1;
    if (status === "Fechado") fechados += 1;
  }
  return { total: leads.length, alta, contatados, interessados, videochamadas, fechados };
}

export function filterLeads(leads, progress, filters) {
  const q = fold(filters.q || "");
  const cidade = filters.cidade || "";
  const segmento = filters.segmento || "";
  const prioridade = filters.prioridade || "";
  const statusSite = filters.status_site || "";
  const statusContato = filters.status_contato || "";

  const matched = leads.filter((lead) => {
    if (q) {
      const blob = fold(
        [
          lead.empresa,
          lead.nome_proprietario,
          lead.cidade,
          lead.uf,
          lead.segmento,
          lead.telefone,
          lead.cnpj,
          lead.concorrente_no_google,
          lead.observacao,
          lead.instagram,
        ].join(" "),
      );
      if (!blob.includes(q)) return false;
    }
    if (cidade && placeLabel(lead) !== cidade) return false;
    if (segmento && lead.segmento !== segmento) return false;
    if (prioridade && fold(lead.prioridade) !== fold(prioridade)) return false;
    if (statusSite && lead.status_site !== statusSite) return false;
    if (statusContato && progressOf(progress, lead.id).status !== statusContato) return false;
    return true;
  });

  return sortLeads(matched);
}

export function nextLead(leads, progress, currentId) {
  const queue = sortLeads(leads).filter(
    (lead) => fold(lead.prioridade) === "alta" && progressOf(progress, lead.id).status === "Não contatado",
  );
  if (!queue.length) return { id: null, reason: "none" };
  const index = queue.findIndex((lead) => lead.id === currentId);
  if (queue.length === 1 && index === 0) return { id: queue[0].id, reason: "only" };
  if (index === -1) return { id: queue[0].id, reason: "ok" };
  return { id: queue[(index + 1) % queue.length].id, reason: "ok" };
}

export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatISODate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function returnHint(progress, today = todayISO()) {
  if (!progress?.retornar_em) return "";
  const label = formatISODate(progress.retornar_em);
  if (progress.retornar_em < today) return `Atrasado · ${label}`;
  if (progress.retornar_em === today) return `Retornar hoje · ${label}`;
  return `Retornar em ${label}`;
}

export function formatDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || "");
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`;
}

export function videoHint(progress, now = new Date()) {
  const raw = progress?.videochamada_em;
  if (!raw) return "";
  const label = formatDateTime(raw);
  const when = new Date(raw);
  if (!label || Number.isNaN(when.getTime())) return "";
  if (when.getTime() < now.getTime() - 15 * 60 * 1000) return `Vídeo passou · ${label}`;
  return `Vídeo · ${label}`;
}

function calendarStamp(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
}

export function calendarHref(lead, progress) {
  const empresa = scriptCompany(lead || {});
  const owner = clean(lead?.nome_proprietario);
  const phone = clean(lead?.telefone);
  const previa = safeHttpUrl(previewUrl(lead, progress));
  const details = [
    owner ? `Proprietário: ${owner}` : "",
    phone ? `Telefone: ${phone}` : "",
    previa ? `Prévia do site: ${previa}` : "",
    "Chamada de vídeo de 15 minutos para mostrar a prévia do site.",
  ].filter(Boolean);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Vídeo 15 min · ${empresa}`,
    details: details.join("\n"),
  });
  const when = videoWhen(progress?.videochamada_em);
  if (when) {
    const start = new Date(when);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + 15 * 60 * 1000);
      params.set("dates", `${calendarStamp(start)}/${calendarStamp(end)}`);
    }
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function formatRating(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(1).replace(".", ",");
}

export function formatReviews(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n);
  const label = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return rounded === 1 ? "1 avaliação" : `${label} avaliações`;
}

export function buildBackup(leads, progress, now = new Date()) {
  const full = {};
  const seen = new Set();
  for (const lead of leads) {
    seen.add(lead.id);
    full[lead.id] = progressOf(progress, lead.id);
  }
  for (const [id, value] of Object.entries(progress || {})) {
    if (seen.has(id)) continue;
    full[id] = normalizeProgress(value);
  }
  return {
    app: "painel-leads-agro",
    version: 1,
    exported_at: now.toISOString(),
    progress: full,
  };
}

export function parseBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Arquivo inválido.");
  }
  const hasEnvelope = "progress" in data || data.app === "painel-leads-agro" || "exported_at" in data;
  const source = data.progress && typeof data.progress === "object" && !Array.isArray(data.progress)
    ? data.progress
    : data;
  if (hasEnvelope && !data.progress) throw new Error("Backup sem o campo progress.");
  if (source === data && (data.app || data.version || data.exported_at)) {
    throw new Error("Backup sem o campo progress.");
  }
  const out = {};
  for (const [id, value] of Object.entries(source)) {
    if (["app", "version", "exported_at", "progress"].includes(id)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    out[id] = normalizeProgress(value);
  }
  return out;
}

export function loadProgress(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return parseBackup(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveProgress(storage, progress) {
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ app: "painel-leads-agro", version: 1, progress }),
  );
}

export function uniquePlaces(leads) {
  return [...new Set(leads.map(placeLabel))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function uniqueSegments(leads) {
  return [...new Set(leads.map((lead) => lead.segmento).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}
