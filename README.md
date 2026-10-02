# Painel de ligações · Agro

Painel estático, em português, para o Marcos prospectar empresas do agro que não têm site (ou têm um site fraco / fora do ar). Abre no celular, mostra o nome do dono, liga com um toque e guarda o andamento da ligação neste aparelho.

A lista de trabalho está em `data/leads.json`. **O repositório e o site são públicos.** Telefone, CNPJ e anotação que estiverem nesse arquivo ficam visíveis para quem tiver o link. A página pede `noindex`, e isso não substitui uma lista privada.

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
| `previa_url` | texto | não | URL da prévia do site já montada |
| `diagnostico` | lista de textos | não | fatos curtos do Instagram ou do Google |
| `roteiro` | objeto | não | falas deste lead; ver abaixo |

Qualquer campo pode ficar vazio (`""` ou `null` nos números). O arquivo é uma lista JSON. Um objeto `{ "leads": [ ... ] }` também é aceito.

`diagnostico` e `roteiro` são opcionais. Sem eles, o botão **Roteiro de ligação** usa o texto padrão (abertura, gancho da perda, pergunta, escuta, fechamento e a objeção de “já recebo muita ligação disso”). Com eles, o modo ligação mostra o roteiro daquele lead.

Chaves de `roteiro`, todas opcionais:

| Chave | Tipo |
| --- | --- |
| `abertura` | texto |
| `espera_abertura` | objeto: resposta → o que falar (`sim`, `ocupado`, `quem fala?`) |
| `gancho_perda` | texto |
| `gancho_instagram` | texto; vazio ou ausente esconde a etapa Instagram |
| `pergunta_engajamento` | texto ou lista de textos |
| `escuta` | lista de textos, ou objeto resposta → continuação |
| `fechamento_leve` | texto |
| `agendamento` | texto ou lista de textos; se existir, vira a etapa “Agendar videochamada” |
| `objecoes` | lista `{ "objecao", "resposta" }` ou objeto objeção → resposta |
| `mensagem_whatsapp_followup` | texto da mensagem pós-ligação |
| `dica` | texto |

Um exemplo completo, fictício, está em [`data/sample-roteiro.json`](data/sample-roteiro.json). Esse arquivo não entra na lista de ligações.

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

No cartão, o WhatsApp abre com uma mensagem curta usando o nome do dono e a empresa. No roteiro, **Enviar no WhatsApp** usa `mensagem_whatsapp_followup` quando esse campo existe. Sem essa mensagem, o texto padrão confirma a videochamada de 15 minutos, deixa `[dia e hora]` para preencher e manda o print da busca como teaser.

O fechamento padrão oferece mostrar a prévia do site, já montada, numa chamada de vídeo de 15 minutos (amanhã cedo, umas 7h, ou depois das 17h30). As objeções padrão incluem “não tenho tempo pra reunião”, “manda por WhatsApp mesmo” e “não pedi site nenhum”. Se `roteiro.agendamento` vier preenchido, o modo ligação ganha a etapa **Agendar videochamada** depois do fechamento.

No detalhe do lead dá para marcar o status **Videochamada marcada**, escolher data e hora, e abrir **Adicionar à agenda** (evento de 15 minutos no Google Calendar, com empresa, dono e telefone). O campo **Link da prévia** começa com `previa_url` do arquivo, pode ser editado neste aparelho, e tem **Abrir prévia** e **Enviar prévia**.

O modo ligação mostra as etapas em sequência, com **PAUSA: espere a resposta** entre elas. `espera_abertura` e `escuta` em forma de objeto viram botões: ao tocar a resposta, aparece a fala seguinte. Se `concorrente_no_google` estiver vazio no roteiro padrão, o gancho fala em outras empresas da região. Sem nome do dono, a abertura padrão começa com “Oi, é o Marcos.”

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
      "retornar_em": "2026-10-03",
      "videochamada_em": "2026-10-03T07:00",
      "previa_url": "https://example.com/previa"
    }
  }
}
```

Um backup antigo, sem `videochamada_em` e sem `previa_url`, continua válido. `previa_url` só entra no backup depois de editado no painel; enquanto isso, o painel usa o valor do arquivo de leads.

Status aceitos: `Não contatado`, `Liguei - sem resposta`, `Retornar`, `Interessado`, `Videochamada marcada`, `Proposta enviada`, `Fechado`, `Sem interesse`.

Os números do topo são da lista inteira, não do filtro:

- **Contatados** — qualquer status diferente de `Não contatado`
- **Interessados** — status `Interessado`
- **Videochamadas** — status `Videochamada marcada`
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

Site: <https://marcos4213.github.io/painel-leads-agro/>

Cada push em `main` dispara o workflow **Publicar no GitHub Pages**. A origem do Pages precisa continuar em **GitHub Actions**.
