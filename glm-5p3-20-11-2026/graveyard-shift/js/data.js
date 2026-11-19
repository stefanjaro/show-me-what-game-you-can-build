'use strict';
const DATA = {};
(function () {
  DATA.xpNeed = l => Math.floor(5 + (l - 1) * 5.5 + Math.pow(l - 1, 1.85) * 0.55);

  DATA.weapons = {
    spear: {
      name: 'Bone Spear', icon: 'iconSpear', col: '#d8d2c0', max: 8,
      flavor: 'The oldest grudge, sharpened on a tombstone.',
      desc: 'Hurls piercing bone javelins in the direction you face.',
      evolve: { req: 'cursed', into: 'gungnir' },
      lv: [
        { dmg: 24, n: 1, pierce: 2, cd: 1.15 },
        { dmg: 30, n: 1, pierce: 3, cd: 1.05 },
        { dmg: 36, n: 2, pierce: 3, cd: 1.02 },
        { dmg: 43, n: 2, pierce: 4, cd: 0.95 },
        { dmg: 52, n: 3, pierce: 4, cd: 0.92 },
        { dmg: 62, n: 3, pierce: 5, cd: 0.85 },
        { dmg: 76, n: 4, pierce: 5, cd: 0.8 },
        { dmg: 92, n: 5, pierce: 6, cd: 0.72 }
      ]
    },
    scythe: {
      name: 'Soul Scythe', icon: 'iconScythe', col: '#d8d2c0', max: 8,
      flavor: 'It reaps what the dawn sows.',
      desc: 'Sweeps a spectral arc around you, knocking foes back.',
      evolve: { req: 'boots', into: 'harvest' },
      lv: [
        { dmg: 20, rad: 118, cd: 2.3, kb: 240 },
        { dmg: 26, rad: 128, cd: 2.15, kb: 260 },
        { dmg: 33, rad: 140, cd: 2.0, kb: 280 },
        { dmg: 41, rad: 152, cd: 1.85, kb: 300 },
        { dmg: 51, rad: 164, cd: 1.7, kb: 320 },
        { dmg: 63, rad: 178, cd: 1.55, kb: 340 },
        { dmg: 78, rad: 192, cd: 1.4, kb: 370 },
        { dmg: 96, rad: 210, cd: 1.25, kb: 400 }
      ]
    },
    bolt: {
      name: 'Grave Bolt', icon: 'iconBolt', col: '#8dffb0', max: 8,
      flavor: 'Every grave hungers. This one bites.',
      desc: 'Seeks out the living with vengeful soul-fire.',
      evolve: { req: 'occult', into: 'meteor' },
      lv: [
        { dmg: 18, n: 1, cd: 1.6 },
        { dmg: 23, n: 2, cd: 1.55 },
        { dmg: 29, n: 2, cd: 1.45 },
        { dmg: 36, n: 3, cd: 1.4 },
        { dmg: 45, n: 3, cd: 1.3 },
        { dmg: 56, n: 4, cd: 1.22 },
        { dmg: 70, n: 5, cd: 1.12 },
        { dmg: 86, n: 6, cd: 1.0 }
      ]
    },
    wraith: {
      name: 'Wailing Spirits', icon: 'iconWraith', col: '#b9ffd6', max: 8,
      flavor: 'They never stopped screaming. Now it is useful.',
      desc: 'Grieving wraiths circle you, shredding all they touch.',
      evolve: { req: 'magnet', into: 'choir' },
      lv: [
        { dmg: 12, n: 2, rad: 92, spd: 2.1 },
        { dmg: 16, n: 3, rad: 98, spd: 2.2 },
        { dmg: 20, n: 3, rad: 104, spd: 2.3 },
        { dmg: 25, n: 4, rad: 112, spd: 2.45 },
        { dmg: 31, n: 5, rad: 118, spd: 2.6 },
        { dmg: 38, n: 6, rad: 126, spd: 2.75 },
        { dmg: 46, n: 7, rad: 134, spd: 2.9 },
        { dmg: 56, n: 8, rad: 144, spd: 3.1 }
      ]
    },
    miasma: {
      name: 'Miasma', icon: 'iconMiasma', col: '#8fd14f', max: 8,
      flavor: 'The swamp remembers your promises.',
      desc: 'A rotting shroud poisons and slows all nearby foes.',
      evolve: { req: 'sigil', into: 'pestilence' },
      lv: [
        { dps: 10, rad: 105, slow: 0.2 },
        { dps: 14, rad: 115, slow: 0.24 },
        { dps: 19, rad: 126, slow: 0.28 },
        { dps: 25, rad: 136, slow: 0.32 },
        { dps: 32, rad: 148, slow: 0.36 },
        { dps: 41, rad: 160, slow: 0.4 },
        { dps: 52, rad: 172, slow: 0.45 },
        { dps: 66, rad: 188, slow: 0.5 }
      ]
    },
    zap: {
      name: 'Soul Lightning', icon: 'iconZap', col: '#d8b4ff', max: 8,
      flavor: 'Grief conducts beautifully.',
      desc: 'Ghosts of the departed arc between your enemies.',
      evolve: { req: 'craft', into: 'storm' },
      lv: [
        { dmg: 24, chains: 3, cd: 2.6 },
        { dmg: 30, chains: 4, cd: 2.45 },
        { dmg: 37, chains: 4, cd: 2.3 },
        { dmg: 46, chains: 5, cd: 2.1 },
        { dmg: 57, chains: 6, cd: 1.95 },
        { dmg: 70, chains: 7, cd: 1.75 },
        { dmg: 86, chains: 8, cd: 1.6 },
        { dmg: 106, chains: 10, cd: 1.4 }
      ]
    },
    gungnir: {
      name: 'GUNGNIR, THE FIRST LANCE', icon: 'iconEvolve', col: '#ffd97a', max: 1, evolved: true,
      flavor: 'EVOLUTION — Bone Spear + Cursed Strength',
      desc: 'A legendary storm of spears in every direction at once.',
      lv: [{ dmg: 130, n: 6, radial: 9, pierce: 30, cd: 0.85 }]
    },
    harvest: {
      name: 'HARVEST MOON', icon: 'iconEvolve', col: '#ffd97a', max: 1, evolved: true,
      flavor: 'EVOLUTION — Soul Scythe + Grave Boots',
      desc: 'Full-circle reaping that sends crescents racing outward.',
      lv: [{ dmg: 140, rad: 260, cd: 1.05, kb: 500, crescents: 6 }]
    },
    meteor: {
      name: 'METEOR OF SOULS', icon: 'iconEvolve', col: '#ffd97a', max: 1, evolved: true,
      flavor: 'EVOLUTION — Grave Bolt + Occult Texts',
      desc: 'Soul-fire that detonates in cataclysmic bursts.',
      lv: [{ dmg: 120, n: 6, cd: 0.9, boom: 130 }]
    },
    choir: {
      name: 'CHOIR OF THE DAMNED', icon: 'iconEvolve', col: '#ffd97a', max: 1, evolved: true,
      flavor: 'EVOLUTION — Wailing Spirits + Soul Magnet',
      desc: 'A cathedral of thirteen wraiths spirals around you forever.',
      lv: [{ dmg: 84, n: 13, rad: 165, spd: 2.4, spiral: 1 }]
    },
    pestilence: {
      name: 'PESTILENCE', icon: 'iconEvolve', col: '#ffd97a', max: 1, evolved: true,
      flavor: 'EVOLUTION — Miasma + Vampiric Sigil',
      desc: 'A roaming plague that devours battlefields whole.',
      lv: [{ dps: 150, rad: 300, slow: 0.55 }]
    },
    storm: {
      name: 'STORM OF THE DEAD', icon: 'iconEvolve', col: '#ffd97a', max: 1, evolved: true,
      flavor: 'EVOLUTION — Soul Lightning + Corpse Craft',
      desc: 'Every corpse you raise calls down the wrath of the departed.',
      lv: [{ dmg: 140, chains: 14, cd: 1.1, onRaise: true }]
    }
  };

  DATA.passives = {
    boots: {
      name: 'Grave Boots', icon: 'iconBoots', col: '#ffe8ae', max: 5,
      flavor: 'Fleeing is a proud necromantic tradition.',
      desc: '+10% movement speed per level.', per: 0.10
    },
    sigil: {
      name: 'Vampiric Sigil', icon: 'iconSigil', col: '#ff8a9a', max: 5,
      flavor: 'Borrowed life. No returns.',
      desc: '+25 max health and +0.6 health regen per level.', per: 25
    },
    magnet: {
      name: 'Soul Magnet', icon: 'iconMagnet', col: '#b89aff', max: 5,
      flavor: 'Come to papa, little lights.',
      desc: '+45% soul pickup radius per level.', per: 0.45
    },
    occult: {
      name: 'Occult Texts', icon: 'iconOccult', col: '#d8b4ff', max: 5,
      flavor: 'Chapter one: Hurry.',
      desc: '8% faster weapon cooldowns per level.', per: 0.08
    },
    cursed: {
      name: 'Cursed Strength', icon: 'iconCursed', col: '#ff8a5e', max: 5,
      flavor: 'Your hate, weaponized and certified.',
      desc: '+10% all damage per level.', per: 0.10
    },
    craft: {
      name: 'Corpse Craft', icon: 'iconCraft', col: '#8dffb0', max: 5,
      flavor: 'Quality skeletons, sourced ethically.',
      desc: '+2 minion cap, +15% minion damage, +7% raise chance per level.', per: 2
    }
  };

  DATA.chars = {
    necro: {
      name: 'The Necromancer', title: 'Last of the Black Vestry',
      desc: 'Master of the craft. Corpses raised near you cling to unlife with stubborn devotion.',
      perk: '+15% raise chance', weapon: 'spear', hp: 100, spd: 1, raise: 0.15,
      port: 'portNecro', cost: 0
    },
    doctor: {
      name: 'The Plague Doctor', title: 'Oath of the Rotten Bell',
      desc: 'Where he walks, the air itself turns traitor. Slow to fall, slower to forgive.',
      perk: '+40 health, +1 regen, stronger Miasma', weapon: 'miasma', hp: 140, spd: 0.96, raise: 0, miBonus: 0.3,
      port: 'portDoctor', cost: 700
    },
    witch: {
      name: 'The Witch of Thorns', title: 'She Who Bargained Twice',
      desc: 'Her grief conducts. Lightning leaps farther from her fingertips and luck adores her.',
      perk: '+2 lightning chains, +10% crit, +8% luck', weapon: 'zap', hp: 85, spd: 1.08, raise: 0, zapChains: 2, crit: 0.10, luck: 8,
      port: 'portWitch', cost: 1500
    }
  };

  DATA.enemies = {
    penitent: { spr: 'penitent', hp: 26, spd: 52, dmg: 9, xp: 1, r: 16, ai: 'chase', scale: 0.78 },
    acolyte: { spr: 'acolyte', hp: 18, spd: 78, dmg: 7, xp: 1, r: 15, ai: 'chase', scale: 0.78 },
    hunter: { spr: 'hunter', hp: 34, spd: 66, dmg: 8, xp: 2, r: 17, ai: 'ranged', range: 250, shotCd: 2.1, scale: 0.8 },
    crusader: { spr: 'crusader', hp: 120, spd: 44, dmg: 15, xp: 4, r: 21, ai: 'chase', scale: 0.92 },
    hound: { spr: 'hound', hp: 40, spd: 96, dmg: 11, xp: 3, r: 18, ai: 'lunge', scale: 0.9 },
    elite: { spr: 'elite', hp: 900, spd: 58, dmg: 20, xp: 22, r: 30, ai: 'ranged', range: 300, shotCd: 1.5, elite: true, scale: 1.05 },
    champ: { spr: 'champ', hp: 4200, spd: 55, dmg: 24, xp: 60, r: 46, ai: 'champ', champ: true, scale: 1.1 },
    seraph: { spr: 'seraph', hp: 40000, spd: 46, dmg: 30, xp: 400, r: 60, ai: 'seraph', boss: true, scale: 1 }
  };

  DATA.timeline = [
    { t: 0, rate: 1.3, types: ['penitent'] },
    { t: 45, rate: 2.2, types: ['penitent', 'penitent', 'acolyte'] },
    { t: 120, rate: 3.4, types: ['penitent', 'acolyte', 'acolyte'] },
    { t: 180, rate: 4.6, types: ['penitent', 'acolyte', 'hunter'] },
    { t: 260, rate: 5.8, types: ['acolyte', 'acolyte', 'hunter', 'crusader'] },
    { t: 330, rate: 7, types: ['acolyte', 'hunter', 'crusader', 'hound'] },
    { t: 420, rate: 8.5, types: ['acolyte', 'hunter', 'hound', 'crusader'] },
    { t: 520, rate: 10, types: ['acolyte', 'hound', 'crusader', 'penitent'] },
    { t: 620, rate: 12, types: ['acolyte', 'hound', 'crusader', 'hunter'] },
    { t: 720, rate: 14, types: ['acolyte', 'hound', 'hound', 'crusader'] },
    { t: 840, rate: 16, types: ['acolyte', 'hound', 'crusader', 'crusader'] },
    { t: 960, rate: 18, types: ['acolyte', 'hound', 'crusader', 'hunter'] },
    { t: 1080, rate: 21, types: ['acolyte', 'hound', 'crusader', 'crusader'] },
    { t: 1200, rate: 1, types: ['acolyte'] }
  ];

  DATA.eliteTimes = [240, 420, 600, 780, 960, 1080];
  DATA.champTimes = [480, 780, 1020];
  DATA.ringStart = 560;
  DATA.ringEvery = 60;
  DATA.winTime = 1200;

  DATA.hpMul = t => {
    const m = t / 60;
    return 1 + m * 0.24 + m * m * 0.011;
  };
  DATA.dmgMul = t => 1 + (t / 60) * 0.055;

  DATA.streaks = [
    { n: 10, name: 'RESTLESS' },
    { n: 25, name: 'GRAVEROBBER' },
    { n: 60, name: 'SOUL REAPER' },
    { n: 120, name: 'HARVESTER OF DAWN' },
    { n: 240, name: 'DEATH INCARNATE' },
    { n: 480, name: 'THE APOCALYPSE' }
  ];

  DATA.meta = [
    { id: 'might', name: 'Might of the Damned', desc: '+6% all damage per rank', ranks: 5, base: 60 },
    { id: 'vitality', name: 'Grave Vigor', desc: '+14 max health per rank', ranks: 5, base: 60 },
    { id: 'swift', name: 'Cold Wind Steps', desc: '+4% move speed per rank', ranks: 5, base: 50 },
    { id: 'wisdom', name: 'Soul Wisdom', desc: '+8% experience gained per rank', ranks: 5, base: 70 },
    { id: 'greed', name: 'Gilded Greed', desc: '+10% essence earned per rank', ranks: 5, base: 50 },
    { id: 'mastery', name: 'Bone Mastery', desc: '+1 minion cap, +6% minion damage per rank', ranks: 5, base: 80 },
    { id: 'luck', name: "Gambler's Skull", desc: '+2% crit chance, luckier chests per rank', ranks: 5, base: 60 },
    { id: 'armor', name: 'Death Shroud', desc: '-5% damage taken per rank', ranks: 5, base: 70 },
    { id: 'reroll', name: 'Forbidden Reroll', desc: 'Gain 1 level-up reroll per rank', ranks: 3, base: 120 },
    { id: 'revive', name: 'Second Death', desc: 'Cheat death once per run', ranks: 1, base: 600 }
  ];
  DATA.metaCost = (base, rank) => Math.floor(base * Math.pow(2, rank));
})();
