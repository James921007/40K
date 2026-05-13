export enum Faction {
  Tyranids = '泰倫蟲族',
  Necrons = '太空死靈',
  DarkAngels = '黑暗天使',
  Ultramarines = '極限戰士',
}

export enum WeaponType {
  Ranged = '射擊',
  Melee = '近戰',
}

export interface Weapon {
  name: string;
  type: WeaponType;
  range: string;
  A: string; // Attacks (can be number or D6, etc.)
  BS_WS: string; // e.g. "2+" or "N/A"
  S: number;
  AP: number;
  D: string; // Damage (can be number or D6, etc.)
  keywords: string[];
}

export interface Unit {
  id: string;
  name: string;
  faction: Faction;
  M: string;
  T: number;
  SV: string;
  W: number;
  LD: string;
  OC: number;
  maxModels: number;
  invuln?: number;
  canLead?: string[]; // IDs of units this unit can lead
  weapons: Weapon[];
  abilities: string[];
  keywords: string[];
}

export interface Enhancement {
  name: string;
  description: string;
  effect: (context: any) => void;
}

export interface Stratagem {
  name: string;
  cost: number;
  description: string;
  type: 'Offensive' | 'Defensive';
}

export interface FactionData {
  enhancements: Enhancement[];
  stratagems: Stratagem[];
}

export const FACTION_RULES: Record<Faction, FactionData> = {
  [Faction.Tyranids]: {
    enhancements: [
      {
        name: '精神面紗 (預設)',
        description: '持有者受到近戰攻擊時命中擲骰 -1，且持有者獲得 4+ 特種保命。',
        effect: (ctx) => { /* logic in App.tsx */ }
      },
      {
        name: '分泌刺激物 (可選)',
        description: '射擊或近戰時，武器 AP 提升 1 點。',
        effect: (ctx) => { /* logic in App.tsx */ }
      }
    ],
    stratagems: [
      {
        name: '超級反應',
        cost: 1,
        description: '受到攻擊時，對方命中擲骰 -1。',
        type: 'Defensive'
      },
      {
        name: '貪婪突襲',
        cost: 1,
        description: '射擊或近戰最近目標時，可重擲所有命中。',
        type: 'Offensive'
      }
    ]
  },
  [Faction.Necrons]: {
    enhancements: [
      {
        name: '超馳控制 (預設)',
        description: '後撤回合可進行射擊。',
        effect: (ctx) => { /* N/A for dice calc */ }
      },
      {
        name: '共鳴焦點規程 (可選)',
        description: '對 12" 內目標攻擊時，可重擲命中為 1 的結果。',
        effect: (ctx) => { /* logic in App.tsx */ }
      }
    ],
    stratagems: [
      {
        name: '堅韌流體',
        cost: 0,
        description: '獲得 5+ 特種保命（不消耗計謀點）。',
        type: 'Defensive'
      },
      {
        name: '裂解力場',
        cost: 1,
        description: '近戰時力量 S 提升 1 點。',
        type: 'Offensive'
      }
    ]
  },
  [Faction.DarkAngels]: {
    enhancements: [
      {
        name: '堅毅典范 (預設)',
        description: '受近戰攻擊時，若對方本回合衝鋒，致傷擲骰結果 -1。',
        effect: (ctx) => {}
      },
      {
        name: '狂熱怒火 (可選)',
        description: '可重擲突進與衝鋒擲骰。',
        effect: (ctx) => {}
      }
    ],
    stratagems: [
      {
        name: '第一軍團的毅力',
        cost: 1,
        description: '獲得掩體增益。',
        type: 'Defensive'
      }
    ]
  },
  [Faction.Ultramarines]: {
    enhancements: [
      {
        name: '冠軍決鬥者 (預設)',
        description: '持有者裝備的近戰武器擁有 [精准] 和 [致命一擊] 技能。',
        effect: (ctx) => {}
      },
      {
        name: '誓言決心 (可選)',
        description: '持有者所在單位中的模型提升 1 點目標控制屬性。',
        effect: (ctx) => {}
      }
    ],
    stratagems: [
      {
        name: '天生堅韌',
        cost: 1,
        description: '若本次攻擊的力量屬性高於韌性屬性，致傷擲骰結果 -1。',
        type: 'Defensive'
      },
      {
        name: '老兵本能',
        cost: 1,
        description: '致傷擲骰可重擲 1；若目標是凶獸或載具，可重擲所有致傷。',
        type: 'Offensive'
      },
    ]
  }
};

export const COMBAT_PATROL_UNITS: Unit[] = [
  // --- Tyranids ---
  {
    id: 'tyranid_prime',
    name: '瓦爾登加斯特的恐懼 (有翼泰倫王蟲)',
    faction: Faction.Tyranids,
    M: '12"', T: 5, SV: '4+', W: 6, LD: '7+', OC: 1,
    maxModels: 1,
    weapons: [
      {
        name: '王蟲利爪',
        type: WeaponType.Melee,
        range: '近戰',
        A: '6',
        BS_WS: '2+',
        S: 6,
        AP: -1,
        D: '2',
        keywords: []
      }
    ],
    abilities: ['深入打擊', '亞空間陰影', '突觸', '死亡打擊'],
    keywords: ['步兵', '角色', '飛行', '大吞噬者', '突觸', '入侵先鋒', '有翼泰倫王蟲']
  },
  {
    id: 'psychophage',
    name: '噬靈虫',
    faction: Faction.Tyranids,
    M: '8"', T: 9, SV: '3+', W: 10, LD: '8+', OC: 3,
    maxModels: 1,
    weapons: [
      {
        name: '噬靈洪流',
        type: WeaponType.Ranged,
        range: '12"',
        A: 'D6',
        BS_WS: 'N/A',
        S: 6,
        AP: -1,
        D: '1',
        keywords: ['無視掩體', '洪流']
      },
      {
        name: '利爪與觸手',
        type: WeaponType.Melee,
        range: '近戰',
        A: 'D6+1',
        BS_WS: '3+',
        S: 6,
        AP: -1,
        D: '2',
        keywords: ['針對靈能者 4+', '毀滅傷害']
      }
    ],
    abilities: ['致命破滅 1', '不覺疼痛 5+', '突觸', '瘋狂進食'],
    keywords: ['凶兽', '大吞噬者', '收割者', '噬灵虫']
  },
  {
    id: 'termagants',
    name: '槍虫',
    faction: Faction.Tyranids,
    M: '6"', T: 3, SV: '5+', W: 1, LD: '8+', OC: 2,
    maxModels: 20,
    weapons: [
      {
        name: '蝕肉槍',
        type: WeaponType.Ranged,
        range: '18"',
        A: '1',
        BS_WS: '4+',
        S: 5,
        AP: 0,
        D: '1',
        keywords: ['突擊']
      },
      {
        name: '幾丁質尖牙利爪',
        type: WeaponType.Melee,
        range: '近戰',
        A: '1',
        BS_WS: '4+',
        S: 3,
        AP: 0,
        D: '1',
        keywords: []
      }
    ],
    abilities: ['突觸', '鬼祟恐怖'],
    keywords: ['步兵', '戰線', '大吞噬者', '無盡蟲潮', '槍虫']
  },
  {
    id: 'barbgaunts',
    name: '擲彈虫',
    faction: Faction.Tyranids,
    M: '6"', T: 4, SV: '4+', W: 2, LD: '8+', OC: 1,
    maxModels: 5,
    weapons: [
      {
        name: '活體生物發射器',
        type: WeaponType.Ranged,
        range: '24"',
        A: 'D6',
        BS_WS: '4+',
        S: 5,
        AP: 0,
        D: '1',
        keywords: ['爆炸', '重型']
      },
      {
        name: '幾丁質尖牙利爪',
        type: WeaponType.Melee,
        range: '近戰',
        A: '1',
        BS_WS: '4+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: []
      }
    ],
    abilities: ['突觸', '干擾轟炸'],
    keywords: ['步兵', '大吞噬者', '擲彈虫']
  },
  {
    id: 'von_ryans_leapers',
    name: '馮·瑞恩躍襲者',
    faction: Faction.Tyranids,
    M: '10"', T: 5, SV: '4+', W: 3, LD: '8+', OC: 1,
    maxModels: 3,
    invuln: 6,
    weapons: [
      {
        name: '躍襲者利爪',
        type: WeaponType.Melee,
        range: '近戰',
        A: '6',
        BS_WS: '3+',
        S: 5,
        AP: -1,
        D: '1',
        keywords: []
      }
    ],
    abilities: ['先攻', '滲透者', '隱秘', '突觸', '猛撲'],
    keywords: ['步兵', '大吞噬者', '入侵先鋒', '馮·瑞恩躍襲者']
  },

  // --- Necrons ---
  {
    id: 'overlord',
    name: '霸主阿蒙霍泰克',
    faction: Faction.Necrons,
    M: '5"', T: 5, SV: '2+', W: 6, LD: '4+', OC: 1,
    maxModels: 1,
    invuln: 4,
    canLead: ['warriors'],
    weapons: [
      {
        name: '超光速粒子箭',
        type: WeaponType.Ranged,
        range: '72"',
        A: '1',
        BS_WS: '2+',
        S: 16,
        AP: -5,
        D: 'D6+2',
        keywords: ['單發']
      },
      {
        name: '霸主之刃',
        type: WeaponType.Melee,
        range: '近戰',
        A: '4',
        BS_WS: '2+',
        S: 8,
        AP: -3,
        D: '2',
        keywords: ['毀滅傷害']
      }
    ],
    abilities: ['重生規程', '不屈韌性'],
    keywords: ['步兵', '角色']
  },
  {
    id: 'warriors',
    name: '太空死靈戰士',
    faction: Faction.Necrons,
    M: '5"', T: 4, SV: '4+', W: 1, LD: '7+', OC: 2,
    maxModels: 10,
    weapons: [
      {
        name: '高斯撕裂槍',
        type: WeaponType.Ranged,
        range: '24"',
        A: '1',
        BS_WS: '4+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: ['致命一擊', '速射 1']
      },
      {
        name: '高斯收割槍',
        type: WeaponType.Ranged,
        range: '12"',
        A: '2',
        BS_WS: '4+',
        S: 5,
        AP: -1,
        D: '1',
        keywords: ['致命一擊']
      },
      {
        name: '格鬥武器',
        type: WeaponType.Melee,
        range: '近戰',
        A: '1',
        BS_WS: '4+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: []
      }
    ],
    abilities: ['重生規程'],
    keywords: ['步兵']
  },
  {
    id: 'skorpekh_destroyers',
    name: '荒蝎毀滅者',
    faction: Faction.Necrons,
    M: '7"', T: 6, SV: '3+', W: 3, LD: '7+', OC: 2,
    maxModels: 3,
    weapons: [
      {
        name: '荒蝎超相位武器',
        type: WeaponType.Melee,
        range: '近戰',
        A: '4',
        BS_WS: '3+',
        S: 7,
        AP: -2,
        D: '2',
        keywords: []
      }
    ],
    abilities: ['重生規程'],
    keywords: ['步兵']
  },
  {
    id: 'scarabs',
    name: '冥工聖甲蟲群',
    faction: Faction.Necrons,
    M: '9"', T: 2, SV: '6+', W: 4, LD: '8+', OC: 0,
    maxModels: 3,
    weapons: [
      {
        name: '捕食下顎',
        type: WeaponType.Melee,
        range: '近戰',
        A: '6',
        BS_WS: '5+',
        S: 2,
        AP: 0,
        D: '1',
        keywords: ['致命一擊']
      }
    ],
    abilities: ['重生規程', '致命破滅 1'],
    keywords: ['群聚']
  },
  {
    id: 'doomstalker',
    name: '冥工末日追獵者',
    faction: Faction.Necrons,
    M: '7"', T: 8, SV: '3+', W: 12, LD: '8+', OC: 4,
    maxModels: 1,
    invuln: 4,
    weapons: [
      {
        name: '末日爆能炮',
        type: WeaponType.Ranged,
        range: '48"',
        A: 'D6+1',
        BS_WS: '4+',
        S: 14,
        AP: -3,
        D: '3',
        keywords: ['爆炸', '重型']
      },
      {
        name: '雙聯高斯撕裂槍',
        type: WeaponType.Ranged,
        range: '24"',
        A: '1',
        BS_WS: '4+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: ['致命一擊', '速射 1', '雙聯']
      },
      {
        name: '末日追獵者肢體',
        type: WeaponType.Melee,
        range: '近戰',
        A: '3',
        BS_WS: '4+',
        S: 6,
        AP: 0,
        D: '1',
        keywords: []
      }
    ],
    abilities: ['重生規程', '致命破滅 D3'],
    keywords: ['載具']
  },
  // --- Dark Angels ---
  {
    id: 'chaplain_mordecai',
    name: '莫德凱牧師',
    faction: Faction.DarkAngels,
    M: '6"', T: 4, SV: '3+', W: 4, LD: '5+', OC: 1,
    maxModels: 1,
    invuln: 4,
    canLead: ['da_intercessors'],
    weapons: [
      {
        name: '赦免者爆矢手槍',
        type: WeaponType.Ranged,
        range: '18"',
        A: '1',
        BS_WS: '3+',
        S: 5,
        AP: -1,
        D: '2',
        keywords: ['手槍']
      },
      {
        name: '奧秘權杖',
        type: WeaponType.Melee,
        range: '近戰',
        A: '5',
        BS_WS: '2+',
        S: 6,
        AP: -1,
        D: '2',
        keywords: []
      }
    ],
    abilities: ['領袖', '憎恨禱言'],
    keywords: ['步兵', '角色']
  },
  {
    id: 'da_intercessors',
    name: '仲裁者小隊',
    faction: Faction.DarkAngels,
    M: '6"', T: 4, SV: '3+', W: 2, LD: '6+', OC: 2,
    maxModels: 5,
    weapons: [
      {
        name: '爆矢步槍',
        type: WeaponType.Ranged,
        range: '24"',
        A: '2',
        BS_WS: '3+',
        S: 4,
        AP: -1,
        D: '1',
        keywords: ['突擊', '重型']
      },
      {
        name: '爆矢手槍',
        type: WeaponType.Ranged,
        range: '12"',
        A: '1',
        BS_WS: '3+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: ['手槍']
      },
      {
        name: '動力武器',
        type: WeaponType.Melee,
        range: '近戰',
        A: '4',
        BS_WS: '3+',
        S: 5,
        AP: -2,
        D: '1',
        keywords: []
      },
      {
        name: '格鬥武器',
        type: WeaponType.Melee,
        range: '近戰',
        A: '3',
        BS_WS: '3+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: []
      }
    ],
    abilities: ['破敵重誓'],
    keywords: ['步兵']
  },
  {
    id: 'da_inceptors',
    name: '先驅者小隊',
    faction: Faction.DarkAngels,
    M: '10"', T: 6, SV: '3+', W: 3, LD: '6+', OC: 1,
    maxModels: 3,
    weapons: [
      {
        name: '突擊爆矢槍',
        type: WeaponType.Ranged,
        range: '18"',
        A: '3',
        BS_WS: '3+',
        S: 5,
        AP: -1,
        D: '2',
        keywords: ['突擊', '手槍', '持續打擊 2', '雙聯']
      },
      {
        name: '格鬥武器',
        type: WeaponType.Melee,
        range: '近戰',
        A: '3',
        BS_WS: '3+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: []
      }
    ],
    abilities: ['深入打擊', '破敵重誓'],
    keywords: ['步兵', '起跳背包']
  },
  {
    id: 'da_redemptor',
    name: '救贖者型無畏機甲',
    faction: Faction.DarkAngels,
    M: '8"', T: 10, SV: '2+', W: 12, LD: '6+', OC: 4,
    maxModels: 1,
    weapons: [
      {
        name: '巨型等離子焚化炮 - 超載',
        type: WeaponType.Ranged,
        range: '36"',
        A: 'D6+1',
        BS_WS: '3+',
        S: 9,
        AP: -4,
        D: '3',
        keywords: ['爆炸', '危險']
      },
      {
        name: '巨型等離子焚化炮 - 標準',
        type: WeaponType.Ranged,
        range: '36"',
        A: 'D6+1',
        BS_WS: '3+',
        S: 8,
        AP: -3,
        D: '2',
        keywords: ['爆炸']
      },
      {
        name: '強襲加特林炮',
        type: WeaponType.Ranged,
        range: '24"',
        A: '8',
        BS_WS: '3+',
        S: 5,
        AP: 0,
        D: '1',
        keywords: ['毀滅傷害']
      },
      {
        name: '伊卡洛斯導彈巢',
        type: WeaponType.Ranged,
        range: '24"',
        A: 'D3',
        BS_WS: '3+',
        S: 8,
        AP: -1,
        D: '2',
        keywords: ['針對飛行 2+']
      },
      {
        name: '雙聯破片風暴榴彈發射器',
        type: WeaponType.Ranged,
        range: '18"',
        A: 'D6',
        BS_WS: '3+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: ['爆炸', '雙聯']
      },
      {
        name: '救贖者鐵拳',
        type: WeaponType.Melee,
        range: '近戰',
        A: '5',
        BS_WS: '3+',
        S: 12,
        AP: -2,
        D: '3',
        keywords: []
      }
    ],
    abilities: ['破敵重誓', '致命破滅 D3'],
    keywords: ['載具', '機甲']
  },
  // --- Ultramarines ---
  {
    id: 'um_captain',
    name: '奧克塔維斯連長',
    faction: Faction.Ultramarines,
    M: '5"', T: 5, SV: '2+', W: 6, LD: '6+', OC: 1,
    maxModels: 1,
    invuln: 4,
    canLead: ['um_terminators'],
    weapons: [
      {
        name: '風暴爆矢槍',
        type: WeaponType.Ranged,
        range: '24"',
        A: '2',
        BS_WS: '2+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: ['速射 2']
      },
      {
        name: '聖物武器',
        type: WeaponType.Melee,
        range: '近戰',
        A: '6',
        BS_WS: '2+',
        S: 5,
        AP: -2,
        D: '2',
        keywords: []
      }
    ],
    abilities: ['領袖', '深入打擊', '悍勇難當', '破敵重誓'],
    keywords: ['步兵', '角色', '終結者']
  },
  {
    id: 'um_librarian',
    name: '智庫員坦圖斯',
    faction: Faction.Ultramarines,
    M: '5"', T: 5, SV: '2+', W: 5, LD: '6+', OC: 1,
    maxModels: 1,
    invuln: 4,
    canLead: ['um_terminators'],
    weapons: [
      {
        name: '懲擊 - 巫火',
        type: WeaponType.Ranged,
        range: '24"',
        A: 'D6',
        BS_WS: '3+',
        S: 5,
        AP: -1,
        D: 'D3',
        keywords: ['靈能者']
      },
      {
        name: '懲擊 - 聚焦巫火',
        type: WeaponType.Ranged,
        range: '24"',
        A: 'D6',
        BS_WS: '3+',
        S: 6,
        AP: -2,
        D: 'D3',
        keywords: ['靈能者', '毀滅傷害', '危險']
      },
      {
        name: '風暴爆矢槍',
        type: WeaponType.Ranged,
        range: '24"',
        A: '2',
        BS_WS: '3+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: ['速射 2']
      },
      {
        name: '靈能武器',
        type: WeaponType.Melee,
        range: '近戰',
        A: '4',
        BS_WS: '3+',
        S: 6,
        AP: -1,
        D: 'D3',
        keywords: ['靈能者']
      }
    ],
    abilities: ['領袖', '深入打擊', '時間帷幕', '破敵重誓'],
    keywords: ['步兵', '角色', '終結者', '靈能者']
  },
  {
    id: 'um_terminators',
    name: '終結者小隊',
    faction: Faction.Ultramarines,
    M: '5"', T: 5, SV: '2+', W: 3, LD: '6+', OC: 1,
    maxModels: 5,
    invuln: 4,
    weapons: [
      {
        name: '突擊炮',
        type: WeaponType.Ranged,
        range: '24"',
        A: '6',
        BS_WS: '3+',
        S: 6,
        AP: 0,
        D: '1',
        keywords: ['毀滅傷害']
      },
      {
        name: '風暴爆矢槍',
        type: WeaponType.Ranged,
        range: '24"',
        A: '2',
        BS_WS: '3+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: ['速射 2']
      },
      {
        name: '動力拳',
        type: WeaponType.Melee,
        range: '近戰',
        A: '3',
        BS_WS: '3+',
        S: 8,
        AP: -2,
        D: '2',
        keywords: []
      },
      {
        name: '動力武器',
        type: WeaponType.Melee,
        range: '近戰',
        A: '4',
        BS_WS: '3+',
        S: 5,
        AP: -2,
        D: '1',
        keywords: []
      }
    ],
    abilities: ['深入打擊', '第一連隊之怒', '破敵重誓'],
    keywords: ['步兵', '終結者']
  },
  {
    id: 'um_infernus',
    name: '焚獄者小隊',
    faction: Faction.Ultramarines,
    M: '6"', T: 4, SV: '3+', W: 2, LD: '6+', OC: 1,
    maxModels: 5,
    weapons: [
      {
        name: '焚焰槍',
        type: WeaponType.Ranged,
        range: '12"',
        A: 'D6',
        BS_WS: 'N/A',
        S: 5,
        AP: 0,
        D: '1',
        keywords: ['無視掩體', '洪流']
      },
      {
        name: '爆矢手槍',
        type: WeaponType.Ranged,
        range: '12"',
        A: '1',
        BS_WS: '3+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: ['手槍']
      },
      {
        name: '格鬥武器',
        type: WeaponType.Melee,
        range: '近戰',
        A: '3',
        BS_WS: '3+',
        S: 4,
        AP: 0,
        D: '1',
        keywords: []
      }
    ],
    abilities: ['破敵重誓'],
    keywords: ['步兵']
  }
];
