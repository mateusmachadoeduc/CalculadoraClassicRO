/*
 * RO Classic Calc — interface nova
 * ------------------------------------------------------------------
 * O cálculo é 100% o motor original do rocalc.com (pasta engine/, sem
 * modificações). Esta camada só:
 *   1) lê as opções dos campos originais (escondidos em #legacy),
 *   2) mostra tudo numa interface nova (personagem → alvo → simulação),
 *   3) quando o usuário escolhe algo, grava no campo original e dispara
 *      o mesmo "onchange" que o rocalc dispararia,
 *   4) lê os resultados que o motor escreveu e redesenha a tela.
 * Assim os números são idênticos aos do rocalc.com.
 */
(() => {
  'use strict';

  const c = document.calcForm;
  const app = document.getElementById('app');

  /* ---------------------------------------------------------------- utils */
  const el = (name) => {
    const e = c.elements.namedItem(name);
    if (!e) return document.getElementById(name);
    if (typeof RadioNodeList !== 'undefined' && e instanceof RadioNodeList) return e[0];
    return e;
  };
  const byId = (id) => document.getElementById(id);
  const txt = (id) => { const e = byId(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; };
  const htm = (id) => { const e = byId(id); return e ? e.innerHTML : ''; };
  const opts = (name) => { const e = el(name); return e && e.options ? Array.from(e.options).map(o => ({ v: o.value, t: o.text, d: o.disabled })) : []; };
  const selText = (name) => { const e = el(name); return e && e.selectedIndex >= 0 && e.options[e.selectedIndex] ? e.options[e.selectedIndex].text : ''; };
  const val = (name) => { const e = el(name); return e ? e.value : ''; };
  const num = (s) => { const m = String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
  const fmt = (n) => isFinite(n) ? Math.round(n).toLocaleString('pt-BR') : '—';
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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

  /* --------------------------------------------------------------- imagens */
  const IM = window.ROCALC_IDMAP || { item: {}, mob: {}, card: {} };
  const DP = 'https://static.divine-pride.net/images/';
  const img = {
    itemIcon: (v) => IM.item[v] ? `${DP}items/item/${IM.item[v]}.png` : null,
    itemArt: (v) => IM.item[v] ? `${DP}items/collection/${IM.item[v]}.png` : null,
    cardArt: (v) => IM.card[v] ? `${DP}items/cards/${IM.card[v]}.png` : null,
    cardIcon: (v) => IM.card[v] ? `${DP}items/item/${IM.card[v]}.png` : null,
    mob: (v) => IM.mob[v] ? `${DP}mobs/png/${IM.mob[v]}.png` : null,
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

  /* -------------------------------------------------- ciclo de atualização */
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

  function commit(name, value) {
    const e = el(name);
    if (!e) return;
    if (e.type === 'checkbox') {
      if (e.checked !== !!value) e.click();
    } else {
      e.value = String(value);
      e.dispatchEvent(new Event('change', { bubbles: true }));
    }
    safeCalc();
    schedule();
    autosave();
  }

  // Qualquer interação dentro dos painéis originais realocados também redesenha.
  c.addEventListener('change', () => { schedule(); autosave(); });
  c.addEventListener('keyup', (e) => { if (e.target.closest('.legacy-panel')) { schedule(); autosave(); } });
  c.addEventListener('click', (e) => { if (e.target.closest('.legacy-panel')) setTimeout(schedule, 0); });

  /* ------------------------------------------------------- salvar no link */
  let saveTimer = null, booting = true;
  function silentURLOUT() {
    const realAlert = window.alert;
    const hadOwn = Object.prototype.hasOwnProperty.call(navigator, 'clipboard');
    window.alert = () => {};
    try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true }); } catch (e) { /* ok */ }
    try { window.URLOUT(); } catch (e) { console.warn('[save]', e); }
    finally {
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

  /* --------------------------------------------------------------- toasts */
  const toastBox = h('div', { class: 'toasts' });
  document.body.append(toastBox);
  function toast(msg, kind) {
    const t = h('div', { class: 'toast ' + (kind || '') }, msg);
    toastBox.append(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
  }

  /* ---------------------------------------------------- descrições do motor */
  function itemDesc(id) {
    const it = window.m_Item && m_Item[id];
    if (!it) return '';
    const saved = window.CBIstr;
    window.CBIstr = '';
    try {
      for (let i = 11; it[i] > 0; i += 2) window.Item_Setumei(it[i], it[i + 1]);
      if (it[10] != 0) window.CBIstr += it[10] + '<br>';
    } catch (e) { /* ok */ }
    const s = window.CBIstr;
    window.CBIstr = saved;
    return s;
  }
  function cardDesc(id) {
    const cd = window.m_Card && m_Card[id];
    if (!cd) return '';
    const saved = window.CBIstr;
    window.CBIstr = '';
    try {
      for (let i = 4; cd[i] != 0 && cd[i] != null; i += 2) window.Item_Setumei(cd[i], cd[i + 1]);
      if (cd[3] != 0) window.CBIstr += cd[3] + '<br>';
    } catch (e) { /* ok */ }
    const s = window.CBIstr;
    window.CBIstr = saved;
    return s;
  }
  function itemMeta(id) {
    const it = window.m_Item && m_Item[id];
    if (!it || !id || id == 0) return '';
    const parts = [];
    if (it[1] < 50) { parts.push(`ATK ${it[3]}`); parts.push(`Nv. arma ${it[4]}`); }
    else if (it[3]) parts.push(`DEF ${it[3]}`);
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

  /* ------------------------------------------------------------- seletor */
  // Modal genérico com busca. items: [{v,t,sub,img,desc,d,group}]
  const modal = h('div', { class: 'modal', hidden: true });
  document.body.append(modal);
  function closePicker() { modal.hidden = true; modal.innerHTML = ''; document.body.classList.remove('noscroll'); }
  modal.addEventListener('click', (e) => { if (e.target === modal) closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closePicker(); });

  function openPicker({ title, items, current, onPick, layout = 'list', placeholder = 'Buscar…', extra }) {
    modal.innerHTML = '';
    const list = h('div', { class: 'pick-list ' + layout });
    const detail = h('div', { class: 'pick-detail' });
    const search = h('input', { class: 'pick-search', type: 'search', placeholder, autocomplete: 'off', spellcheck: 'false' });
    const count = h('span', { class: 'pick-count' });
    const box = h('div', { class: 'pick' + (layout === 'list' ? ' with-detail' : '') },
      h('div', { class: 'pick-head' },
        h('h3', null, title),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fechar', onclick: closePicker }, '✕')),
      h('div', { class: 'pick-tools' }, search, count, extra || null),
      h('div', { class: 'pick-body' }, list, layout === 'list' ? detail : null));
    modal.append(box);
    modal.hidden = false;
    document.body.classList.add('noscroll');

    const rows = items.map((it) => {
      const row = h('button', {
        type: 'button', class: 'pick-row' + (String(it.v) === String(current) ? ' is-sel' : '') + (it.d ? ' dis' : ''),
        disabled: it.d || null,
        onclick: () => { closePicker(); onPick(it.v, it); },
      },
        layout === 'cards'
          ? [pic(it.img, it.t, 'card-art'), h('span', { class: 'pr-name' }, it.t)]
          : layout === 'mobs'
            ? [pic(it.img, it.t, 'mob'), h('span', { class: 'pr-txt' }, h('span', { class: 'pr-name' }, it.t), it.sub ? h('span', { class: 'pr-sub' }, it.sub) : null), it.tags ? h('span', { class: 'pr-tags' }, it.tags) : null]
            : [it.img !== undefined ? pic(it.img, it.t, 'icon') : null, h('span', { class: 'pr-txt' }, h('span', { class: 'pr-name' }, it.t), it.sub ? h('span', { class: 'pr-sub' }, it.sub) : null)]);
      if (layout === 'list') {
        const show = () => {
          detail.innerHTML = '';
          detail.append(
            it.art ? pic(it.art, it.t, 'art') : null,
            h('h4', null, it.t),
            it.sub ? h('p', { class: 'muted' }, it.sub) : null,
            h('div', { class: 'desc', html: (it.desc && it.desc()) || '<span class="muted">Sem efeitos adicionais.</span>' }));
        };
        row.addEventListener('mouseenter', show);
        row.addEventListener('focus', show);
      }
      if (layout === 'cards' && it.desc) row.title = '';
      row._key = norm(it.t + ' ' + (it.sub || '') + ' ' + (it.k || ''));
      list.append(row);
      return row;
    });
    const filter = () => {
      const q = norm(search.value).split(/\s+/).filter(Boolean);
      let n = 0;
      for (const r of rows) {
        const ok = q.every((w) => r._key.includes(w));
        r.hidden = !ok;
        if (ok) n++;
      }
      count.textContent = `${n} itens`;
    };
    search.addEventListener('input', filter);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const r = rows.find((x) => !x.hidden && !x.disabled); if (r) r.click(); }
    });
    filter();
    setTimeout(() => {
      search.focus();
      const s = rows.find((r) => r.classList.contains('is-sel'));
      if (s) { s.scrollIntoView({ block: 'center' }); if (layout === 'list') s.dispatchEvent(new Event('mouseenter')); }
    }, 30);
  }

  /* ------------------------------------------------ select nativo espelhado */
  function mirrorSelect(name, cls) {
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
        for (const x of o) s.append(h('option', { value: x.v, disabled: x.d || null }, x.t));
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
  function mirrorOut(id, wrap) {
    const s = h(wrap || 'span', { class: 'out' });
    onUpdate(() => { s.innerHTML = htm(id); });
    return s;
  }

  // Move um painel original (com seus eventos) para dentro da interface nova.
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
    { id: 'target', n: 2, t: 'Alvo', s: 'Monstro ou jogador' },
    { id: 'sim', n: 3, t: 'Simulação', s: 'Habilidades e dano' },
  ];
  let current = 'char';
  const views = {};
  const stepBtns = {};

  const header = h('header', { class: 'topbar' },
    h('div', { class: 'brand' },
      h('div', { class: 'logo' }, h('span', null, 'RO')),
      h('div', null, h('div', { class: 'brand-t' }, 'RO Classic Calc'), h('div', { class: 'brand-s' }, 'Pré-Renewal · motor rocalc.com'))),
    h('nav', { class: 'steps' }, STEPS.map((s) => (stepBtns[s.id] = h('button', { type: 'button', class: 'step', onclick: () => go(s.id) },
      h('span', { class: 'step-n' }, s.n), h('span', { class: 'step-t' }, h('b', null, s.t), h('small', null, s.s)))))),
    h('div', { class: 'top-actions' },
      h('button', { type: 'button', class: 'btn ghost', onclick: shareLink, title: 'Copiar link com a build' }, '🔗 Copiar link'),
      h('button', { type: 'button', class: 'btn ghost', onclick: openSettings, title: 'Configurações, salvar e carregar' }, '⚙ Opções')));

  const main = h('main', { class: 'views' });
  const side = h('aside', { class: 'summary' });
  app.append(header, h('div', { class: 'shell' }, main, side));

  function go(id) {
    current = id;
    for (const s of STEPS) { views[s.id].hidden = s.id !== id; stepBtns[s.id].classList.toggle('on', s.id === id); }
    try { sessionStorage.setItem('roclassic:view', id); } catch (e) { /* ok */ }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    schedule();
  }

  const card = (title, kids, cls, right) => h('section', { class: 'card ' + (cls || '') },
    title ? h('div', { class: 'card-h' }, h('h2', null, title), right || null) : null,
    h('div', { class: 'card-b' }, kids));

  /* ============================================================ PERSONAGEM */
  const vChar = views.char = h('div', { class: 'view' });

  // --- classe e nível
  const jobBtn = h('button', { type: 'button', class: 'job-pick', onclick: pickJob });
  onUpdate(() => {
    const name = selText('A_JOB');
    jobBtn.innerHTML = '';
    jobBtn.append(h('span', { class: 'emblem ' + jobTree(+val('A_JOB')) }, mono(name)),
      h('span', { class: 'job-txt' }, h('small', null, 'Classe'), h('b', null, name || '—')),
      h('span', { class: 'chev' }, '▾'));
  });

  function jobTree(j) {
    const n = (window.JobName && JobName[j] || '').toLowerCase();
    if (/sword|knight|crusader|paladin/.test(n)) return 't-sword';
    if (/thief|assassin|rogue|stalker|cross/.test(n)) return 't-thief';
    if (/acolyte|priest|monk|champion|bishop/.test(n)) return 't-aco';
    if (/archer|hunter|bard|dancer|sniper|clown|gypsy|minstrel/.test(n)) return 't-arch';
    if (/magician|mage|wizard|sage|scholar|professor/.test(n)) return 't-mage';
    if (/merchant|blacksmith|alchemist|whitesmith|creator|mastersmith|biochem/.test(n)) return 't-merc';
    if (/taekwon|star|soul|ninja|gunslinger|super/.test(n)) return 't-ext';
    return 't-nov';
  }
  function pickJob() {
    openPicker({
      title: 'Escolha a classe', layout: 'jobs', current: val('A_JOB'),
      items: opts('A_JOB').map((o) => ({ ...o, img: undefined, sub: '' })),
      onPick: (v) => { commit('A_JOB', v); toast('Classe alterada — equipamentos e atributos foram resetados pelo motor.'); },
    });
    // emblemas nos botões de classe
    modal.querySelectorAll('.pick-row').forEach((r, i) => {
      const o = opts('A_JOB')[i];
      r.prepend(h('span', { class: 'emblem sm ' + jobTree(+o.v) }, mono(o.t)));
    });
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

  const classCard = card('Classe & Nível', [
    jobBtn,
    h('div', { class: 'row gap' },
      lvl('A_BaseLV', 'Nível de base'),
      lvl('A_JobLV', 'Nível de classe')),
    h('div', { class: 'row gap wrap' },
      mirrorCheck('BLVauto', 'Ajustar nível pelos atributos', 'O motor sobe o nível de base sozinho para caber os pontos gastos'),
      mirrorCheck('A_adopted', 'Adotado (Baby)')),
    h('div', { class: 'kv-row' },
      h('div', null, h('small', null, 'Raça & Tamanho'), mirrorOut('A_BodySIZE')),
      h('div', null, h('small', null, 'Elemento do corpo'), mirrorOut('A_BodyELEMENT'))),
  ], 'c-class');

  // --- atributos
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
    range.addEventListener('input', () => { inp.value = range.value; range.style.setProperty('--p', ((range.value - range.min) / (range.max - range.min)) * 100 + '%'); });
    range.addEventListener('change', () => set(range.value));
    inp.addEventListener('change', () => set(inp.value));
    const step = (d) => h('button', { type: 'button', class: 'step-btn', onclick: () => set(+val(name) + d) }, d > 0 ? '+' : '−');
    onUpdate(() => {
      const o = opts(name).map((x) => +x.v);
      if (o.length) { range.min = Math.min(...o); range.max = Math.max(...o); }
      const v = val(name);
      if (document.activeElement !== inp) inp.value = v;
      range.value = v;
      range.style.setProperty('--p', ((v - range.min) / (range.max - range.min)) * 100 + '%');
      const b = txt(name + 'p').replace(/\s/g, '');
      bonus.textContent = b && b !== '+0' ? b : '';
    });
    return h('div', { class: 'stat' }, h('b', { class: 'stat-l' }, label), step(-1), range, step(1), inp, bonus);
  });
  const ptsOut = h('span', { class: 'pts' });
  onUpdate(() => { const p = num(txt('A_STPOINT')); ptsOut.textContent = isFinite(p) ? p : '—'; ptsOut.classList.toggle('neg', p < 0); });
  const statsCard = card('Atributos', [h('div', { class: 'stats' }, statRows)], 'c-stats', h('div', { class: 'pts-box' }, h('small', null, 'Pontos restantes'), ptsOut));

  // --- status derivados
  const DERIVED = [
    ['A_ATK2', 'ATK'], ['A_RealATK', 'ATK real'], ['A_MATK', 'MATK'], ['A_HIT', 'HIT'], ['A_CRI', 'Crítico'], ['A_ASPD', 'ASPD'],
    ['A_MaxHP', 'HP máx.'], ['A_MaxSP', 'SP máx.'], ['A_totalDEF', 'DEF'], ['A_MDEF', 'MDEF'], ['A_RealMDEF', 'MDEF real'], ['A_FLEE', 'Esquiva'],
    ['A_LUCKY', 'Esquiva perfeita'], ['A_PefHIT', 'Acerto perfeito'], ['A_CRITSHIELD', 'Escudo crítico'], ['A_WoeFLEE', 'Esquiva WoE'],
    ['A_HPR', 'Regen. HP'], ['A_SPR', 'Regen. SP'], ['A_cTime', 'Conjuração'], ['A_cDelay', 'Pós-conjuração'], ['A_MovSPEED', 'Velocidade'], ['A_Weight', 'Peso máx.'],
  ];
  const derivedCard = card('Status', [h('div', { class: 'derived' }, DERIVED.map(([id, l]) => h('div', { class: 'dv' }, h('small', null, l), mirrorOut(id, 'b'))))], 'c-derived');

  // --- equipamentos
  const SLOTS = [
    { k: 'head1', l: 'Topo', item: 'A_head1', ref: 'A_HEAD_REFINE', cards: ['A_head1_card'], extra: ['A_HSE_HEAD1'] },
    { k: 'head2', l: 'Meio', item: 'A_head2', cards: ['A_head2_card'] },
    { k: 'head3', l: 'Baixo', item: 'A_head3' },
    { k: 'body', l: 'Armadura', item: 'A_body', ref: 'A_BODY_REFINE', cards: ['A_body_card'], extra: ['A_HSE'] },
    { k: 'weapon', l: 'Arma', item: 'A_weapon1', ref: 'A_Weapon_refine', cards: ['A_weapon1_card1', 'A_weapon1_card2', 'A_weapon1_card3', 'A_weapon1_card4'], extra: ['A_Weapon_element', 'A_Arrow', 'A_cardshort'], big: true },
    { k: 'weapon2', l: 'Mão esquerda', item: 'A_weapon2', ref: 'A_Weapon2_refine', cards: ['A_weapon2_card1', 'A_weapon2_card2', 'A_weapon2_card3', 'A_weapon2_card4'], extra: ['A_cardshortLeft'], big: true, optional: true },
    { k: 'shield', l: 'Escudo', item: 'A_left', ref: 'A_LEFT_REFINE', cards: ['A_left_card'] },
    { k: 'garment', l: 'Capa', item: 'A_shoulder', ref: 'A_SHOULDER_REFINE', cards: ['A_shoulder_card'] },
    { k: 'shoes', l: 'Calçado', item: 'A_shoes', ref: 'A_SHOES_REFINE', cards: ['A_shoes_card'] },
    { k: 'acc1', l: 'Acessório 1', item: 'A_acces1', cards: ['A_acces1_card'] },
    { k: 'acc2', l: 'Acessório 2', item: 'A_acces2', cards: ['A_acces2_card'] },
  ];
  const EXTRA_LABEL = { A_Weapon_element: 'Elemento', A_Arrow: 'Munição', A_cardshort: 'Atalho de cartas', A_cardshortLeft: 'Atalho de cartas', A_HSE: 'Encantamento', A_HSE_HEAD1: 'Encantamento' };

  function pickItem(slot) {
    openPicker({
      title: `${slot.l} — escolher item`, current: val(slot.item), placeholder: 'Buscar por nome ou efeito…',
      items: opts(slot.item).map((o) => ({
        ...o, img: img.itemIcon(o.v), art: img.itemArt(o.v), sub: itemMeta(o.v) + (itemSlots(o.v) ? ` · [${itemSlots(o.v)}]` : ''),
        desc: () => itemDesc(o.v),
      })),
      onPick: (v) => commit(slot.item, v),
    });
  }
  function pickCard(name, slotLabel) {
    const onlyFree = h('span', { class: 'muted small' }, 'Arte das cartas: divine-pride.net');
    openPicker({
      title: `Carta — ${slotLabel}`, layout: 'cards', current: val(name), placeholder: 'Buscar carta…', extra: onlyFree,
      items: opts(name).map((o) => ({ ...o, img: o.v == 0 ? null : img.cardArt(o.v), k: (cardDesc(o.v) || '').replace(/<[^>]+>/g, ' ') })),
      onPick: (v) => commit(name, v),
    });
    // dica com efeito
    modal.querySelectorAll('.pick-row').forEach((r, i) => {
      const o = opts(name)[i];
      if (!o) return;
      const d = cardDesc(o.v).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
      if (d) r.title = d;
    });
  }

  function slotCard(slot) {
    const box = h('div', { class: 'slot s-' + slot.k + (slot.big ? ' big' : '') });
    const head = h('button', { type: 'button', class: 'slot-item', onclick: () => pickItem(slot) });
    const ref = slot.ref ? mirrorSelect(slot.ref, 'refine') : null;
    const sockets = h('div', { class: 'sockets' });
    const extras = (slot.extra || []).map((n) => h('label', { class: 'mini-field x-' + n }, h('small', null, EXTRA_LABEL[n] || n), mirrorSelect(n)));
    const desc = h('div', { class: 'slot-desc' });
    box.append(...[h('div', { class: 'slot-top' }, h('span', { class: 'slot-l' }, slot.l), ref ? h('span', { class: 'ref-wrap' }, ref) : null), head, sockets, extras.length ? h('div', { class: 'slot-extras' }, extras) : null, desc].filter(Boolean));

    let lastItem = null, lastCards = '';
    onUpdate(() => {
      const src = el(slot.item);
      box.hidden = !src;
      if (!src) return;
      box.classList.toggle('locked', !!src.disabled);
      const v = src.value;
      const name = selText(slot.item);
      if (v !== lastItem) {
        lastItem = v;
        head.innerHTML = '';
        const empty = /^\(.*\)$/.test(name.trim());
        head.classList.toggle('empty', empty);
        head.append(pic(empty ? null : img.itemArt(v) || img.itemIcon(v), name, 'art-sm'),
          h('span', { class: 'si-txt' }, h('b', null, empty ? 'Vazio' : name), h('small', null, empty ? 'Clique para equipar' : itemMeta(v))));
        const d = empty ? '' : itemDesc(v);
        desc.innerHTML = d;
        desc.hidden = !d;
      }
      // sockets
      const cs = (slot.cards || []).map((n) => el(n)).filter(Boolean);
      const sig = cs.map((x) => x.name + ':' + x.value + ':' + (x.disabled ? 1 : 0)).join('|');
      if (sig !== lastCards) {
        lastCards = sig;
        sockets.innerHTML = '';
        for (const s of cs) {
          if (s.disabled) continue;
          const cv = s.value;
          const cname = s.selectedIndex >= 0 ? s.options[s.selectedIndex].text : '';
          const emptyCard = cv == 0;
          sockets.append(h('button', { type: 'button', class: 'socket' + (emptyCard ? ' open' : ' filled'), title: emptyCard ? 'Slot livre — clique para inserir carta' : cname + '\n' + cardDesc(cv).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''), onclick: () => pickCard(s.name, slot.l) },
            emptyCard ? h('span', { class: 'plus' }, '+') : pic(img.cardArt(cv), cname, 'card-mini'),
            h('span', { class: 'sock-name' }, emptyCard ? 'Slot livre' : cname)));
        }
      }
    });
    return box;
  }
  const equipGrid = h('div', { class: 'equip' }, SLOTS.map(slotCard));
  const equipCard = card('Equipamentos & Cartas', [equipGrid], 'c-equip',
    h('div', { class: 'row gap' }, mirrorCheck('restrict_cardslot', 'Respeitar nº de slots do item'), mirrorCheck('restrict_equipslot', 'Bloquear slots ocupados')));

  // --- runas (em breve)
  const runeCard = card('Runas', [
    h('div', { class: 'soon' }, h('div', { class: 'rune-orb' }, 'ᚱ'),
      h('div', null, h('b', null, 'Sistema de runas do servidor'), h('p', { class: 'muted' }, 'Espaço reservado para as runas dos equipamentos dropáveis. Assim que as regras forem definidas, elas entram aqui e somam no cálculo.'))),
  ], 'c-runes');

  // --- passivas, buffs, consumíveis (painéis originais)
  const passTable = tableOf('P_Skill0');
  const acc = (title, node, open) => {
    const d = h('details', { class: 'acc', open: open || null }, h('summary', null, title), h('div', { class: 'acc-b' }, adopt(node)));
    return d;
  };
  const buffsCard = card('Habilidades passivas, buffs & itens', [
    h('p', { class: 'muted small' }, 'Painéis do motor original. Em alguns, clique no título interno para expandir as opções.'),
    acc('Passivas & habilidades próprias', passTable, true),
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
    h('div', { class: 'next' }, h('button', { type: 'button', class: 'btn primary', onclick: () => go('target') }, 'Próximo: escolher alvo →')));

  /* ================================================================= ALVO */
  const vTarget = views.target = h('div', { class: 'view', hidden: true });
  const raceName = (r) => (window.v_Race_ && v_Race_[r]) || '';
  const elemName = (e) => ((window.v_Element_ && v_Element_[Math.floor(e / 10)]) || '').trim() + ' ' + (e % 10);
  const sizeName = (s) => ['Pequeno', 'Médio', 'Grande'][s] || '';
  const RACE_PT = { Formless: 'Amorfo', Undead: 'Morto-vivo', Brute: 'Bruto', Plant: 'Planta', Insect: 'Inseto', Fish: 'Peixe', Demon: 'Demônio', 'Demi-Human': 'Humanoide', Angel: 'Anjo', Dragon: 'Dragão' };
  const ELEM_PT = { Neutral: 'Neutro', Water: 'Água', Earth: 'Terra', Fire: 'Fogo', Wind: 'Vento', Poison: 'Veneno', Holy: 'Sagrado', Shadow: 'Sombrio', Ghost: 'Fantasma', Undead: 'Maldito' };
  const ptRace = (r) => RACE_PT[raceName(r)] || raceName(r);
  const ptElem = (e) => { const [n, l] = elemName(e).split(' '); return (ELEM_PT[n] || n) + ' ' + (l || ''); };
  const elemCls = (e) => 'el-' + Math.floor(e / 10);

  const mobSearch = h('input', { type: 'search', class: 'search', placeholder: 'Buscar monstro pelo nome…', autocomplete: 'off' });
  const mobGrid = h('div', { class: 'mob-grid' });
  const mobCount = h('span', { class: 'muted small' });
  let mobSig = '';
  function mobCardEl(o) {
    const m = window.m_Monster && m_Monster[o.v];
    const name = m ? m[1] : o.t;
    const b = h('button', { type: 'button', class: 'mob', 'data-v': o.v, onclick: () => { commit('B_Enemy', o.v); } },
      pic(img.mob(o.v), name, 'mob-img'),
      h('span', { class: 'mob-name' }, name),
      m ? h('span', { class: 'mob-sub' }, `Nv ${m[5]} · ${fmt(m[6])} HP`) : null,
      m ? h('span', { class: 'mob-tags' },
        h('i', { class: 'tag ' + elemCls(m[3]) }, ptElem(m[3])),
        h('i', { class: 'tag' }, ptRace(m[2])),
        h('i', { class: 'tag' }, sizeName(m[4])),
        m[19] == 1 ? h('i', { class: 'tag boss' }, 'Chefe') : null) : null);
    b._key = norm(name + ' ' + o.t);
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

  // detalhe do alvo
  const tDetail = h('div', { class: 'target-detail' });
  const T_FIELDS = [['B_6', 'HP máx.'], ['B_12', 'ATK mín.'], ['B_13', 'ATK máx.'], ['B_14', 'DEF'], ['B_23', 'DEF (VIT)'], ['B_15', 'MDEF'], ['B_25', 'MDEF (INT)'],
    ['B_agi', 'AGI'], ['B_vit', 'VIT'], ['B_int', 'INT'], ['B_dex', 'DEX'], ['B_luk', 'LUK'], ['B_21', 'HIT p/ 100%'], ['B_22', 'FLEE p/ 95%'], ['B_16', 'EXP base'], ['B_17', 'EXP classe']];
  let tSig = '';
  onUpdate(() => {
    const v = val('B_Enemy');
    const m = window.m_Monster && m_Monster[v];
    const sig = v + '|' + T_FIELDS.map(([id]) => txt(id)).join('|') + txt('B_2') + txt('B_3') + txt('B_4') + txt('B_type');
    if (sig === tSig) return;
    tSig = sig;
    tDetail.innerHTML = '';
    tDetail.append(
      h('div', { class: 'td-hero' },
        pic(img.mob(v), m ? m[1] : selText('B_Enemy'), 'mob-hero'),
        h('div', null,
          h('small', { class: 'muted' }, 'Alvo selecionado'),
          h('h3', null, m ? m[1] : selText('B_Enemy')),
          h('div', { class: 'mob-tags' },
            m ? h('i', { class: 'tag ' + elemCls(m[3]) }, ptElem(m[3])) : null,
            h('i', { class: 'tag', html: txt('B_2') || '—' }),
            h('i', { class: 'tag', html: txt('B_4') || '—' }),
            txt('B_type') ? h('i', { class: 'tag', html: txt('B_type') }) : null),
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
  const envCard = card('Ambiente', [
    h('div', { class: 'row gap wrap' },
      h('label', { class: 'mini-field' }, h('small', null, 'Ambiente'), mirrorSelect('A8_Skill14')),
      h('label', { class: 'mini-field' }, h('small', null, 'Investimento de defesa (WoE)'), mirrorSelect('A8_Skill15'))),
  ]);
  const enemyFx = card('Efeitos no alvo', [
    acc('Debuffs no alvo', byId('EnemyDebuf'), true),
    acc('Buffs no alvo', byId('EnemyBuf')),
    acc('Edição manual do alvo', byId('B_MANUAL')),
  ], 'c-enemyfx');
  vTarget.append(h('div', { class: 'grid-2 t-top' }, card('Alvo atual', [tDetail], 'c-tdetail'), h('div', { class: 'col' }, envCard, enemyFx)),
    targetCard,
    h('div', { class: 'next' }, h('button', { type: 'button', class: 'btn', onclick: () => go('char') }, '← Personagem'), h('button', { type: 'button', class: 'btn primary', onclick: () => go('sim') }, 'Próximo: simular →')));

  /* ============================================================ SIMULAÇÃO */
  const vSim = views.sim = h('div', { class: 'view', hidden: true });
  const skillList = h('div', { class: 'skills' });
  const skillSearch = h('input', { type: 'search', class: 'search', placeholder: 'Buscar habilidade…', autocomplete: 'off' });
  let skSig = '';
  function filterSkills() {
    const q = norm(skillSearch.value).split(/\s+/).filter(Boolean);
    for (const b of skillList.children) b.hidden = !q.every((w) => b._key.includes(w));
  }
  skillSearch.addEventListener('input', filterSkills);
  onUpdate(() => {
    const o = opts('A_ActiveSkill');
    const sig = o.map((x) => x.v + x.t).join('|');
    if (sig !== skSig) {
      skSig = sig;
      skillList.innerHTML = '';
      for (const x of o) {
        if (x.d) { skillList.append(h('div', { class: 'sk-sep' }, x.t.replace(/-/g, '').trim())); skillList.lastChild._key = ''; continue; }
        const b = h('button', { type: 'button', class: 'sk' + (x.v == '0' ? ' basic' : ''), 'data-v': x.v, onclick: () => commit('A_ActiveSkill', x.v) },
          h('span', { class: 'sk-ico' }, x.v == '0' ? '⚔' : mono(x.t)), h('span', null, x.v == '0' ? 'Ataque básico' : x.t));
        b._key = norm(x.t + (x.v == '0' ? ' ataque basico' : ''));
        skillList.append(b);
      }
      filterSkills();
    }
    const cur = val('A_ActiveSkill');
    for (const b of skillList.children) if (b.dataset) b.classList.toggle('is-sel', b.dataset.v === cur);
  });

  const lvSel = mirrorSelect('A_ActiveSkillLV', 'lv');
  const skillCard = card('Habilidade', [
    h('div', { class: 'row gap wrap' }, h('div', { class: 'grow' }, skillSearch), h('label', { class: 'mini-field' }, h('small', null, 'Nível'), lvSel),
      mirrorCheck('all_dmgSkills', 'Mostrar todas as habilidades de dano')),
    skillList,
    h('div', { class: 'aa-skill' }, adopt(byId('AASkill'), 'inline')),
  ], 'c-skills');

  // resultados
  const LABEL_PT = {
    'Minimum Damage': 'Dano mínimo', 'Average Damage': 'Dano médio', 'Maximum Damage': 'Dano máximo',
    'Damage Per Second': 'Dano por segundo', 'Minimum Number of Hits': 'Golpes p/ matar (mín.)', 'Average Number of Hits': 'Golpes p/ matar (média)',
    'Maximum Number of Hits': 'Golpes p/ matar (máx.)', 'Average Battle Duration': 'Duração média da luta', 'Base Exp per Hit': 'EXP base por golpe',
    'Job Exp per Hit': 'EXP classe por golpe', "Player's Hit Ratio": 'Chance de acerto', 'Attack Element': 'Elemento do ataque',
    'Weapon/Skill Size Modifier': 'Modificador de tamanho', 'Critical Damage (Critical Rate)': 'Dano crítico (chance)', 'Cast Time': 'Tempo de conjuração',
    'Time/Hit': 'Tempo por golpe', 'Damage Backslash': 'Dano refletido', 'Minimum Heal': 'Cura mínima', 'Average Heal': 'Cura média', 'Maximum Heal': 'Cura máxima',
    "Player's Dodge Ratio": 'Sua chance de esquiva', 'Enemy Attack Element': 'Elemento do ataque inimigo', 'Minimum Damage Received': 'Dano recebido (mín.)',
    'Average Damage Received': 'Dano recebido (médio)', 'Maximum Damage Received': 'Dano recebido (máx.)', 'Average Dmg Received (w/dodge)': 'Dano médio recebido (c/ esquiva)',
  };
  const lab = (id, fallback) => { const t = txt(id); return LABEL_PT[t] || t || fallback || ''; };

  const dmgHero = h('div', { class: 'dmg-hero' });
  const dmgBar = h('div', { class: 'dmg-bar' });
  const detailGrid = h('div', { class: 'res-grid' });
  const recvGrid = h('div', { class: 'res-grid' });
  const killBox = h('div', { class: 'kill' });

  const RES_ROWS = [
    ['nm053', 'BattleHIT', '%'], ['CRIATKname', ['CRIATK', 'CRInum']], ['nm074', 'A_WeaponElement'], ['nm076', 'A_WeaponSize'],
    ['bSUBname', 'bSUB'], ['bSUB2name', 'bSUB2'], ['nm058', 'AveSecondATK'], ['nm062', 'BattleTime'], ['bSUB3name', 'bSUB3'],
    ['bREFLECT1name', 'bREFLECT1'], ['bREFLECT2name', 'bREFLECT2'], ['nm063', 'AtkBaseExp'], ['nm064', 'AtkJobExp'],
  ];
  const RECV_ROWS = [['nm054', 'BattleFLEE', '%'], ['nm075', 'B_WeaponElement'], ['nm067', 'B_MinAtk'], ['nm065', 'B_AveAtk'], ['nm068', 'B_MaxAtk'], ['nm066', 'B_Ave2Atk'], ['aREFLECT1name', 'aREFLECT1'], ['aREFLECT2name', 'aREFLECT2']];
  const rowsOut = (rows, grid) => {
    grid.innerHTML = '';
    for (const [lid, vid, suf] of rows) {
      const ids = Array.isArray(vid) ? vid : [vid];
      const v = ids.map(htm).join(' ').trim();
      const l = lab(lid);
      if (!l || !v.replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/g, '').trim()) continue;
      grid.append(h('div', { class: 'res' }, h('small', null, l), h('b', { html: v + (suf || '') })));
    }
  };

  let resSig = '';
  onUpdate(() => {
    const ids = ['strID_0', 'strID_1', 'strID_2', 'MinATKnum', 'AveATKnum', 'MaxATKnum', 'B_6', ...RES_ROWS.flatMap((r) => [r[0]].concat(r[1])), ...RECV_ROWS.flatMap((r) => [r[0], r[1]])];
    const sig = ids.map(htm).join('\u0001');
    if (sig === resSig) return;
    resSig = sig;
    const mn = num(txt('strID_0')), av = num(txt('strID_1')), mx = num(txt('strID_2'));
    const skill = val('A_ActiveSkill') == '0' ? 'Ataque básico' : selText('A_ActiveSkill');
    dmgHero.innerHTML = '';
    dmgHero.append(
      h('div', { class: 'dh-skill' }, h('small', null, 'Simulando'), h('b', null, skill), h('span', { class: 'muted' }, ' em ' + (window.m_Monster && m_Monster[val('B_Enemy')] ? m_Monster[val('B_Enemy')][1] : selText('B_Enemy')))),
      h('div', { class: 'dh-nums' },
        h('div', { class: 'dh min' }, h('small', null, lab('nm055', 'Dano mínimo')), h('b', null, fmt(mn)), h('span', { class: 'dh-raw', html: htm('strID_0') })),
        h('div', { class: 'dh avg' }, h('small', null, lab('nm056', 'Dano médio')), h('b', null, fmt(av)), h('span', { class: 'dh-raw', html: htm('strID_1') })),
        h('div', { class: 'dh max' }, h('small', null, lab('nm057', 'Dano máximo')), h('b', null, fmt(mx)), h('span', { class: 'dh-raw', html: htm('strID_2') }))));
    // barra relativa ao HP do alvo
    const hp = num(txt('B_6'));
    dmgBar.innerHTML = '';
    if (isFinite(hp) && hp > 0 && isFinite(mx)) {
      const pct = (x) => Math.max(0, Math.min(100, (x / hp) * 100));
      dmgBar.append(
        h('div', { class: 'bar' },
          h('span', { class: 'bar-range', style: { left: pct(mn) + '%', width: Math.max(0.6, pct(mx) - pct(mn)) + '%' } }),
          h('span', { class: 'bar-avg', style: { left: pct(av) + '%' } })),
        h('div', { class: 'bar-l' }, h('span', null, '0'), h('span', null, `${pct(av).toFixed(1)}% do HP por golpe (média)`), h('span', null, fmt(hp) + ' HP')));
    }
    killBox.innerHTML = '';
    killBox.append(
      h('div', { class: 'k' }, h('small', null, 'Golpes p/ matar'), h('b', { html: htm('AveATKnum') || '—' }), h('span', { class: 'muted small', html: `mín. ${htm('MinATKnum') || '—'} · máx. ${htm('MaxATKnum') || '—'}` })));
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

  main.append(vChar, vTarget, vSim);

  /* ================================================================ RESUMO */
  onUpdate(() => {
    const m = window.m_Monster && m_Monster[val('B_Enemy')];
    const av = num(txt('strID_1'));
    side.innerHTML = '';
    side.append(
      h('div', { class: 'sum-card sum-char', onclick: () => go('char') },
        h('span', { class: 'emblem ' + jobTree(+val('A_JOB')) }, mono(selText('A_JOB'))),
        h('div', null, h('b', null, selText('A_JOB')), h('small', null, `Nv ${val('A_BaseLV')} / ${val('A_JobLV')}`))),
      h('div', { class: 'sum-stats' },
        [['ATK', 'A_ATK2'], ['MATK', 'A_MATK'], ['HIT', 'A_HIT'], ['CRIT', 'A_CRI'], ['ASPD', 'A_ASPD'], ['HP', 'A_MaxHP'], ['SP', 'A_MaxSP'], ['FLEE', 'A_FLEE']]
          .map(([l, id]) => h('div', null, h('small', null, l), h('b', null, txt(id) || '—')))),
      h('div', { class: 'sum-card sum-target', onclick: () => go('target') },
        pic(img.mob(val('B_Enemy')), m ? m[1] : selText('B_Enemy'), 'mob-sm'),
        h('div', null, h('small', null, 'Alvo'), h('b', null, m ? m[1] : selText('B_Enemy')), m ? h('small', null, `${ptElem(m[3])} · ${ptRace(m[2])} · ${sizeName(m[4])}`) : null)),
      h('div', { class: 'sum-dmg', onclick: () => go('sim') },
        h('small', null, val('A_ActiveSkill') == '0' ? 'Ataque básico' : selText('A_ActiveSkill')),
        h('b', null, fmt(av)),
        h('small', null, isFinite(num(txt('AveATKnum'))) && !/over/i.test(txt('AveATKnum')) ? `dano médio · ${txt('AveATKnum')} golpes p/ matar` : `dano médio · ${(txt('AveATKnum') || '—').replace(/Over/i, 'mais de').replace(/hits/i, 'golpes')}`)));
  });

  /* =========================================================== OPÇÕES */
  function openSettings() {
    modal.innerHTML = '';
    const imp = h('input', { type: 'text', class: 'search', placeholder: 'Cole aqui um link salvo do rocalc.com (ou de outra calc compatível)' });
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
        h('p', { class: 'muted small' }, 'A build atual fica salva automaticamente no link da página (pode favoritar ou compartilhar).'),
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
        h('p', { class: 'muted small', html: 'Motor de cálculo: <a href="https://rocalc.com" target="_blank" rel="noopener">rocalc.com</a> — simulador original de ROratorio, tradução/adaptação de Doddler, atualizações de Gandi, Triper e kurimet. Imagens: divine-pride.net. Ragnarok Online © Gravity Co.' })));
    modal.append(box);
    modal.hidden = false;
    document.body.classList.add('noscroll');
    schedule();
  }
  // selects dentro do modal (criados sob demanda; atualizam uma vez)
  function mirrorSelectNow(name, after) {
    const s = h('select', { class: 'sel' });
    for (const x of opts(name)) s.append(h('option', { value: x.v, disabled: x.d || null }, x.t));
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

  function shareLink() {
    silentURLOUT();
    const url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link da build copiado!'), () => { prompt('Copie o link:', url); });
  }

  /* ================================================================= BOOT */
  try { window.LoadTheme(); } catch (e) { /* tema original é ignorado pelo CSS */ }
  // Restaura a última build quando a página abre sem link.
  try {
    if (!/[#?]/.test(location.href)) {
      const last = localStorage.getItem('roclassic:last');
      if (last && last.length > 2) { byId('otherURL_TEXT').value = location.href.split('#')[0] + last; window.URLIN(1); }
    }
  } catch (e) { console.warn('[boot]', e); }
  // Por padrão a quantidade de cartas respeita os slots do item.
  try {
    let pref = null;
    try { pref = localStorage.getItem('roclassic:cardslot'); } catch (e) { /* ok */ }
    const rc = el('restrict_cardslot');
    if (rc && pref !== '0' && !rc.checked) { rc.checked = true; window.restrictCardslot(0); }
    rc && rc.addEventListener('click', () => { try { localStorage.setItem('roclassic:cardslot', rc.checked ? '1' : '0'); } catch (e) { /* ok */ } });
  } catch (e) { console.warn(e); }

  safeCalc();
  let startView = 'char';
  try { startView = sessionStorage.getItem('roclassic:view') || 'char'; } catch (e) { /* ok */ }
  go(views[startView] ? startView : 'char');
  booting = false;
  window.ROCLASSIC = { schedule, commit, go };
})();
