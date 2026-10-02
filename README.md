# Painel de ligações · Agro

Painel estático, em português, para o Marcos prospectar empresas do agro que não têm site (ou têm um site fraco / fora do ar). Abre no celular, mostra o nome do dono, liga com um toque e guarda o andamento da ligação neste aparelho.

Os 8 leads que vêm no repositório são **fictícios** (empresas “Exemplo”, telefone `(00) 00000-0000`). Não ligue para eles.

**Este site é público.** Não coloque telefone, CNPJ ou anotação real em `data/leads.json` se isso não puder aparecer na internet. A página pede aos buscadores para não indexar (`noindex`), mas quem tiver o link abre o painel sem senha.

## Uso no celular

1. Abra o painel e toque no lead. O nome do dono fica em destaque.
2. **Ligar** abre o discador (`tel:+55…`). **WhatsApp** abre `wa.me` com uma mensagem já preenchida. **Instagram** abre o perfil. **Copiar** copia o telefone.
3. Marque o status, a data de retorno e as notas. Isso fica no `localStorage` deste navegador.
4. **Próximo lead** pula para o próximo de **alta prioridade** que ainda está “Não contatado”.
5. **Roteiro de ligação** monta o script com o nome, o segmento, a cidade e o concorrente daquele lead.
6. **Exportar** baixa um JSON com o progresso. **Importar** devolve esse arquivo neste ou em outro aparelho. Sem o backup, trocar de celular ou limpar o navegador apaga o andamento — ele não vai para o GitHub.

Atalhos no computador: `/` busca, `N` próximo lead, `Esc` fecha o roteiro ou o detalhe.

## Trocar os leads

O painel só lê [`data/leads.json`](data/leads.json). Dá para editar o JSON direto ou gerar a partir de [`data/leads.csv`](data/leads.csv):

```bash
node scripts/csv-to-json.mjs
```

O script também aceita caminhos: `node scripts/csv-to-json.mjs entrada.csv saida.json`.

### Campos

| Campo | Tipo | Obrigatório | Exemplo |
| --- | --- | --- | --- |
| `id` | texto | recomendado | `ex-01` |
| `empresa` | texto | não | `Agropecuária Exemplo Ltda` |
| `nome_proprietario` | texto | não | `João Exemplo` |
| `fonte_proprietario` | texto | não | `EXEMPLO — dado fictício` |
| `cnpj` | texto | não | `00.000.000/0001-00` |
| `segmento` | texto | não | `Insumos agrícolas` |
| `cidade` | texto | não | `Ribeirão Preto` |
| `uf` | texto | não | `SP` |
| `telefone` | texto | não | `(00) 00000-0000` |
| `instagram` | texto | não | `@exemplo.ficticio` ou URL |
| `facebook` | texto | não | URL ou nome da página |
| `status_site` | texto | não | `sem site`, `site fora do ar` ou `site fraco` |
| `nota_google` | número ou `null` | não | `4.7` |
| `avaliacoes` | número ou `null` | não | `18` |
| `prioridade` | texto | não | `alta` ou `média` |
| `concorrente_no_google` | texto | não | `Agro Concorrente Exemplo` |
| `observacao` | texto | não | texto livre |

Qualquer campo pode ficar vazio (`""` ou `null` nos números). O arquivo é uma lista JSON. Um objeto `{ "leads": [ ... ] }` também é aceito.

O `id` amarra o progresso salvo no navegador. Se ele faltar, o painel cria um a partir do CNPJ, da empresa e da cidade. IDs repetidos ganham um sufixo.

Lista de exemplo mínima:

```json
[
  {
    "id": "ex-01",
    "empresa": "Agropecuária Exemplo Ltda",
    "nome_proprietario": "João Exemplo",
    "fonte_proprietario": "EXEMPLO — dado fictício",
    "cnpj": "00.000.000/0001-00",
    "segmento": "Insumos agrícolas",
    "cidade": "Ribeirão Preto",
    "uf": "SP",
    "telefone": "(00) 00000-0000",
    "instagram": "",
    "facebook": "",
    "status_site": "sem site",
    "nota_google": 4.7,
    "avaliacoes": 18,
    "prioridade": "alta",
    "concorrente_no_google": "Agro Concorrente Exemplo",
    "observacao": "EXEMPLO — lead fictício, não ligar."
  }
]
```

## Telefone, WhatsApp e roteiro

O número é normalizado para o Brasil:

- `(16) 99999-0000` vira `tel:+5516999990000` e `https://wa.me/5516999990000?text=…`
- Número que já vem com `55` (12 ou 13 dígitos) não ganha outro `55`.
- Zero de operadora (`016…`) é removido quando o DDD é válido.
- O telefone fictício `(00) 00000-0000` continua com DDD `00`, porque `00` não é um DDD real.

A mensagem do WhatsApp usa o nome do dono (se houver) e o nome da empresa.

O roteiro preenche abertura, gancho, pergunta, fechamento e a objeção “já recebo muita ligação disso”. Se `concorrente_no_google` estiver vazio, o gancho fala em **outras empresas da região**, em vez de “é a [concorrente]”. Sem nome do dono, a abertura começa com “Oi, é o Marcos.”

## Backup

Chave do `localStorage`: `painel-leads-agro-v1`.

O arquivo exportado tem esta forma:

```json
{
  "app": "painel-leads-agro",
  "version": 1,
  "exported_at": "2026-10-02T12:00:00.000Z",
  "progress": {
    "ex-01": {
      "status": "Retornar",
      "notas": "Pediu para ligar depois das 17h",
      "retornar_em": "2026-10-03"
    }
  }
}
```

Status aceitos: `Não contatado`, `Liguei - sem resposta`, `Retornar`, `Interessado`, `Proposta enviada`, `Fechado`, `Sem interesse`.

Os números do topo são da lista inteira, não do filtro:

- **Contatados** — qualquer status diferente de `Não contatado`
- **Interessados** — status `Interessado`
- **Fechados** — status `Fechado`

A ordem da lista é alta prioridade primeiro, mantendo a ordem do arquivo dentro de cada faixa.

## Desenvolvimento

Site estático, sem backend e sem rastreador. Fontes [Fraunces](https://github.com/undercasetype/Fraunces) e [Outfit](https://github.com/Outfitio/Outfit-Fonts), licença SIL Open Font License (texto em `fonts/`).

```bash
npm test
python3 -m http.server 4173
```

Abra `http://127.0.0.1:4173`.

## GitHub Pages

O workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publica a pasta do site a cada push na branch `main`, usando GitHub Actions.

URL esperada: <https://marcos4213.github.io/painel-leads-agro/>

O código já está em `main` e o workflow **Publicar no GitHub Pages** já rodou. Ele para no passo “Configurar Pages” com:

> Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions.

A API de Pages respondeu 403 (`Resource not accessible by integration`) para esta automação, então falta um ajuste que só o dono do repositório faz:

1. Abra [Settings → Pages](https://github.com/Marcos4213/painel-leads-agro/settings/pages).
2. Em **Build and deployment**, escolha **Source: GitHub Actions**. Salve.
3. Abra o workflow que falhou e clique em **Re-run all jobs**: [run 37014778149](https://github.com/Marcos4213/painel-leads-agro/actions/runs/37014778149).

Não é senha nem login no painel. Depois desse clique, o site passa a responder em <https://marcos4213.github.io/painel-leads-agro/>.
