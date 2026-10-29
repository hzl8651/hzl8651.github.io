/* ============================================================
   深渊无尽 · TALENT HUNTER
   Static game data: rarities, talents, skills, gear, monsters.
   ============================================================ */
'use strict';

const RARITIES = {
  common:    { key: 'common',    label: '凡品', index: 0, color: '#b8bfc7', soft: 'rgba(184,191,199,.18)', affixes: 0, mult: 1.00, weight: 600 },
  uncommon:  { key: 'uncommon',  label: '精良', index: 1, color: '#6fcf8c', soft: 'rgba(111,207,140,.18)',  affixes: 1, mult: 1.16, weight: 260 },
  rare:      { key: 'rare',      label: '稀有', index: 2, color: '#69a9f5', soft: 'rgba(105,169,245,.20)',  affixes: 2, mult: 1.36, weight: 100 },
  epic:      { key: 'epic',      label: '史诗', index: 3, color: '#bd82f4', soft: 'rgba(189,130,244,.22)',  affixes: 3, mult: 1.62, weight: 30 },
  legendary: { key: 'legendary', label: '传说', index: 4, color: '#f2a847', soft: 'rgba(242,168,71,.24)',   affixes: 4, mult: 1.95, weight: 8 },
  mythic:    { key: 'mythic',    label: '神话', index: 5, color: '#f05f63', soft: 'rgba(240,95,99,.26)',    affixes: 5, mult: 2.38, weight: 2 },
  divine:    { key: 'divine',    label: '神装', index: 6, color: '#ffe5a0', soft: 'rgba(255,229,160,.30)',  affixes: 6, mult: 3.40, weight: 0, unique: true }
};

const RARITY_LIST = Object.values(RARITIES).sort((a, b) => a.index - b.index);

/* ------------------------------------------------------------
   Talent grades — F 到 SSS，位阶越高获取概率越低。
   F–A 每阶 10 个；S–SSS 每阶 5 个。
   F–A 偏向温和的数值成长；S–SSS 为明确的倍数增幅。
   ------------------------------------------------------------ */
const TALENT_GRADES = {
  F:   { key: 'F',   label: 'F级',   rank: 0, color: '#95958e', soft: 'rgba(149,149,142,.16)', weight: 35.0 },
  E:   { key: 'E',   label: 'E级',   rank: 1, color: '#a7b18f', soft: 'rgba(167,177,143,.16)', weight: 25.0 },
  D:   { key: 'D',   label: 'D级',   rank: 2, color: '#6fbc80', soft: 'rgba(111,188,128,.16)', weight: 16.0 },
  C:   { key: 'C',   label: 'C级',   rank: 3, color: '#5e9ddb', soft: 'rgba(94,157,219,.18)',  weight: 10.5 },
  B:   { key: 'B',   label: 'B级',   rank: 4, color: '#a67bd6', soft: 'rgba(166,123,214,.18)', weight: 6.5 },
  A:   { key: 'A',   label: 'A级',   rank: 5, color: '#dda85c', soft: 'rgba(221,168,92,.20)',  weight: 4.0 },
  S:   { key: 'S',   label: 'S级',   rank: 6, color: '#e86a60', soft: 'rgba(232,106,96,.22)',  weight: 1.8 },
  SS:  { key: 'SS',  label: 'SS级',  rank: 7, color: '#f25a91', soft: 'rgba(242,90,145,.24)',  weight: 0.8 },
  SSS: { key: 'SSS', label: 'SSS级', rank: 8, color: '#ffdc7e', soft: 'rgba(255,220,126,.26)', weight: 0.4 }
};

const TALENT_GRADE_LIST = Object.values(TALENT_GRADES).sort((a, b) => a.rank - b.rank);
const nf = v => Number(Number(v).toFixed(2)).toString();
const powLabel = (base, n) => {
  const value = Math.pow(base, n);
  return value >= 100000 ? value.toExponential(1).replace('e+', '×10^') : Math.round(value).toLocaleString('en-US');
};

/* ------------------------------------------------------------
   Talents
   名字与概念参考了《胡闹地牢》《暗黑破坏神》《杀戮尖塔》《哈迪斯》
   《英雄联盟》等游戏，以及《遮天》《完美世界》《诡秘之主》《斗破苍穹》
   《凡人修仙传》《吞噬星空》等小说的能力设定，效果数值为原创。
   ------------------------------------------------------------ */
const TALENTS = [
  /* ======================== F 级 · 10 ======================== */
  {
    id: 'agility', name: '机敏', grade: 'F', icon: '疾',
    flavor: '先手，就是活下来的资格。',
    effects: { attackSpeed: 2, moveSpeed: 1 },
    effect: n => `攻击速度 +${2 * n}%　移动速度 +${n}%`
  },
  {
    id: 'diligence', name: '刻苦', grade: 'F', icon: '刻',
    flavor: '没有白流的汗，也没有白挨的刀。',
    effects: { xpBonus: 4, hpPct: 1 },
    effect: n => `经验获取 +${4 * n}%　生命上限 +${n}%`
  },
  {
    id: 'bloodthirst', name: '战斗嗜血', grade: 'F', icon: '噬',
    flavor: '敌人的血，是最好的伤药。',
    effects: { killHeal: 0.35 },
    effect: n => `每次击杀回复 ${nf(0.35 * n)}% 最大生命`
  },
  {
    id: 'scavenger', name: '拾荒者', grade: 'F', icon: '拾',
    flavor: '死人带不走的东西，都是活人的运气。',
    effects: { goldFind: 4 },
    effect: n => `金币获取 +${4 * n}%`
  },
  {
    id: 'thick_hide', name: '皮糙肉厚', grade: 'F', icon: '皮',
    flavor: '活着，才有资格谈尊严。',
    effects: { defense: 2 },
    effect: n => `防御 +${2 * n}`
  },
  {
    id: 'faint_ember', name: '微弱火种', grade: 'F', icon: '火',
    flavor: '再小的火，也能把刀锋烧红。',
    effects: { attack: 1 },
    effect: n => `攻击力 +${n}`
  },
  {
    id: 'hunter_instinct', name: '猎人直觉', grade: 'F', icon: '鹰',
    flavor: '猎物的呼吸，比脚印更诚实。',
    effects: { crit: 0.8 },
    effect: n => `暴击率 +${nf(0.8 * n)}%`
  },
  {
    id: 'apprentice_touch', name: '学徒手法', grade: 'F', icon: '习',
    flavor: '咒语还歪歪扭扭，但足以点燃黑暗。',
    effects: { skillPower: 2 },
    effect: n => `技能伤害 +${2 * n}%`
  },
  {
    id: 'light_step', name: '轻装上路', grade: 'F', icon: '轻',
    flavor: '背得越少，走得越远。',
    effects: { moveSpeed: 1.5 },
    effect: n => `移动速度 +${nf(1.5 * n)}%`
  },
  {
    id: 'night_patience', name: '守夜人的耐心', grade: 'F', icon: '守',
    flavor: '长夜不会结束，但伤口会结痂。',
    effects: { regenPct: 0.12 },
    effect: n => `每秒回复 ${nf(0.12 * n)}% 最大生命`
  },

  /* ======================== E 级 · 10 ======================== */
  {
    id: 'fast_cast', name: '快速施法', grade: 'E', icon: '迅',
    flavor: '咒语还没落地，死亡已经抵达。',
    effects: { haste: 2.5 },
    effect: n => `技能冷却缩减 +${nf(2.5 * n)}%`
  },
  {
    id: 'bulwark', name: '坚固壁垒', grade: 'E', icon: '垒',
    flavor: '把每一次疼痛，都砌成下一堵墙。',
    effects: { defense: 3, damageReduction: 0.8 },
    effect: n => `防御 +${3 * n}　受到伤害 -${nf(0.8 * n)}%`
  },
  {
    id: 'exp_boost', name: '经验加速', grade: 'E', icon: '悟',
    flavor: '在深渊里，成长本身就是一种武器。',
    effects: { xpBonus: 5 },
    effect: n => `经验获取 +${5 * n}%`
  },
  {
    id: 'eagle_eye', name: '鹰眼', grade: 'E', icon: '眼',
    flavor: '在深渊，先看见的人先活。',
    effects: { crit: 1.2 },
    effect: n => `暴击率 +${nf(1.2 * n)}%`
  },
  {
    id: 'brute_force', name: '蛮力', grade: 'E', icon: '力',
    flavor: '道理讲不通的时候，骨头可以。',
    effects: { attack: 2 },
    effect: n => `攻击力 +${2 * n}`
  },
  {
    id: 'life_spring', name: '生命泉源', grade: 'E', icon: '泉',
    flavor: '泉眼在地下，也流在血脉里。',
    effects: { hpPct: 2 },
    effect: n => `生命上限 +${2 * n}%`
  },
  {
    id: 'bloody_edge', name: '沾血之刃', grade: 'E', icon: '刃',
    flavor: '刃口上的血越厚，握刀的手越稳。',
    effects: { lifeOnHit: 0.5 },
    effect: n => `每次命中回复 ${nf(0.5 * n)} 点生命`
  },
  {
    id: 'soul_whisper', name: '灵魂轻语', grade: 'E', icon: '语',
    flavor: '亡者在你耳边，教你怎样施法。',
    effects: { skillPower: 3 },
    effect: n => `技能伤害 +${3 * n}%`
  },
  {
    id: 'long_march', name: '长途奔袭', grade: 'E', icon: '行',
    flavor: '深渊很长，腿脚要更好。',
    effects: { moveSpeed: 2 },
    effect: n => `移动速度 +${2 * n}%`
  },
  {
    id: 'gold_scent', name: '金币嗅觉', grade: 'E', icon: '金',
    flavor: '金币落地的时候，会发出只有穷人听得见的声音。',
    effects: { goldFind: 6 },
    effect: n => `金币获取 +${6 * n}%`
  },

  /* ======================== D 级 · 10 ======================== */
  {
    id: 'blasting_strike', name: '爆裂一击', grade: 'D', icon: '爆',
    flavor: '第四刀落下时，骨头会替敌人尖叫。',
    effects: { explosionPct: 15 },
    effect: n => `每 4 次普攻引发爆炸，造成 ${15 * n}% 攻击力的范围伤害`
  },
  {
    id: 'thorn_skin', name: '荆棘皮肤', grade: 'D', icon: '棘',
    flavor: '靠近我，就和我一起流血。',
    effects: { thorns: 3 },
    effect: n => `反弹 ${3 * n}% 所受伤害`
  },
  {
    id: 'bloodlust', name: '嗜血渴望', grade: 'D', icon: '渴',
    flavor: '渴，是活着的证明。',
    effects: { killHeal: 0.6 },
    effect: n => `每次击杀回复 ${nf(0.6 * n)}% 最大生命`
  },
  {
    id: 'armor_breaker', name: '破甲者', grade: 'D', icon: '破',
    flavor: '甲再厚，也挡不住知道缝在哪的人。',
    effects: { attackPct: 2.5 },
    effect: n => `攻击力 +${nf(2.5 * n)}%`
  },
  {
    id: 'deadly_rhythm', name: '致命节奏', grade: 'D', icon: '节',
    flavor: '杀戮有自己的节拍。',
    effects: { attackSpeed: 3.5 },
    effect: n => `攻击速度 +${nf(3.5 * n)}%`
  },
  {
    id: 'steady_aim', name: '冷静瞄准', grade: 'D', icon: '瞄',
    flavor: '心跳越慢，箭越准。',
    effects: { critDamage: 10 },
    effect: n => `暴击伤害 +${10 * n}%`
  },
  {
    id: 'arcane_flux', name: '奥术回流', grade: 'D', icon: '流',
    flavor: '魔力像潮水，退去后还会回来。',
    effects: { haste: 3 },
    effect: n => `技能冷却缩减 +${3 * n}%`
  },
  {
    id: 'iron_will', name: '坚韧意志', grade: 'D', icon: '韧',
    flavor: '深渊试过折断你，但你只是站得更直。',
    effects: { hpPct: 3 },
    effect: n => `生命上限 +${3 * n}%`
  },
  {
    id: 'battlefield_scavenger', name: '战场拾荒', grade: 'D', icon: '荒',
    flavor: '胜利者负责写历史，拾荒者负责数钱。',
    effects: { goldFind: 8 },
    effect: n => `金币获取 +${8 * n}%`
  },
  {
    id: 'shadow_step', name: '影步', grade: 'D', icon: '影',
    flavor: '影子先到，人才会到。',
    effects: { moveSpeed: 2.5 },
    effect: n => `移动速度 +${nf(2.5 * n)}%`
  },

  /* ======================== C 级 · 10 ======================== */
  {
    id: 'war_machine', name: '战争机器', grade: 'C', icon: '战',
    flavor: '你不再是一个人，而是持续运转的杀意。',
    effects: { attackPct: 4 },
    effect: n => `攻击力 +${4 * n}%`
  },
  {
    id: 'storm_combo', name: '暴风连击', grade: 'C', icon: '暴',
    flavor: '风暴从不只落下一道雷。',
    effects: { attackSpeed: 4 },
    effect: n => `攻击速度 +${4 * n}%`
  },
  {
    id: 'arcane_focus', name: '秘法专注', grade: 'C', icon: '秘',
    flavor: '把整个世界缩成一句咒文。',
    effects: { skillPower: 5 },
    effect: n => `技能伤害 +${5 * n}%`
  },
  {
    id: 'blood_rage', name: '血怒', grade: 'C', icon: '怒',
    flavor: '愤怒不会让你变强，但会让刀更重。',
    effects: { critDamage: 15 },
    effect: n => `暴击伤害 +${15 * n}%`
  },
  {
    id: 'thorn_mail', name: '反伤甲', grade: 'C', icon: '甲',
    flavor: '你穿上的不是甲，是一整片荆棘林。',
    effects: { thorns: 5 },
    effect: n => `反弹 ${5 * n}% 所受伤害`
  },
  {
    id: 'survival_instinct', name: '生存本能', grade: 'C', icon: '生',
    flavor: '比野兽更早一步，比死亡更快一秒。',
    effects: { dodge: 2 },
    effect: n => `闪避率 +${2 * n}%`
  },
  {
    id: 'undying_ember', name: '不灭余烬', grade: 'C', icon: '烬',
    flavor: '火烧尽了，余烬还醒着。',
    effects: { regenPct: 0.3 },
    effect: n => `每秒回复 ${nf(0.3 * n)}% 最大生命`
  },
  {
    id: 'greed_mark', name: '贪婪印记', grade: 'C', icon: '贪',
    flavor: '深渊知道你想要什么，并为此加价。',
    effects: { goldFind: 10 },
    effect: n => `金币获取 +${10 * n}%`
  },
  {
    id: 'killer_instinct', name: '猎杀本能', grade: 'C', icon: '猎',
    flavor: '精英的骨头，比杂兵更值钱。',
    effects: { eliteDamage: 7 },
    effect: n => `对精英怪伤害 +${7 * n}%`
  },
  {
    id: 'field_medic', name: '战地医师', grade: 'C', icon: '医',
    flavor: '在战场上，缝伤口和缝甲胄是同一门手艺。',
    effects: { lifeOnHit: 0.8, killHeal: 0.3 },
    effect: n => `命中回复 ${nf(0.8 * n)} 生命　击杀回复 ${nf(0.3 * n)}% 最大生命`
  },

  /* ======================== B 级 · 10 ======================== */
  {
    id: 'calamity_strike', name: '灾厄之击', grade: 'B', icon: '厄',
    flavor: '命运偶尔会偏心，尤其偏爱你手里的刀。',
    effects: { crit: 2.5, critDamage: 12 },
    effect: n => `暴击率 +${nf(2.5 * n)}%　暴击伤害 +${12 * n}%`
  },
  {
    id: 'blood_tide', name: '嗜血狂潮', grade: 'B', icon: '潮',
    flavor: '伤口越多，潮水越高。',
    effects: { lifeSteal: 1.2 },
    effect: n => `生命偷取 +${nf(1.2 * n)}%`
  },
  {
    id: 'army_breaker', name: '破军', grade: 'B', icon: '军',
    flavor: '军阵再整，也挡不住一颗敢死的星。',
    effects: { bossDamage: 8 },
    effect: n => `对领主伤害 +${8 * n}%`
  },
  {
    id: 'immovable', name: '不动如山', grade: 'B', icon: '山',
    flavor: '山不会躲，所以山活得比风久。',
    effects: { defense: 7, damageReduction: 2 },
    effect: n => `防御 +${7 * n}　受到伤害 -${2 * n}%`
  },
  {
    id: 'arcane_regen', name: '奥术再生', grade: 'B', icon: '奥',
    flavor: '魔力流过伤口，像潮水漫过沙岸。',
    effects: { skillPower: 6, skillHeal: 0.08 },
    effect: n => `技能伤害 +${6 * n}%　技能命中回复 ${nf(0.08 * n)}% 最大生命`
  },
  {
    id: 'shadowless_step', name: '无影步', grade: 'B', icon: '无',
    flavor: '没有脚印的人，也不会留下尸体。',
    effects: { moveSpeed: 3.5, dodge: 1.5 },
    effect: n => `移动速度 +${nf(3.5 * n)}%　闪避率 +${nf(1.5 * n)}%`
  },
  {
    id: 'guillotine', name: '断头台', grade: 'B', icon: '斩',
    flavor: '最后一刀，总要留给站不稳的人。',
    effects: { execute: 12 },
    effect: n => `对生命低于 30% 的敌人伤害 +${12 * n}%`
  },
  {
    id: 'golden_rule', name: '黄金律', grade: 'B', icon: '律',
    flavor: '金币不是万能的，但深渊只收金币。',
    effects: { goldFind: 14 },
    effect: n => `金币获取 +${14 * n}%`
  },
  {
    id: 'tempest', name: '疾风骤雨', grade: 'B', icon: '疾',
    flavor: '风停之前，刀已经落完。',
    effects: { attackSpeed: 5 },
    effect: n => `攻击速度 +${5 * n}%`
  },
  {
    id: 'time_rift', name: '时间裂隙', grade: 'B', icon: '时',
    flavor: '你偷走的每一秒，都会在敌人身上还回来。',
    effects: { haste: 6 },
    effect: n => `技能冷却缩减 +${6 * n}%`
  },

  /* ======================== A 级 · 10 ======================== */
  {
    id: 'indestructible', name: '坚不可摧', grade: 'A', icon: '坚',
    flavor: '深渊试过折断你，但你只是站得更直。',
    effects: { hpPct: 8, damageReduction: 3 },
    effect: n => `生命上限 +${8 * n}%　受到伤害 -${3 * n}%`
  },
  {
    id: 'soul_possession', name: '灵魂附身', grade: 'A', icon: '魂',
    flavor: '死亡只是换一件外套。',
    effects: { reviveCharges: 1 },
    effect: n => `获得 ${n} 次灵魂复生：致死时保留 1 点生命并回复 35% 最大生命`
  },
  {
    id: 'giant_slayer', name: '巨人杀手', grade: 'A', icon: '巨',
    flavor: '个子越大，影子越容易踩。',
    effects: { bossDamage: 15, eliteDamage: 10 },
    effect: n => `对领主伤害 +${15 * n}%　对精英伤害 +${10 * n}%`
  },
  {
    id: 'executioner', name: '处刑者', grade: 'A', icon: '刑',
    flavor: '怜悯是留给活人的，活人不需要怜悯。',
    effects: { execute: 20 },
    effect: n => `对生命低于 30% 的敌人伤害 +${20 * n}%`
  },
  {
    id: 'blood_pact', name: '血之契约', grade: 'A', icon: '契',
    flavor: '你用自己的血，向深渊借了一点利息。',
    effects: { attackPct: 8, lifeSteal: 2 },
    effect: n => `攻击力 +${8 * n}%　生命偷取 +${2 * n}%`
  },
  {
    id: 'star_shift', name: '斗转星移', grade: 'A', icon: '斗',
    flavor: '以彼之道，还施彼身；以星之力，换你空门。',
    effects: { dodge: 4 },
    effect: n => `闪避率 +${4 * n}%`
  },
  {
    id: 'golden_age', name: '黄金时代', grade: 'A', icon: '黄',
    flavor: '当金币够多，连深渊都会为你让路。',
    effects: { goldFind: 20, pickupRadius: 60 },
    effect: n => `金币获取 +${20 * n}%　拾取范围 +${60 * n}`
  },
  {
    id: 'elemental_resonance', name: '元素共鸣', grade: 'A', icon: '元',
    flavor: '火、雷、冰、血，在同一个咒文里醒来。',
    effects: { skillPower: 10, allDamage: 4 },
    effect: n => `技能伤害 +${10 * n}%　全部伤害 +${4 * n}%`
  },
  {
    id: 'swift_shadow', name: '疾影', grade: 'A', icon: '瞬',
    flavor: '你追不上风，但风也追不上你。',
    effects: { moveSpeed: 5, dashCooldownReduction: 10 },
    effect: n => `移动速度 +${5 * n}%　闪避冷却 -${10 * n}%`
  },
  {
    id: 'thorn_throne', name: '荆棘王座', grade: 'A', icon: '荆',
    flavor: '坐上王座的人，终会变成刺的一部分。',
    effects: { thorns: 12, defense: 5 },
    effect: n => `反弹 ${12 * n}% 所受伤害　防御 +${5 * n}`
  },

  /* ======================== S 级 · 5 · 每层 ×2 ======================== */
  {
    id: 'titan_force', name: '泰坦之力', grade: 'S', icon: '泰',
    flavor: '世界最初的力量，只是把山举起来。',
    effects: { attackMult: 2 },
    effect: n => `攻击力 ×${powLabel(2, n)}（每层 ×2）`
  },
  {
    id: 'crimson_feast', name: '猩红盛宴', grade: 'S', icon: '血',
    flavor: '血是酒，伤口是酒杯。',
    effects: { critDamageMult: 2 },
    effect: n => `暴击伤害 ×${powLabel(2, n)}（每层 ×2）`
  },
  {
    id: 'thorn_judgment', name: '荆棘天罚', grade: 'S', icon: '棘',
    flavor: '每一道落在你身上的伤，都会长成刺。',
    effects: { thornsMult: 2 },
    effect: n => `反伤 ×${powLabel(2, n)}（每层 ×2）`
  },
  {
    id: 'arcane_tide', name: '奥术潮汐', grade: 'S', icon: '潮',
    flavor: '星海倒灌，法术不再需要理由。',
    effects: { skillMult: 2 },
    effect: n => `技能伤害 ×${powLabel(2, n)}（每层 ×2）`
  },
  {
    id: 'world_tree_s', name: '生命古树', grade: 'S', icon: '树',
    flavor: '根须穿过死亡，生命便不再讲常理。',
    effects: { hpMult: 2 },
    effect: n => `生命上限 ×${powLabel(2, n)}（每层 ×2）`
  },

  /* ======================== SS 级 · 5 · 每层 ×5 ======================== */
  {
    id: 'world_breaker', name: '一力破万法', grade: 'SS', icon: '破',
    flavor: '当力量足够大，规则也会弯腰。',
    effects: { attackMult: 5 },
    effect: n => `攻击力 ×${powLabel(5, n)}（每层 ×5）`
  },
  {
    id: 'eye_of_doom', name: '天罚之眼', grade: 'SS', icon: '眼',
    flavor: '它看你一眼，你的血就学会了背叛。',
    effects: { critDamageMult: 5 },
    effect: n => `暴击伤害 ×${powLabel(5, n)}（每层 ×5）`
  },
  {
    id: 'thousand_hell_thorns', name: '千狱荆棘', grade: 'SS', icon: '狱',
    flavor: '千座地狱，共用同一片刺丛。',
    effects: { thornsMult: 5 },
    effect: n => `反伤 ×${powLabel(5, n)}（每层 ×5）`
  },
  {
    id: 'galaxy_reversal', name: '星河倒卷', grade: 'SS', icon: '星',
    flavor: '咒文念到一半，银河已经换了方向。',
    effects: { skillMult: 5 },
    effect: n => `技能伤害 ×${powLabel(5, n)}（每层 ×5）`
  },
  {
    id: 'undying_frame', name: '不死天躯', grade: 'SS', icon: '躯',
    flavor: '死亡试过很多次，最后学会了绕路。',
    effects: { hpMult: 5 },
    effect: n => `生命上限 ×${powLabel(5, n)}（每层 ×5）`
  },

  /* ======================== SSS 级 · 5 · 每层 ×10 ======================== */
  {
    id: 'genesis', name: '开天辟地', grade: 'SSS', icon: '开',
    flavor: '你抬起手，世界重新分配了上下。',
    effects: { attackMult: 10 },
    effect: n => `攻击力 ×${powLabel(10, n)}（每层 ×10）`
  },
  {
    id: 'great_luo', name: '大罗道果', grade: 'SSS', icon: '罗',
    flavor: '因果之外，一击便是一生。',
    effects: { critDamageMult: 10 },
    effect: n => `暴击伤害 ×${powLabel(10, n)}（每层 ×10）`
  },
  {
    id: 'kalpa_thorns', name: '万劫不磨', grade: 'SSS', icon: '劫',
    flavor: '万劫烧尽，刺仍在。',
    effects: { thornsMult: 10 },
    effect: n => `反伤 ×${powLabel(10, n)}（每层 ×10）`
  },
  {
    id: 'all_heavens_end', name: '诸天寂灭', grade: 'SSS', icon: '灭',
    flavor: '群星不是熄灭，而是被你合上。',
    effects: { skillMult: 10 },
    effect: n => `技能伤害 ×${powLabel(10, n)}（每层 ×10）`
  },
  {
    id: 'immortal_ton', name: '不朽神藏', grade: 'SSS', icon: '藏',
    flavor: '你的身体里，藏着一座不会衰败的宇宙。',
    effects: { hpMult: 10 },
    effect: n => `生命上限 ×${powLabel(10, n)}（每层 ×10）`
  }
];

const TALENT_BY_ID = Object.fromEntries(TALENTS.map(t => [t.id, t]));
const TALENT_GRADE_WEIGHT_TOTAL = TALENT_GRADE_LIST.reduce((sum, g) => sum + g.weight, 0);

/* ------------------------------------------------------------
   Equipment
   ------------------------------------------------------------ */
const EQUIP_SLOTS = [
  { id: 'weapon',  name: '武器', icon: '刃', accent: '#e4b46e' },
  { id: 'armor',   name: '护甲', icon: '甲', accent: '#7fa9c9' },
  { id: 'ring',    name: '指环', icon: '环', accent: '#b993dc' },
  { id: 'amulet',  name: '护符', icon: '符', accent: '#79cbb6' }
];

const ITEM_BASES = {
  weapon: ['短剑', '长刀', '战斧', '法杖', '骨镰', '刺剑', '连枷'],
  armor:  ['皮甲', '锁子甲', '板甲', '法袍', '骸骨胸甲', '守夜人斗篷'],
  ring:   ['指环', '印戒', '宝石戒', '骨戒', '契约之环'],
  amulet: ['护符', '吊坠', '圣徽', '骨牌', '残月项链']
};

const ITEM_PREFIXES = {
  common:    ['破损的', '生锈的', '粗糙的', '褪色的'],
  uncommon:  ['坚固的', '猎手的', '秘银', '守墓人的'],
  rare:      ['幽影', '寒铁', '血契', '月蚀'],
  epic:      ['噬魂', '星界', '深渊', '无光'],
  legendary: ['永夜', '龙息', '审判', '烬灭'],
  mythic:    ['虚空', '永恒', '湮灭', '旧日'],
  divine:    ['传说']
};

const AFFIX_POOL = [
  { key: 'attack',    label: '攻击力',    fmt: v => `+${v}`,       roll: l => 1 + Math.round(l * 0.65),     weight: 16, score: 7.5 },
  { key: 'maxHp',     label: '生命上限',  fmt: v => `+${v}`,       roll: l => 8 + Math.round(l * 5.2),     weight: 16, score: 0.55 },
  { key: 'defense',   label: '防御',      fmt: v => `+${v}`,       roll: l => 1 + Math.round(l * 0.5),     weight: 12, score: 4.2 },
  { key: 'crit',      label: '暴击率',    fmt: v => `+${v.toFixed(1)}%`, roll: l => +(1.0 + Math.random() * 2.0 + l * 0.035).toFixed(1), weight: 10, score: 18 },
  { key: 'critDamage',label: '暴击伤害',  fmt: v => `+${v}%`,      roll: l => Math.round(8 + l * 0.65),     weight: 8,  score: 3.0 },
  { key: 'haste',     label: '技能急速',  fmt: v => `+${v.toFixed(1)}%`, roll: l => +(2 + Math.random() * 3 + l * 0.045).toFixed(1), weight: 8, score: 13 },
  { key: 'attackSpeed', label: '攻击速度',fmt: v => `+${v.toFixed(1)}%`, roll: l => +(1.5 + Math.random() * 2 + l * 0.025).toFixed(1), weight: 7, score: 12 },
  { key: 'skillPower',label: '技能增伤',  fmt: v => `+${v.toFixed(1)}%`, roll: l => +(2 + Math.random() * 2.5 + l * 0.04).toFixed(1), weight: 7, score: 10 },
  { key: 'moveSpeed', label: '移动速度',  fmt: v => `+${v.toFixed(1)}%`, roll: l => +(1 + Math.random() * 2 + l * 0.02).toFixed(1), weight: 5, score: 7 },
  { key: 'goldFind',  label: '金币获取',  fmt: v => `+${v}%`,      roll: l => Math.round(4 + l * 0.35),      weight: 4,  score: 1.5 },
  { key: 'lifeOnHit', label: '击中回复',  fmt: v => `+${v}`,       roll: l => +(0.3 + l * 0.045).toFixed(1), weight: 4, score: 2 },
  { key: 'xpBonus',   label: '经验获取',  fmt: v => `+${v}%`,      roll: l => Math.round(3 + l * 0.25),      weight: 3, score: 1.0 }
];

/* ------------------------------------------------------------
   Skills — every skill is auto-cast and auto-aimed.
   ------------------------------------------------------------ */
const SKILLS = [
  {
    id: 'shadow_bolt', name: '暗影弹', icon: '影', rarity: 'common', type: 'bolt',
    cd: 1.45, coeff: 1.0, range: 430, color: '#72d8d2', count: 1, speed: 540,
    desc: '向最近的敌人发射一枚追踪暗影弹，造成攻击力 100% 的伤害。'
  },
  {
    id: 'ground_cleave', name: '裂地斩', icon: '裂', rarity: 'common', type: 'nova',
    cd: 3.4, coeff: 0.85, range: 210, radius: 150, color: '#d49b63',
    desc: '在身周劈开裂地波，对范围内所有敌人造成攻击力 85% 的伤害。'
  },
  {
    id: 'frost_nova', name: '霜环', icon: '霜', rarity: 'common', type: 'nova',
    cd: 5.5, coeff: 0.7, range: 230, radius: 185, slow: 0.38, slowTime: 2.2, color: '#83c7ee',
    desc: '释放霜冻环，对周围敌人造成伤害并减速 38%，持续 2.2 秒。'
  },
  {
    id: 'bone_shield', name: '骸骨护盾', icon: '盾', rarity: 'common', type: 'shield',
    cd: 12, coeff: 0, range: 520, shieldPct: 0.14, duration: 8, color: '#c9d1be',
    desc: '用骸骨围拢自身，获得相当于 14% 最大生命的护盾，持续 8 秒。'
  },
  {
    id: 'hunter_volley', name: '追猎箭雨', icon: '雨', rarity: 'uncommon', type: 'bolt',
    cd: 3.8, coeff: 0.55, range: 500, color: '#9fe28d', count: 3, speed: 620,
    desc: '同时射出三枚追猎魂箭，每枚造成攻击力 55% 的伤害。'
  },
  {
    id: 'blood_orbit', name: '血刃回旋', icon: '旋', rarity: 'uncommon', type: 'orbit',
    cd: 7, coeff: 0.24, range: 0, radius: 96, color: '#e87a80', duration: 5, tick: 0.5, count: 2,
    desc: '召出两把血刃环绕自身，持续切割靠近的敌人。'
  },
  {
    id: 'corpse_burst', name: '尸爆', icon: '爆', rarity: 'uncommon', type: 'strike',
    cd: 5.8, coeff: 1.3, range: 460, radius: 140, delay: 0.55, color: '#c6d66c',
    desc: '在敌人脚下引爆尸骨，短暂延迟后造成攻击力 130% 的范围伤害。'
  },
  {
    id: 'vampiric_bolt', name: '汲血之触', icon: '汲', rarity: 'uncommon', type: 'bolt',
    cd: 3.2, coeff: 0.9, range: 450, color: '#e46f78', count: 1, speed: 560, healPct: 0.22,
    desc: '射出一枚汲血暗弹，造成伤害并回复该次伤害 22% 的生命。'
  },
  {
    id: 'chain_lightning', name: '连锁闪电', icon: '雷', rarity: 'rare', type: 'chain',
    cd: 4.8, coeff: 0.95, range: 480, color: '#89c9ff', chainCount: 4, chainRange: 230,
    desc: '闪电在至多 4 名敌人之间跳跃，每次造成攻击力 95% 的伤害。'
  },
  {
    id: 'meteor', name: '星陨术', icon: '陨', rarity: 'rare', type: 'strike',
    cd: 9, coeff: 2.1, range: 560, radius: 190, delay: 1.0, color: '#f0a55d',
    desc: '从虚空召来一颗陨星，1 秒后落地，造成攻击力 210% 的范围伤害。'
  },
  {
    id: 'soul_beam', name: '灵魂射线', icon: '束', rarity: 'rare', type: 'beam',
    cd: 5.5, coeff: 1.65, range: 580, width: 34, color: '#b39af5',
    desc: '向最近敌人射出一道贯穿灵魂的射线，造成攻击力 165% 的伤害。'
  },
  {
    id: 'wraith_dance', name: '幽魂之舞', icon: '舞', rarity: 'rare', type: 'orbit',
    cd: 8, coeff: 0.3, range: 0, radius: 112, color: '#8f86e8', duration: 4.5, tick: 0.4, count: 3,
    desc: '三枚幽魂刃围绕自身飞舞，持续撕扯周围的敌人。'
  },
  {
    id: 'void_rift', name: '虚空裂隙', icon: '隙', rarity: 'epic', type: 'strike',
    cd: 10, coeff: 2.45, range: 620, radius: 220, delay: 0.7, color: '#bf7bf2',
    desc: '撕开虚空，在目标处引爆裂隙，造成攻击力 245% 的范围伤害。'
  },
  {
    id: 'blade_tempest', name: '刃暴', icon: '暴', rarity: 'epic', type: 'orbit',
    cd: 11, coeff: 0.28, range: 0, radius: 128, color: '#f0cf7e', duration: 6, tick: 0.35, count: 4,
    desc: '四柄灵刃形成风暴，持续 6 秒切割靠近的一切。'
  },
  {
    id: 'reaper_mark', name: '死神印记', icon: '印', rarity: 'epic', type: 'beam',
    cd: 8, coeff: 2.7, range: 640, width: 50, color: '#e05c68',
    desc: '标记一名敌人并降下猩红射线，造成攻击力 270% 的伤害。'
  },
  {
    id: 'judgment', name: '天罚审判', icon: '裁', rarity: 'legendary', type: 'strike',
    cd: 12, coeff: 3.45, range: 680, radius: 285, delay: 1.1, color: '#ffd47a',
    desc: '审判之柱轰然坠落，造成攻击力 345% 的范围伤害。'
  },
  {
    id: 'abyss_tide', name: '深渊潮汐', icon: '潮', rarity: 'legendary', type: 'nova',
    cd: 10, coeff: 2.2, range: 360, radius: 380, slow: 0.5, slowTime: 3, color: '#58d3c4',
    desc: '掀起深渊潮汐，横扫周围敌人并减速 50%，持续 3 秒。'
  },
  {
    id: 'singularity', name: '湮灭奇点', icon: '湮', rarity: 'mythic', type: 'strike',
    cd: 16, coeff: 4.2, range: 720, radius: 330, delay: 1.25, color: '#ff6b6f',
    desc: '压缩一方空间直至湮灭，造成攻击力 420% 的毁灭性范围伤害。'
  },

  /* ---- 以下战技名称借用自小说中的斗技 / 神通 / 秘术 ---- */
  {
    id: 'eight_extremes', name: '八极崩', icon: '崩', rarity: 'uncommon', type: 'nova',
    cd: 4.0, coeff: 1.0, range: 230, radius: 160, color: '#d9a15e',
    desc: '斗气在拳锋炸开，震动周遭敌人，造成攻击力 100% 的范围伤害。'
  },
  {
    id: 'blue_lotus_flame', name: '青莲地心火', icon: '莲', rarity: 'rare', type: 'strike',
    cd: 8, coeff: 1.9, range: 540, radius: 185, delay: 0.75, slow: 0.25, slowTime: 2.5, color: '#62d9b0',
    desc: '青莲地心火在目标脚下盛开，造成攻击力 190% 的范围伤害并减速 25%。'
  },
  {
    id: 'nine_thunder_blade', name: '九重雷刀', icon: '刀', rarity: 'rare', type: 'chain',
    cd: 4.8, coeff: 1.0, range: 500, color: '#9bb8ff', chainCount: 5, chainRange: 245,
    desc: '九重雷刀化作雷光，在至多 5 名敌人之间跳跃，每次造成攻击力 100% 的伤害。'
  },
  {
    id: 'spirit_spear', name: '精神念力', icon: '念', rarity: 'uncommon', type: 'bolt',
    cd: 3.5, coeff: 1.1, range: 520, color: '#be8ce8', count: 1, speed: 640, pierce: 2,
    desc: '凝精神力为无形之刺，贯穿路径上的敌人，造成攻击力 110% 的伤害。'
  },
  {
    id: 'derived_god_weapon', name: '衍神兵', icon: '衍', rarity: 'epic', type: 'bolt',
    cd: 6, coeff: 0.5, range: 560, color: '#ffd483', count: 5, speed: 600, spread: 0.12,
    desc: '衍化五柄神兵同时射出，每柄造成攻击力 50% 的伤害。'
  },
  {
    id: 'yuanci_light', name: '元磁神光', icon: '磁', rarity: 'rare', type: 'beam',
    cd: 6, coeff: 1.9, range: 600, width: 42, color: '#c8d2df',
    desc: '元磁神光破开五行，贯穿射线上的敌人，造成攻击力 190% 的伤害。'
  },
  {
    id: 'green_bamboo_swords', name: '青竹蜂云剑', icon: '竹', rarity: 'epic', type: 'bolt',
    cd: 7, coeff: 0.45, range: 600, color: '#7fe08d', count: 6, speed: 650, spread: 0.1,
    desc: '六柄青竹蜂云剑成阵而出，每柄造成攻击力 45% 的伤害。'
  },
  {
    id: 'great_geng_array', name: '大庚剑阵', icon: '阵', rarity: 'legendary', type: 'orbit',
    cd: 13, coeff: 0.22, range: 0, radius: 150, color: '#c5f08a', duration: 6, tick: 0.3, count: 5,
    desc: '五道庚金剑气结成剑阵环绕自身，持续斩切靠近的敌人。'
  },
  {
    id: 'zhe_character', name: '者字秘', icon: '者', rarity: 'legendary', type: 'shield',
    cd: 18, coeff: 0, range: 520, shieldPct: 0.28, healPct: 0.18, duration: 9, color: '#e4d5a3',
    desc: '者字秘流转生机，获得相当于 28% 最大生命的护盾，并立即回复 18% 最大生命。'
  },
  {
    id: 'dou_character', name: '斗字秘', icon: '斗', rarity: 'legendary', type: 'nova',
    cd: 12, coeff: 2.9, range: 380, radius: 270, color: '#f1c66d',
    desc: '斗字秘演尽攻伐，震裂四周，造成攻击力 290% 的范围伤害。'
  },
  {
    id: 'great_luo_sword', name: '大罗剑胎', icon: '胎', rarity: 'mythic', type: 'beam',
    cd: 13, coeff: 4.0, range: 700, width: 70, color: '#f7e9b2',
    desc: '大罗剑胎显化，斩出一道贯穿天地的剑光，造成攻击力 400% 的伤害。'
  },
  {
    id: 'buddha_flame_lotus', name: '佛怒火莲', icon: '佛', rarity: 'epic', type: 'strike',
    cd: 11, coeff: 2.7, range: 600, radius: 245, delay: 1.15, color: '#f2a760',
    desc: '数种火焰凝成佛怒火莲，在目标处绽放，造成攻击力 270% 的范围伤害。'
  },
  {
    id: 'great_creation_palm', name: '大天造化掌', icon: '掌', rarity: 'rare', type: 'strike',
    cd: 8, coeff: 2.0, range: 520, radius: 165, delay: 0.5, color: '#c6a56b',
    desc: '一掌落下，造化之力碾碎目标区域，造成攻击力 200% 的范围伤害。'
  },
  {
    id: 'three_thousand_thunder', name: '三千雷动', icon: '三', rarity: 'uncommon', type: 'bolt',
    cd: 4.5, coeff: 0.62, range: 520, color: '#a58cff', count: 3, speed: 700, spread: 0.2,
    desc: '三千雷动化作三缕雷光齐射，每缕造成攻击力 62% 的伤害。'
  },
  {
    id: 'wind_extreme', name: '风之极·陨杀', icon: '风', rarity: 'rare', type: 'beam',
    cd: 7, coeff: 2.1, range: 600, width: 44, color: '#8be0c2',
    desc: '风之极意凝成一线，贯穿直线上的敌人，造成攻击力 210% 的伤害。'
  },
  {
    id: 'five_rings_fire', name: '五轮离火法', icon: '轮', rarity: 'epic', type: 'orbit',
    cd: 10, coeff: 0.2, range: 0, radius: 135, color: '#f58b5b', duration: 5.5, tick: 0.35, count: 5,
    desc: '五轮离火环绕身周，持续灼烧靠近的敌人。'
  },
  {
    id: 'hua_zi_zai', name: '他化自在大法', icon: '化', rarity: 'mythic', type: 'nova',
    cd: 16, coeff: 3.7, range: 450, radius: 360, color: '#f3c3ff',
    desc: '他化自在，万法加身，掀起覆盖大范围的神通风暴，造成攻击力 370% 的伤害。'
  },
  {
    id: 'history_projection', name: '历史投影', icon: '史', rarity: 'legendary', type: 'strike',
    cd: 10, coeff: 2.8, range: 600, radius: 210, delay: 0.6, color: '#c9a7ff',
    desc: '从历史迷雾中召来一片战争投影，造成攻击力 280% 的范围伤害。'
  }
];

const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));

const STARTING_SKILL_IDS = ['shadow_bolt', 'ground_cleave', 'frost_nova', 'bone_shield'];
const SKILL_SLOT_COSTS = [600, 1800, 5000, 12000];
const MAX_SKILL_SLOTS = 8;

/* ------------------------------------------------------------
   转职书品阶、职业与转职天赋
   职业 / 天赋名称取自《诡秘之主》《遮天》《斗破苍穹》《凡人修仙传》
   《吞噬星空》《仙逆》等小说中的职业、序列或神通名称。
   ------------------------------------------------------------ */
const CLASS_BOOK_RANKS = [
  { key: 'huang', label: '黄阶', rank: 0, color: '#c5a66b', soft: 'rgba(197,166,107,.18)', weight: 48.0, mult: 1.0 },
  { key: 'xuan',  label: '玄阶', rank: 1, color: '#8fc8bd', soft: 'rgba(143,200,189,.18)', weight: 26.0, mult: 1.7 },
  { key: 'di',    label: '地阶', rank: 2, color: '#79bd7d', soft: 'rgba(121,189,125,.18)', weight: 14.0, mult: 2.6 },
  { key: 'tian',  label: '天阶', rank: 3, color: '#7fa7e8', soft: 'rgba(127,167,232,.20)', weight: 7.0,  mult: 4.0 },
  { key: 'sheng', label: '圣阶', rank: 4, color: '#c28ce5', soft: 'rgba(194,140,229,.22)', weight: 3.5,  mult: 6.5 },
  { key: 'shen',  label: '神阶', rank: 5, color: '#ffd36e', soft: 'rgba(255,211,110,.26)', weight: 1.5,  mult: 10.0 }
];
const CLASS_BOOK_RANK_BY_KEY = Object.fromEntries(CLASS_BOOK_RANKS.map(r => [r.key, r]));

const CLASSES = [
  {
    id: 'diviner', name: '占卜家', source: '《诡秘之主》', icon: '卜',
    title: '愚者途径 · 序列九', talentName: '占卜',
    flavor: '灵视、卡牌与灵摆，能窥见命运碎片。',
    mods: { dodge: 0.5, crit: 0.5 },
    effect: p => `闪避率 +${nf(0.5 * p)}%　暴击率 +${nf(0.5 * p)}%`
  },
  {
    id: 'clown', name: '小丑', source: '《诡秘之主》', icon: '丑',
    title: '愚者途径 · 序列八', talentName: '危险直觉',
    flavor: '身体强化、危险直觉与技巧型格斗。',
    mods: { attackSpeed: 1.2, moveSpeed: 0.8, dodge: 0.3 },
    effect: p => `攻击速度 +${nf(1.2 * p)}%　移动速度 +${nf(0.8 * p)}%　闪避率 +${nf(0.3 * p)}%`
  },
  {
    id: 'magician', name: '魔术师', source: '《诡秘之主》', icon: '魔',
    title: '愚者途径 · 序列七', talentName: '纸人替身',
    flavor: '纸人替身分担伤害，火焰跳跃来去无踪。',
    mods: { damageReduction: 0.4, dodge: 0.35 },
    effect: p => `受到伤害 -${nf(0.4 * p)}%　闪避率 +${nf(0.35 * p)}%`
  },
  {
    id: 'faceless', name: '无面人', source: '《诡秘之主》', icon: '面',
    title: '愚者途径 · 序列六', talentName: '无面',
    flavor: '改写骨骼、肌肉与皮肤，伪装成任何见过的人。',
    mods: { damageReduction: 0.3, dodge: 0.4 },
    effect: p => `受到伤害 -${nf(0.3 * p)}%　闪避率 +${nf(0.4 * p)}%`
  },
  {
    id: 'puppet_master', name: '秘偶大师', source: '《诡秘之主》', icon: '偶',
    title: '愚者途径 · 序列五', talentName: '秘偶',
    flavor: '制造并操控秘偶，共享感知、分担伤害。',
    mods: { damageReduction: 0.3, thorns: 0.5 },
    effect: p => `受到伤害 -${nf(0.3 * p)}%　反伤 ${nf(0.5 * p)}%`
  },
  {
    id: 'sacred_body', name: '荒古圣体', source: '《遮天》', icon: '体',
    title: '荒古圣体 · 气血如龙', talentName: '荒古圣体',
    flavor: '荒古圣体肉身无双，气血旺盛如真龙。',
    mods: { hpPct: 2, defense: 1.5, thorns: 0.4 },
    effect: p => `生命上限 +${nf(2 * p)}%　防御 +${nf(1.5 * p)}　反伤 ${nf(0.4 * p)}%`
  },
  {
    id: 'source_master', name: '源天师', source: '《遮天》', icon: '源',
    title: '源天师 · 寻源探宝', talentName: '源术',
    flavor: '源术可寻龙脉、探秘宝，见常人所不能见。',
    mods: { goldFind: 7, pickupRadius: 15, allDamage: 0.5 },
    effect: p => `金币获取 +${nf(7 * p)}%　拾取范围 +${nf(15 * p)}　全部伤害 +${nf(0.5 * p)}%`
  },
  {
    id: 'alchemist', name: '炼药师', source: '《斗破苍穹》', icon: '丹',
    title: '斗气大陆 · 炼药师', talentName: '炼药术',
    flavor: '以火属性斗气与灵魂感知炼丹，药力可活死人。',
    mods: { regenPct: 0.1, skillPower: 1.2, hpPct: 0.8 },
    effect: p => `每秒回复 ${nf(0.1 * p)}% 最大生命　技能伤害 +${nf(1.2 * p)}%　生命上限 +${nf(0.8 * p)}%`
  },
  {
    id: 'sword_cultivator', name: '剑修', source: '《凡人修仙传》', icon: '剑',
    title: '青元剑诀 · 剑修', talentName: '青元剑诀',
    flavor: '青竹蜂云剑成，庚金剑气无坚不摧。',
    mods: { crit: 0.6, critDamage: 4 },
    effect: p => `暴击率 +${nf(0.6 * p)}%　暴击伤害 +${nf(4 * p)}%`
  },
  {
    id: 'array_master', name: '阵师', source: '《凡人修仙传》', icon: '阵',
    title: '大庚剑阵 · 阵师', talentName: '大庚剑阵',
    flavor: '以阵驭剑，庚金剑气成阵，斩妖除魔。',
    mods: { skillPower: 1.5, eliteDamage: 1.8 },
    effect: p => `技能伤害 +${nf(1.5 * p)}%　对精英伤害 +${nf(1.8 * p)}%`
  },
  {
    id: 'martial_artist', name: '武者', source: '《吞噬星空》', icon: '武',
    title: '武者 · 九重雷刀', talentName: '九重雷刀',
    flavor: '刀势如雷，九重叠加；武者的路，只问生死。',
    mods: { attackPct: 1.5, attackSpeed: 1.2 },
    effect: p => `攻击力 +${nf(1.5 * p)}%　攻击速度 +${nf(1.2 * p)}%`
  },
  {
    id: 'psychic', name: '精神念师', source: '《吞噬星空》', icon: '念',
    title: '精神念师 · 念力御物', talentName: '精神念力',
    flavor: '以精神念力御物攻伐，念动之间取敌首级。',
    mods: { skillPower: 2, haste: 1.2 },
    effect: p => `技能伤害 +${nf(2 * p)}%　技能急速 +${nf(1.2 * p)}%`
  },
  {
    id: 'ancient_god', name: '古神', source: '《仙逆》', icon: '古',
    title: '仙逆 · 古神之躯', talentName: '古神之躯',
    flavor: '古神肉身不朽，血脉中藏着开天辟地的力量。',
    mods: { hpPct: 2.2, thorns: 0.5 },
    effect: p => `生命上限 +${nf(2.2 * p)}%　反伤 ${nf(0.5 * p)}%`
  }
];
const CLASS_BY_ID = Object.fromEntries(CLASSES.map(c => [c.id, c]));

/* ------------------------------------------------------------
   飞升 · 神域
   神装名称取自斗罗大陆、遮天、完美世界、凡人修仙传、吞噬星空、
   仙逆、诛仙等小说中的神器 / 至宝。
   ------------------------------------------------------------ */
const DIVINE_THREAT_NAMES = [
  '神域·天门', '神域·云海', '神域·神桥', '神域·古战场', '神域·神座', '神域·永恒'
];

const ASCENSION_LEVEL = 30;
const DIVINE_ENEMY_LEVEL_BONUS = 15;

const DIVINE_ITEMS = [
  {
    id: 'xiuluo_mojian', name: '修罗魔剑', slot: 'weapon', source: '《斗罗大陆》',
    lore: '修罗神的神器，主杀伐，剑锋所指，神魔辟易。',
    bonus: { crit: 4, critDamage: 30, lifeSteal: 2 }
  },
  {
    id: 'haishen_trident', name: '海神三叉戟', slot: 'weapon', source: '《斗罗大陆》',
    lore: '海神传承之器，重若山岳，可引动海神之光。',
    bonus: { maxHp: 350, crit: 3, damageReduction: 3 }
  },
  {
    id: 'luocha_scythe', name: '罗刹魔镰', slot: 'weapon', source: '《斗罗大陆》',
    lore: '罗刹神的神器，象征黑暗与死亡，收割生命。',
    bonus: { execute: 15, lifeSteal: 3, attackSpeed: 5 }
  },
  {
    id: 'tianshi_sword', name: '天使圣剑', slot: 'weapon', source: '《斗罗大陆》',
    lore: '天使神的光明之剑，剑光圣洁，净化邪恶。',
    bonus: { attackSpeed: 10, crit: 4, regenPct: 0.5 }
  },
  {
    id: 'daluo_sword_embryo', name: '大罗剑胎', slot: 'weapon', source: '《完美世界》',
    lore: '石昊孕养的剑胎，一剑断万古，锋芒照彻诸天。',
    bonus: { skillPower: 15, critDamage: 30 }
  },
  {
    id: 'qingzhu_swords', name: '青竹蜂云剑', slot: 'weapon', source: '《凡人修仙传》',
    lore: '韩立以金雷竹炼制的七十二口本命飞剑，专克妖魔邪法。',
    bonus: { attackSpeed: 8, skillPower: 10 }
  },
  {
    id: 'xueying_blade', name: '血影战刀', slot: 'weapon', source: '《吞噬星空》',
    lore: '罗峰早期纵横星空的战刀，刀出如血影随形。',
    bonus: { attackSpeed: 12, crit: 3 }
  },
  {
    id: 'zhuxian_sword', name: '诛仙剑', slot: 'weapon', source: '《诛仙》',
    lore: '青云门镇派古剑，诛仙剑阵一旦布下，天地变色。',
    bonus: { skillPower: 12, critDamage: 28 }
  },
  {
    id: 'wushi_bell', name: '无始钟', slot: 'amulet', source: '《遮天》',
    lore: '无始大帝的极道帝兵，钟声一响，万古时空仿佛凝滞。',
    bonus: { defense: 80, damageReduction: 8, maxHp: 400 }
  },
  {
    id: 'wanwu_cauldron', name: '万物母气鼎', slot: 'amulet', source: '《遮天》',
    lore: '以万物母气铸成的帝兵，镇压气运，承载万物。',
    bonus: { attackPct: 10, hpPct: 8, damageReduction: 5 }
  },
  {
    id: 'zhangtian_bottle', name: '掌天瓶', slot: 'amulet', source: '《凡人修仙传》',
    lore: '可催熟灵药、汲取时间之力的仙界至宝，伴随韩立一生。',
    bonus: { regenPct: 1.2, xpBonus: 35, goldFind: 35 }
  },
  {
    id: 'xutian_cauldron', name: '虚天鼎', slot: 'armor', source: '《凡人修仙传》',
    lore: '乱星海第一至宝，困敌与防御皆妙用无穷。',
    bonus: { defense: 100, damageReduction: 8, maxHp: 600 }
  },
  {
    id: 'xingchen_tower', name: '星辰塔', slot: 'armor', source: '《吞噬星空》',
    lore: '罗峰所持至宝，星辰之力层层环绕，可镇可防。',
    bonus: { defense: 120, thorns: 30, maxHp: 500 }
  },
  {
    id: 'gushen_armor', name: '古神皮甲', slot: 'armor', source: '《仙逆》',
    lore: '八星古神罗尘外皮炼制，防御术法与空间侵蚀的至宝。',
    bonus: { hpPct: 15, damageReduction: 7, thorns: 20 }
  },
  {
    id: 'haishen_raiment', name: '海神神装', slot: 'armor', source: '《斗罗大陆》',
    lore: '海神传承的神装，穿戴者受海神之光庇护。',
    bonus: { hpPct: 12, defense: 60, damageReduction: 6 }
  },
  {
    id: 'tianni_pearl', name: '天逆珠', slot: 'ring', source: '《仙逆》',
    lore: '王林逆转命运的至宝，持之者可在绝境中重来一次。',
    bonus: { reviveCharges: 1, maxHp: 300, crit: 3 }
  }
];

/* ------------------------------------------------------------
   Monsters
   ------------------------------------------------------------ */
const ENEMY_TYPES = {
  skeleton: {
    id: 'skeleton', name: '骸骨守卫', hp: 1.0, dmg: 1.0, speed: 74, radius: 16,
    xp: 1.0, gold: 1.0, behavior: 'melee', attackInterval: 1.15, color: '#b9b29c'
  },
  bat: {
    id: 'bat', name: '腐翼蝠', hp: 0.62, dmg: 0.72, speed: 126, radius: 12,
    xp: 0.8, gold: 0.8, behavior: 'melee', attackInterval: 0.85, flying: true, color: '#8f6666'
  },
  spider: {
    id: 'spider', name: '墓穴蛛', hp: 0.82, dmg: 0.9, speed: 96, radius: 15,
    xp: 0.95, gold: 0.9, behavior: 'melee', attackInterval: 1.0, color: '#6d7c63'
  },
  acolyte: {
    id: 'acolyte', name: '邪教徒', hp: 1.08, dmg: 1.05, speed: 58, radius: 16,
    xp: 1.12, gold: 1.15, behavior: 'ranged', attackInterval: 2.1, projectileSpeed: 260, color: '#9b6cae'
  },
  wraith: {
    id: 'wraith', name: '怨灵', hp: 0.76, dmg: 1.18, speed: 88, radius: 15,
    xp: 1.15, gold: 1.1, behavior: 'ranged', attackInterval: 1.8, projectileSpeed: 300, flying: true, color: '#7078b8'
  },
  golem: {
    id: 'golem', name: '石像鬼', hp: 2.3, dmg: 1.55, speed: 45, radius: 23,
    xp: 1.65, gold: 1.6, behavior: 'melee', attackInterval: 1.6, color: '#707a7e'
  }
};

const ENEMY_TYPE_LIST = Object.values(ENEMY_TYPES);

const BOSS_TYPES = [
  {
    id: 'bone_tyrant', name: '骸骨暴君', title: '第一墓室的旧王', base: 'skeleton',
    hp: 15.5, dmg: 2.15, radius: 34, color: '#e2c98f', aura: '#e7bd6f',
    pattern: 'radial', summon: 'skeleton'
  },
  {
    id: 'abyss_bishop', name: '深渊主教', title: '无光圣堂的执礼者', base: 'acolyte',
    hp: 12.5, dmg: 2.05, radius: 32, color: '#c188df', aura: '#b469e7',
    pattern: 'radial', summon: 'acolyte'
  },
  {
    id: 'spider_queen', name: '噬魂蛛后', title: '编织墓网者', base: 'spider',
    hp: 14.5, dmg: 2.0, radius: 34, color: '#a4c37e', aura: '#b4dc73',
    pattern: 'radial', summon: 'spider'
  },
  {
    id: 'molten_colossus', name: '熔岩魔像', title: '沉眠的地心之怒', base: 'golem',
    hp: 20, dmg: 2.45, radius: 40, color: '#dc8a64', aura: '#f07045',
    pattern: 'slam', summon: 'golem'
  },
  {
    id: 'faceless_watcher', name: '无面守夜人', title: '深渊尽头的提灯者', base: 'wraith',
    hp: 13.5, dmg: 2.25, radius: 33, color: '#91a2f0', aura: '#6779e4',
    pattern: 'radial', summon: 'wraith'
  }
];

/* ------------------------------------------------------------
   Flavor text
   ------------------------------------------------------------ */
const LORE_TIPS = [
  '地牢没有墙。或者说，墙一直在向更深处生长。',
  '火把照亮的范围，就是世界暂时承认的范围。',
  '越深处的怪物，越记得你的名字。',
  '装备会腐朽，天赋不会。',
  '有人说深渊尽头有一扇门。没人说门后是什么。',
  '金币是死者的语言。你正在变得很健谈。',
  '每一颗天赋宝珠，都是一位前辈留下的遗言。',
  '你听见钟声了吗？那说明领主醒了。'
];

const THREAT_NAMES = [
  '微光浅层', '朽骨回廊', '泣血墓道', '无光深渊', '古神废都', '永夜之底'
];

/* ============================================================
   圣域版本 · 深度层数 / 词缀 / 宠物 / 坐骑 / 圣器 / 任务
   ============================================================ */
const LAYER_SIZE = 500;
const LAYER_HP_MULT = 5;
const LAYER_ATK_MULT = 2;
const LAYER_XP_MULT = 1.5;
const LAYER_DROP_MULT = 1.2;
const LAYER_DROP_CAP = 0.90;

const SANCTUARY_LEVEL = 100;
const MAX_PLAYER_LEVEL = 100;
const SANCTUARY_BASE_LEVEL = 100;
const SANCTUARY_ENEMY_BONUS = 30;
const SANCTUARY_THREAT_NAMES = [
  '圣域·边境', '圣域·残神道', '圣域·血河', '圣域·神陨原', '圣域·天门关', '圣域·永恒王座'
];

const PET_DROP = { normal: 0.03, elite: 0.15, boss: 1.0 };
const MOUNT_DROP = { normal: 0.02, elite: 0.10, boss: 1.0 };
const RELIC_CD_PER_SHARD = 0.02;
const RELIC_CD_CAP = 0.50;

const MONSTER_AFFIXES = {
  sharp:   { id: 'sharp', name: '锋利', color: '#e8a765', desc: '攻击 +30%' },
  hard:    { id: 'hard', name: '坚硬', color: '#9fb0bd', desc: '防御 +40%' },
  swift:   { id: 'swift', name: '迅捷', color: '#8fd0c2', desc: '移速 +25%' },
  berserk: { id: 'berserk', name: '狂暴', color: '#e06d60', desc: '生命低于 30% 时攻击翻倍' },
  lifesteal: { id: 'lifesteal', name: '吸血', color: '#c46f86', desc: '造成伤害的 20% 转为生命' },
  reflect: { id: 'reflect', name: '反伤', color: '#d4a05e', desc: '反弹受到伤害的 15%' },
  split:   { id: 'split', name: '分裂', color: '#9a8fd0', desc: '死亡时分裂为 2 个小怪' },
  elemental: { id: 'elemental', name: '元素', color: '#e0b56b', desc: '攻击附带元素伤害' }
};

const PET_DEFS = [
  {
    id: 'gudiao', name: '蛊雕', icon: '雕', color: '#d8b06b',
    shape: 'beast', activeName: '裂空啄', passiveName: '无',
    desc: '豹身鹰喙、头生一角。单体 3 倍攻击，并撕裂目标 3 秒。',
    active: { type: 'gudiao', cd: 6, mult: 3, bleed: 0.5, bleedTime: 3 }
  },
  {
    id: 'qiongqi', name: '穷奇', icon: '穷', color: '#cf8b74',
    shape: 'winged_tiger', activeName: '黑夜突袭', passiveName: '无',
    desc: '虎形生双翼。瞬移至血量最低敌人身后，造成 2.5 倍攻击并沉默 1.5 秒。',
    active: { type: 'qiongqi', cd: 8, mult: 2.5, silence: 1.5 }
  },
  {
    id: 'luwu', name: '陆吾', icon: '陆', color: '#d9c38d',
    shape: 'tiger', activeName: '无', passiveName: '昆仑守护',
    desc: '虎身九尾、人面虎爪。防御 +10%；生命低于 30% 时再 +10%。',
    passive: { type: 'luwu', defensePct: 10, lowHpDefensePct: 10 }
  },
  {
    id: 'yingzhao', name: '英招', icon: '英', color: '#94c8b0',
    shape: 'horse_bird', activeName: '无', passiveName: '天驭之风',
    desc: '马身虎纹、背生鸟翼。移速 +8%，攻速 +5%。',
    passive: { type: 'yingzhao', moveSpeed: 8, attackSpeed: 5 }
  },
  {
    id: 'luanniao', name: '鸾鸟', icon: '鸾', color: '#e5a6b1',
    shape: 'phoenix', activeName: '涅槃祝福', passiveName: '涅槃',
    desc: '五彩灵羽。获得护盾，并在受到致命伤害时自动复活回满（每场战斗限 1 次）。',
    active: { type: 'luanniao', cd: 18, shieldPct: 0.20 },
    passive: { type: 'luanniao', reviveOnce: true }
  }
];

const MOUNT_DEFS = [
  {
    id: 'yinglong', name: '应龙', icon: '应', color: '#8ab8e0', shape: 'dragon', flying: true,
    activeName: '龙啸九天', passiveName: '无',
    desc: '飞行坐骑。周围敌人受到 2 倍攻击并眩晕 1.5 秒（半径 240）。',
    active: { type: 'yinglong', cd: 12, mult: 2, stun: 1.5, radius: 240 }
  },
  {
    id: 'longma', name: '龙马', icon: '龙', color: '#c9a66b', shape: 'horse', flying: false,
    activeName: '奔雷冲撞', passiveName: '无',
    desc: '地面坐骑。直线冲撞 2 秒，路径敌人每 0.2 秒受到 1 倍攻击。',
    active: { type: 'longma', cd: 14, mult: 1, duration: 2, tick: 0.2 }
  },
  {
    id: 'luduan', name: '甪端', icon: '甪', color: '#b7a076', shape: 'deer', flying: false,
    activeName: '无', passiveName: '瑞威',
    desc: '地面坐骑。骑乘状态下全伤害 +15%。',
    passive: { type: 'luduan', allDamage: 15 }
  },
  {
    id: 'feilian', name: '飞廉', icon: '廉', color: '#8fd0c2', shape: 'bird', flying: true,
    activeName: '风行绝', passiveName: '无',
    desc: '飞行坐骑。3 秒内移速 +100%、无视碰撞体积并免疫减速。',
    active: { type: 'feilian', cd: 15, duration: 3 }
  }
];

const RELIC_DEFS = [
  {
    id: 'zhuxian', name: '诛仙剑', icon: '诛', color: '#f1c66d',
    title: '输出天花板', activeName: '诛仙·灭世',
    passiveText: '攻击 +50%；对精英与领主伤害额外 +100%。',
    activeText: '全屏斩出一剑，造成 20 倍攻击；低血敌人斩杀，领主额外承受 10 倍。',
    cd: 20, passive: { attackPct: 50, eliteDamage: 100, bossDamage: 100 }
  },
  {
    id: 'xuantian', name: '玄天塔', icon: '玄', color: '#9db7d5',
    title: '绝对防御', activeName: '镇岳·不动',
    passiveText: '生命 +100%，防御 +60%；免疫眩晕、冰冻、沉默、撕裂、灼烧。',
    activeText: '10 秒免疫伤害，每秒对周围敌人造成自身最大生命 10% 的真实伤害。',
    cd: 30, passive: { hpPct: 100, defensePct: 60, immuneStatus: true }
  },
  {
    id: 'hundun', name: '混沌钟', icon: '混', color: '#c9a7ff',
    title: '暴击爆发', activeName: '钟鸣·寂灭',
    passiveText: '暴击率 +30%（突破上限），暴击伤害 +150%；暴击无视 50% 防御。',
    activeText: '10 秒内每次暴击追加 5 倍真实伤害；暴击使本技能冷却 -0.5 秒。',
    cd: 25, passive: { crit: 30, critDamage: 150, critPen: 0.5 }
  },
  {
    id: 'shennong', name: '神农鼎', icon: '神', color: '#8fd0a0',
    title: '不死回复', activeName: '百草·起死回生',
    passiveText: '每秒回复 15% 最大生命，受治疗效果 +100%；低血自动无敌 2 秒。',
    activeText: '立即回满生命；8 秒内致命伤害自动复活，最多 3 次。',
    cd: 25, passive: { regenPct: 15, healingPct: 100, lowHpInvuln: true }
  },
  {
    id: 'shanhe', name: '山河社稷图', icon: '山', color: '#e0c58b',
    title: '控制 / 刷怪领域', activeName: '画地为牢·山河颠倒',
    passiveText: '移速 +30%，经验获取 +100%，掉落品质概率 +30%。',
    activeText: '展开 20 米结界 8 秒；敌人定身并每秒受 5 倍攻击，自身免疫伤害且移速 +50%。',
    cd: 30, passive: { moveSpeed: 30, xpBonus: 100, dropQuality: 30 }
  }
];

const RELIC_BY_ID = Object.fromEntries(RELIC_DEFS.map(r => [r.id, r]));
const PET_BY_ID = Object.fromEntries(PET_DEFS.map(p => [p.id, p]));
const MOUNT_BY_ID = Object.fromEntries(MOUNT_DEFS.map(m => [m.id, m]));

const FINAL_BOSS_DEF = {
  id: 'tiandi_phantom', name: '天帝虚影', title: '神域最终领主 · 未散的帝威',
  base: 'wraith', hp: 26, dmg: 2.8, radius: 46,
  color: '#f3d9a2', aura: '#ffe2a3', pattern: 'radial', summon: 'wraith'
};

const SANCTUARY_QUESTS = [
  {
    step: 0, title: '第一环 · 天降异象', npc: '天机阁阁主',
    objective: '达到 Lv.100，击败神域最终领主「天帝虚影」，拾取天帝怨念结晶。',
    reward: '经验 500 万 / 金币 10 万 / 残破的虚空地图',
    text: '天帝虚影已散，然其怨念未消，正沿虚空裂隙渗漏至人间。那不是地震，是圣域的门，正在为你开一条缝。'
  },
  {
    step: 1, title: '第二环 · 寻踪引路者', npc: '虚空地图',
    objective: '前往神域三处死路尽头，依次触摸断剑崖、枯骨原、沉没之门。',
    reward: '经验 800 万 / 虚空坐标·三',
    text: '引路人不在城中，不在云上，在你走过的每一条死路尽头。'
  },
  {
    step: 2, title: '第三环 · 圣域试炼', npc: '圣域引路人',
    objective: '进入圣域门槛，连续击败三波幻象。',
    reward: '经验 1500 万 / 引路人的斗篷 / 称号「跨过门槛的人」',
    text: '圣域不是给活人走的地方。你若连我的三问都接不住，进去不过是多一具骸骨。'
  },
  {
    step: 3, title: '第四环 · 圣域之门', npc: '圣域引路人',
    objective: '进入圣域，在第 1 层击杀 1 只精英怪，然后返回复命。',
    reward: '经验 2000 万 / 金币 20 万 / 圣域入口 / 圣器 / 宠物 / 坐骑',
    text: '这扇门，从今往后只为你一人开。愿你在圣域，杀得尽兴。'
  }
];

const QUEST_LOCATIONS = [
  { id: 'duanjian', name: '神域东境·断剑崖', x: 1800, y: -500, color: '#c9a7ff' },
  { id: 'kugu', name: '神域西境·枯骨原', x: -1600, y: 900, color: '#d8b06b' },
  { id: 'chenmo', name: '神域北境·沉没之门', x: 300, y: -1900, color: '#8fd0c2' }
];

const SOUL_REBIRTH = {
  first: 100,
  later: 50,
  threshold: 10
};
