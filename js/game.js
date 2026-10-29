/* ============================================================
   深渊无尽 · TALENT HUNTER
   A single-canvas endless dungeon roguelite.
   ============================================================ */
(() => {
  'use strict';

  /* ============================================================
     Utilities & constants
     ============================================================ */
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (min, max) => min + Math.random() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const uid = (() => { let n = 1; return () => `u${n++}_${Math.random().toString(36).slice(2, 7)}`; })();

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function weightedPick(entries, rng = Math.random) {
    let total = 0;
    for (const e of entries) total += e.weight;
    let roll = rng() * total;
    for (const e of entries) {
      roll -= e.weight;
      if (roll <= 0) return e.value ?? e;
    }
    return entries[entries.length - 1].value ?? entries[entries.length - 1];
  }

  function hash2(x, y, seed = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fmt(n, decimals = 0) {
    if (!Number.isFinite(n)) return '0';
    if (Math.abs(n) >= 1e8) return (n / 1e8).toFixed(1) + '亿';
    if (Math.abs(n) >= 1e5) return (n / 1e4).toFixed(1) + '万';
    if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString('en-US');
    return decimals ? n.toFixed(decimals) : Math.round(n).toString();
  }

  function fmtTime(seconds) {
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const CFG = {
    tile: 64,
    chunkTiles: 8,
    chunkSize: 512,
    playerRadius: 14,
    baseSpeed: 238,
    baseAttackInterval: 0.8,
    baseAttackRange: 340,
    dashCooldown: 2.4,
    dashTime: 0.16,
    dashSpeed: 950,
    maxEnemiesBase: 24,
    saveKey: 'abyss_talent_hunter_save_v1',
    version: 1
  };

  const DROP_RATES = {
    equipment: 0.12,
    skill: 0.12 * 0.2,
    orb: 0.12 * 0.2 * 0.2,
    classBook: 0.001,
    health: 0.03
  };

  const SKILL_SLOT_COSTS = [600, 1800, 5000, 12000];
  const MAX_SKILL_SLOTS = 8;

  const STAT_LABELS = {
    attack: '攻击力', maxHp: '生命上限', defense: '防御', crit: '暴击率',
    critDamage: '暴击伤害', haste: '技能急速', attackSpeed: '攻击速度',
    skillPower: '技能增伤', moveSpeed: '移动速度', goldFind: '金币获取',
    lifeOnHit: '击中回复', xpBonus: '经验获取', attackPct: '攻击增幅',
    hpPct: '生命增幅', allDamage: '全部伤害', thorns: '反伤',
    execute: '处决增伤', bossDamage: '领主增伤', eliteDamage: '精英增伤',
    regenPct: '每秒回复', pickupRadius: '拾取范围', damageReduction: '伤害减免',
    lifeSteal: '生命偷取', reviveCharges: '灵魂复生'
  };

  const STAT_SCORE = {
    attack: 8, maxHp: 0.55, defense: 4.2, crit: 18, critDamage: 3,
    haste: 13, attackSpeed: 12, skillPower: 10, moveSpeed: 6,
    goldFind: 1.5, lifeOnHit: 2, xpBonus: 1, attackPct: 6, hpPct: 3,
    allDamage: 8, thorns: 3, execute: 2.5, bossDamage: 4, eliteDamage: 3,
    regenPct: 40, pickupRadius: 0.4, damageReduction: 35, lifeSteal: 24,
    reviveCharges: 220
  };

  /* ============================================================
     Audio — small synthesized SFX, no external assets
     ============================================================ */
  const audio = {
    ctx: null,
    master: null,
    enabled: true,
    last: {},
    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.15;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    resume() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    blip(freq, endFreq, duration, type, volume, delay = 0) {
      if (!this.enabled || !this.ctx) return;
      const t0 = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(volume || 0.06, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + duration + 0.02);
    },
    play(name) {
      if (!this.enabled || !this.ctx) return;
      const now = performance.now();
      const throttle = { hit: 35, shoot: 55, coin: 60, hurt: 110, pickup: 60 };
      if (this.last[name] && now - this.last[name] < (throttle[name] || 30)) return;
      this.last[name] = now;
      switch (name) {
        case 'shoot': this.blip(620, 300, 0.07, 'triangle', 0.035); break;
        case 'skill': this.blip(380, 640, 0.13, 'sine', 0.055); break;
        case 'hit': this.blip(150, 60, 0.06, 'square', 0.025); break;
        case 'crit': this.blip(560, 180, 0.1, 'sawtooth', 0.05); break;
        case 'hurt': this.blip(120, 55, 0.15, 'sawtooth', 0.07); break;
        case 'coin': this.blip(880, 1320, 0.055, 'sine', 0.035); break;
        case 'pickup': this.blip(520, 980, 0.15, 'sine', 0.05); break;
        case 'rare': this.blip(680, 980, 0.18, 'triangle', 0.06); this.blip(980, 1320, 0.2, 'sine', 0.04, 0.08); break;
        case 'orb': this.blip(320, 760, 0.4, 'sine', 0.07); this.blip(760, 1180, 0.5, 'triangle', 0.045, 0.1); break;
        case 'level': this.blip(330, 440, 0.18, 'triangle', 0.06); this.blip(440, 660, 0.22, 'triangle', 0.055, 0.12); this.blip(660, 880, 0.3, 'sine', 0.05, 0.24); break;
        case 'dash': this.blip(240, 100, 0.12, 'triangle', 0.04); break;
        case 'boss': this.blip(62, 40, 0.75, 'sawtooth', 0.11); this.blip(92, 58, 0.8, 'triangle', 0.075, 0.12); break;
        case 'bossdie': this.blip(180, 42, 0.75, 'sawtooth', 0.08); this.blip(320, 70, 0.6, 'triangle', 0.05, 0.15); break;
        case 'buy': this.blip(700, 880, 0.12, 'triangle', 0.05); this.blip(900, 1200, 0.16, 'sine', 0.045, 0.1); break;
        case 'death': this.blip(150, 35, 1.1, 'sawtooth', 0.1); break;
        case 'revive': this.blip(220, 880, 0.8, 'sine', 0.08); break;
        case 'click': this.blip(480, 360, 0.035, 'sine', 0.025); break;
      }
    },
    toggle() {
      this.enabled = !this.enabled;
      if (this.master) this.master.gain.value = this.enabled ? 0.15 : 0;
      return this.enabled;
    }
  };

  /* ============================================================
     DOM references & runtime state
     ============================================================ */
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');

  let viewW = window.innerWidth;
  let viewH = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const game = {
    state: 'title',
    modalReturnState: 'title',
    speed: 1,
    ascended: false,
    ascensionNoticeShown: false,
    ascensionNoticePending: false,
    classChoice: null,
    time: 0,
    ambient: 0,
    worldSeed: (Math.random() * 2147483647) | 0,
    player: null,
    camera: { x: 0, y: 0, shake: 0 },
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    effects: [],
    loot: [],
    particles: [],
    damageTexts: [],
    obstacles: new Map(),
    featureCache: new Map(),
    decorations: new Map(),
    lights: [],
    keys: new Set(),
    joystick: { x: 0, y: 0, active: false },
    enemiesKilled: 0,
    bossesKilled: 0,
    runTime: 0,
    spawnTimer: 0.4,
    bossTimer: 75,
    boss: null,
    bossWarned: false,
    bossSpawnCount: 0,
    pendingDrafts: 0,
    draft: null,
    draftMode: 'start',
    hoverTargetId: null,
    selectedSkillSlot: 0,
    lastFrame: 0,
    lastSave: 0,
    lastHud: 0,
    lastMinimap: 0,
    zoneBand: 0,
    locationBannerTimer: 0,
    bossAnnounceTimer: 0,
    newRun: true,
    dashing: false,
    basicAttackCount: 0,
    skillHealTimer: 0,
    autoEquip: true,
    saveOk: true,
    dust: [],
    debug: typeof URLSearchParams !== 'undefined' && new URLSearchParams(location.search).has('debug')
  };

  /* ============================================================
     Player construction & derived stats
     ============================================================ */
  function createPlayer() {
    return {
      x: 0, y: 0,
      radius: CFG.playerRadius,
      level: 1,
      xp: 0,
      xpNext: 44,
      hp: 320,
      shield: 0,
      shieldTimer: 0,
      gold: 0,
      kills: 0,
      bossKills: 0,
      deepest: 0,
      playTime: 0,
      talents: {},
      equipment: { weapon: null, armor: null, ring: null, amulet: null },
      inventory: [],
      skills: [],
      equipped: [],
      skillCooldowns: [],
      slots: 4,
      classBooks: [],
      classTalents: {},
      currentClass: null,
      ascended: false,
      stats: null,
      facing: 0,
      walkPhase: 0,
      moving: false,
      attackTimer: 0,
      dashCooldown: 0,
      dashTime: 0,
      dashDir: { x: 0, y: -1 },
      invuln: 0,
      hitFlash: 0,
      skillHealCd: 0,
      reviveUsed: 0,
      revives: 0,
      auraAngle: 0,
      lastHitBy: null,
      hitComboTimer: 0
    };
  }

  function itemStat(item, key) {
    return item && item.stats && item.stats[key] ? item.stats[key] : 0;
  }

  function deriveStats(p, hpMode = 'ratio') {
    const oldStats = p.stats;
    const oldMax = oldStats ? oldStats.maxHp : p.hp;
    const oldHp = p.hp;

    const baseHp = 320 + (p.level - 1) * 33;
    const baseAtk = 16 + (p.level - 1) * 2.35;
    const baseDef = 4 + (p.level - 1) * 0.7;
    let s = {
      maxHp: baseHp, attack: baseAtk, defense: baseDef,
      crit: 5, critDamage: 150, attackSpeed: 0, haste: 0,
      skillPower: 0, moveSpeed: 0,
      damageReduction: 0, allDamage: 0, goldFind: 0, xpBonus: 0,
      lifeOnHit: 0, killHeal: 0, reviveCharges: 0, skillHeal: 0,
      explosionPct: 0, rangeBonus: 0,
      attackPct: 0, hpPct: 0, thorns: 0, dodge: 0, regenPct: 0,
      execute: 0, bossDamage: 0, eliteDamage: 0, lifeSteal: 0,
      pickupRadius: 0, dashCooldownReduction: 0,
      attackMult: 1, hpMult: 1, critDamageMult: 1, skillMult: 1,
      thornsMult: 1, hasHighThorns: false
    };

    const addFlat = (key, value) => { s[key] = (s[key] || 0) + value; };
    const addPct = (key, value) => { s[key] = (s[key] || 0) + value; };

    for (const slot of ['weapon', 'armor', 'ring', 'amulet']) {
      const item = p.equipment[slot];
      if (!item) continue;
      for (const [k, v] of Object.entries(item.stats || {})) {
        if (['crit', 'critDamage', 'haste', 'attackSpeed', 'skillPower', 'moveSpeed', 'goldFind', 'xpBonus'].includes(k)) addPct(k, v);
        else addFlat(k, v);
      }
    }

    // All talent modifiers are data-driven. Multiplicative S+ talents
    // compound by floor, while the F–A grade modifiers are additive.
    for (const [id, count] of Object.entries(p.talents || {})) {
      if (!count) continue;
      const talent = TALENT_BY_ID[id];
      if (!talent || !talent.effects) continue;
      for (const [key, perStack] of Object.entries(talent.effects)) {
        if (['attackMult', 'hpMult', 'critDamageMult', 'skillMult', 'thornsMult'].includes(key)) {
          s[key] *= Math.pow(perStack, count);
          if (key === 'thornsMult') s.hasHighThorns = true;
        } else {
          s[key] = (s[key] || 0) + perStack * count;
        }
      }
    }

    // 转职天赋：每次转职获得的永久职业加成。
    for (const [classId, entry] of Object.entries(p.classTalents || {})) {
      const cls = CLASS_BY_ID[classId];
      const power = Number(entry?.power) || 0;
      if (!cls || power <= 0) continue;
      for (const [key, perPower] of Object.entries(cls.mods || {})) {
        s[key] = (s[key] || 0) + perPower * power;
      }
    }

    s.maxHp = Math.round(s.maxHp * (1 + s.hpPct / 100) * s.hpMult);
    s.attack = Math.round(s.attack * (1 + s.attackPct / 100) * s.attackMult);
    s.defense = Math.round(s.defense);
    s.crit = clamp(s.crit / 100, 0, 0.85);
    s.critDamage = (s.critDamage / 100) * s.critDamageMult;
    s.attackSpeed = s.attackSpeed / 100;
    s.haste = s.haste / 100;
    s.skillPower = s.skillPower / 100;
    s.moveSpeed = Math.round(CFG.baseSpeed * (1 + (s.moveSpeed || 0) / 100));
    s.damageReduction = clamp(s.damageReduction / 100, 0, 0.72);
    s.allDamage = (s.allDamage || 0) / 100;
    s.goldFind = s.goldFind / 100;
    s.xpBonus = s.xpBonus / 100;
    s.killHeal = s.killHeal / 100;
    s.skillHeal = s.skillHeal / 100;
    s.explosionPct = (s.explosionPct || 0) / 100;
    s.thorns = Math.max(0, (s.thorns || 0) / 100 + (s.hasHighThorns ? s.thornsMult : 0));
    s.dodge = clamp((s.dodge || 0) / 100, 0, 0.6);
    s.regenPct = (s.regenPct || 0) / 100;
    s.execute = (s.execute || 0) / 100;
    s.bossDamage = (s.bossDamage || 0) / 100;
    s.eliteDamage = (s.eliteDamage || 0) / 100;
    s.lifeSteal = (s.lifeSteal || 0) / 100;
    s.dashCooldownReduction = clamp((s.dashCooldownReduction || 0) / 100, 0, 0.5);
    s.pickupRadius = s.pickupRadius || 0;
    s.revives = s.reviveCharges || 0;

    p.stats = s;
    p.revives = Math.max(0, s.revives - p.reviveUsed);

    if (hpMode === 'ratio' && oldStats) {
      p.hp = clamp(oldMax > 0 ? oldHp / oldMax : 1, 0, 1) * s.maxHp;
    } else if (hpMode === 'full') {
      p.hp = s.maxHp;
    } else {
      p.hp = clamp(p.hp, 1, s.maxHp);
    }
    if (p.hp <= 0 && !p.dead) p.hp = 1;
    return s;
  }

  function xpToNext(level) {
    return Math.floor(24 + 20 * Math.pow(level, 1.4));
  }

  function skillCd(skill) {
    const haste = game.player?.stats?.haste || 0;
    return Math.max(0.35, skill.cd / (1 + haste));
  }

  function skillPowerOf(skill) {
    const rarity = RARITIES[skill.rarity] || RARITIES.common;
    return (1 + (skill.level - 1) * 0.035 + rarity.index * 0.1) * (skill.coeff || 1);
  }

  function equippedSkillAt(index) {
    return game.player.equipped[index] || null;
  }

  /* ============================================================
     Item / skill / talent generation
     ============================================================ */
  function rollRarity(level = 1, minIndex = 0) {
    const depth = Math.max(0, level - 1);
    const depthFactor = [1, 1.02, 1.05, 1.09, 1.13, 1.18, 1.25];
    const entries = RARITY_LIST
      .filter(r => r.index >= minIndex)
      .map(r => ({
        value: r.key,
        weight: r.weight * Math.pow(depthFactor[r.index], depth * 0.5)
      }));
    return weightedPick(entries);
  }

  function rollTalentGrade(exclude = []) {
    const entries = TALENT_GRADE_LIST
      .filter(g => !exclude.includes(g.key))
      .map(g => ({ value: g.key, weight: g.weight }));
    if (!entries.length) return pick(TALENT_GRADE_LIST).key;
    return weightedPick(entries);
  }

  function rollDistinctTalentGrades(count) {
    const grades = [];
    while (grades.length < count) {
      const grade = rollTalentGrade(grades);
      grades.push(grade);
    }
    return grades;
  }

  function makeEquipment(slot, level, rarityKey) {
    const rarity = RARITIES[rarityKey] || RARITIES.common;
    const stats = {};
    const add = (key, val) => {
      if (!Number.isFinite(val)) return;
      const rounded = ['maxHp', 'attack', 'defense', 'lifeOnHit'].includes(key)
        ? Math.max(1, Math.round(val)) : Math.round(val * 10) / 10;
      stats[key] = (stats[key] || 0) + rounded;
    };
    const l = Math.max(1, level);
    const m = rarity.mult;
    const variance = rand(0.92, 1.08);

    if (slot === 'weapon') {
      add('attack', (4 + l * 1.65) * m * variance);
      if (rarity.index >= 2) add('crit', (0.5 + l * 0.02) * (rarity.index - 1));
    } else if (slot === 'armor') {
      add('maxHp', (22 + l * 6.4) * m * variance);
      add('defense', (1 + l * 0.85) * m);
    } else if (slot === 'ring') {
      add('crit', (0.7 + l * 0.024) * m);
      add('haste', (1.1 + l * 0.03) * m);
    } else if (slot === 'amulet') {
      add('skillPower', (2.2 + l * 0.07) * m);
      add('maxHp', (8 + l * 1.7) * m);
    }

    const affixPool = shuffled(AFFIX_POOL);
    const used = new Set(Object.keys(stats));
    for (let i = 0; i < rarity.affixes; i++) {
      let found = null;
      for (const affix of affixPool) {
        if (!used.has(affix.key)) { found = affix; break; }
      }
      if (!found) found = affixPool[i % affixPool.length];
      used.add(found.key);
      let value = found.roll(l);
      value *= (0.85 + rarity.index * 0.075);
      if (['maxHp', 'attack', 'defense', 'lifeOnHit'].includes(found.key)) value = Math.max(1, Math.round(value));
      else value = Math.round(value * 10) / 10;
      stats[found.key] = (stats[found.key] || 0) + value;
    }

    const baseList = ITEM_BASES[slot];
    const prefix = pick(ITEM_PREFIXES[rarityKey] || ITEM_PREFIXES.common);
    const name = `${prefix}${pick(baseList)}`;
    const item = {
      uid: uid(),
      slot,
      name,
      rarity: rarityKey,
      level: l,
      stats,
      score: 0,
      value: Math.round((6 + l * 3.5) * (rarity.index + 1) * 1.3),
      id: uid()
    };
    item.score = itemScore(item);
    return item;
  }

  function itemScore(item) {
    if (!item) return 0;
    let score = 0;
    for (const [k, v] of Object.entries(item.stats || {})) score += (STAT_SCORE[k] || 1) * v;
    score += (RARITIES[item.rarity]?.index || 0) * 3 + item.level * 0.4;
    return Math.round(score * 10) / 10;
  }

  function makeDivineEquipment(def, level) {
    const item = makeEquipment(def.slot, level, 'divine');
    item.name = def.name;
    item.source = def.source;
    item.lore = def.lore;
    item.divineId = def.id;
    item.isDivine = true;
    for (const [key, value] of Object.entries(def.bonus || {})) {
      item.stats[key] = (item.stats[key] || 0) + value;
    }
    item.score = itemScore(item);
    item.value = Math.round(item.value * 2 + 400);
    return item;
  }

  function rollClassBookRank(level = 1, minRank = 0) {
    const depth = Math.max(0, level - 1);
    const boost = Math.min(2.2, 1 + depth * 0.008);
    const entries = CLASS_BOOK_RANKS
      .filter(r => r.rank >= minRank)
      .map(r => ({
        value: r.key,
        weight: r.weight * Math.pow(boost, r.rank)
      }));
    return weightedPick(entries);
  }

  function makeClassBook(level, forcedRank = null) {
    return {
      uid: uid(),
      rank: forcedRank || rollClassBookRank(level),
      level: Math.max(1, level)
    };
  }

  function makeSkillInstance(skillId, level, rarityKey) {
    const base = SKILL_BY_ID[skillId];
    if (!base) return null;
    const rarity = RARITIES[rarityKey] || RARITIES.common;
    return {
      ...base,
      uid: uid(),
      skillId: base.id,
      rarity: rarity.key,
      level: Math.max(1, level),
      power: Math.round((1 + (Math.max(1, level) - 1) * 0.035 + rarity.index * 0.1) * 100) / 100,
      rarityIndex: rarity.index
    };
  }

  function skillScore(skill) {
    return skill.power + (RARITIES[skill.rarity]?.index || 0) * 0.08 + skill.level * 0.01;
  }

  function randomSkillOfRarity(rarityKey, level) {
    let candidates = SKILLS.filter(s => s.rarity === rarityKey);
    if (!candidates.length) candidates = SKILLS;
    return makeSkillInstance(pick(candidates).id, level, rarityKey);
  }

  function makeStartingSkills() {
    return STARTING_SKILL_IDS.map(id => makeSkillInstance(id, 1, 'common'));
  }

  function addTalent(id, source = 'draft') {
    const p = game.player;
    if (!p || !TALENT_BY_ID[id]) return;
    const before = p.talents[id] || 0;
    p.talents[id] = before + 1;
    deriveStats(p, 'ratio');
    audio.play(source === 'orb' ? 'orb' : 'rare');
    const talent = TALENT_BY_ID[id];
    const grade = TALENT_GRADES[talent.grade] || TALENT_GRADES.F;
    showToast({
      title: `${source === 'orb' ? '天赋宝珠共鸣' : '天赋铭刻'} · ${talent.name}`,
      tag: `${grade.label} · Lv.${before + 1}`,
      desc: talent.effect(before + 1),
      color: grade.color,
      orb: source === 'orb'
    });
    updateHud(true);
    if (game.state === 'panel') renderPanel();
    saveGame();
  }

  function addTalentDirect(id) { addTalent(id, 'orb'); }

  /* ============================================================
     XP, level ups, drafts
     ============================================================ */
  function gainXP(amount) {
    const p = game.player;
    if (!p) return;
    const gained = Math.max(1, amount * (1 + p.stats.xpBonus));
    p.xp += gained;
    let levelUps = 0;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      levelUps++;
      p.xpNext = xpToNext(p.level);
      if (p.level % 10 === 0) game.pendingDrafts++;
    }
    if (levelUps) {
      deriveStats(p, 'keep');
      p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.2 * levelUps);
      audio.play('level');
      showLevelFlash();
      addParticleBurst(p.x, p.y, 28, '#d8b76f', 150, 1.1);
      updateHud(true);
      if (p.level % 10 === 0) {
        showToast({
          title: '命运再次垂青',
          tag: '天赋抉择',
          desc: `达到 ${p.level} 级，可以从三项天赋中再铭刻一项。`,
          color: '#d8b76f'
        });
      }
      if (p.level >= ASCENSION_LEVEL && !game.ascended && !game.ascensionNoticeShown) {
        game.ascensionNoticeShown = true;
        game.ascensionNoticePending = true;
        updateHud(true);
      }
    }
  }

  function showLevelFlash() {
    const el = $('levelFlash');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(showLevelFlash._timer);
    showLevelFlash._timer = setTimeout(() => el.classList.remove('show'), 1500);
  }

  function talentPoolForGrade(gradeKey, exclude = []) {
    return TALENTS.filter(t => t.grade === gradeKey && !exclude.includes(t.id));
  }

  function rollDraftOptions() {
    // Three distinct grades are drawn by weight. Because a fresh run always
    // presents different grades, a high-grade card stays a genuine jackpot.
    const grades = rollDistinctTalentGrades(3);
    const options = [];
    for (const gradeKey of grades) {
      let pool = talentPoolForGrade(gradeKey, options.map(o => o.id));
      if (!pool.length) pool = TALENTS.filter(t => !options.some(o => o.id === t.id));
      if (!pool.length) pool = TALENTS;
      options.push(pick(pool));
    }
    return options;
  }

  function showDraft(mode = 'level') {
    const p = game.player;
    if (!p) return;
    game.draftMode = mode;
    game.state = 'draft';
    game.draft = {
      options: rollDraftOptions(),
      mode,
      freeReroll: mode === 'start' ? 1 : 0,
      rerolls: 0
    };
    $('titleScreen').classList.add('hidden');
    $('pauseScreen').classList.add('hidden');
    $('deathScreen').classList.add('hidden');
    $('talentScreen').classList.remove('hidden');
    $('hud').classList.add('hidden');
    renderDraft();
    updateDraftRerollLabel();
  }

  function draftRerollCost() {
    const p = game.player;
    if (!p) return 0;
    return Math.round((70 + p.level * 9) * (1 + (game.draft?.rerolls || 0) * 0.6));
  }

  function updateDraftRerollLabel() {
    const btn = $('btnReroll');
    const cost = $('rerollCost');
    if (!game.draft) return;
    if (game.draft.freeReroll > 0) {
      cost.textContent = '· 免费';
      btn.disabled = false;
      btn.style.opacity = '1';
    } else {
      cost.textContent = `· ${draftRerollCost()} 金币`;
      const affordable = game.player.gold >= draftRerollCost();
      btn.disabled = !affordable;
      btn.style.opacity = affordable ? '1' : '0.4';
    }
  }

  function renderDraft() {
    if (!game.draft || !game.player) return;
    const p = game.player;
    const title = $('draftTitle');
    const sub = $('draftSub');
    const eyebrow = $('draftEyebrow');
    const note = $('draftNote');
    if (game.draftMode === 'start') {
      eyebrow.textContent = 'THE FIRST CHOICE';
      title.textContent = '选择你的第一份天赋';
      sub.textContent = 'F–A 级每阶 10 种，S–SSS 级每阶 5 种。位阶越高越罕见，力量也越离谱。';
      note.textContent = '三张卡为不同位阶 · 选择后立刻进入地牢';
    } else {
      eyebrow.textContent = `CHOICE OF LEVEL ${p.level}`;
      title.textContent = '命运再次分岔';
      sub.textContent = `你已经抵达 ${p.level} 级。位阶越高，出现概率越低；S 级以上是真正的禁忌之力。`;
      note.textContent = '每提升 10 级，都会获得一次天赋抉择';
    }
    const wrap = $('draftCards');
    wrap.innerHTML = game.draft.options.map((talent, index) => {
      const r = TALENT_GRADES[talent.grade] || TALENT_GRADES.F;
      const current = p.talents[talent.id] || 0;
      return `
        <button class="talent-card ${r.rank >= 6 ? 'pinnacle' : ''}" data-talent-pick="${talent.id}" style="--rarity:${r.color};--rarity-soft:${r.soft};animation-delay:${index * 0.07}s">
          <span class="tc-rarity">
            <span class="rarity-label" style="--rarity:${r.color}">${r.label}天赋</span>
            <span class="tc-source">${current > 0 ? `已持有 ${current} 层` : '尚未持有'}</span>
          </span>
          <span class="tc-icon-wrap"><span class="tc-icon"><span>${talent.icon}</span></span></span>
          <span class="tc-main">
            <span class="tc-name">${talent.name}</span>
            <span class="tc-stack">${current > 0 ? `当前 Lv.${current} → Lv.${current + 1}` : '获得 Lv.1'}</span>
            <span class="tc-effect">${highlightNumbers(talent.effect(current + 1))}</span>
            <span class="tc-flavor">“${talent.flavor}”</span>
            <span class="tc-pick">◆ 铭 刻 命 运 ◆</span>
          </span>
        </button>`;
    }).join('');
    updateDraftRerollLabel();
  }

  function highlightNumbers(text) {
    return text.replace(/([+\-]?\d+(?:\.\d+)?%?)/g, '<em>$1</em>');
  }

  function chooseTalent(id) {
    if (!game.draft) return;
    if (!game.draft.options.some(t => t.id === id)) return;
    addTalent(id, 'draft');
    const mode = game.draftMode;
    game.draft = null;
    $('talentScreen').classList.add('hidden');
    if (mode === 'start') {
      beginRun();
    } else {
      game.state = 'playing';
      $('hud').classList.remove('hidden');
      saveGame();
    }
  }

  function rerollDraft() {
    if (!game.draft) return;
    if (game.draft.freeReroll > 0) {
      game.draft.freeReroll--;
    } else {
      const cost = draftRerollCost();
      if (game.player.gold < cost) return;
      game.player.gold -= cost;
      audio.play('buy');
    }
    game.draft.rerolls++;
    game.draft.options = rollDraftOptions();
    renderDraft();
    updateHud(true);
  }

  /* ============================================================
     Toast & notifications
     ============================================================ */
  function showToast({ title, tag = '', desc = '', color = '#c5ae7b', orb = false, duration = 4200 }) {
    const stack = $('toastStack');
    if (!stack) return;
    while (stack.children.length >= 4) stack.removeChild(stack.firstElementChild);
    const el = document.createElement('div');
    el.className = 'toast' + (orb ? ' toast-orb' : '');
    el.style.setProperty('--toast-color', color);
    el.innerHTML = `
      <div class="toast-head">
        <span class="toast-title">${title}</span>
        <span class="toast-tag">${tag}</span>
      </div>
      ${desc ? `<div class="toast-desc">${desc}</div>` : ''}`;
    stack.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, duration);
  }

  function showLocationBanner(zoneName, threatLabel) {
    if (game.boss) return;
    const el = $('locationBanner');
    $('bannerZone').textContent = zoneName;
    $('bannerThreat').textContent = threatLabel;
    el.classList.add('show');
    clearTimeout(showLocationBanner._t);
    showLocationBanner._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function showBossAnnouncement(name, title) {
    const el = $('bossAnnounce');
    $('announceBoss').textContent = name;
    $('announceTitle').textContent = title;
    el.classList.add('show');
    clearTimeout(showBossAnnouncement._t);
    showBossAnnouncement._t = setTimeout(() => el.classList.remove('show'), 3300);
  }

  /* ============================================================
     World generation
     ============================================================ */
  function chunkKey(cx, cy) { return `${cx},${cy}`; }

  function getChunk(cx, cy) {
    const key = chunkKey(cx, cy);
    if (game.featureCache.has(key)) return game.featureCache.get(key);
    const rng = mulberry32(Math.floor(hash2(cx, cy, game.worldSeed) * 4294967295));
    const bx = cx * CFG.chunkSize;
    const by = cy * CFG.chunkSize;
    const features = [];
    const decorations = [];
    const lights = [];

    const chunkDistFromOrigin = Math.hypot(bx + CFG.chunkSize / 2, by + CFG.chunkSize / 2);
    let featureCount = 0;
    if (chunkDistFromOrigin > 480) {
      const roll = rng();
      featureCount = roll < 0.12 ? 1 : roll < 0.44 ? 2 : roll < 0.8 ? 3 : 4;
    }

    const overlaps = (x, y, w, h, pad = 28) => {
      for (const f of features) {
        if (x - pad < f.x + f.w && x + w + pad > f.x && y - pad < f.y + f.h && y + h + pad > f.y) return true;
      }
      return false;
    };

    for (let i = 0; i < featureCount; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 12 && !placed; attempt++) {
        const typeRoll = rng();
        const type = typeRoll < 0.38 ? 'pillar' : typeRoll < 0.63 ? 'wall' : typeRoll < 0.77 ? 'brazier' : typeRoll < 0.9 ? 'statue' : 'rubble';
        let w, h;
        if (type === 'pillar') { w = 38; h = 38; }
        else if (type === 'wall') { if (rng() < 0.5) { w = 130 + Math.floor(rng() * 4) * 20; h = 28; } else { w = 28; h = 130 + Math.floor(rng() * 4) * 20; } }
        else if (type === 'brazier') { w = 24; h = 24; }
        else if (type === 'statue') { w = 42; h = 48; }
        else { w = 48; h = 36; }

        const x = bx + 48 + rng() * (CFG.chunkSize - w - 96);
        const y = by + 48 + rng() * (CFG.chunkSize - h - 96);
        const cxWorld = x + w / 2;
        const cyWorld = y + h / 2;
        if (Math.hypot(cxWorld, cyWorld) < 430) continue;
        if (overlaps(x, y, w, h, 46)) continue;
        const f = {
          id: `${key}:${i}`,
          type, x, y, w, h,
          seed: Math.floor(rng() * 100000),
          torch: type === 'brazier' || ((type === 'pillar' || type === 'wall') && rng() < 0.24),
          glow: type === 'brazier' ? '#e99450' : '#89c1b9'
        };
        features.push(f);
        if (f.torch) {
          lights.push({
            x: x + w / 2, y: y + h / 2 - 10,
            radius: type === 'brazier' ? 210 : 170,
            color: type === 'brazier' ? 'rgba(232,142,72,' : 'rgba(85,175,163,',
            base: type === 'brazier' ? 0.25 : 0.16,
            flicker: rng() * 10
          });
        }
        placed = true;
      }
    }

    const decoCount = 10 + Math.floor(rng() * 9);
    for (let i = 0; i < decoCount; i++) {
      const typeRoll = rng();
      const x = bx + 18 + rng() * (CFG.chunkSize - 36);
      const y = by + 18 + rng() * (CFG.chunkSize - 36);
      let type;
      if (typeRoll < 0.2) type = 'crack';
      else if (typeRoll < 0.4) type = 'bones';
      else if (typeRoll < 0.55) type = 'moss';
      else if (typeRoll < 0.7) type = 'rubble';
      else if (typeRoll < 0.81) type = 'rune';
      else if (typeRoll < 0.91) type = 'skull';
      else type = 'grate';
      decorations.push({ type, x, y, seed: rng(), rot: rng() * TAU });
    }

    // The origin is a safe, readable landmark.
    if (cx === 0 && cy === 0) {
      lights.push({ x: 0, y: -75, radius: 250, color: 'rgba(108,199,194,', base: 0.2, flicker: 1.3 });
    }

    const chunk = { features, decorations, lights, key };
    game.featureCache.set(key, chunk);
    return chunk;
  }

  function getChunksInRange(x, y, pad = 300) {
    const size = CFG.chunkSize;
    const minCx = Math.floor((x - pad) / size);
    const maxCx = Math.floor((x + pad) / size);
    const minCy = Math.floor((y - pad) / size);
    const maxCy = Math.floor((y + pad) / size);
    const list = [];
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) list.push(getChunk(cx, cy));
    }
    return list;
  }

  function nearbyFeatures(x, y, pad = 160) {
    return getChunksInRange(x, y, pad).flatMap(c => c.features);
  }

  function circleRectCollision(cx, cy, r, rect) {
    const nx = clamp(cx, rect.x, rect.x + rect.w);
    const ny = clamp(cy, rect.y, rect.y + rect.h);
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  function resolveCircleRect(cx, cy, r, rect) {
    const nx = clamp(cx, rect.x, rect.x + rect.w);
    const ny = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - nx;
    const dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return null;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      return { x: nx + (dx / d) * r, y: ny + (dy / d) * r };
    }
    const left = Math.abs(cx - rect.x);
    const right = Math.abs(cx - (rect.x + rect.w));
    const top = Math.abs(cy - rect.y);
    const bottom = Math.abs(cy - (rect.y + rect.h));
    const min = Math.min(left, right, top, bottom);
    if (min === left) return { x: rect.x - r, y: cy };
    if (min === right) return { x: rect.x + rect.w + r, y: cy };
    if (min === top) return { x: cx, y: rect.y - r };
    return { x: cx, y: rect.y + rect.h + r };
  }

  function resolveWorldCollision(x, y, r, ignoreFly = false) {
    if (ignoreFly) return { x, y };
    const features = nearbyFeatures(x, y, 100);
    let px = x, py = y;
    for (let iter = 0; iter < 2; iter++) {
      for (const f of features) {
        if (!['pillar', 'wall', 'brazier', 'statue'].includes(f.type)) continue;
        const res = resolveCircleRect(px, py, r, f);
        if (res) { px = res.x; py = res.y; }
      }
    }
    return { x: px, y: py };
  }

  function isWorldPositionFree(x, y, r = 18) {
    const features = nearbyFeatures(x, y, 100);
    for (const f of features) {
      if (!['pillar', 'wall', 'brazier', 'statue'].includes(f.type)) continue;
      if (circleRectCollision(x, y, r + 2, f)) return false;
    }
    return true;
  }

  function findFreePosition(x, y, r = 18, radius = 300) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * TAU;
      const d = i === 0 ? 0 : rand(30, radius);
      const nx = x + Math.cos(a) * d;
      const ny = y + Math.sin(a) * d;
      if (isWorldPositionFree(nx, ny, r)) return { x: nx, y: ny };
    }
    return { x, y };
  }

  function getZoneLevelAt(distanceFromOrigin) {
    const base = Math.max(1, 1 + Math.floor(Math.pow(distanceFromOrigin / 620, 1.12)));
    return base + (game.ascended ? DIVINE_ENEMY_LEVEL_BONUS : 0);
  }

  function zoneBandFor(level) {
    const names = game.ascended ? DIVINE_THREAT_NAMES : THREAT_NAMES;
    const relative = game.ascended ? Math.max(1, level - DIVINE_ENEMY_LEVEL_BONUS) : level;
    return Math.min(names.length - 1, Math.floor((relative - 1) / 3));
  }

  function zoneNameFor(level) {
    const names = game.ascended ? DIVINE_THREAT_NAMES : THREAT_NAMES;
    return names[zoneBandFor(level)];
  }

  function romanFor(n) {
    const value = Math.max(1, Math.min(3999, Math.floor(Number(n) || 1)));
    const table = [
      [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
      [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    let out = '';
    let left = value;
    for (const [unit, glyph] of table) {
      while (left >= unit) { out += glyph; left -= unit; }
    }
    return out;
  }

  /* ============================================================
     Run lifecycle
     ============================================================ */
  function clearCombat() {
    game.enemies = [];
    game.projectiles = [];
    game.enemyProjectiles = [];
    game.effects = [];
    game.loot = [];
    game.particles = [];
    game.damageTexts = [];
    game.boss = null;
    game.bossTimer = 75;
    game.bossSpawnCount = 0;
    game.spawnTimer = 0.5;
    game.camera.shake = 0;
    game.basicAttackCount = 0;
    game.combo = 0;
    game.comboTimer = 0;
    $('bossWrap').classList.remove('visible');
    $('comboCounter').classList.remove('show');
  }

  function resetRun() {
    game.worldSeed = (Math.random() * 2147483647) | 0;
    game.featureCache.clear();
    game.decorations.clear();
    game.runTime = 0;
    game.enemiesKilled = 0;
    game.bossesKilled = 0;
    game.bossTimer = 75;
    game.pendingDrafts = 0;
    game.selectedSkillSlot = 0;
    game.zoneBand = 0;
    game.currentZoneLevel = 1;
    game.locationBannerTimer = 0;
    game.newRun = true;
    game.ascended = false;
    game.ascensionNoticeShown = false;
    game.ascensionNoticePending = false;
    game.classChoice = null;
    clearCombat();
    $('toastStack').innerHTML = '';
    $('locationBanner').classList.remove('show');
    $('bossAnnounce').classList.remove('show');
    $('levelFlash').classList.remove('show');

    const p = createPlayer();
    game.player = p;
    p.skills = makeStartingSkills();
    p.equipped = p.skills.slice();
    p.slots = 4;
    p.skillCooldowns = [0, 0, 0, 0];
    p.equipment.weapon = makeEquipment('weapon', 1, 'common');
    p.equipment.armor = makeEquipment('armor', 1, 'common');
    p.equipment.weapon.name = '生锈短剑';
    p.equipment.armor.name = '褪色皮甲';
    p.equipment.weapon.value = 8;
    p.equipment.armor.value = 8;
    p.stats = null;
    deriveStats(p, 'full');
    p.hp = p.stats.maxHp;
    game.camera.x = p.x;
    game.camera.y = p.y;
    game.dust = [];
    for (let i = 0; i < 70; i++) {
      game.dust.push({
        x: Math.random() * viewW, y: Math.random() * viewH,
        vx: rand(-3, 3), vy: rand(-7, -1),
        size: rand(0.4, 1.6), alpha: rand(0.04, 0.2), phase: rand(0, TAU)
      });
    }
  }

  function startNewRun() {
    resetRun();
    $('titleScreen').classList.add('hidden');
    $('deathScreen').classList.add('hidden');
    $('pauseScreen').classList.add('hidden');
    $('ascensionScreen').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('modalLayer').classList.add('hidden');
    showDraft('start');
  }

  function beginRun() {
    const p = game.player;
    game.state = 'playing';
    game.newRun = false;
    $('hud').classList.remove('hidden');
    $('talentScreen').classList.add('hidden');
    $('titleScreen').classList.add('hidden');
    $('deathScreen').classList.add('hidden');
    p.hp = p.stats.maxHp;
    game.camera.x = p.x;
    game.camera.y = p.y;
    game.spawnTimer = 1.2;
    game.bossTimer = 68;
    spawnInitialPack();
    renderSkillBar();
    updateHud(true);
    const zoneLv = getZoneLevelAt(0);
    showLocationBanner(zoneNameFor(zoneLv), '威胁等级 I');
    const coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    setTimeout(() => {
      if (game.state === 'playing') {
        showToast({
          title: '战技已铭刻',
          tag: coarsePointer ? '触屏操作' : '自动战斗',
          desc: coarsePointer
            ? '战技会自动释放并瞄准。左下摇杆移动，右下「闪」键闪避，其余操作点屏幕即可。'
            : '所有战技会自动释放并瞄准最近的敌人。你只需要移动、闪避、向更深处走。',
          color: '#6bc7c2'
        });
      }
    }, 700);
    setTimeout(() => {
      if (game.state === 'playing') {
        showToast({
          title: '命运每十级叩门',
          tag: '成长',
          desc: '每 10 级可再选一项天赋；天赋宝珠可让任何天赋无限叠加。',
          color: '#c1a467'
        });
      }
    }, 2200);
    saveGame();
  }

  function spawnInitialPack() {
    const p = game.player;
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * TAU + rand(-0.2, 0.2);
      const d = rand(360, 560);
      const x = p.x + Math.cos(angle) * d;
      const y = p.y + Math.sin(angle) * d;
      if (!isWorldPositionFree(x, y, 18)) continue;
      const level = getZoneLevelAt(Math.hypot(x, y));
      spawnEnemyAt(x, y, level, { announce: false });
    }
  }

  function getCurrentZoneLevel() {
    const p = game.player;
    return getZoneLevelAt(p ? Math.hypot(p.x, p.y) : 0);
  }

  /* ============================================================
     Enemy spawning & stats
     ============================================================ */
  function enemyBaseStats(level) {
    const l = Math.max(1, level);
    const hp = 40 * (1 + 0.52 * (l - 1) + 0.018 * (l - 1) * (l - 1));
    const dmg = 8 * (1 + 0.27 * (l - 1));
    return { hp, dmg };
  }

  function chooseEnemyType(level) {
    const entries = [
      { value: 'skeleton', weight: 34 },
      { value: 'bat', weight: level >= 2 ? 22 : 12 },
      { value: 'spider', weight: level >= 4 ? 20 : 6 },
      { value: 'acolyte', weight: level >= 6 ? 17 : 0 },
      { value: 'wraith', weight: level >= 9 ? 15 : 0 },
      { value: 'golem', weight: level >= 12 ? 13 : 0 }
    ].filter(e => e.weight > 0);
    return weightedPick(entries);
  }

  function spawnEnemyAt(x, y, level, options = {}) {
    const typeId = options.typeId || chooseEnemyType(level);
    const type = ENEMY_TYPES[typeId];
    if (!type) return null;
    const free = isWorldPositionFree(x, y, type.radius + 4);
    if (!free) {
      const alt = findFreePosition(x, y, type.radius + 4, 90);
      x = alt.x; y = alt.y;
    }
    const eliteChance = options.elite !== undefined ? (options.elite ? 1 : 0) : Math.min(0.16, 0.035 + level * 0.006);
    const elite = Math.random() < eliteChance || !!options.forceElite;
    const base = enemyBaseStats(level);
    const hpMul = type.hp * (elite ? 2.8 : 1);
    const dmgMul = type.dmg * (elite ? 1.4 : 1);
    const enemy = {
      id: uid(),
      typeId,
      typeName: type.name,
      name: (elite ? '精英·' : '') + type.name,
      level,
      x, y,
      spawnX: x, spawnY: y,
      radius: type.radius * (elite ? 1.22 : 1),
      hp: base.hp * hpMul,
      maxHp: base.hp * hpMul,
      damage: base.dmg * dmgMul,
      speed: type.speed * (elite ? 0.96 : 1),
      xp: (8 + 5 * (level - 1)) * type.xp * (elite ? 3 : 1),
      gold: Math.round((2 + level * 1.25) * type.gold * (elite ? 3 : 1) * rand(0.8, 1.3)),
      behavior: type.behavior,
      attackInterval: type.attackInterval * (elite ? 0.88 : 1),
      attackTimer: rand(0.3, 1.1),
      projectileSpeed: type.projectileSpeed || 260,
      flying: !!type.flying,
      elite,
      boss: false,
      dead: false,
      facing: Math.random() * TAU,
      hitFlash: 0,
      bob: Math.random() * TAU,
      slowUntil: 0,
      slowAmount: 0,
      avoidSign: Math.random() < 0.5 ? -1 : 1,
      color: type.color,
      seed: Math.random() * 1000,
      aggro: false,
      summoned: !!options.summoned
    };
    game.enemies.push(enemy);
    addRing(enemy.x, enemy.y, 16, 80, 0.45, elite ? '#e5ab62' : 'rgba(165,155,135,.6)', 2);
    return enemy;
  }

  function spawnAmbientEnemy() {
    const p = game.player;
    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * TAU;
      const d = rand(610, 900);
      const x = p.x + Math.cos(angle) * d;
      const y = p.y + Math.sin(angle) * d;
      if (!isWorldPositionFree(x, y, 20)) continue;
      if (game.enemies.length >= maxActiveEnemies()) return;
      const level = getZoneLevelAt(Math.hypot(x, y));
      spawnEnemyAt(x, y, level);
      return;
    }
  }

  function maxActiveEnemies() {
    const zone = getCurrentZoneLevel();
    return CFG.maxEnemiesBase + Math.min(20, Math.floor(zone * 1.5)) + (game.boss ? 4 : 0);
  }

  function spawnBoss() {
    if (game.boss) return;
    const p = game.player;
    const bossDef = pick(BOSS_TYPES);
    const angle = Math.random() * TAU;
    const d = rand(330, 430);
    let x = p.x + Math.cos(angle) * d;
    let y = p.y + Math.sin(angle) * d;
    const pos = findFreePosition(x, y, 45, 160);
    x = pos.x; y = pos.y;
    const zoneLevel = getCurrentZoneLevel();
    const level = zoneLevel + 2;
    const base = enemyBaseStats(level);
    const type = ENEMY_TYPES[bossDef.base];
    const hp = base.hp * bossDef.hp;
    const dmg = base.dmg * bossDef.dmg;
    const boss = {
      id: uid(),
      typeId: bossDef.base,
      typeName: bossDef.name,
      name: bossDef.name,
      title: bossDef.title,
      level,
      x, y,
      spawnX: x, spawnY: y,
      radius: bossDef.radius,
      hp,
      maxHp: hp,
      damage: dmg,
      speed: 58,
      xp: (68 + level * 18) * 3.2,
      gold: Math.round((30 + level * 15) * 3.5),
      behavior: type.behavior,
      attackInterval: 1.7,
      attackTimer: 2.2,
      projectileSpeed: 280,
      flying: bossDef.base === 'wraith',
      elite: false,
      boss: true,
      bossDef,
      dead: false,
      facing: Math.random() * TAU,
      hitFlash: 0,
      bob: Math.random() * TAU,
      slowUntil: 0,
      slowAmount: 0,
      avoidSign: 1,
      color: bossDef.color,
      aura: bossDef.aura,
      seed: Math.random() * 1000,
      aggro: true,
      specialTimer: 4.4,
      summonTimer: 7,
      slamTimer: 3.4,
      enraged: false,
      summoned: false
    };
    game.enemies.push(boss);
    game.boss = boss;
    game.bossSpawnCount++;
    $('bossName').textContent = boss.name;
    $('bossLevel').textContent = `Lv.${boss.level} · 领主`;
    $('bossSub').textContent = bossDef.title;
    $('bossWrap').classList.add('visible');
    $('locationBanner').classList.remove('show');
    showBossAnnouncement(boss.name, bossDef.title);
    audio.play('boss');
    game.camera.shake = 8;
    addParticleBurst(boss.x, boss.y, 46, boss.aura, 220, 1.4);
    saveGame();
  }

  /* ============================================================
     Combat helpers
     ============================================================ */
  function nearestEnemy(x, y, maxRange = Infinity) {
    let best = null;
    let bestD = maxRange;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function enemiesWithin(x, y, radius, includeBoss = true) {
    const r2 = radius * radius;
    const out = [];
    for (const e of game.enemies) {
      if (e.dead || (!includeBoss && e.boss)) continue;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 <= (radius + e.radius) ** 2) out.push(e);
    }
    return out;
  }

  function rollPlayerCrit() {
    const s = game.player.stats;
    return Math.random() < s.crit;
  }

  function dealDamageToEnemy(enemy, raw, opts = {}) {
    if (!enemy || enemy.dead) return 0;
    const p = game.player;
    let dmg = raw;
    let crit = false;
    if (!opts.noCrit && rollPlayerCrit()) {
      dmg *= p.stats.critDamage;
      crit = true;
    }
    if (enemy.boss) dmg *= 1 + p.stats.bossDamage;
    else if (enemy.elite) dmg *= 1 + p.stats.eliteDamage;
    if (enemy.hp / enemy.maxHp <= 0.3) dmg *= 1 + p.stats.execute;
    dmg = Math.max(1, Math.round(dmg));
    enemy.hp -= dmg;
    enemy.hitFlash = 0.1;
    enemy.aggro = true;
    if (!opts.noKnockback) {
      const a = Math.atan2(enemy.y - (opts.sourceY ?? p.y), enemy.x - (opts.sourceX ?? p.x));
      const kb = enemy.boss ? 0.7 : enemy.elite ? 3 : 6;
      if (!enemy.boss) {
        const nx = enemy.x + Math.cos(a) * kb;
        const ny = enemy.y + Math.sin(a) * kb;
        if (enemy.flying || isWorldPositionFree(nx, ny, enemy.radius * 0.6)) { enemy.x = nx; enemy.y = ny; }
      }
    }
    addDamageText(enemy.x + rand(-8, 8), enemy.y - enemy.radius - 6, dmg, crit ? '#ffd88f' : opts.color || '#e4dccb', crit, opts.isSkill);
    if (crit) {
      audio.play('crit');
      addParticleBurst(enemy.x, enemy.y, 5, '#ffd88f', 110, 0.35);
    } else {
      audio.play('hit');
    }
    addParticleBurst(enemy.x, enemy.y, 2, opts.color || '#b8aa8b', 70, 0.28);

    if (opts.lifeOnHit) {
      p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.lifeOnHit * (opts.lifeMult || 1));
    }
    if (!opts.isThorns && p.stats.lifeSteal > 0) {
      p.hp = Math.min(p.stats.maxHp, p.hp + dmg * p.stats.lifeSteal);
    }
    if (opts.isSkill) {
      if (p.stats.skillHeal > 0 && p.skillHealCd <= 0) {
        p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * p.stats.skillHeal);
        p.skillHealCd = 0.12;
        addDamageText(p.x, p.y - 28, `+${Math.round(p.stats.maxHp * p.stats.skillHeal)}`, '#7fd6aa', false, false);
      }
      if (opts.skillHealPct) {
        p.hp = Math.min(p.stats.maxHp, p.hp + dmg * opts.skillHealPct);
      }
    }

    if (enemy.hp <= 0) killEnemy(enemy);
    return dmg;
  }

  function damageArea(x, y, radius, raw, opts = {}) {
    const targets = enemiesWithin(x, y, radius);
    let total = 0;
    for (const e of targets) {
      total += dealDamageToEnemy(e, raw, { ...opts, sourceX: opts.sourceX ?? x, sourceY: opts.sourceY ?? y });
    }
    return total;
  }

  function damagePlayer(raw, source = 'melee', attacker = null) {
    const p = game.player;
    if (!p || p.dead || game.state !== 'playing') return;
    if (p.invuln > 0) return;
    const s = p.stats;
    if (s.dodge > 0 && Math.random() < s.dodge) {
      addDamageText(p.x + rand(-5, 5), p.y - 28, '闪避', '#a9d8cd', false, false);
      addParticleBurst(p.x, p.y, 5, '#9fd8cc', 90, 0.35);
      return;
    }
    let dmg = raw * (100 / (100 + s.defense)) * (1 - s.damageReduction);
    dmg = Math.max(1, Math.round(dmg));
    let absorbed = 0;
    if (p.shield > 0) {
      absorbed = Math.min(p.shield, dmg);
      p.shield -= absorbed;
      dmg -= absorbed;
      if (p.shield <= 0) {
        p.shield = 0;
        addRing(p.x, p.y, 24, 52, 0.3, '#d8d0b4', 2);
        addParticleBurst(p.x, p.y, 10, '#d8d0b4', 100, 0.5);
      }
    }
    if (dmg > 0) {
      p.hp -= dmg;
      p.hitFlash = 0.2;
      p.lastHitBy = attacker ? attacker.typeName : source;
      addDamageText(p.x + rand(-5, 5), p.y - 25, dmg, '#ea7770', false, false, true);
      addParticleBurst(p.x, p.y, 7, '#a83f42', 120, 0.4);
      game.camera.shake = Math.max(game.camera.shake, Math.min(10, 2 + dmg * 0.015));
      audio.play('hurt');
    } else if (absorbed > 0) {
      addDamageText(p.x, p.y - 25, `护盾 -${absorbed}`, '#d8cba7', false, false);
    }

    // 反伤按“实际受到的伤害”计算，可以对近战与远程攻击者同时生效。
    if (dmg > 0 && s.thorns > 0 && attacker && !attacker.dead && game.enemies.includes(attacker)) {
      const reflected = Math.max(1, Math.round(dmg * s.thorns));
      addRing(p.x, p.y, 12, 42, 0.3, '#d89566', 1.5);
      dealDamageToEnemy(attacker, reflected, {
        noCrit: true,
        noKnockback: true,
        color: '#d89566',
        isThorns: true,
        sourceX: p.x,
        sourceY: p.y
      });
    }
    p.hitComboTimer = 1.5;
    if (p.hp <= 0) {
      if (p.revives > 0) {
        p.revives--;
        p.reviveUsed++;
        p.hp = p.stats.maxHp * 0.35;
        p.invuln = 2.6;
        p.shield = 0;
        audio.play('revive');
        addRing(p.x, p.y, 20, 190, 0.9, '#b99cf0', 4);
        addParticleBurst(p.x, p.y, 40, '#b99cf0', 220, 1.4);
        showToast({
          title: '灵魂附身',
          tag: '复生',
          desc: '死亡被你甩在身后，但它还会追上来。',
          color: '#bd82f4',
          orb: true
        });
      } else {
        playerDeath();
      }
    }
  }

  function playerDeath() {
    const p = game.player;
    if (game.state === 'dead') return;
    p.dead = true;
    p.hp = 0;
    game.state = 'dead';
    audio.play('death');
    game.camera.shake = 16;
    clearSavedGame();
    $('bossWrap').classList.remove('visible');
    $('deathStats').innerHTML = `
      <div><span>最终等级</span><b>${p.level}</b></div>
      <div><span>深入距离</span><b>${fmt(p.deepest / 10)} m</b></div>
      <div><span>击杀总数</span><b>${fmt(p.kills)}</b></div>
      <div><span>领主讨伐</span><b>${p.bossKills}</b></div>
      <div><span>探索时长</span><b>${fmtTime(p.playTime)}</b></div>
      <div><span>拾取金币</span><b>${fmt(p.gold)}</b></div>
      <div><span>装备评分</span><b>${fmt(equippedPower())}</b></div>
      <div><span>天赋层数</span><b>${totalTalentStacks()}</b></div>`;
    $('deathScreen').classList.remove('hidden');
    $('hud').classList.add('hidden');
  }

  function equippedPower() {
    const p = game.player;
    return Math.round(['weapon', 'armor', 'ring', 'amulet'].reduce((sum, slot) => sum + itemScore(p.equipment[slot]), 0) + p.level * 8);
  }

  function totalTalentStacks() {
    return Object.values(game.player.talents).reduce((a, b) => a + b, 0);
  }

  function killEnemy(enemy) {
    if (!enemy || enemy.dead) return;
    enemy.dead = true;
    const p = game.player;
    p.kills++;
    game.enemiesKilled++;
    game.combo++;
    game.comboTimer = 2.4;
    audio.play(enemy.boss ? 'bossdie' : 'hit');
    addParticleBurst(enemy.x, enemy.y, enemy.boss ? 60 : enemy.elite ? 22 : 10, enemy.aura || enemy.color || '#a3957e', enemy.boss ? 260 : 140, enemy.boss ? 1.6 : 0.6);
    if (enemy.elite) addRing(enemy.x, enemy.y, 12, 120, 0.55, '#e4b36a', 2);
    if (p.stats.killHeal > 0) {
      p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * p.stats.killHeal);
      addDamageText(p.x, p.y - 30, `+${Math.round(p.stats.maxHp * p.stats.killHeal)}`, '#7fcfa8', false, false);
    }
    gainXP(enemy.xp);
    dropGold(enemy);
    rollLootForEnemy(enemy);
    if (enemy.boss) {
      p.bossKills++;
      game.bossesKilled++;
      game.boss = null;
      $('bossWrap').classList.remove('visible');
      game.bossTimer = rand(95, 150);
      game.camera.shake = 12;
      addRing(enemy.x, enemy.y, 20, 360, 1.4, '#e6c07d', 4);
      showToast({
        title: `${enemy.name} · 陨落`,
        tag: '领主讨伐',
        desc: '深渊短暂地屏住了呼吸。它留下的东西正在发光。',
        color: '#e8c27d'
      });
      saveGame();
    }
    game.comboEl = null;
  }

  /* ============================================================
     Loot
     ============================================================ */
  function dropGold(enemy) {
    const p = game.player;
    const base = enemy.gold || 1;
    const amount = Math.max(1, Math.round(base * (1 + p.stats.goldFind) * rand(0.85, 1.2)));
    addLoot('gold', enemy.x + rand(-14, 14), enemy.y + rand(-10, 10), { amount }, false);
  }

  function rollLootForEnemy(enemy) {
    const p = game.player;
    const eliteMul = enemy.elite ? 2 : 1;
    const level = enemy.level;
    const fromOrigin = Math.hypot(enemy.x, enemy.y);
    const depth = Math.max(0, Math.floor(fromOrigin / 1000));

    if (enemy.boss) {
      const floors = [2, 1, 0];
      for (let i = 0; i < 3; i++) {
        let rarityKey = rollRarity(level + 2, floors[i]);
        const idx = RARITY_LIST.findIndex(r => r.key === rarityKey);
        if (idx < floors[i]) rarityKey = RARITY_LIST[floors[i]].key;
        const slot = pick(EQUIP_SLOTS).id;
        const item = makeEquipment(slot, level + 2, rarityKey);
        addLoot('equipment', enemy.x + rand(-40, 40), enemy.y + rand(-30, 30), { item });
      }
      if (Math.random() < 0.6) {
        const rarityKey = rollRarity(level + 2, 1);
        const skill = randomSkillOfRarity(rarityKey, level + 2);
        if (skill) addLoot('skill', enemy.x + rand(-30, 30), enemy.y + rand(-25, 25), { skill });
      }
      if (Math.random() < 0.12) {
        const talentGrade = rollTalentGrade();
        const pool = TALENTS.filter(t => t.grade === talentGrade);
        const talent = pick(pool.length ? pool : TALENTS);
        addLoot('orb', enemy.x, enemy.y, { talentId: talent.id, grade: talent.grade }, true);
      }
      if (Math.random() < 0.05) {
        const book = makeClassBook(level + 4, rollClassBookRank(level + 4, 1));
        addLoot('classBook', enemy.x + rand(-20, 20), enemy.y + rand(-16, 16), { book }, true);
      }
      if (Math.random() < DROP_RATES.health) addLoot('health', enemy.x + rand(-15, 15), enemy.y + rand(-15, 15), {});
      return;
    }

    const equipmentChance = Math.min(0.95, DROP_RATES.equipment * eliteMul);
    const skillChance = Math.min(0.95, DROP_RATES.skill * eliteMul);
    const orbChance = Math.min(0.95, DROP_RATES.orb * eliteMul);

    if (Math.random() < equipmentChance) {
      const rarityKey = rollRarity(level);
      const slot = pick(EQUIP_SLOTS).id;
      const item = makeEquipment(slot, level, rarityKey);
      addLoot('equipment', enemy.x + rand(-15, 15), enemy.y + rand(-8, 8), { item });
    }
    if (Math.random() < skillChance) {
      const rarityKey = rollRarity(level, enemy.elite ? 1 : 0);
      const skill = randomSkillOfRarity(rarityKey, level);
      if (skill) addLoot('skill', enemy.x + rand(-15, 15), enemy.y + rand(-8, 8), { skill });
    }
    if (Math.random() < orbChance) {
      const talentGrade = rollTalentGrade();
      const pool = TALENTS.filter(t => t.grade === talentGrade);
      const talent = pick(pool.length ? pool : TALENTS);
      addLoot('orb', enemy.x, enemy.y, { talentId: talent.id, grade: talent.grade }, true);
    }
    if (Math.random() < DROP_RATES.classBook * eliteMul) {
      const book = makeClassBook(level);
      addLoot('classBook', enemy.x + rand(-15, 15), enemy.y + rand(-10, 10), { book }, true);
    }
    if (Math.random() < DROP_RATES.health) addLoot('health', enemy.x + rand(-15, 15), enemy.y + rand(-15, 15), {});
  }

  function addLoot(type, x, y, data = {}, important = false) {
    let pos = { x, y };
    if (!isWorldPositionFree(x, y, 12)) pos = findFreePosition(x, y, 12, 90);
    const loot = {
      id: uid(),
      type,
      x: pos.x,
      y: pos.y,
      vx: rand(-22, 22),
      vy: rand(-22, 22),
      age: 0,
      bob: Math.random() * TAU,
      data,
      important,
      collected: false
    };
    game.loot.push(loot);
    if (important) {
      audio.play(type === 'orb' || type === 'classBook' ? 'orb' : 'rare');
      const gradeColor = type === 'classBook'
        ? (CLASS_BOOK_RANK_BY_KEY[data.book?.rank]?.color || '#c5a66b')
        : (TALENT_GRADES[data.grade]?.color || '#c88af0');
      addRing(pos.x, pos.y, 10, type === 'orb' || type === 'classBook' ? 80 : 55, 0.8, type === 'orb' || type === 'classBook' ? gradeColor : '#d7b371', 2);
    }
    return loot;
  }

  function collectLoot(loot) {
    if (loot.collected) return;
    loot.collected = true;
    const p = game.player;
    if (loot.type === 'gold') {
      p.gold += loot.data.amount;
      audio.play('coin');
      addDamageText(loot.x, loot.y - 8, `+${loot.data.amount}`, '#e7c97e', false, false);
      addParticleBurst(loot.x, loot.y, 4, '#e6c475', 80, 0.4);
      return;
    }
    if (loot.type === 'health') {
      const heal = Math.round(p.stats.maxHp * 0.18);
      p.hp = Math.min(p.stats.maxHp, p.hp + heal);
      audio.play('pickup');
      addDamageText(loot.x, loot.y - 10, `+${heal}`, '#72d29f', false, false);
      addParticleBurst(loot.x, loot.y, 10, '#7ed0a2', 90, 0.6);
      return;
    }
    if (loot.type === 'orb') {
      const talent = TALENT_BY_ID[loot.data.talentId];
      if (talent) addTalent(talent.id, 'orb');
      const grade = TALENT_GRADES[talent?.grade] || TALENT_GRADES.A;
      addParticleBurst(loot.x, loot.y, 26, grade.color, 160, 1.1);
      return;
    }
    if (loot.type === 'classBook') {
      receiveClassBook(loot.data.book);
      return;
    }
    if (loot.type === 'equipment') {
      receiveEquipment(loot.data.item);
      return;
    }
    if (loot.type === 'skill') {
      receiveSkill(loot.data.skill);
    }
  }

  function receiveClassBook(book) {
    if (!book) return;
    const p = game.player;
    if (!Array.isArray(p.classBooks)) p.classBooks = [];
    p.classBooks.push(book);
    const rank = CLASS_BOOK_RANK_BY_KEY[book.rank] || CLASS_BOOK_RANKS[0];
    audio.play('orb');
    addParticleBurst(p.x, p.y, 32, rank.color, 190, 1.2);
    addRing(p.x, p.y, 12, 110, 0.9, rank.color, 2);
    showToast({
      title: `获得 ${rank.label}转职书`,
      tag: '转职 · 按 J 开启',
      desc: `书页上残留着异世职业的烙印。使用后可选择职业，并获得一本转职天赋（强度 ×${rank.mult}）。`,
      color: rank.color,
      orb: true,
      duration: 5600
    });
    updateHud(true);
    saveGame();
  }

  function useClassBook(bookUid) {
    const p = game.player;
    if (!p || game.state !== 'panel') return;
    const book = (p.classBooks || []).find(b => b.uid === bookUid);
    if (!book) return;
    const options = shuffled(CLASSES).slice(0, 3).map(c => c.id);
    game.classChoice = { bookUid, options };
    renderPanel();
    audio.play('click');
  }

  function cancelClassChoice() {
    game.classChoice = null;
    renderPanel();
    audio.play('click');
  }

  function chooseClass(classId) {
    const p = game.player;
    if (!p || !game.classChoice) return;
    if (!game.classChoice.options.includes(classId)) return;
    const bookIndex = (p.classBooks || []).findIndex(b => b.uid === game.classChoice.bookUid);
    if (bookIndex < 0) return;
    const cls = CLASS_BY_ID[classId];
    if (!cls) return;
    const book = p.classBooks[bookIndex];
    const rank = CLASS_BOOK_RANK_BY_KEY[book.rank] || CLASS_BOOK_RANKS[0];

    p.classBooks.splice(bookIndex, 1);
    p.currentClass = classId;
    if (!p.classTalents[classId]) {
      p.classTalents[classId] = { count: 0, power: 0, bestRank: rank.key };
    }
    const entry = p.classTalents[classId];
    entry.count++;
    entry.power = Math.round((entry.power + rank.mult) * 100) / 100;
    if (rank.rank > (CLASS_BOOK_RANK_BY_KEY[entry.bestRank]?.rank ?? -1)) entry.bestRank = rank.key;
    deriveStats(p, 'ratio');

    game.classChoice = null;
    audio.play(rank.rank >= 4 ? 'rare' : 'skill');
    showToast({
      title: `转职 · ${cls.name}`,
      tag: `${rank.label} · ${cls.talentName}`,
      desc: `获得转职天赋「${cls.talentName}」· 累计强度 +${rank.mult}。${cls.effect(entry.power)}`,
      color: rank.color,
      orb: rank.rank >= 4,
      duration: 5200
    });
    addParticleBurst(p.x, p.y, 32, rank.color, 180, 1.2);
    addRing(p.x, p.y, 12, 125, 0.8, rank.color, 2);
    updateHud(true);
    renderPanel();
    saveGame();
  }

  function openAscension() {
    const p = game.player;
    if (!p || game.ascended || p.level < ASCENSION_LEVEL || game.state !== 'panel') return;
    $('modalLayer').classList.add('hidden');
    game.activePanel = null;
    game.classChoice = null;
    game.state = 'ascension';
    $('ascensionScreen').classList.remove('hidden');
    audio.play('orb');
  }

  function cancelAscension() {
    if (game.state !== 'ascension') return;
    $('ascensionScreen').classList.add('hidden');
    game.state = 'playing';
    audio.play('click');
    updateHud(true);
  }

  function grantDivineEquipment() {
    const p = game.player;
    const def = pick(DIVINE_ITEMS);
    const level = Math.max(ASCENSION_LEVEL + 15, p.level + 15);
    const item = makeDivineEquipment(def, level);
    const old = p.equipment[item.slot];
    if (old) addToInventory(old);
    p.equipment[item.slot] = item;
    deriveStats(p, 'ratio');
    audio.play('rare');
    addParticleBurst(p.x, p.y, 70, '#ffe4a1', 260, 1.8);
    addRing(p.x, p.y, 15, 300, 1.2, '#ffe1a0', 4);
    showToast({
      title: `神装降世 · ${item.name}`,
      tag: `${def.source} · ${RARITIES.divine.label}`,
      desc: `${def.lore}　已自动装备。`,
      color: RARITIES.divine.color,
      orb: true,
      duration: 8500
    });
    return item;
  }

  function performAscension() {
    const p = game.player;
    if (!p || game.ascended || p.level < ASCENSION_LEVEL) return;
    $('ascensionScreen').classList.add('hidden');
    game.state = 'playing';
    game.ascended = true;
    p.ascended = true;
    p.hp = p.stats.maxHp;
    game.ascensionNoticeShown = true;
    game.ascensionNoticePending = false;

    clearCombat();
    grantDivineEquipment();
    game.bossTimer = 52;
    game.spawnTimer = 1.4;
    spawnInitialPack();
    game.zoneBand = zoneBandFor(getZoneLevelAt(Math.hypot(p.x, p.y)));
    const zoneLv = getCurrentZoneLevel();
    const relativeLv = Math.max(1, zoneLv - DIVINE_ENEMY_LEVEL_BONUS);
    showLocationBanner(zoneNameFor(zoneLv), `神域 · ${romanFor(relativeLv)}`);
    showToast({
      title: '飞升成功 · 神域已开',
      tag: 'LEVEL 30 · DIVINE REALM',
      desc: '凡尘的边界在你身后闭合。神域的怪物和掉落提升了 20 级。',
      color: '#ffe2a3',
      orb: true,
      duration: 7000
    });
    audio.play('level');
    addRing(p.x, p.y, 30, 460, 1.4, '#ffe2a3', 4);
    addParticleBurst(p.x, p.y, 60, '#f4d893', 220, 1.6);
    updateHud(true);
    saveGame();
  }

  function renderClassTalentCard(cls, entry, rankColor = null) {
    const rank = CLASS_BOOK_RANK_BY_KEY[entry.bestRank] || CLASS_BOOK_RANKS[0];
    const color = rankColor || rank.color;
    return `<div class="class-talent-row" style="--rarity-color:${color};--rarity-soft:${rank.soft}">
      <div class="ct-icon">${cls.icon}</div>
      <div class="ct-info">
        <div class="ct-head"><b>${cls.name} · ${cls.talentName}</b><span>${rank.label} · 层数 ${entry.count}</span></div>
        <div class="ct-source">${cls.source} · ${cls.title}</div>
        <div class="ct-effect">${cls.effect(entry.power)}</div>
        <div class="ct-power">累计职业强度 ${nf(entry.power)}</div>
      </div>
    </div>`;
  }

  function receiveEquipment(item) {
    const p = game.player;
    const current = p.equipment[item.slot];
    if (game.autoEquip && (!current || itemScore(item) > itemScore(current))) {
      if (current) addToInventory(current);
      p.equipment[item.slot] = item;
      deriveStats(p, 'ratio');
      const rarity = RARITIES[item.rarity];
      audio.play(rarity.index >= 3 ? 'rare' : 'pickup');
      showToast({
        title: `已装备 · ${item.name}`,
        tag: `${rarity.label} · Lv.${item.level}`,
        desc: itemStatLine(item),
        color: rarity.color
      });
    } else {
      addToInventory(item);
      const rarity = RARITIES[item.rarity];
      if (rarity.index >= 3) {
        showToast({
          title: `获得 ${item.name}`,
          tag: `${rarity.label} · 行囊`,
          desc: '评分低于当前装备，已放入行囊。',
          color: rarity.color
        });
      }
    }
    updateHud(true);
  }

  function addToInventory(item) {
    const p = game.player;
    if (p.inventory.length >= 30) {
      const value = Math.max(2, Math.round(item.value * 0.55));
      p.gold += value;
      showToast({
        title: '行囊已满，自动分解',
        tag: `+${value} 金币`,
        desc: '黑市会收下一切无主之物。',
        color: '#a69a82'
      });
      return;
    }
    p.inventory.push(item);
  }

  function itemStatLine(item) {
    return Object.entries(item.stats || {}).slice(0, 3).map(([k, v]) => {
      const label = STAT_LABELS[k] || k;
      return `${label} +${v}${isPercentStat(k) ? '%' : ''}`;
    }).join(' · ');
  }

  function receiveSkill(skill) {
    const p = game.player;
    const existingIndex = p.skills.findIndex(s => s.skillId === skill.skillId);
    const rarity = RARITIES[skill.rarity];
    if (existingIndex >= 0) {
      const existing = p.skills[existingIndex];
      if (skillScore(skill) > skillScore(existing)) {
        const equippedIndex = p.equipped.findIndex(s => s && s.uid === existing.uid);
        p.skills[existingIndex] = skill;
        if (equippedIndex >= 0) {
          p.equipped[equippedIndex] = skill;
          p.skillCooldowns[equippedIndex] = 0.5;
        }
        addToInventoryGold(skill.level * 3);
        showToast({
          title: `战技精进 · ${skill.name}`,
          tag: `${rarity.label} · Lv.${skill.level}`,
          desc: `威能提升至 ${skill.power.toFixed(2)} 倍。已替换旧版本。`,
          color: rarity.color
        });
        renderSkillBar();
      } else {
        const value = Math.max(3, skill.level * 2);
        addToInventoryGold(value);
      }
    } else {
      if (p.skills.length >= 24) {
        addToInventoryGold(skill.level * 4);
        return;
      }
      p.skills.push(skill);
      let autoSlot = -1;
      for (let i = 0; i < p.slots; i++) if (!p.equipped[i]) { autoSlot = i; break; }
      if (autoSlot >= 0) {
        p.equipped[autoSlot] = skill;
        p.skillCooldowns[autoSlot] = 0.5;
        renderSkillBar();
        showToast({
          title: `习得战技 · ${skill.name}`,
          tag: `${rarity.label} · 自动装备`,
          desc: `已填入第 ${autoSlot + 1} 个技能槽。`,
          color: rarity.color
        });
      } else {
        showToast({
          title: `战技书 · ${skill.name}`,
          tag: `${rarity.label} · Lv.${skill.level}`,
          desc: '已收入技能书。按 K 打开技能面板，选择槽位后装备。',
          color: rarity.color
        });
      }
    }
    audio.play(rarity.index >= 3 ? 'rare' : 'pickup');
    updateHud(true);
  }

  function addToInventoryGold(amount) {
    game.player.gold += Math.max(1, Math.round(amount));
  }

  /* ============================================================
     Effects, particles & floating text
     ============================================================ */
  function addParticle(x, y, opts = {}) {
    if (game.particles.length > 650) return;
    game.particles.push({
      x, y,
      vx: opts.vx ?? rand(-40, 40),
      vy: opts.vy ?? rand(-80, -20),
      life: opts.life ?? rand(0.35, 0.8),
      maxLife: opts.life ?? 0.8,
      size: opts.size ?? rand(1, 3),
      color: opts.color || '#c7b58c',
      gravity: opts.gravity ?? 80,
      drag: opts.drag ?? 0.96,
      shape: opts.shape || 'dot',
      alpha: opts.alpha ?? 1
    });
  }

  function addParticleBurst(x, y, count, color, speed = 100, life = 0.6) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = rand(speed * 0.25, speed);
      addParticle(x, y, {
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        life: rand(life * 0.4, life),
        maxLife: life,
        size: rand(1, 3.2),
        color,
        gravity: 120,
        drag: 0.94
      });
    }
  }

  function addDamageText(x, y, value, color = '#e4dccb', crit = false, isSkill = false, incoming = false) {
    if (game.damageTexts.length > 100) game.damageTexts.shift();
    game.damageTexts.push({
      x, y,
      text: typeof value === 'number' ? `-${value}` : value,
      color, crit, isSkill, incoming,
      life: crit ? 1.0 : 0.76,
      maxLife: crit ? 1.0 : 0.76,
      vy: crit ? -58 : -42,
      vx: rand(-9, 9)
    });
  }

  function addRing(x, y, r0, r1, life, color = '#d5b777', width = 2) {
    game.effects.push({ kind: 'ring', x, y, r0, r1, life, maxLife: life, color, width });
  }

  function addExplosion(x, y, radius, color = '#e0a867', life = 0.5) {
    game.effects.push({ kind: 'explosion', x, y, radius, color, life, maxLife: life });
    addParticleBurst(x, y, Math.min(28, 8 + radius / 10), color, radius * 1.5, life * 1.3);
    game.camera.shake = Math.max(game.camera.shake, Math.min(7, radius * 0.022));
  }

  function addTelegraph(x, y, radius, delay, color, onTrigger) {
    game.effects.push({
      kind: 'telegraph', x, y, radius, delay, maxDelay: delay, life: delay,
      color, triggered: false, onTrigger
    });
  }

  function addBeam(x1, y1, x2, y2, width, color, life = 0.22) {
    game.effects.push({ kind: 'beam', x1, y1, x2, y2, width, color, life, maxLife: life });
  }

  function addChain(points, color, life = 0.25) {
    game.effects.push({ kind: 'chain', points, color, life, maxLife: life });
  }

  function addOrbit(skill, damageRaw) {
    const p = game.player;
    game.effects.push({
      kind: 'orbit',
      owner: p,
      skill,
      radius: skill.radius || 100,
      count: skill.count || 2,
      duration: skill.duration || 4,
      life: skill.duration || 4,
      maxLife: skill.duration || 4,
      tick: skill.tick || 0.4,
      tickTimer: 0,
      angle: Math.random() * TAU,
      color: skill.color || '#d6b879',
      damageRaw
    });
  }

  function updateEffects(dt) {
    for (const e of game.effects) {
      e.life -= dt;
      if (e.kind === 'telegraph') {
        e.delay -= dt;
        if (!e.triggered && e.delay <= 0) {
          e.triggered = true;
          e.onTrigger();
          addExplosion(e.x, e.y, e.radius, e.color, 0.55);
        }
      } else if (e.kind === 'orbit') {
        e.angle += dt * 3.4;
        e.tickTimer -= dt;
        if (e.tickTimer <= 0) {
          e.tickTimer = e.tick;
          const p = game.player;
          if (p && !p.dead) {
            const targets = enemiesWithin(p.x, p.y, e.radius + 18);
            for (const enemy of targets) {
              dealDamageToEnemy(enemy, e.damageRaw, {
                isSkill: true, sourceX: p.x, sourceY: p.y,
                color: e.color, skillHealPct: e.skill.healPct || 0
              });
            }
          }
        }
      }
    }
    game.effects = game.effects.filter(e => e.life > 0 || (e.kind === 'telegraph' && !e.triggered));

    for (const p of game.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    game.particles = game.particles.filter(p => p.life > 0);

    for (const t of game.damageTexts) {
      t.life -= dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vy += 24 * dt;
    }
    game.damageTexts = game.damageTexts.filter(t => t.life > 0);

    if (game.camera.shake > 0) {
      game.camera.shake = Math.max(0, game.camera.shake - dt * 18);
    }
  }

  /* ============================================================
     Player actions & skills
     ============================================================ */
  function firePlayerBolt(target, damageRaw, opts = {}) {
    const p = game.player;
    if (!target) return;
    const angle = Math.atan2(target.y - p.y, target.x - p.x);
    const count = opts.count || 1;
    const spread = opts.spread ?? 0.15;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const a = angle + offset;
      const speed = opts.speed || 560;
      game.projectiles.push({
        x: p.x + Math.cos(a) * 15,
        y: p.y + Math.sin(a) * 15 - 3,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        radius: opts.radius || 5,
        damage: damageRaw,
        color: opts.color || '#d9ceae',
        life: opts.life || 1.35,
        maxLife: opts.life || 1.35,
        pierce: opts.pierce || 0,
        hits: new Set(),
        targetId: target.id,
        homing: opts.homing ?? 0.9,
        isSkill: !!opts.isSkill,
        skillHealPct: opts.skillHealPct || 0,
        explode: opts.explode || 0,
        trail: []
      });
    }
    addParticleBurst(p.x + Math.cos(angle) * 18, p.y + Math.sin(angle) * 18, 3, opts.color || '#d9ceae', 60, 0.2);
  }

  function tryBasicAttack() {
    const p = game.player;
    if (p.dead) return;
    const target = nearestEnemy(p.x, p.y, p.stats.rangeBonus + CFG.baseAttackRange);
    if (!target) return;
    p.attackTimer = p.stats.attackInterval = CFG.baseAttackInterval / (1 + p.stats.attackSpeed);
    p.attackTimer = p.stats.attackInterval;
    p.facing = Math.atan2(target.y - p.y, target.x - p.x);
    game.basicAttackCount++;
    const explode = p.stats.explosionPct > 0 && game.basicAttackCount % 4 === 0;
    firePlayerBolt(target, p.stats.attack * (1 + p.stats.allDamage), {
      color: '#ded2b4', speed: 620, life: 1.1, homing: 0.8,
      explode: explode ? p.stats.explosionPct : 0
    });
    audio.play('shoot');
    addParticleBurst(p.x + Math.cos(p.facing) * 20, p.y + Math.sin(p.facing) * 20 - 2, 2, '#e2d6b6', 45, 0.18);
  }

  function autoCastSkills(dt) {
    const p = game.player;
    for (let i = 0; i < p.slots; i++) {
      const skill = p.equipped[i];
      if (p.skillCooldowns[i] > 0) p.skillCooldowns[i] = Math.max(0, p.skillCooldowns[i] - dt);
      if (!skill || p.skillCooldowns[i] > 0) continue;
      const target = nearestEnemy(p.x, p.y, skill.range || 480);
      if (!target && skill.type !== 'shield') continue;
      if (skill.type === 'shield') {
        const near = nearestEnemy(p.x, p.y, 620);
        if (!near) continue;
      }
      castSkill(i);
    }
  }

  function castSkill(index) {
    const p = game.player;
    const skill = p.equipped[index];
    if (!skill || p.dead) return;
    const target = nearestEnemy(p.x, p.y, skill.range || 480);
    const damageRaw = p.stats.attack * skillPowerOf(skill) * (1 + p.stats.allDamage) * (1 + p.stats.skillPower) * p.stats.skillMult;
    p.facing = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.facing;
    let cast = false;
    const color = skill.color || '#c9b582';

    if (skill.type === 'bolt' && target) {
      firePlayerBolt(target, damageRaw, {
        count: skill.count || 1,
        color,
        isSkill: true,
        skillHealPct: skill.healPct || 0,
        speed: skill.speed || 560,
        spread: 0.13,
        life: 1.5
      });
      cast = true;
    } else if (skill.type === 'nova' && target) {
      const hits = enemiesWithin(p.x, p.y, skill.radius);
      for (const e of hits) {
        dealDamageToEnemy(e, damageRaw, { isSkill: true, color });
        if (skill.slow) {
          e.slowUntil = Math.max(e.slowUntil, game.time + (skill.slowTime || 2));
          e.slowAmount = Math.max(e.slowAmount || 0, skill.slow);
        }
      }
      addRing(p.x, p.y, 16, skill.radius, 0.46, color, 4);
      addParticleBurst(p.x, p.y, 18, color, skill.radius * 1.5, 0.55);
      if (skill.id === 'abyss_tide') {
        addRing(p.x, p.y, 30, skill.radius * 1.1, 0.8, color, 2);
        game.camera.shake = 5;
      }
      cast = true;
    } else if (skill.type === 'strike' && target) {
      const tx = target.x;
      const ty = target.y;
      addTelegraph(tx, ty, skill.radius, skill.delay || 0.7, color, () => {
        damageArea(tx, ty, skill.radius, damageRaw, { isSkill: true, color });
        if (skill.slow) {
          for (const e of enemiesWithin(tx, ty, skill.radius)) {
            e.slowUntil = Math.max(e.slowUntil, game.time + (skill.slowTime || 2));
            e.slowAmount = Math.max(e.slowAmount || 0, skill.slow);
          }
        }
      });
      cast = true;
    } else if (skill.type === 'chain' && target) {
      const points = [{ x: p.x, y: p.y }];
      let current = target;
      const hit = new Set();
      for (let i = 0; i < (skill.chainCount || 4) && current; i++) {
        if (hit.has(current.id)) break;
        hit.add(current.id);
        points.push({ x: current.x, y: current.y });
        dealDamageToEnemy(current, damageRaw, { isSkill: true, color });
        current = nearestEnemyFrom(current.x, current.y, skill.chainRange || 220, hit);
      }
      addChain(points, color, 0.32);
      cast = true;
    } else if (skill.type === 'beam' && target) {
      const a = Math.atan2(target.y - p.y, target.x - p.x);
      const length = skill.range || 580;
      const x2 = p.x + Math.cos(a) * length;
      const y2 = p.y + Math.sin(a) * length;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (pointSegmentDistance(e.x, e.y, p.x, p.y, x2, y2) < (skill.width || 30) / 2 + e.radius) {
          dealDamageToEnemy(e, damageRaw, { isSkill: true, color, sourceX: p.x, sourceY: p.y });
        }
      }
      addBeam(p.x, p.y - 4, x2, y2, skill.width || 30, color, 0.28);
      game.camera.shake = Math.max(game.camera.shake, 3);
      cast = true;
    } else if (skill.type === 'orbit') {
      addOrbit(skill, damageRaw);
      addRing(p.x, p.y, 14, skill.radius || 100, 0.45, color, 2);
      cast = true;
    } else if (skill.type === 'shield') {
      const amount = Math.round(p.stats.maxHp * (skill.shieldPct || 0.14) * (1 + (skill.power - 1) * 0.45));
      p.shield = Math.max(p.shield, amount);
      p.shieldTimer = skill.duration || 8;
      if (skill.healPct) {
        const heal = Math.round(p.stats.maxHp * skill.healPct * skill.power);
        p.hp = Math.min(p.stats.maxHp, p.hp + heal);
        addDamageText(p.x, p.y - 36, `+${heal}`, '#8fe4b4', false, false);
      }
      addRing(p.x, p.y, 18, 55, 0.4, color, 3);
      addParticleBurst(p.x, p.y, 14, color, 90, 0.6);
      cast = true;
    }

    if (cast) {
      p.skillCooldowns[index] = skillCd(skill);
      audio.play('skill');
      const slot = document.querySelector(`[data-skill-slot="${index}"]`);
      if (slot) {
        slot.classList.remove('pulse');
        void slot.offsetWidth;
        slot.classList.add('pulse');
      }
    }
  }

  function nearestEnemyFrom(x, y, range, exclude = new Set()) {
    let best = null;
    let bestD = range;
    for (const e of game.enemies) {
      if (e.dead || exclude.has(e.id)) continue;
      const d = dist(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function pointSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return dist(px, py, x1, y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = clamp(t, 0, 1);
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }

  function triggerDash() {
    const p = game.player;
    if (!p || p.dead || game.state !== 'playing' || p.dashCooldown > 0) return;
    const input = getMoveInput();
    let dx = input.x;
    let dy = input.y;
    if (!dx && !dy) { dx = Math.cos(p.facing); dy = Math.sin(p.facing); }
    const len = Math.hypot(dx, dy) || 1;
    p.dashDir = { x: dx / len, y: dy / len };
    p.dashTime = CFG.dashTime;
    p.dashCooldown = CFG.dashCooldown * (1 - (p.stats.dashCooldownReduction || 0));
    p.invuln = Math.max(p.invuln, 0.3);
    game.dashing = true;
    audio.play('dash');
    addParticleBurst(p.x, p.y, 12, '#87c4bd', 100, 0.45);
    addRing(p.x, p.y, 8, 30, 0.3, 'rgba(107,199,194,.55)', 1);
  }

  function getMoveInput() {
    let x = 0;
    let y = 0;
    if (game.keys.has('KeyA') || game.keys.has('ArrowLeft')) x -= 1;
    if (game.keys.has('KeyD') || game.keys.has('ArrowRight')) x += 1;
    if (game.keys.has('KeyW') || game.keys.has('ArrowUp')) y -= 1;
    if (game.keys.has('KeyS') || game.keys.has('ArrowDown')) y += 1;
    if (game.joystick.active) { x += game.joystick.x; y += game.joystick.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  /* ============================================================
     Simulation update
     ============================================================ */
  function updatePlayer(dt) {
    const p = game.player;
    if (!p || p.dead) return;
    p.playTime += dt;
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.dashTime = Math.max(0, p.dashTime - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.skillHealCd = Math.max(0, p.skillHealCd - dt);
    p.hitComboTimer = Math.max(0, p.hitComboTimer - dt);

    if (p.shield > 0) {
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);
      if (p.shieldTimer <= 0) {
        addRing(p.x, p.y, 24, 50, 0.32, 'rgba(210,201,174,.5)', 1);
        p.shield = 0;
      }
    }

    let input = getMoveInput();
    let moving = input.x !== 0 || input.y !== 0;
    p.moving = moving;

    if (p.dashTime > 0) {
      input = { x: p.dashDir.x, y: p.dashDir.y };
      moving = true;
      if (Math.random() < 0.7) {
        addParticle(p.x + rand(-6, 6), p.y + rand(-4, 4), {
          vx: rand(-10, 10), vy: rand(-10, 10), life: 0.3, maxLife: 0.3,
          size: rand(2, 4), color: '#7fc9c0', gravity: 0, drag: 0.9, alpha: 0.6
        });
      }
    }

    if (moving) {
      const speed = p.dashTime > 0 ? CFG.dashSpeed : p.stats.moveSpeed;
      let mx = input.x * speed * dt;
      let my = input.y * speed * dt;
      let pos = resolveWorldCollision(p.x + mx, p.y, p.radius);
      p.x = pos.x;
      pos = resolveWorldCollision(p.x, p.y + my, p.radius);
      p.y = pos.y;
      p.walkPhase += dt * (speed / 34);
      if (p.dashTime <= 0 && Math.random() < dt * 7) {
        addParticle(p.x + rand(-7, 7), p.y + rand(2, 10), {
          vx: rand(-8, 8), vy: rand(-10, -2), life: 0.4, maxLife: 0.4,
          size: rand(1, 2), color: '#887a62', gravity: -5, drag: 0.93, alpha: 0.35
        });
      }
    }

    const aimTarget = nearestEnemy(p.x, p.y, 520);
    if (aimTarget) p.facing = Math.atan2(aimTarget.y - p.y, aimTarget.x - p.x);
    else if (moving) p.facing = Math.atan2(input.y, input.x);
    p.auraAngle += dt * 0.7;

    p.attackTimer -= dt;
    if (p.attackTimer <= 0) tryBasicAttack();
    autoCastSkills(dt);

    const hpRegen = p.stats.maxHp * (0.0018 + (p.stats.regenPct || 0)) + 0.2;
    p.hp = Math.min(p.stats.maxHp, p.hp + hpRegen * dt);
    const originDist = Math.hypot(p.x, p.y);
    if (originDist < 150) {
      p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * 0.045 * dt);
      if (Math.random() < dt * 4) {
        addParticle(p.x + rand(-38, 38), p.y + rand(-22, 22), {
          vx: rand(-5, 5), vy: rand(-30, -10), life: 0.9, maxLife: 0.9,
          size: rand(0.8, 1.8), color: '#78c9c1', gravity: -10, drag: 0.96, alpha: 0.65
        });
      }
    }

    p.deepest = Math.max(p.deepest, originDist);
    const zoneLevel = getZoneLevelAt(originDist);
    const band = zoneBandFor(zoneLevel);
    if (band !== game.zoneBand && p.playTime > 1) {
      game.zoneBand = band;
      const relative = game.ascended ? Math.max(1, zoneLevel - DIVINE_ENEMY_LEVEL_BONUS) : zoneLevel;
      showLocationBanner(zoneNameFor(zoneLevel), game.ascended ? `神域 · ${romanFor(relative)}` : `威胁等级 ${romanFor(zoneLevel)}`);
    }
    game.currentZoneLevel = zoneLevel;

    if (game.comboTimer > 0) game.comboTimer -= dt;
  }

  function updateEnemies(dt) {
    const p = game.player;
    if (!p) return;
    const time = game.time;

    for (const e of game.enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.attackTimer -= dt;
      e.bob += dt * (e.boss ? 1.2 : 2.2);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.facing = Math.atan2(dy, dx);

      if (d > 2350 && !e.boss) { e.removeMe = true; continue; }
      if (e.boss && d > 1900) {
        game.boss = null;
        $('bossWrap').classList.remove('visible');
        game.bossTimer = 70;
        e.dead = true;
        showToast({
          title: '领主退回黑暗',
          tag: '距离过远',
          desc: '深渊收回了它的孩子。下次它会更饥饿。',
          color: '#8a7260'
        });
        continue;
      }

      let speedMul = 1;
      if (e.slowUntil > time) speedMul *= (1 - (e.slowAmount || 0));
      else { e.slowAmount = 0; e.slowUntil = 0; }

      if (e.boss) {
        updateBossAI(e, dt, d, dx, dy);
      } else if (e.behavior === 'ranged') {
        const desired = e.typeId === 'wraith' ? 230 : 300;
        let moveX = 0, moveY = 0;
        if (d > desired + 40) { moveX = dx / d; moveY = dy / d; }
        else if (d < desired - 60) { moveX = -dx / d; moveY = -dy / d; }
        else {
          const strafe = Math.sin(time * 1.3 + e.seed) > 0 ? 1 : -1;
          moveX = (-dy / d) * strafe;
          moveY = (dx / d) * strafe;
        }
        moveEnemy(e, moveX, moveY, e.speed * 0.55 * speedMul, dt);
        if (d < 500 && e.attackTimer <= 0) {
          enemyShoot(e, dx / d, dy / d);
          e.attackTimer = e.attackInterval;
        }
      } else {
        const stopDist = e.radius + p.radius + 7;
        if (d > stopDist) {
          moveEnemy(e, dx / d, dy / d, e.speed * speedMul, dt);
        }
        if (d < e.radius + p.radius + 16 && e.attackTimer <= 0) {
          e.attackTimer = e.attackInterval;
          damagePlayer(e.damage, 'melee', e);
          addSlash(e.x, e.y, e.facing, e.radius + 22, e.elite ? '#e8b36e' : '#c7b59a', 0.22);
          const kbAngle = Math.atan2(p.y - e.y, p.x - e.x);
          if (p.dashTime <= 0) {
            p.x += Math.cos(kbAngle) * 5;
            p.y += Math.sin(kbAngle) * 5;
          }
        }
      }
    }

    // Soft separation keeps the horde readable.
    const alive = game.enemies.filter(e => !e.dead && !e.removeMe);
    for (let i = 0; i < alive.length; i++) {
      const a = alive[i];
      for (let j = i + 1; j < alive.length; j++) {
        const b = alive[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = (a.radius + b.radius) * 0.78;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = (minD - d) * 0.45;
          const ux = dx / d;
          const uy = dy / d;
          if (!a.boss) { a.x -= ux * push; a.y -= uy * push; }
          if (!b.boss) { b.x += ux * push; b.y += uy * push; }
        }
      }
    }
  }

  function updateBossAI(e, dt, d, dx, dy) {
    const p = game.player;
    const time = game.time;
    const enraged = e.hp / e.maxHp < 0.3;
    if (enraged && !e.enraged) {
      e.enraged = true;
      e.speed *= 1.22;
      showToast({
        title: `${e.name} · 狂暴`,
        tag: '危险',
        desc: '领主的血量降至三成。深渊开始为它让路。',
        color: '#d46d63'
      });
      addRing(e.x, e.y, 20, 200, 0.8, '#e46e5f', 3);
    }
    e.specialTimer -= dt;
    e.summonTimer -= dt;
    e.slamTimer -= dt;

    const stop = e.radius + p.radius + 26;
    if (d > stop) moveEnemy(e, dx / d, dy / d, e.speed * (enraged ? 1.15 : 1), dt);
    if (d < e.radius + p.radius + 38 && e.attackTimer <= 0) {
      e.attackTimer = e.attackInterval;
      damagePlayer(e.damage, 'boss', e);
      addSlash(e.x, e.y, e.facing, e.radius + 38, e.aura, 0.35);
      game.camera.shake = Math.max(game.camera.shake, 7);
    }

    if (e.specialTimer <= 0) {
      e.specialTimer = enraged ? 3.3 : 4.6;
      const count = enraged ? 14 : 10;
      const offset = Math.random() * TAU;
      for (let i = 0; i < count; i++) {
        const a = offset + (i / count) * TAU;
        game.enemyProjectiles.push({
          x: e.x + Math.cos(a) * (e.radius + 4),
          y: e.y + Math.sin(a) * (e.radius + 4),
          vx: Math.cos(a) * 245,
          vy: Math.sin(a) * 245,
          radius: 8,
          damage: e.damage * 0.75,
          life: 3.2,
          color: e.aura || '#dc8766',
          boss: true,
          owner: e
        });
      }
      addRing(e.x, e.y, 12, e.radius + 90, 0.6, e.aura || '#dc8766', 3);
      addParticleBurst(e.x, e.y, 24, e.aura || '#dc8766', 160, 0.8);
      audio.play('skill');
    }

    if (e.bossDef.pattern === 'slam' && e.slamTimer <= 0) {
      e.slamTimer = enraged ? 4.6 : 6.2;
      const slamX = p.x;
      const slamY = p.y;
      addTelegraph(slamX, slamY, 175, 0.9, e.aura || '#f07045', () => {
        if (dist(p.x, p.y, slamX, slamY) < 175 + p.radius) {
          damagePlayer(e.damage * 1.6, 'slam', e);
        }
        addExplosion(slamX, slamY, 175, '#e07850', 0.55);
        game.camera.shake = Math.max(game.camera.shake, 10);
      });
    }

    if (e.summonTimer <= 0) {
      e.summonTimer = enraged ? 6 : 9;
      const minions = game.enemies.filter(m => m.summoned && !m.dead).length;
      if (minions < 5) {
        const count = enraged ? 3 : 2;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * TAU;
          const m = spawnEnemyAt(
            e.x + Math.cos(a) * rand(70, 130),
            e.y + Math.sin(a) * rand(70, 130),
            Math.max(1, e.level - 1),
            { typeId: e.typeId, summoned: true, forceElite: false }
          );
          if (m) {
            m.summoned = true;
            addRing(m.x, m.y, 8, 55, 0.5, e.aura || '#c88459', 2);
          }
        }
      }
    }
    if (Math.random() < dt * 9) {
      addParticle(e.x + rand(-e.radius, e.radius), e.y + rand(-e.radius, e.radius), {
        vx: rand(-9, 9), vy: rand(-30, -6), life: rand(0.4, 0.9),
        maxLife: 0.9, size: rand(1, 2.5), color: e.aura || '#d59665',
        gravity: -10, drag: 0.96, alpha: 0.6
      });
    }
  }

  function moveEnemy(e, ux, uy, speed, dt) {
    if (!ux && !uy) return;
    let mx = ux * speed * dt;
    let my = uy * speed * dt;
    let pos;
    if (e.flying) {
      e.x += mx;
      e.y += my;
      return;
    }
    pos = resolveWorldCollision(e.x + mx, e.y, e.radius * 0.72);
    const movedX = Math.abs(pos.x - e.x);
    e.x = pos.x;
    pos = resolveWorldCollision(e.x, e.y + my, e.radius * 0.72);
    const movedY = Math.abs(pos.y - e.y);
    e.y = pos.y;
    if (movedX < Math.abs(mx) * 0.5 && movedY < Math.abs(my) * 0.5) {
      // Slide around blocking geometry instead of vibrating against it.
      const tx = -uy * e.avoidSign;
      const ty = ux * e.avoidSign;
      const sidestep = resolveWorldCollision(e.x + tx * speed * 0.45 * dt, e.y + ty * speed * 0.45 * dt, e.radius * 0.72);
      e.x = sidestep.x;
      e.y = sidestep.y;
    }
  }

  function enemyShoot(e, ux, uy) {
    const p = game.player;
    const speed = e.projectileSpeed || 260;
    game.enemyProjectiles.push({
      x: e.x + ux * (e.radius + 5),
      y: e.y + uy * (e.radius + 5) - 4,
      vx: ux * speed,
      vy: uy * speed,
      radius: 6,
      damage: e.damage,
      life: 3.4,
      color: e.typeId === 'acolyte' ? '#d08adf' : '#91a1dd',
      boss: false,
      owner: e
    });
    addParticleBurst(e.x + ux * 12, e.y + uy * 12, 3, e.typeId === 'acolyte' ? '#d08adf' : '#91a1dd', 55, 0.3);
    audio.play('shoot');
  }

  function addSlash(x, y, angle, radius, color, life) {
    game.effects.push({ kind: 'slash', x, y, angle, radius, color, life, maxLife: life });
  }

  function updateProjectiles(dt) {
    for (const proj of game.projectiles) {
      if (proj.dead) continue;
      proj.life -= dt;
      if (proj.life <= 0) { proj.dead = true; continue; }
      // gentle homing
      if (proj.homing > 0) {
        const target = game.enemies.find(e => e.id === proj.targetId && !e.dead);
        if (target) {
          const desired = Math.atan2(target.y - proj.y, target.x - proj.x);
          const current = Math.atan2(proj.vy, proj.vx);
          let diff = ((desired - current + Math.PI * 3) % TAU) - Math.PI;
          const turn = clamp(diff, -proj.homing * 4 * dt, proj.homing * 4 * dt);
          const speed = Math.hypot(proj.vx, proj.vy);
          const a = current + turn;
          proj.vx = Math.cos(a) * speed;
          proj.vy = Math.sin(a) * speed;
        }
      }
      proj.trail.push({ x: proj.x, y: proj.y });
      if (proj.trail.length > 6) proj.trail.shift();
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      if (projectileHitsWorld(proj.x, proj.y)) {
        proj.dead = true;
        addParticleBurst(proj.x, proj.y, 4, proj.color, 70, 0.3);
        continue;
      }
      for (const e of game.enemies) {
        if (e.dead || proj.hits.has(e.id)) continue;
        if (dist(proj.x, proj.y, e.x, e.y) < proj.radius + e.radius) {
          proj.hits.add(e.id);
          dealDamageToEnemy(e, proj.damage, {
            isSkill: proj.isSkill,
            color: proj.color,
            sourceX: proj.x, sourceY: proj.y,
            lifeOnHit: true,
            skillHealPct: proj.skillHealPct || 0
          });
          if (proj.explode > 0) {
            addExplosion(proj.x, proj.y, 110, '#e5a35f', 0.5);
            damageArea(proj.x, proj.y, 110, game.player.stats.attack * proj.explode * (1 + game.player.stats.allDamage), {
              isSkill: true, color: '#e5a35f'
            });
            proj.explode = 0;
          }
          if (proj.pierce > 0) proj.pierce--;
          else { proj.dead = true; break; }
        }
      }
    }
    game.projectiles = game.projectiles.filter(p => !p.dead);

    for (const proj of game.enemyProjectiles) {
      if (proj.dead) continue;
      proj.life -= dt;
      if (proj.life <= 0) { proj.dead = true; continue; }
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      if (projectileHitsWorld(proj.x, proj.y)) {
        proj.dead = true;
        addParticleBurst(proj.x, proj.y, 3, proj.color, 60, 0.25);
        continue;
      }
      const p = game.player;
      if (p && !p.dead && dist(proj.x, proj.y, p.x, p.y) < proj.radius + p.radius) {
        proj.dead = true;
        damagePlayer(proj.damage, 'projectile', proj.owner || null);
        addParticleBurst(proj.x, proj.y, 6, proj.color, 90, 0.35);
      }
    }
    game.enemyProjectiles = game.enemyProjectiles.filter(p => !p.dead);
  }

  function projectileHitsWorld(x, y) {
    // Cheap check against nearby large blockers only.
    const features = nearbyFeatures(x, y, 60);
    for (const f of features) {
      if (!['pillar', 'wall', 'statue'].includes(f.type)) continue;
      if (x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h) return true;
    }
    return false;
  }

  function updateLoot(dt) {
    const p = game.player;
    for (const loot of game.loot) {
      if (loot.collected) continue;
      loot.age += dt;
      loot.bob += dt * 2.2;
      if (loot.age < 0.45) {
        loot.x += loot.vx * dt;
        loot.y += loot.vy * dt;
        loot.vx *= 0.9;
        loot.vy *= 0.9;
      }
      const d = dist(loot.x, loot.y, p.x, p.y);
      const baseMagnet = loot.type === 'gold' ? 480 : loot.type === 'classBook' ? 460 : 255;
      const magnetRange = baseMagnet + (p.stats.pickupRadius || 0);
      if (d < magnetRange) {
        const speed = 160 + (magnetRange - d) * 4.2;
        loot.x += ((p.x - loot.x) / d) * speed * dt;
        loot.y += ((p.y - loot.y) / d) * speed * dt;
      }
      if (d < 23 + (loot.important ? 10 : 0)) collectLoot(loot);
    }
    game.loot = game.loot.filter(l => !l.collected);
  }

  function updateSpawning(dt) {
    const p = game.player;
    game.spawnTimer -= dt;
    if (game.bossTimer > 0 && !game.boss) {
      game.bossTimer -= dt;
      if (game.bossTimer <= 0) spawnBoss();
    }

    const zone = getCurrentZoneLevel();
    if (game.spawnTimer <= 0) {
      const desired = maxActiveEnemies();
      if (game.enemies.filter(e => !e.dead).length < desired) {
        spawnAmbientEnemy();
        if (zone >= 4 && Math.random() < 0.28) spawnAmbientEnemy();
      }
      game.spawnTimer = clamp(0.93 - zone * 0.018, 0.48, 0.95) * rand(0.8, 1.2);
    }
  }

  function updateCombat(dt) {
    updatePlayer(dt);
    if (game.player.dead) return;
    updateEnemies(dt);
    updateProjectiles(dt);
    updateEffects(dt);
    updateLoot(dt);
    updateSpawning(dt);
    game.enemies = game.enemies.filter(e => !e.dead && !e.removeMe);

    const targetCameraX = game.player.x;
    const targetCameraY = game.player.y;
    const smooth = 1 - Math.exp(-dt * 7.5);
    game.camera.x = lerp(game.camera.x, targetCameraX, smooth);
    game.camera.y = lerp(game.camera.y, targetCameraY, smooth);

    if (game.comboTimer <= 0 && game.combo > 0) game.combo = 0;
  }

  function updateAmbient(dt) {
    game.ambient += dt;
    if (game.state === 'title') {
      const t = game.ambient;
      game.camera.x = Math.sin(t * 0.055) * 70;
      game.camera.y = Math.cos(t * 0.042) * 40 - 10;
      if (game.player) {
        game.player.moving = false;
        game.player.facing = Math.sin(t * 0.22) * 0.5 - Math.PI / 2;
        game.player.auraAngle += dt * 0.45;
      }
    }
    for (const d of game.dust) {
      d.x += d.vx * dt + Math.sin(game.ambient + d.phase) * 0.08;
      d.y += d.vy * dt;
      if (d.y < -4) { d.y = viewH + 4; d.x = Math.random() * viewW; }
      if (d.x < -4) d.x = viewW + 4;
      if (d.x > viewW + 4) d.x = -4;
    }
  }

  /* ============================================================
     Canvas rendering — world, actors, effects, light
     ============================================================ */
  let lightCanvas = document.createElement('canvas');
  let lightCtx = lightCanvas.getContext('2d');
  let frameLights = [];

  function resizeCanvas() {
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    lightCanvas.width = Math.floor(viewW * dpr);
    lightCanvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!game.dust.length) {
      for (let i = 0; i < 70; i++) {
        game.dust.push({
          x: Math.random() * viewW, y: Math.random() * viewH,
          vx: rand(-3, 3), vy: rand(-7, -1),
          size: rand(0.4, 1.6), alpha: rand(0.04, 0.2), phase: rand(0, TAU)
        });
      }
    }
  }

  function currentZoom() {
    const z = Math.min(viewW / 1250, viewH / 800);
    return clamp(z, 0.78, 1.25);
  }

  function drawFrame() {
    const zoom = currentZoom();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, viewW, viewH);

    const shakeMag = game.camera.shake;
    const shakeX = shakeMag ? rand(-shakeMag, shakeMag) : 0;
    const shakeY = shakeMag ? rand(-shakeMag, shakeMag) : 0;
    const camX = game.camera.x + shakeX;
    const camY = game.camera.y + shakeY;
    game.renderZoom = zoom;
    game.renderCam = { x: camX, y: camY };

    ctx.save();
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    drawWorld(zoom, camX, camY);
    ctx.restore();

    drawLighting(zoom, camX, camY);
    drawDust();
    drawEdgeVignette();
  }

  function visibleBounds(zoom, camX, camY, buffer = 140) {
    const halfW = viewW / (2 * zoom) + buffer;
    const halfH = viewH / (2 * zoom) + buffer;
    return {
      left: camX - halfW, right: camX + halfW,
      top: camY - halfH, bottom: camY + halfH,
      halfW, halfH
    };
  }

  function drawWorld(zoom, camX, camY) {
    const b = visibleBounds(zoom, camX, camY, 180);
    drawFloor(b);
    drawOriginSanctum();
    const chunks = getChunksInRange(camX, camY, Math.max(b.halfW, b.halfH) + 200);
    frameLights = [];

    for (const c of chunks) {
      for (const l of c.lights) {
        if (l.x > b.left && l.x < b.right && l.y > b.top && l.y < b.bottom) frameLights.push(l);
      }
      for (const d of c.decorations) drawDecoration(d);
    }

    const features = [];
    for (const c of chunks) {
      for (const f of c.features) {
        if (f.x + f.w > b.left && f.x < b.right && f.y + f.h > b.top && f.y < b.bottom) features.push(f);
      }
    }
    features.sort((a, b2) => (a.y + a.h) - (b2.y + b2.h));
    for (const f of features) drawFeature(f);

    drawLoot();
    drawActors();
    drawProjectiles();
    drawEffects();
    drawParticles();
    drawDamageTexts();

    // Warm braziers mark the sanctum at the origin.
    if (b.left < 420 && b.right > -420 && b.top < 420 && b.bottom > -420) {
      const sanctumBraziers = [[-165, 32], [165, 32], [-105, -140], [105, -140]];
      for (const [lx, ly] of sanctumBraziers) {
        frameLights.push({ x: lx, y: ly, radius: 205, color: 'rgba(232,142,72,', base: 0.25, flicker: lx * 0.02 });
      }
    }
    frameLights.push({
      x: game.player.x, y: game.player.y,
      radius: game.ascended ? 430 : 390,
      color: game.ascended ? 'rgba(245,208,128,' : 'rgba(100,190,186,',
      base: game.ascended ? 0.33 : 0.29,
      flicker: 5
    });
    if (game.boss) {
      frameLights.push({
        x: game.boss.x, y: game.boss.y,
        radius: 260, color: 'rgba(205,116,72,', base: 0.18, flicker: 2
      });
    }
  }

  function drawFloor(b) {
    const tile = CFG.tile;
    const minX = Math.floor(b.left / tile);
    const maxX = Math.ceil(b.right / tile);
    const minY = Math.floor(b.top / tile);
    const maxY = Math.ceil(b.bottom / tile);
    const seed = game.worldSeed;

    for (let ty = minY; ty <= maxY; ty++) {
      for (let tx = minX; tx <= maxX; tx++) {
        const wx = tx * tile;
        const wy = ty * tile;
        const h = hash2(tx, ty, seed);
        let color;
        if (game.ascended) {
          if (h < 0.16) color = '#211d15';
          else if (h < 0.48) color = '#2b251a';
          else if (h < 0.78) color = '#342c1e';
          else color = '#262116';
        } else {
          if (h < 0.16) color = '#151a21';
          else if (h < 0.48) color = '#1a2027';
          else if (h < 0.78) color = '#1e242b';
          else color = '#171d23';
        }
        ctx.fillStyle = color;
        ctx.fillRect(wx, wy, tile, tile);

        ctx.fillStyle = game.ascended ? 'rgba(255,227,162,0.035)' : 'rgba(210,196,165,0.025)';
        ctx.fillRect(wx + 1, wy + 1, tile - 2, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(wx, wy + tile - 1, tile, 1);
        ctx.fillRect(wx + tile - 1, wy, 1, tile);

        if (game.ascended && hash2(tx, ty, seed + 202) < 0.16) {
          ctx.strokeStyle = 'rgba(238,204,133,.14)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(wx + 9, wy + 10 + h * 12);
          ctx.lineTo(wx + 26, wy + 26 + h * 10);
          ctx.lineTo(wx + 38, wy + 50);
          ctx.stroke();
        }

        if (hash2(tx, ty, seed + 91) < 0.24) {
          const crack = hash2(tx, ty, seed + 33);
          ctx.strokeStyle = 'rgba(0,0,0,.38)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(wx + 8 + crack * 30, wy + 6 + crack * 14);
          ctx.lineTo(wx + 18 + crack * 25, wy + 20 + crack * 18);
          ctx.lineTo(wx + 14 + crack * 34, wy + 42 + crack * 9);
          ctx.stroke();
        }
        if (hash2(tx, ty, seed + 49) < 0.08) {
          ctx.fillStyle = 'rgba(67,91,62,.17)';
          ctx.beginPath();
          ctx.ellipse(wx + 20 + h * 30, wy + 35, 11 + h * 10, 4 + h * 5, h * 3, 0, TAU);
          ctx.fill();
        }
        if (hash2(tx, ty, seed + 71) < 0.15) {
          ctx.fillStyle = 'rgba(202,190,164,.12)';
          const px = wx + 15 + hash2(tx, ty, seed + 72) * 36;
          const py = wy + 15 + hash2(tx, ty, seed + 73) * 36;
          ctx.fillRect(px, py, 1.6, 1.6);
        }
      }
    }
  }

  function drawOriginSanctum() {
    const t = game.ambient;
    ctx.save();
    ctx.translate(0, 0);
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 180);
    g.addColorStop(0, 'rgba(65,133,126,.1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, 180, 0, TAU); ctx.fill();

    ctx.strokeStyle = 'rgba(107,199,194,.23)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 122, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(188,167,122,.14)';
    ctx.setLineDash([3, 9]);
    ctx.lineDashOffset = -t * 5;
    ctx.beginPath(); ctx.arc(0, 0, 145, 0, TAU); ctx.stroke();
    ctx.setLineDash([1, 16]);
    ctx.lineDashOffset = t * 3;
    ctx.beginPath(); ctx.arc(0, 0, 102, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.rotate(t * 0.035);
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.rotate((i / 8) * TAU);
      ctx.fillStyle = 'rgba(124,204,194,.24)';
      ctx.font = '8px "Cascadia Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(['生', '死', '魂', '归', '途', '寂', '灯', '影'][i], 0, -130);
      ctx.restore();
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(127,211,201,.24)';
    ctx.font = `${22 + Math.sin(t * 1.4) * 0.8}px "Songti SC", serif`;
    ctx.fillText('歸', 0, 1);
    ctx.strokeStyle = 'rgba(107,199,194,.12)';
    ctx.beginPath(); ctx.arc(0, 0, 64, 0, TAU); ctx.stroke();

    // Four old braziers, warm refuge against the cold rune-light.
    for (const [bx, by] of [[-165, 32], [165, 32], [-105, -140], [105, -140]]) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = 'rgba(0,0,0,.4)';
      ctx.beginPath(); ctx.ellipse(3, 15, 14, 5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(144,135,116,.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-9, 7); ctx.lineTo(-7, 16);
      ctx.moveTo(9, 7); ctx.lineTo(7, 16);
      ctx.stroke();
      const bowl = ctx.createLinearGradient(0, 0, 0, 8);
      bowl.addColorStop(0, '#38322a');
      bowl.addColorStop(1, '#161412');
      ctx.fillStyle = bowl;
      ctx.beginPath(); ctx.ellipse(0, 5, 14, 5.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(194,155,93,.38)';
      ctx.beginPath(); ctx.ellipse(0, 4, 11, 3.4, 0, 0, TAU); ctx.stroke();
      drawFlame(0, -2, 1.1 + Math.sin(t * 4.2 + bx) * 0.1, '#e99450');
      ctx.restore();
    }
    ctx.restore();
  }

  function drawDecoration(d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    if (d.type === 'crack') {
      ctx.strokeStyle = 'rgba(0,0,0,.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-16, -2);
      ctx.lineTo(-5, 4);
      ctx.lineTo(3, -3);
      ctx.lineTo(17, 5);
      ctx.stroke();
    } else if (d.type === 'bones') {
      ctx.save();
      ctx.rotate(d.rot);
      ctx.strokeStyle = 'rgba(182,171,146,.22)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(2, 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -5); ctx.lineTo(12, 3); ctx.stroke();
      ctx.fillStyle = 'rgba(182,171,146,.18)';
      ctx.beginPath(); ctx.arc(4, 1, 2.5, 0, TAU); ctx.fill();
      ctx.restore();
    } else if (d.type === 'moss') {
      ctx.fillStyle = 'rgba(48,76,55,.15)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 20 + d.seed * 14, 7 + d.seed * 6, d.rot, 0, TAU);
      ctx.fill();
    } else if (d.type === 'rubble') {
      ctx.fillStyle = 'rgba(33,37,40,.9)';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, d.rot, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(149,143,127,.13)';
      ctx.fillRect(-4, -2, 4, 1.5);
    } else if (d.type === 'rune') {
      ctx.globalAlpha = 0.2 + Math.sin(game.ambient * 1.2 + d.seed * 12) * 0.07;
      ctx.fillStyle = '#72c6bc';
      ctx.font = '13px "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.fillText('魂', 0, 0);
      ctx.strokeStyle = 'rgba(114,198,188,.25)';
      ctx.beginPath(); ctx.arc(0, 2, 18, 0, TAU); ctx.stroke();
    } else if (d.type === 'skull') {
      ctx.save();
      ctx.rotate(d.rot * 0.15);
      ctx.fillStyle = 'rgba(182,171,146,.16)';
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 5.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(8,9,11,.6)';
      ctx.beginPath(); ctx.arc(-2, -1, 1.1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(2.2, -1, 1.1, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(182,171,146,.12)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-4, 6); ctx.lineTo(-1, 11); ctx.moveTo(3, 6); ctx.lineTo(6, 10); ctx.stroke();
      ctx.restore();
    } else if (d.type === 'grate') {
      ctx.save();
      ctx.rotate(d.rot * 0.1);
      ctx.strokeStyle = 'rgba(120,119,107,.13)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-15, -9, 30, 18);
      for (let i = -8; i <= 8; i += 5) {
        ctx.beginPath(); ctx.moveTo(i, -9); ctx.lineTo(i, 9); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawFeature(f) {
    ctx.save();
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    if (f.type === 'pillar') {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.ellipse(cx + 6, f.y + f.h + 5, f.w * 0.7, f.h * 0.31, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#161b1f';
      ctx.fillRect(f.x + 4, f.y + 4, f.w - 8, f.h - 2);
      ctx.fillStyle = '#20262b';
      ctx.fillRect(f.x + 4, f.y + 4, f.w - 8, 5);
      ctx.strokeStyle = 'rgba(167,157,135,.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(f.x + 4.5, f.y + 4.5, f.w - 9, f.h - 3);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(f.x + 4, f.y + f.h - 4, f.w - 8, 4);
      ctx.fillStyle = '#0c0e11';
      ctx.beginPath(); ctx.ellipse(cx, f.y + 4, f.w * 0.5, f.h * 0.16, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(180,166,139,.16)';
      ctx.beginPath(); ctx.ellipse(cx, f.y + 4, f.w * 0.38, f.h * 0.1, 0, 0, TAU); ctx.stroke();
      if (f.torch) drawFlame(cx, f.y - 2, 1 + Math.sin(game.ambient * 3 + f.seed) * 0.06, f.glow);
    } else if (f.type === 'wall') {
      ctx.fillStyle = 'rgba(0,0,0,.42)';
      ctx.fillRect(f.x + 7, f.y + 10, f.w, f.h);
      ctx.fillStyle = '#1b2024';
      ctx.fillRect(f.x, f.y, f.w, f.h);
      ctx.fillStyle = '#282e31';
      ctx.fillRect(f.x, f.y, f.w, 5);
      ctx.fillStyle = '#0b0d0f';
      ctx.fillRect(f.x, f.y + f.h - 4, f.w, 4);
      ctx.strokeStyle = 'rgba(154,144,121,.14)';
      ctx.strokeRect(f.x + 0.5, f.y + 0.5, f.w - 1, f.h - 1);
      const horizontal = f.w > f.h;
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 1;
      if (horizontal) {
        for (let x = f.x + 38; x < f.x + f.w - 10; x += 38) {
          ctx.beginPath(); ctx.moveTo(x, f.y + 6); ctx.lineTo(x - 2, f.y + f.h - 5); ctx.stroke();
        }
      } else {
        for (let y = f.y + 38; y < f.y + f.h - 10; y += 38) {
          ctx.beginPath(); ctx.moveTo(f.x + 6, y); ctx.lineTo(f.x + f.w - 5, y - 2); ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(83,103,80,.09)';
      ctx.fillRect(f.x + 9, f.y + 8, Math.min(45, f.w - 18), 2);
      if (f.torch) drawFlame(cx, f.y - 1, 1, f.glow);
    } else if (f.type === 'brazier') {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); ctx.ellipse(cx + 3, f.y + f.h + 3, f.w * 0.8, 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1b1b1a';
      ctx.fillRect(cx - 3, cy, 6, f.h * 0.6);
      ctx.fillStyle = '#2c2a25';
      ctx.beginPath(); ctx.ellipse(cx, cy, f.w * 0.6, f.h * 0.32, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(198,167,103,.48)';
      ctx.beginPath(); ctx.ellipse(cx, cy, f.w * 0.47, f.h * 0.23, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#0c0b0a';
      ctx.beginPath(); ctx.ellipse(cx, cy - 2, f.w * 0.36, f.h * 0.16, 0, 0, TAU); ctx.fill();
      drawFlame(cx, cy - 7, 1.4 + Math.sin(game.ambient * 5 + f.seed) * 0.12, f.glow);
    } else if (f.type === 'statue') {
      ctx.fillStyle = 'rgba(0,0,0,.42)';
      ctx.beginPath(); ctx.ellipse(cx + 5, f.y + f.h + 3, 25, 8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#181d20';
      ctx.fillRect(f.x + 3, f.y + 6, f.w - 6, f.h - 4);
      ctx.fillStyle = '#242a2d';
      ctx.fillRect(f.x + 1, f.y + 2, f.w - 2, 7);
      ctx.fillStyle = '#101316';
      ctx.beginPath(); ctx.ellipse(cx, f.y + 12, 10, 11, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(166,155,131,.18)';
      ctx.beginPath(); ctx.moveTo(cx - 13, f.y + 22); ctx.lineTo(cx - 8, f.y + f.h - 6); ctx.moveTo(cx + 13, f.y + 22); ctx.lineTo(cx + 8, f.y + f.h - 6); ctx.stroke();
      ctx.fillStyle = 'rgba(105,186,177,.4)';
      ctx.fillRect(cx - 5, f.y + 9, 2.5, 2.5);
      ctx.fillRect(cx + 3, f.y + 9, 2.5, 2.5);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(cx, cy + 4, f.w * 0.65, f.h * 0.35, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(26,31,34,.85)';
      ctx.beginPath(); ctx.ellipse(cx - 6, cy, 17, 7, 0.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 9, cy + 3, 11, 5, -0.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawFlame(x, y, scale, color = '#e99450') {
    const t = game.ambient;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, -6, 0, 0, -4, 42 * scale);
    g.addColorStop(0, color === '#e99450' ? 'rgba(255,214,143,.55)' : 'rgba(133,226,216,.4)');
    g.addColorStop(0.35, color === '#e99450' ? 'rgba(232,132,59,.2)' : 'rgba(85,177,171,.15)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, -4, 42 * scale, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 3; i++) {
      const f = 1 + Math.sin(t * (7 + i) + i * 2) * 0.2;
      ctx.fillStyle = i === 0 ? 'rgba(246,151,59,.78)' : i === 1 ? 'rgba(197,67,33,.52)' : 'rgba(255,198,105,.55)';
      ctx.beginPath();
      ctx.moveTo(-5 * scale * f, 2);
      ctx.quadraticCurveTo(-7 * scale, -10 * scale * f, 0, -17 * scale * f);
      ctx.quadraticCurveTo(7 * scale, -9 * scale * f, 5 * scale * f, 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,230,164,.9)';
    ctx.beginPath();
    ctx.ellipse(0, -2, 2.3 * scale, 4.4 * scale, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------------------- loot ---------------------------- */
  function drawLoot() {
    const t = game.ambient;
    for (const loot of game.loot) {
      const bob = Math.sin(t * 2.4 + loot.bob) * 3;
      const y = loot.y + bob;
      const near = dist(loot.x, loot.y, game.player.x, game.player.y) < 330;
      if (loot.type === 'gold') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(loot.x, y, 0, loot.x, y, 22);
        g.addColorStop(0, 'rgba(226,191,108,.2)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(loot.x, y, 22, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#b9964d';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(loot.x + (i - 1) * 4, y + (i % 2) * 2, 3.6, 2, 0.2, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,225,153,.55)';
        ctx.fillRect(loot.x - 3, y - 1, 2, 1);
        continue;
      }
      if (loot.type === 'health') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(loot.x, y, 0, loot.x, y, 18);
        g.addColorStop(0, 'rgba(214,75,79,.22)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(loot.x, y, 18, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#a93f45';
        ctx.beginPath(); ctx.arc(loot.x, y, 5.5, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,211,194,.6)';
        ctx.fillRect(loot.x - 1, y - 5, 2, 5);
        ctx.fillRect(loot.x - 3, y - 3, 6, 2);
        continue;
      }

      let color = '#c4b48e';
      let label = '';
      if (loot.type === 'equipment') {
        color = RARITIES[loot.data.item.rarity].color;
        label = loot.data.item.name;
      } else if (loot.type === 'skill') {
        color = RARITIES[loot.data.skill.rarity].color;
        label = loot.data.skill.name;
      } else if (loot.type === 'orb') {
        const grade = TALENT_GRADES[loot.data.grade] || TALENT_GRADES.A;
        color = grade.color;
        label = `${grade.label}天赋宝珠 · ${TALENT_BY_ID[loot.data.talentId]?.name || ''}`;
      } else if (loot.type === 'classBook') {
        const rank = CLASS_BOOK_RANK_BY_KEY[loot.data.book?.rank] || CLASS_BOOK_RANKS[0];
        color = rank.color;
        label = `${rank.label}转职书`;
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const beamH = loot.type === 'orb' ? 90 : loot.type === 'classBook' ? 74 : 52;
      const beamW = loot.type === 'orb' ? 30 : loot.type === 'classBook' ? 22 : 16;
      const bg = ctx.createLinearGradient(loot.x, y - beamH, loot.x, y + 8);
      bg.addColorStop(0, 'rgba(0,0,0,0)');
      bg.addColorStop(0.65, hexAlpha(color, 0.08));
      bg.addColorStop(1, hexAlpha(color, 0.28));
      ctx.fillStyle = bg;
      ctx.fillRect(loot.x - beamW / 2, y - beamH, beamW, beamH + 8);
      ctx.restore();

      if (loot.type === 'equipment') {
        ctx.save();
        ctx.translate(loot.x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = 'rgba(9,12,15,.9)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.fillRect(-6, -6, 12, 12);
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = color;
        ctx.font = '8px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(loot.data.item.slot === 'weapon' ? '刃' : loot.data.item.slot === 'armor' ? '甲' : loot.data.item.slot === 'ring' ? '环' : '符', 0, 0.5);
        ctx.restore();
      } else if (loot.type === 'skill') {
        ctx.save();
        ctx.translate(loot.x, y - 1);
        ctx.fillStyle = 'rgba(9,12,15,.93)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8, -5); ctx.lineTo(0, -8); ctx.lineTo(8, -5); ctx.lineTo(8, 7); ctx.lineTo(0, 10); ctx.lineTo(-8, 7); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '8px "Songti SC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(loot.data.skill.icon, 0, 1);
        ctx.restore();
      } else if (loot.type === 'orb') {
        ctx.save();
        ctx.translate(loot.x, y - 8);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 24);
        g.addColorStop(0, hexAlpha(color, 0.65));
        g.addColorStop(0.4, hexAlpha(color, 0.2));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#1a1322';
        ctx.strokeStyle = color;
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '9px "Songti SC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('赋', 0, 1);
        ctx.strokeStyle = hexAlpha(color, 0.35);
        ctx.save();
        ctx.rotate(t * 1.1);
        ctx.beginPath(); ctx.ellipse(0, 0, 16, 5, 0.5, 0, TAU); ctx.stroke();
        ctx.restore();
        ctx.restore();
      } else if (loot.type === 'classBook') {
        ctx.save();
        ctx.translate(loot.x, y - 7);
        ctx.rotate(-0.08 + Math.sin(t * 2 + loot.bob) * 0.03);
        ctx.fillStyle = 'rgba(15,12,9,.94)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-10, -8); ctx.lineTo(6, -10); ctx.lineTo(11, 8); ctx.lineTo(-6, 10); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = hexAlpha(color, 0.45);
        ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(6, -5); ctx.moveTo(-5, 0); ctx.lineTo(7, -1); ctx.moveTo(-4, 4); ctx.lineTo(8, 3); ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = '8px "Songti SC", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('职', 0, 0);
        ctx.restore();
      }

      if (near || loot.type === 'orb' || loot.type === 'classBook') {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '9px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = color;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 5;
        ctx.fillText(label, loot.x, y + 24);
        ctx.restore();
      }
    }
  }

  function hexAlpha(hex, alpha) {
    if (!hex || hex[0] !== '#') return `rgba(200,180,130,${alpha})`;
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ---------------------------- actors ---------------------------- */
  function drawActors() {
    const actors = [];
    for (const e of game.enemies) if (!e.dead) actors.push({ type: 'enemy', ref: e, y: e.y });
    const p = game.player;
    if (p) actors.push({ type: 'player', ref: p, y: p.y });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      if (a.type === 'player') drawPlayer();
      else drawEnemy(a.ref);
    }
  }

  function drawShadow(x, y, rx, ry, alpha = 0.4) {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.fill();
  }

  function drawPlayer() {
    const p = game.player;
    if (!p) return;
    const t = game.ambient;
    const walk = p.moving ? Math.sin(p.walkPhase) : Math.sin(t * 1.8) * 0.2;
    const bob = p.moving ? Math.abs(Math.sin(p.walkPhase)) * 1.7 : Math.sin(t * 2) * 0.7;
    ctx.save();
    ctx.translate(p.x, p.y);
    drawShadow(0, 12, 18, 7, 0.52);

    if (p.dashTime > 0) {
      ctx.globalAlpha = 0.25;
      for (let i = 1; i <= 3; i++) {
        ctx.fillStyle = '#6bc7c2';
        ctx.beginPath();
        ctx.ellipse(-p.dashDir.x * i * 12, -p.dashDir.y * i * 12, 8, 14, 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    const flash = p.hitFlash > 0 && Math.sin(t * 50) > 0;
    if (p.invuln > 0 && p.dashTime <= 0) ctx.globalAlpha = 0.72;
    ctx.translate(0, -bob);

    const facingLeft = Math.cos(p.facing) < 0;
    ctx.save();
    ctx.scale(facingLeft ? -1 : 1, 1);
    // cloak
    const cloakSway = Math.sin(t * 2.2 + 0.5) * 2 + (p.moving ? Math.sin(p.walkPhase) * 2 : 0);
    const cloak = ctx.createLinearGradient(-14, -22, 13, 18);
    cloak.addColorStop(0, '#331d24');
    cloak.addColorStop(0.45, '#23191f');
    cloak.addColorStop(1, '#0d0c10');
    ctx.fillStyle = cloak;
    ctx.strokeStyle = 'rgba(175,135,87,.34)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, -9);
    ctx.quadraticCurveTo(-18 + cloakSway, 5, -14 + cloakSway, 18);
    ctx.quadraticCurveTo(-4, 21, 0, 15);
    ctx.quadraticCurveTo(7, 21, 15 + cloakSway, 18);
    ctx.quadraticCurveTo(18 + cloakSway, 4, 10, -9);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // legs
    ctx.strokeStyle = '#1b1718';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, 8); ctx.lineTo(-5 + walk * 4, 17);
    ctx.moveTo(5, 8); ctx.lineTo(5 - walk * 4, 17);
    ctx.stroke();
    ctx.strokeStyle = '#77664b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, 14); ctx.lineTo(-5 + walk * 4, 17);
    ctx.moveTo(5, 14); ctx.lineTo(5 - walk * 4, 17);
    ctx.stroke();

    // torso
    ctx.fillStyle = '#1b1b20';
    ctx.strokeStyle = 'rgba(176,145,94,.4)';
    ctx.beginPath();
    ctx.moveTo(-9, -9);
    ctx.quadraticCurveTo(0, -14, 9, -9);
    ctx.lineTo(7, 8);
    ctx.quadraticCurveTo(0, 12, -7, 8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8f6b38';
    ctx.fillRect(-7, 2, 14, 2);
    ctx.fillStyle = '#b89355';
    ctx.fillRect(-2, 2, 4, 2);

    // hood
    ctx.fillStyle = '#17151a';
    ctx.strokeStyle = 'rgba(192,157,98,.36)';
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.quadraticCurveTo(-10, -27, 0, -29);
    ctx.quadraticCurveTo(10, -27, 10, -10);
    ctx.quadraticCurveTo(4, -5, 0, -4);
    ctx.quadraticCurveTo(-4, -5, -10, -10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#08080a';
    ctx.beginPath(); ctx.ellipse(0, -13.5, 6, 7, 0, 0, TAU); ctx.fill();
    // eyes
    ctx.fillStyle = flash ? '#fff' : '#80dbd2';
    ctx.shadowColor = '#6bc7c2';
    ctx.shadowBlur = 9;
    ctx.beginPath(); ctx.ellipse(-2.4, -14, 1.2, 1.5, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2.5, -14, 1.2, 1.5, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;

    // shoulder plates
    ctx.fillStyle = '#38312c';
    ctx.beginPath(); ctx.ellipse(-8, -7, 4, 3, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(8, -7, 4, 3, 0.4, 0, TAU); ctx.fill();
    ctx.restore();

    // weapon arm, aimed at the current target
    const weaponAngle = p.facing + Math.PI * 0.12;
    ctx.save();
    ctx.rotate(weaponAngle);
    ctx.strokeStyle = '#1a1717';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(15, 0); ctx.stroke();
    ctx.strokeStyle = '#d1c4a4';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(33, 0); ctx.stroke();
    ctx.strokeStyle = 'rgba(244,226,184,.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(16, -0.7); ctx.lineTo(32, -0.7); ctx.stroke();
    ctx.fillStyle = '#9b7b45';
    ctx.fillRect(12, -4, 2, 8);
    ctx.restore();

    // soul wisp
    const orbAngle = t * 1.5;
    const ox = Math.cos(orbAngle) * 20;
    const oy = -20 + Math.sin(orbAngle * 1.2) * 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, 15);
    og.addColorStop(0, 'rgba(132,226,215,.72)');
    og.addColorStop(0.25, 'rgba(107,199,194,.34)');
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(ox, oy, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(177,241,232,.8)';
    ctx.beginPath(); ctx.arc(ox, oy, 2, 0, TAU); ctx.fill();
    ctx.restore();

    if (p.shield > 0) {
      ctx.save();
      const pulse = 1 + Math.sin(t * 3) * 0.025;
      ctx.strokeStyle = 'rgba(198,191,164,.36)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, -4, 27 * pulse, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(198,191,164,.12)';
      ctx.beginPath(); ctx.arc(0, -4, 32 * pulse, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(198,191,164,.035)';
      ctx.beginPath(); ctx.arc(0, -4, 27 * pulse, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    const t = game.ambient;
    const bob = Math.sin(t * 2.3 + e.seed) * (e.flying ? 4 : 1.6);
    ctx.save();
    ctx.translate(e.x, e.y);
    drawShadow(0, 13 + (e.flying ? 10 : 0), e.radius * 0.9, e.radius * 0.34, e.flying ? 0.22 : 0.4);

    if (e.boss) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, e.radius * 2.5);
      g.addColorStop(0, hexAlpha(e.aura || '#d59665', 0.22));
      g.addColorStop(0.6, hexAlpha(e.aura || '#d59665', 0.07));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, e.radius * 2.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = hexAlpha(e.aura || '#d59665', 0.34);
      ctx.setLineDash([2, 10]);
      ctx.beginPath(); ctx.arc(0, 4, e.radius * 1.75 + Math.sin(t * 2) * 3, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    } else if (e.elite) {
      ctx.strokeStyle = 'rgba(226,176,100,.32)';
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.arc(0, 4, e.radius + 8, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (game.ascended) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const divineAura = ctx.createRadialGradient(0, 4, 2, 0, 4, e.radius + 15);
      divineAura.addColorStop(0, 'rgba(255,221,142,.08)');
      divineAura.addColorStop(1, 'rgba(255,221,142,0)');
      ctx.fillStyle = divineAura;
      ctx.beginPath(); ctx.arc(0, 4, e.radius + 15, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,222,147,.13)';
      ctx.beginPath(); ctx.arc(0, 4, e.radius + 10, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    if (e.slowUntil > game.time) {
      ctx.strokeStyle = 'rgba(131,199,238,.3)';
      ctx.beginPath(); ctx.arc(0, 6, e.radius + 4, 0, TAU); ctx.stroke();
    }

    ctx.translate(0, -bob);
    ctx.save();
    const flip = Math.cos(e.facing) < 0 ? -1 : 1;
    ctx.scale(flip, 1);
    switch (e.typeId) {
      case 'bat': drawBat(e); break;
      case 'spider': drawSpider(e); break;
      case 'acolyte': drawAcolyte(e); break;
      case 'wraith': drawWraith(e); break;
      case 'golem': drawGolem(e); break;
      default: drawSkeleton(e);
    }
    if (e.boss) drawBossCrown(e);
    if (e.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.75, e.hitFlash * 6);
      ctx.fillStyle = '#fff5db';
      ctx.beginPath(); ctx.arc(0, -2, e.radius * 0.7, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (e.hp < e.maxHp || e.boss || e.elite) {
      const w = e.boss ? 64 : e.elite ? 44 : 30;
      const yy = -e.radius * (e.boss ? 1.9 : 1.7) - 8;
      ctx.fillStyle = 'rgba(0,0,0,.58)';
      ctx.fillRect(-w / 2, yy, w, e.boss ? 3 : 2.4);
      ctx.fillStyle = e.boss ? '#d0614d' : e.elite ? '#d8a45f' : '#a65a52';
      ctx.fillRect(-w / 2, yy, w * clamp(e.hp / e.maxHp, 0, 1), e.boss ? 3 : 2.4);
      if (e.elite && !e.boss) {
        ctx.fillStyle = '#d5b070';
        ctx.font = '7px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('精英', 0, yy - 5);
      }
    }
    ctx.restore();
  }

  function drawSkeleton(e) {
    const r = e.radius;
    const s = r / 16;
    const t = game.ambient;
    const step = Math.sin(t * 6 + e.seed) * 2.2;
    const bone = e.hitFlash > 0 ? '#fff2d5' : (e.boss ? '#e1c68d' : e.elite ? '#d4c39b' : '#b2ad99');
    ctx.strokeStyle = bone;
    ctx.fillStyle = bone;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.4 * s;
    // legs
    ctx.beginPath(); ctx.moveTo(-3 * s, 5 * s); ctx.lineTo(-5 * s, 15 * s + step); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3 * s, 5 * s); ctx.lineTo(5 * s, 15 * s - step); ctx.stroke();
    // ribs / spine
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath(); ctx.moveTo(0, -4 * s); ctx.lineTo(0, 8 * s); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, (-2 + i * 3) * s, (7 - i * 0.7) * s, 0.12 * Math.PI, 0.88 * Math.PI);
      ctx.stroke();
    }
    // arms
    ctx.lineWidth = 2.1 * s;
    ctx.beginPath(); ctx.moveTo(-5 * s, -2 * s); ctx.lineTo(-11 * s, 4 * s + step); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5 * s, -2 * s); ctx.lineTo(11 * s, 1 * s); ctx.stroke();
    // skull
    ctx.beginPath(); ctx.arc(0, -11 * s, 7.2 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#151618';
    ctx.beginPath(); ctx.ellipse(-2.6 * s, -12 * s, 1.7 * s, 2.1 * s, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2.6 * s, -12 * s, 1.7 * s, 2.1 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = e.boss ? '#ffb35e' : '#d97854';
    ctx.shadowColor = e.boss ? '#f08a4a' : '#d87652';
    ctx.shadowBlur = 7;
    ctx.beginPath(); ctx.arc(-2.6 * s, -12 * s, 0.8 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(2.6 * s, -12 * s, 0.8 * s, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // jaw
    ctx.strokeStyle = bone;
    ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(-3 * s, -6.5 * s); ctx.lineTo(3 * s, -6.5 * s); ctx.stroke();
    // sword
    ctx.save();
    ctx.translate(11 * s, 1 * s);
    ctx.rotate(-0.25 + Math.sin(t * 2 + e.seed) * 0.04);
    ctx.strokeStyle = e.hitFlash > 0 ? '#fff' : '#8d8779';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(0, 3 * s); ctx.lineTo(0, -20 * s); ctx.stroke();
    ctx.strokeStyle = '#bcc0b7';
    ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(0, -19 * s); ctx.lineTo(0, 9 * s); ctx.stroke();
    ctx.strokeStyle = '#8e6e3f';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(-5 * s, 3 * s); ctx.lineTo(5 * s, 3 * s); ctx.stroke();
    ctx.restore();
  }

  function drawBat(e) {
    const r = e.radius;
    const s = r / 12;
    const t = game.ambient;
    const flap = Math.sin(t * 12 + e.seed);
    ctx.fillStyle = e.hitFlash > 0 ? '#ffe5d1' : '#493135';
    ctx.strokeStyle = '#765057';
    ctx.lineWidth = 1;
    // wings
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -2 * s);
      ctx.quadraticCurveTo(dir * 18 * s, (-10 - flap * 7) * s, dir * 30 * s, (-1 + flap * 4) * s);
      ctx.quadraticCurveTo(dir * 20 * s, (3 + flap * 2) * s, dir * 12 * s, 3 * s);
      ctx.quadraticCurveTo(dir * 7 * s, 1 * s, 0, 4 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // body
    ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#37272b';
    ctx.beginPath(); ctx.ellipse(0, 1 * s, 7 * s, 9 * s, 0, 0, TAU); ctx.fill();
    // ears
    ctx.beginPath(); ctx.moveTo(-4 * s, -6 * s); ctx.lineTo(-6 * s, -13 * s); ctx.lineTo(-1 * s, -8 * s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(4 * s, -6 * s); ctx.lineTo(6 * s, -13 * s); ctx.lineTo(1 * s, -8 * s); ctx.fill();
    ctx.fillStyle = '#d45e5d';
    ctx.shadowColor = '#e15d5d'; ctx.shadowBlur = 5;
    ctx.beginPath(); ctx.arc(-2.6 * s, -2 * s, 1.1 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(2.6 * s, -2 * s, 1.1 * s, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawSpider(e) {
    const r = e.radius;
    const s = r / 15;
    const t = game.ambient;
    ctx.strokeStyle = e.hitFlash > 0 ? '#f8f2df' : '#515d4c';
    ctx.lineWidth = 1.6 * s;
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const idx = i % 4;
      const baseA = (idx - 1.5) * 0.42;
      const swing = Math.sin(t * 7 + i * 0.8 + e.seed) * 0.13;
      const a = baseA + swing;
      const len = (16 + (idx % 2) * 5) * s;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * len * 0.55, (Math.sin(a) * len * 0.5) - 7 * s, side * len, Math.sin(a) * len + 5 * s);
      ctx.stroke();
    }
    ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#414d3e';
    ctx.beginPath(); ctx.ellipse(0, 4 * s, 10 * s, 12 * s, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(151,166,126,.35)';
    ctx.beginPath(); ctx.ellipse(0, 4 * s, 6 * s, 8 * s, 0, 0, TAU); ctx.stroke();
    ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#2a3028';
    ctx.beginPath(); ctx.ellipse(0, -5 * s, 7 * s, 6 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d5ca78';
    ctx.shadowColor = '#d8c56e'; ctx.shadowBlur = 5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc((-3.4 + i * 2.2) * s, -7 * s, 0.8 * s, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawAcolyte(e) {
    const r = e.radius;
    const s = r / 16;
    const t = game.ambient;
    // robe
    const g = ctx.createLinearGradient(0, -10 * s, 0, 17 * s);
    g.addColorStop(0, e.hitFlash > 0 ? '#f1d9ef' : '#3d2d46');
    g.addColorStop(1, '#15131d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-4 * s, -8 * s);
    ctx.quadraticCurveTo(-12 * s, 5 * s, -14 * s, 17 * s);
    ctx.quadraticCurveTo(0, 21 * s, 14 * s, 17 * s);
    ctx.quadraticCurveTo(12 * s, 5 * s, 4 * s, -8 * s);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(179,129,194,.3)';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath(); ctx.moveTo(-10 * s, 12 * s); ctx.quadraticCurveTo(0, 16 * s, 10 * s, 12 * s); ctx.stroke();
    // hood
    ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#241b2d';
    ctx.beginPath(); ctx.arc(0, -12 * s, 7.5 * s, 0, TAU); ctx.fill();
    ctx.fillStyle = '#08070b';
    ctx.beginPath(); ctx.ellipse(0, -11 * s, 5 * s, 5.5 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#d58fdf';
    ctx.shadowColor = '#d58fdf'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(-2 * s, -12 * s, 0.9 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(2 * s, -12 * s, 0.9 * s, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // staff
    ctx.strokeStyle = '#675b4e';
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath(); ctx.moveTo(10 * s, 14 * s); ctx.lineTo(10 * s, -14 * s); ctx.stroke();
    const orbY = -15 * s + Math.sin(t * 3 + e.seed) * 1.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const og = ctx.createRadialGradient(10 * s, orbY, 0, 10 * s, orbY, 11 * s);
    og.addColorStop(0, 'rgba(227,151,231,.7)');
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(10 * s, orbY, 11 * s, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#e5a5e9';
    ctx.beginPath(); ctx.arc(10 * s, orbY, 2.2 * s, 0, TAU); ctx.fill();
  }

  function drawWraith(e) {
    const r = e.radius;
    const s = r / 15;
    const t = game.ambient;
    ctx.save();
    ctx.globalAlpha = 0.86;
    const g = ctx.createLinearGradient(0, -20 * s, 0, 22 * s);
    g.addColorStop(0, e.hitFlash > 0 ? '#f0efff' : '#4b5075');
    g.addColorStop(0.55, 'rgba(51,54,88,.9)');
    g.addColorStop(1, 'rgba(12,13,22,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-10 * s, 2 * s);
    ctx.quadraticCurveTo(-8 * s, -12 * s, 0, -16 * s);
    ctx.quadraticCurveTo(8 * s, -12 * s, 10 * s, 2 * s);
    ctx.quadraticCurveTo(8 * s, 12 * s, 4 * s + Math.sin(t * 2 + e.seed) * 3 * s, 24 * s);
    ctx.quadraticCurveTo(0, 17 * s, -4 * s - Math.sin(t * 2 + e.seed) * 3 * s, 24 * s);
    ctx.quadraticCurveTo(-8 * s, 12 * s, -10 * s, 2 * s);
    ctx.closePath();
    ctx.fill();
    // arms
    ctx.strokeStyle = 'rgba(132,140,190,.38)';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(-8 * s, -1 * s);
    ctx.quadraticCurveTo(-16 * s, 4 * s, -18 * s, 12 * s + Math.sin(t * 2) * 2);
    ctx.moveTo(8 * s, -1 * s);
    ctx.quadraticCurveTo(16 * s, 4 * s, 18 * s, 12 * s - Math.sin(t * 2) * 2);
    ctx.stroke();
    // hood face
    ctx.fillStyle = '#0a0b12';
    ctx.beginPath(); ctx.ellipse(0, -10 * s, 6 * s, 7.5 * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#a8b4ff';
    ctx.shadowColor = '#8d9bff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.ellipse(-2.4 * s, -11 * s, 1.1 * s, 1.6 * s, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(2.4 * s, -11 * s, 1.1 * s, 1.6 * s, 0, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawGolem(e) {
    const r = e.radius;
    const s = r / 23;
    const t = game.ambient;
    ctx.fillStyle = e.hitFlash > 0 ? '#f5f0e4' : '#50585b';
    ctx.strokeStyle = 'rgba(153,162,157,.3)';
    ctx.lineWidth = 1.2;
    // legs
    ctx.fillRect(-13 * s, 7 * s, 9 * s, 16 * s);
    ctx.fillRect(5 * s, 7 * s, 9 * s, 16 * s);
    // torso
    ctx.beginPath();
    ctx.moveTo(-14 * s, -9 * s);
    ctx.lineTo(-7 * s, -15 * s);
    ctx.lineTo(8 * s, -13 * s);
    ctx.lineTo(15 * s, -4 * s);
    ctx.lineTo(11 * s, 9 * s);
    ctx.lineTo(-9 * s, 10 * s);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // arms
    ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#434a4d';
    ctx.beginPath(); ctx.ellipse(-18 * s, 1 * s, 6 * s, 12 * s, 0.25 + Math.sin(t * 2 + e.seed) * 0.05, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(18 * s, 1 * s, 6 * s, 12 * s, -0.25 - Math.sin(t * 2 + e.seed) * 0.05, 0, TAU); ctx.fill();
    // head
    ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#5b6365';
    ctx.beginPath();
    ctx.moveTo(-7 * s, -14 * s); ctx.lineTo(-4 * s, -25 * s); ctx.lineTo(6 * s, -26 * s); ctx.lineTo(10 * s, -16 * s); ctx.lineTo(3 * s, -10 * s); ctx.closePath(); ctx.fill();
    // cracks + eye
    ctx.strokeStyle = 'rgba(20,24,25,.65)';
    ctx.beginPath(); ctx.moveTo(-3 * s, -12 * s); ctx.lineTo(-7 * s, -1 * s); ctx.lineTo(-2 * s, 7 * s); ctx.stroke();
    ctx.fillStyle = '#e3a45f';
    ctx.shadowColor = '#e3a45f'; ctx.shadowBlur = 8;
    ctx.fillRect(-3 * s, -21 * s, 5 * s, 1.8 * s);
    ctx.shadowBlur = 0;
    // moss
    ctx.fillStyle = 'rgba(87,116,80,.2)';
    ctx.beginPath(); ctx.ellipse(-10 * s, 5 * s, 7 * s, 4 * s, 0.4, 0, TAU); ctx.fill();
  }

  function drawBossCrown(e) {
    const r = e.radius;
    const s = r / 16;
    ctx.save();
    ctx.translate(0, -r * 1.55 - 8);
    ctx.fillStyle = e.aura || '#e8be75';
    ctx.shadowColor = e.aura || '#e8be75';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-10, 4);
    ctx.lineTo(-11, -8);
    ctx.lineTo(-5, -2);
    ctx.lineTo(0, -11);
    ctx.lineTo(5, -2);
    ctx.lineTo(11, -8);
    ctx.lineTo(10, 4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#15100d';
    ctx.beginPath(); ctx.arc(0, -1, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ---------------------------- projectiles, effects ---------------------------- */
  function drawProjectiles() {
    for (const p of game.projectiles) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (p.trail.length > 1) {
        ctx.strokeStyle = hexAlpha(p.color, 0.22);
        ctx.lineWidth = p.radius * 1.2;
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3.8);
      g.addColorStop(0, hexAlpha(p.color, 0.8));
      g.addColorStop(0.3, hexAlpha(p.color, 0.34));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 3.8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff5dc';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 0.55, 0, TAU); ctx.fill();
      ctx.restore();
    }
    for (const p of game.enemyProjectiles) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
      g.addColorStop(0, hexAlpha(p.color, 0.8));
      g.addColorStop(0.4, hexAlpha(p.color, 0.3));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffdfce';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 0.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  function drawEffects() {
    const t = game.ambient;
    for (const e of game.effects) {
      if (e.kind === 'ring') {
        const progress = 1 - e.life / e.maxLife;
        const radius = lerp(e.r0, e.r1, 1 - Math.pow(1 - progress, 2));
        ctx.save();
        ctx.globalAlpha = clamp(e.life / e.maxLife, 0, 1) * 0.9;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = e.width;
        ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, TAU); ctx.stroke();
        ctx.globalAlpha *= 0.2;
        ctx.lineWidth = e.width * 4;
        ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, TAU); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'explosion') {
        const prog = 1 - e.life / e.maxLife;
        const alpha = clamp(1 - prog, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const r = e.radius * (0.75 + prog * 0.45);
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
        g.addColorStop(0, hexAlpha(e.color, 0.4 * alpha));
        g.addColorStop(0.35, hexAlpha(e.color, 0.16 * alpha));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = hexAlpha(e.color, 0.55 * alpha);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.82, 0, TAU); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'telegraph') {
        const prog = 1 - Math.max(0, e.delay) / e.maxDelay;
        ctx.save();
        ctx.fillStyle = hexAlpha(e.color, 0.055 + prog * 0.07);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, TAU); ctx.fill();
        ctx.strokeStyle = hexAlpha(e.color, 0.45);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = hexAlpha(e.color, 0.7);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.92, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(prog, 0, 1));
        ctx.stroke();
        ctx.fillStyle = hexAlpha(e.color, 0.25);
        ctx.font = '12px "Songti SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('危', e.x, e.y + 4);
        ctx.restore();
      } else if (e.kind === 'beam') {
        const alpha = clamp(e.life / e.maxLife, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hexAlpha(e.color, 0.22 * alpha);
        ctx.lineWidth = e.width * 1.7;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        ctx.strokeStyle = hexAlpha(e.color, 0.75 * alpha);
        ctx.lineWidth = e.width * 0.45;
        ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        ctx.strokeStyle = `rgba(255,248,227,${0.82 * alpha})`;
        ctx.lineWidth = Math.max(1.2, e.width * 0.12);
        ctx.beginPath(); ctx.moveTo(e.x1, e.y1); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'chain') {
        const alpha = clamp(e.life / e.maxLife, 0, 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = hexAlpha(e.color, 0.22 * alpha);
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(e.points[0].x, e.points[0].y);
        for (let i = 1; i < e.points.length; i++) {
          const p0 = e.points[i - 1];
          const p1 = e.points[i];
          const mx = (p0.x + p1.x) / 2 + rand(-9, 9);
          const my = (p0.y + p1.y) / 2 + rand(-9, 9);
          ctx.lineTo(mx, my);
          ctx.lineTo(p1.x, p1.y);
        }
        ctx.stroke();
        ctx.strokeStyle = hexAlpha(e.color, 0.8 * alpha);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,240,${0.9 * alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'slash') {
        const alpha = clamp(e.life / e.maxLife, 0, 1);
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        ctx.strokeStyle = hexAlpha(e.color, alpha * 0.7);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, -0.8, 0.8);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,245,220,${alpha * 0.4})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, e.radius - 3, -0.72, 0.72); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'orbit') {
        const p = game.player;
        if (!p) continue;
        const alpha = clamp(e.life / e.maxLife, 0.2, 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < e.count; i++) {
          const a = e.angle + (i / e.count) * TAU;
          const ox = Math.cos(a) * e.radius;
          const oy = Math.sin(a) * e.radius * 0.72;
          ctx.save();
          ctx.translate(ox, oy);
          ctx.rotate(a + Math.PI / 2);
          ctx.strokeStyle = hexAlpha(e.color, 0.65 * alpha);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -11 * (e.skill.count || 2));
          ctx.lineTo(0, 11 * (e.skill.count || 2));
          ctx.stroke();
          ctx.strokeStyle = hexAlpha(e.color, 0.18 * alpha);
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(0, -11);
          ctx.lineTo(0, 11);
          ctx.stroke();
          ctx.restore();
        }
        ctx.strokeStyle = hexAlpha(e.color, 0.08 * alpha);
        ctx.setLineDash([2, 9]);
        ctx.beginPath(); ctx.ellipse(0, 0, e.radius, e.radius * 0.72, 0, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  function drawParticles() {
    for (const p of game.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1) * p.alpha;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.shape === 'spark') {
        ctx.fillRect(p.x, p.y, p.size * 1.2, p.size * 1.2);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, p.size * alpha), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawDamageTexts() {
    ctx.save();
    ctx.textAlign = 'center';
    for (const d of game.damageTexts) {
      const alpha = clamp(d.life / d.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = d.crit
        ? 'bold 19px "Avenir Next", "PingFang SC", sans-serif'
        : d.incoming ? 'bold 14px "Avenir Next", "PingFang SC", sans-serif'
          : '12px "Avenir Next", "PingFang SC", sans-serif';
      ctx.fillStyle = d.color;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.lineWidth = 3;
      ctx.strokeText(d.text, d.x, d.y);
      ctx.fillText(d.text, d.x, d.y);
      if (d.crit) {
        ctx.font = '7px "Cascadia Mono", monospace';
        ctx.fillStyle = 'rgba(255,217,139,.85)';
        ctx.fillText('CRITICAL', d.x, d.y - 12);
      }
    }
    ctx.restore();
  }

  /* ---------------------------- lighting ---------------------------- */
  function drawLighting(zoom, camX, camY) {
    const lc = lightCtx;
    lc.setTransform(dpr, 0, 0, dpr, 0, 0);
    lc.clearRect(0, 0, viewW, viewH);
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = game.ascended ? 'rgba(12,9,4,0.24)' : 'rgba(2,4,7,0.33)';
    lc.fillRect(0, 0, viewW, viewH);

    const toScreen = (wx, wy) => ({
      x: (wx - camX) * zoom + viewW / 2,
      y: (wy - camY) * zoom + viewH / 2
    });

    lc.globalCompositeOperation = 'destination-out';
    for (const light of frameLights) {
      const p = toScreen(light.x, light.y);
      const flicker = 1 + Math.sin(game.ambient * 2.2 + (light.flicker || 0)) * 0.055 + Math.sin(game.ambient * 7.1 + light.x) * 0.018;
      const radius = light.radius * zoom * flicker;
      if (p.x < -radius || p.x > viewW + radius || p.y < -radius || p.y > viewH + radius) continue;
      const g = lc.createRadialGradient(p.x, p.y, radius * 0.05, p.x, p.y, radius);
      g.addColorStop(0, `rgba(0,0,0,${0.9 * (light.base || 0.2) + 0.12})`);
      g.addColorStop(0.45, `rgba(0,0,0,${(light.base || 0.2) * 0.68})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.beginPath(); lc.arc(p.x, p.y, radius, 0, TAU); lc.fill();
    }

    // Player's immediate visibility
    const pp = toScreen(game.player.x, game.player.y);
    const playerRadius = 272 * zoom;
    let pg = lc.createRadialGradient(pp.x, pp.y - 8 * zoom, 0, pp.x, pp.y - 8 * zoom, playerRadius);
    pg.addColorStop(0, 'rgba(0,0,0,.5)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = pg;
    lc.beginPath(); lc.arc(pp.x, pp.y - 8 * zoom, playerRadius, 0, TAU); lc.fill();

    lc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(lightCanvas, 0, 0, viewW, viewH);

    // Colored light bloom
    ctx.globalCompositeOperation = 'screen';
    for (const light of frameLights) {
      const p = toScreen(light.x, light.y);
      const flicker = 1 + Math.sin(game.ambient * 3.1 + (light.flicker || 0)) * 0.1;
      const radius = light.radius * zoom * 0.9 * flicker;
      if (p.x < -radius || p.x > viewW + radius || p.y < -radius || p.y > viewH + radius) continue;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      g.addColorStop(0, light.color + `${0.09 * (light.base || 0.2) * 5})`);
      g.addColorStop(0.35, light.color + `${0.035 * (light.base || 0.2) * 5})`);
      g.addColorStop(1, light.color + '0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const playerGlow = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, 190 * zoom);
    playerGlow.addColorStop(0, game.ascended ? 'rgba(239,200,119,.10)' : 'rgba(86,170,163,.075)');
    playerGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = playerGlow;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 190 * zoom, 0, TAU); ctx.fill();

    if (game.ascended) {
      const divineVeil = ctx.createLinearGradient(0, 0, 0, viewH);
      divineVeil.addColorStop(0, 'rgba(227,188,107,.045)');
      divineVeil.addColorStop(0.55, 'rgba(227,188,107,.015)');
      divineVeil.addColorStop(1, 'rgba(95,68,29,.06)');
      ctx.fillStyle = divineVeil;
      ctx.fillRect(0, 0, viewW, viewH);
    }
    ctx.restore();
  }

  function drawDust() {
    ctx.save();
    for (const d of game.dust) {
      ctx.globalAlpha = d.alpha * (0.7 + Math.sin(game.ambient * 1.2 + d.phase) * 0.3);
      ctx.fillStyle = game.ascended ? '#f3d99a' : '#c7b88f';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEdgeVignette() {
    ctx.save();
    const g = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.2, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.66, 'rgba(0,0,0,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.restore();
  }

  /* ---------------------------- minimap ---------------------------- */
  function drawMinimap() {
    const p = game.player;
    if (!p) return;
    const size = minimap.width;
    const cx = size / 2;
    const cy = size / 2;
    const scale = 0.062;
    mctx.clearRect(0, 0, size, size);
    const bg = mctx.createRadialGradient(cx, cy, 4, cx, cy, cx);
    bg.addColorStop(0, 'rgba(17,24,26,.94)');
    bg.addColorStop(1, 'rgba(5,8,10,.98)');
    mctx.fillStyle = bg;
    mctx.beginPath(); mctx.arc(cx, cy, cx, 0, TAU); mctx.fill();

    mctx.save();
    mctx.beginPath(); mctx.arc(cx, cy, cx - 2, 0, TAU); mctx.clip();
    mctx.strokeStyle = 'rgba(198,174,124,.07)';
    mctx.lineWidth = 1;
    for (let r = 34; r < cx; r += 34) {
      mctx.beginPath(); mctx.arc(cx, cy, r, 0, TAU); mctx.stroke();
    }
    mctx.beginPath(); mctx.moveTo(cx, 8); mctx.lineTo(cx, size - 8); mctx.stroke();
    mctx.beginPath(); mctx.moveTo(8, cy); mctx.lineTo(size - 8, cy); mctx.stroke();

    // origin marker
    const ox = cx + (0 - p.x) * scale;
    const oy = cy + (0 - p.y) * scale;
    if (ox > 8 && ox < size - 8 && oy > 8 && oy < size - 8) {
      mctx.strokeStyle = 'rgba(110,202,192,.5)';
      mctx.lineWidth = 1;
      mctx.beginPath(); mctx.arc(ox, oy, 5, 0, TAU); mctx.stroke();
      mctx.fillStyle = 'rgba(110,202,192,.28)';
      mctx.beginPath(); mctx.arc(ox, oy, 2, 0, TAU); mctx.fill();
    } else {
      const a = Math.atan2(0 - p.y, 0 - p.x);
      const ex = cx + Math.cos(a) * (cx - 12);
      const ey = cy + Math.sin(a) * (cx - 12);
      mctx.fillStyle = 'rgba(110,202,192,.55)';
      mctx.beginPath();
      mctx.moveTo(ex + Math.cos(a) * 5, ey + Math.sin(a) * 5);
      mctx.lineTo(ex + Math.cos(a + 2.4) * 5, ey + Math.sin(a + 2.4) * 5);
      mctx.lineTo(ex + Math.cos(a - 2.4) * 5, ey + Math.sin(a - 2.4) * 5);
      mctx.closePath(); mctx.fill();
    }

    for (const loot of game.loot) {
      const x = cx + (loot.x - p.x) * scale;
      const y = cy + (loot.y - p.y) * scale;
      if (loot.type === 'gold' || x < 6 || x > size - 6 || y < 6 || y > size - 6) continue;
      mctx.fillStyle = loot.type === 'orb'
        ? (TALENT_GRADES[loot.data.grade]?.color || '#cc8de9')
        : loot.type === 'classBook'
          ? (CLASS_BOOK_RANK_BY_KEY[loot.data.book?.rank]?.color || '#c5a66b')
          : loot.type === 'skill' ? '#78b3e6' : loot.type === 'health' ? '#d36a6b' : (RARITIES[loot.data.item?.rarity]?.color || '#c5b183');
      mctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    for (const e of game.enemies) {
      if (e.dead) continue;
      const x = cx + (e.x - p.x) * scale;
      const y = cy + (e.y - p.y) * scale;
      if (x < 6 || x > size - 6 || y < 6 || y > size - 6) continue;
      if (e.boss) {
        mctx.fillStyle = '#dc6853';
        mctx.beginPath(); mctx.arc(x, y, 5, 0, TAU); mctx.fill();
        mctx.strokeStyle = 'rgba(255,187,125,.65)';
        mctx.beginPath(); mctx.arc(x, y, 8, 0, TAU); mctx.stroke();
      } else {
        mctx.fillStyle = e.elite ? '#dba966' : 'rgba(176,88,78,.65)';
        mctx.beginPath(); mctx.arc(x, y, e.elite ? 2.3 : 1.5, 0, TAU); mctx.fill();
      }
    }
    // player arrow
    mctx.save();
    mctx.translate(cx, cy);
    mctx.rotate(p.facing + Math.PI / 2);
    mctx.fillStyle = '#e8d8ad';
    mctx.shadowColor = '#e8d8ad'; mctx.shadowBlur = 6;
    mctx.beginPath();
    mctx.moveTo(0, -7);
    mctx.lineTo(4.5, 5);
    mctx.lineTo(0, 2.5);
    mctx.lineTo(-4.5, 5);
    mctx.closePath(); mctx.fill();
    mctx.restore();
    mctx.restore();

    mctx.strokeStyle = 'rgba(199,174,122,.25)';
    mctx.lineWidth = 1;
    mctx.beginPath(); mctx.arc(cx, cy, cx - 1.5, 0, TAU); mctx.stroke();
  }

  /* ============================================================
     HUD
     ============================================================ */
  function renderSkillBar() {
    const p = game.player;
    if (!p) return;
    const bar = $('skillBar');
    let html = '';
    for (let i = 0; i < p.slots; i++) {
      const skill = p.equipped[i];
      if (!skill) {
        html += `
          <button class="skill-slot empty" data-skill-slot="${i}" data-empty-slot="1" title="空技能槽 · 点击打开技能面板">
            <span class="skill-key">${i + 1}</span>
            <span class="skill-glyph">＋</span>
          </button>`;
        continue;
      }
      const r = RARITIES[skill.rarity] || RARITIES.common;
      html += `
        <button class="skill-slot" data-skill-slot="${i}" title="${skill.name} · ${r.label} Lv.${skill.level}｜${skill.desc}｜冷却 ${skillCd(skill).toFixed(1)} 秒"
          style="--slot-color:${r.color};--slot-glow:${r.soft}">
          <span class="skill-key">${i + 1}</span>
          <span class="skill-glyph">${skill.icon}</span>
          <span class="skill-auto">AUTO</span>
          <span class="skill-cd-mask"></span>
          <span class="skill-cd-text"></span>
        </button>`;
    }
    bar.innerHTML = html;
    updateSkillCooldownUI();
    $('slotCountText').textContent = `${p.slots} / ${p.slots} 槽位 · 上限 ${MAX_SKILL_SLOTS}`;
  }

  function updateSpeedSelector() {
    document.querySelectorAll('.speed-btn').forEach(btn => {
      const selected = Number(btn.dataset.speed) === game.speed;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function setGameSpeed(speed, persist = true) {
    game.speed = clamp(Math.round(Number(speed) || 1), 1, 4);
    updateSpeedSelector();
    if (persist) saveGame();
    return game.speed;
  }

  function updateSkillCooldownUI() {
    const p = game.player;
    if (!p) return;
    const slots = document.querySelectorAll('#skillBar [data-skill-slot]');
    for (const el of slots) {
      const i = Number(el.dataset.skillSlot);
      const skill = p.equipped[i];
      if (!skill) continue;
      const cd = p.skillCooldowns[i] || 0;
      const total = skillCd(skill);
      if (cd > 0.04) {
        el.classList.add('cooling');
        el.classList.remove('ready');
        el.style.setProperty('--cd-deg', `${clamp(cd / total, 0, 1) * 360}deg`);
        const txt = el.querySelector('.skill-cd-text');
        if (txt) txt.textContent = cd >= 1 ? Math.ceil(cd) : cd.toFixed(1);
      } else {
        el.classList.remove('cooling');
        el.classList.add('ready');
        el.style.setProperty('--cd-deg', '0deg');
      }
    }
  }

  function updateHud(force = false) {
    const p = game.player;
    if (!p) return;
    const s = p.stats;
    $('hpFill').style.width = `${clamp((p.hp / s.maxHp) * 100, 0, 100)}%`;
    $('hpText').textContent = `${fmt(Math.max(0, Math.ceil(p.hp)))} / ${fmt(s.maxHp)}${p.shield > 0 ? `  +${fmt(p.shield)} 盾` : ''}`;
    $('xpFill').style.width = `${clamp((p.xp / p.xpNext) * 100, 0, 100)}%`;
    $('xpText').textContent = `${fmt(p.xp)} / ${fmt(p.xpNext)}`;
    $('levelText').textContent = p.level;
    const classChip = $('classChip');
    if (classChip) {
      const cls = p.currentClass ? CLASS_BY_ID[p.currentClass] : null;
      classChip.textContent = cls ? cls.name : '无职';
      classChip.style.opacity = cls ? '1' : '0.45';
    }
    $('goldText').textContent = fmt(p.gold);
    $('killText').textContent = fmt(p.kills);
    $('distanceText').textContent = `距原点 ${fmt(Math.hypot(p.x, p.y) / 10)} m`;
    $('clockText').textContent = fmtTime(p.playTime);
    const zoneLv = getZoneLevelAt(Math.hypot(p.x, p.y));
    const relativeZoneLv = game.ascended ? Math.max(1, zoneLv - DIVINE_ENEMY_LEVEL_BONUS) : zoneLv;
    $('zoneName').textContent = zoneNameFor(zoneLv);
    $('threatText').textContent = game.ascended ? `神域 Lv.${relativeZoneLv}` : `威胁 Lv.${zoneLv}`;
    $('dangerBadge').textContent = game.ascended ? `神域 ${romanFor(relativeZoneLv)}` : `威胁 ${romanFor(zoneLv)}`;
    $('slotCountText').textContent = `${p.slots} / ${MAX_SKILL_SLOTS} 槽位`;

    const careerReady = (p.classBooks || []).length > 0 || (p.level >= ASCENSION_LEVEL && !game.ascended);
    $('careerDockBtn')?.classList.toggle('has-update', careerReady);
    $('hud').classList.toggle('divine-realm', game.ascended);

    if (game.ascensionNoticePending && game.state === 'playing' && !game.ascended) {
      game.ascensionNoticePending = false;
      showToast({
        title: '飞升系统已开启',
        tag: `Lv.${ASCENSION_LEVEL} · 神域`,
        desc: '按 J 打开职业面板，叩响天门。飞升后将进入神域并获得一件传说神装。',
        color: '#ffe2a3',
        orb: true,
        duration: 7000
      });
    }
    const dash = $('dashState');
    if (p.dashCooldown > 0) {
      dash.classList.add('cooling');
      dash.classList.remove('ready');
      dash.innerHTML = `<kbd>SPACE</kbd> 闪避 ${p.dashCooldown.toFixed(1)}s`;
    } else {
      dash.classList.remove('cooling');
      dash.classList.add('ready');
      dash.innerHTML = `<kbd>SPACE</kbd> 闪避就绪`;
    }

    if (game.boss && !game.boss.dead) {
      $('bossFill').style.width = `${clamp((game.boss.hp / game.boss.maxHp) * 100, 0, 100)}%`;
      $('bossName').textContent = game.boss.name;
      $('bossLevel').textContent = `Lv.${game.boss.level} · 领主`;
      $('bossWrap').classList.add('visible');
    } else if (!game.boss) {
      $('bossWrap').classList.remove('visible');
    }

    if (game.combo >= 3 && game.comboTimer > 0) {
      $('comboCounter').classList.add('show');
      $('comboCounter').querySelector('b').textContent = game.combo;
    } else {
      $('comboCounter').classList.remove('show');
    }

    if (!$('modalLayer').classList.contains('hidden')) {
      $('modalGold').textContent = fmt(p.gold);
    }
    updateSkillCooldownUI();
  }

  function flashSave() {
    const el = $('saveFlash');
    el.classList.add('show');
    clearTimeout(flashSave._t);
    flashSave._t = setTimeout(() => el.classList.remove('show'), 1200);
  }

  /* ============================================================
     Panels
     ============================================================ */
  const PANEL_META = {
    character: { title: '行者档案', eyebrow: 'THE WANDERER', sub: '深渊不会记得你的名字，但会记得你留下的伤口。' },
    skills: { title: '战技书', eyebrow: 'ARCANE SEQUENCE', sub: '所有战技自动释放、自动瞄准。选择槽位，再装配技能书。' },
    talents: { title: '命运铭文', eyebrow: 'MARK OF FATE', sub: '天赋没有上限。每一次叠加，都是向深渊借来的一点力量。' },
    career: { title: '职业与飞升', eyebrow: 'PATH OF ASCENSION', sub: '转职书通往异世职业；当凡躯抵达极限，神域会打开大门。' },
    inventory: { title: '行囊与装备', eyebrow: 'THE SATCHEL', sub: '更强装备会自动替换，换下的旧物会安静地躺在这里。' },
    shop: { title: '黑市 · 无光商栈', eyebrow: 'THE BLACK MARKET', sub: '“金币在活人手里是钱，在死人手里是路费。”' },
    help: { title: '玩法与掉落', eyebrow: 'FIELD NOTES', sub: '写给第一次坠入深渊的人。' }
  };

  function openPanel(name) {
    if (!game.player || game.state !== 'playing') return;
    game.activePanel = name;
    game.classChoice = null;
    game.state = 'panel';
    $('modalLayer').classList.remove('hidden');
    renderPanel();
    audio.play('click');
  }

  function openHelp(fromState) {
    game.modalReturnState = game.state;
    game.activePanel = 'help';
    if (game.state === 'playing') game.state = 'panel';
    $('modalLayer').classList.remove('hidden');
    renderPanel();
    audio.play('click');
  }

  function closeModal() {
    $('modalLayer').classList.add('hidden');
    if (game.state === 'panel') game.state = 'playing';
    game.activePanel = null;
    game.classChoice = null;
    saveGame();
  }

  function renderPanel() {
    const p = game.player;
    if (!p || !game.activePanel) return;
    const name = game.activePanel;
    const meta = PANEL_META[name] || PANEL_META.character;
    $('modalEyebrow').textContent = meta.eyebrow;
    $('modalTitle').textContent = meta.title;
    $('modalSubtitle').textContent = meta.sub;
    $('modalGold').textContent = fmt(p.gold);
    let html = '';
    let foot = '按 ESC 返回地牢';
    if (name === 'character') html = renderCharacterPanel();
    else if (name === 'skills') { html = renderSkillsPanel(); foot = '点击左侧槽位，再装备右侧技能 · ESC 返回'; }
    else if (name === 'talents') html = renderTalentsPanel();
    else if (name === 'career') { html = renderCareerPanel(); foot = '打开转职书选择职业 · Lv.30 开放飞升 · ESC 返回'; }
    else if (name === 'inventory') html = renderInventoryPanel();
    else if (name === 'shop') html = renderShopPanel();
    else if (name === 'help') { html = renderHelpPanel(); foot = 'WASD 移动 · SPACE 闪避 · ESC 关闭'; }
    $('modalBody').innerHTML = html;
    $('modalFootHint').textContent = foot;
    $('modalGold').textContent = fmt(p.gold);
  }

  function statBox(label, value, suffix = '') {
    return `<div class="stat-box"><span>${label}</span><b>${value}${suffix}</b></div>`;
  }

  function renderCharacterPanel() {
    const p = game.player;
    const s = p.stats;
    const nextTalent = (Math.floor(p.level / 10) + 1) * 10;
    const learned = TALENTS.filter(t => (p.talents[t.id] || 0) > 0).sort((a, b) => TALENT_GRADES[b.grade].rank - TALENT_GRADES[a.grade].rank);
    return `
      <div class="hero-summary panel-card">
        <div class="big-seal">無</div>
        <div>
          <h3>无 名 行 者 <span class="summary-level">LV.${p.level}</span></h3>
          <p>深入 ${fmt(p.deepest / 10)} m · 击杀 ${fmt(p.kills)} · 领主 ${p.bossKills}<br>
          下一次天赋抉择：Lv.${nextTalent} · 已铭刻 ${totalTalentStacks()} 层天赋 · ${learned.length} / ${TALENTS.length} 种<br>
          当前职业：${p.currentClass && CLASS_BY_ID[p.currentClass] ? CLASS_BY_ID[p.currentClass].name : '尚未转职'} · ${game.ascended ? '已飞升 · 神域' : '凡间'}</p>
        </div>
      </div>
      <div class="panel-columns align-start">
        <div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">战斗属性</span><span class="section-note">装备与天赋实时结算</span></div>
            <div class="stat-grid">
              ${statBox('生命上限', fmt(s.maxHp))}
              ${statBox('攻击力', fmt(s.attack))}
              ${statBox('防御', fmt(s.defense))}
              ${statBox('暴击率', (s.crit * 100).toFixed(1), '%')}
              ${statBox('暴击伤害', (s.critDamage * 100).toFixed(0), '%')}
              ${statBox('攻击速度', ((s.attackSpeed) * 100).toFixed(1), '%')}
              ${statBox('技能急速', ((s.haste) * 100).toFixed(1), '%')}
              ${statBox('技能增伤', ((s.skillPower) * 100).toFixed(1), '%')}
              ${statBox('移动速度', s.moveSpeed)}
              ${statBox('伤害减免', ((s.damageReduction) * 100).toFixed(1), '%')}
              ${statBox('击杀回复', ((s.killHeal) * 100).toFixed(1), '%')}
              ${statBox('金币加成', ((s.goldFind) * 100).toFixed(0), '%')}
            </div>
          </div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">特殊属性</span><span class="section-note">S 级以上增幅在此结算</span></div>
            <div class="stat-grid">
              ${statBox('攻击倍率', `×${s.attackMult.toFixed(2)}`)}
              ${statBox('技能倍率', `×${s.skillMult.toFixed(2)}`)}
              ${statBox('闪避率', (s.dodge * 100).toFixed(1), '%')}
              ${statBox('反伤', (s.thorns * 100).toFixed(0), '%')}
              ${statBox('生命偷取', (s.lifeSteal * 100).toFixed(1), '%')}
              ${statBox('处决增伤', (s.execute * 100).toFixed(0), '%')}
              ${statBox('领主增伤', (s.bossDamage * 100).toFixed(0), '%')}
              ${statBox('精英增伤', (s.eliteDamage * 100).toFixed(0), '%')}
              ${statBox('每秒回复', (s.regenPct * 100).toFixed(2), '%')}
              ${statBox('拾取范围', Math.round(s.pickupRadius))}
            </div>
          </div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">已装备</span><span class="section-note">武器 · 护甲 · 指环 · 护符</span></div>
            <div class="equip-grid">${EQUIP_SLOTS.map(slot => renderEquipSlot(slot, p.equipment[slot.id])).join('')}</div>
          </div>
        </div>
        <div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">本命天赋</span><span class="section-note">${learned.length} / ${TALENTS.length} 种</span></div>
            <div class="talent-list">
              ${learned.length ? learned.map(t => renderTalentRow(t, p.talents[t.id] || 0, false)).join('') : '<div class="empty-note">还没有铭刻天赋。</div>'}
            </div>
          </div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">探索手记</span><span class="section-note">本局记录</span></div>
            <div class="stat-grid">
              ${statBox('击杀', fmt(p.kills))}
              ${statBox('领主', p.bossKills)}
              ${statBox('时长', fmtTime(p.playTime))}
              ${statBox('拾取金币', fmt(p.gold))}
              ${statBox('深层距离', fmt(p.deepest / 10), ' m')}
              ${statBox('装备评分', equippedPower())}
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderEquipSlot(slotDef, item) {
    if (!item) {
      return `<div class="equip-slot empty-slot">
        <div class="es-kind"><span>${slotDef.name}</span><b style="color:#5f5c55">${slotDef.icon}</b></div>
        <div class="es-name">尚未装备</div>
        <div class="es-level">在行囊中点击装备</div>
      </div>`;
    }
    const r = RARITIES[item.rarity];
    return `<div class="equip-slot ${item.isDivine ? 'divine-item' : ''}" style="--rarity-color:${r.color};--rarity-soft:${r.soft}">
      <div class="es-kind"><span>${slotDef.name}</span><b>${r.label}</b></div>
      <div class="es-icon">${slotDef.icon}</div>
      <div class="es-name">${item.name}</div>
      <div class="es-level">装备等级 Lv.${item.level} · 评分 ${itemScore(item)}${item.source ? ` · ${item.source}` : ''}</div>
      <div class="es-stats">${Object.entries(item.stats).map(([k, v]) => `<span>${STAT_LABELS[k] || k} +${v}${isPercentStat(k) ? '%' : ''}</span>`).join('')}</div>
      ${item.lore ? `<div class="es-lore">${item.lore}</div>` : ''}
    </div>`;
  }

  function isPercentStat(key) {
    return ['crit', 'critDamage', 'haste', 'attackSpeed', 'skillPower', 'moveSpeed',
      'goldFind', 'xpBonus', 'attackPct', 'hpPct', 'allDamage', 'thorns',
      'execute', 'bossDamage', 'eliteDamage', 'regenPct', 'damageReduction', 'lifeSteal'].includes(key);
  }

  function renderTalentRow(talent, count, unknown) {
    const r = TALENT_GRADES[talent.grade] || TALENT_GRADES.F;
    const effectiveCount = count || 1;
    return `<div class="talent-row" style="--rarity-color:${r.color};--rarity-soft:${r.soft};${unknown ? 'opacity:.46;' : ''}">
      <div class="tr-icon">${talent.icon}</div>
      <div class="tr-info">
        <div class="tr-head"><b>${talent.name}</b><span>${count > 0 ? `Lv.${count}` : '未获得'} · ${r.label}</span></div>
        <div class="tr-effect">${talent.effect(effectiveCount)}</div>
      </div>
    </div>`;
  }

  function renderSkillsPanel() {
    const p = game.player;
    if (game.selectedSkillSlot >= p.slots) game.selectedSkillSlot = 0;
    const cost = p.slots < MAX_SKILL_SLOTS ? SKILL_SLOT_COSTS[p.slots - 4] : null;
    const sorted = p.skills.slice().sort((a, b) => {
      const ri = (RARITIES[b.rarity]?.index || 0) - (RARITIES[a.rarity]?.index || 0);
      return ri !== 0 ? ri : b.level - a.level;
    });
    return `
      <div class="panel-section">
        <div class="section-head"><span class="section-title">战技槽位</span><span class="section-note">已解锁 ${p.slots} / ${MAX_SKILL_SLOTS} · 点击槽位选择装配位置</span></div>
        <div class="slot-editor">
          ${Array.from({ length: p.slots }, (_, i) => {
            const skill = p.equipped[i];
            if (!skill) return `<button class="editor-slot locked ${game.selectedSkillSlot === i ? 'selected' : ''}" data-action="select-slot" data-slot="${i}">
              <span class="eds-key">${i + 1}</span>空槽位<br><small>选择后装配技能</small></button>`;
            const r = RARITIES[skill.rarity];
            return `<button class="editor-slot ${game.selectedSkillSlot === i ? 'selected' : ''}" style="--slot-color:${r.color};--slot-glow:${r.soft}" data-action="select-slot" data-slot="${i}">
              <span class="eds-key">${i + 1}</span>
              <span class="eds-icon">${skill.icon}</span>
              <div class="eds-name">${skill.name}</div>
              <div class="eds-lv">${r.label} · Lv.${skill.level} · ${skill.power.toFixed(2)}x</div>
            </button>`;
          }).join('')}
        </div>
        <div class="slot-buy-note">
          <span>${p.slots < MAX_SKILL_SLOTS ? `下一槽位：第 ${p.slots + 1} 槽 · 黑市售价 <b>${fmt(cost)}</b> 金币` : '八个战技槽位已全部解锁。'}</span>
          <span style="display:flex;gap:6px">
            ${p.equipped[game.selectedSkillSlot] ? `<button class="mini-btn danger" data-action="unequip-skill" data-slot="${game.selectedSkillSlot}">卸下选中槽</button>` : ''}
            ${p.slots < MAX_SKILL_SLOTS ? `<button class="mini-btn primary" data-action="buy-slot">${p.gold >= cost ? '立即扩张' : '金币不足'}</button>` : '<span class="section-note">MAX</span>'}
          </span>
        </div>
      </div>
      <div class="panel-section">
        <div class="section-head"><span class="section-title">已知战技</span><span class="section-note">${p.skills.length} 本 · 更强版本会自动替换旧书</span></div>
        <div class="skill-library">
          ${sorted.map(skill => {
            const r = RARITIES[skill.rarity];
            const equippedIndex = p.equipped.findIndex(s => s && s.uid === skill.uid);
            const isSelected = equippedIndex === game.selectedSkillSlot;
            return `<div class="skill-card ${equippedIndex >= 0 ? 'equipped' : ''}" style="--rarity-color:${r.color};--rarity-soft:${r.soft}">
              <div class="sc-head">
                <span class="sc-icon">${skill.icon}</span>
                <span class="sc-title"><b>${skill.name}</b><span>${r.label} · Lv.${skill.level} · 威能 ${skill.power.toFixed(2)}x</span></span>
              </div>
              <div class="sc-desc">${skill.desc}</div>
              <div class="sc-stats">
                <span>冷却 ${skillCd(skill).toFixed(1)}s</span>
                <span>伤害 ${(skillPowerOf(skill) * 100).toFixed(0)}% 攻击</span>
                ${equippedIndex >= 0 ? `<span style="color:${r.color}">装备于槽位 ${equippedIndex + 1}</span>` : ''}
              </div>
              <div class="sc-actions">
                <button class="mini-btn ${isSelected ? '' : 'primary'}" data-action="equip-skill" data-uid="${skill.uid}" ${isSelected ? 'disabled' : ''}>${isSelected ? '已装备' : equippedIndex >= 0 ? '移至选中槽' : '装配至选中槽'}</button>
              </div>
            </div>`;
          }).join('') || '<div class="empty-note">技能书空空如也。深渊中的怪物偶尔会掉落战技书。</div>'}
        </div>
      </div>`;
  }

  function renderTalentsPanel() {
    const p = game.player;
    const learned = TALENTS.filter(t => (p.talents[t.id] || 0) > 0).sort((a, b) => TALENT_GRADES[b.grade].rank - TALENT_GRADES[a.grade].rank);
    const nextTalent = (Math.floor(p.level / 10) + 1) * 10;
    const gradeGroups = TALENT_GRADE_LIST.map(grade => {
      const pool = TALENTS.filter(t => t.grade === grade.key);
      return `<div class="talent-grade-group" style="--rarity-color:${grade.color}">
        <div class="talent-grade-head"><span>${grade.label}</span><small>${pool.length} 种 · 获取权重 ${grade.weight}%</small></div>
        <div class="talent-list">
          ${pool.map(t => renderTalentRow(t, p.talents[t.id] || 0, !(p.talents[t.id] > 0))).join('')}
        </div>
      </div>`;
    }).join('');
    return `
      <div class="panel-columns align-start">
        <div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">已铭刻 · ${totalTalentStacks()} 层</span><span class="section-note">无学习上限</span></div>
            <div class="talent-list">
              ${learned.length ? learned.map(t => renderTalentRow(t, p.talents[t.id] || 0, false)).join('') : '<div class="empty-note">尚未获得任何天赋。</div>'}
            </div>
            <div class="rule-note">下一个固定天赋节点：<strong style="color:#d3b97e">Lv.${nextTalent}</strong>。每 10 级获得一次三选一机会。<br>
            F–A 每阶 10 种，S–SSS 每阶 5 种；S/SS/SSS 的增幅倍率分别为 ×2 / ×5 / ×10，每层继续相乘。<br>
            天赋宝珠可在任意时刻提供指定天赋，并允许无限叠加。</div>
          </div>
        </div>
        <div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">命运图鉴</span><span class="section-note">${learned.length} / ${TALENTS.length} · 位阶越高越稀有</span></div>
            ${gradeGroups}
          </div>
        </div>
      </div>`;
  }

  function renderCareerPanel() {
    const p = game.player;
    if (game.classChoice) return renderClassChoicePanel();
    const books = (p.classBooks || []).slice().sort((a, b) => {
      const ra = CLASS_BOOK_RANK_BY_KEY[a.rank]?.rank || 0;
      const rb = CLASS_BOOK_RANK_BY_KEY[b.rank]?.rank || 0;
      return rb - ra;
    });
    const current = p.currentClass ? CLASS_BY_ID[p.currentClass] : null;
    const currentEntry = current ? p.classTalents[current.id] : null;
    const currentRank = currentEntry ? (CLASS_BOOK_RANK_BY_KEY[currentEntry.bestRank] || CLASS_BOOK_RANKS[0]) : null;
    const learned = Object.entries(p.classTalents || {})
      .filter(([id, entry]) => CLASS_BY_ID[id] && (entry?.power || 0) > 0)
      .sort((a, b) => (b[1].power || 0) - (a[1].power || 0));
    const levelProgress = clamp(p.level / ASCENSION_LEVEL * 100, 0, 100);
    const ready = p.level >= ASCENSION_LEVEL && !game.ascended;
    return `
      <div class="career-hero panel-card" style="--class-color:${current ? currentRank?.color || '#c9ad77' : '#9b927f'};--class-soft:${current ? currentRank?.soft || 'rgba(180,150,90,.12)' : 'rgba(150,140,120,.1)'}">
        <div class="career-seal">${current ? current.icon : '無'}</div>
        <div>
          <h3>${current ? current.name : '尚未转职'}${current ? `<small>${current.source}</small>` : ''}</h3>
          <p>${current ? `${current.title} · 转职天赋「${current.talentName}」` : '击杀小怪有 0.1% 概率掉落转职书，精英与领主的概率更高。'}</p>
          ${current && currentEntry ? `<div class="career-talent">累计强度 ${nf(currentEntry.power)} · <b>${current.effect(currentEntry.power)}</b></div>` : '<div class="career-talent">尚未获得任何转职天赋。</div>'}
        </div>
      </div>
      <div class="panel-columns align-start">
        <div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">转职书</span><span class="section-note">${books.length} 本 · 使用后从 3 个职业中选择</span></div>
            <div class="class-book-grid">
              ${books.length ? books.map(book => {
                const rank = CLASS_BOOK_RANK_BY_KEY[book.rank] || CLASS_BOOK_RANKS[0];
                return `<div class="class-book-card" style="--book-color:${rank.color};--book-soft:${rank.soft}">
                  <div class="cb-rank">${rank.label} · 转职天赋强度 ×${rank.mult}</div>
                  <h4>${rank.label}转职书</h4>
                  <p>来自异世职业体系的命运残页。开启后随机出现 3 个职业，选择其一并永久获得对应转职天赋。</p>
                  <div class="cb-actions"><button class="mini-btn primary" data-action="use-class-book" data-uid="${book.uid}">开启职业选择</button></div>
                </div>`;
              }).join('') : '<div class="empty-note">还没有转职书。<br>普通小怪 0.1% 掉落，精英 0.2%，领主 5%。</div>'}
            </div>
            <div class="rule-note">转职书的品阶越高，本次获得的转职天赋越强：黄阶 ×1、玄阶 ×1.7、地阶 ×2.6、天阶 ×4、圣阶 ×6.5、神阶 ×10。<br>
            转职后旧职业的转职天赋不会消失，会继续提供属性。</div>
          </div>
        </div>
        <div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">已获转职天赋</span><span class="section-note">${learned.length} / ${CLASSES.length} 种职业</span></div>
            <div class="talent-list">
              ${learned.length ? learned.map(([id, entry]) => renderClassTalentCard(CLASS_BY_ID[id], entry)).join('') : '<div class="empty-note">转职后，来自小说职业体系的天赋会永久留在这里。</div>'}
            </div>
          </div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">飞升 · 神域</span><span class="section-note">${game.ascended ? '已完成' : `Lv.${ASCENSION_LEVEL} 解锁`}</span></div>
            <div class="ascend-card ${game.ascended ? 'ascended-card' : ''}">
              ${game.ascended ? `
                <h3>已飞升 · 神域</h3>
                <p>凡躯已越过天门，神域的怪物与掉落提升了 ${DIVINE_ENEMY_LEVEL_BONUS} 级。你已获得一件传说神装。</p>
                <div class="ascend-meta"><span>神域已开启</span><span>THE DIVINE REALM</span></div>` : `
                <h3>飞升 · 神域</h3>
                <p>达到 Lv.${ASCENSION_LEVEL} 后可叩响天门。飞升后进入神域，所有怪物等级提升 ${DIVINE_ENEMY_LEVEL_BONUS} 级，并获得一件来自小说传说的神装。</p>
                <div class="ascend-progress"><i style="width:${levelProgress}%"></i></div>
                <div class="ascend-meta"><span>当前等级 Lv.${p.level} / ${ASCENSION_LEVEL}</span><span>${ready ? '天门已开' : '尚未抵达'}</span></div>
                <div style="margin-top:12px;display:flex;justify-content:flex-end">
                  <button class="mini-btn ${ready ? 'primary' : ''}" data-action="open-ascension" ${ready ? '' : 'disabled'}>${ready ? '叩响天门 · 飞升' : '等级不足'}</button>
                </div>`}
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderClassChoicePanel() {
    const p = game.player;
    const book = (p.classBooks || []).find(b => b.uid === game.classChoice?.bookUid);
    if (!book) {
      game.classChoice = null;
      return renderCareerPanel();
    }
    const rank = CLASS_BOOK_RANK_BY_KEY[book.rank] || CLASS_BOOK_RANKS[0];
    return `
      <div class="class-choice-head">
        <div>
          <h3>开启 ${rank.label}转职书</h3>
          <p>选择一条异世职业道路。本次转职天赋强度 ×${rank.mult}；相同职业会继续叠加。</p>
        </div>
        <button class="mini-btn" data-action="class-back">返回职业面板</button>
      </div>
      <div class="class-choice-grid">
        ${game.classChoice.options.map(classId => {
          const cls = CLASS_BY_ID[classId];
          if (!cls) return '';
          const existing = p.classTalents[classId];
          const isCurrent = p.currentClass === classId;
          return `<div class="class-choice-card" style="--book-color:${rank.color};--book-soft:${rank.soft}">
            <div class="cc-top">
              <span class="cc-icon">${cls.icon}</span>
              <div><h4>${cls.name}${isCurrent ? ' · 当前' : ''}</h4><span class="cc-source">${cls.source} · ${cls.title}</span></div>
            </div>
            <div class="cc-talent">${cls.talentName} · 强度 +${rank.mult}</div>
            <div class="cc-effect">${cls.effect(rank.mult)}${existing ? `<br><span style="color:#6f695e">已有职业天赋将叠加至强度 ${nf((existing.power || 0) + rank.mult)}</span>` : ''}</div>
            <div class="cc-flavor">“${cls.flavor}”</div>
            <div class="cc-actions"><button class="mini-btn primary" data-action="choose-class" data-class="${cls.id}">选择此职业</button></div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function renderInventoryPanel() {
    const p = game.player;
    const sorted = p.inventory.slice().sort((a, b) => itemScore(b) - itemScore(a));
    const salvageable = p.inventory.filter(i => RARITIES[i.rarity].index <= 1);
    return `
      <div class="inventory-toolbar">
        <span class="section-note">${p.inventory.length} / 30 件 · 自动装备更强物品 · 行囊满时自动分解</span>
        <span class="gold-headline">◆ ${fmt(p.gold)} 金币</span>
        ${salvageable.length ? `<button class="mini-btn danger" data-action="salvage-low">分解凡品 / 精良 ×${salvageable.length}</button>` : ''}
      </div>
      <div class="inventory-grid">
        ${sorted.map(item => {
          const r = RARITIES[item.rarity];
          const equipped = p.equipment[item.slot];
          const diff = itemScore(item) - itemScore(equipped);
          return `<div class="item-card ${item.isDivine ? 'divine-item' : ''}" style="--rarity-color:${r.color};--rarity-soft:${r.soft}">
            <div class="ic-head"><span class="ic-name">${item.name}</span><span class="ic-rarity">${r.label}</span></div>
            <div class="ic-kind">${EQUIP_SLOTS.find(s => s.id === item.slot)?.name || item.slot} · Lv.${item.level} · 评分 ${itemScore(item)}${item.source ? ` · ${item.source}` : ''}</div>
            <div class="ic-stats">${Object.entries(item.stats).map(([k, v]) => `<span>${STAT_LABELS[k] || k} +${v}${isPercentStat(k) ? '%' : ''}</span>`).join('')}</div>
            ${item.lore ? `<div class="ic-lore">${item.lore}</div>` : ''}
            <div class="ic-compare ${diff < 0 ? 'bad' : ''}">对比当前装备：${diff >= 0 ? '+' : ''}${diff.toFixed(1)} 评分</div>
            <div class="ic-actions">
              <button class="mini-btn" data-action="salvage-item" data-uid="${item.uid}">分解 +${item.value}</button>
              <button class="mini-btn primary" data-action="equip-item" data-uid="${item.uid}">装备</button>
            </div>
          </div>`;
        }).join('') || '<div class="empty-note">行囊 Empty。继续深入，深渊会给你东西的。</div>'}
      </div>`;
  }

  function renderShopPanel() {
    const p = game.player;
    return `
      <div class="panel-section">
        <div class="section-head"><span class="section-title">无光商栈 · 战技槽扩张</span><span class="section-note">当前 ${p.slots} / ${MAX_SKILL_SLOTS} 槽</span></div>
        <div class="shop-grid">
          ${SKILL_SLOT_COSTS.map((cost, i) => {
            const target = 5 + i;
            const purchased = p.slots >= target;
            const available = p.slots === target - 1;
            return `<div class="shop-card ${purchased ? 'purchased' : ''}">
              <div class="shop-mark">${['伍', '陆', '柒', '捌'][i]}</div>
              <h4>第 ${target} 个战技槽</h4>
              <p>让更多自动战技同时运转。装配后立刻开始自动施法，不占用你的操作。</p>
              <div class="shop-price"><span>${purchased ? '已解锁' : `${fmt(cost)} 金币`}</span>
                ${purchased ? '<span style="color:#79806e">✓</span>' : `<button class="mini-btn ${available && p.gold >= cost ? 'primary' : ''}" data-action="buy-slot" ${available && p.gold >= cost ? '' : 'disabled'}>${available ? (p.gold >= cost ? '购买' : '金币不足') : '需前一槽位'}</button>`}
              </div>
            </div>`;
          }).join('')}
        </div>
        <div class="shop-note"><span>✦</span><span>黑市只做两件事：收走死人的东西，卖掉活人的贪念。技能槽上限为 8 个；更高层的地牢会掉落更高等级的战技书。</span></div>
      </div>`;
  }

  function renderHelpPanel() {
    const rarities = RARITY_LIST.map(r => {
      const total = RARITY_LIST.reduce((a, x) => a + x.weight, 0);
      return `<tr><td style="color:${r.color}">◆ ${r.label}</td><td>${r.affixes} 条额外词缀</td><td>${r.weight > 0 ? (r.weight / total * 100).toFixed(1) + '%' : '飞升限定'}</td></tr>`;
    }).join('');
    const talentGrades = TALENT_GRADE_LIST.map(grade => {
      const count = TALENTS.filter(t => t.grade === grade.key).length;
      return `<tr><td style="color:${grade.color}">◆ ${grade.label}</td><td>${count} 种天赋</td><td>${(grade.weight / TALENT_GRADE_WEIGHT_TOTAL * 100).toFixed(2)}%</td></tr>`;
    }).join('');
    const classBookRanks = CLASS_BOOK_RANKS.map(rank => {
      return `<tr><td style="color:${rank.color}">◆ ${rank.label}</td><td>转职天赋强度 ×${rank.mult}</td><td>${rank.weight.toFixed(1)}%</td></tr>`;
    }).join('');
    return `
      <div class="help-columns">
        <div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">如何活着</span><span class="section-note">自动战斗 · 手动走位</span></div>
            <div class="help-copy">
              <p>你只需要控制移动。普攻与已装配战技会<strong>自动释放、自动瞄准最近的敌人</strong>。空格可以短暂无敌并冲刺。</p>
              <p>地图没有边界。离原点越远，怪物的等级、生命与伤害越高；它们掉落的装备和战技也越强。每深入一段距离，威胁等级都会上升。</p>
              <p>每 <em>10 级</em>可以从三项不同位阶的天赋中选一项。天赋宝珠会直接提供指定天赋，且<em>没有学习上限</em>，重复获得会永久叠加。</p>
              <p>F–A 级每阶 10 种，偏向温和成长；S–SSS 级每阶 5 种，分别提供 <em>×2 / ×5 / ×10</em> 的增幅。位阶越高，出现概率越低。</p>
            </div>
            <div class="control-grid">
              <div class="control-row"><kbd>W A S D</kbd><span>移动 / 探索</span></div>
              <div class="control-row"><kbd>SPACE</kbd><span>闪避（短暂无敌）</span></div>
              <div class="control-row"><kbd>C / K / T</kbd><span>角色 / 技能 / 天赋</span></div>
              <div class="control-row"><kbd>J / B / P</kbd><span>职业 / 行囊 / 黑市</span></div>
              <div class="control-row"><kbd>ESC</kbd><span>暂停 / 关闭面板</span></div>
              <div class="control-row"><kbd>M</kbd><span>开关音效</span></div>
              <div class="control-row"><kbd>1 – 4</kbd><span>切换游戏倍速</span></div>
              <div class="control-row"><kbd>移动端</kbd><span>左下摇杆 + 右下闪避键</span></div>
            </div>
          </div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">成长循环</span><span class="section-note">越深 · 越强 · 越危险</span></div>
            <div class="help-copy">
              <p>怪物掉落金币、装备、战技书、天赋宝珠与转职书。装备共六个常规品阶，等级越高，掉落权重越低。更强的怪物会带来更高物品等级与更高品阶概率。</p>
              <p>技能书掉落率固定为装备掉落率的 <em>20%</em>；天赋宝珠掉落率为技能掉落率的 <em>20%</em>。精英怪概率翻倍，领主有额外的保底装备。</p>
              <p>用金币在黑市扩张战技槽。初始 4 个槽位，最多可扩张到 8 个；每个槽位都会独立自动施法。</p>
            </div>
          </div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">转职与飞升</span><span class="section-note">小说职业 · 神域</span></div>
            <div class="help-copy">
              <p>普通小怪有 <em>0.1%</em> 概率掉落转职书，精英为 0.2%，领主为 5%。按 <em>J</em> 打开职业面板，使用转职书可从 3 个随机职业中选择，并获得永久转职天赋。</p>
              <p>转职书分黄、玄、地、天、圣、神六阶，本次获得的转职天赋强度分别为 ×1 / ×1.7 / ×2.6 / ×4 / ×6.5 / ×10。重复选择同一职业会继续叠加。</p>
              <p>达到 <em>Lv.30</em> 后可飞升至神域。所有敌人等级提升 20 级，地图化为神域，并获得一件来自小说传说的<strong>神装</strong>。</p>
            </div>
          </div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">转职书位阶</span><span class="section-note">品阶越高，本次转职天赋越强</span></div>
            <table class="drop-table">
              <thead><tr><th>位阶</th><th>转职天赋强度</th><th>基础权重</th></tr></thead>
              <tbody>${classBookRanks}</tbody>
            </table>
          </div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">天赋位阶</span><span class="section-note">基础权重 · 总计 75 种</span></div>
            <table class="drop-table">
              <thead><tr><th>位阶</th><th>天赋数量</th><th>基础权重</th></tr></thead>
              <tbody>${talentGrades}</tbody>
            </table>
            <div class="rule-note">每次天赋抉择会从不同位阶中抽取 3 张卡，因此上表为基础权重而非严格的单卡概率。S / SS / SSS 的效果分别为每层 ×2 / ×5 / ×10，重复学习会继续相乘。<br>
            天赋宝珠同样按此权重决定位阶，因此 SSS 宝珠是深渊中最罕见的掉落之一。</div>
          </div>
        </div>
        <div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">基础掉落</span><span class="section-note">普通怪物 · 每次击杀</span></div>
            <div class="drop-chain">
              <div><span>装备</span><b>12.00%</b></div>
              <i>× 20%</i>
              <div><span>战技</span><b>2.40%</b></div>
              <i>× 20%</i>
              <div><span>天赋宝珠</span><b>0.48%</b></div>
            </div>
            <div class="drop-chain" style="margin-top:8px">
              <div><span>转职书 / 普通怪</span><b>0.10%</b></div>
              <i>·</i>
              <div><span>转职书 / 精英</span><b>0.20%</b></div>
              <i>·</i>
              <div><span>转职书 / 领主</span><b>5.00%</b></div>
            </div>
            <div class="rule-note">精英怪：装备与战技掉落概率 ×2，金币与经验更高。<br>领主：3 件保底装备（第一件至少稀有），战技掉落 60%，天赋宝珠 12%。<br>所有概率均为单次击杀独立判定。</div>
          </div>
          <div class="panel-section">
            <div class="section-head"><span class="section-title">装备品阶</span><span class="section-note">基础权重 · 深层会缓慢提升高品阶</span></div>
            <table class="drop-table">
              <thead><tr><th>品阶</th><th>额外词缀</th><th>基础概率</th></tr></thead>
              <tbody>${rarities}</tbody>
            </table>
            <div class="rule-note">装备等级随怪物等级提升。等级越高的装备，品阶分布越偏向稀有，但最高品阶永远是最低概率。</div>
          </div>
          <div class="source-note">
            灵感来源：<a href="https://shouyou.3dmgame.com/gl/608846.html" target="_blank" rel="noreferrer">《胡闹地牢》天赋一览</a> ·
            <a href="https://a.9game.cn/news/6907461.html" target="_blank" rel="noreferrer">《杀戮尖塔》遗物</a> ·
            <a href="https://www.php.cn/faq/2395580.html" target="_blank" rel="noreferrer">《暗黑破坏神4》荆棘体系</a> ·
            <a href="https://lol.17173.com/content/2012-01-30/20120130042651108.shtml" target="_blank" rel="noreferrer">《英雄联盟》反伤与吸血装备</a>。<br>
            小说与职业来源：<a href="https://wapbaike.baidu.com/item/%E4%B9%9D%E7%A7%98/65542156" target="_blank" rel="noreferrer">《遮天》九秘</a> ·
            <a href="https://www.9game.cn/news/12063649.html" target="_blank" rel="noreferrer">《诡秘之主》愚者序列</a> ·
            <a href="https://wapbaike.baidu.com/item/%E7%82%BC%E8%8D%AF%E5%B8%88/10823622" target="_blank" rel="noreferrer">《斗破苍穹》炼药师</a> ·
            <a href="https://m.163.com/dy/article/K6H73IKI0552H59B.html" target="_blank" rel="noreferrer">《凡人修仙传》法宝</a> ·
            <a href="https://m.sohu.com/a/551879691_120194115/" target="_blank" rel="noreferrer">《斗罗大陆》四神器</a> ·
            <a href="https://wapbaike.baidu.com/item/%E6%B5%B7%E7%A5%9E%E7%A5%9E%E8%A3%85/23277151" target="_blank" rel="noreferrer">海神神装</a> ·
            <a href="https://m.toutiao.com/w/1877567992987655/" target="_blank" rel="noreferrer">《仙逆》古神皮甲</a> ·
            <a href="https://wapbaike.baidu.com/item/%E8%AF%9B%E4%BB%99%E5%89%91/15422311" target="_blank" rel="noreferrer">《诛仙》诛仙剑</a>。
            转职职业、转职天赋与神装名称均取自对应小说中的职业、序列、神通或神器；仅战斗数值为本作设计。
          </div>
        </div>
      </div>`;
  }

  function equipFromInventory(uid) {
    const p = game.player;
    const idx = p.inventory.findIndex(i => i.uid === uid);
    if (idx < 0) return;
    const item = p.inventory[idx];
    const old = p.equipment[item.slot];
    p.inventory.splice(idx, 1);
    p.equipment[item.slot] = item;
    if (old) p.inventory.push(old);
    deriveStats(p, 'ratio');
    audio.play('pickup');
    showToast({
      title: `已装备 · ${item.name}`,
      tag: `${RARITIES[item.rarity].label} · Lv.${item.level}`,
      desc: itemStatLine(item),
      color: RARITIES[item.rarity].color
    });
    updateHud(true);
    renderPanel();
    saveGame();
  }

  function salvageItem(uid) {
    const p = game.player;
    const idx = p.inventory.findIndex(i => i.uid === uid);
    if (idx < 0) return;
    const item = p.inventory.splice(idx, 1)[0];
    p.gold += item.value;
    audio.play('coin');
    showToast({ title: `分解 · ${item.name}`, tag: `+${item.value} 金币`, desc: '残渣归黑市，金币归你。', color: RARITIES[item.rarity].color });
    updateHud(true);
    renderPanel();
    saveGame();
  }

  function salvageLowItems() {
    const p = game.player;
    let gold = 0;
    let count = 0;
    p.inventory = p.inventory.filter(item => {
      if (RARITIES[item.rarity].index <= 1) { gold += item.value; count++; return false; }
      return true;
    });
    if (!count) return;
    p.gold += gold;
    audio.play('coin');
    showToast({ title: `批量分解 ${count} 件装备`, tag: `+${gold} 金币`, desc: '凡品与精良装备已化为路费。', color: '#b7a074' });
    updateHud(true);
    renderPanel();
    saveGame();
  }

  function equipSkillToSelected(uid) {
    const p = game.player;
    const skill = p.skills.find(s => s.uid === uid);
    if (!skill) return;
    const slot = clamp(game.selectedSkillSlot, 0, p.slots - 1);
    const oldSlot = p.equipped.findIndex(s => s && s.uid === skill.uid);
    if (oldSlot === slot) return;
    const previous = p.equipped[slot] || null;
    if (oldSlot >= 0) p.equipped[oldSlot] = previous;
    p.equipped[slot] = skill;
    p.skillCooldowns[slot] = 0.5;
    if (oldSlot >= 0) p.skillCooldowns[oldSlot] = 0.5;
    audio.play('skill');
    showToast({
      title: `战技装配 · ${skill.name}`,
      tag: `槽位 ${slot + 1}`,
      desc: `自动施法已就绪 · 冷却 ${skillCd(skill).toFixed(1)} 秒`,
      color: RARITIES[skill.rarity].color
    });
    renderSkillBar();
    renderPanel();
    saveGame();
  }

  function unequipSkill(slot) {
    const p = game.player;
    if (!p.equipped[slot]) return;
    p.equipped[slot] = null;
    p.skillCooldowns[slot] = 0;
    renderSkillBar();
    renderPanel();
    saveGame();
  }

  function buySkillSlot() {
    const p = game.player;
    if (p.slots >= MAX_SKILL_SLOTS) return;
    const idx = p.slots - 4;
    const cost = SKILL_SLOT_COSTS[idx];
    if (cost === undefined) return;
    if (p.gold < cost) {
      showToast({ title: '金币不足', tag: '黑市', desc: `扩张第 ${p.slots + 1} 槽需要 ${fmt(cost)} 金币。`, color: '#a26d63' });
      return;
    }
    p.gold -= cost;
    p.slots++;
    p.equipped.push(null);
    p.skillCooldowns.push(0);
    audio.play('buy');
    showToast({
      title: `战技槽扩张 · 第 ${p.slots} 槽`,
      tag: `-${fmt(cost)} 金币`,
      desc: '前往技能面板，为新的槽位装配一本战技书。',
      color: '#d4b270'
    });
    renderSkillBar();
    updateHud(true);
    if (game.activePanel) renderPanel();
    saveGame();
  }

  /* ============================================================
     Save / load
     ============================================================ */
  function serializePlayer(p) {
    return {
      x: p.x, y: p.y,
      level: p.level, xp: p.xp, xpNext: p.xpNext,
      hpRatio: clamp(p.hp / p.stats.maxHp, 0, 1),
      gold: p.gold, kills: p.kills, bossKills: p.bossKills,
      deepest: p.deepest, playTime: p.playTime,
      talents: p.talents,
      classBooks: p.classBooks,
      classTalents: p.classTalents,
      currentClass: p.currentClass,
      equipment: p.equipment,
      inventory: p.inventory,
      skills: p.skills,
      equipped: p.equipped.map(s => s ? s.uid : null),
      slots: p.slots,
      skillCooldowns: p.skillCooldowns,
      reviveUsed: p.reviveUsed
    };
  }

  function saveGame(force = false) {
    if (!game.player) return;
    if (!force && !['playing', 'panel', 'paused'].includes(game.state)) return;
    if (game.state === 'dead') return;
    try {
      const data = {
        version: CFG.version,
        savedAt: Date.now(),
        worldSeed: game.worldSeed,
        runTime: game.runTime,
        bossesKilled: game.bossesKilled,
        zoneBand: game.zoneBand,
        speed: game.speed,
        ascended: game.ascended,
        player: serializePlayer(game.player)
      };
      localStorage.setItem(CFG.saveKey, JSON.stringify(data));
      game.saveOk = true;
      game.lastSave = 0;
      if (stateIsInteractive()) flashSave();
    } catch (e) {
      game.saveOk = false;
    }
  }

  function stateIsInteractive() {
    return game.state === 'playing' || game.state === 'panel';
  }

  function loadSaveData() {
    try {
      const raw = localStorage.getItem(CFG.saveKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== CFG.version || !data.player) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function hasSavedGame() {
    return !!loadSaveData();
  }

  function clearSavedGame() {
    try { localStorage.removeItem(CFG.saveKey); } catch (e) { /* ignore */ }
    refreshContinueButton();
  }

  function refreshContinueButton() {
    const btn = $('btnContinue');
    if (hasSavedGame()) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  }

  function continueGame() {
    const data = loadSaveData();
    if (!data) {
      showToast({ title: '存档损坏', tag: '无法读取', desc: '深渊吞噬了旧日的记录。只能重新开始。', color: '#a26d63' });
      return;
    }
    try {
      clearCombat();
      game.worldSeed = data.worldSeed ?? ((Math.random() * 2147483647) | 0);
      game.featureCache.clear();
      game.runTime = data.runTime || 0;
      game.bossesKilled = data.bossesKilled || 0;
      game.zoneBand = data.zoneBand || 0;
      game.ascended = !!data.ascended;
      game.ascensionNoticeShown = !!data.ascended;
      game.classChoice = null;
      game.pendingDrafts = 0;
      game.selectedSkillSlot = 0;
      game.newRun = false;
      game.draft = null;

      const sp = data.player;
      const p = createPlayer();
      game.player = p;
      p.x = Number(sp.x) || 0;
      p.y = Number(sp.y) || 0;
      p.level = Math.max(1, Number(sp.level) || 1);
      p.xp = Math.max(0, Number(sp.xp) || 0);
      p.xpNext = sp.xpNext || xpToNext(p.level);
      p.gold = Math.max(0, Number(sp.gold) || 0);
      p.kills = Math.max(0, Number(sp.kills) || 0);
      p.bossKills = Math.max(0, Number(sp.bossKills) || 0);
      p.deepest = Math.max(0, Number(sp.deepest) || 0);
      p.playTime = Math.max(0, Number(sp.playTime) || 0);
      p.talents = sp.talents || {};
      p.classBooks = Array.isArray(sp.classBooks) ? sp.classBooks : [];
      p.classTalents = sp.classTalents && typeof sp.classTalents === 'object' ? sp.classTalents : {};
      p.currentClass = sp.currentClass && CLASS_BY_ID[sp.currentClass] ? sp.currentClass : null;
      p.ascended = game.ascended;
      p.equipment = { weapon: null, armor: null, ring: null, amulet: null };
      for (const slot of ['weapon', 'armor', 'ring', 'amulet']) {
        if (sp.equipment && sp.equipment[slot]) p.equipment[slot] = sp.equipment[slot];
      }
      p.inventory = Array.isArray(sp.inventory) ? sp.inventory : [];
      p.skills = Array.isArray(sp.skills) && sp.skills.length ? sp.skills : makeStartingSkills();
      p.slots = clamp(Number(sp.slots) || 4, 4, MAX_SKILL_SLOTS);
      const savedEquip = Array.isArray(sp.equipped) ? sp.equipped : [];
      p.equipped = Array.from({ length: p.slots }, (_, i) => {
        const id = savedEquip[i];
        return id ? p.skills.find(s => s.uid === id) || null : null;
      });
      p.skillCooldowns = Array.from({ length: p.slots }, (_, i) => Number(sp.skillCooldowns?.[i]) || 0);
      p.reviveUsed = Number(sp.reviveUsed) || 0;
      for (const item of [p.equipment.weapon, p.equipment.armor, p.equipment.ring, p.equipment.amulet, ...p.inventory]) {
        if (item && (!item.stats || !Number.isFinite(item.score))) {
          item.stats = item.stats || {};
          item.score = itemScore(item);
        }
      }
      p.stats = null;
      deriveStats(p, 'full');
      p.hp = p.stats.maxHp * clamp(Number(sp.hpRatio) || 1, 0.05, 1);
      game.camera.x = p.x;
      game.camera.y = p.y;
      game.bossTimer = 58;
      game.spawnTimer = 2.5;
      game.boss = null;
      game.state = 'playing';
      setGameSpeed(data.speed || 1, false);
      $('titleScreen').classList.add('hidden');
      $('deathScreen').classList.add('hidden');
      $('pauseScreen').classList.add('hidden');
      $('talentScreen').classList.add('hidden');
      $('modalLayer').classList.add('hidden');
      $('hud').classList.remove('hidden');
      renderSkillBar();
      updateHud(true);
      spawnInitialPack();
      showLocationBanner(zoneNameFor(getCurrentZoneLevel()), `威胁等级 ${romanFor(getCurrentZoneLevel())}`);
      showToast({
        title: '旧日足迹已复原',
        tag: '继续探索',
        desc: '深渊记得你离开的地方。继续走吧。',
        color: '#c6ae78'
      });
      audio.resume();
      saveGame();
    } catch (e) {
      console.error(e);
      showToast({ title: '读取失败', tag: '存档损坏', desc: '只能重新踏入地牢。', color: '#a26d63' });
    }
  }

  /* ============================================================
     Modals, pause, title, death transitions
     ============================================================ */
  function togglePause(force) {
    if (game.state === 'playing' && force !== false) {
      game.state = 'paused';
      $('pauseScreen').classList.remove('hidden');
      audio.play('click');
      saveGame();
    } else if (game.state === 'paused') {
      game.state = 'playing';
      $('pauseScreen').classList.add('hidden');
      audio.play('click');
    }
  }

  function returnToTitle(save = true) {
    if (save) saveGame(true);
    game.state = 'title';
    $('pauseScreen').classList.add('hidden');
    $('modalLayer').classList.add('hidden');
    $('ascensionScreen').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('deathScreen').classList.add('hidden');
    $('talentScreen').classList.add('hidden');
    $('titleScreen').classList.remove('hidden');
    game.activePanel = null;
    game.boss = null;
    $('bossWrap').classList.remove('visible');
    clearCombat();
    if (!game.player || game.player.dead) {
      resetRun();
      game.state = 'title';
    }
    game.player.moving = false;
    refreshContinueButton();
    updateContinueButton();
  }

  function updateContinueButton() {
    const btn = $('btnContinue');
    const data = loadSaveData();
    if (data) {
      btn.classList.remove('hidden');
      const ago = Math.max(0, Math.floor((Date.now() - (data.savedAt || Date.now())) / 60000));
      btn.textContent = ago > 0 ? `继续探索 · ${ago} 分钟前` : '继续上次探索';
    } else {
      btn.classList.add('hidden');
      btn.textContent = '继续上次探索';
    }
  }

  function useReviveFromSkill() { /* reserved for expansion */ }

  /* ============================================================
     Event wiring & keyboard
     ============================================================ */
  function bindEvents() {
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('beforeunload', () => saveGame());

    $('btnStart').addEventListener('click', () => {
      audio.resume();
      startNewRun();
    });
    $('btnContinue').addEventListener('click', () => {
      audio.resume();
      continueGame();
    });
    $('btnTitleHelp').addEventListener('click', () => openHelp('title'));
    $('btnReroll').addEventListener('click', rerollDraft);
    $('draftCards').addEventListener('click', e => {
      const card = e.target.closest('[data-talent-pick]');
      if (!card || !game.draft) return;
      audio.resume();
      chooseTalent(card.dataset.talentPick);
    });
    $('btnResume').addEventListener('click', () => togglePause());
    $('btnPauseHelp').addEventListener('click', () => openHelp('paused'));
    $('btnBackTitle').addEventListener('click', () => returnToTitle(true));
    $('btnRetry').addEventListener('click', () => {
      audio.resume();
      startNewRun();
    });
    $('btnDeathTitle').addEventListener('click', () => returnToTitle(false));
    $('btnAscend').addEventListener('click', performAscension);
    $('btnAscendCancel').addEventListener('click', cancelAscension);
    $('btnPause').addEventListener('click', () => {
      if (game.state === 'playing') togglePause();
    });
    $('btnSound').addEventListener('click', () => {
      audio.resume();
      const enabled = audio.toggle();
      $('btnSound').style.color = enabled ? '' : '#534f47';
      $('btnSound').textContent = enabled ? '♪' : '×';
      showToast({ title: enabled ? '音效已开启' : '音效已关闭', tag: 'M', desc: '', color: '#b6a375' });
    });
    $('mobileDash').addEventListener('click', triggerDash);
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.resume();
        audio.play('click');
        setGameSpeed(btn.dataset.speed);
      });
    });

    document.querySelectorAll('.dock-btn[data-panel]').forEach(btn => {
      btn.addEventListener('click', () => openPanel(btn.dataset.panel));
    });
    $('skillBar').addEventListener('click', e => {
      const slot = e.target.closest('[data-skill-slot]');
      if (!slot) return;
      if (game.state !== 'playing') return;
      game.selectedSkillSlot = Number(slot.dataset.skillSlot) || 0;
      openPanel('skills');
    });
    $('modalLayer').addEventListener('click', e => {
      if (e.target.closest('[data-close-modal]')) closeModal();
    });
    $('modalBody').addEventListener('click', e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'select-slot') {
        game.selectedSkillSlot = Number(btn.dataset.slot) || 0;
        renderPanel();
        audio.play('click');
      } else if (action === 'equip-skill') {
        equipSkillToSelected(btn.dataset.uid);
      } else if (action === 'unequip-skill') {
        unequipSkill(Number(btn.dataset.slot));
      } else if (action === 'buy-slot') {
        buySkillSlot();
      } else if (action === 'use-class-book') {
        useClassBook(btn.dataset.uid);
      } else if (action === 'choose-class') {
        chooseClass(btn.dataset.class);
      } else if (action === 'class-back') {
        cancelClassChoice();
      } else if (action === 'open-ascension') {
        openAscension();
      } else if (action === 'equip-item') {
        equipFromInventory(btn.dataset.uid);
      } else if (action === 'salvage-item') {
        salvageItem(btn.dataset.uid);
      } else if (action === 'salvage-low') {
        salvageLowItems();
      }
    });
    $('modalLayer').addEventListener('wheel', e => {
      // Let the internal body scroll naturally; prevents the game from receiving accidental wheel interactions.
      e.stopPropagation();
    }, { passive: true });

    // Movement & panel keys
    window.addEventListener('keydown', e => {
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
      if (code === 'Escape' && !$('modalLayer').classList.contains('hidden')) {
        closeModal();
        return;
      }
      if (game.state === 'playing') {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
          game.keys.add(code);
        }
        if (code === 'Space' && !e.repeat) triggerDash();
        if (!e.repeat) {
          if (code === 'Escape') togglePause();
          else if (code === 'KeyC') openPanel('character');
          else if (code === 'KeyK') openPanel('skills');
          else if (code === 'KeyT') openPanel('talents');
          else if (code === 'KeyJ') openPanel('career');
          else if (code === 'KeyB') openPanel('inventory');
          else if (code === 'KeyP') openPanel('shop');
          else if (code === 'KeyM') $('btnSound').click();
          else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code)) {
            setGameSpeed(Number(code.slice(5)));
          }
        }
      } else if (game.state === 'paused') {
        if (code === 'Escape') togglePause();
      } else if (game.state === 'panel') {
        if (code === 'Escape') closeModal();
      } else if (game.state === 'ascension') {
        if (code === 'Escape') cancelAscension();
        else if (code === 'Enter') performAscension();
      } else if (game.state === 'title') {
        if (e.target.tagName !== 'INPUT' && code === 'Enter') startNewRun();
      }
    });
    window.addEventListener('keyup', e => game.keys.delete(e.code));
    window.addEventListener('blur', () => game.keys.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.state === 'playing') togglePause(true);
    });

    setupJoystick();
    $('btnContinue').addEventListener('mouseenter', updateContinueButton);
  }

  function setupJoystick() {
    const stick = $('mobileStick');
    const knob = $('stickKnob');
    if (!stick) return;
    let pointerId = null;
    const maxDist = 30;
    const setVector = (clientX, clientY) => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > maxDist) { dx = (dx / len) * maxDist; dy = (dy / len) * maxDist; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      game.joystick.x = dx / maxDist;
      game.joystick.y = dy / maxDist;
      game.joystick.active = true;
    };
    stick.addEventListener('pointerdown', e => {
      e.preventDefault();
      pointerId = e.pointerId;
      stick.setPointerCapture(pointerId);
      setVector(e.clientX, e.clientY);
    });
    stick.addEventListener('pointermove', e => {
      if (pointerId !== e.pointerId) return;
      setVector(e.clientX, e.clientY);
    });
    const end = e => {
      if (pointerId !== e.pointerId) return;
      pointerId = null;
      game.joystick.active = false;
      game.joystick.x = 0;
      game.joystick.y = 0;
      knob.style.transform = 'translate(0px, 0px)';
    };
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }

  /* ============================================================
     Main loop & initialization
     ============================================================ */
  function loop(now) {
    const raw = (now - game.lastFrame) / 1000;
    const dt = clamp(Number.isFinite(raw) ? raw : 0.016, 0, 0.05);
    game.lastFrame = now;

    updateAmbient(dt);
    if (game.state === 'playing') {
      // Run up to 4× speed in fixed sub-steps so collisions, cooldowns and
      // projectile hits keep the same fidelity as 1× speed.
      let remaining = dt * game.speed;
      let steps = 0;
      while (remaining > 0.0001 && game.state === 'playing' && steps < 20) {
        const step = Math.min(remaining, 1 / 60);
        game.time += step;
        updateCombat(step);
        remaining -= step;
        steps++;
      }
      if (game.pendingDrafts > 0 && game.state === 'playing' && !game.draft) {
        game.pendingDrafts--;
        showDraft('level');
        saveGame();
      }
      if (game.state === 'playing') {
        game.lastSave += dt;
        if (game.lastSave > 15) {
          game.lastSave = 0;
          saveGame();
        }
      }
    }

    if (game.state !== 'title' && game.player) {
      if (now - game.lastHud > 65) {
        game.lastHud = now;
        updateHud();
      }
      if (now - game.lastMinimap > 120) {
        game.lastMinimap = now;
        drawMinimap();
      }
    }

    drawFrame();
    requestAnimationFrame(loop);
  }

  function init() {
    resizeCanvas();
    resetRun();
    game.state = 'title';
    $('hud').classList.add('hidden');
    $('titleScreen').classList.remove('hidden');
    bindEvents();
    updateSpeedSelector();
    refreshContinueButton();
    updateContinueButton();
    game.lastFrame = performance.now();
    requestAnimationFrame(loop);
    if (game.debug) {
      window.AbyssDebug = {
        game,
        p: () => game.player,
        addGold: n => { game.player.gold += n; updateHud(true); },
        spawnBoss,
        grantXp: n => gainXP(n),
        addTalent,
        makeEquipment,
        receiveEquipment,
        grantSkill: (id, rarityKey = 'rare', level = 3) => {
          const skill = makeSkillInstance(id, level, rarityKey);
          if (skill) receiveSkill(skill);
        },
        dropTestLoot: (type, payload = {}) => {
          const p = game.player;
          addLoot(type, p.x + 18, p.y + 8, payload, type === 'orb');
        },
        hurt: amount => damagePlayer(amount, 'debug'),
        addLoot,
        setGameSpeed,
        giveClassBook: (rank = 'huang') => receiveClassBook(makeClassBook(game.player.level, rank)),
        makeDivineEquipment,
        sim: (seconds = 30) => {
          const steps = Math.min(36000, Math.ceil(seconds * 60));
          for (let i = 0; i < steps; i++) {
            if (game.state !== 'playing') break;
            game.time += 1 / 60;
            updateCombat(1 / 60);
          }
          updateHud(true);
          return { level: game.player.level, hp: game.player.hp, kills: game.player.kills, state: game.state, pending: game.pendingDrafts };
        },
        updateHud,
        saveGame
      };
    }
  }

  init();
})();




