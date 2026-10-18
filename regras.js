/* Regras, limites e prompts da Canção Incentiva.
   Arquivo compartilhado: usado pelo site (navegador) e pelas funções do servidor. */

export const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const fmt = n => BRL.format(Number(n) || 0);

export const fmt0 = n => BRL.format(Math.round(Number(n) || 0)).replace(/,00$/, "");

export function parseBRL(s) {
  if (typeof s === "number") return s;
  s = String(s || "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s); return isFinite(n) ? n : 0;
}

export const moneyStr = n => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export const SEG = {
  cultura: ["Música","Artes cênicas (teatro, dança, circo)","Audiovisual","Artes visuais","Literatura e livro","Patrimônio cultural","Museus e memória","Cultura popular e tradicional","Humanidades","Artes integradas"],
  esporte: ["Formação esportiva","Esporte para toda a vida","Excelência esportiva"]
};

export const LEI_NOME = { cultura: "Lei Rouanet", esporte: "Lei de Incentivo ao Esporte", naosei: "A definir" };

export const UNIDADES = ["Serviço", "Mês", "Diária", "Hora", "Cachê", "Unidade", "Pessoa", "Verba"];

export const REG_15 = ["AC","AP","AM","PA","RO","RR","TO","AL","BA","CE","MA","PB","PE","PI","RN","SE","DF","GO","MT","MS"];

export function limiteProducaoEsporte(d) {
  if (REG_15.includes(d.uf)) return 0.15;
  const s = (d.segmento || "").toLowerCase();
  if (s.includes("excel")) return 0.05;
  if (s.includes("toda a vida")) return 0.07;
  return 0.10;
}

export function categorias(lei, d) {
  if (lei === "esporte") return [
    { k: "rh", t: "Equipe (recursos humanos)", dica: "Coordenador, professores, monitores, profissionais de apoio.", sug: ["Coordenador geral", "Professor / treinador", "Monitor / estagiário", "Preparador físico", "Assistente social", "Psicólogo", "Nutricionista"] },
    { k: "mat", t: "Materiais esportivos e uniformes", dica: "Tudo que os alunos e a equipe vão usar nas atividades.", sug: ["Bolas", "Raquetes", "Redes", "Coletes", "Cones e marcadores", "Uniforme (camiseta e short)", "Kit de treino"] },
    { k: "ev", t: "Eventos, transporte e alimentação", dica: "Festivais, competições, deslocamentos e lanche.", sug: ["Transporte para competições", "Lanche dos alunos", "Inscrições em competições", "Arbitragem", "Medalhas e troféus", "Hospedagem"] },
    { k: "div", t: "Divulgação", dica: "Material gráfico, redes sociais, registro fotográfico.", sug: ["Designer gráfico", "Banner e faixas", "Impulsionamento em redes sociais", "Registro fotográfico e vídeo"] },
    { k: "adm", t: "Custos administrativos", lim: 0.15, dica: "Gestão do projeto. Limite de 15% do total.", sug: ["Coordenador administrativo-financeiro", "Contador", "Material de escritório"] },
    { k: "prod", t: "Elaboração e captação", lim: limiteProducaoEsporte(d), teto: 100000, dica: `Elaboração do projeto e captação de recursos. Limite de ${Math.round(limiteProducaoEsporte(d) * 100)}% do total, até R$ 100 mil.`, sug: ["Elaboração do projeto", "Captação de recursos"] }
  ];
  return [
    { k: "pre", t: "Pré-produção", dica: "Tudo que acontece antes: planejamento, pesquisa, ensaios, contratações.", sug: ["Coordenação de produção", "Pesquisa e roteiro", "Ensaios", "Locação de espaço para ensaio", "Direção artística"] },
    { k: "prod", t: "Produção / execução", dica: "O projeto acontecendo: artistas, técnicos, estrutura, transporte.", sug: ["Cachê de artista", "Músicos", "Técnico de som", "Técnico de luz", "Locação de som e luz", "Palco e estrutura", "Transporte", "Alimentação da equipe", "Hospedagem", "Figurino", "Cenário", "Seguro"] },
    { k: "pos", t: "Pós-produção", dica: "Depois do projeto: registro, relatórios e prestação de contas.", sug: ["Registro audiovisual", "Relatório final", "Prestação de contas", "Clipping"] },
    { k: "div", t: "Divulgação e acessibilidade comunicacional", lim: 0.20, dica: "Divulgação, material gráfico, Libras e audiodescrição na comunicação. Limite de 20% do total.", sug: ["Assessoria de imprensa", "Designer gráfico", "Impressão de material gráfico", "Impulsionamento em redes sociais", "Fotografia de divulgação", "Intérprete de Libras", "Audiodescrição"] },
    { k: "adm", t: "Custos administrativos", lim: 0.15, dica: "Gestão e contabilidade do projeto. Limite de 15% do total.", sug: ["Coordenação administrativa", "Contador", "Assessoria jurídica", "Material de escritório"] },
    { k: "capt", t: "Captação de recursos", lim: 0.10, teto: 150000, dica: "Remuneração de quem busca patrocinadores. Limite de 10% do total, até R$ 150 mil.", sug: ["Remuneração de captação de recursos"] }
  ];
}

export const itemTotal = c => (Number(c.qtd) || 0) * (Number(c.vu) || 0);

export const totalCustos = arr => (arr || []).reduce((s, c) => s + itemTotal(c), 0);

export const CONTEXTO_LEGAL = `Referências normativas (trate como base e oriente a conferir a norma vigente):
- Lei Rouanet (Lei 8.313/1991), Ministério da Cultura, protocolo no SALIC, regras da IN MinC 29/2026. Proponentes: pessoas físicas com atuação cultural comprovada, MEI e pessoas jurídicas de natureza cultural, com ou sem fins lucrativos. Projetos do art. 18 (ex.: artes cênicas, livros de valor artístico/literário/humanístico, música erudita ou instrumental, artes visuais, patrimônio, museus, acervos, audiovisual de curta e média-metragem) permitem ao incentivador abater 100%; os demais seguem o art. 26 (abatimento parcial). Exigências: acessibilidade física e de conteúdo, democratização de acesso, plano de distribuição, etapas de pré-produção, produção e pós-produção. Limites de orçamento: divulgação e comunicação acessível até 20%; custos administrativos até 15%; remuneração de captação até 10% do projeto, limitada a R$ 150 mil; cachê de artista/técnico até R$ 3.000; palestrante até R$ 5.000; valor máximo em geral de R$ 1,5 milhão por projeto (R$ 15 milhões para bienais, festivais, festas, feiras, teatro musical e ópera).
- Lei de Incentivo ao Esporte (Lei 11.438/2006, permanente pela LC 222/2025, Decreto 12.861/2026 e Portaria 10/2026), Ministério do Esporte, protocolo no SLI. Proponente: pessoa jurídica de direito privado sem fins lucrativos, de natureza esportiva, com no mínimo 1 ano de funcionamento, ou ente público. Pessoa física, MEI e empresas com fins lucrativos NÃO podem propor. Níveis: formação esportiva, esporte para toda a vida e excelência esportiva. Vedado remunerar atletas profissionais ou manter equipes profissionais. Projetos de prática regular devem ter ao menos 50% de alunos da rede pública. Custos administrativos até 15%; despesas de produção (elaboração e captação) até 10% na formação, 7% no esporte para toda a vida e 5% na excelência (15% se executado no Norte, Nordeste ou Centro-Oeste), com teto de R$ 100 mil. Orçamento com 3 cotações por item.
- Limites para o incentivador em 2026: empresa no Lucro Real até 3,6% do IRPJ devido na cultura e 1,8% no esporte (redução de 10% dos limites pela LC 224/2025); pessoa física: 6% na cultura e 7% no esporte.`;

export function respostasTexto(d) {
  const ns = (k, v, pad) => d.naosei?.[k] ? "não sabe (estimar)" : (v || pad);
  const custos = Array.isArray(d.custos) ? d.custos : [];
  const plan = custos.length ? `\nPlanilha de custos informada (${custos.length} itens, total ${fmt(totalCustos(custos))}):\n` + custos.slice(0, 60).map(c => `- [${c.cat}] ${c.item}: ${c.qtd} ${c.un} x ${fmt(c.vu)} = ${fmt(itemTotal(c))}`).join("\n") : "";
  const valor = parseBRL(d.valor) ? fmt(parseBRL(d.valor)) : custos.length ? `${fmt(totalCustos(custos))} (total da planilha)` : "não sabe (estimar um valor adequado ao porte)";
  return `Lei pretendida: ${LEI_NOME[d.lei] || "não sabe"}
Tipo de proponente: ${d.tipo}
Tempo de CNPJ: ${d.tempo || "não informado"}
Local do proponente: ${d.cidade}/${d.uf}
Experiência anterior: ${d.experiencia || "não informada"}
Nome provisório: ${d.titulo}
Área/manifestação: ${d.segmento || "não sabe"}
Descrição da ideia: ${d.descricao}
Público-alvo: ${d.publico || "não informado"}
Pessoas atendidas (estimativa): ${ns("beneficiarios", d.beneficiarios, "não informado")}
Local de realização: ${ns("local", d.local, "não informado")}
Período previsto: ${ns("periodo", d.periodo, "não informado")}
Valor total estimado: ${valor}
Produtos, ações e quantidades: ${d.produtos || "não informados"}
Funcionamento/atividades: ${d.atividades || "não informadas"}
Equipe: ${d.equipe || "não informada"}
Currículos do proponente e participantes: ${d.curriculos || "não informados"}
Acessibilidade: ${d.acesso || "não informada"}
Acesso do público (gratuidade/ingresso): ${ns("ingresso", d.ingresso, "não informado")}
Possíveis patrocinadores: ${d.patrocinio || "não informados"}${plan}`;
}

export function promptDiagnostico(d) {
  return `Você é consultor sênior da Canção Consultoria Cultural e Esportiva, especialista em projetos para a Lei Rouanet e a Lei de Incentivo ao Esporte. Faça um DIAGNÓSTICO GRATUITO de enquadramento do projeto abaixo, em português do Brasil, com linguagem simples e direta para quem nunca protocolou um projeto.

${CONTEXTO_LEGAL}

Respostas do proponente:
${respostasTexto(d)}

Responda SOMENTE com um objeto JSON neste formato:
{"lei":"cultura"|"esporte","lei_nome":"string","enquadramento":"string (área/segmento ou manifestação e, na cultura, se tende ao art. 18 ou 26)","situacao":"apto"|"ajustes"|"inapto","situacao_texto":"1-2 frases explicando","titulo_sugerido":"string","resumo":"parágrafo de 4-6 linhas descrevendo o projeto de forma técnica","pontos_fortes":["..."],"pontos_de_atencao":["..."],"orcamento":{"minimo":number,"maximo":number,"comentario":"string"},"documentos":["documentos e certidões que o proponente deve reunir"],"proximos_passos":["..."]}
Regras: se o proponente não puder propor na lei escolhida (ex.: pessoa física ou empresa com fins lucrativos no esporte, CNPJ com menos de 1 ano no esporte), marque "inapto" ou "ajustes" e explique a alternativa (outra lei, parceria com instituição apta). Se a lei for "Ainda não sei", escolha a mais adequada. Valores de orçamento em reais, números sem formatação. No máximo 5 itens por lista.`;
}

export const CAMPOS = {
  cultura: [
    { k: "resumo", t: "Resumo da proposta cultural", q: "O QUÊ?", lim: 1000, g: "Descreva o objetivo do projeto de forma concisa, apresentando com clareza os produtos que compõem a proposta, com quantidades, público e local. Texto corrido, sem listas." },
    { k: "objetivos", t: "Objetivos", q: "PARA QUÊ? · QUAIS? QUANTOS?", lim: 8000, g: "Separe explicitamente em 'OBJETIVO GERAL' (qual o principal resultado que o projeto pretende alcançar e sua finalidade, em um parágrafo) e 'OBJETIVOS ESPECÍFICOS' (todas as ações que serão realizadas, ou seja, os produtos específicos oferecidos à população, numerados, cada um mensurável, com quantidades, público, local e forma de comprovação na prestação de contas)." },
    { k: "justificativa", t: "Justificativa", q: "POR QUE A LEI DE INCENTIVO À CULTURA?", lim: 8000, g: "Destaque a necessidade do mecanismo de Incentivo a Projetos Culturais (mecenato) para financiar o projeto; indique expressamente em quais incisos do Art. 1º da Lei 8.313/1991 o projeto se enquadra, explicando cada um; e quais objetivos (alíneas) do Art. 3º da mesma lei serão alcançados. Contextualize o território, o público e a relevância cultural, com dados quando possível." },
    { k: "acessibilidade", t: "Acessibilidade", q: "FÍSICA E DE CONTEÚDO", lim: 8000, g: "Duas partes identificadas: 'ACESSIBILIDADE FÍSICA' (facilitadores de locomoção no espaço físico: rampas, banheiros adaptados, guias e pisos táteis, assentos e espaços reservados, estacionamento, acompanhamento) e 'ACESSIBILIDADE DE CONTEÚDO' (medidas para compreensão do projeto: Libras, Braille, audiodescrição, legenda descritiva, visita sensorial, linguagem simples), aplicadas a cada produto." },
    { k: "democratizacao", t: "Democratização de acesso", q: "COMO O PÚBLICO ACESSA?", lim: 8000, g: "Descreva a forma de distribuição e comercialização de cada produto da proposta (gratuidade, ingressos a preço popular, cotas, distribuição de exemplares) e outras medidas de ampliação de acesso, como ensaio aberto, oficinas paralelas, transmissão pela internet, ações em escolas e comunidades." },
    { k: "etapas", t: "Etapas de trabalho", q: "QUANDO E COMO?", lim: 8000, g: "Divida em 'PRÉ-PRODUÇÃO', 'EXECUÇÃO' e 'PÓS-PRODUÇÃO', estimando a duração de cada etapa em dias, semanas ou meses e detalhando as atividades de cada uma, incluindo relatórios e prestação de contas na pós-produção." },
    { k: "ficha", t: "Ficha técnica", q: "QUEM FAZ?", lim: 8000, g: "Descreva com detalhes qual atividade, mesmo que voluntária, o dirigente ou a instituição proponente realizará no projeto. Depois apresente o currículo resumido dos principais participantes (função no projeto e trajetória). Use somente nomes informados; para funções sem nome, descreva o perfil exigido e marque [NOME A DEFINIR]." },
    { k: "sinopse", t: "Sinopse da obra", q: "SOBRE O QUE É?", lim: 8000, g: "Apresente o conteúdo de todos os produtos que precisam de breve resumo (seminários, palestras, livros, espetáculos de circo, teatro, dança, shows, performances, oficinas): tema, repertório ou roteiro, abordagem e a classificação indicativa etária de cada um." },
    { k: "especificacoes", t: "Especificações técnicas do produto", q: "COMO É FEITO?", lim: 8000, g: "Detalhamento técnico de todos os produtos: duração, número de apresentações ou turmas, carga horária, material, equipamentos de som, luz e palco, paginação e tiragem se houver publicação, formato se audiovisual, e o projeto pedagógico das ações formativas." },
    { k: "atividade", t: "Descrição da atividade do produto", q: "O QUE MAIS ACONTECE?", lim: 8000, g: "Detalhes da atividade cultural que não foram mencionados nos campos anteriores, como a programação do evento (datas previstas, horários, sequência das ações, locais), a dinâmica de funcionamento e a interação com o público." },
    { k: "outras", t: "Outras informações", q: "O QUE MAIS É RELEVANTE?", lim: 8000, g: "Informações complementares significativas para a avaliação da proposta e não abordadas nos campos anteriores: histórico e capacidade do proponente, parcerias e apoios, impacto econômico local (empregos diretos e indiretos), plano de divulgação, sustentabilidade, contrapartidas sociais e alinhamento às políticas culturais." }
  ],
  esporte: [
    { k: "objeto", t: "Objeto do projeto", q: "O QUÊ?", lim: 800, g: "Descreva objetivamente o que o projeto vai executar: manifestação desportiva, modalidade, número de beneficiários, núcleos e turmas, local e período de execução de 8 meses." },
    { k: "objetivos", t: "Descrição dos objetivos", q: "PARA QUÊ?", lim: 800, g: "Objetivo geral em uma frase, seguido dos principais objetivos específicos, curtos e mensuráveis." },
    { k: "metodologia", t: "Descrição da metodologia", q: "COMO?", lim: 8000, g: "Detalhe como o projeto será executado ao longo dos 8 meses: divulgação, inscrição e seleção dos beneficiários (reserva de vagas para alunos de escola pública quando aplicável), estrutura de núcleos e turmas, faixas etárias, frequência e carga horária semanal, conteúdos e fundamentos por fase, planejamento pedagógico, equipe e atribuições, materiais e uniformes, festivais ou competições, controle de frequência e desempenho, avaliação, comunicação e prestação de contas. Pode usar subtítulos em maiúsculas." },
    { k: "justificativa", t: "Descrição da justificativa", q: "POR QUÊ?", lim: 8000, g: "Explique a necessidade do projeto: diagnóstico do território e do público, dados sociais e esportivos, benefícios do esporte para saúde, educação e inclusão, alinhamento com a Lei 11.438/2006 (LC 222/2025) e com a manifestação desportiva escolhida, capacidade técnica da proponente e por que o incentivo fiscal é essencial para viabilizar a execução." }
  ]
};

export const PERIODO_ESPORTE = "8 meses";

export const META_LIM = 400;

export const alvo = lim => ({ min: Math.round(lim * 0.93), max: Math.floor(lim * 0.99), palavras: Math.round(lim / 6.3) });

export const cnt = s => [...String(s || "")].length;

export function leiDoProjeto(r) {
  const g = r.diagnostico?.lei;
  if (g === "cultura" || g === "esporte") return g;
  return r.respostas?.lei === "esporte" ? "esporte" : "cultura";
}

export function nomeProjeto(r) { const p = r.projeto; return (p?.nomes && p.nomes[p.nomeEscolhido || 0]) || r.titulo; }

export function limpar(t, titulo) {
  let s = String(t || "").replace(/\r/g, "").replace(/\*\*/g, "").replace(/^#{1,6}\s*/gm, "").replace(/^```\w*\s*$/gm, "").trim();
  const first = s.split("\n")[0].replace(/[:\s]+$/, "").trim().toLowerCase();
  if (titulo && first && first.length < 80 && (first === titulo.toLowerCase() || first.startsWith(titulo.toLowerCase()))) s = s.split("\n").slice(1).join("\n").trim();
  return s.replace(/\n{3,}/g, "\n\n");
}

export function cortar(t, lim) {
  const arr = [...String(t || "")];
  if (arr.length <= lim) return t;
  const s = arr.slice(0, lim).join("");
  const cut = Math.max(s.lastIndexOf(". "), s.lastIndexOf(".\n"), s.endsWith(".") ? s.length - 1 : -1, s.lastIndexOf("\n"));
  if (cut > lim * 0.85) return s.slice(0, cut + 1).trimEnd();
  const sp = s.lastIndexOf(" ");
  return (sp > lim * 0.9 ? s.slice(0, sp) : s).trimEnd();
}

export function sistemaAlvo(lei) { return lei === "cultura" ? "proposta cultural no SALIC (Lei Rouanet, Ministério da Cultura)" : "projeto no Sistema de Lei de Incentivo – SLI (Ministério do Esporte)"; }

export function contextoBase(r) {
  return `${CONTEXTO_LEGAL}

Respostas do proponente:
${respostasTexto(r.respostas)}

Diagnóstico de enquadramento já feito:
${JSON.stringify(r.diagnostico || {})}${r.projeto?.plano ? `

PLANO-BASE DO PROJETO (use exatamente estes produtos, quantidades, prazos, locais e nomes, para que todos os campos fiquem coerentes entre si):
${JSON.stringify(r.projeto.plano)}` : ""}`;
}

export function promptPlano(r, lei) {
  const esp = lei === "esporte";
  return `Você é consultor sênior da Canção Consultoria Cultural e Esportiva. Antes de redigir a ${sistemaAlvo(lei)}, monte o PLANO-BASE que dará coerência a todos os campos do projeto.

${contextoBase(r)}

Responda SOMENTE com um objeto JSON:
{"nomes":["5 sugestões de nome do projeto, criativas, curtas e adequadas ao sistema"],
 ${esp ? `"manifestacao":"desporto educacional|participação|rendimento|formação","modalidades":["..."],"periodo":"8 meses","beneficiarios":number,"faixa_etaria":"...","nucleos":[{"local":"...","turmas":number,"alunos_por_turma":number,"dias_horarios":"..."}],"carga_horaria_semanal":"...","equipe":[{"funcao":"...","nome":"nome informado ou [NOME A DEFINIR]","atribuicoes":"..."}],"materiais":["..."],"eventos":["festivais/competições previstos"],"fases":[{"meses":"1-2","foco":"..."}]` :
  `"segmento":"...","artigo":"18 ou 26","produtos":[{"nome":"...","tipo":"show/espetáculo/oficina/livro/...","quantidade":number,"duracao":"...","publico_estimado":number,"acesso":"gratuito ou preço popular R$ ...","classificacao":"Livre/10/12/14/16/18"}],"locais":["..."],"publico_total":number,"etapas":{"pre_producao":"duração","execucao":"duração","pos_producao":"duração"},"equipe":[{"funcao":"...","nome":"nome informado ou [NOME A DEFINIR]","atividade":"..."}],"acessibilidade":["medidas previstas"],"medidas_ampliacao":["ensaio aberto, oficinas, transmissão..."]`}}
Use os dados informados pelo proponente; complete lacunas com propostas realistas para o valor estimado de ${fmt(parseBRL(r.respostas?.valor))}. Não invente nomes de pessoas.`;
}

export function promptCampo(r, lei, f) {
  const a = alvo(f.lim);
  return `Você é consultor sênior da Canção Consultoria Cultural e Esportiva e está redigindo o campo "${f.t}" da ${sistemaAlvo(lei)}.
Pergunta-chave do campo: ${f.q}
Orientação oficial do campo: ${f.g}
Nome do projeto: ${nomeProjeto(r)}${lei === "esporte" ? `\nPeríodo de execução previsto: ${PERIODO_ESPORTE}.` : ""}

${contextoBase(r)}

TAMANHO: o campo aceita no máximo ${f.lim} caracteres, contando espaços e quebras de linha. Escreva entre ${a.min} e ${a.max} caracteres, cerca de ${a.palavras} palavras, usando o espaço quase todo com conteúdo substantivo e específico, sem enrolação nem repetição.
FORMATO: texto puro para colar direto no sistema. Não repita o nome do campo no início. Não use Markdown (nada de #, ** ou tabelas). Subtítulos em MAIÚSCULAS e listas com "- " ou numeração são permitidos. Português do Brasil, linguagem técnica e clara. Não invente nomes de pessoas, CNPJs ou números oficiais: quando faltar, escreva [PREENCHER: o que falta].
Responda somente com o texto do campo.`;
}

export function promptAjuste(f, texto, a, lei) {
  const n = cnt(texto);
  return `O texto abaixo é o campo "${f.t}" de uma ${sistemaAlvo(lei)}. Ele tem ${n} caracteres, mas precisa ter entre ${a.min} e ${a.max} caracteres (limite máximo do sistema: ${f.lim}, contando espaços).
${n < a.min ? `Reescreva-o AMPLIANDO com conteúdo substantivo e específico (detalhes das ações, dados, prazos, público, resultados), sem repetir ideias, até cerca de ${a.palavras} palavras.` : `Reescreva-o de forma mais enxuta, mantendo as informações essenciais.`}
Mantenha o formato: texto puro, sem Markdown, sem título. Responda somente com o novo texto.

TEXTO:
${texto}`;
}

export function promptMetas(r) {
  const a = alvo(META_LIM);
  return `Você é consultor sênior da Canção Consultoria Cultural e Esportiva e está preenchendo as METAS do projeto "${nomeProjeto(r)}" no Sistema de Lei de Incentivo – SLI do Ministério do Esporte (período de execução: ${PERIODO_ESPORTE}).

${contextoBase(r)}

Crie 3 METAS QUALITATIVAS (não numéricas, mas medidas por indicadores numéricos, percentuais ou, excepcionalmente, situacionais) e 3 METAS QUANTITATIVAS (numéricas e diretamente mensuráveis por indicadores numéricos ou percentuais). Para cada meta, escreva a meta, o indicador e o instrumento de verificação (documentos e evidências que comprovam: listas de frequência, fichas de avaliação, relatórios, fotos e vídeos, questionários, súmulas etc.).
TAMANHO: cada um dos textos (meta, indicador, instrumento) deve ter entre ${a.min} e ${a.max} caracteres (limite ${META_LIM}), cerca de ${a.palavras} palavras. Texto puro, sem Markdown.
Responda SOMENTE com JSON:
{"qualitativas":[{"meta":"...","indicador":"...","instrumento":"..."},{...},{...}],"quantitativas":[{"meta":"...","indicador":"...","instrumento":"..."},{...},{...}]}`;
}

export function promptAjusteMetas(m) {
  const a = alvo(META_LIM);
  const tam = JSON.stringify(Object.fromEntries(["qualitativas", "quantitativas"].map(g => [g, (m[g] || []).map(x => ({ meta: cnt(x.meta), indicador: cnt(x.indicador), instrumento: cnt(x.instrumento) }))])));
  return `Estas são as metas de um projeto no SLI do Ministério do Esporte. Cada texto (meta, indicador, instrumento) precisa ter entre ${a.min} e ${a.max} caracteres, contando espaços (limite ${META_LIM}). Tamanhos atuais: ${tam}.
Reescreva os que estão fora da faixa, ampliando com detalhes concretos os curtos e enxugando os longos; mantenha os que já estão na faixa. Texto puro, sem Markdown.
Responda SOMENTE com o JSON completo no mesmo formato:
${JSON.stringify(m)}`;
}

export function metasFora(m) {
  const a = alvo(META_LIM); let fora = false;
  ["qualitativas", "quantitativas"].forEach(g => (m[g] || []).forEach(x => ["meta", "indicador", "instrumento"].forEach(k => { const n = cnt(x[k]); if (n < a.min * 0.9 || n > META_LIM) fora = true; })));
  return fora;
}

export function normMetas(m) {
  const out = {};
  ["qualitativas", "quantitativas"].forEach(g => {
    out[g] = (Array.isArray(m?.[g]) ? m[g] : []).slice(0, 3).map(x => ({ meta: cortar(limpar(x?.meta), META_LIM), indicador: cortar(limpar(x?.indicador), META_LIM), instrumento: cortar(limpar(x?.instrumento), META_LIM) }));
  });
  return out;
}

/* ---- Planilha sugerida pela IA ---- */
export function promptPlanilha(d) {
  const lei = d.lei === "esporte" ? "esporte" : "cultura";
  const cats = categorias(lei, d);
  return `Você é consultor sênior da Canção Consultoria Cultural e Esportiva. Monte uma PLANILHA DE CUSTOS realista para o projeto abaixo, na ${lei === "cultura" ? "Lei Rouanet" : "Lei de Incentivo ao Esporte"}, com valores de mercado de ${d.cidade || "cidade média"}/${d.uf || "BR"} em ${new Date().getFullYear()}.

${CONTEXTO_LEGAL}

Respostas do proponente:
${respostasTexto(d)}

Categorias permitidas (use a chave em "cat"):
${cats.map(c => `- ${c.k}: ${c.t}${c.lim ? ` (máximo ${Math.round(c.lim * 100)}% do total${c.teto ? `, até R$ ${c.teto.toLocaleString("pt-BR")}` : ""})` : ""}`).join("\n")}
Unidades permitidas: ${UNIDADES.join(", ")}.
${parseBRL(d.valor) ? `O total deve ficar próximo de ${fmt(parseBRL(d.valor))}.` : "O proponente não sabe o valor: dimensione um orçamento adequado ao porte descrito."}
Respeite os limites percentuais de cada categoria. Entre 12 e 30 itens.
Responda SOMENTE com JSON: {"itens":[{"cat":"chave","item":"descrição curta","un":"unidade","qtd":number,"vu":number,"obs":"como chegou ao valor, em até 12 palavras"}]}`;
}

/* ---- Leitura tolerante de JSON vindo da IA ---- */
export function lerJSON(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch {}
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) { try { return JSON.parse(f[1]); } catch {} }
  const a = Math.min(...["{", "["].map(c => t.indexOf(c)).filter(i => i >= 0));
  const b = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (isFinite(a) && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch {} }
  return null;
}
