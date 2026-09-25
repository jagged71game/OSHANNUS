import { fresh, actions, allowed, playerTurn, enemyTurn, choose, chapters, checkpoint, readCheckpoint, nextChapter } from './battle.mjs';
import { createSound } from './audio.mjs';
import { createMusic } from './music.mjs';

const sound=createSound();
const music=createMusic();
const audioControls=document.createElement('details');
audioControls.className='audio-controls';
audioControls.innerHTML='<summary>Sound</summary><div><button id="soundToggle" type="button"></button><label for="soundVolume">Effects volume</label><input id="soundVolume" type="range" min="0" max="100" step="5"><button id="soundTest" type="button">Test sound</button></div>';
document.body.append(audioControls);
audioControls.querySelector('div').insertAdjacentHTML('beforeend','<hr><button id="musicToggle" type="button"></button><label for="musicVolume">Music volume</label><input id="musicVolume" type="range" min="0" max="100" step="5"><small>The Returning Tide · original score</small>');
const musicToggle=document.getElementById('musicToggle'),musicVolume=document.getElementById('musicVolume');
function renderMusic(){musicToggle.textContent=music.muted?'Play music':'Mute music';musicToggle.setAttribute('aria-pressed',String(music.muted));musicVolume.value=Math.round(music.volume*100);}
musicToggle.onclick=()=>{music.setMuted(!music.muted);music.unlock();renderMusic();};
musicVolume.oninput=()=>{music.setVolume(Number(musicVolume.value)/100);renderMusic();};
document.addEventListener('pointerdown',()=>music.unlock(),{capture:true});
document.addEventListener('keydown',()=>music.unlock(),{capture:true});
renderMusic();
const soundToggle=document.getElementById('soundToggle'),soundVolume=document.getElementById('soundVolume');
function renderSound(){soundToggle.textContent=sound.muted?'Unmute effects':'Mute effects';soundToggle.setAttribute('aria-pressed',String(sound.muted));soundVolume.value=Math.round(sound.volume*100);audioControls.querySelector('summary').textContent='Sound & music';}
soundToggle.onclick=()=>{sound.unlock();sound.setMuted(!sound.muted);renderSound();};
soundVolume.oninput=()=>{sound.setVolume(Number(soundVolume.value)/100);renderSound();};
document.getElementById('soundTest').onclick=()=>{sound.unlock();sound.play('shield');};
document.addEventListener('pointerdown',()=>sound.unlock(),{capture:true});
document.addEventListener('keydown',()=>sound.unlock(),{capture:true});
renderSound();

const $ = id => document.getElementById(id);

const buttons = [...document.querySelectorAll('[data-action]')];

let state = fresh(), busy = false, auto = false, epoch = 0;
let newDifficulty = 'normal';

let screen = 'title', entryHp = 40, selectedUpgrade = null, selectedRespite = null, selectedGateRest = null, selectedFinalPower = null, gateResolve = null, graceResolve = null;

const SAVE_KEY = 'oshannus-journey-v1';

let saved = null;

try { saved = readCheckpoint(localStorage.getItem(SAVE_KEY)); } catch {}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));



function pose(who, value = 'idle') { $(who + 'Sprite').dataset.pose = value; if (who === 'enemy') $('mirrorSprite').dataset.pose = value; }

function render() {

  music.setScene(screen==='battle'&&state.status==='playing'?(state.chapter===6?'boss':'battle'):'calm');

  const c = chapters[state.chapter];

  document.querySelector('.game').classList.toggle('chapter-two', state.chapter === 2);
  document.querySelector('.game').classList.toggle('chapter-three', state.chapter === 3);

  document.querySelector('.game').classList.toggle('chapter-four', state.chapter === 4);
  document.querySelector('.game').classList.toggle('chapter-five', state.chapter === 5);
  document.querySelector('.game').classList.toggle('gate-unbound', state.chapter === 5 && state.bossStage === 2);
  document.querySelector('.game').classList.toggle('chapter-six', state.chapter === 6);
  const deceptive = state.chapter === 2 || state.chapter === 5 && state.bossStage === 1;
  $('chapterLabel').textContent = c.subtitle + (state.difficulty === 'hard' ? (state.chapter === 1 ? ' · HARD' : ' · HARD PREVIEW') : ' · NORMAL');

  $('battleTitle').textContent = c.title;
  document.querySelector('.guidance .eyebrow').textContent = (state.chapter === 6 || state.chapter === 5 && state.bossStage === 2) ? 'BY HIS OWN CHOICE' : 'BOUND BY PLANET';

  $('enemyName').textContent = c.enemy;

  document.querySelector('.arena').setAttribute('aria-label', chapters[state.chapter].title + ' battlefield');

  $('objective').textContent = '✦ ' + c.objective;

  $('interruptButton').hidden = state.chapter < 2;

  document.querySelector('.actions').classList.toggle('five-actions', state.chapter >= 2);

  for (const [id, value, max] of [['hero', state.hp, 40], ['enemy', state.enemy, chapters[state.chapter].hp]]) {

    $(id + 'Hp').textContent = `${value} / ${max}`;

    $(id + 'Bar').style.width = value / max * 100 + '%';

  }

  $('voidArmor').hidden = state.chapter !== 6;
  $('armorValue').textContent = `${state.armor} / 28`;
  $('armorBar').style.width = `${state.armor / 28 * 100}%`;
  $('mana').textContent = `${state.mana} / 8`;

  $('manaBar').style.width = state.mana / 8 * 100 + '%';

  $('turn').textContent = 'TURN ' + String(state.turn).padStart(2, '0');

  $('mode').textContent = state.status === 'won' ? 'VICTORY' : state.status === 'lost' ? 'DEFEAT' : busy ? 'RESOLVING' : auto ? 'WATCHING' : 'YOUR MOVE';

  $('intent').textContent = state.phase === 'heavy' ? (state.chapter === 1 ? 'A crushing strike is gathering...' : 'The Riftblade gathers violet energy...') : state.phase === 'exposed' ? (state.chapter === 1 ? 'The guardian exposes its core' : 'The Riftblade pauses to recover') : (state.chapter === 1 ? 'The guardian draws back its arm' : 'The Riftblade readies its blade');

  if (state.chapter === 2 && state.mirror && state.phase !== 'exposed') $('intent').textContent += ' Its reflection follows.';

  $('mirrorSprite').hidden = !deceptive || !state.mirror || state.status !== 'playing';

  $('enemySprite').classList.toggle('phase-ready', deceptive && state.phase !== 'exposed');

  $('enemyDefense').hidden = state.chapter !== 2;

  $('enemyDefense').textContent = (state.phase === 'exposed' ? 'Phase dormant' : 'Phase shimmering') + (state.mirror ? ' · Mirror intact' : ' · Mirror shattered');

  $('intent').className = 'intent ' + (state.phase === 'heavy' ? 'danger' : state.phase === 'exposed' ? 'open' : '');

  $('core').classList.toggle('on', (state.chapter === 1 || state.chapter === 5 && state.bossStage === 1) && state.phase === 'exposed' && state.status === 'playing');

  $('shield').classList.toggle('on', state.shield);

  $('hint').textContent = state.phase === 'heavy' ? (state.chapter === 1 ? 'Stone grinds against stone as the guardian raises its arm.' : 'Violet energy gathers around its blade. The reflection moves a heartbeat behind.') : state.phase === 'exposed' ? (state.chapter === 1 ? 'Light spills from a gap in the guardian’s stone armor.' : 'Its outline turns solid. A new reflection begins to gather in the mist.') : 'Watch your foe. Each exchange reveals more.';

  if (state.chapter === 3) {
    $('intent').textContent = state.phase === 'heavy' ? (state.awakened ? 'Rooted tablets blaze. The whole chamber trembles...' : 'The tablets turn inward. Amber light swells...') : state.phase === 'exposed' ? 'The keeper bends over a fading inscription' : (state.awakened ? 'Hungry tendrils reach from the awakened tablets...' : 'Living tendrils reach toward Oshannus...');
    $('hint').textContent = state.phase === 'heavy' ? 'The same symbols return to the keeper’s hands.' : state.phase === 'exposed' ? 'The chamber falls silent, but the tablets still remember.' : 'The water tugs at your power. A mark waits to be written.';
    $('enemyDefense').hidden = false;
    $('enemyDefense').textContent = (state.awakened ? 'Archive awakened - ' : '') + (state.remembered ? 'Inscribed: ' + actions[state.remembered].name : 'The tablets are unwritten');
  }
  $('enemySprite').classList.toggle('archive-awakened', state.chapter === 3 && state.awakened && state.status === 'playing');
  $('enemySprite').classList.toggle('memory-ward', state.chapter === 3 && !!state.remembered && state.status === 'playing');
  if (state.chapter === 4) {
    $('intent').textContent = state.phase === 'consume' ? 'A captive light struggles within the sentinel...' : state.phase === 'heavy' ? (state.consumed ? 'Stolen light surges through its raised arms...' : 'Its stone arms rise. The water draws inward...') : state.phase === 'exposed' ? 'Its chest falls dark. Fragments drift apart...' : 'The sentinel stalks forward through the water...';
    $('hint').textContent = state.phase === 'consume' ? 'Golden light contracts between the stone ribs. A hand reaches outward.' : state.phase === 'exposed' ? 'For a moment, the sanctuary is quiet enough to hear yourself breathe.' : state.awakened ? 'Cracks widen through its armor. The remaining spirits struggle against their prison.' : 'This refuge once sheltered spirits. Their voices still echo inside its guardian.';
    $('intent').className = 'intent ' + (['heavy','consume'].includes(state.phase) ? 'danger' : state.phase === 'exposed' ? 'open' : '');
    $('enemyDefense').hidden = false;
    $('enemyDefense').textContent = `${state.freed} spirits freed - ${state.consumed ? 'Stolen power burns within' : 'A captive light remains'}${state.awakened ? ' - Stone fractures' : ''}`;
  }
  $('enemySprite').classList.toggle('spirit-struggling', state.chapter === 4 && state.phase === 'consume' && !state.spiritFreed && state.status === 'playing');
  $('enemySprite').classList.toggle('sentinel-desperate', state.chapter === 4 && state.awakened);
  $('enemySprite').classList.toggle('spirit-dark', state.chapter === 4 && (state.phase === 'exposed' || state.spiritFreed));
  document.querySelector('[data-action=relic] small').textContent = state.chapter === 4 && state.respite === 'blessing' ? 'Spring blessing - restore 24 health - uses your turn' : 'Restore 14 health - uses your turn';
  if (state.chapter === 5) {
    const second = state.bossStage === 2;
    $('enemyName').textContent = second ? 'WARDEN - CHAOS UNBOUND' : 'CHAOS-BOUND WARDEN';
    $('enemyDefense').hidden = false;
    $('enemyDefense').textContent = second ? 'PHASE II - ' + (state.remembered ? 'Echoing: ' + actions[state.remembered].name : 'The chains await a memory') + (state.consumed ? ' - Stolen power' : '') : 'PHASE I - ' + (state.mirror ? 'Mirror intact' : 'Mirror shattered') + (state.phase === 'exposed' ? ' - Core alight' : ' - Phase shimmering');
    $('intent').textContent = second ? (state.phase === 'consume' ? 'A trapped light strains against the gate chains...' : state.phase === 'heavy' ? 'The chains root deep. Violet power swells...' : state.phase === 'exposed' ? 'The conduits dim. The warden gathers itself...' : 'Living chains reach for your current...') : (state.phase === 'heavy' ? 'Its polearm rises. A reflection follows...' : state.phase === 'exposed' ? 'The armor parts around a turquoise core...' : 'The warden steps forward through its reflection...');
    $('hint').textContent = second ? (state.phase === 'consume' ? 'A familiar golden hand reaches through the binding. The chains echo your last attack.' : state.phase === 'heavy' ? 'The gate itself holds the chains taut. The whole foundation shudders.' : 'The marks on its armor remember. A current runs from Oshannus toward the gate.') : (state.phase === 'exposed' ? 'Its outline is solid now. Light spills from the open armor.' : 'The warden and its reflection move a heartbeat apart.');
    $('intent').className = 'intent ' + (['consume','heavy'].includes(state.phase) ? 'danger' : state.phase === 'exposed' ? 'open' : '');
  }
  if (state.chapter === 6) {
    $('enemyDefense').hidden = false;
    $('enemyDefense').textContent = (state.phase === 'exposed' || state.fieldFractured ? 'Forcefield dimmed' : 'Forcefield raised') + (state.armor ? ' - Void Armour intact' : ' - Void Armour broken') + (state.awakened ? ' - The Nightmare rises' : '');
    $('intent').textContent = state.phase === 'heavy' ? 'Muirat advances. Cracks race across the floor...' : state.phase === 'exposed' ? 'The ghost fades. His Forcefield dims...' : 'Shadows coil as the skull throne trembles...';
    $('hint').textContent = state.phase === 'heavy' ? 'Each footfall shakes the palace. A wall of water could keep you steady.' : state.phase === 'exposed' ? 'The violet ring falls quiet. Bone fragments begin to gather around him.' : state.awakened ? '“I have bent emperors to my will. You will kneel.”' : '“A gatekeeper who mistakes duty for freedom. How easily Planet bought you.”';
  }
  const hardGuardian = state.chapter === 1 && state.difficulty === 'hard';
  $('enemySprite').classList.toggle('quake-ready', hardGuardian && state.phase === 'heavy' && state.hardMove === 'quake');
  if(hardGuardian) {
    $('intent').textContent = state.phase === 'heavy' ? (state.hardMove === 'quake' ? 'Both fists lower. Tremors spread beneath you...' : 'One arm rises high. Stone locks into place...') : state.phase === 'exposed' ? 'Its chest parts. The core shines through...' : 'Its arm sweeps low across the water...';
    $('hint').textContent = state.phase === 'heavy' ? (state.hardMove === 'quake' ? 'The coming tremor could break your concentration. Water can steady you.' : 'The raised fist casts a shadow across the shrine.') : state.phase === 'exposed' ? 'A brief opening. The guardian may charge again as soon as it recovers.' : 'Watch its stance. A second sweep may follow the first.';
  }
  $('enemySprite').classList.toggle('muirat-fury', state.chapter === 6 && state.awakened);
  $('enemySprite').classList.toggle('forcefield-raised', state.chapter === 6 && state.phase !== 'exposed' && !state.fieldFractured && state.status === 'playing');
  document.querySelector('[data-action=interrupt] small').textContent = state.chapter === 6 && state.finalPower === 'breaker' ? 'Tidebreaker - shreds armour and returns mana' : 'A hooked current that pulls foes off balance';
  buttons.forEach(button => button.disabled = busy || auto || !allowed(state, button.dataset.action));

  $('strikeRange').textContent = 'A steady attack that restores mana';

  $('waveRange').textContent = state.upgrade === 'rising' ? 'Rising Tide - a surge of greater force' : 'A powerful surge of water';
  document.querySelector('[data-action=shield] small').textContent = state.upgrade === 'sheltering' ? 'Sheltering Current - blocks and mends wounds' : 'A wall of water to soften incoming blows';

  $('relicCost').textContent = state.relic ? (state.chapter === 6 ? `3 MANA - ${state.healCharges} USE${state.healCharges === 1 ? '' : 'S'}` : '3 MANA · ONCE') : 'SPENT';

  $('watch').textContent = auto ? 'Ⅱ Take control' : '▶ Watch battle';

  $('autonote').textContent = auto ? 'Live rolls · take control at any time' : (state.chapter >= 2 ? 'Choose an action · keys 1–5' : 'Choose an action · keys 1–4');

}

function announce(text) {

  $('announcement').textContent = text; $('announcement').className = 'announcement';

  void $('announcement').offsetWidth; $('announcement').className = 'announcement show';

}

function number(who, text, heal = false) {

  const el = $(who + 'Number'); el.textContent = text; el.style.color = heal ? '#9cffe0' : '#fff0d2';

  el.className = 'number ' + who + '-number'; void el.offsetWidth; el.classList.add('pop');

}

function effect(name) {

  const cue={strike:'strike',wave:'wave',shield:'shield',interrupt:'interrupt','mirror-burst':'mirror','forcefield-burst':'block','memory-burst':'block','spirit-consume':'ghost'}[name];
  if(cue)sound.play(cue);

  $('effect').className = 'effect'; void $('effect').offsetWidth; $('effect').className = 'effect ' + name;

}

function healing() {

  sound.play('heal');

  $('healing').classList.remove('on'); void $('healing').offsetWidth; $('healing').classList.add('on');

}

function log(text) { $('log').textContent = text; }

function finish() {
    busy = false; auto = false; const won = state.status === 'won';
    sound.stop();sound.play(won?'victory':'defeat');
  pose(won ? 'enemy' : 'hero', 'hurt'); render();
  const endings = {
    1: ['Shrine awakened', 'The guardian settles, its stone unbroken. Beyond the courtyard, a violet current points toward the broken causeway.'],
    2: ['The way is open', 'The Riftblade retreats into the mist. Beneath the broken causeway, amber lights awaken in the drowned archive. Something below remembers Oshannus.'],
    3: ['A memory unbound', 'The keeper lowers its tablets. A memory rises: Planet offering Oshannus a choice, while the binding beneath his feet was already closing. Then a second presence stains the vision. Muirat. Beyond the archive, a damaged fountain catches a thread of golden light.']
    ,4: ['No longer a prison', 'The sentinel falls apart. Golden spirits rise through the broken roof, free at last. One pauses beside Oshannus: Muirat waits below. The binding at his feet tightens. He presses on, carrying their voices into the dark. Below the sanctuary, the freed spirits gather beside the stair to the sixth gate. They have something more to show him.']
    ,5: ['The gate holds', 'The final chain breaks. The warden kneels, freed from Chaos, and opens the path beyond the foundations. Muirat means to turn the sixth gate into an anchor for the breach, feeding it with the spirits held below. Oshannus sets his current against the opening. He will defend the lives beyond it by his own choice. Through the narrowing breach, the current leads beneath Mortis, to the Palace of Bone. His rival waits on a throne of skulls.']
    ,6: ['The tide is his own', 'The bone armour breaks. Muirat recoils into the shadows of his throne as Oshannus tears the stolen current from his grasp. The breach begins to close. The greater darkness beyond it presses forward, but the sixth gate holds. Oshannus has won this battle on his own terms.']
  };
  if (won) saveProgress(state.chapter < 6 ? 'aftermath' : 'complete');
  $('resultEyebrow').textContent = won ? ['','CHAPTER I COMPLETE','CHAPTER II COMPLETE','CHAPTER III COMPLETE','CHAPTER IV COMPLETE','CHAPTER V COMPLETE','JOURNEY COMPLETE'][state.chapter] : 'THE TIDE RECEDES';
  $('resultTitle').textContent = won ? endings[state.chapter][0] : 'Oshannus falls';
  $('resultText').textContent = won ? endings[state.chapter][1] : (state.chapter === 3 ? 'The archive closes around you. Its tablets remember the currents you command. Retry with the same health you brought into the shrine.' : state.chapter === 2 ? 'Watch its reflection and the moments when its outline turns solid. Retry with the same health you brought onto the causeway.' : 'Watch the guardian’s movements and its exposed core. Retry with the same health you brought into the shrine.');
  if (!won && state.chapter === 4) $('resultText').textContent = 'The sentinel closes around its captive light. Remember what happened as it gathered power. Retry with the same health and spring choice you brought into the sanctuary.';
  if (!won && state.chapter === 5) $('resultText').textContent = 'The foundations tremble. The warden still bars the way. Retry both phases with the health and respite choice you brought into the gate. Renova cannot renew a gift already spent.';
  if (!won && state.chapter === 6) $('resultText').textContent = 'The shadows close around the skull throne. Remember when the Forcefield dimmed and what your current did to his armour. Retry the final battle with your chosen refinement.';
  $('retry').textContent = won ? (state.chapter < 6 ? 'Follow the current' : 'Read the epilogue') : 'Retry this battle';
  $('result').hidden = false;
  document.querySelector('.game').classList.toggle('won', won); $('retry').focus();
}

async function act(action) {

  if (screen !== 'battle' || busy || !allowed(state, action)) return;

  const token = epoch; busy = true; render(); announce(actions[action].name);

  pose('hero', actions[action].range ? 'attack' : 'idle');

  if (action === 'relic') healing();

  effect(action); await sleep(650);

  if (token !== epoch) return;

  const result = playerTurn(state, action); state = result.state;

  if (result.event.evaded) { number('enemy', 'PHASE'); $('enemySprite').classList.add('phase-dodge'); }

  if (result.event.forcefield) effect('forcefield-burst');
  if (result.event.armorDamage) { number('enemy', '-' + result.event.armorDamage + ' ARMOUR'); pose('enemy','hurt'); }
  if (result.event.warded) effect('memory-burst');
  if (result.event.absorbed) { number('enemy', 'MIRROR SHATTERED'); effect('mirror-burst'); }

  if (result.event.damage) { number('enemy', '−' + result.event.damage); pose('enemy', 'hurt'); }

  if (action === 'relic') number('hero', '+' + result.event.heal, true);

  if (result.event.freedSpirit) { healing(); number('hero', '+' + result.event.heal, true); effect('spirit-release'); announce('A spirit breaks free'); }
  render(); const hit = result.event;

  log(hit.absorbed ? 'Your attack shatters the mirror. The Riftblade takes no damage; its echo strike is gone.' : hit.evaded ? 'The Riftblade phases through your attack. Your power is spent, but the strike finds only mist.' : action === 'shield' ? 'A wall of water rises around Oshannus.' : action === 'relic' ? `Renewing Tide restores ${hit.heal} health for 3 mana. The enemy still takes its turn.` : `${actions[action].name} deals ${hit.damage} damage.${hit.exposed ? ' The exposed core flares under the impact.' : ''}${hit.warded ? ' The inscribed tablets turn aside most of the attack.' : ''}${hit.disrupted ? ' The rooted tablets hold. Riptide weakens the spell, but cannot break it.' : ''}${hit.interrupted ? ' The charged spell collapses!' : ''}`);

  if (state.chapter === 5 && (hit.absorbed || hit.evaded || hit.warded || hit.disrupted)) log(hit.absorbed ? 'Your attack breaks the reflection. The warden stands untouched, but its echo is gone.' : hit.evaded ? 'The warden phases through the current. Your attack finds only mist.' : `${actions[action].name} deals ${hit.damage} damage.${hit.warded ? ' The remembered current is turned aside by the gate chains.' : ''}${hit.disrupted ? ' Riptide weakens the rooted chains, but the charge holds.' : ''}`);
  if (hit.freedSpirit) log(`Riptide parts the stone ribs. A freed spirit restores ${hit.heal} health as it escapes. The sentinel takes ${hit.damage} damage.`);
  if (hit.freedSpirit && state.chapter === 5) log(`Riptide tears a captive light from the chains. It restores ${hit.heal} health, returning to the gate's true current. The warden takes ${hit.damage} damage.`);
  if (state.chapter === 6 && actions[action].range) log(`${actions[action].name} deals ${hit.armorDamage} armour damage and ${hit.damage} health damage.${hit.forcefield ? ' Forcefield crushes the large surge.' : ''}${hit.armorBroken ? ' Void Armour shatters.' : ''}${hit.armorMana ? ' Tidebreaker returns ' + hit.armorMana + ' mana.' : ''}${state.fieldFractured ? ' The hooked current has fractured the Forcefield.' : ''}${hit.disrupted ? ' Riptide weakens the spell, but cannot stop it.' : ''}`);
  await sleep(1200); if (token !== epoch) return;

  pose('hero'); pose('enemy'); $('enemySprite').classList.remove('phase-dodge');

  if (state.status === 'won') { finish(); return; }

  const phase = state.phase;

  if (state.chapter < 3) announce(state.interrupted ? 'Rift Surge interrupted' : phase === 'heavy' ? (state.chapter === 1 ? 'Guardian · Heavy Strike' : 'Riftblade · Rift Surge') : phase === 'gathering' ? (state.chapter === 1 ? 'Guardian · Stone Sweep' : 'Riftblade · Rift Slash') : 'The enemy recovers');

  const gateBreak = state.chapter === 5 && state.bossStage === 1 && state.enemy <= 80;
  if (state.chapter === 6) announce(phase === 'heavy' ? 'Muirat - Earthshaking Advance' : phase === 'exposed' ? 'The ghost dissolves' : 'Muirat - Coiling Shadows');
  if (state.chapter === 5) announce(gateBreak ? 'The outer binding breaks' : state.interrupted ? 'The polearm falls still' : phase === 'consume' ? 'Warden - Gate Offering' : phase === 'heavy' ? 'Warden - Foundation Rupture' : phase === 'exposed' ? 'The warden falters' : state.bossStage === 2 ? 'Warden - Living Chains' : 'Warden - Echo Sweep');
  if (state.chapter === 4) announce(phase === 'consume' ? (state.spiritFreed ? 'The empty cage lashes out' : 'Sentinel - Spirit Feast') : phase === 'heavy' ? 'Sentinel - Hollow Reckoning' : phase === 'exposed' ? 'The sentinel falters' : 'Sentinel - Stone Grasp');
  if (state.chapter === 3) announce(state.interrupted ? 'The inscription breaks' : phase === 'heavy' ? 'Keeper - Memory Collapse' : phase === 'gathering' ? 'Keeper - Devouring Tendrils' : 'The keeper transcribes');
  if (!gateBreak && phase !== 'exposed' && !state.interrupted) { pose('enemy', 'attack'); effect((state.chapter === 3 || state.chapter === 5 && state.bossStage === 2) && phase === 'gathering' ? 'tendrils' : phase === 'heavy' ? 'heavy' : 'hit'); }

  if (state.chapter === 1 && state.difficulty === 'hard') announce(phase === 'heavy' ? (state.hardMove === 'quake' ? 'Guardian - Seismic Slam' : 'Guardian - Crushing Fist') : phase === 'exposed' ? 'The guardian recovers' : 'Guardian - Stone Sweep');
  if ((state.chapter === 6 || state.chapter === 1 && state.difficulty === 'hard' && state.hardMove === 'quake') && phase === 'heavy') effect('earthquake');
  await sleep(650); if (token !== epoch) return;

  const enemy = enemyTurn(state); state = enemy.state;
  if(enemy.event.damage) sound.play(enemy.event.blocked?'block':enemy.event.earthquake?'earthquake':phase==='heavy'?'heavy':state.chapter===6?'ghost':enemy.event.stolenHealth?'tendrils':'hit');
  if (enemy.event.rescued) saveProgress('battle');

  if (enemy.event.damage) {

    number('hero', '−' + enemy.event.damage); pose('hero', 'hurt');

    document.querySelector('.arena').classList.add('shake');

  }

  render();

  if (state.chapter < 3) log(enemy.event.interrupted ? 'The spell collapses. Riptide prevents all incoming damage; the Riftblade must recover.' : phase === 'exposed' ? (state.chapter === 2 ? 'The Riftblade regains its footing. A fresh mirror steps from the mist.' : 'The enemy regains its footing and prepares another attack.') : `Enemy rolled ${enemy.event.baseRoll}${enemy.event.echoRoll ? ` + ${enemy.event.echoRoll} from its mirror` : ''}${enemy.event.blocked ? `; Water Shield reduced it to ${enemy.event.damage}` : ''}. Oshannus takes ${enemy.event.damage} damage. ${state.phase === 'heavy' ? 'A heavy strike is coming.' : (state.chapter === 1 ? 'The core is exposed!' : 'The raider must recover.')}`);

  if (state.chapter === 3) log(enemy.event.interrupted ? 'The inscription breaks. The keeper’s spell collapses before it can reach you.' : phase === 'exposed' ? 'The keeper finishes its inscription and turns back toward Oshannus.' : `Oshannus takes ${enemy.event.damage} damage.${enemy.event.drained ? ` The threads draw away ${enemy.event.drained} mana.` : enemy.event.blocked && phase === 'gathering' ? ' The water shield keeps the threads from your power.' : enemy.event.blocked ? ' Water Shield softens the impact.' : ''}`);
  if (state.chapter === 4) {
    log(phase === 'exposed' ? 'The sentinel gathers its scattered fragments. Another captive light stirs.' : `Oshannus takes ${enemy.event.damage} damage.${enemy.event.blocked ? ' Water Shield softens the blow.' : ''}${enemy.event.consumedSpirit ? ' The captive light vanishes into the sentinel. Its next strike burns with stolen power.' : phase === 'consume' ? ' The empty ribs close on nothing. The freed spirit is beyond its reach.' : ''}`);
    if (enemy.event.consumedSpirit) effect('spirit-consume');
  }
  if (state.chapter === 5) {
    log(enemy.event.stageChanged ? 'The outer binding shatters. The gate reveals the purpose of its stolen current.' : enemy.event.interrupted ? 'The polearm falls. Its charged blow collapses before it can land.' : phase === 'exposed' ? 'The warden recovers. The current gathers beneath its armor.' : `Oshannus takes ${enemy.event.damage} damage.${enemy.event.blocked ? ' Water Shield softens the blow.' : ''}${enemy.event.echoRoll ? ' Its reflection strikes with it.' : ''}${enemy.event.drained ? ' The chains draw away ' + enemy.event.drained + ' mana.' : ''}${enemy.event.stolenHealth ? ' The warden regains ' + enemy.event.enemyHeal + ' health from the stolen current.' : ''}${enemy.event.consumedSpirit ? ' The captive light feeds the binding. Its heavy blows grow stronger.' : phase === 'consume' ? ' The broken chain cannot claim the freed light.' : ''}`);
    if (enemy.event.consumedSpirit) effect('spirit-consume');
  }
  if (state.chapter === 6) log(phase === 'exposed' ? `Muirat gathers ${enemy.event.armorRestored} Void Armour from the bone-littered floor. His Forcefield rises again.` : `Oshannus takes ${enemy.event.damage} damage.${enemy.event.blocked ? ' Water Shield absorbs the tremor and keeps Oshannus steady.' : ''}${enemy.event.disrupted ? ' The spell strikes with weakened force.' : ''}`);
  if (state.chapter === 1 && state.difficulty === 'hard') log(phase === 'exposed' ? 'The core closes. Watch the stance it takes next.' : `Oshannus takes ${enemy.event.damage} damage.${enemy.event.blocked ? ' Water Shield holds him steady.' : ''} ${state.phase === 'exposed' ? 'The core opens.' : 'The guardian shifts its stance.'}`);
  if (enemy.event.enemyHeal) {
    number('enemy', '+' + enemy.event.enemyHeal, true);
    $('enemyHealing').classList.remove('on'); void $('enemyHealing').offsetWidth; $('enemyHealing').classList.add('on');
  }
  if (state.chapter === 3 && enemy.event.stolenHealth) log($('log').textContent + ` The tendrils steal ${enemy.event.stolenHealth} health; the Keeper regains ${enemy.event.enemyHeal}.`);
  if (enemy.event.disrupted && state.chapter !== 5 && state.chapter !== 6) log($('log').textContent + ' Riptide weakened the impact, but the rooted inscription endured.');
  if (enemy.event.awakenedNow && state.chapter === 6) { announce('The Nightmare rises'); log($('log').textContent + ' The palace shakes. His whispers become a command, and the shadows deepen.'); }
  if (enemy.event.awakenedNow && state.chapter === 4) { announce('The hollow armor fractures'); log($('log').textContent + ' Desperate movements shake the remaining spirits within.'); }
  if (enemy.event.awakenedNow && state.chapter === 3) { announce('The archive awakens'); log($('log').textContent + ' The tablets root themselves in the shrine. The amber current deepens.'); }
  if (enemy.event.shieldHeal) { healing(); log($('log').textContent + ` Sheltering Current restores ${enemy.event.shieldHeal} health.`); }
  if (enemy.event.stageChanged) {
    setEnemyArt(); pose('enemy'); render();
    if (enemy.event.resolveHeal) { healing(); number('hero', '+' + enemy.event.resolveHeal, true); }
    await showGateOath(); if (token !== epoch) return;
    log('Oshannus plants his current across the breach. The gate will hold by his own choice.');
  }
  if (enemy.event.rescued) {
    await sleep(550); if (token !== epoch) return;
    pose('hero'); healing(); number('hero', '+18', true); announce('A saving grace');
    await showGrace(); if (token !== epoch) return;
    log('Renova fades into the current. Oshannus rises with 18 health and renewed resolve.');
  }
  await sleep(1150); if (token !== epoch) return;

  document.querySelector('.arena').classList.remove('shake'); pose('hero'); pose('enemy');

  if (state.status === 'lost') { finish(); return; }

  if (enemy.event.stunned) {
    sound.play('stun');
    announce('STUNNED - opening lost'); pose('hero','hurt');
    $('heroSprite').classList.add('stunned');
    log(state.chapter === 1 ? 'The tremor breaks your concentration. Your next turn is lost; the guardian closes its core while you recover.' : `The earthquake breaks your concentration. Your next turn is lost; Muirat rebuilds ${enemy.event.armorRestored} Void Armour while you recover.`);
    await sleep(1800); if (token !== epoch) return;
    $('heroSprite').classList.remove('stunned'); pose('hero');
  }
  busy = false; render();

  if (auto) { await sleep(600); if (token === epoch && auto) act(choose(state)); }

}

function reset() {

  sound.stop();

  epoch++; closeGateOath(); closeGrace(); state = fresh(state.chapter, entryHp, state); busy = false; auto = false; $('result').hidden = true;

  document.querySelector('.game').classList.remove('won'); document.querySelector('.arena').classList.remove('shake');

  $('heroSprite').classList.remove('stunned');
  $('enemySprite').classList.remove('phase-dodge'); $('effect').className = 'effect'; $('announcement').className = 'announcement'; $('healing').classList.remove('on'); $('enemyHealing').classList.remove('on');

  if (state.chapter === 5) setEnemyArt();
  for (const who of ['hero', 'enemy']) { $(who + 'Number').classList.remove('pop'); pose(who); }

  log(state.chapter === 1 ? 'A stone sentinel stirs beneath the water. Oshannus raises his hands.' : 'A Riftblade blocks the crossing. Its reflection steps out of the mist. Which strike will find the real enemy?'); render();
  if (state.chapter === 6) log('Beneath Gamadan the Earthquake’s skull, Muirat rises from his throne. “Every wish has a price, Oshannus.”');
  if (state.chapter === 5) log('At the sixth gate foundations, a bound warden raises its polearm. A second outline steps through the violet chains.');
  if (state.chapter === 4) log('This place was built to shelter spirits. The hollow guardian opens its ribs, and a golden hand reaches out.');
  if (state.chapter === 3) log('The keeper lifts a blank tablet. The amber marks echo the shape of your hands.');

}

buttons.forEach(button => button.addEventListener('click', () => act(button.dataset.action)));

$('restart').onclick = reset;

$('retry').onclick = () => { if (state.status === 'won') { if (state.chapter < 6) showAftermath(); else showEpilogue(); } else reset(); };

$('watch').onclick = () => {

  if (auto) { auto = false; render(); return; }

  if (state.status !== 'playing') reset();

  auto = true; render(); if (!busy) act(choose(state));

};

document.addEventListener('keydown', event => {

  if (screen !== 'battle' || event.target.closest('.audio-controls') || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;

  const action = ['strike', 'shield', 'wave', 'relic', 'interrupt'][Number(event.key) - 1];

  if (action && !auto && !busy) { event.preventDefault(); act(action); }

});

render();



// The prologue owns its transition independently of the battle turn timers.

let introEpoch = 0, crawlPaused = false;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function beginStory() {

  if (screen !== 'title') return;

  if (saved && !window.confirm('Start a new journey? This replaces your saved checkpoint when you enter the shrine.')) return;

  newDifficulty = document.querySelector('[name=difficulty]:checked').value;
  screen = 'story'; introEpoch++; crawlPaused = false;

  $('titleScreen').hidden = true; $('storyScreen').hidden = false;

  $('intro').classList.add('show-story');

  $('storyCrawl').classList.remove('rolling');

  $('storyCrawl').style.animationPlayState = 'running';

  void $('storyCrawl').offsetWidth;

  $('storyCrawl').classList.add('rolling');

  $('pauseStory').textContent = 'Ⅱ Pause';

  $('pauseStory').setAttribute('aria-pressed', 'false');

  $('pauseStory').hidden = reducedMotion.matches;

  $('skipStory').focus();

}

async function enterBattle() {

  if (screen !== 'story') return;

  screen = 'transition';

  const token = ++introEpoch;

  $('introFade').classList.add('visible');

  $('pauseStory').disabled = true; $('skipStory').disabled = true;

  await sleep(reducedMotion.matches ? 0 : 650);

  if (token !== introEpoch) return;

  state = fresh(1,40,{difficulty:newDifficulty}); entryHp = 40; reset(); setEnemyArt(); saveProgress('battle');

  screen = 'battle';

  $('battleGame').hidden = false; $('battleGame').inert = false;

  $('intro').hidden = true;

  document.body.classList.remove('in-prologue');

  window.scrollTo(0, 0);

  buttons[0].focus({ preventScroll: true });

  announce('The Tide Shrine');

}

function returnToTitle() {
  music.setScene('calm');

  introEpoch++; reset(); screen = 'title'; updateContinue(); $('journeyScreen').hidden = true;

  $('battleGame').hidden = true; $('battleGame').inert = true;

  $('intro').hidden = false; $('intro').classList.remove('show-story');

  $('titleScreen').hidden = false; $('storyScreen').hidden = true;

  $('introFade').classList.remove('visible');

  $('storyCrawl').classList.remove('rolling');

  $('pauseStory').disabled = false; $('skipStory').disabled = false;

  document.body.classList.add('in-prologue');

  $('beginStory').focus();

}

$('beginStory').onclick = beginStory;

$('skipStory').onclick = enterBattle;

$('returnTitle').onclick = returnToTitle;

$('pauseStory').onclick = () => {

  if (screen !== 'story') return;

  crawlPaused = !crawlPaused;

  $('storyCrawl').style.animationPlayState = crawlPaused ? 'paused' : 'running';

  $('pauseStory').textContent = crawlPaused ? '▶ Resume' : 'Ⅱ Pause';

  $('pauseStory').setAttribute('aria-pressed', String(crawlPaused));

};

$('storyCrawl').addEventListener('animationend', event => {

  if (event.animationName === 'story-crawl') enterBattle();

});



function saveProgress(stage) {

  saved = checkpoint(state.chapter, entryHp, stage, stage === 'battle' ? entryHp : state.hp, state);

  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saved)); $('checkpointNote').textContent = 'Checkpoint saved on this device.'; }

  catch { $('checkpointNote').textContent = 'Saving unavailable. Keep this page open to continue.'; }

  updateContinue();

}

function updateContinue() {

  $('continueJourney').hidden = !saved;

  $('saveSummary').hidden = !saved;

  if (saved) $('saveSummary').textContent = `${chapters[saved.chapter].title} · ${saved.difficulty === 'hard' ? 'Hard preview' : 'Normal'} · ${saved.stage === 'battle' ? 'battle checkpoint · ' + saved.entryHp + '/40 health' : saved.stage === 'aftermath' ? 'aftermath' : 'completed'} · this device`;

  $('beginStory').textContent = saved ? 'Start a new journey →' : 'Begin the story →';

}

function openBattle() {

  screen = 'battle'; $('intro').hidden = true; $('journeyScreen').hidden = true;

  $('battleGame').hidden = false; $('battleGame').inert = false;

  document.body.classList.remove('in-prologue');

  setEnemyArt(); render(); window.scrollTo(0, 0); buttons[0].focus({preventScroll:true});

}

function showAftermath() {
  music.setScene('calm');

  epoch++; auto = false; busy = false; screen = 'aftermath';

  $('battleGame').hidden = true; $('battleGame').inert = true; $('intro').hidden = true;

  $('journeyScreen').hidden = false; document.body.classList.add('in-prologue');

  const hp = saved?.stage === 'aftermath' ? saved.hp : state.hp;
  const from = saved?.chapter || state.chapter;
  $('journeyScreen').classList.toggle('archive-journey', from === 2);
  $('journeyScreen').classList.toggle('sanctuary-journey', from === 3);
  $('journeyScreen').classList.toggle('gate-journey', from === 4);
  $('journeyScreen').classList.toggle('final-journey', from === 5);
  $('journeyScreen').classList.remove('epilogue-journey');
  document.querySelector('.recovery').hidden = false; document.querySelector('.next-threat').hidden = false;
  $('journeyStory').innerHTML = from === 5 ? finalStory : from === 4 ? gateStory : from === 3 ? sanctuaryStory : from === 2 ? archiveStory : shrineStory;
  document.querySelector('.new-power').hidden = from >= 2;
  document.querySelector('.next-threat').innerHTML = from === 5 ? '<b>Ahead: Djinn Muirat</b><br>The Nightmare in Bone. He on the Skull Throne. The Conjurer of Death. His throne stands beneath the skull of Gamadan the Earthquake.' : from === 4 ? '<b>Ahead: The Chaos-bound Warden</b><br>At the foundations of the sixth gate, a bronze polearm bars the way. Violet chains pull against an older turquoise light.' : from === 3 ? '<b>Ahead: The Hollow Sentinel</b><br>A fractured guardian holds a captive light between its ribs. The sanctuary has become a prison.' : from === 2 ? '<b>Ahead: The Mnemonic Keeper</b><br>Amber tablets turn in the dark. Each carries a memory. One is still blank.' : shrineThreat;
  $('nextChapter').textContent = from === 5 ? 'Enter the Palace of Bone' : from === 4 ? 'Descend to the Gate Below' : from === 3 ? 'Enter the Hollow Sanctuary' : from === 2 ? 'Descend into the archive' : 'Follow the current';

  $('recoveryHp').textContent = `${hp} → ${from === 2 ? 40 : Math.min(40, hp + 8)} / 40`;
  selectedUpgrade = saved?.upgrade || null;
  $('respiteChoices').hidden = from !== 2;
  selectedFinalPower = null;
  $('finalChoices').hidden = from !== 5;
  document.querySelectorAll('[name=finalPower]').forEach(input => input.checked = false);
  if (from === 5) $('recoveryHp').textContent = `${hp} to 40 / 40`;
  selectedGateRest = null;
  $('gateChoices').hidden = from !== 4;
  document.querySelectorAll('[name=gateRest]').forEach(input => input.checked = false);
  if (from === 4) { $('resolveHealth').textContent = `${Math.min(40,hp+24)} / 40 health on entry`; $('recoveryHp').textContent = 'Choose your recovery below'; }
  selectedRespite = null;
  $('springChoices').hidden = from !== 3;
  document.querySelectorAll('[name=spring]').forEach(input => input.checked = false);
  if (from === 3) {
    $('drinkHealth').textContent = `${Math.min(40, hp + 20)} / 40 health`;
    $('blessingHealth').textContent = `${Math.min(40, hp + 8)} / 40 health`;
    $('springPresence').textContent = saved.renovaUsed ? 'A familiar warmth remains, though the presence that once saved you has passed.' : 'The golden current feels strangely familiar. Someone has left a little warmth here.';
  }
  document.querySelectorAll('[name=upgrade]').forEach(input => input.checked = input.value === selectedUpgrade);
  $('nextChapter').disabled = from === 5 || from === 4 || from === 3 || from === 2 && !selectedUpgrade;

  $('journeyScreen').scrollTop = 0;

  ($('nextChapter').disabled ? document.querySelector(from === 5 ? '[name=finalPower]' : from === 4 ? '[name=gateRest]' : from === 3 ? '[name=spring]' : '[name=upgrade]') : $('nextChapter')).focus({preventScroll:true});

}

$('nextChapter').onclick = () => {

  if (screen === 'epilogue') { returnToTitle(); return; }
  if (screen !== 'aftermath') return;

  if (saved.chapter === 2 && !selectedUpgrade) return;
  if (saved.chapter === 3 && !selectedRespite) return;
  if (saved.chapter === 4 && !selectedGateRest) return;
  if (saved.chapter === 5 && !selectedFinalPower) return;
  state = nextChapter({...saved,status:'won',finalPower: saved.chapter === 5 ? selectedFinalPower : saved.finalPower,gateRest: saved.chapter === 4 ? selectedGateRest : saved.gateRest,respite: saved.chapter === 3 ? selectedRespite : saved.respite,upgrade: saved.chapter === 2 ? selectedUpgrade : saved.upgrade}); entryHp = state.hp;

  reset(); saveProgress('battle'); openBattle(); announce(chapters[state.chapter].title);

};

$('continueJourney').onclick = () => {

  if (!saved) return;

  entryHp = saved.entryHp; state = fresh(saved.chapter, entryHp, saved); reset();

  if (saved.stage === 'aftermath') { showAftermath(); return; }

  openBattle();

  if (saved.stage === 'complete') { state.hp = saved.hp; state.enemy = 0; state.status = 'won'; finish(); }

};

const guardianFrames = $('enemySprite').innerHTML;

function setEnemyArt() {

  if (state.chapter === 1) $('enemySprite').innerHTML = guardianFrames;

  else $('enemySprite').innerHTML = state.chapter === 2 ? raiderFrames : state.chapter === 3 ? keeperFrames : state.chapter === 4 ? sentinelFrames : state.chapter === 5 ? wardenFrames(state.bossStage) : muiratFrames;

  $('mirrorSprite').innerHTML = state.chapter === 2 ? raiderFrames : state.chapter === 5 ? wardenFrames(1) : '';

}

const raiderFrames = `<div class="sprite-frame idle" style="aspect-ratio:640/724"><img src="assets/raider-poses.png" alt="" style="width:339.375%;left:0"></div><div class="sprite-frame attack" style="aspect-ratio:925/724"><img src="assets/raider-poses.png" alt="" style="width:234.811%;left:-69.189%"></div><div class="sprite-frame hurt" style="aspect-ratio:610/724"><img src="assets/raider-poses.png" alt="" style="width:356.066%;left:-256.066%"></div>`;

const keeperFrames = `<div class="sprite-frame idle" style="aspect-ratio:620/724"><img src="assets/keeper-poses.png" alt="" style="width:350.323%;left:0"></div><div class="sprite-frame attack" style="aspect-ratio:945/724"><img src="assets/keeper-poses.png" alt="" style="width:229.841%;left:-61.376%"></div><div class="sprite-frame hurt" style="aspect-ratio:650/724"><img src="assets/keeper-poses.png" alt="" style="width:334.154%;left:-234.154%"></div>`;
const sentinelFrames = ['idle','attack','hurt'].map(p => `<div class="sprite-frame ${p} sentinel-frame"><img src="assets/sentinel.png" alt=""></div>`).join('');
const wardenFrames = stage => ['idle','attack','hurt'].map(p => `<div class="sprite-frame ${p} warden-frame"><img src="assets/warden-bound.png" alt=""></div>`).join('');
const muiratFrames = [['idle',0,700],['attack',700,748],['hurt',1448,724]].map(([p,x,w]) => `<div class="sprite-frame ${p} muirat-frame" style="aspect-ratio:${w}/724"><img src="assets/muirat-poses.png" alt="" style="width:${2172/w*100}%;left:${-x/w*100}%"></div>`).join('');
const finalStory = `<p class="eyebrow">CHAPTER V COMPLETE</p><h1>Before the skull throne</h1><p>The freed warden holds the sixth gate while Oshannus follows the stolen current through the breach. Beyond it lies the Palace of Bone, deep beneath Mortis.</p><p>Muirat's beginnings are only rumours: death and darkness, an underground rift, a dragon's necrotic breath. His rule is no rumour. Kings, emperors and sorcerers have been caught in his bargains. Even Gamadan the Earthquake fell before him.</p><p>At the threshold, a quiet pool catches the gate's returning mana. Oshannus rests until his wounds close. He needs no weapon and will ask for no favour. He refines the current already within him.</p>`;
const gateStory = `<p class="eyebrow">CHAPTER IV COMPLETE</p><h1>A promise in the quiet</h1><p>The freed spirits gather beside a still channel beneath the sanctuary. Their light eases Oshannus's wounds. Below, he hears the sixth gate straining against its foundations.</p><p>One spirit shows him where the stolen current flows: toward Muirat. His rival means to anchor a Chaos breach inside the gate itself.</p><p>Beyond that gate lie people who never chose this war. Oshannus rests beside the water, considering what he will carry into the dark.</p>`;
const sanctuaryStory = `<p class="eyebrow">CHAPTER III COMPLETE</p><h1>A Light Beneath the Ruins</h1><p>Beyond the archive, Oshannus finds a damaged fountain. For a moment, Planet's voice falls silent. Golden warmth remains in the water.</p><p>He lets the spring ease his wounds. There is enough light to drink deeply, or to carry a blessing into the battle ahead.</p><p><em>“This place was built to shelter spirits.”</em><br>Something behind the broken doors answers.<br><em>“It still does.”</em></p>`;
const shrineStory = $('journeyStory').innerHTML;
const shrineThreat = document.querySelector('.next-threat').innerHTML;
const archiveStory = `<p class="eyebrow">CHAPTER II COMPLETE</p><h1>A moment beyond the storm</h1><p>The Riftblade vanishes between the broken arches. Its last reflection falls across a stairway descending beneath the water.</p><p>Oshannus follows the amber lights below. Here, the shrine keeps memories that even Planet could not wash away. A voice speaks from behind a ring of tablets: “Bound one. Show me what you remember.”</p><p>In a sheltered pool, the current finally falls still. Oshannus rests until his wounds close and his power returns. Two deeper currents stir within him. He can make one his own before facing the keeper.</p>`;
updateContinue();


function showGrace() {
  music.setScene('calm');
  sound.play('grace');
  $('renovaCameo').hidden = false;
  $('battleGame').inert = true;
  $('acceptGrace').focus({preventScroll:true});
  return new Promise(resolve => { graceResolve = resolve; });
}
function closeGrace() {
  music.setScene(screen==='battle'&&state.status==='playing'?(state.chapter===6?'boss':'battle'):'calm');
  $('renovaCameo').hidden = true;
  $('battleGame').inert = screen !== 'battle';
  if (graceResolve) { const resolve = graceResolve; graceResolve = null; resolve(); }
}
$('acceptGrace').onclick = () => { closeGrace(); $('watch').focus({preventScroll:true}); };
$('renovaCameo').addEventListener('keydown', event => {
  if(event.key === 'Tab') { event.preventDefault(); $('acceptGrace').focus(); }
});
document.querySelectorAll('[name=upgrade]').forEach(input => input.addEventListener('change', () => {
  selectedUpgrade = input.value; $('nextChapter').disabled = false;
}));

document.querySelectorAll('[name=spring]').forEach(input => input.addEventListener('change', () => {
  selectedRespite = input.value;
  $('recoveryHp').textContent = `${saved.hp} → ${Math.min(40, saved.hp + (selectedRespite === 'drink' ? 20 : 8))} / 40`;
  $('nextChapter').disabled = false;
}));

document.querySelectorAll('[name=gateRest]').forEach(input => input.addEventListener('change', () => {
  selectedGateRest = input.value;
  $('recoveryHp').textContent = `${saved.hp} to ${selectedGateRest === 'rest' ? 40 : Math.min(40,saved.hp+24)} / 40`;
  $('nextChapter').disabled = false;
}));
function showGateOath() {
  $('gateOath').hidden = false; $('battleGame').inert = true;
  $('oathGift').textContent = state.gateRest === 'resolve' ? 'Your gathered resolve restores up to 12 health and 2 mana. Your remaining power carries into the fight.' : 'Your remaining health, mana and healing carry into the fight.';
  $('acceptOath').focus({preventScroll:true});
  return new Promise(resolve => { gateResolve = resolve; });
}
function closeGateOath() {
  $('gateOath').hidden = true; $('battleGame').inert = screen !== 'battle';
  if (gateResolve) { const resolve = gateResolve; gateResolve = null; resolve(); }
}
$('acceptOath').onclick = () => { closeGateOath(); $('watch').focus({preventScroll:true}); };
$('gateOath').addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); $('acceptOath').focus(); } });

document.querySelectorAll('[name=finalPower]').forEach(input => input.addEventListener('change', () => {
  selectedFinalPower = input.value; $('nextChapter').disabled = false;
}));
function showEpilogue() {
  music.setScene('calm');
  epoch++; auto = false; busy = false; screen = 'epilogue';
  $('battleGame').hidden = true; $('battleGame').inert = true; $('intro').hidden = true;
  $('journeyScreen').hidden = false; $('journeyScreen').className = 'journey-screen epilogue-journey'; document.body.classList.add('in-prologue');
  $('journeyStory').innerHTML = `<p class="eyebrow">THE SIXTH GATE ENDURES</p><h1>The tide is his own</h1><p>Muirat retreats into the shadows of the Palace of Bone. His rule beneath Mortis is not ended, but his hold on the sixth gate is broken.</p><p>As Oshannus returns, something vast moves behind the closing breach. For a moment the dark presses against the water. Then the passage seals. The homes beyond the gate will see another dawn.</p><p>The guardian stands watch again. The causeway is quiet, the archive remembers, and the sanctuary's spirits are free.</p><p>${state.renovaUsed ? 'Oshannus feels a last trace of Renova’s warmth in the current. He carries her gift with him.' : 'A gentle warmth passes through the water, then fades. Somewhere, Renova knows the tide has held.'}</p><p>Planet's binding remains. It no longer explains everything.</p><p><em>Oshannus raises his hands. The tide answers.</em></p>`;
  document.querySelector('.recovery').hidden = true; document.querySelector('.new-power').hidden = true; document.querySelector('.next-threat').hidden = true;
  for (const id of ['respiteChoices','springChoices','gateChoices','finalChoices']) $(id).hidden = true;
  $('nextChapter').disabled = false; $('nextChapter').textContent = 'Return to title'; $('journeyScreen').scrollTop = 0; $('nextChapter').focus({preventScroll:true});
}
