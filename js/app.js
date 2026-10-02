import {
  STATUSES,
  buildCallFlow,
  buildBackup,
  calendarHref,
  computeKpis,
  facebookUrl,
  filterLeads,
  formatRating,
  formatReviews,
  hookSummary,
  instagramUrl,
  isExampleDataset,
  isExampleLead,
  loadProgress,
  nextLead,
  normalizeLeads,
  extractLeadArray,
  parseBackup,
  placeLabel,
  priorityLabel,
  previewUrl,
  previewWaMessage,
  progressOf,
  returnHint,
  safeHttpUrl,
  saveProgress,
  scriptPlainText,
  siteStatusLabel,
  waHrefText,
  telHref,
  todayISO,
  uniquePlaces,
  uniqueSegments,
  videoHint,
  waHref,
  fold,
} from "./logic.js";

const ICONS = {
  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 3.8h3.1l1.2 3.1-1.9 1.1a12.5 12.5 0 0 0 5.6 5.6l1.1-1.9 3.1 1.2V16a2.2 2.2 0 0 1-2.4 2.2A16.2 16.2 0 0 1 4.8 6.2 2.2 2.2 0 0 1 7 3.8z"/></svg>',
  wa:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 18.5 4.5 21l2.2-.7A8.5 8.5 0 1 0 6 18.5z"/><path d="M9 9.5c.2 1.6 1.8 3.2 3.5 3.6.4.1.8 0 1.1-.3l.6-.7c.2-.2.5-.3.8-.2l1.6.6c.3.1.5.5.4.8-.2 1.1-1.2 1.8-2.3 1.7-2.7-.3-5.4-2.8-6.1-5.4-.2-1 .3-2.1 1.3-2.5.3-.1.6 0 .8.2l.5.7c.2.2.2.6 0 .8l-.6.7z"/></svg>',
  ig:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.2" cy="6.8" r="0.8" fill="currentColor" stroke="none"/></svg>',
  copy:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M6 15.5H5.5A1.5 1.5 0 0 1 4 14V5.5A1.5 1.5 0 0 1 5.5 4H14a1.5 1.5 0 0 1 1.5 1.5V6"/></svg>',
  x:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

const state = {
  leads: [],
  progress: {},
  selectedId: null,
  scriptOpen: false,
  scriptStep: 0,
  scriptBranches: {},
  objectionsOpen: false,
  filters: {
    q: "",
    cidade: "",
    segmento: "",
    prioridade: "",
    status_site: "",
    status_contato: "",
  },
};

const list = document.getElementById("list");
const panel = document.getElementById("panel");
const roteiro = document.getElementById("roteiro");
const roteiroCard = document.getElementById("roteiro-card");
const backdrop = document.getElementById("backdrop");
let toastTimer = 0;
let lastFocus = null;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = String(value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "onClick") node.addEventListener("click", value);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function icon(name) {
  const span = document.createElement("span");
  span.className = "icon";
  span.innerHTML = ICONS[name] || "";
  return span;
}

function isMobile() {
  return window.matchMedia("(max-width: 1039px)").matches;
}

function isTyping(target) {
  return Boolean(target && target.closest("input, textarea, select, [contenteditable='true']"));
}

function selectedLead() {
  return state.leads.find((lead) => lead.id === state.selectedId) || null;
}

function toast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    node.hidden = true;
  }, 3400);
}

function announce(message) {
  const live = document.getElementById("live");
  live.textContent = "";
  window.setTimeout(() => {
    live.textContent = message;
  }, 30);
}

function persist() {
  try {
    saveProgress(localStorage, state.progress);
  } catch {
    toast("Não consegui salvar neste aparelho. Exporte um backup.");
  }
}

function siteClass(value) {
  const name = fold(value);
  if (name === "sem site") return "site-none";
  if (name === "site fora do ar") return "site-down";
  if (name === "site fraco") return "site-weak";
  return "site-unknown";
}

function renderKpis() {
  const kpis = computeKpis(state.leads, state.progress);
  document.getElementById("kpi-total").textContent = String(kpis.total);
  document.getElementById("kpi-alta").textContent = String(kpis.alta);
  document.getElementById("kpi-contatados").textContent = String(kpis.contatados);
  document.getElementById("kpi-interessados").textContent = String(kpis.interessados);
  document.getElementById("kpi-video").textContent = String(kpis.videochamadas);
  document.getElementById("kpi-fechados").textContent = String(kpis.fechados);
}

function filtersActive() {
  return Object.values(state.filters).some(Boolean);
}

function updateClear() {
  document.getElementById("clear").hidden = !filtersActive();
}

function updateCount(visibleCount) {
  const total = state.leads.length;
  const count = document.getElementById("count");
  count.textContent = visibleCount === total
    ? `${total} leads · alta prioridade primeiro`
    : `${visibleCount} de ${total} leads · alta prioridade primeiro`;
}

function fillSelect(select, values, placeholder) {
  const current = select.value;
  select.replaceChildren(el("option", { value: "", text: placeholder }));
  for (const value of values) select.append(el("option", { value, text: value }));
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function populateFilters() {
  fillSelect(document.getElementById("f-cidade"), uniquePlaces(state.leads), "Cidade");
  fillSelect(document.getElementById("f-segmento"), uniqueSegments(state.leads), "Segmento");
  const site = document.getElementById("f-status-site");
  const knownSite = new Set([...site.options].map((option) => option.value));
  for (const lead of state.leads) {
    if (lead.status_site && !knownSite.has(lead.status_site)) {
      site.append(el("option", { value: lead.status_site, text: siteStatusLabel(lead.status_site) }));
      knownSite.add(lead.status_site);
    }
  }
}

function clearFilters() {
  state.filters = {
    q: "",
    cidade: "",
    segmento: "",
    prioridade: "",
    status_site: "",
    status_contato: "",
  };
  document.getElementById("q").value = "";
  for (const id of ["f-cidade", "f-segmento", "f-prioridade", "f-status-site", "f-status"]) {
    document.getElementById(id).value = "";
  }
  renderList();
}

function callLink(lead, label = "Ligar") {
  const href = telHref(lead.telefone);
  if (!href) return el("button", { type: "button", class: "btn btn-call", disabled: true }, [icon("phone"), "Sem telefone"]);
  return el("a", { class: "btn btn-call", href, "data-action": "call" }, [icon("phone"), label]);
}

function waLink(lead, label = "WhatsApp") {
  const href = waHref(lead);
  if (!href) return el("button", { type: "button", class: "btn btn-wa", disabled: true }, [icon("wa"), "Sem WhatsApp"]);
  return el("a", {
    class: "btn btn-wa",
    href,
    target: "_blank",
    rel: "noopener noreferrer",
    "data-action": "whatsapp",
  }, [icon("wa"), label]);
}

function copyButton(lead, label = "Copiar") {
  if (!lead.telefone) return null;
  return el("button", { type: "button", class: "btn btn-ghost", "data-action": "copy" }, [icon("copy"), label]);
}

function igLink(lead) {
  const href = instagramUrl(lead.instagram);
  if (!href) return null;
  return el("a", {
    class: "btn btn-ghost",
    href,
    target: "_blank",
    rel: "noopener noreferrer",
    "data-action": "instagram",
  }, [icon("ig"), "Instagram"]);
}

function renderCard(lead) {
  const progress = progressOf(state.progress, lead.id);
  const owner = lead.nome_proprietario;
  const article = el("article", {
    class: `card${state.selectedId === lead.id ? " is-selected" : ""}`,
    dataset: { leadId: lead.id, prioridade: fold(lead.prioridade) || "nenhuma" },
  });
  const badges = el("div", { class: "badges" }, [
    el("span", { class: `badge prio-${fold(lead.prioridade) || "nenhuma"}`, text: priorityLabel(lead.prioridade) }),
    el("span", { class: `badge ${siteClass(lead.status_site)}`, text: siteStatusLabel(lead.status_site) }),
    isExampleLead(lead) ? el("span", { class: "badge example", text: "Exemplo" }) : null,
  ]);
  const title = owner || lead.empresa || "Lead sem nome";
  const heading = el("h2", { class: "owner" }, [
    el("button", { type: "button", class: "text-btn", "data-action": "open", text: title }),
  ]);
  article.append(badges);
  if (!owner) article.append(el("p", { class: "owner-missing", text: "Proprietário não informado" }));
  article.append(heading);
  if (owner) article.append(el("p", { class: "company", text: lead.empresa || "Empresa não informada" }));
  const bits = [lead.segmento, placeLabel(lead)].filter(Boolean);
  if (bits.length) article.append(el("p", { class: "meta", text: bits.join(" · ") }));
  if (lead.telefone) article.append(el("p", { class: "phone", text: lead.telefone }));
  const hint = [returnHint(progress), videoHint(progress)].filter(Boolean).join(" · ");
  const due = progress.status === "Retornar" && progress.retornar_em && progress.retornar_em <= todayISO();
  if (hint || progress.notas) {
    article.append(el("p", {
      class: `hint${due ? " is-due" : ""}`,
      text: [hint, progress.notas ? "Com nota" : ""].filter(Boolean).join(" · "),
    }));
  }

  const select = el("select", { "aria-label": `Status de ${title}` });
  for (const status of STATUSES) {
    const option = el("option", { value: status, text: status });
    if (status === progress.status) option.selected = true;
    select.append(option);
  }
  select.addEventListener("click", (event) => event.stopPropagation());
  select.addEventListener("change", () => setStatus(lead.id, select.value));
  article.append(el("label", { class: "status-label" }, [
    el("span", { class: "sr-only", text: "Status do contato" }),
    select,
  ]));

  const actions = el("div", { class: "card-actions" });
  [callLink(lead), waLink(lead), copyButton(lead), igLink(lead)].filter(Boolean).forEach((node) => actions.append(node));
  article.append(actions);
  return article;
}

function renderList() {
  const visible = filterLeads(state.leads, state.progress, state.filters);
  list.replaceChildren();
  if (!visible.length) {
    list.append(el("div", { class: "empty" }, [
      el("p", { text: "Nenhum lead com esses filtros." }),
      el("button", { type: "button", class: "btn btn-ghost", onClick: clearFilters, text: "Limpar filtros" }),
    ]));
  } else {
    visible.forEach((lead) => list.append(renderCard(lead)));
  }
  updateCount(visible.length);
  updateClear();
}

function fact(term, value, href) {
  if (!value) return [];
  const dd = href
    ? el("dd", {}, [el("a", { href, target: "_blank", rel: "noopener noreferrer", text: value })])
    : el("dd", { text: value });
  return [el("dt", { text: term }), dd];
}

function renderPanel() {
  panel.replaceChildren();
  const lead = selectedLead();
  if (!lead) {
    const empty = el("div", { class: "panel-empty" }, [
      el("p", { class: "eyebrow", text: "Sessão de ligações" }),
      el("h2", { class: "panel-hero", text: "Escolha um lead" }),
      el("p", { text: "O nome do dono, o telefone e o roteiro aparecem aqui." }),
      el("button", { type: "button", class: "btn btn-call", onClick: goNext, text: "Próximo lead" }),
    ]);
    panel.append(el("div", { class: "panel-body" }, [empty]));
    return;
  }

  const progress = progressOf(state.progress, lead.id);
  const who = lead.nome_proprietario || lead.empresa || "Lead";
  const bar = el("div", { class: "panel-bar" }, [
    el("div", {}, [
      el("div", { class: "sheet-handle" }),
      el("p", { class: "eyebrow", text: lead.nome_proprietario ? "Proprietário" : "Empresa" }),
      el("p", { class: "bar-name", text: who }),
    ]),
    el("button", { type: "button", class: "btn btn-ghost", onClick: closeLead, "aria-label": "Fechar detalhe" }, [icon("x"), "Fechar"]),
  ]);

  const body = el("div", { class: "panel-body" });
  body.append(el("div", { class: "badges" }, [
    el("span", { class: `badge prio-${fold(lead.prioridade) || "nenhuma"}`, text: priorityLabel(lead.prioridade) }),
    el("span", { class: `badge ${siteClass(lead.status_site)}`, text: siteStatusLabel(lead.status_site) }),
    isExampleLead(lead) ? el("span", { class: "badge example", text: "Exemplo" }) : null,
    el("span", { class: "badge tone", text: progress.status }),
  ]));
  if (!lead.nome_proprietario) body.append(el("p", { class: "owner-missing", text: "Proprietário não informado" }));
  body.append(el("h2", { id: "panel-title", class: "panel-hero", text: who }));
  if (lead.nome_proprietario && lead.empresa) body.append(el("p", { class: "company", text: lead.empresa }));
  const bits = [lead.segmento, placeLabel(lead)].filter(Boolean);
  if (bits.length) body.append(el("p", { class: "place", text: bits.join(" · ") }));
  if (lead.telefone) body.append(el("p", { class: "phone-lg", text: lead.telefone }));
  else body.append(el("p", { class: "hint", text: "Sem telefone neste lead." }));

  body.append(el("button", {
    type: "button",
    class: "btn btn-script",
    onClick: openScript,
    style: "margin-top:14px",
  }, "Roteiro de ligação"));

  const chips = STATUSES.map((status) => {
    const input = el("input", { type: "radio", name: "lead-status", value: status });
    if (status === progress.status) input.checked = true;
    input.addEventListener("change", () => {
      if (input.checked) setStatus(lead.id, status);
    });
    return el("label", { class: "chip" }, [input, el("span", { text: status })]);
  });
  body.append(el("fieldset", { class: "status-set" }, [
    el("legend", { text: "Status do contato" }),
    el("div", { class: "status-grid" }, chips),
  ]));

  const date = el("input", { type: "date", id: "retornar-em", value: progress.retornar_em });
  date.addEventListener("change", () => {
    const current = progressOf(state.progress, lead.id);
    state.progress[lead.id] = { ...current, retornar_em: date.value };
    persist();
    renderList();
  });
  body.append(el("label", { class: "field" }, [el("span", { text: "Retornar em" }), date]));

  const when = el("input", {
    type: "datetime-local",
    id: "videochamada-em",
    value: progress.videochamada_em,
  });
  when.addEventListener("change", () => {
    const current = progressOf(state.progress, lead.id);
    state.progress[lead.id] = { ...current, videochamada_em: when.value };
    persist();
    const saved = progressOf(state.progress, lead.id);
    panel.querySelectorAll(".btn-agenda").forEach((link) => {
      link.href = calendarHref(lead, saved);
    });
    renderList();
    renderKpis();
  });
  body.append(el("label", { class: "field" }, [el("span", { text: "Videochamada" }), when]));
  body.append(scheduleLink(lead));

  const shownPreview = previewUrl(lead, progress);
  const previa = el("input", {
    type: "url",
    id: "previa-url",
    inputmode: "url",
    placeholder: "https://…",
    value: shownPreview,
    autocomplete: "off",
    spellcheck: "false",
  });
  previa.addEventListener("change", () => {
    const current = progressOf(state.progress, lead.id);
    state.progress[lead.id] = { ...current, previa_url: previa.value.trim() };
    persist();
    renderPanel();
  });
  body.append(el("label", { class: "field" }, [el("span", { text: "Link da prévia" }), previa]));
  body.append(previewActions(lead, shownPreview));

  const notes = el("textarea", {
    id: "notas",
    rows: "4",
    maxlength: "4000",
    placeholder: "O que ele disse, objeção, melhor horário…",
  });
  notes.value = progress.notas;
  notes.addEventListener("input", () => {
    const current = progressOf(state.progress, lead.id);
    state.progress[lead.id] = { ...current, notas: notes.value };
    persist();
  });
  notes.addEventListener("blur", () => renderList());
  body.append(el("label", { class: "field" }, [el("span", { text: "Notas" }), notes]));

  body.append(el("p", { class: "callout", text: hookSummary(lead) }));

  const rating = [formatRating(lead.nota_google), formatReviews(lead.avaliacoes)].filter(Boolean).join(" · ");
  const facts = el("dl", { class: "facts" }, [
    ...fact("CNPJ", lead.cnpj),
    ...fact("Fonte do nome", lead.fonte_proprietario),
    ...fact("Instagram", lead.instagram, instagramUrl(lead.instagram)),
    ...fact("Facebook", lead.facebook, facebookUrl(lead.facebook)),
    ...fact("Google", rating),
    ...fact("Concorrente", lead.concorrente_no_google),
    ...fact("Observação", lead.observacao),
  ]);
  body.append(facts);

  const dock = el("div", { class: "panel-dock" });
  const grid = el("div", { class: "dock-grid" });
  const secondary = [copyButton(lead, "Copiar telefone"), igLink(lead)].filter(Boolean);
  if (secondary.length === 1) secondary[0].style.gridColumn = "1 / -1";
  [callLink(lead), waLink(lead), ...secondary].forEach((node) => grid.append(node));
  dock.append(grid);

  panel.append(bar, body, dock);
  body.scrollTop = 0;
}

function scheduleLink(lead) {
  const progress = progressOf(state.progress, lead.id);
  return el("a", {
    class: "btn btn-ghost btn-agenda",
    href: calendarHref(lead, progress),
    target: "_blank",
    rel: "noopener noreferrer",
  }, "Adicionar à agenda");
}

function previewActions(lead, url) {
  const href = safeHttpUrl(url);
  const open = href
    ? el("a", {
      class: "btn btn-ghost",
      href,
      target: "_blank",
      rel: "noopener noreferrer",
    }, "Abrir prévia")
    : el("button", { type: "button", class: "btn btn-ghost", disabled: true }, "Abrir prévia");
  const message = previewWaMessage(lead, href);
  const sendHref = waHrefText(lead.telefone, message);
  const send = sendHref
    ? el("a", {
      class: "btn btn-wa",
      href: sendHref,
      target: "_blank",
      rel: "noopener noreferrer",
    }, [icon("wa"), "Enviar prévia"])
    : el("button", { type: "button", class: "btn btn-wa", disabled: true }, [icon("wa"), "Enviar prévia"]);
  return el("div", { class: "preview-actions" }, [open, send]);
}

function followupLink(lead, text) {
  const href = waHrefText(lead.telefone, text);
  if (!href) return el("button", { type: "button", class: "btn btn-wa", disabled: true }, [icon("wa"), "Sem WhatsApp"]);
  return el("a", {
    class: "btn btn-wa",
    href,
    target: "_blank",
    rel: "noopener noreferrer",
  }, [icon("wa"), "Enviar no WhatsApp"]);
}

function renderScript() {
  document.body.classList.toggle("modal-open", state.scriptOpen);
  if (!state.scriptOpen || !selectedLead()) {
    roteiro.hidden = true;
    roteiro.inert = true;
    return;
  }
  const lead = selectedLead();
  const progress = progressOf(state.progress, lead.id);
  const shownPreview = previewUrl(lead, progress);
  const flow = buildCallFlow({ ...lead, previa_url: shownPreview });
  const stages = flow.stages;
  const previousStep = state.renderedStep;
  const previousScroll = roteiroCard.querySelector(".script-scroll")?.scrollTop || 0;
  state.scriptStep = Math.max(0, Math.min(state.scriptStep, stages.length - 1));
  const stage = stages[state.scriptStep];
  const who = lead.nome_proprietario || lead.empresa || "Lead";
  roteiro.hidden = false;
  roteiro.inert = false;
  roteiroCard.replaceChildren();

  const rail = el("div", { class: "steps", role: "tablist", "aria-label": "Etapas da ligação" });
  stages.forEach((item, index) => {
    rail.append(el("button", {
      type: "button",
      class: `step-chip${index === state.scriptStep ? " is-current" : ""}`,
      role: "tab",
      "aria-selected": index === state.scriptStep ? "true" : "false",
      onClick: () => {
        state.scriptStep = index;
        renderScript();
      },
      text: `${item.numero} ${item.titulo}`,
    }));
  });

  const head = el("div", { class: "call-head" }, [
    el("div", { class: "script-top" }, [
      el("div", {}, [
        el("p", { class: "eyebrow", text: flow.personalized ? "Modo ligação · roteiro deste lead" : "Modo ligação · roteiro padrão" }),
        el("h2", { id: "roteiro-title", class: "call-who", text: who }),
        lead.nome_proprietario && lead.empresa ? el("p", { class: "company", text: lead.empresa }) : null,
      ]),
      el("button", { type: "button", class: "btn btn-ghost", onClick: closeScript, "aria-label": "Fechar roteiro" }, [icon("x"), "Fechar"]),
    ]),
    rail,
  ]);

  const scroll = el("div", { class: "script-scroll" });
  if (state.scriptStep === 0 && flow.diagnostico.length) {
    scroll.append(el("section", { class: "seen", "aria-label": "O que vi" }, [
      el("p", { class: "eyebrow", text: "O que vi" }),
      el("ul", {}, flow.diagnostico.map((item) => el("li", { text: item }))),
    ]));
  }
  if (state.scriptStep === 0 && flow.dica) {
    scroll.append(el("p", { class: "dica", text: flow.dica }));
  }
  if (!lead.nome_proprietario && state.scriptStep === 0) {
    scroll.append(el("p", { class: "dica", text: "Nome do dono não informado. Confirme com quem você está falando." }));
  }

  scroll.append(el("p", { class: "script-count", text: `Etapa ${stage.numero} de ${stages.length}` }));
  scroll.append(el("h3", { class: "script-title", text: stage.titulo }));
  if (stage.kicker) scroll.append(el("p", { class: "script-kicker", text: stage.kicker }));

  const beats = el("div", { id: "roteiro-quote", tabindex: "-1" });
  const linhas = stage.linhas.length ? stage.linhas : ["Sem fala nesta etapa."];
  linhas.forEach((line) => beats.append(el("p", { class: "beat", text: line })));
  scroll.append(beats);

  if (stage.pausa) scroll.append(el("p", { class: "pause", text: "PAUSA: espere a resposta" }));

  if (stage.id === "fechamento" || stage.id === "agendamento") {
    scroll.append(el("div", { class: "preview-actions", style: "margin: 4px 0 16px" }, [
      scheduleLink(lead),
      ...previewActions(lead, shownPreview).childNodes,
    ]));
  }

  if (stage.ramos.length) {
    const selected = state.scriptBranches[stage.id] || "";
    const box = el("div", { class: "branch-box" });
    box.append(el("p", { class: "branch-label", text: "Se ele responder" }));
    const row = el("div", { class: "branches", role: "group", "aria-label": "Respostas possíveis" });
    stage.ramos.forEach((ramo) => {
      const on = selected === ramo.rotulo;
      row.append(el("button", {
        type: "button",
        class: `branch-chip${on ? " is-current" : ""}`,
        "aria-pressed": on ? "true" : "false",
        onClick: () => {
          state.scriptBranches[stage.id] = state.scriptBranches[stage.id] === ramo.rotulo ? "" : ramo.rotulo;
          renderScript();
        },
        text: ramo.rotulo,
      }));
    });
    box.append(row);
    const chosen = stage.ramos.find((ramo) => ramo.rotulo === selected);
    if (chosen) {
      box.append(el("div", { class: "branch-reply", "aria-live": "polite" }, chosen.linhas.map((line) => el("p", { class: "beat beat-reply", text: line }))));
    }
    scroll.append(box);
  }

  if (flow.objecoes.length) {
    const details = el("details", { class: "fold", id: "objecoes" });
    if (state.objectionsOpen) details.open = true;
    details.append(el("summary", { text: "Objeções" }));
    const list = el("div", { class: "fold-body" });
    flow.objecoes.forEach((item) => {
      list.append(el("p", { class: "objection", text: item.objecao }));
      item.linhas.forEach((line) => list.append(el("p", { class: "beat beat-reply", text: line })));
    });
    details.append(list);
    details.addEventListener("toggle", () => {
      state.objectionsOpen = details.open;
    });
    scroll.append(details);
  }

  const follow = el("details", { class: "fold" });
  follow.append(el("summary", { text: "Mensagem pós-ligação" }));
  const followBody = el("div", { class: "fold-body" });
  followBody.append(el("p", { class: "follow-text", text: flow.whatsapp }));
  followBody.append(el("div", { class: "script-actions" }, [
    el("button", {
      type: "button",
      class: "btn btn-ghost",
      onClick: () => copyText(flow.whatsapp, "Mensagem copiada."),
    }, "Copiar"),
    followupLink(lead, flow.whatsapp),
  ]));
  follow.append(followBody);
  scroll.append(follow);
  scroll.append(el("button", {
    type: "button",
    class: "btn btn-ghost copy-script",
    onClick: () => copyText(scriptPlainText(lead), "Roteiro copiado."),
  }, "Copiar roteiro"));

  const controls = el("div", { class: "script-nav" }, [
    el("button", {
      type: "button",
      class: "btn btn-ghost",
      disabled: state.scriptStep === 0,
      "data-script-nav": "prev",
      onClick: () => {
        state.scriptStep -= 1;
        renderScript();
      },
      text: "Anterior",
    }),
    el("button", {
      type: "button",
      class: "btn btn-ghost",
      "data-script-nav": "next",
      onClick: () => {
        if (state.scriptStep >= stages.length - 1) {
          state.objectionsOpen = true;
          renderScript();
          document.getElementById("objecoes")?.scrollIntoView({ block: "nearest" });
          return;
        }
        state.scriptStep += 1;
        renderScript();
      },
      text: state.scriptStep >= stages.length - 1 ? "Objeções" : "Próximo",
    }),
  ]);

  const footer = el("div", { class: "script-footer call-footer" }, [
    controls,
    callLink(lead, "Ligar"),
  ]);

  roteiroCard.append(head, scroll, footer);
  state.renderedStep = state.scriptStep;
  scroll.scrollTop = previousStep === state.scriptStep ? previousScroll : 0;
  if (previousStep !== state.scriptStep) {
    announce(`${stage.titulo}. ${linhas[0]}`);
    requestAnimationFrame(() => {
      rail.querySelector(".is-current")?.scrollIntoView({ inline: "center", block: "nearest" });
    });
  }
}

function syncSheet() {
  const mobile = isMobile();
  const open = Boolean(state.selectedId);
  panel.classList.toggle("is-open", open);
  panel.inert = mobile && !open;
  panel.setAttribute("aria-hidden", mobile && !open ? "true" : "false");
  backdrop.hidden = !(mobile && open);
  document.body.classList.toggle("sheet-open", mobile && open && !state.scriptOpen);
  document.getElementById("next-mobile").hidden = mobile && open;
}

function readRoute() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  return { leadId: params.get("lead"), roteiro: params.get("roteiro") === "1" };
}

function writeRoute(mode) {
  const params = new URLSearchParams();
  if (state.selectedId) params.set("lead", state.selectedId);
  if (state.scriptOpen) params.set("roteiro", "1");
  const hash = params.toString() ? `#${params.toString()}` : "";
  const next = `${location.pathname}${location.search}${hash}`;
  const current = `${location.pathname}${location.search}${location.hash}`;
  if (next === current || mode === "none") return;
  const update = mode === "replace" ? "replaceState" : "pushState";
  history[update]({ painel: true }, "", next);
}

function renderAll() {
  renderKpis();
  renderList();
  renderPanel();
  renderScript();
  syncSheet();
}

function applyRoute() {
  const route = readRoute();
  const exists = state.leads.some((lead) => lead.id === route.leadId);
  state.selectedId = exists ? route.leadId : null;
  state.scriptOpen = Boolean(state.selectedId && route.roteiro);
  if (!state.scriptOpen) state.scriptStep = 0;
  renderAll();
}

function openLead(id, { via = "list", historyMode } = {}) {
  if (!state.leads.some((lead) => lead.id === id)) return;
  const mode = historyMode || (isMobile() ? "push" : "replace");
  state.selectedId = id;
  state.scriptOpen = false;
  state.scriptStep = 0;
  writeRoute(mode);
  renderAll();
  const lead = selectedLead();
  if (via === "next" && lead) {
    announce(`Próximo lead: ${lead.nome_proprietario || lead.empresa}, ${placeLabel(lead)}.`);
    requestAnimationFrame(() => panel.querySelector("[data-action='call']")?.focus({ preventScroll: true }));
  }
  if (via === "next") {
    document.querySelector(`[data-lead-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function closeLead() {
  if (history.state?.painel && location.hash) {
    history.back();
    return;
  }
  state.selectedId = null;
  state.scriptOpen = false;
  writeRoute("replace");
  renderAll();
}

function openScript() {
  if (!state.selectedId) return;
  lastFocus = document.activeElement;
  state.scriptOpen = true;
  state.scriptStep = 0;
  state.scriptBranches = {};
  state.objectionsOpen = false;
  state.renderedStep = -1;
  writeRoute("push");
  renderScript();
  syncSheet();
  requestAnimationFrame(() => document.getElementById("roteiro-quote")?.focus());
}

function closeScript() {
  if (history.state?.painel && location.hash.includes("roteiro=1")) {
    history.back();
    return;
  }
  state.scriptOpen = false;
  writeRoute("replace");
  renderScript();
  syncSheet();
  if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
}

function goNext() {
  const result = nextLead(state.leads, state.progress, state.selectedId);
  if (result.reason === "none" || !result.id) {
    toast("Não há lead de alta prioridade sem contato.");
    return;
  }
  if (result.reason === "only" && result.id === state.selectedId) {
    toast("Este é o único lead de alta prioridade ainda não contatado.");
    openLead(result.id, { via: "next", historyMode: "replace" });
    return;
  }
  const visible = filterLeads(state.leads, state.progress, state.filters).some((lead) => lead.id === result.id);
  if (!visible) {
    clearFilters();
    toast("Filtros limpos para abrir o próximo lead.");
  }
  openLead(result.id, { via: "next" });
}

function setStatus(id, status) {
  const current = progressOf(state.progress, id);
  state.progress[id] = { ...current, status };
  persist();
  renderKpis();
  renderList();
  if (state.selectedId === id) {
    const radio = [...panel.querySelectorAll('input[name="lead-status"]')].find((node) => node.value === status);
    if (radio) radio.checked = true;
    const badge = panel.querySelector(".badge.tone");
    if (badge) badge.textContent = status;
  }
  if (status === "Retornar") document.getElementById("retornar-em")?.focus();
  if (status === "Videochamada marcada") document.getElementById("videochamada-em")?.focus();
}

async function copyText(text, message) {
  if (!text) {
    toast("Nada para copiar.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  toast(message);
}

function copyPhone(lead) {
  copyText(lead.telefone.trim(), "Telefone copiado.");
}

function exportBackup() {
  const backup = buildBackup(state.leads, state.progress);
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `painel-leads-backup-${todayISO()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast("Backup baixado. Guarde esse arquivo.");
}

async function importBackup(file) {
  try {
    const progress = parseBackup(JSON.parse(await file.text()));
    const count = Object.keys(progress).length;
    const ok = window.confirm(`Substituir o progresso deste aparelho pelos ${count} registros do backup?`);
    if (!ok) return;
    state.progress = progress;
    persist();
    renderAll();
    toast("Backup importado neste aparelho.");
  } catch {
    toast("Não consegui ler esse JSON de backup.");
  }
}

function visibleFocusable(container) {
  return [...container.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])")]
    .filter((node) => node.getClientRects().length > 0);
}

function trapTab(event, container) {
  const nodes = visibleFocusable(container);
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function bind() {
  document.getElementById("q").addEventListener("input", (event) => {
    state.filters.q = event.target.value;
    renderList();
  });
  const fields = [
    ["f-cidade", "cidade"],
    ["f-segmento", "segmento"],
    ["f-prioridade", "prioridade"],
    ["f-status-site", "status_site"],
    ["f-status", "status_contato"],
  ];
  for (const [id, key] of fields) {
    document.getElementById(id).addEventListener("change", (event) => {
      state.filters[key] = event.target.value;
      renderList();
    });
  }
  document.getElementById("clear").addEventListener("click", clearFilters);
  document.getElementById("export").addEventListener("click", exportBackup);
  document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-file").click());
  document.getElementById("import-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) importBackup(file);
  });
  document.getElementById("next-desktop").addEventListener("click", goNext);
  document.getElementById("next-mobile").addEventListener("click", goNext);
  backdrop.addEventListener("click", closeLead);
  roteiro.addEventListener("click", (event) => {
    if (event.target === roteiro) closeScript();
  });

  panel.addEventListener("click", (event) => {
    if (!event.target.closest("[data-action='copy']")) return;
    const lead = selectedLead();
    if (lead) copyPhone(lead);
  });

  list.addEventListener("click", (event) => {
    const card = event.target.closest("[data-lead-id]");
    if (!card) return;
    const action = event.target.closest("[data-action]");
    if (event.target.closest("a, select, textarea, input")) return;
    const id = card.dataset.leadId;
    if (action?.dataset.action === "copy") {
      event.preventDefault();
      const lead = state.leads.find((item) => item.id === id);
      if (lead) copyPhone(lead);
      return;
    }
    if (action?.dataset.action === "open" || event.target === card || event.target.closest(".badges, .company, .meta, .phone, .hint, .owner-missing")) {
      openLead(id);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (state.scriptOpen) {
        event.preventDefault();
        closeScript();
      } else if (state.selectedId && isMobile()) {
        event.preventDefault();
        closeLead();
      }
      return;
    }
    if (event.key === "Tab" && state.scriptOpen) {
      trapTab(event, roteiro);
      return;
    }
    if (event.key === "Tab" && isMobile() && state.selectedId) {
      trapTab(event, panel);
      return;
    }
    if (state.scriptOpen || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
    if (event.key === "/") {
      event.preventDefault();
      document.getElementById("q").focus();
    } else if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      goNext();
    }
  });

  window.addEventListener("popstate", applyRoute);
  window.matchMedia("(max-width: 1039px)").addEventListener("change", syncSheet);
}

async function init() {
  bind();
  state.progress = loadProgress(localStorage);
  try {
    const response = await fetch(new URL("data/leads.json", document.baseURI), { cache: "no-cache" });
    if (!response.ok) throw new Error(String(response.status));
    state.leads = normalizeLeads(extractLeadArray(await response.json()));
  } catch {
    document.getElementById("count").textContent = "Não consegui ler data/leads.json.";
    list.append(el("p", { class: "empty", text: "Confira se o arquivo data/leads.json está ao lado desta página." }));
    return;
  }
  document.getElementById("example-banner").hidden = !isExampleDataset(state.leads);
  populateFilters();
  applyRoute();
}

init();
