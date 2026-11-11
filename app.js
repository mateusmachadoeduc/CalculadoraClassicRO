/*
 * RO Classic Calc — interface nova (v2)
 * ------------------------------------------------------------------
 * O cálculo é 100% o motor original do rocalc.com (arquivos *_2026-04-06.js,
 * sem modificações). Esta camada:
 *   1) lê as opções dos campos originais (escondidos em #legacy),
 *   2) mostra tudo numa interface nova (personagem → alvo → simulação),
 *   3) grava as escolhas nos campos originais e dispara o mesmo "onchange",
 *   4) lê os resultados que o motor escreveu e redesenha a tela.
 */
(() => {
  'use strict';

  const c = document.calcForm;
  const app = document.getElementById('app');

  /* ================================================================ utils */
  const el = (name) => {
    const e = c.elements.namedItem(name);
    if (!e) return document.getElementById(name);
    if (typeof RadioNodeList !== 'undefined' && e instanceof RadioNodeList) return e[0];
    return e;
  };
  const byId = (id) => document.getElementById(id);
  const txt = (id) => { const e = byId(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const htm = (id) => { const e = byId(id); return e ? e.innerHTML : ''; };
  const opts = (name) => { const e = el(name); return e && e.options ? Array.from(e.options).map((o) => ({ v: o.value, t: o.text, d: o.disabled })) : []; };
  const selText = (name) => { const e = el(name); return e && e.selectedIndex >= 0 && e.options[e.selectedIndex] ? e.options[e.selectedIndex].text : ''; };
  const val = (name) => { const e = el(name); return e ? e.value : ''; };
  const num = (s) => { const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
  const fmt = (n) => (isFinite(n) ? Math.round(n).toLocaleString('pt-BR') : '—');
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const stripTags = (s) => String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      e.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return e;
  }
  function mono(s) {
    const w = String(s || '?').replace(/[\[\]()*]/g, ' ').trim().split(/\s+/).filter(Boolean);
    return ((w[0] || '?')[0] + (w[1] ? w[1][0] : (w[0] || '')[1] || '')).toUpperCase();
  }

  /* ============================================================ traduções */
  const PT = window.RO_PT || { item: {}, card: {}, mob: {}, skill: {} };
  const IM = window.ROCALC_IDMAP || { item: {}, mob: {}, card: {}, skill: {} };

  // sufixos que a calc usa para diferenciar variantes: "[3]", "(iRO)", "[Axe]"...
  const splitSuffix = (en) => { const m = String(en).match(/^(.*?)((?:\s*[\[(][^\])]*[\])])*)\s*$/); return m ? [m[1], m[2]] : [en, '']; };
  function ptItem(v, en) { const p = PT.item[v]; if (!p) return en; return p + splitSuffix(en)[1]; }
  function ptCard(v, en) { const p = PT.card[v]; if (!p) return en; return p.replace(/^Carta\s+/i, ''); }
  function ptMob(v, en) { const p = PT.mob[v]; if (!p) return en; const s = splitSuffix(en)[1]; return p + (s && !p.includes(s.trim()) ? s : ''); }
  function ptSkill(idx, en) { return PT.skill[idx] || en; }

  const JOB_PT = ['Aprendiz', 'Espadachim', 'Gatuno', 'Noviço', 'Arqueiro', 'Mago', 'Mercador', 'Cavaleiro', 'Mercenário', 'Sacerdote', 'Caçador', 'Bruxo', 'Ferreiro', 'Templário', 'Arruaceiro', 'Monge', 'Bardo', 'Odalisca', 'Sábio', 'Alquimista', 'Superaprendiz', 'Lorde', 'Algoz', 'Sumo Sacerdote', 'Atirador de Elite', 'Arquimago', 'Mestre-Ferreiro', 'Paladino', 'Desordeiro', 'Mestre', 'Menestrel', 'Cigana', 'Professor', 'Criador', 'Aprendiz T.', 'Espadachim T.', 'Gatuno T.', 'Noviço T.', 'Arqueiro T.', 'Mago T.', 'Mercador T.', 'Taekwon', 'Mestre Taekwon', 'Espiritualista', 'Ninja', 'Justiceiro'];
  const jobName = (j) => JOB_PT[j] || (window.JobName && JobName[j]) || '—';
  // sprites (bROWiki) — casal masculino/feminino
  const SPR = { 0: '4/4f/Aprendizessprite.png', 1: '0/02/Espadachinssprite.png', 2: 'f/f7/Gatunossprite.png', 3: '1/11/Novi%C3%A7ossprite.png', 4: '5/59/Arqueirossprite.png', 5: '3/3c/Magossprite.png', 6: 'c/c2/Mercadoressprite.png', 7: 'a/a9/Cavaleirossprite.png', 8: '7/79/Mercen%C3%A1riossprite.png', 9: '4/4e/Sacerdotessprite.png', 10: 'b/b5/Ca%C3%A7adoressprite.png', 11: '7/7c/Bruxossprite.png', 12: 'c/c9/Ferreirossprite.png', 13: '3/3c/Templ%C3%A1riossprite.png', 14: '0/08/Arruaceirossprite.png', 15: 'e/e2/Mongessprite.png', 16: '5/5a/Bardossprite.png', 17: '9/9f/Odaliscassprite.png', 18: 'e/e3/S%C3%A1biossprite.png', 19: 'c/c0/Alquimistassprite.png', 20: 'b/ba/Superaprendizessprite.png', 21: '9/9d/Lordessprite.png', 22: 'e/e0/Algozessprite.png', 23: '4/45/Sumo_Sacerdotessprite.png', 24: 'd/d2/Atiradores_de_Elitesprite.png', 25: '5/5a/Arquimagossprite.png', 26: 'f/f5/Mestres-Ferreirossprite.png', 27: '3/35/Paladinossprite.png', 28: '9/95/Desordeirossprite.png', 29: '2/22/Mestressprite.png', 30: 'e/e2/Menestr%C3%A9issprite.png', 31: 'd/d5/Ciganassprite.png', 32: 'b/ba/Professoressprite.png', 33: '6/6a/Criadoressprite.png', 34: '2/27/AprendizeTssprite.png', 41: 'a/ab/Taekwonssprite.png', 42: '3/36/Mestres_Taekwonssprite.png', 43: '7/75/Espiritualistassprite.png', 44: 'f/f1/Ninjassprite.png', 45: '6/61/Justiceirossprite.png' };
  for (let j = 35; j <= 40; j++) SPR[j] = SPR[j - 34];
  const sprite = (j) => (SPR[j] ? 'https://media.browiki.org/' + SPR[j] : null);

  const FAMILIES = [
    { t: 'Aprendizes', icon: '✦', rows: [[0, [20], []], [34, [], []]] },
    { t: 'Espadachins', icon: '⚔', rows: [[1, [7, 13], [21, 27]], [35, [], []]] },
    { t: 'Magos', icon: '✸', rows: [[5, [11, 18], [25, 32]], [39, [], []]] },
    { t: 'Arqueiros', icon: '➶', rows: [[4, [10, 16, 17], [24, 30, 31]], [38, [], []]] },
    { t: 'Gatunos', icon: '🗡', rows: [[2, [8, 14], [22, 28]], [36, [], []]] },
    { t: 'Noviços', icon: '✚', rows: [[3, [9, 15], [23, 29]], [37, [], []]] },
    { t: 'Mercadores', icon: '⚒', rows: [[6, [12, 19], [26, 33]], [40, [], []]] },
    { t: 'Expandidas', icon: '☯', rows: [[41, [42, 43], []], [44, [], []], [45, [], []]] },
  ];
  const familyOf = (j) => FAMILIES.findIndex((f) => f.rows.some((r) => r[0] === j || r[1].includes(j) || r[2].includes(j)));
  const FAMILY_CLS = ['t-nov', 't-sword', 't-mage', 't-arch', 't-thief', 't-aco', 't-merc', 't-ext'];
  const jobTree = (j) => FAMILY_CLS[familyOf(j)] || 't-nov';

  // textos fixos dos selects do motor
  const OPT_PT = {
    '(no card)': '(sem carta)', '(unchanged)': '(sem alteração)', '(no arrow)': '(sem munição)', '(card shortcuts)': '(atalhos de cartas)',
    '(enchant)': '(sem encantamento)', '(headgear Hidden Slot Enchant)': '(sem encantamento)', 'Basic Attack': 'Ataque básico',
    'Melee (4 or less cells away)': 'Corpo a corpo (até 4 células)', 'Long Range (5 or more cells away)': 'À distância (5+ células)',
    'All Regions': 'Todas as regiões', 'Alphabetical': 'Alfabética', 'By attribute': 'Por elemento', 'By race': 'Por raça', 'By size': 'Por tamanho',
    'By 100%Hit': 'Por HIT p/ 100%', 'By 95%Flee': 'Por FLEE p/ 95%', 'By BaseExp': 'Por EXP base', 'By JobExp': 'Por EXP classe', 'By MaxATK': 'Por ATK máx.',
    'By DEF': 'Por DEF', 'By MDEF': 'Por MDEF', 'By Type': 'Por tipo', 'off': 'desligado', 'on': 'ligado', '(no Peco)': '(sem Peco)',
    'WoE / BG': 'WoE / BG', 'Guild Dungeon': 'Calabouço de clã', 'URDR Server': 'Servidor URDR', 'iRO (classic)': 'iRO (classic)', 'Private (classic)': 'Privado (classic)',
  };
  const TERM = {
    Neutral: 'Neutro', Water: 'Água', Earth: 'Terra', Fire: 'Fogo', Wind: 'Vento', Poison: 'Veneno', Holy: 'Sagrado', Shadow: 'Sombrio', Ghost: 'Fantasma', Undead: 'Maldito',
    Formless: 'Amorfo', Brute: 'Bruto', Plant: 'Planta', Insect: 'Inseto', Fish: 'Peixe', Demon: 'Demônio', 'Demi-Human': 'Humanoide', Angel: 'Anjo', Dragon: 'Dragão',
    Small: 'Pequeno', Medium: 'Médio', Large: 'Grande', Boss: 'Chefe', Normal: 'Normal', Guardian: 'Guardião', 'Normal/Boss/Guardian': 'Normal/Chefe/Guardião',
    Stun: 'Atordoamento', Curse: 'Maldição', Blind: 'Cegueira', Freeze: 'Congelamento', Silence: 'Silêncio', Stone: 'Petrificação', Sleep: 'Sono', Chaos: 'Confusão', Bleeding: 'Sangramento',
    'Armor Break': 'Quebrar armadura', Orc: 'Orc',
  };
  const RACE_EN = ['Formless', 'Undead', 'Brute', 'Plant', 'Insect', 'Fish', 'Demon', 'Demi-Human', 'Angel', 'Dragon'];
  const tr = (s) => TERM[s] || s;
  let SKILL_EN2PT = null;
  function skillEn2Pt() {
    if (SKILL_EN2PT) return SKILL_EN2PT;
    SKILL_EN2PT = {};
    if (window.m_Skill) for (const s of m_Skill) if (s && PT.skill[s[0]]) { SKILL_EN2PT[s[2]] = PT.skill[s[0]]; if (s[3]) SKILL_EN2PT[s[3]] = PT.skill[s[0]]; }
    return SKILL_EN2PT;
  }
  const trBracket = (x) => { const k = x.replace(/Alt\. name:.*$/, ''); return TERM[k] || skillEn2Pt()[k] || k; };
  // frases das descrições de efeitos (Item_Setumei). Aplica no HTML com cuidado.
  const PHR = [
    [/Unrefinable/g, 'Não refinável'], [/Unbreakable \(except when upgrading\)/g, 'Inquebrável (exceto ao refinar)'],
    [/All Stats/g, 'Todos os atributos'], [/Perfect Dodge/g, 'Esquiva perfeita'], [/Perfect HIT/g, 'Acerto perfeito'],
    [/Critical damage/g, 'Dano crítico'], [/Casting Time/g, 'Tempo de conjuração'], [/All skills' After-cast Delay/g, 'Pós-conjuração de todas as habilidades'],
    [/SP Recovery Rate/g, 'Regeneração de SP'], [/HP Recovery Rate/g, 'Regeneração de HP'], [/Movement Speed/g, 'Velocidade de movimento'],
    [/\(doesn't stack with Increase AGI\)/g, '(não acumula com Aumentar Agilidade)'],
    [/Upper, Mid, and Low Headgear/g, 'Ocupa topo, meio e baixo'], [/Upper and Mid Headgear/g, 'Ocupa topo e meio'], [/Mid and Low Headgear/g, 'Ocupa meio e baixo'], [/Upper and Low Headgear/g, 'Ocupa topo e baixo'],
    [/Two-Handed Staff/g, 'Cajado de duas mãos'], [/(\w+) Element Weapon/g, (m, e) => `Arma de elemento ${tr(e)}`], [/Armor becomes (\w+) element\./g, (m, e) => `A armadura se torna de elemento ${tr(e)}.`],
    [/Enchanteable at Mora \(available at \[Additional Enchants\]\)/g, 'Encantável em Mora (veja "Encantamentos adicionais")'],
    [/\(Warning: \+MATK bonus are not implemented at Pre-Renewal\.\)/g, '(Aviso: bônus de +MATK não existe no pré-renewal.)'],
    [/Deal\s+([+-]?\d+%) ATK based damage against \[([^\]]+)\] (race|element|size|type) monsters\./g, (m, n, x, k) => `Dano físico ${n} contra monstros ${k === 'race' ? 'da raça' : k === 'element' ? 'de elemento' : k === 'size' ? 'de tamanho' : 'do tipo'} [${tr(x)}].`],
    [/Deal\s+([+-]?\d+%) MATK based damage against \[([^\]]+)\] (race|element|size|type) monsters\./g, (m, n, x, k) => `Dano mágico ${n} contra monstros ${k === 'race' ? 'da raça' : k === 'element' ? 'de elemento' : k === 'size' ? 'de tamanho' : 'do tipo'} [${tr(x)}].`],
    [/Deal\s+([+-]?\d+%) ranged ATK based damage\./g, 'Dano físico à distância $1.'],
    [/\[([^\]]+)\] race resistance\s+([+-]?\d+%)/g, (m, x, n) => `Resistência à raça [${tr(x)}] ${n}`],
    [/\[([^\]]+)\] element resistance\s*([+-]?\d+%)/g, (m, x, n) => `Resistência ao elemento [${tr(x)}] ${n}`],
    [/Status effect \[([^\]]+)\] resistance\s*([+-]?\d+%)/g, (m, x, n) => `Resistência a [${tr(x)}] ${n}`],
    [/On \[([^\]]+)\] race monsters, ignore ([+-]?\d+%) (M?DEF)/g, (m, x, n, d) => `Ignora ${n} da ${d} de monstros da raça [${tr(x)}]`],
    [/Completely ignore defense of \[([^\]]+)\] race monsters\./g, (m, x) => `Ignora toda a DEF de monstros da raça [${tr(x)}].`],
    [/Receive\s+([+-]?\d+%) damage from \[([^\]]+)\] type monsters\./g, (m, n, x) => `Recebe ${n} de dano de monstros do tipo [${tr(x)}].`],
    [/Receive\s+([+-]?\d+%) damage from ATK and MATK based ranged attacks\./g, 'Recebe $1 de dano de ataques à distância.'],
    [/Decrease damage from \[([^\]]+)\] size monsters by ([+-]?\d+%)/g, (m, x, n) => `Reduz ${n} do dano de monstros de tamanho [${tr(x)}]`],
    [/Reflect melee ATK based damage by ([+-]?\d+%)/g, 'Reflete $1 do dano físico corpo a corpo'],
    [/Receive\s+([+-]?\d+%) experience from killing \[([^\]]+)\] race monsters\./g, (m, n, x) => `EXP ${n} ao derrotar monstros da raça [${tr(x)}].`],
    [/When attacking, ([+-]?\d+%) chance to cause \[([^\]]+)\] on your target\./g, (m, n, x) => `Ao atacar, ${n} de chance de causar [${tr(x)}] no alvo.`],
    [/When performing an ATK based attack, ([+-]?\d+%) chance to cast \[/g, 'Ao realizar ataques físicos, $1 de chance de conjurar ['],
    [/When receiving ATK based damage, ([+-]?\d+%) chance to cast \[/g, 'Ao receber dano físico, $1 de chance de conjurar ['],
    [/Enables the use of \[/g, 'Permite usar ['], [/\] Lvl (\d+)/g, '] Nv. $1'],
    [/\] skill damage ([+-]?\d+%)/g, '] dano da habilidade $1'], [/\] skill Casting Time ([+-]?\d+%)/g, '] tempo de conjuração $1'],
    [/Your \[([^\]]+)\] effectiveness/g, (m, x) => `Eficácia de [${trBracket(x)}]`], [/Received \[([^\]]+)\] effectiveness/g, (m, x) => `Eficácia recebida de [${trBracket(x)}]`],
    [/CRIT ([+-]?\d+) against \[([^\]]+)\] race monsters\./g, (m, n, x) => `CRIT ${n} contra monstros da raça [${tr(x)}].`],
    [/Reduces your defence to/g, 'Reduz sua defesa para'], [/Bypass your target's defence \[not on Boss type\]/g, 'Ignora a defesa do alvo [exceto Chefes]'],
    [/Your damage depends on your target's VIT and DEF/g, 'O dano depende da VIT e DEF do alvo'],
    [/When equipping (.*?) at the same time:/g, 'Equipado junto com $1:'], [/ or<BR>/gi, ' ou<br>'],
    [/\[Refine Rate (\d+)~(\d+)\]/g, '[Refino $1~$2]'], [/\[Refine Rate (\d+)\]/g, '[Refino $1]'],
    [/Special Effect: \[([^\]]+)\] can be activated under 'Additional Effects' at 'BUFF, ITEMS AND OTHER STUFF'/g, 'Efeito especial [$1]: ative em "Comidas, poções & outros itens"'],
  ];
  function trDesc(html) {
    if (!html) return html;
    let s = String(html);
    for (const [re, rep] of PHR) s = s.replace(re, rep);
    // nomes entre colchetes que sobraram (raças, elementos, habilidades)
    s = s.replace(/\[([A-Z][A-Za-z' \-/]+?)\]/g, (m, x) => '[' + trBracket(x) + ']');
    return s;
  }
  const trOpt = (t) => {
    if (OPT_PT[t]) return OPT_PT[t];
    let m = t.match(/^Lvl (\d+)$/); if (m) return 'Nv. ' + m[1];
    m = t.match(/^(.*) Lvl (\d+)$/); if (m) return (skillEn2Pt()[m[1]] || m[1]) + ' Nv. ' + m[2];
    if (skillEn2Pt()[t]) return skillEn2Pt()[t];
    return t;
  };

  /* =============================================================== imagens */
  const DP = 'https://static.divine-pride.net/images/';
  const img = {
    itemIcon: (v) => (IM.item[v] ? `${DP}items/item/${IM.item[v]}.png` : null),
    itemArt: (v) => (IM.item[v] ? `${DP}items/collection/${IM.item[v]}.png` : null),
    cardArt: (v) => (IM.card[v] ? `${DP}items/cards/${IM.card[v]}.png` : null),
    mob: (v) => (IM.mob[v] ? `${DP}mobs/png/${IM.mob[v]}.png` : null),
    skill: (officialId) => (officialId ? `${DP}skills/${officialId}.png` : null),
    skillE: (engIdx) => (IM.skill && IM.skill[engIdx] ? `${DP}skills/${IM.skill[engIdx]}.png` : null),
  };
  function pic(src, label, cls) {
    const w = h('span', { class: 'pic ' + (cls || '') }, h('span', { class: 'pic-fb' }, mono(label)));
    if (src) {
      const i = h('img', { src, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
      i.addEventListener('load', () => w.classList.add('ok'));
      i.addEventListener('error', () => i.remove());
      w.append(i);
    }
    return w;
  }

  /* ================================================= ciclo de atualização */
  const updaters = [];
  const onUpdate = (f) => { updaters.push(f); return f; };
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      for (const f of updaters) { try { f(); } catch (e) { console.error('[ui]', e); } }
    });
  }
  function safeCalc() { try { window.calc(); } catch (e) { console.warn('[motor]', e); } }
  function commit(name, value, opts2) {
    const e = el(name);
    if (!e) return;
    if (e.type === 'checkbox') {
      if (e.checked !== !!value) e.click();
    } else {
      e.value = String(value);
      e.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (!(opts2 && opts2.noCalc)) safeCalc();
    schedule();
    autosave();
  }
  c.addEventListener('change', () => { schedule(); autosave(); });
  c.addEventListener('keyup', (e) => { if (e.target.closest('.legacy-panel')) { schedule(); autosave(); } });
  c.addEventListener('click', (e) => { if (e.target.closest('.legacy-panel')) setTimeout(schedule, 0); });

  /* ======================================================== salvar no link */
  let saveTimer = null, booting = true;
  function silentURLOUT() {
    const realAlert = window.alert;
    const hadOwn = Object.prototype.hasOwnProperty.call(navigator, 'clipboard');
    window.alert = () => {};
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true }); } catch (e) { /* ok */ }
    try { window.URLOUT(); } catch (e) { console.warn('[save]', e); } finally {
      window.alert = realAlert;
      if (!hadOwn) { try { delete navigator.clipboard; } catch (e) { /* ok */ } }
    }
  }
  function autosave() {
    if (booting) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      silentURLOUT();
      try { localStorage.setItem('roclassic:last', location.hash); } catch (e) { /* ok */ }
    }, 700);
  }

  /* ================================================================ toasts */
  const toastBox = h('div', { class: 'toasts' });
  document.body.append(toastBox);
  function toast(msg, kind) {
    const t = h('div', { class: 'toast ' + (kind || '') }, msg);
    toastBox.append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  /* ======================================================= descrições */
  function effects(arr, start) {
    const saved = window.CBIstr;
    window.CBIstr = '';
    try { for (let i = start; arr[i] != 0 && arr[i] != null; i += 2) window.Item_Setumei(arr[i], arr[i + 1]); } catch (e) { /* ok */ }
    const s = window.CBIstr;
    window.CBIstr = saved;
    return s;
  }
  function itemDesc(id) {
    const it = window.m_Item && m_Item[id];
    if (!it) return '';
    let s = effects(it, 11);
    if (it[10] != 0) s += it[10] + '<br>';
    return trDesc(s);
  }
  function cardDesc(id) {
    const cd = window.m_Card && m_Card[id];
    if (!cd) return '';
    let s = effects(cd, 4);
    if (cd[3] != 0) s += cd[3] + '<br>';
    return trDesc(s);
  }
  function itemMeta(id) {
    const it = window.m_Item && m_Item[id];
    if (!it || !id || id == 0) return '';
    const parts = [];
    if (it[1] < 50) { parts.push(`ATK ${it[3]}`); parts.push(`Nv. arma ${it[4]}`); } else if (it[3]) parts.push(`DEF ${it[3]}`);
    parts.push(`Peso ${it[6]}`);
    if (it[7]) parts.push(`Nv. ${it[7]}+`);
    return parts.join(' · ');
  }
  function itemSlots(id) {
    const it = window.m_Item && m_Item[id];
    if (!it) return 0;
    let s = it[5];
    if (typeof s === 'string') s = s.split('/')[1];
    return +s || 0;
  }

  /* ================================================================ modal */
  const modal = h('div', { class: 'modal', hidden: true });
  document.body.append(modal);
  let onClose = null;
  function closePicker() { modal.hidden = true; modal.innerHTML = ''; document.body.classList.remove('noscroll'); const f = onClose; onClose = null; if (f) f(); }
  modal.addEventListener('click', (e) => { if (e.target === modal) closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closePicker(); });
  function openModal(box, after) { modal.innerHTML = ''; modal.append(box); modal.hidden = false; document.body.classList.add('noscroll'); onClose = after || null; }

  function openPicker({ title, items, current, onPick, layout = 'list', placeholder = 'Buscar…', extra, after }) {
    const list = h('div', { class: 'pick-list ' + layout });
    const detail = h('div', { class: 'pick-detail' });
    const search = h('input', { class: 'pick-search', type: 'search', placeholder, autocomplete: 'off', spellcheck: 'false' });
    const count = h('span', { class: 'pick-count' });
    const box = h('div', { class: 'pick' + (layout === 'list' ? ' with-detail' : '') },
      h('div', { class: 'pick-head' }, h('h3', null, title), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fechar', onclick: closePicker }, '✕')),
      h('div', { class: 'pick-tools' }, search, count, extra || null),
      h('div', { class: 'pick-body' }, list, layout === 'list' ? detail : null));
    openModal(box, after);
    const rows = items.map((it) => {
      const row = h('button', {
        type: 'button', class: 'pick-row' + (String(it.v) === String(current) ? ' is-sel' : '') + (it.d ? ' dis' : ''),
        disabled: it.d || null, title: it.tip || null,
        onclick: () => { closePicker(); onPick(it.v, it); },
      },
      layout === 'cards'
        ? [pic(it.img, it.t, 'card-art'), h('span', { class: 'pr-name' }, it.t)]
        : [it.img !== undefined ? pic(it.img, it.t, 'icon') : null, h('span', { class: 'pr-txt' }, h('span', { class: 'pr-name' }, it.t), it.sub ? h('span', { class: 'pr-sub' }, it.sub) : null)]);
      if (layout === 'list') {
        const show = () => {
          detail.innerHTML = '';
          detail.append(...[it.art ? pic(it.art, it.t, 'art') : null, h('h4', null, it.t), it.en && it.en !== it.t ? h('p', { class: 'muted' }, it.en) : null,
            it.sub ? h('p', { class: 'muted' }, it.sub) : null,
            h('div', { class: 'desc', html: (it.desc && it.desc()) || '<span class="muted">Sem efeitos adicionais.</span>' })].filter(Boolean));
        };
        row.addEventListener('mouseenter', show);
        row.addEventListener('focus', show);
      }
      row._key = norm(it.t + ' ' + (it.en || '') + ' ' + (it.sub || '') + ' ' + (it.k || ''));
      list.append(row);
      return row;
    });
    const filter = () => {
      const q = norm(search.value).split(/\s+/).filter(Boolean);
      let n = 0;
      for (const r of rows) { const ok = q.every((w) => r._key.includes(w)); r.hidden = !ok; if (ok) n++; }
      count.textContent = `${n} itens`;
    };
    search.addEventListener('input', filter);
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const r = rows.find((x) => !x.hidden && !x.disabled); if (r) r.click(); } });
    filter();
    setTimeout(() => {
      search.focus();
      const s = rows.find((r) => r.classList.contains('is-sel'));
      if (s) { s.scrollIntoView({ block: 'center' }); if (layout === 'list') s.dispatchEvent(new Event('mouseenter')); }
    }, 30);
  }

  /* ====================================================== espelhos */
  function mirrorSelect(name, cls, mapText) {
    const s = h('select', { class: 'sel ' + (cls || ''), 'data-mirror': name });
    s.addEventListener('change', () => commit(name, s.value));
    let sig = '';
    onUpdate(() => {
      const src = el(name);
      if (!src) { s.hidden = true; return; }
      const o = opts(name);
      const ns = o.map((x) => x.v + '\u0001' + x.t + (x.d ? '!' : '')).join('\u0002');
      if (ns !== sig) {
        sig = ns;
        s.innerHTML = '';
        for (const x of o) s.append(h('option', { value: x.v, disabled: x.d || null }, (mapText || trOpt)(x.t, x.v)));
      }
      s.value = src.value;
      s.disabled = src.disabled;
      s.hidden = src.style.visibility === 'hidden' || src.style.display === 'none';
    });
    return s;
  }
  function mirrorCheck(name, label, hint) {
    const i = h('input', { type: 'checkbox' });
    i.addEventListener('change', () => commit(name, i.checked));
    onUpdate(() => { const src = el(name); if (src) { i.checked = src.checked; i.disabled = src.disabled; } });
    return h('label', { class: 'check', title: hint || null }, i, h('span', null, label));
  }
  function mirrorOut(id, wrap, tx) {
    const s = h(wrap || 'span', { class: 'out' });
    onUpdate(() => { s.innerHTML = tx ? tx(htm(id)) : htm(id); });
    return s;
  }
  function adopt(node, cls) {
    if (!node) return h('div', { class: 'muted' }, '—');
    node.classList.add('legacy-panel');
    if (cls) node.classList.add(cls);
    return node;
  }
  const tableOf = (id) => { const e = byId(id); return e ? e.closest('table') : null; };

  /* ================================================================ LAYOUT */
  app.innerHTML = '';
  const STEPS = [
    { id: 'char', n: 1, t: 'Personagem', s: 'Classe, atributos, equipamentos' },
    { id: 'skills', n: 2, t: 'Habilidades', s: 'Árvore de habilidades' },
    { id: 'target', n: 3, t: 'Alvo', s: 'Monstro ou jogador' },
    { id: 'sim', n: 4, t: 'Simulação', s: 'Dano e resultados' },
  ];
  const views = {};
  const stepBtns = {};
  const header = h('header', { class: 'topbar' },
    h('div', { class: 'brand' },
      h('div', { class: 'logo' }, h('span', null, 'RO')),
      h('div', null, h('div', { class: 'brand-t' }, 'RO Classic Calc'), h('div', { class: 'brand-s' }, 'Pré-Renewal · motor rocalc.com'))),
    h('nav', { class: 'steps' }, STEPS.map((s) => (stepBtns[s.id] = h('button', { type: 'button', class: 'step', onclick: () => go(s.id) },
      h('span', { class: 'step-n' }, s.n), h('span', { class: 'step-t' }, h('b', null, s.t), h('small', null, s.s)))))),
    h('div', { class: 'top-actions' },
      h('button', { type: 'button', class: 'btn ghost', onclick: shareLink, title: 'Copiar link com a build' }, '🔗 Link'),
      h('button', { type: 'button', class: 'btn ghost', onclick: openSettings, title: 'Configurações, salvar e carregar' }, '⚙ Opções')));
  const main = h('main', { class: 'views' });
  const side = h('aside', { class: 'summary' });
  app.append(header, h('div', { class: 'shell' }, main, side));
  function go(id) {
    for (const s of STEPS) { views[s.id].hidden = s.id !== id; stepBtns[s.id].classList.toggle('on', s.id === id); }
    try { sessionStorage.setItem('roclassic:view', id); } catch (e) { /* ok */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    schedule();
  }
  const card = (title, kids, cls, right) => h('section', { class: 'card ' + (cls || '') },
    title ? h('div', { class: 'card-h' }, h('h2', null, title), right || null) : null,
    h('div', { class: 'card-b' }, kids));
  const acc = (title, node, open) => h('details', { class: 'acc', open: open || null }, h('summary', null, title), h('div', { class: 'acc-b' }, adopt(node)));

  /* ============================================================ PERSONAGEM */
  const vChar = views.char = h('div', { class: 'view' });

  function pickJob() {
    const cur = +val('A_JOB');
    const box = h('div', { class: 'pick jobs-modal' },
      h('div', { class: 'pick-head' }, h('h3', null, 'Escolha a classe'), h('button', { type: 'button', class: 'icon-btn', onclick: closePicker }, '✕')));
    const tabs = h('div', { class: 'fam-tabs' });
    const body = h('div', { class: 'fam-body' });
    const jobBtn = (j) => h('button', { type: 'button', class: 'job-card ' + jobTree(j) + (j === cur ? ' is-sel' : ''), onclick: () => { closePicker(); if (j !== cur) { commit('A_JOB', j); toast(`Classe: ${jobName(j)} — o motor resetou equipamentos e atributos.`); } } },
      h('span', { class: 'jc-spr' }, pic(sprite(j), jobName(j), 'sprite')), h('b', null, jobName(j)));
    const showFam = (fi) => {
      tabs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i === fi));
      body.innerHTML = '';
      const f = FAMILIES[fi];
      body.append(h('div', { class: 'fam-grid' },
        h('div', { class: 'fam-h' }, '1ª classe'), h('div', { class: 'fam-h' }, '2ª classe'), h('div', { class: 'fam-h' }, 'Transclasse'),
        f.rows.map((r) => [h('div', { class: 'fam-cell' }, jobBtn(r[0])), h('div', { class: 'fam-cell' + (r[1].length ? '' : ' empty') }, r[1].map(jobBtn)), h('div', { class: 'fam-cell' + (r[2].length ? '' : ' empty') }, r[2].map(jobBtn))])));
    };
    FAMILIES.forEach((f, i) => tabs.append(h('button', { type: 'button', onclick: () => showFam(i) }, h('span', { class: 'fam-ico' }, f.icon), f.t)));
    box.append(tabs, body);
    openModal(box);
    showFam(Math.max(0, familyOf(cur)));
  }

  const lvl = (name, label) => {
    const inp = h('input', { type: 'number', class: 'num', inputmode: 'numeric' });
    const apply = () => {
      const o = opts(name).map((x) => +x.v);
      if (!o.length) return;
      let v = Math.round(+inp.value || o[0]);
      v = Math.max(Math.min(v, Math.max(...o)), Math.min(...o));
      commit(name, v);
    };
    inp.addEventListener('change', apply);
    onUpdate(() => { if (document.activeElement !== inp) inp.value = val(name); const o = opts(name).map((x) => +x.v); if (o.length) { inp.min = Math.min(...o); inp.max = Math.max(...o); } });
    return h('label', { class: 'field' }, h('span', null, label), inp);
  };

  const jobPick = h('button', { type: 'button', class: 'job-pick', onclick: pickJob });
  onUpdate(() => {
    const j = +val('A_JOB');
    jobPick.innerHTML = '';
    jobPick.append(h('span', { class: 'emblem ' + jobTree(j) }, pic(sprite(j), jobName(j), 'sprite sm')),
      h('span', { class: 'job-txt' }, h('small', null, 'Classe'), h('b', null, jobName(j))), h('span', { class: 'chev' }, 'trocar ▾'));
  });
  const classCard = card('Classe & Nível', [
    jobPick,
    h('div', { class: 'row gap' }, lvl('A_BaseLV', 'Nível de base'), lvl('A_JobLV', 'Nível de classe')),
    h('div', { class: 'row gap wrap' },
      mirrorCheck('BLVauto', 'Ajustar nível pelos atributos', 'O motor sobe o nível de base sozinho para caber os pontos gastos'),
      mirrorCheck('A_adopted', 'Adotado (Baby)')),
    h('div', { class: 'kv-row' },
      h('div', null, h('small', null, 'Raça & Tamanho'), mirrorOut('A_BodySIZE', 'span', (s) => s.replace(/Demi-Human/, 'Humanoide').replace(/Medium/, 'Médio').replace(/Small/, 'Pequeno').replace(/Large/, 'Grande').replace('&amp;', '·'))),
      h('div', null, h('small', null, 'Elemento do corpo'), mirrorOut('A_BodyELEMENT', 'span', (s) => s.replace(/>(\w+)</, (m, e) => '>' + tr(e) + '<')))),
  ], 'c-class');

  // atributos
  const STATS = [['A_STR', 'STR'], ['A_AGI', 'AGI'], ['A_VIT', 'VIT'], ['A_INT', 'INT'], ['A_DEX', 'DEX'], ['A_LUK', 'LUK']];
  const statRows = STATS.map(([name, label]) => {
    const range = h('input', { type: 'range', class: 'range', min: 1, max: 99 });
    const inp = h('input', { type: 'number', class: 'num sm', inputmode: 'numeric' });
    const bonus = h('span', { class: 'bonus' });
    const set = (v) => {
      const o = opts(name).map((x) => +x.v);
      v = Math.max(Math.min(Math.round(+v || 1), Math.max(...o)), Math.min(...o));
      commit(name, v);
    };
    const paint = () => range.style.setProperty('--p', ((range.value - range.min) / (range.max - range.min)) * 100 + '%');
    range.addEventListener('input', () => { inp.value = range.value; paint(); });
    range.addEventListener('change', () => set(range.value));
    inp.addEventListener('change', () => set(inp.value));
    const step = (d) => h('button', { type: 'button', class: 'step-btn', onclick: () => set(+val(name) + d) }, d > 0 ? '+' : '−');
    onUpdate(() => {
      const o = opts(name).map((x) => +x.v);
      if (o.length) { range.min = Math.min(...o); range.max = Math.max(...o); }
      const v = val(name);
      if (document.activeElement !== inp) inp.value = v;
      range.value = v;
      paint();
      const b = txt(name + 'p').replace(/\s/g, '');
      bonus.textContent = b && b !== '+0' ? b : '';
    });
    return h('div', { class: 'stat' }, h('b', { class: 'stat-l' }, label), step(-1), range, step(1), inp, bonus);
  });
  const ptsOut = h('span', { class: 'pts' });
  onUpdate(() => { const p = num(txt('A_STPOINT')); ptsOut.textContent = isFinite(p) ? p : '—'; ptsOut.classList.toggle('neg', p < 0); });
  const statsCard = card('Atributos', [h('div', { class: 'stats' }, statRows)], 'c-stats', h('div', { class: 'pts-box' }, h('small', null, 'Pontos restantes'), ptsOut));

  const DERIVED = [
    ['A_ATK2', 'ATK'], ['A_RealATK', 'ATK real'], ['A_MATK', 'MATK'], ['A_HIT', 'HIT'], ['A_CRI', 'Crítico'], ['A_ASPD', 'ASPD'],
    ['A_MaxHP', 'HP máx.'], ['A_MaxSP', 'SP máx.'], ['A_totalDEF', 'DEF'], ['A_MDEF', 'MDEF'], ['A_RealMDEF', 'MDEF real'], ['A_FLEE', 'Esquiva'],
    ['A_LUCKY', 'Esquiva perfeita'], ['A_PefHIT', 'Acerto perfeito'], ['A_CRITSHIELD', 'Escudo crítico'], ['A_WoeFLEE', 'Esquiva WoE'],
    ['A_HPR', 'Regen. HP'], ['A_SPR', 'Regen. SP'], ['A_cTime', 'Conjuração'], ['A_cDelay', 'Pós-conjuração'], ['A_MovSPEED', 'Velocidade'], ['A_Weight', 'Peso máx.'],
  ];
  const derivedCard = card('Status', [h('div', { class: 'derived' }, DERIVED.map(([id, l]) => h('div', { class: 'dv' }, h('small', null, l), mirrorOut(id, 'b'))))], 'c-derived');

  /* ------------------------------------------------- janela de equipamentos */
  const SLOTS = {
    head1: { l: 'Topo', item: 'A_head1', ref: 'A_HEAD_REFINE', cards: ['A_head1_card'], extra: ['A_HSE_HEAD1'], ico: '⛑' },
    head2: { l: 'Meio', item: 'A_head2', cards: ['A_head2_card'], ico: '👓' },
    head3: { l: 'Baixo', item: 'A_head3', ico: '😶' },
    body: { l: 'Armadura', item: 'A_body', ref: 'A_BODY_REFINE', cards: ['A_body_card'], extra: ['A_HSE'], ico: '🛡' },
    weapon: { l: 'Arma', item: 'A_weapon1', ref: 'A_Weapon_refine', cards: ['A_weapon1_card1', 'A_weapon1_card2', 'A_weapon1_card3', 'A_weapon1_card4'], extra: ['A_Weapon_element', 'A_Arrow', 'A_cardshort'], ico: '⚔' },
    weapon2: { l: 'Mão esquerda', item: 'A_weapon2', ref: 'A_Weapon2_refine', cards: ['A_weapon2_card1', 'A_weapon2_card2', 'A_weapon2_card3', 'A_weapon2_card4'], extra: ['A_cardshortLeft'], ico: '🗡' },
    shield: { l: 'Escudo', item: 'A_left', ref: 'A_LEFT_REFINE', cards: ['A_left_card'], ico: '🛡' },
    garment: { l: 'Capa', item: 'A_shoulder', ref: 'A_SHOULDER_REFINE', cards: ['A_shoulder_card'], ico: '🧥' },
    shoes: { l: 'Calçado', item: 'A_shoes', ref: 'A_SHOES_REFINE', cards: ['A_shoes_card'], ico: '👢' },
    acc1: { l: 'Acessório 1', item: 'A_acces1', cards: ['A_acces1_card'], ico: '💍' },
    acc2: { l: 'Acessório 2', item: 'A_acces2', cards: ['A_acces2_card'], ico: '💍' },
  };
  const LEFT = ['head1', 'head3', 'weapon', 'garment', 'acc1'];
  const RIGHT = ['head2', 'body', 'shield', 'shoes', 'acc2'];
  const EXTRA_LABEL = { A_Weapon_element: 'Elemento da arma', A_Arrow: 'Munição', A_cardshort: 'Atalho de cartas', A_cardshortLeft: 'Atalho de cartas', A_HSE: 'Encantamento', A_HSE_HEAD1: 'Encantamento' };
  const isEmptyName = (t) => /^\(.*\)$/.test(String(t).trim());
  const slotKeyFor = (k) => (k === 'shield' && el('A_weapon2') ? 'weapon2' : k);

  function pickItem(key) {
    const slot = SLOTS[key];
    openPicker({
      title: `${slot.l} — escolher item`, current: val(slot.item), placeholder: 'Buscar por nome (PT ou EN) ou efeito…',
      items: opts(slot.item).map((o) => {
        const t = isEmptyName(o.t) ? '(vazio)' : ptItem(o.v, o.t);
        return { ...o, t, en: o.t, img: isEmptyName(o.t) ? null : img.itemIcon(o.v), art: img.itemArt(o.v), sub: itemMeta(o.v) + (itemSlots(o.v) ? ` · ${itemSlots(o.v)} slot(s)` : ''), desc: () => itemDesc(o.v) };
      }),
      onPick: (v) => { commit(slot.item, v); activeSlot = key; schedule(); },
    });
  }
  function pickCard(name, slotLabel) {
    openPicker({
      title: `Carta — ${slotLabel}`, layout: 'cards', current: val(name), placeholder: 'Buscar carta (PT ou EN) ou efeito…', extra: h('span', { class: 'muted small' }, 'Arte: divine-pride.net'),
      items: opts(name).map((o) => {
        const t = o.v == 0 ? '(sem carta)' : ptCard(o.v, o.t);
        const d = o.v == 0 ? '' : cardDesc(o.v);
        return { ...o, t, en: o.t, img: o.v == 0 ? null : img.cardArt(o.v), k: stripTags(d), tip: (t !== o.t ? t + ' (' + o.t + ')' : t) + (d ? '\n' + stripTags(d) : '') };
      }),
      onPick: (v) => commit(name, v),
    });
  }

  let activeSlot = 'weapon';
  const eqButtons = {};
  function eqButton(key) {
    const b = h('button', { type: 'button', class: 'eq-slot' });
    b.addEventListener('click', () => {
      const k = slotKeyFor(key);
      activeSlot = k;
      schedule();
      const src = el(SLOTS[k].item);
      if (src && !src.disabled && isEmptyName(selText(SLOTS[k].item))) pickItem(k);
    });
    let sig = '';
    onUpdate(() => {
      const k = slotKeyFor(key);
      const slot = SLOTS[k];
      const src = el(slot.item);
      b.hidden = !src;
      if (!src) return;
      const v = src.value;
      const en = selText(slot.item);
      const empty = isEmptyName(en);
      const ref = slot.ref && el(slot.ref) && !el(slot.ref).disabled ? +val(slot.ref) : 0;
      const cards = (slot.cards || []).map(el).filter((x) => x && !x.disabled).map((x) => x.value);
      const s2 = [k, v, ref, cards.join(','), src.disabled, activeSlot === k].join('|');
      if (s2 === sig) return;
      sig = s2;
      b.className = 'eq-slot' + (empty ? ' empty' : '') + (src.disabled ? ' locked' : '') + (activeSlot === k ? ' is-active' : '');
      b.innerHTML = '';
      b.append(
        h('span', { class: 'eq-ico' }, empty ? h('span', { class: 'eq-ph' }, slot.ico) : pic(img.itemIcon(v), en, 'icon')),
        h('span', { class: 'eq-txt' },
          h('small', null, slot.l),
          h('b', null, empty ? '—' : (ref ? `+${ref} ` : '') + ptItem(v, en)),
          cards.length ? h('span', { class: 'eq-dots' }, cards.map((cv) => h('i', { class: cv != 0 ? 'on' : '' }))) : null));
    });
    eqButtons[key] = b;
    return b;
  }
  const eqCenter = h('div', { class: 'eq-center' });
  onUpdate(() => {
    const j = +val('A_JOB');
    if (eqCenter.dataset.j === String(j)) return;
    eqCenter.dataset.j = j;
    eqCenter.innerHTML = '';
    eqCenter.append(h('div', { class: 'eq-stage' }, pic(sprite(j), jobName(j), 'sprite big')), h('div', { class: 'eq-name' }, jobName(j)));
  });
  const eqWin = h('div', { class: 'eqwin' },
    h('div', { class: 'eq-col' }, LEFT.map(eqButton)), eqCenter, h('div', { class: 'eq-col' }, RIGHT.map(eqButton)));

  // painel de detalhes do slot ativo
  function slotDetail(key) {
    const slot = SLOTS[key];
    const box = h('div', { class: 'slot-detail' });
    const head = h('button', { type: 'button', class: 'slot-item', onclick: () => pickItem(key) });
    const ref = slot.ref ? mirrorSelect(slot.ref, 'refine', (t) => t) : null;
    const sockets = h('div', { class: 'sockets' });
    const extras = (slot.extra || []).map((n) => h('label', { class: 'mini-field x-' + n }, h('small', null, EXTRA_LABEL[n] || n), mirrorSelect(n)));
    const desc = h('div', { class: 'slot-desc' });
    box.append(...[
      h('div', { class: 'slot-top' }, h('span', { class: 'slot-l' }, slot.l), ref ? h('label', { class: 'ref-wrap' }, h('small', null, 'Refino'), ref) : null),
      head, sockets, extras.length ? h('div', { class: 'slot-extras' }, extras) : null, desc].filter(Boolean));
    let lastItem = null, lastCards = '';
    onUpdate(() => {
      box.hidden = activeSlot !== key;
      const src = el(slot.item);
      if (!src || box.hidden) return;
      const v = src.value;
      const en = selText(slot.item);
      const empty = isEmptyName(en);
      if (v !== lastItem) {
        lastItem = v;
        head.innerHTML = '';
        head.classList.toggle('empty', empty);
        head.append(pic(empty ? null : img.itemArt(v) || img.itemIcon(v), en, 'art-sm'),
          h('span', { class: 'si-txt' }, h('b', null, empty ? 'Slot vazio' : ptItem(v, en)), h('small', null, empty ? 'Clique para equipar' : (PT.item[v] ? en + ' · ' : '') + itemMeta(v))),
          h('span', { class: 'btn sm' }, empty ? 'Equipar' : 'Trocar'));
        const d = empty ? '' : itemDesc(v);
        desc.innerHTML = d;
        desc.hidden = !d;
      }
      const cs = (slot.cards || []).map((n) => el(n)).filter(Boolean);
      const sig = cs.map((x) => x.name + ':' + x.value + ':' + (x.disabled ? 1 : 0)).join('|');
      if (sig !== lastCards) {
        lastCards = sig;
        sockets.innerHTML = '';
        for (const s of cs) {
          if (s.disabled) continue;
          const cv = s.value;
          const en2 = s.selectedIndex >= 0 ? s.options[s.selectedIndex].text : '';
          const emptyCard = cv == 0;
          const nm = emptyCard ? 'Slot livre' : ptCard(cv, en2);
          sockets.append(h('button', { type: 'button', class: 'socket' + (emptyCard ? ' open' : ' filled'), title: emptyCard ? 'Clique para inserir uma carta' : nm + '\n' + stripTags(cardDesc(cv)), onclick: () => pickCard(s.name, slot.l) },
            emptyCard ? h('span', { class: 'plus' }, '+') : pic(img.cardArt(cv), nm, 'card-mini'), h('span', { class: 'sock-name' }, nm)));
        }
        if (!sockets.children.length) sockets.append(h('span', { class: 'muted small' }, (slot.cards || []).length ? 'Este item não tem slots de carta.' : ''));
      }
    });
    return box;
  }
  const details = h('div', { class: 'eq-details' }, Object.keys(SLOTS).map(slotDetail));
  const equipCard = card('Equipamentos', [
    h('div', { class: 'eq-layout' }, eqWin, details),
    h('p', { class: 'muted small hint' }, 'Clique em um slot para ver refino e cartas. Slot vazio abre direto a lista de itens.'),
  ], 'c-equip', h('div', { class: 'row gap wrap' }, mirrorCheck('restrict_cardslot', 'Respeitar nº de slots'), mirrorCheck('restrict_equipslot', 'Bloquear slots ocupados')));

  const runeCard = card('Runas', [
    h('div', { class: 'soon' }, h('div', { class: 'rune-orb' }, 'ᚱ'),
      h('div', null, h('b', null, 'Sistema de runas do servidor'), h('p', { class: 'muted' }, 'Espaço reservado para as runas dos equipamentos dropáveis. Quando as regras estiverem definidas, entram aqui e somam no cálculo.'))),
  ], 'c-runes');

  const buffsCard = card('Buffs, consumíveis & efeitos', [
    h('p', { class: 'muted small' }, 'Painéis do motor original (em inglês). Em alguns, clique no título interno para abrir as opções.'),
    acc('Suporte / habilidades de grupo', byId('SIENSKILL')),
    acc('Comidas, poções & outros itens', byId('SP_SIEN05')),
    acc('Músicas & danças', byId('SP_SIEN01')),
    acc('Habilidades de clã', byId('SP_SIEN02')),
    acc('Efeitos diversos no personagem', byId('SP_SIEN04')),
    acc('Encantamentos adicionais & edições manuais', byId('ID_ARG')),
    acc('Outras informações (cura, refino, EXP…)', tableOf('A_KakutyouSel')),
  ], 'c-buffs');

  vChar.append(
    h('div', { class: 'grid-2' }, h('div', { class: 'col' }, classCard, statsCard), h('div', { class: 'col' }, derivedCard, runeCard)),
    equipCard, buffsCard,
    h('div', { class: 'next' }, h('button', { type: 'button', class: 'btn primary', onclick: () => go('skills') }, 'Próximo: habilidades →')));

  /* =========================================================== HABILIDADES */
  const vSkills = views.skills = h('div', { class: 'view', hidden: true });
  const TREE = window.RO_SKILLTREE || {};
  const RA_JOB_PT = { Novice: 'Aprendiz', Swordman: 'Espadachim', Thief: 'Gatuno', Acolyte: 'Noviço', Archer: 'Arqueiro', Mage: 'Mago', Merchant: 'Mercador', Knight: 'Cavaleiro', Assassin: 'Mercenário', Priest: 'Sacerdote', Hunter: 'Caçador', Wizard: 'Bruxo', Blacksmith: 'Ferreiro', Crusader: 'Templário', Rogue: 'Arruaceiro', Monk: 'Monge', Bard: 'Bardo', Dancer: 'Odalisca', Sage: 'Sábio', Alchemist: 'Alquimista', Supernovice: 'Superaprendiz', Lord_Knight: 'Lorde', Assassin_Cross: 'Algoz', High_Priest: 'Sumo Sacerdote', Sniper: 'Atirador de Elite', High_Wizard: 'Arquimago', Whitesmith: 'Mestre-Ferreiro', Paladin: 'Paladino', Stalker: 'Desordeiro', Champion: 'Mestre', Clown: 'Menestrel', Gypsy: 'Cigana', Professor: 'Professor', Creator: 'Criador', Novice_High: 'Aprendiz T.', Swordman_High: 'Espadachim T.', Thief_High: 'Gatuno T.', Acolyte_High: 'Noviço T.', Archer_High: 'Arqueiro T.', Mage_High: 'Mago T.', Merchant_High: 'Mercador T.', Taekwon: 'Taekwon', Star_Gladiator: 'Mestre Taekwon', Soul_Linker: 'Espiritualista', Ninja: 'Ninja', Gunslinger: 'Justiceiro' };
  const skLevels = {}; // por classe: { officialId: nível } (só skills que o motor não usa)
  try { Object.assign(skLevels, JSON.parse(localStorage.getItem('roclassic:skills') || '{}')); } catch (e) { /* ok */ }
  const saveSk = () => { try { localStorage.setItem('roclassic:skills', JSON.stringify(skLevels)); } catch (e) { /* ok */ } };
  let skTab = null;

  // passivas que o motor usa nesta classe: engineIdx -> nome do select A_skillN
  function enginePassives(j) {
    const map = {};
    const row = window.m_JobBuff && m_JobBuff[j];
    if (!row) return map;
    for (let i = 0; i < row.length; i++) { if (row[i] === 999) break; const s = el('A_skill' + i); if (s) map[row[i]] = 'A_skill' + i; }
    return map;
  }
  const engineAtk = (j) => { const r = (window.m_JobAtkSkill && m_JobAtkSkill[j]) || []; const out = new Set(); for (const x of r) { if (x === 999) break; out.add(x); } return out; };
  function plainLevels(selName, max) {
    const o = opts(selName);
    return o.length === max + 1 && o.every((x, i) => +x.v === i);
  }
  function getLv(j, sk, pas) {
    if (sk.e != null && pas[sk.e] && plainLevels(pas[sk.e], sk.m)) return +val(pas[sk.e]) || 0;
    return (skLevels[j] && skLevels[j][sk.id]) || 0;
  }
  function setLv(j, sk, pas, lv, quiet) {
    lv = Math.max(0, Math.min(sk.m, lv));
    if (sk.e != null && pas[sk.e] && plainLevels(pas[sk.e], sk.m)) { if (+val(pas[sk.e]) !== lv) commit(pas[sk.e], lv, { noCalc: quiet }); } else { (skLevels[j] = skLevels[j] || {})[sk.id] = lv; saveSk(); }
  }

  const skHead = h('div', { class: 'sk-head' });
  const skBody = h('div', { class: 'sk-tree' });
  const skInfo = h('div', { class: 'sk-info' });
  const skOther = h('div', { class: 'sk-other' });

  function renderTree() {
    const j = +val('A_JOB');
    const tabs = (TREE[j] || []).filter((t) => t.job !== 'Novice' || (TREE[j] || []).length === 1);
    const all = (TREE[j] || []).flatMap((t) => t.s);
    const byIdx = Object.fromEntries(all.map((s) => [s.id, s]));
    const pas = enginePassives(j);
    const atk = engineAtk(j);
    if (!tabs.length) { skHead.innerHTML = ''; skBody.innerHTML = ''; skBody.append(h('p', { class: 'muted' }, 'Sem árvore de habilidades para esta classe.')); return; }
    if (!skTab || !tabs.find((t) => t.job === skTab)) skTab = tabs[tabs.length - 1].job;

    // pontos
    const jl = +val('A_JobLV') || 1;
    const used = (t) => t.s.filter((s) => s.c !== 'NV_BASIC').reduce((a, s) => a + getLv(j, s, pas), 0);
    skHead.innerHTML = '';
    for (const t of tabs) {
      const isLast = t === tabs[tabs.length - 1];
      const avail = t.job === 'Novice' ? 9 : isLast ? jl - 1 : 49;
      const u = used(t);
      const nm = RA_JOB_PT[t.job] || t.job.replace(/_/g, ' ');
      skHead.append(h('button', { type: 'button', class: 'sk-tab' + (t.job === skTab ? ' on' : ''), onclick: () => { skTab = t.job; renderTree(); } },
        h('b', null, nm), h('small', { class: u > avail && t.job !== 'Novice' ? 'over' : '' }, `${u} / ${avail} pts`)));
    }

    const tab = tabs.find((t) => t.job === skTab);
    // colunas por profundidade de pré-requisito
    const depth = {};
    const dOf = (s, seen = new Set()) => {
      if (depth[s.id] != null) return depth[s.id];
      if (seen.has(s.id)) return 0;
      seen.add(s.id);
      const reqIn = (s.r || []).map(([id]) => tab.s.find((x) => x.id === id)).filter(Boolean);
      return (depth[s.id] = reqIn.length ? 1 + Math.max(...reqIn.map((x) => dOf(x, seen))) : 0);
    };
    tab.s.forEach((s) => dOf(s));
    const cols = Math.max(0, ...Object.values(depth)) + 1;
    skBody.innerHTML = '';
    skBody.style.setProperty('--cols', cols);
    const colEls = Array.from({ length: cols }, () => h('div', { class: 'sk-col' }));
    for (const s of tab.s) {
      const lv = getLv(j, s, pas);
      const reqOk = (s.r || []).every(([id, rl]) => { const r = byIdx[id]; return !r || getLv(j, r, pas) >= rl; });
      const engPas = s.e != null && pas[s.e];
      const engAtk = s.e != null && atk.has(s.e);
      const special = engPas && !plainLevels(pas[s.e], s.m);
      const name = (s.e != null && PT.skill[s.e]) || s.n;
      const reqTxt = (s.r || []).map(([id, rl]) => { const r = byIdx[id]; return r ? `${(r.e != null && PT.skill[r.e]) || r.n} Nv. ${rl}` : ''; }).filter(Boolean).join(', ');
      const raise = (d) => {
        const nl = Math.max(0, Math.min(s.m, lv + d));
        if (nl > lv) { // sobe pré-requisitos automaticamente
          const up = (sk) => { for (const [id, rl] of sk.r || []) { const r = byIdx[id]; if (r && getLv(j, r, pas) < rl) { up(r); setLv(j, r, pas, rl, true); } } };
          up(s);
        }
        setLv(j, s, pas, nl, true);
        if (nl < lv) { // zera quem dependia
          const down = (sk) => { for (const o of all) if ((o.r || []).some(([id, rl]) => id === sk.id && getLv(j, sk, pas) < rl) && getLv(j, o, pas) > 0) { setLv(j, o, pas, 0, true); down(o); } };
          down(s);
        }
        safeCalc(); renderTree(); schedule();
      };
      const node = h('div', { class: 'sk-node' + (lv > 0 ? ' has' : '') + (!reqOk ? ' locked' : '') + (lv >= s.m ? ' max' : ''), title: `${name}${name !== s.n ? ' (' + s.n + ')' : ''}\nNível máx. ${s.m}${reqTxt ? '\nRequer: ' + reqTxt : ''}${engPas ? '\n✓ Afeta o cálculo (passiva)' : ''}${engAtk ? '\n⚔ Pode ser simulada' : ''}` },
        h('button', { type: 'button', class: 'sk-ico', onclick: () => raise(1), oncontextmenu: (e) => { e.preventDefault(); raise(-1); } }, pic(img.skill(s.id), name, 'skill')),
        h('div', { class: 'sk-meta' },
          h('b', null, name),
          special ? h('span', { class: 'sk-special' }, mirrorSelectNow(pas[s.e])) : h('span', { class: 'sk-lv' },
            h('button', { type: 'button', onclick: () => raise(-1), disabled: lv <= 0 || null }, '−'),
            h('i', null, `${lv}/${s.m}`),
            h('button', { type: 'button', onclick: () => raise(1), disabled: lv >= s.m || null }, '+')),
          h('span', { class: 'sk-badges' }, engPas ? h('i', { class: 'b-calc', title: 'Afeta o cálculo' }, 'calc') : null,
            engAtk ? h('button', { type: 'button', class: 'b-sim', title: 'Simular esta habilidade', onclick: () => { commit('A_ActiveSkill', s.e); if (lv > 0 && el('A_ActiveSkillLV')) commit('A_ActiveSkillLV', Math.min(lv, opts('A_ActiveSkillLV').length)); go('sim'); } }, '⚔ simular') : null)));
      colEls[depth[s.id]].append(node);
    }
    skBody.append(...colEls);
  }
  let treeSig = '';
  onUpdate(() => {
    if (views.skills.hidden) return;
    const j = val('A_JOB');
    const pas = enginePassives(+j);
    const sig = j + '|' + val('A_JobLV') + '|' + skTab + '|' + Object.values(pas).map(val).join(',');
    if (sig === treeSig) return;
    treeSig = sig;
    renderTree();
  });
  skInfo.append(h('p', { class: 'muted small' }, 'Clique no ícone para subir (botão direito para baixar). Pré-requisitos sobem sozinhos. ',
    h('i', { class: 'b-calc' }, 'calc'), ' = passiva que muda o cálculo. ', h('b', null, '⚔ simular'), ' = abre a habilidade na simulação. As demais habilidades contam pontos mas não mudam o dano.'));
  skOther.append(acc('Outras opções de habilidade do motor (Peco, Espírito, etc.)', tableOf('P_Skill0')));
  vSkills.append(card('Árvore de habilidades', [skHead, skInfo, skBody], 'c-tree'), card(null, [skOther]),
    h('div', { class: 'next' }, h('button', { type: 'button', class: 'btn', onclick: () => go('char') }, '← Personagem'), h('button', { type: 'button', class: 'btn primary', onclick: () => go('target') }, 'Próximo: alvo →')));

  /* ================================================================= ALVO */
  const vTarget = views.target = h('div', { class: 'view', hidden: true });
  const raceName = (r) => tr(RACE_EN[r] || '');
  const elemName = (e) => tr(((window.v_Element_ && v_Element_[Math.floor(e / 10)]) || '').trim()) + ' ' + (e % 10);
  const sizeName = (s) => ['Pequeno', 'Médio', 'Grande'][s] || '';
  const elemCls = (e) => 'el-' + Math.floor(e / 10);
  const mobName = (v) => { const m = window.m_Monster && m_Monster[v]; return m ? ptMob(v, m[1]) : selText('B_Enemy'); };

  const mobSearch = h('input', { type: 'search', class: 'search', placeholder: 'Buscar monstro (PT ou EN)…', autocomplete: 'off' });
  const mobGrid = h('div', { class: 'mob-grid' });
  const mobCount = h('span', { class: 'muted small' });
  let mobSig = '';
  function mobCardEl(o) {
    const m = window.m_Monster && m_Monster[o.v];
    const name = mobName(o.v);
    const b = h('button', { type: 'button', class: 'mob', 'data-v': o.v, onclick: () => commit('B_Enemy', o.v) },
      pic(img.mob(o.v), name, 'mob-img'),
      h('span', { class: 'mob-name' }, name),
      m ? h('span', { class: 'mob-sub' }, `Nv ${m[5]} · ${fmt(m[6])} HP`) : null,
      m ? h('span', { class: 'mob-tags' }, h('i', { class: 'tag ' + elemCls(m[3]) }, elemName(m[3])), h('i', { class: 'tag' }, raceName(m[2])), h('i', { class: 'tag' }, sizeName(m[4])), m[19] == 1 ? h('i', { class: 'tag boss' }, 'Chefe') : null) : null);
    b._key = norm(name + ' ' + (m ? m[1] : o.t));
    return b;
  }
  function filterMobs() {
    const q = norm(mobSearch.value).split(/\s+/).filter(Boolean);
    let n = 0;
    for (const b of mobGrid.children) { const ok = q.every((w) => b._key.includes(w)); b.hidden = !ok; if (ok) n++; }
    mobCount.textContent = `${n} alvos`;
  }
  mobSearch.addEventListener('input', filterMobs);
  onUpdate(() => {
    const o = opts('B_Enemy');
    const sig = o.map((x) => x.v).join(',');
    if (sig !== mobSig) {
      mobSig = sig;
      mobGrid.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (const x of o) frag.append(mobCardEl(x));
      mobGrid.append(frag);
      filterMobs();
    }
    const cur = val('B_Enemy');
    for (const b of mobGrid.children) b.classList.toggle('is-sel', b.dataset.v === cur);
  });
  const tDetail = h('div', { class: 'target-detail' });
  const T_FIELDS = [['B_6', 'HP máx.'], ['B_12', 'ATK mín.'], ['B_13', 'ATK máx.'], ['B_14', 'DEF'], ['B_23', 'DEF (VIT)'], ['B_15', 'MDEF'], ['B_25', 'MDEF (INT)'],
    ['B_agi', 'AGI'], ['B_vit', 'VIT'], ['B_int', 'INT'], ['B_dex', 'DEX'], ['B_luk', 'LUK'], ['B_21', 'HIT p/ 100%'], ['B_22', 'FLEE p/ 95%'], ['B_16', 'EXP base'], ['B_17', 'EXP classe']];
  let tSig = '';
  onUpdate(() => {
    const v = val('B_Enemy');
    const m = window.m_Monster && m_Monster[v];
    const sig = v + '|' + T_FIELDS.map(([id]) => txt(id)).join('|') + txt('B_type');
    if (sig === tSig) return;
    tSig = sig;
    tDetail.innerHTML = '';
    tDetail.append(
      h('div', { class: 'td-hero' },
        pic(img.mob(v), mobName(v), 'mob-hero'),
        h('div', null,
          h('small', { class: 'muted' }, 'Alvo selecionado'),
          h('h3', null, mobName(v)),
          m && PT.mob[v] ? h('p', { class: 'muted small en' }, m[1]) : null,
          m ? h('div', { class: 'mob-tags' }, h('i', { class: 'tag ' + elemCls(m[3]) }, elemName(m[3])), h('i', { class: 'tag' }, raceName(m[2])), h('i', { class: 'tag' }, sizeName(m[4])), txt('B_type') ? h('i', { class: 'tag' }, tr(txt('B_type'))) : null) : null,
          m ? h('p', { class: 'muted small' }, `Nível ${m[5]}`) : null)),
      h('div', { class: 'td-grid' }, T_FIELDS.map(([id, l]) => h('div', { class: 'dv' }, h('small', null, l), h('b', null, txt(id) || '—')))));
  });
  const targetCard = card('Escolha o alvo', [
    h('div', { class: 'row gap wrap filters' },
      h('label', { class: 'mini-field' }, h('small', null, 'Local'), mirrorSelect('ENEMY_SORT2')),
      h('label', { class: 'mini-field' }, h('small', null, 'Ordenar'), mirrorSelect('ENEMY_SORT')),
      h('div', { class: 'grow' }, mobSearch), mobCount),
    mobGrid,
  ], 'c-mobs');
  const envCard = card('Ambiente', [h('div', { class: 'row gap wrap' },
    h('label', { class: 'mini-field' }, h('small', null, 'Ambiente'), mirrorSelect('A8_Skill14')),
    h('label', { class: 'mini-field' }, h('small', null, 'Investimento de defesa (WoE)'), mirrorSelect('A8_Skill15')))]);
  const enemyFx = card('Efeitos no alvo', [acc('Debuffs no alvo', byId('EnemyDebuf'), true), acc('Buffs no alvo', byId('EnemyBuf')), acc('Edição manual do alvo', byId('B_MANUAL'))], 'c-enemyfx');
  vTarget.append(h('div', { class: 'grid-2 t-top' }, card('Alvo atual', [tDetail], 'c-tdetail'), h('div', { class: 'col' }, envCard, enemyFx)),
    targetCard,
    h('div', { class: 'next' }, h('button', { type: 'button', class: 'btn', onclick: () => go('skills') }, '← Habilidades'), h('button', { type: 'button', class: 'btn primary', onclick: () => go('sim') }, 'Próximo: simular →')));

  /* ============================================================ SIMULAÇÃO */
  const vSim = views.sim = h('div', { class: 'view', hidden: true });
  const skillList = h('div', { class: 'skills' });
  const skillSearch = h('input', { type: 'search', class: 'search', placeholder: 'Buscar habilidade (PT ou EN)…', autocomplete: 'off' });
  let skSig = '';
  function filterSkills() {
    const q = norm(skillSearch.value).split(/\s+/).filter(Boolean);
    for (const b of skillList.children) b.hidden = !q.every((w) => (b._key || '').includes(w));
  }
  skillSearch.addEventListener('input', filterSkills);
  onUpdate(() => {
    const o = opts('A_ActiveSkill');
    const sig = o.map((x) => x.v + x.t).join('|');
    if (sig !== skSig) {
      skSig = sig;
      skillList.innerHTML = '';
      for (const x of o) {
        if (x.d) { const sep = h('div', { class: 'sk-sep' }, x.t.replace(/-/g, '').replace('Spell Scrolls', 'Pergaminhos').replace('Yggdrasil Leaf', 'Folha de Yggdrasil').trim()); sep._key = ''; skillList.append(sep); continue; }
        const basic = x.v == '0';
        const nm = basic ? 'Ataque básico' : ptSkill(+x.v, x.t);
        const b = h('button', { type: 'button', class: 'sk' + (basic ? ' basic' : ''), 'data-v': x.v, title: nm !== x.t ? x.t : null, onclick: () => commit('A_ActiveSkill', x.v) },
          basic ? h('span', { class: 'sk-ic0' }, '⚔') : pic(img.skillE(+x.v), nm, 'skill sm'), h('span', null, nm));
        b._key = norm(nm + ' ' + x.t + (basic ? ' ataque basico' : ''));
        skillList.append(b);
      }
      filterSkills();
    }
    const cur = val('A_ActiveSkill');
    for (const b of skillList.children) if (b.dataset) b.classList.toggle('is-sel', b.dataset.v === cur);
  });
  const skillCard = card('Habilidade', [
    h('div', { class: 'row gap wrap' }, h('div', { class: 'grow' }, skillSearch), h('label', { class: 'mini-field' }, h('small', null, 'Nível'), mirrorSelect('A_ActiveSkillLV', 'lv')),
      mirrorCheck('all_dmgSkills', 'Todas as habilidades de dano')),
    skillList,
    h('div', { class: 'aa-skill' }, adopt(byId('AASkill'), 'inline')),
  ], 'c-skills');

  const LABEL_PT = {
    'Minimum Damage': 'Dano mínimo', 'Average Damage': 'Dano médio', 'Maximum Damage': 'Dano máximo', 'Damage Per Second': 'Dano por segundo',
    'Minimum Number of Hits': 'Golpes p/ matar (mín.)', 'Average Number of Hits': 'Golpes p/ matar (média)', 'Maximum Number of Hits': 'Golpes p/ matar (máx.)',
    'Average Battle Duration': 'Duração média da luta', 'Base Exp per Hit': 'EXP base por golpe', 'Job Exp per Hit': 'EXP classe por golpe',
    "Player's Hit Ratio": 'Chance de acerto', 'Attack Element': 'Elemento do ataque', 'Weapon/Skill Size Modifier': 'Modificador de tamanho',
    'Critical Damage (Critical Rate)': 'Dano crítico (chance)', 'Cast Time': 'Tempo de conjuração', 'Time/Hit': 'Tempo por golpe', 'Damage Backslash': 'Dano refletido',
    'Minimum Heal': 'Cura mínima', 'Average Heal': 'Cura média', 'Maximum Heal': 'Cura máxima', "Player's Dodge Ratio": 'Sua chance de esquiva',
    'Enemy Attack Element': 'Elemento do ataque inimigo', 'Minimum Damage Received': 'Dano recebido (mín.)', 'Average Damage Received': 'Dano recebido (médio)',
    'Maximum Damage Received': 'Dano recebido (máx.)', 'Average Dmg Received (w/dodge)': 'Dano médio recebido (c/ esquiva)', 'Delay (Fixed Skills)': 'Delay (skills fixas)', 'Exp per Hit': 'EXP por golpe', 'Delay': 'Delay', 'Heal per Second': 'Cura por segundo',
  };
  const LABEL_LC = {};
  const lab = (id, fallback) => { const t = txt(id); if (!Object.keys(LABEL_LC).length) for (const [k, v] of Object.entries(LABEL_PT)) LABEL_LC[k.toLowerCase()] = v; return LABEL_PT[t] || LABEL_LC[t.toLowerCase()] || t || fallback || ''; };
  const trVal = (s) => s.replace(/seconds?/g, 's').replace(/\bbase\b/, 'base').replace(/\bjob\b/, 'classe').replace(/(\d) hits/g, '$1 golpes').replace(/Over (\d+)/g, 'mais de $1')
    .replace(/vs (\w+)/g, (m, x) => 'vs ' + tr(x)).replace(/>(Neutral|Water|Earth|Fire|Wind|Poison|Holy|Shadow|Ghost|Undead)</g, (m, x) => '>' + tr(x) + '<').replace(/^(Neutral|Water|Earth|Fire|Wind|Poison|Holy|Shadow|Ghost|Undead)\b/, (m, x) => tr(x)).replace(/any element/, 'qualquer elemento').replace(/None/, 'Nenhum');
  const dmgHero = h('div', { class: 'dmg-hero' });
  const dmgBar = h('div', { class: 'dmg-bar' });
  const detailGrid = h('div', { class: 'res-grid' });
  const recvGrid = h('div', { class: 'res-grid' });
  const killBox = h('div', { class: 'kill' });
  const RES_ROWS = [['nm053', 'BattleHIT', '%'], ['CRIATKname', ['CRIATK', 'CRInum']], ['nm074', 'A_WeaponElement'], ['nm076', 'A_WeaponSize'], ['bSUBname', 'bSUB'], ['bSUB2name', 'bSUB2'], ['nm058', 'AveSecondATK'], ['nm062', 'BattleTime'], ['bSUB3name', 'bSUB3'], ['bREFLECT1name', 'bREFLECT1'], ['bREFLECT2name', 'bREFLECT2'], ['nm063', 'AtkBaseExp'], ['nm064', 'AtkJobExp']];
  const RECV_ROWS = [['nm054', 'BattleFLEE', '%'], ['nm075', 'B_WeaponElement'], ['nm067', 'B_MinAtk'], ['nm065', 'B_AveAtk'], ['nm068', 'B_MaxAtk'], ['nm066', 'B_Ave2Atk'], ['aREFLECT1name', 'aREFLECT1'], ['aREFLECT2name', 'aREFLECT2']];
  const rowsOut = (rows, grid) => {
    grid.innerHTML = '';
    for (const [lid, vid, suf] of rows) {
      const ids = Array.isArray(vid) ? vid : [vid];
      const v = ids.map(htm).join(' ').trim();
      const l = lab(lid);
      if (!l || !v.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/g, '').trim()) continue;
      grid.append(h('div', { class: 'res' }, h('small', null, l), h('b', { html: trVal(v) + (suf || '') })));
    }
  };
  let resSig = '';
  onUpdate(() => {
    const ids = ['strID_0', 'strID_1', 'strID_2', 'MinATKnum', 'AveATKnum', 'MaxATKnum', 'B_6', 'B_Enemy', ...RES_ROWS.flatMap((r) => [r[0]].concat(r[1])), ...RECV_ROWS.flatMap((r) => [r[0], r[1]])];
    const sig = ids.map(htm).join('\u0001') + val('A_ActiveSkill') + val('B_Enemy');
    if (sig === resSig) return;
    resSig = sig;
    const mn = num(txt('strID_0')), av = num(txt('strID_1')), mx = num(txt('strID_2'));
    const sv = val('A_ActiveSkill');
    const skill = sv == '0' ? 'Ataque básico' : ptSkill(+sv, selText('A_ActiveSkill'));
    dmgHero.innerHTML = '';
    dmgHero.append(
      h('div', { class: 'dh-skill' }, sv != '0' ? pic(img.skillE(+sv), skill, 'skill sm') : h('span', { class: 'sk-ic0' }, '⚔'), h('small', null, 'Simulando'), h('b', null, skill), h('span', { class: 'muted' }, ' em ' + mobName(val('B_Enemy')))),
      h('div', { class: 'dh-nums' },
        h('div', { class: 'dh min' }, h('small', null, lab('nm055', 'Dano mínimo')), h('b', null, fmt(mn)), h('span', { class: 'dh-raw', html: trVal(htm('strID_0')) })),
        h('div', { class: 'dh avg' }, h('small', null, lab('nm056', 'Dano médio')), h('b', null, fmt(av)), h('span', { class: 'dh-raw', html: trVal(htm('strID_1')) })),
        h('div', { class: 'dh max' }, h('small', null, lab('nm057', 'Dano máximo')), h('b', null, fmt(mx)), h('span', { class: 'dh-raw', html: trVal(htm('strID_2')) }))));
    const hp = num(txt('B_6'));
    dmgBar.innerHTML = '';
    if (isFinite(hp) && hp > 0 && isFinite(mx)) {
      const pct = (x) => Math.max(0, Math.min(100, (x / hp) * 100));
      dmgBar.append(h('div', { class: 'bar' }, h('span', { class: 'bar-range', style: { left: pct(mn) + '%', width: Math.max(0.6, pct(mx) - pct(mn)) + '%' } }), h('span', { class: 'bar-avg', style: { left: pct(av) + '%' } })),
        h('div', { class: 'bar-l' }, h('span', null, '0'), h('span', null, `${pct(av).toFixed(1)}% do HP por golpe (média)`), h('span', null, fmt(hp) + ' HP')));
    }
    killBox.innerHTML = '';
    killBox.append(h('div', { class: 'k' }, h('small', null, 'Golpes p/ matar'), h('b', { html: trVal(htm('AveATKnum')) || '—' }), h('span', { class: 'muted small', html: `mín. ${trVal(htm('MinATKnum')) || '—'} · máx. ${trVal(htm('MaxATKnum')) || '—'}` })));
    rowsOut(RES_ROWS, detailGrid);
    rowsOut(RECV_ROWS, recvGrid);
  });
  const resultCard = card('Resultado', [dmgHero, dmgBar, h('div', { class: 'res-wrap' }, killBox, detailGrid)], 'c-result',
    h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { safeCalc(); schedule(); toast('Recalculado'); } }, '↻ Recalcular'));
  const recvCard = card('Dano recebido do alvo', [
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini-field' }, h('small', null, 'Habilidade do inimigo'), mirrorSelect('B_AtkSkill')),
      h('label', { class: 'mini-field' }, h('small', null, 'Distância'), mirrorSelect('B_AtkRange')),
      h('label', { class: 'mini-field' }, h('small', null, 'Elemento'), mirrorSelect('B_AtkElem')),
      h('label', { class: 'mini-field' }, h('small', null, 'Inimigos te atacando'), mirrorSelect('B_num'))),
    h('div', { class: 'aa-skill' }, adopt(byId('BBSkill'), 'inline')),
    recvGrid,
  ], 'c-recv');
  vSim.append(resultCard, h('div', { class: 'grid-2' }, skillCard, recvCard),
    h('div', { class: 'next' }, h('button', { type: 'button', class: 'btn', onclick: () => go('target') }, '← Alvo')));

  main.append(vChar, vSkills, vTarget, vSim);

  /* ================================================================ RESUMO */
  onUpdate(() => {
    const j = +val('A_JOB');
    const v = val('B_Enemy');
    const m = window.m_Monster && m_Monster[v];
    const av = num(txt('strID_1'));
    const sv = val('A_ActiveSkill');
    const kills = txt('AveATKnum');
    side.innerHTML = '';
    side.append(
      h('div', { class: 'sum-card sum-char', onclick: () => go('char') },
        h('span', { class: 'emblem ' + jobTree(j) }, pic(sprite(j), jobName(j), 'sprite sm')),
        h('div', null, h('b', null, jobName(j)), h('small', null, `Nv ${val('A_BaseLV')} / ${val('A_JobLV')}`))),
      h('div', { class: 'sum-stats' },
        [['ATK', 'A_ATK2'], ['MATK', 'A_MATK'], ['HIT', 'A_HIT'], ['CRIT', 'A_CRI'], ['ASPD', 'A_ASPD'], ['HP', 'A_MaxHP'], ['SP', 'A_MaxSP'], ['FLEE', 'A_FLEE']]
          .map(([l, id]) => h('div', null, h('small', null, l), h('b', null, txt(id) || '—')))),
      h('div', { class: 'sum-card sum-target', onclick: () => go('target') },
        pic(img.mob(v), mobName(v), 'mob-sm'),
        h('div', null, h('small', null, 'Alvo'), h('b', null, mobName(v)), m ? h('small', null, `${elemName(m[3])} · ${raceName(m[2])} · ${sizeName(m[4])}`) : null)),
      h('div', { class: 'sum-dmg', onclick: () => go('sim') },
        h('small', null, sv == '0' ? 'Ataque básico' : ptSkill(+sv, selText('A_ActiveSkill'))),
        h('b', null, fmt(av)),
        h('small', null, /^\d+$/.test(kills) ? `dano médio · ${kills} golpes p/ matar` : `dano médio · ${trVal(kills || '—')}`)));
  });

  /* ================================================================ OPÇÕES */
  function mirrorSelectNow(name, after) {
    const s = h('select', { class: 'sel' });
    for (const x of opts(name)) s.append(h('option', { value: x.v, disabled: x.d || null }, trOpt(x.t)));
    s.value = val(name);
    s.addEventListener('change', () => { commit(name, s.value); if (after) after(); });
    return s;
  }
  function checkNow(name, label) {
    const i = h('input', { type: 'checkbox' });
    const src = el(name);
    i.checked = !!(src && src.checked);
    i.addEventListener('change', () => commit(name, i.checked));
    return h('label', { class: 'check' }, i, h('span', null, label));
  }
  function quiet(fn) { const ra = window.alert; window.alert = (m) => toast(String(m).split('\n')[0]); try { fn(); } catch (e) { console.warn(e); } finally { window.alert = ra; } }
  function openSettings() {
    const imp = h('input', { type: 'text', class: 'search', placeholder: 'Cole aqui um link salvo do rocalc.com (ou desta calc)' });
    const slotName = h('input', { type: 'text', class: 'search', placeholder: 'Nome do save (opcional)' });
    const box = h('div', { class: 'pick settings' },
      h('div', { class: 'pick-head' }, h('h3', null, 'Opções'), h('button', { type: 'button', class: 'icon-btn', onclick: closePicker }, '✕')),
      h('div', { class: 'set-body' },
        h('h4', null, 'Servidor'),
        h('div', { class: 'row gap wrap' },
          h('label', { class: 'mini-field' }, h('small', null, 'Servidor de RO'), mirrorSelectNow('server', () => { try { window.SaveTheme(); } catch (e) { /* ok */ } })),
          h('label', { class: 'mini-field' }, h('small', null, 'ASPD máximo do servidor'), mirrorSelectNow('maxASPD')),
          h('label', { class: 'mini-field' }, h('small', null, 'Atraso mínimo entre skills'), mirrorSelectNow('Conf01'))),
        h('div', { class: 'col tight' },
          checkNow('restrict_jobequip', 'Restringir equipamentos pela classe (limpa equipamentos e atributos)'),
          checkNow('restrict_equipslot', 'Bloquear escudo com arma de duas mãos / headgears que ocupam vários slots'),
          checkNow('restrict_cardslot', 'Permitir só a quantidade de cartas que o item suporta'),
          checkNow('all_card', 'Todas as cartas em qualquer lugar (com bugs, igual ao rocalc)')),
        h('h4', null, 'Salvar & carregar'),
        h('p', { class: 'muted small' }, 'A build atual fica salva automaticamente no link da página (dá pra favoritar ou compartilhar).'),
        h('div', { class: 'row gap wrap' }, h('button', { type: 'button', class: 'btn primary', onclick: shareLink }, '🔗 Copiar link da build')),
        h('div', { class: 'row gap wrap' }, h('div', { class: 'grow' }, imp), h('button', { type: 'button', class: 'btn', onclick: () => {
          if (!imp.value.trim()) return;
          byId('otherURL_TEXT').value = imp.value.trim();
          try { window.URLIN(1); } catch (e) { toast('Não consegui ler esse link.', 'err'); return; }
          safeCalc(); schedule(); autosave(); closePicker(); toast('Build importada!');
        } }, 'Importar link')),
        h('h4', null, 'Saves locais (no navegador)'),
        h('div', { class: 'row gap wrap' }, h('div', { class: 'grow' }, slotName), mirrorSelectNow('A_SaveSlotLocal')),
        h('div', { class: 'row gap wrap' },
          h('button', { type: 'button', class: 'btn', onclick: () => { el('SlotName').value = slotName.value; quiet(() => window.SaveLocal()); quiet(() => window.LoadLocal3()); schedule(); toast('Salvo no slot selecionado.'); } }, 'Salvar no slot'),
          h('button', { type: 'button', class: 'btn', onclick: () => { quiet(() => window.LoadLocal()); safeCalc(); schedule(); autosave(); closePicker(); toast('Save carregado.'); } }, 'Carregar slot'),
          h('button', { type: 'button', class: 'btn danger', onclick: () => { if (confirm('Apagar o save selecionado?')) { const rc = window.confirm; window.confirm = () => true; try { window.delLocal(); } finally { window.confirm = rc; } schedule(); } } }, 'Apagar slot')),
        h('h4', null, 'Créditos'),
        h('p', { class: 'muted small', html: 'Motor de cálculo: <a href="https://rocalc.com" target="_blank" rel="noopener">rocalc.com</a> — simulador original de ROratorio, tradução/adaptação de Doddler, atualizações de Gandi, Triper e kurimet. Nomes em português e imagens: <a href="https://www.divine-pride.net" target="_blank" rel="noopener">divine-pride.net</a> (bRO). Sprites de classe: <a href="https://browiki.org" target="_blank" rel="noopener">bROWiki</a>. Árvores de habilidade: rAthena. Ragnarok Online © Gravity Co.' })));
    openModal(box);
  }
  function shareLink() {
    silentURLOUT();
    const url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link da build copiado!'), () => { prompt('Copie o link:', url); });
  }

  /* ================================================================== BOOT */
  try { window.LoadTheme(); } catch (e) { /* tema original é ignorado pelo CSS */ }
  try {
    if (!/[#?]/.test(location.href)) {
      const last = localStorage.getItem('roclassic:last');
      if (last && last.length > 2) { byId('otherURL_TEXT').value = location.href.split('#')[0] + last; window.URLIN(1); }
    }
  } catch (e) { console.warn('[boot]', e); }
  try {
    let pref = null;
    try { pref = localStorage.getItem('roclassic:cardslot'); } catch (e) { /* ok */ }
    const rc = el('restrict_cardslot');
    if (rc && pref !== '0' && !rc.checked) { rc.checked = true; window.restrictCardslot(0); }
    if (rc) rc.addEventListener('click', () => { try { localStorage.setItem('roclassic:cardslot', rc.checked ? '1' : '0'); } catch (e) { /* ok */ } });
  } catch (e) { console.warn(e); }

  safeCalc();
  let startView = 'char';
  try { startView = sessionStorage.getItem('roclassic:view') || 'char'; } catch (e) { /* ok */ }
  go(views[startView] ? startView : 'char');
  booting = false;
  window.ROCLASSIC = { schedule, commit, go, trDesc };
})();
