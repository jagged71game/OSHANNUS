export const chapters = {

  1: { title: 'The Tide Shrine', subtitle: 'CHAPTER I · THE SIXTH GATE', enemy: 'SHRINE GUARDIAN', hp: 96, quick: [4, 8], heavy: [15, 21], objective: 'Subdue the guardian. Preserve the shrine.' },

  2: { title: 'The Broken Causeway', subtitle: 'CHAPTER II · THE CORRUPTION SPREADS', enemy: 'CHAOS RIFTBLADE', hp: 76, quick: [3, 6], heavy: [16, 22], objective: 'Face the deception. Clear the causeway.' },

  3: { title: 'The Drowned Archive', subtitle: 'CHAPTER III - THE MEMORY SHRINE', enemy: 'MNEMONIC KEEPER', hp: 112, quick: [4, 7], heavy: [16, 22], objective: 'Free the keeper. Preserve the memories.' },
  6: { title: 'The Palace of Bone', subtitle: 'CHAPTER VI - THE NIGHTMARE IN BONE', enemy: 'DJINN MUIRAT', hp: 100, quick: [4, 7], heavy: [18, 25], objective: 'Sever Muirat’s hold. Seal the breach.' },
  5: { title: 'The Gate Below', subtitle: 'CHAPTER V - THE SIXTH GATE FOUNDATIONS', enemy: 'CHAOS-BOUND WARDEN', hp: 160, quick: [4, 7], heavy: [17, 23], objective: 'Break the Chaos binding. Hold the sixth gate.' },
  4: { title: 'The Hollow Sanctuary', subtitle: 'CHAPTER IV · A REFUGE BROKEN', enemy: 'HOLLOW SENTINEL', hp: 124, quick: [4, 7], heavy: [17, 23], objective: 'Break the sentinel. Release the captive spirits.' },
};

export const actions = {

  strike: { name: 'Tidal Strike', cost: 0, range: [9, 15] },

  shield: { name: 'Water Shield', cost: 2 },

  wave: { name: 'Surging Wave', cost: 4, range: [18, 26] },

  relic: { name: 'Renewing Tide', cost: 3 },

  interrupt: { name: 'Riptide', cost: 3, range: [6, 10] },

};

export function fresh(chapter = 1, hp = 40, journey = {}) {

  const difficulty = journey.difficulty === 'hard' ? 'hard' : 'normal';

  return { difficulty, finalPower: ['breaker','renewal'].includes(journey.finalPower) ? journey.finalPower : null, healCharges: chapter === 6 && journey.finalPower === 'renewal' ? 2 : 1, armor: chapter === 6 ? 28 : 0, fieldFractured: false, chapter, hp, mana: 8, enemy: chapters[chapter].hp, turn: 1, phase: 'gathering', relic: true, shield: false, status: 'playing', weaponBonus: 0, interrupted: false, mirror: chapter === 2 || chapter === 5, bossStage: 1, gateRest: ['rest', 'resolve'].includes(journey.gateRest) ? journey.gateRest : null, remembered: null, awakened: false, disrupted: false, consumed: 0, freed: 0, spiritFreed: false, respite: ['drink', 'blessing'].includes(journey.respite) ? journey.respite : null, upgrade: ['rising', 'sheltering'].includes(journey.upgrade) ? journey.upgrade : null, renovaUsed: journey.renovaUsed === true };

}

export function allowed(s, a) {

  return s.status === 'playing' && !!actions[a] && s.mana >= actions[a].cost && (a !== 'relic' || s.relic) && (a !== 'interrupt' || s.chapter >= 2);

}

export function roll([min, max], random = Math.random) {

  return min + Math.floor(Math.max(0, Math.min(1 - Number.EPSILON, random())) * (max - min + 1));

}

export function damageRange(s, a) {

  const range = actions[a]?.range;

  if (!range) return null;

  const multiplier = s.phase === 'exposed' && (s.chapter === 1 || s.chapter === 5 && s.bossStage === 1) ? 2 : 1;

  return range.map(value => (value + s.weaponBonus + (s.chapter >= 3 && s.upgrade === 'rising' && a === 'wave' ? 5 : 0)) * multiplier);

}

export function playerTurn(state, a, random = Math.random) {

  const s = { ...state };

  if (!allowed(s, a)) return { state: s, event: null };

  s.mana -= actions[a].cost; s.shield = false;

  let damage = 0, heal = 0, baseRoll = 0;

  const bonus = actions[a].range ? s.weaponBonus + (s.chapter >= 3 && s.upgrade === 'rising' && a === 'wave' ? 5 : 0) : 0;

  if (actions[a].range) { baseRoll = roll(actions[a].range, random); damage = baseRoll + bonus; }

  if (a === 'strike') s.mana = Math.min(8, s.mana + 2);

  if (a === 'shield') s.shield = true;

  if (a === 'relic') { heal = Math.min(s.chapter === 4 && s.respite === 'blessing' ? 24 : 14, 40 - s.hp); s.hp += heal; s.healCharges = Math.max(0,s.healCharges-1); s.relic = s.healCharges > 0; }
  const bindingRescue = s.chapter === 5 && s.bossStage === 2;
  let freedSpirit = (s.chapter === 4 || bindingRescue) && s.phase === 'consume' && a === 'interrupt' && !s.spiritFreed;

  let absorbed = false, evaded = false;

  if (damage && (s.chapter === 2 || s.chapter === 5 && s.bossStage === 1)) {

    if (s.mirror) { absorbed = true; s.mirror = false; damage = 0; }

    else if (s.phase !== 'exposed' && random() < .2) { evaded = true; damage = 0; }

  }

  const remembers = s.chapter === 3 || bindingRescue;
  const warded = remembers && damage > 0 && s.remembered === a;
  if (warded) damage = Math.max(1, Math.floor(damage * .25));
  if (remembers && actions[a].range) s.remembered = a;
  freedSpirit = freedSpirit && !warded;
  if (freedSpirit) { s.spiritFreed = true; s.freed++; heal = Math.min(8, 40 - s.hp); s.hp += heal; }

  let forcefield = false, armorDamage = 0, armorBroken = false, armorMana = 0;
  if (s.chapter === 6 && damage > 0) {
    forcefield = s.phase !== 'exposed' && !s.fieldFractured && damage >= 18;
    if (forcefield) damage = 4;
    const oldArmor = s.armor;
    armorDamage = Math.min(oldArmor,damage + (a === 'interrupt' && s.finalPower === 'breaker' ? 10 : 0));
    if (armorDamage && a === 'interrupt' && s.finalPower === 'breaker') { armorMana = Math.min(2,8-s.mana); s.mana += armorMana; }
    s.armor -= armorDamage; damage = Math.max(0,damage-oldArmor);
    armorBroken = oldArmor > 0 && s.armor === 0;
    if (armorBroken && a === 'interrupt') s.fieldFractured = true;
  }

  if (a === 'interrupt' && s.chapter !== 4 && s.chapter !== 6 && !warded && damage > 0 && s.phase === 'heavy') {
    if (s.chapter === 3 && s.awakened || bindingRescue) s.disrupted = true;
    else s.interrupted = true;
  }

  if (s.chapter === 6 && a === 'interrupt' && s.phase === 'heavy' && s.armor === 0) s.disrupted = true;
  const exposed = s.phase === 'exposed' && (s.chapter === 1 || s.chapter === 5 && s.bossStage === 1);

  if (exposed) damage *= 2;

  if (s.chapter === 5 && s.bossStage === 1) damage = Math.min(damage, s.enemy - 80);
  s.enemy = Math.max(0, s.enemy - damage);

  if (!s.enemy) s.status = 'won';

  return { state: s, event: { action: a, armorMana, forcefield, armorDamage, armorBroken, damage, heal, freedSpirit, baseRoll, bonus, range: actions[a].range, exposed, absorbed, evaded, warded, disrupted: s.disrupted, interrupted: s.interrupted } };

}

export function enemyTurn(state, random = Math.random) {

  const s = { ...state };

  if (s.status !== 'playing') return { state: s, event: null };

  const phase = s.phase, c = chapters[s.chapter];

  // Crossing the threshold replaces the enemy's turn with a visible phase change.
  // It cannot skip phase two or spend a second heal/rescue on reload.
  if (s.chapter === 5 && s.bossStage === 1 && s.enemy <= 80) {
    s.bossStage = 2; s.phase = 'gathering'; s.mirror = false; s.remembered = null;
    s.shield = false; s.interrupted = false; s.disrupted = false; s.turn++;
    const resolveHeal = s.gateRest === 'resolve' ? Math.min(12, 40 - s.hp) : 0;
    s.hp += resolveHeal; s.mana = Math.min(8, s.mana + 1 + (s.gateRest === 'resolve' ? 2 : 0));
    return {state:s,event:{stageChanged:true,resolveHeal,damage:0,phase,blocked:false,interrupted:false}};
  }
  const gateUnbound = s.chapter === 5 && s.bossStage === 2;
  const deceptive = s.chapter === 2 || s.chapter === 5 && s.bossStage === 1;
  const range = phase === 'gathering' ? c.quick : phase === 'heavy' ? c.heavy : (s.chapter === 4 || gateUnbound) && phase === 'consume' ? [3, 6] : null;

  const empoweredRange = range && s.chapter === 3 && s.awakened ? range.map(n => n + (phase === 'heavy' ? 2 : 1)) : range && s.chapter === 4 ? range.map(n => n + (phase === 'heavy' ? s.consumed * 5 : 0) + (s.awakened ? 2 : 0)) : range && gateUnbound ? range.map(n => n + (phase === 'heavy' ? s.consumed * 4 + 1 : 0)) : range && s.chapter === 6 && s.awakened ? range.map(n => n + (phase === 'heavy' ? 3 : 1)) : range;
  const baseRoll = empoweredRange && !s.interrupted ? roll(empoweredRange, random) : 0;
  const impact = s.disrupted ? Math.ceil(baseRoll * .6) : baseRoll;

  const echoRoll = baseRoll && deceptive && s.mirror ? roll([3, 5], random) : 0;

  const damage = s.shield ? Math.ceil(impact * .2) + Math.ceil(echoRoll * .2) : impact + echoRoll;

  if (deceptive && phase === 'exposed') s.mirror = true;

  const stolenHealth = (s.chapter === 3 || gateUnbound) && phase === 'gathering' ? Math.min(s.hp, damage) : 0;
  const enemyHeal = Math.min(gateUnbound ? Math.ceil(stolenHealth / 2) : stolenHealth, (gateUnbound ? 80 : c.hp) - s.enemy);
  s.enemy += enemyHeal;
  s.hp = Math.max(0, s.hp - damage); s.shield = false; s.interrupted = false; s.disrupted = false;

  const drained = (s.chapter === 3 || gateUnbound) && phase === 'gathering' && !state.shield ? Math.min(gateUnbound ? 1 : 2, s.mana) : 0;
  s.mana = Math.min(8, s.mana - drained + 1);

  const consumedSpirit = (s.chapter === 4 || gateUnbound) && phase === 'consume' && !s.spiritFreed;
  if (consumedSpirit) s.consumed = Math.min(3, s.consumed + 1);
  if ((s.chapter === 4 || gateUnbound) && phase === 'consume') s.spiritFreed = false;
  s.phase = phase === 'gathering' ? (s.chapter === 4 || gateUnbound ? 'consume' : 'heavy') : phase === 'consume' ? 'heavy' : phase === 'heavy' ? 'exposed' : 'gathering';

  let armorRestored = 0;
  if (s.chapter === 6 && phase === 'exposed') {
    armorRestored = Math.min(s.awakened ? 12 : 8,28-s.armor); s.armor += armorRestored; s.fieldFractured = false;
  }
  s.turn++;

  const rescued = s.hp === 0 && !s.renovaUsed;
  let shieldHeal = 0;
  if (rescued) { s.renovaUsed = true; s.hp = 18; s.mana = Math.min(8, s.mana + 2); }
  else if (!s.hp) s.status = 'lost';
  else if (s.chapter >= 3 && s.upgrade === 'sheltering' && state.shield && damage > 0) { shieldHeal = Math.min(3, 40 - s.hp); s.hp += shieldHeal; }

  // The earthquake can steal one recovery opening, never chain extra attacks.
  const earthquake = s.chapter === 6 && phase === 'heavy';
  const stunned = earthquake && !state.shield && damage > 0 && !rescued && s.status === 'playing' && random() < .3;
  if (stunned) {
    armorRestored = Math.min(s.awakened ? 12 : 8, 28-s.armor);
    s.armor += armorRestored; s.fieldFractured = false;
    s.phase = 'gathering'; s.turn++; s.mana = Math.min(8,s.mana+1);
  }

  const awakenedNow = [3, 4, 6].includes(s.chapter) && !s.awakened && s.enemy <= c.hp / 2 && s.status === 'playing';
  if (awakenedNow) s.awakened = true;
  return { state: s, event: { earthquake, stunned, armorRestored, damage, baseRoll, echoRoll, drained, stolenHealth, enemyHeal, consumedSpirit, rescued, shieldHeal, awakenedNow, disrupted: state.disrupted, phase, blocked: state.shield, interrupted: state.interrupted } };

}

export function choose(s) {
  if (s.chapter === 6) {
    if (s.phase === 'heavy' && allowed(s,'shield')) return 'shield';
    if (s.hp <= 23 && allowed(s,'relic')) return 'relic';
    if (s.phase === 'exposed' && allowed(s,'wave')) return 'wave';
    if (s.armor > 0 && s.finalPower === 'breaker' && s.phase === 'gathering' && s.mana >= 6) return 'interrupt';
    return 'strike';
  }
  if (s.chapter === 5) {
    if (s.bossStage === 1 && s.phase === 'heavy' && !s.mirror && s.hp > 23 && allowed(s,'interrupt')) return 'interrupt';
    if (s.phase === 'heavy' && allowed(s,'shield')) return 'shield';
    if (s.hp <= 18 && allowed(s,'relic')) return 'relic';
    if (s.bossStage === 1) return s.phase === 'exposed' && allowed(s,'wave') ? 'wave' : 'strike';
    if (s.phase === 'consume' && s.remembered !== 'interrupt' && allowed(s,'interrupt')) return 'interrupt';
    if (s.phase === 'gathering' && s.mana >= 5) return 'shield';
    if (s.phase === 'exposed' && s.remembered !== 'wave' && s.mana >= 6) return 'wave';
    if (s.remembered === 'strike' && allowed(s,'wave')) return 'wave';
    return 'strike';
  }
  if (s.chapter === 4) {
    if (s.phase === 'heavy' && allowed(s, 'shield')) return 'shield';
    if (s.hp <= (s.respite === 'blessing' ? 16 : 22) && allowed(s, 'relic')) return 'relic';
    if (s.phase === 'consume' && allowed(s, 'interrupt')) return 'interrupt';
    if (s.phase === 'exposed' && s.mana >= 6) return 'wave';
    return 'strike';
  }
  if (s.chapter === 3) {
    if (s.phase === 'heavy') {
      if (!s.awakened && s.remembered !== 'interrupt' && allowed(s, 'interrupt')) return 'interrupt';
      if (allowed(s, 'shield')) return 'shield';
    }
    if (s.hp <= 18 && allowed(s, 'relic')) return 'relic';
    if (s.phase === 'gathering' && s.mana >= 5) return 'shield';
    if (s.phase === 'exposed' && s.remembered !== 'wave' && allowed(s, 'wave')) return 'wave';
    if (s.remembered === 'strike' && s.mana === 8 && allowed(s, 'wave')) return 'wave';
    return 'strike';
  }

  if (s.phase === 'heavy') {

    if (s.chapter === 2 && !s.mirror && s.hp > 22 && allowed(s, 'interrupt')) return 'interrupt';

    if (allowed(s, 'shield')) return 'shield';

  }

  if (s.hp <= 20 && allowed(s, 'relic')) return 'relic';

  if (s.phase === 'exposed' && allowed(s, 'wave')) return 'wave';

  return 'strike';

}

export function checkpoint(chapter, entryHp, stage = 'battle', hp = entryHp, journey = {}) {

  return { version: 6, difficulty: journey.difficulty === 'hard' ? 'hard' : 'normal', finalPower: journey.finalPower || null, gateRest: journey.gateRest || null, chapter, entryHp, stage, hp, respite: journey.respite || null, upgrade: journey.upgrade || null, renovaUsed: journey.renovaUsed === true };

}

export function readCheckpoint(raw) {

  try {

    const c = JSON.parse(raw);

    if (![1, 2, 3, 4, 5, 6].includes(c?.version) || ![1, 2, 3, 4, 5, 6].includes(c.chapter) || !['battle', 'aftermath', 'complete'].includes(c.stage)) return null;
    if (c.version < 6) c.difficulty = 'normal';
    else if (!['normal', 'hard'].includes(c.difficulty)) return null;

    if (![c.entryHp, c.hp].every(n => Number.isInteger(n) && n >= 1 && n <= 40)) return null;

    if (c.stage === 'aftermath' && ![1, 2, 3, 4, 5].includes(c.chapter) || c.stage === 'complete' && ![2, 3, 4, 5, 6].includes(c.chapter)) return null;
    // Completed causeway saves from earlier releases lead into the new chapter.
    if ([2, 3, 4, 5].includes(c.chapter) && c.stage === 'complete') c.stage = 'aftermath';

    if (c.upgrade != null && !['rising', 'sheltering'].includes(c.upgrade)) return null;
    if (c.renovaUsed != null && typeof c.renovaUsed !== 'boolean') return null;
    if (c.respite != null && !['drink', 'blessing'].includes(c.respite)) return null;
    if (c.chapter === 4 && !c.respite) return null;
    if (c.gateRest != null && !['rest','resolve'].includes(c.gateRest)) return null;
    if (c.chapter === 5 && !c.gateRest) return null;
    if (c.finalPower != null && !['breaker','renewal'].includes(c.finalPower)) return null;
    if (c.chapter === 6 && !c.finalPower) return null;
    // Existing archive battle entries receive the newly added respite once.
    if (c.chapter === 3 && c.stage === 'battle' && !c.upgrade) { c.chapter = 2; c.stage = 'aftermath'; c.hp = c.entryHp; }
    return checkpoint(c.chapter, c.entryHp, c.stage, c.hp, c);

  } catch { return null; }

}

export function nextChapter(winner) {

  if (![1, 2, 3, 4, 5].includes(winner.chapter) || winner.status !== 'won') throw Error('Clear the current chapter before continuing.');

  if (winner.chapter === 2 && !['rising', 'sheltering'].includes(winner.upgrade)) throw Error('Choose a power before leaving the respite.');
  if (winner.chapter === 3 && !['drink', 'blessing'].includes(winner.respite)) throw Error('Choose how to use the spring.');
  if (winner.chapter === 5) {
    if (!['breaker','renewal'].includes(winner.finalPower)) throw Error('Choose your final refinement.');
    return fresh(6,40,winner);
  }
  if (winner.chapter === 4) {
    if (!['rest','resolve'].includes(winner.gateRest)) throw Error('Choose your resolve before descending.');
    return fresh(5, winner.gateRest === 'rest' ? 40 : Math.min(40,winner.hp+24), winner);
  }
  return fresh(winner.chapter + 1, winner.chapter === 2 ? 40 : Math.min(40, winner.hp + (winner.chapter === 3 && winner.respite === 'drink' ? 20 : 8)), winner);

}

