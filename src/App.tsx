/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sword, 
  Shield, 
  Dices, 
  Skull, 
  Target, 
  Crosshair, 
  Info, 
  ChevronRight, 
  RotateCcw,
  Zap,
  ShieldAlert,
  Flame,
  ArrowUpDown,
  Users
} from 'lucide-react';
import { COMBAT_PATROL_UNITS, Unit, Weapon, WeaponType, Faction, FACTION_RULES, Stratagem } from './constants';

// --- Types ---
interface RollResult {
  dice: number[];
  successCount: number;
  criticalCount: number;
  autoWounds?: number;
  mortalWounds?: number;
}

interface BattleLog {
  step: string;
  result: string;
  details: string;
  hitRolls?: number[];
  hitRollsRerolled?: number[];
  woundRolls?: number[];
  woundRollsRerolled?: number[];
  saveRolls?: number[];
  fnpRolls?: number[];
}

// --- Helpers ---
const rollD6 = () => Math.floor(Math.random() * 6) + 1;

const parseExpression = (expr: string): number => {
  if (!isNaN(Number(expr))) return Number(expr);
  if (expr.toUpperCase() === 'D6') return rollD6();
  if (expr.toUpperCase() === 'D3') return Math.ceil(rollD6() / 2);
  
  const d6match = expr.match(/D6\s*\+\s*(\d+)/i);
  if (d6match) return rollD6() + Number(d6match[1]);

  const d3match = expr.match(/D3\s*\+\s*(\d+)/i);
  if (d3match) return Math.ceil(rollD6() / 2) + Number(d3match[1]);

  return 1; // Default fallback
};

const getToWoundLimit = (S: number, T: number): number => {
  if (S >= T * 2) return 2;
  if (S > T) return 3;
  if (S === T) return 4;
  if (S * 2 <= T) return 6;
  if (S < T) return 5;
  return 4;
};

const getFactionIcon = (faction: Faction) => {
  switch (faction) {
    case Faction.Tyranids: return '👾';
    case Faction.Necrons: return '⚙️';
    case Faction.DarkAngels: return '🛡️';
    case Faction.Ultramarines: return '🏛️';
    default: return '🦅';
  }
};

export default function App() {
  const [attacker, setAttacker] = useState<Unit | null>(null);
  const [joinedLeader, setJoinedLeader] = useState<Unit | null>(null);
  const [unitWeapon, setUnitWeapon] = useState<Weapon | null>(null);
  const [leaderWeapon, setLeaderWeapon] = useState<Weapon | null>(null);
  const [defender, setDefender] = useState<Unit | null>(null);
  const [joinedDefenderLeader, setJoinedDefenderLeader] = useState<Unit | null>(null);
  const [numAttackingModels, setNumAttackingModels] = useState(1);
  const [numJoinedAttackingModels, setNumJoinedAttackingModels] = useState(1);
  const [numDefenderModels, setNumDefenderModels] = useState(1);
  const [numJoinedDefenderModels, setNumJoinedDefenderModels] = useState(1);
  const [selectedSaveType, setSelectedSaveType] = useState<'armor' | 'invuln'>('armor');
  const [isInCover, setIsInCover] = useState(false);
  const [isFoolproofMode, setIsFoolproofMode] = useState(true);
  
  // Tactical Options
  const [isStationary, setIsStationary] = useState(false); // For Heavy
  const [inRapidFire, setInRapidFire] = useState(true);
  const [isPlasmaCyte, setIsPlasmaCyte] = useState(false);
  const [isDamaged, setIsDamaged] = useState(false);
  const [isPsykerTarget, setIsPsykerTarget] = useState(false);
  const [isBelowHalf, setIsBelowHalf] = useState(false);
  const [isBattleShocked, setIsBattleShocked] = useState(false);
  const [isOathTarget, setIsOathTarget] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [isFlyerTarget, setIsFlyerTarget] = useState(false);
  const [isStealth, setIsStealth] = useState(false);
  const [isPlungingFire, setIsPlungingFire] = useState(false);
  const [isInEngagementRange, setIsInEngagementRange] = useState(false);
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [interactivePrompt, setInteractivePrompt] = useState<{
    title: string;
    instruction: string;
    targetInfo: string;
    dice: number[];
    constraint: (val: number) => boolean;
    expectedSuccesses: number;
    currentSuccesses: number;
    resolve: (rerollAll: boolean) => void;
  } | null>(null);
  const [isHazardousFailed, setIsHazardousFailed] = useState<boolean | null>(null);
  const [showManualMods, setShowManualMods] = useState(false);
  const [quickDice, setQuickDice] = useState<{type: string, value: number} | null>(null);
  const [visibleFactions, setVisibleFactions] = useState<Faction[]>([Faction.Tyranids, Faction.Necrons, Faction.DarkAngels, Faction.Ultramarines]);
  const [modifiers, setModifiers] = useState({
    hit: 0,
    wound: 0,
    save: 0,
    damage: 0,
  });

  // New States: Enhancements and Stratagems
  const [tyranidEnhancement, setTyranidEnhancement] = useState<number | null>(null); 
  const [necronEnhancement, setNecronEnhancement] = useState<number | null>(null); 
  const [daEnhancement, setDaEnhancement] = useState<number | null>(null); 
  const [umEnhancement, setUmEnhancement] = useState<number | null>(null);
  const [activeStratagems, setActiveStratagems] = useState<string[]>([]);

  const [battleResults, setBattleResults] = useState<{
    logs: BattleLog[];
    totalDamage: number;
    deadModels: number;
  } | null>(null);

  const [simulationState, setSimulationState] = useState<'IDLE' | 'HITTING' | 'WOUNDING' | 'SAVING' | 'DONE'>('IDLE');
  const [currentStepData, setCurrentStepData] = useState<any>(null);

  // --- Logic ---
  const promptDiceReroll = (
    title: string, 
    instruction: string, 
    targetInfo: string, 
    dice: number[], 
    constraint: (val: number) => boolean,
    expectedSuccesses: number,
    currentSuccesses: number
  ): Promise<{val: number, isRerolled: boolean}[]> => {
    return new Promise(resolve => {
      setInteractivePrompt({
        title,
        instruction,
        targetInfo,
        dice,
        constraint,
        expectedSuccesses,
        currentSuccesses,
        resolve: (doReroll) => {
          setInteractivePrompt(null);
          if (doReroll) {
            resolve(dice.map(v => ({
              val: constraint(v) ? rollD6() : v,
              isRerolled: constraint(v)
            })));
          } else {
            resolve(dice.map(v => ({ val: v, isRerolled: false })));
          }
        }
      });
    });
  };

  const runHazardousTest = () => {
    const roll = rollD6();
    setIsHazardousFailed(roll === 1);
  };

  const startSimulation = async () => {
    if (!attacker || !defender) return;
    if (!unitWeapon && !leaderWeapon) return;
    
    setSimulationState('HITTING'); // Use a generic working state, UI won't show it except disabling button
    setQuickDice(null);
    setBattleResults(null);
    setCurrentStepData(null);

    const logs: BattleLog[] = [];
    let totalCombinedDamage = 0;
    let hazardousTestRequired = false;

    const runProfile = async (model: Unit, weapon: Weapon, count: number, isLeader: boolean, customName?: string) => {
      // 1. Hit Step
      let totalA = 0;
      const isBlast = weapon.keywords.includes('爆炸');
      const blastBonus = isBlast ? Math.floor(numDefenderModels / 5) : 0;
      for (let i = 0; i < count; i++) {
        totalA += parseExpression(weapon.A) + blastBonus;
      }
      if (weapon.keywords.some(k => k.includes('速射')) && inRapidFire) {
        const match = weapon.keywords.find(k => k.includes('速射'))?.match(/\d+/);
        totalA += (match ? Number(match[0]) : 1) * count;
      }
      if (weapon.keywords.includes('危險')) hazardousTestRequired = true;

      const isTorrent = weapon.keywords.includes('洪流');
      const isHeavy = weapon.keywords.includes('重型') && isStationary;
      const hitTarget = weapon.BS_WS === 'N/A' ? 0 : Number(weapon.BS_WS.replace('+', ''));
      let ruleHitMod = 0;
      if (defender!.faction === Faction.Tyranids && tyranidEnhancement === 0 && weapon.type === WeaponType.Melee && defender!.id === 'tyranid_prime') ruleHitMod -= 1;
      if (defender!.faction === Faction.Tyranids && activeStratagems.includes('超級反應')) ruleHitMod -= 1;
      if (model.id === 'canoptek_doomstalker' && isDamaged) ruleHitMod -= 1;
      if (model.id === 'psychophage' && isDamaged && weapon.type === WeaponType.Melee) ruleHitMod -= 1;
      if (model.id === 'da_redemptor' && isDamaged) ruleHitMod -= 1;
      if (isStealth && weapon.type === WeaponType.Ranged) ruleHitMod -= 1;
      const hasTerminator = attacker!.keywords.includes('終結者') || joinedLeader?.keywords.includes('終結者');
      if (hasTerminator && isOathTarget) ruleHitMod += 1;
      const isAttackerBig = model.keywords.some(k => k === '載具' || k === '怪獸');
      const isTargetBig = defender!.keywords.some(k => k === '載具' || k === '怪獸');
      if (isInEngagementRange && weapon.type === WeaponType.Ranged && !weapon.keywords.includes('手槍') && (isAttackerBig || isTargetBig)) ruleHitMod -= 1;

      const netHitMod = Math.max(-1, Math.min(1, (isHeavy ? 1 : 0) + modifiers.hit + ruleHitMod));
      const modifiedHitTarget = Math.max(2, Math.min(6, hitTarget - netHitMod));
      
      let hits = 0;
      let autoWounds = 0;
      let hitRolls: number[] = [];
      let hitRollsRerolled: number[] | undefined;
      if (isTorrent) {
        hits = totalA;
      } else {
        const sustainedMatch = weapon.keywords.find(k => k.includes('持續打擊'))?.match(/\d+/);
        let sustainedValue = sustainedMatch ? Number(sustainedMatch[0]) : 0;
        const hasVeilOfTime = attacker!.abilities.includes('時間帷幕') || joinedLeader?.abilities.includes('時間帷幕');
        const isPrimeLeading = (attacker!.id === 'tyranid_prime' && joinedLeader) || (joinedLeader?.id === 'tyranid_prime');
        if (hasVeilOfTime || (isPrimeLeading && weapon.type === WeaponType.Melee)) sustainedValue = Math.max(sustainedValue, 1);
        const isLethal = weapon.keywords.includes('致命一擊') || (joinedLeader?.id === 'um_captain' && umEnhancement === 0 && weapon.type === WeaponType.Melee);
        
        let initialRolls = [];
        for (let i = 0; i < totalA; i++) initialRolls.push(rollD6());
        
        const canRerollAll = (attacker!.faction === Faction.Tyranids && activeStratagems.includes('貪婪突襲')) || ((attacker!.faction === Faction.DarkAngels || attacker!.faction === Faction.Ultramarines) && isOathTarget);
        const canRerollOnes = attacker!.faction === Faction.Necrons && necronEnhancement === 1;

        let finalRollObjects = initialRolls.map(v => ({val: v, isRerolled: false}));

        if (canRerollAll || canRerollOnes) {
          const expectedHits = Number((totalA * (7 - modifiedHitTarget) / 6).toFixed(1));
          const currentHits = initialRolls.filter(v => v >= modifiedHitTarget).length;
          const constraintFn = (v: number) => canRerollAll ? v < modifiedHitTarget : v === 1;

          if (isInteractiveMode) {
             finalRollObjects = await promptDiceReroll(
               `命中判定 - ${weapon.name}`,
               canRerollAll ? "規則允許重擲所有失敗的命中骰。" : "規則允許重擲為 1 的命中骰。",
               `成功門檻: ${modifiedHitTarget}+${isLethal ? ' (6暴擊自動造傷)' : ''}${sustainedValue > 0 ? ` (6額外命中+${sustainedValue})` : ''}`,
               initialRolls,
               constraintFn,
               expectedHits,
               currentHits
             );
          } else {
             if (currentHits < expectedHits) {
               finalRollObjects = initialRolls.map(v => {
                 if (constraintFn(v)) return { val: rollD6(), isRerolled: true };
                 return { val: v, isRerolled: false };
               });
             } else {
               finalRollObjects = initialRolls.map(v => ({ val: v, isRerolled: false }));
             }
          }
        }

        hitRolls = initialRolls;
        if (finalRollObjects.some(obj => obj.isRerolled)) {
          hitRollsRerolled = finalRollObjects.map(obj => obj.val);
        }

        finalRollObjects.forEach(obj => {
          let roll = obj.val;
          const extraHits = roll === 6 ? sustainedValue : 0;
          if (roll === 6 && isLethal) { autoWounds++; hits += extraHits; }
          else if (roll >= modifiedHitTarget) { hits++; hits += extraHits; }
        });
      }

      // 2. Wound Step
      let effectiveS = weapon.S;
      if (attacker!.faction === Faction.Necrons && activeStratagems.includes('裂解力場') && weapon.type === WeaponType.Melee) effectiveS += 1;
      const baseWoundTarget = getToWoundLimit(effectiveS, defender!.T);
      let ruleWoundMod = 0;
      if (model.id === 'psychophage' && isBelowHalf && weapon.type === WeaponType.Melee) ruleWoundMod += 1;
      if (joinedLeader?.id === 'chaplain_mordecai' && weapon.type === WeaponType.Melee) ruleWoundMod += 1;
      if (defender!.faction === Faction.DarkAngels && daEnhancement === 0 && isCharging && weapon.type === WeaponType.Melee) ruleWoundMod -= 1;
      if (defender!.faction === Faction.Ultramarines && activeStratagems.includes('天生堅韌') && effectiveS > defender!.T) ruleWoundMod -= 1;
      
      const netWoundMod = Math.max(-1, Math.min(1, modifiers.wound + ruleWoundMod));
      const modifiedWoundTarget = Math.max(2, Math.min(6, baseWoundTarget - netWoundMod));
      
      let antiTarget = 7;
      for (const k of weapon.keywords) {
        if (k.startsWith('針對')) {
          const spaceIdx = k.indexOf(' ');
          const targetKeyword = k.substring(2, spaceIdx > -1 ? spaceIdx : k.length);
          if (defender!.keywords.includes(targetKeyword)) {
            const match = k.match(/\d+/);
            if (match) antiTarget = Math.min(antiTarget, Number(match[0]));
          }
        }
      }

      let wounds = 0;
      let mortalWounds = 0;
      let woundRolls: number[] = [];
      let woundRollsRerolled: number[] | undefined;
      const isTwinLinked = weapon.keywords.includes('雙聯');
      const isVeteran = attacker!.faction === Faction.Ultramarines && activeStratagems.includes('老兵本能');
      const isDevastating = weapon.keywords.includes('毀滅傷害') || isPlasmaCyte;

      if (hits > 0) {
        let initialRolls = [];
        for (let i = 0; i < hits; i++) initialRolls.push(rollD6());
        
        let finalRollObjects = initialRolls.map(v => ({val: v, isRerolled: false}));
        
        const canVetRerollFn = (v: number) => isVeteran && (v === 1 || (v < baseWoundTarget && (defender!.keywords.includes('載具') || defender!.keywords.includes('怪獸'))));

        if (isTwinLinked || isVeteran) {
          const expectedWounds = Number((hits * (7 - modifiedWoundTarget) / 6).toFixed(1));
          const currentWounds = initialRolls.filter(v => (v === 6 || v >= antiTarget) || v >= modifiedWoundTarget).length;
          const constraintFn = (v: number) => isTwinLinked ? v < modifiedWoundTarget : canVetRerollFn(v);

           if (isInteractiveMode) {
              finalRollObjects = await promptDiceReroll(
               `造傷判定 - ${weapon.name}`,
               isTwinLinked ? "[雙聯] 規則允許重擲所有失敗的造傷骰。" : "[老兵本能] 允許重擲 1，或重擲對抗載具/怪獸的失敗造傷。",
               `成功門檻: ${modifiedWoundTarget}+  抗性暴擊: ${antiTarget}+ ${isDevastating?'(造成致命傷)':''}`,
               initialRolls,
               constraintFn,
               expectedWounds,
               currentWounds
             );
           } else {
              if (currentWounds < expectedWounds) {
                finalRollObjects = initialRolls.map(v => {
                   if (constraintFn(v)) return { val: rollD6(), isRerolled: true };
                   return { val: v, isRerolled: false };
                });
              } else {
                finalRollObjects = initialRolls.map(v => ({ val: v, isRerolled: false }));
              }
           }
        }

        woundRolls = initialRolls;
        if (finalRollObjects.some(obj => obj.isRerolled)) {
          woundRollsRerolled = finalRollObjects.map(obj => obj.val);
        }

        finalRollObjects.forEach(obj => {
          let roll = obj.val;
          const isCrit = roll === 6 || roll >= antiTarget;
          if (isCrit && isDevastating) mortalWounds++;
          else if (isCrit || roll >= modifiedWoundTarget) wounds++;
        });
      }

      // 3. Save Step
      const finalWoundsCount = wounds + autoWounds;
      let failedSaves = 0;
      const svValue = Number(defender!.SV.replace('+', ''));
      let effectiveAP = weapon.AP;
      if (attacker!.faction === Faction.Tyranids && tyranidEnhancement === 1) effectiveAP -= 1;
      if (isPlungingFire && weapon.type === WeaponType.Ranged) effectiveAP -= 1;
      let coverBonus = (isInCover && !weapon.keywords.includes('無視掩體') && !(svValue <= 3 && effectiveAP === 0)) ? 1 : 0;
      
      const modifiedArmor = svValue - effectiveAP + modifiers.save - coverBonus;
      let invuln = defender!.invuln || 7;
      if (defender!.faction === Faction.Necrons && activeStratagems.includes('堅韌流體')) invuln = Math.min(invuln, 5);
      if (defender!.faction === Faction.Tyranids && tyranidEnhancement === 0 && defender!.id === 'tyranid_prime') invuln = Math.min(invuln, 4);
      if ((defender!.id === 'um_librarian' || joinedDefenderLeader?.id === 'um_librarian') && weapon.type === WeaponType.Ranged) invuln = Math.min(invuln, 4);

      const targetSave = selectedSaveType === 'armor' ? modifiedArmor : invuln;
      const finalSave = Math.max(2, Math.min(7, targetSave));
      const saveRolls: number[] = [];
      if (finalSave < 7) {
        for (let i = 0; i < finalWoundsCount; i++) {
          const roll = rollD6();
          saveRolls.push(roll);
          if (roll < finalSave) failedSaves++;
        }
      } else {
        failedSaves = finalWoundsCount;
      }

      // 4. Damage Step
      let profilePotentialDamage = 0;
      const hasRelentless = defender!.abilities.includes('不屈韌性');
      for (let i = 0; i < failedSaves + mortalWounds; i++) {
        let d = parseExpression(weapon.D) + modifiers.damage;
        if (hasRelentless) d = Math.max(1, d - 1);
        profilePotentialDamage += Math.max(1, d);
      }

      // 5. Logs for this profile
      logs.push({
        step: customName ? customName : `${model.name}${isLeader ? ' (領袖)' : ''} - ${weapon.name}`,
        result: `${profilePotentialDamage} 潛在傷害`,
        details: `攻擊:${totalA}, 命中:${hits+autoWounds}, 造傷:${finalWoundsCount}, 致命傷:${mortalWounds}, 救防失敗:${failedSaves}`,
        hitRolls,
        hitRollsRerolled,
        woundRolls,
        woundRollsRerolled,
        saveRolls
      });

      return profilePotentialDamage;
    };

    if (unitWeapon && joinedLeader && leaderWeapon && unitWeapon.name === leaderWeapon.name) {
      const combinedCount = numAttackingModels + numJoinedAttackingModels;
      totalCombinedDamage += await runProfile(attacker!, unitWeapon, combinedCount, false, `聯合單位 (共 ${combinedCount} 把) - ${unitWeapon.name}`);
    } else {
      if (unitWeapon) totalCombinedDamage += await runProfile(attacker!, unitWeapon, numAttackingModels, attacker!.keywords.includes('角色'));
      if (joinedLeader && leaderWeapon) totalCombinedDamage += await runProfile(joinedLeader, leaderWeapon, numJoinedAttackingModels, joinedLeader.keywords.includes('角色'));
    }

    // Final FNP
    let fnpValue = 7;
    if (defender!.abilities.some(a => a.includes('不覺疼痛'))) {
      const m = defender!.abilities.find(a => a.includes('不覺疼痛'))?.match(/\d+/);
      if (m) fnpValue = Number(m[0]);
    }

    let actualDamage = 0;
    if (fnpValue < 7) {
      const fnpRolls = [];
      for (let i = 0; i < totalCombinedDamage; i++) {
        const roll = rollD6();
        fnpRolls.push(roll);
        if (roll < fnpValue) actualDamage++;
      }
      logs.push({
        step: '不覺疼痛總判定',
        result: `${totalCombinedDamage - actualDamage} 抵擋`,
        details: `需 ${fnpValue}+。原受 ${totalCombinedDamage} 傷害，實際損血 ${actualDamage}。`,
        fnpRolls
      });
    } else {
      actualDamage = totalCombinedDamage;
    }

    setBattleResults({
      logs,
      totalDamage: actualDamage,
      deadModels: Math.floor(actualDamage / defender!.W)
    });
    
    if (hazardousTestRequired) runHazardousTest();
    else setIsHazardousFailed(null);
    
    setSimulationState('DONE');
  };

  const resetAll = () => {
    setAttacker(null);
    setJoinedLeader(null);
    setUnitWeapon(null);
    setLeaderWeapon(null);
    setDefender(null);
    setJoinedDefenderLeader(null);
    setBattleResults(null);
    setCurrentStepData(null);
    setSimulationState('IDLE');
    setModifiers({ hit: 0, wound: 0, save: 0, damage: 0 });
    setNumAttackingModels(1);
    setNumJoinedAttackingModels(1);
    setNumDefenderModels(1);
    setNumJoinedDefenderModels(1);
    setIsStationary(false);
    setInRapidFire(true);
    setIsInCover(false);
    setIsPlasmaCyte(false);
    setIsDamaged(false);
    setIsPsykerTarget(false);
    setIsBelowHalf(false);
    setIsBattleShocked(false);
    setIsOathTarget(false);
    setIsCharging(false);
    setIsFlyerTarget(false);
    setIsStealth(false);
    setIsPlungingFire(false);
    setIsInEngagementRange(false);
    setIsHazardousFailed(null);
    setQuickDice(null);
    setActiveStratagems([]);
    setTyranidEnhancement(null);
    setNecronEnhancement(null);
    setDaEnhancement(null);
    setUmEnhancement(null);
  };

  const toggleTyranidEnhancement = (idx: number) => {
    setTyranidEnhancement(prev => prev === idx ? null : idx);
  };

  const toggleNecronEnhancement = (idx: number) => {
    setNecronEnhancement(prev => prev === idx ? null : idx);
  };

  const toggleDaEnhancement = (idx: number) => {
    setDaEnhancement(prev => prev === idx ? null : idx);
  };

  const toggleUmEnhancement = (idx: number) => {
    setUmEnhancement(prev => prev === idx ? null : idx);
  };

  const rollQuickDice = (type: string) => {
    let val = 0;
    if (type === '1D6') val = Math.floor(Math.random() * 6) + 1;
    if (type === '2D6') val = (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1);
    if (type === '1D3') val = Math.ceil(Math.random() * 3);
    setQuickDice({ type, value: val });
  };

  const handleSwap = () => {
    if (!attacker && !defender) return;
    
    const oldAttacker = attacker;
    const oldNumAttacker = numAttackingModels;
    const oldDefender = defender;
    const oldNumDefender = numDefenderModels;

    setAttacker(oldDefender);
    setJoinedLeader(null); // Reset leader on swap
    setNumAttackingModels(oldNumDefender);
    setNumJoinedAttackingModels(1);
    setDefender(oldAttacker);
    setJoinedDefenderLeader(null);
    setNumDefenderModels(oldNumAttacker);
    setNumJoinedDefenderModels(1);
    
    setUnitWeapon(null);
    setLeaderWeapon(null);
    setBattleResults(null);
    setCurrentStepData(null);
  };

  const toggleStratagem = (name: string) => {
    setActiveStratagems(prev => 
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const toggleFactionVisibility = (f: Faction) => {
    setVisibleFactions(prev => 
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const unitWeaponHas = (k: string) => unitWeapon?.keywords.some(keyword => keyword.includes(k));
  const leaderWeaponHas = (k: string) => leaderWeapon?.keywords.some(keyword => keyword.includes(k));
  const anyWeaponHas = (k: string) => unitWeaponHas(k) || leaderWeaponHas(k);
  const anyWeaponIsType = (t: WeaponType) => unitWeapon?.type === t || leaderWeapon?.type === t;

  const filteredUnits = useMemo(() => {
    return COMBAT_PATROL_UNITS.filter(u => visibleFactions.includes(u.faction));
  }, [visibleFactions]);

  const filteredDefenders = useMemo(() => {
    return COMBAT_PATROL_UNITS.filter(u => 
      visibleFactions.includes(u.faction) && 
      (!isFoolproofMode || u.faction !== attacker?.faction)
    );
  }, [visibleFactions, isFoolproofMode, attacker]);

  const weaponMatchError = useMemo(() => {
    if (unitWeapon && leaderWeapon && unitWeapon.name !== leaderWeapon.name) {
      return "警告：不同武器 profile 建議分開計算（或確保其屬性一致）。";
    }
    return null;
  }, [unitWeapon, leaderWeapon]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      <header className="max-w-6xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-red-600 rounded-xl shadow-lg shadow-red-900/20">
            <Dices className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              40K 戰鬥巡邏隊
            </h1>
            <p className="text-slate-400 font-mono text-sm tracking-wide">DICE CALCULATION SYSTEM V1.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-8 flex-wrap justify-end">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl shadow-inner">
              {[ '1D6', '2D6', '1D3' ].map(type => (
                <button
                  key={type}
                  onClick={() => rollQuickDice(type)}
                  className="px-6 py-3 bg-slate-800 hover:bg-red-600 hover:text-white text-slate-300 rounded-xl text-lg font-black transition-all border border-slate-700/50 shadow-md transform active:scale-90 active:bg-red-700"
                >
                  {type}
                </button>
              ))}
            </div>
            {quickDice && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                key={`${quickDice.type}-${quickDice.value}-${Date.now()}`}
                className="flex flex-col items-center justify-center bg-red-600 min-w-[80px] py-2 rounded-2xl shadow-xl shadow-red-900/40 border border-red-500"
              >
                <span className="text-[10px] font-black text-red-200 uppercase tracking-tighter mb-0.5">{quickDice.type} 結果</span>
                <span className="text-3xl font-black text-white leading-none drop-shadow-md">{quickDice.value}</span>
              </motion.div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFoolproofMode(!isFoolproofMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border font-bold text-xs transition-all ${
                isFoolproofMode 
                  ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-900/20' 
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isFoolproofMode ? 'animate-pulse' : ''}`} />
              防呆模式 {isFoolproofMode ? 'ON' : 'OFF'}
            </button>
            <div className="flex items-center gap-1.5 bg-slate-900/40 p-1 rounded-lg border border-slate-800/50">
                  {Object.values(Faction).map(f => (
                    <button
                      key={f}
                      onClick={() => toggleFactionVisibility(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        visibleFactions.includes(f) 
                          ? 'bg-slate-700 border-slate-500 text-white shadow-sm' 
                          : 'bg-slate-950 border-slate-900 text-slate-700 opacity-50'
                      }`}
                    >
                      {getFactionIcon(f)} {f}
                    </button>
                  ))}
            </div>
            <button 
              onClick={resetAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all text-sm font-bold border border-slate-700 shadow-lg text-slate-300"
            >
              <RotateCcw className="w-4 h-4" /> 重置
            </button>
          </div>
        </div>

    </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <section className="lg:col-span-7 space-y-8">
          
          {/* Attacker Block */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sword className="w-24 h-24 text-red-500" />
            </div>
            
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-red-500" /> 選擇攻擊方
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-2 uppercase tracking-widest">選擇主要單位 (Primary Unit)</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-red-500/50 outline-none transition-all cursor-pointer shadow-inner"
                  value={attacker?.id || ''}
                  onChange={(e) => {
                    const u = COMBAT_PATROL_UNITS.find(u => u.id === e.target.value) || null;
                    setAttacker(u);
                    setJoinedLeader(null);
                    setUnitWeapon(null);
                    setLeaderWeapon(null);
                    if (u) setNumAttackingModels(u.maxModels);
                  }}
                >
                  <option value="">-- 請選擇 --</option>
                  {filteredUnits.filter(u => !defender || u.id !== defender.id).map(u => (
                    <option key={u.id} value={u.id}>
                      {getFactionIcon(u.faction)} {u.name}
                      {u.keywords.includes('角色') ? ' [領袖]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {attacker && (() => {
                const availableLeaders = filteredUnits.filter(u => u.canLead?.includes(attacker.id));
                const availableBodyguards = attacker.canLead ? filteredUnits.filter(u => attacker.canLead?.includes(u.id)) : [];
                const hasLeadershipOption = availableLeaders.length > 0 || availableBodyguards.length > 0;
                
                if (!hasLeadershipOption) return null;

                const isBodyguard = availableLeaders.length > 0;

                return (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                    <label className="block text-xs font-mono text-slate-500 mb-2 uppercase tracking-widest">
                      {isBodyguard ? '附屬領袖 (Attached Leader)' : '帶領單位 (Bodyguard Unit)'}
                    </label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-red-500/50 outline-none transition-all cursor-pointer"
                      value={joinedLeader?.id || ''}
                      onChange={(e) => {
                        const l = COMBAT_PATROL_UNITS.find(u => u.id === e.target.value) || null;
                        setJoinedLeader(l);
                        if (l) setNumJoinedAttackingModels(l.maxModels);
                        setUnitWeapon(null);
                        setLeaderWeapon(null);
                      }}
                    >
                      <option value="">{isBodyguard ? '-- 無領袖 --' : '-- 獨自行動 --'}</option>
                      {(isBodyguard ? availableLeaders : availableBodyguards).map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </motion.div>
                );
              })()}

              {attacker && (
                <div className="mt-6 pt-6 border-t border-slate-800">
                  <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">裝備與武裝</h3>
                  
                  <div className={`grid gap-4 ${joinedLeader ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400 font-bold uppercase">{attacker.name} 武器</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm transition-all focus:border-red-500 outline-none"
                        value={unitWeapon?.name || ''}
                        onChange={(e) => {
                          const w = attacker.weapons.find(w => w.name === e.target.value) || null;
                          setUnitWeapon(w);
                        }}
                      >
                        <option value="">-- 選擇武器 --</option>
                        {attacker.weapons.map(w => (
                          <option key={w.name} value={w.name}>({w.type}) {w.name}</option>
                        ))}
                      </select>
                    </div>

                    {joinedLeader && (
                      <div className="space-y-2">
                        <label className="block text-[10px] text-purple-400 font-bold uppercase">{joinedLeader.name} (領袖) 武器</label>
                        <select 
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm transition-all focus:border-purple-500 outline-none"
                          value={leaderWeapon?.name || ''}
                          onChange={(e) => {
                            const w = joinedLeader.weapons.find(w => w.name === e.target.value) || null;
                            setLeaderWeapon(w);
                          }}
                        >
                          <option value="">-- 選擇武器 --</option>
                          {joinedLeader.weapons.map(w => (
                            <option key={`${joinedLeader.id}-${w.name}`} value={w.name}>({w.type}) {w.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {attacker && (unitWeapon || leaderWeapon) && (
              <div className="mt-6 space-y-4">
                {unitWeapon && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-950/50 border border-slate-800 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800/50">
                      <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{attacker.name} - {unitWeapon.name}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center mb-3">
                      <div><p className="text-[9px] text-slate-500 uppercase">A</p><p className="text-sm font-bold text-red-400">{unitWeapon.A}</p></div>
                      <div><p className="text-[9px] text-slate-500 uppercase">{unitWeapon.type === WeaponType.Ranged ? 'BS' : 'WS'}</p><p className="text-sm font-bold">{unitWeapon.BS_WS}</p></div>
                      <div><p className="text-[9px] text-slate-500 uppercase">S</p><p className="text-sm font-bold">{unitWeapon.S}</p></div>
                      <div><p className="text-[9px] text-slate-500 uppercase">AP</p><p className="text-sm font-bold">{unitWeapon.AP}</p></div>
                      <div><p className="text-[9px] text-slate-500 uppercase">D</p><p className="text-sm font-bold text-red-400">{unitWeapon.D}</p></div>
                    </div>
                    {unitWeapon.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {unitWeapon.keywords.map(k => (
                          <span key={k} className="px-1.5 py-0.5 bg-red-950/30 text-red-400 border border-red-900/50 rounded text-[9px] font-bold uppercase">{k}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {joinedLeader && leaderWeapon && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-slate-950/50 border border-purple-900/30 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-purple-900/20">
                      <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">{joinedLeader.name} - {leaderWeapon.name}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center mb-3">
                      <div><p className="text-[9px] text-slate-500 uppercase">A</p><p className="text-sm font-bold text-purple-400">{leaderWeapon.A}</p></div>
                      <div><p className="text-[9px] text-slate-500 uppercase">{leaderWeapon.type === WeaponType.Ranged ? 'BS' : 'WS'}</p><p className="text-sm font-bold">{leaderWeapon.BS_WS}</p></div>
                      <div><p className="text-[9px] text-slate-500 uppercase">S</p><p className="text-sm font-bold">{leaderWeapon.S}</p></div>
                      <div><p className="text-[9px] text-slate-500 uppercase">AP</p><p className="text-sm font-bold">{leaderWeapon.AP}</p></div>
                      <div><p className="text-[9px] text-slate-500 uppercase">D</p><p className="text-sm font-bold text-purple-400">{leaderWeapon.D}</p></div>
                    </div>
                    {leaderWeapon.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {leaderWeapon.keywords.map(k => (
                          <span key={k} className="px-1.5 py-0.5 bg-purple-950/30 text-purple-400 border border-purple-900/50 rounded text-[9px] font-bold uppercase">{k}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-600/10 rounded-lg"><Users className="w-4 h-4 text-red-500" /></div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-mono uppercase">{attacker.name}</p>
                        <p className="text-xs font-bold text-slate-300">攻擊人數</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="1"
                        max={attacker.maxModels}
                        value={numAttackingModels}
                        onChange={(e) => setNumAttackingModels(Number(e.target.value))}
                        className="w-24 accent-red-600"
                      />
                      <span className="text-lg font-bold text-white w-6">{numAttackingModels}</span>
                    </div>
                  </div>

                  {joinedLeader && (
                    <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-purple-900/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-600/10 rounded-lg"><Users className="w-4 h-4 text-purple-500" /></div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-mono uppercase">{joinedLeader.name}</p>
                          <p className="text-xs font-bold text-slate-300">附屬單位/領袖數量</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input 
                          type="range"
                          min="1"
                          max={joinedLeader.maxModels}
                          value={numJoinedAttackingModels}
                          onChange={(e) => setNumJoinedAttackingModels(Number(e.target.value))}
                          className="w-24 accent-purple-600"
                        />
                        <span className="text-lg font-bold text-white w-6">{numJoinedAttackingModels}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center -my-4 relative z-10">
            <button 
              onClick={handleSwap}
              className="p-3 bg-slate-800 border border-slate-700 rounded-full hover:bg-slate-700 hover:border-slate-600 transition-all group shadow-xl"
              title="交換攻守單元"
            >
              <ArrowUpDown className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* Defender Block */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm">
             <div className="absolute top-0 right-0 p-4 opacity-10">
              <Shield className="w-24 h-24 text-blue-500" />
            </div>

            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-blue-500" /> 選擇防禦方
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-2 uppercase tracking-widest">目標單位 (Defender Unit)</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all cursor-pointer shadow-inner"
                  value={defender?.id || ''}
                  onChange={(e) => {
                    const u = COMBAT_PATROL_UNITS.find(u => u.id === e.target.value) || null;
                    setDefender(u);
                    setJoinedDefenderLeader(null);
                    if (u) {
                      setNumDefenderModels(u.maxModels);
                      
                      // Auto-detect Stealth
                      const hasStealth = u.abilities.includes('隱秘') || u.keywords.includes('隱秘');
                      setIsStealth(hasStealth);

                      // Default to best save
                      const bestWeapon = unitWeapon || leaderWeapon;
                      if (u.invuln && bestWeapon) {
                        const modifiedArmor = Number(u.SV.replace('+', '')) - bestWeapon.AP + modifiers.save;
                        setSelectedSaveType(u.invuln < modifiedArmor ? 'invuln' : 'armor');
                      } else {
                        setSelectedSaveType('armor');
                      }
                    }
                  }}
                >
                  <option value="">-- 請選擇 --</option>
                  {filteredDefenders.filter(u => !attacker || u.id !== attacker.id).map(u => (
                    <option key={u.id} value={u.id}>
                      {getFactionIcon(u.faction)} {u.name}
                      {u.keywords.includes('角色') ? ' [領袖]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {defender && (() => {
                const availableLeaders = filteredUnits.filter(u => u.canLead?.includes(defender.id));
                const isBodyguard = availableLeaders.length > 0;
                
                if (!isBodyguard) return null;

                return (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                    <label className="block text-xs font-mono text-slate-500 mb-2 uppercase tracking-widest">
                      附屬領袖 (Attached Leader)
                    </label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500/50 outline-none transition-all cursor-pointer"
                      value={joinedDefenderLeader?.id || ''}
                      onChange={(e) => {
                        const l = COMBAT_PATROL_UNITS.find(u => u.id === e.target.value) || null;
                        setJoinedDefenderLeader(l);
                      }}
                    >
                      <option value="">-- 無領袖 --</option>
                      {availableLeaders.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </motion.div>
                );
              })()}
            </div>

            {defender && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 bg-slate-950/50 border border-slate-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center"
              >
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-mono uppercase">韌性 T</p>
                  <p className="text-xl font-bold text-blue-400">{defender.T}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-mono uppercase">盔甲 SV</p>
                  <p className="text-xl font-bold text-blue-100">{defender.SV}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-mono uppercase">血量 W</p>
                  <p className="text-xl font-bold text-blue-100">{defender.W}</p>
                </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 font-mono uppercase">{defender.name} 模型</p>
                    <div className="flex items-center justify-center gap-2">
                      <input 
                        type="range"
                        min="1"
                        max={defender.maxModels}
                        value={numDefenderModels}
                        onChange={(e) => setNumDefenderModels(Number(e.target.value))}
                        className="w-16 accent-blue-500"
                      />
                      <span className="text-xs font-bold text-white w-4">{numDefenderModels}</span>
                    </div>
                  </div>
                  {joinedDefenderLeader && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-slate-500 font-mono uppercase">附屬/領袖</p>
                      <div className="flex items-center justify-center gap-2">
                        <input 
                          type="range"
                          min="1"
                          max={joinedDefenderLeader.maxModels}
                          value={numJoinedDefenderModels}
                          onChange={(e) => setNumJoinedDefenderModels(Number(e.target.value))}
                          className="w-16 accent-blue-400"
                        />
                        <span className="text-xs font-bold text-white w-4">{numJoinedDefenderModels}</span>
                      </div>
                    </div>
                  )}
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-mono uppercase">特種保 Invuln</p>
                  <p className="text-xl font-bold text-blue-300">{defender.invuln ? `${defender.invuln}++` : '-'}</p>
                </div>
                {defender.abilities.includes('不屈韌性') && (
                  <div className="col-span-full mt-2 py-1.5 px-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center justify-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-bold text-blue-300 uppercase tracking-tight">被動技能: 不屈韌性 (-1 傷害修正)</span>
                  </div>
                )}
              </motion.div>
            )}

            {defender && (
               <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }}
                 className="mt-4 flex flex-col gap-4"
               >
                 <div className="flex justify-between items-center bg-slate-950 p-4 border border-slate-800 rounded-xl">
                   <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-lg ${isInCover ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                       <Shield className="w-5 h-5" />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-slate-100">掩體保護 (Benefit of Cover)</p>
                       <p className="text-[10px] text-slate-500 font-mono">盔甲保獲得 +1 修正</p>
                     </div>
                   </div>
                   <button 
                     onClick={() => setIsInCover(!isInCover)}
                     className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${isInCover ? 'bg-blue-600' : 'bg-slate-700'}`}
                   >
                     <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isInCover ? 'translate-x-6' : 'translate-x-0'}`} />
                   </button>
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">保命選擇 (默認最佳)</label>
                   <div className="flex gap-2">
                   <button 
                     onClick={() => setSelectedSaveType('armor')}
                     className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${selectedSaveType === 'armor' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                   >
                      盔甲保 SV: {defender.SV}
                      {unitWeapon && (
                        <span className="block text-[9px] opacity-70">
                          單位修後: {Math.max(2, Math.min(7, Number(defender.SV.replace('+', '')) - (unitWeapon.AP + (attacker?.faction === Faction.Tyranids && tyranidEnhancement === 1 ? -1 : 0)) + modifiers.save + (isInCover ? -1 : 0)))}+
                        </span>
                      )}
                      {leaderWeapon && (
                        <span className="block text-[9px] opacity-70">
                          領袖修後: {Math.max(2, Math.min(7, Number(defender.SV.replace('+', '')) - (leaderWeapon.AP + (attacker?.faction === Faction.Tyranids && tyranidEnhancement === 1 ? -1 : 0)) + modifiers.save + (isInCover ? -1 : 0)))}+
                        </span>
                      )}
                   </button>
                   {(defender.invuln || (defender.faction === Faction.Necrons && activeStratagems.includes('堅韌流體'))) && (
                     <button 
                       onClick={() => setSelectedSaveType('invuln')}
                       className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${selectedSaveType === 'invuln' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                     >
                       特種保 {Math.min(defender.invuln || 7, (defender.faction === Faction.Necrons && activeStratagems.includes('堅韌流體')) ? 5 : 7)}++
                     </button>
                   )}
                 </div>
               </div>
             </motion.div>
            )}
          </div>

          {/* Enhancements & Stratagems Panel */}
          {(attacker || defender) && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-6"
            >
              <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                <Crosshair className="w-5 h-5 text-purple-500" /> 強化與計謀支援 (Faction Support)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Attacker Faction Support */}
                {attacker && (
                  <div className="space-y-4">
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       攻擊方強化 ({attacker.faction})
                    </p>
                    <div className="space-y-2">
                      {FACTION_RULES[attacker.faction].enhancements.map((eh, idx) => {
                        // Skip Mental Shackles (idx 0) for Tyranids in Attacker section as it is a defensive aura
                        if (attacker.faction === Faction.Tyranids && idx === 0) return null;
                        
                        return (
                          <button
                            key={eh.name}
                            onClick={() => {
                              if (attacker.faction === Faction.Tyranids) toggleTyranidEnhancement(idx);
                              else if (attacker.faction === Faction.Necrons) toggleNecronEnhancement(idx);
                              else if (attacker.faction === Faction.DarkAngels) toggleDaEnhancement(idx);
                              else toggleUmEnhancement(idx);
                            }}
                            className={`w-full text-left p-3 rounded-xl border transition-all ${
                              (attacker.faction === Faction.Tyranids ? tyranidEnhancement === idx : (attacker.faction === Faction.Necrons ? necronEnhancement === idx : (attacker.faction === Faction.DarkAngels ? daEnhancement === idx : umEnhancement === idx)))
                                ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-900/20'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <p className={`text-sm font-bold ${
                               (attacker.faction === Faction.Tyranids ? tyranidEnhancement === idx : (attacker.faction === Faction.Necrons ? necronEnhancement === idx : (attacker.faction === Faction.DarkAngels ? daEnhancement === idx : umEnhancement === idx))) ? 'text-purple-300' : 'text-slate-300'
                            }`}>{eh.name}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{eh.description}</p>
                          </button>
                        );
                      })}
                    </div>
                    
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-6">攻擊方計謀 (Offensive)</p>
                    <div className="flex flex-col gap-2">
                      {FACTION_RULES[attacker.faction].stratagems.filter(s => s.type === 'Offensive').map(s => (
                        <button
                          key={s.name}
                          onClick={() => toggleStratagem(s.name)}
                          className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                            activeStratagems.includes(s.name)
                              ? 'bg-red-600/20 border-red-500'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-200">{s.name}</p>
                            <p className="text-[10px] text-slate-500">{s.description}</p>
                          </div>
                          <span className="bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-400">{s.cost}CP</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Defender Faction Support */}
                {defender && (
                  <div className="space-y-4">
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest flex items-center gap-2">
                       防禦方強化 ({defender.faction})
                    </p>
                    <div className="space-y-2">
                      {FACTION_RULES[defender.faction].enhancements.map((eh, idx) => {
                        // Tyranids: Only show Mental Shackles (idx 0) if defender is Prime and hide Adrenal Stimulants (idx 1)
                        if (defender.faction === Faction.Tyranids) {
                          if (idx === 0 && defender.id !== 'tyranid_prime') return null;
                          if (idx === 1) return null;
                        }
                        // Necrons: Both current enhancements are offensive, hide them from defender section? 
                        // Actually let's keep them if user wants, but user specifically asked for Tyranid logic.
                        if (defender.faction === Faction.Necrons) return null;

                        return (
                          <button
                            key={eh.name}
                            onClick={() => {
                                if (defender.faction === Faction.Tyranids) toggleTyranidEnhancement(idx);
                                else if (defender.faction === Faction.Necrons) toggleNecronEnhancement(idx);
                                else if (defender.faction === Faction.DarkAngels) toggleDaEnhancement(idx);
                                else toggleUmEnhancement(idx);
                            }}
                            className={`w-full text-left p-3 rounded-xl border transition-all ${
                              (defender.faction === Faction.Tyranids ? tyranidEnhancement === idx : (defender.faction === Faction.Necrons ? necronEnhancement === idx : (defender.faction === Faction.DarkAngels ? daEnhancement === idx : umEnhancement === idx)))
                                ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-900/20'
                                : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <p className={`text-sm font-bold ${
                               (defender.faction === Faction.Tyranids ? tyranidEnhancement === idx : (defender.faction === Faction.Necrons ? necronEnhancement === idx : (defender.faction === Faction.DarkAngels ? daEnhancement === idx : umEnhancement === idx))) ? 'text-blue-300' : 'text-slate-300'
                            }`}>{eh.name}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{eh.description}</p>
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-6">防禦方計謀 (Defensive)</p>
                    <div className="flex flex-col gap-2">
                      {FACTION_RULES[defender.faction].stratagems.filter(s => s.type === 'Defensive').map(s => (
                        <button
                          key={s.name}
                          onClick={() => toggleStratagem(s.name)}
                          className={`flex justify-between items-center p-3 rounded-xl border transition-all ${
                            activeStratagems.includes(s.name)
                              ? 'bg-blue-600/20 border-blue-500'
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-200">{s.name}</p>
                            <p className="text-[10px] text-slate-500">{s.description}</p>
                          </div>
                          <span className="bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-slate-400">{s.cost}CP</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Modifiers & Tactical Options */}
          {(attacker && defender) && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-200">
                <Zap className="w-5 h-5 text-amber-500" /> 戰術修正與細節
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">關鍵字激活</p>
                  {anyWeaponHas('重型') && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={isStationary} onChange={() => setIsStationary(!isStationary)} />
                      <div className={`w-5 h-5 rounded border ${isStationary ? 'bg-amber-500 border-amber-500' : 'border-slate-600'}`} />
                      <span className={`text-sm ${isStationary ? 'text-white' : 'text-slate-400'}`}>[重型] 已保持靜止 (命中+1)</span>
                    </label>
                  )}
                  {anyWeaponIsType(WeaponType.Ranged) && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={isPlungingFire} onChange={() => setIsPlungingFire(!isPlungingFire)} />
                      <div className={`w-5 h-5 rounded border ${isPlungingFire ? 'bg-amber-500 border-amber-500' : 'border-slate-600'}`} />
                      <span className={`text-sm ${isPlungingFire ? 'text-white' : 'text-slate-400'}`}>[高處火力] 攻擊者位於 6" 以上高處 (AP+1)</span>
                    </label>
                  )}
                  {anyWeaponHas('速射') && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={inRapidFire} onChange={() => setInRapidFire(!inRapidFire)} />
                      <div className={`w-5 h-5 rounded border ${inRapidFire ? 'bg-amber-500 border-amber-500' : 'border-slate-600'}`} />
                      <span className={`text-sm ${inRapidFire ? 'text-white' : 'text-slate-400'}`}>[速射] 處於半程距離內 (攻擊次數增加)</span>
                    </label>
                  )}
                  {attacker?.id === 'skorpekh_destroyers' && anyWeaponIsType(WeaponType.Melee) && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={isPlasmaCyte} onChange={() => setIsPlasmaCyte(!isPlasmaCyte)} />
                      <div className={`w-5 h-5 rounded border ${isPlasmaCyte ? 'bg-purple-500 border-purple-500' : 'border-slate-600'}`} />
                      <span className={`text-sm ${isPlasmaCyte ? 'text-white' : 'text-slate-400'}`}>[等離子蟲] 本階段獲得 [毀滅傷害]</span>
                    </label>
                  )}
                  {attacker?.id === 'psychophage' && (
                    <>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" className="hidden" checked={isBelowHalf} onChange={() => setIsBelowHalf(!isBelowHalf)} />
                        <div className={`w-5 h-5 rounded border ${isBelowHalf ? 'bg-purple-500 border-purple-500' : 'border-slate-600 shadow-inner'}`} />
                        <span className={`text-sm ${isBelowHalf ? 'text-white' : 'text-slate-400'}`}>[瘋狂進食] 目標單位低於半數生命 (近戰命中+1)</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" className="hidden" checked={isBattleShocked} onChange={() => setIsBattleShocked(!isBattleShocked)} />
                        <div className={`w-5 h-5 rounded border ${isBattleShocked ? 'bg-purple-500 border-purple-500' : 'border-slate-600 shadow-inner'}`} />
                        <span className={`text-sm ${isBattleShocked ? 'text-white' : 'text-slate-400'}`}>[瘋狂進食] 目標單位已戰慄 (近戰造傷+1)</span>
                      </label>
                    </>
                  )}
                  {(attacker?.faction === Faction.DarkAngels || attacker?.faction === Faction.Ultramarines) && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={isOathTarget} onChange={() => setIsOathTarget(!isOathTarget)} />
                      <div className={`w-5 h-5 rounded border ${isOathTarget ? 'bg-red-500 border-red-500' : 'border-slate-600'}`} />
                      <span className={`text-sm ${isOathTarget ? 'text-white' : 'text-slate-400'}`}>[破敵重誓] 目標為當前盟誓單位 (重擲命中)</span>
                    </label>
                  )}
                  {attacker?.faction === Faction.Ultramarines && attacker?.id === 'um_captain' && (
                    <p className="text-[9px] text-purple-400/80 font-mono italic px-1">自動開啟 [奧克塔維斯連長] 特殊規則，其近戰擁有精准與致命一擊。</p>
                  )}
                  {attacker?.faction === Faction.Ultramarines && attacker?.id === 'um_librarian' && (
                    <p className="text-[9px] text-purple-400/80 font-mono italic px-1">自動開啟 [智庫員坦圖斯] 特殊規則，其單位裝備擁有持續打擊 1。</p>
                  )}
                  {defender?.faction === Faction.DarkAngels && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={isCharging} onChange={() => setIsCharging(!isCharging)} />
                      <div className={`w-5 h-5 rounded border ${isCharging ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`} />
                      <span className={`text-sm ${isCharging ? 'text-white' : 'text-slate-400'}`}>[衝鋒] 攻擊方本回合發起了衝鋒</span>
                    </label>
                  )}
                  {attacker?.id === 'da_intercessors' && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={activeStratagems.includes('莫德凱的教誨')} onChange={() => toggleStratagem('莫德凱的教誨')} />
                      <div className={`w-5 h-5 rounded border ${activeStratagems.includes('莫德凱的教誨') ? 'bg-red-500 border-red-500' : 'border-slate-600'}`} />
                      <span className={`text-sm ${activeStratagems.includes('莫德凱的教誨') ? 'text-white' : 'text-slate-400'}`}>[莫德凱教導] 牧師在單位中 (近戰致傷+1)</span>
                    </label>
                  )}
                  {attacker?.id === 'da_redemptor' && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={isDamaged} onChange={() => setIsDamaged(!isDamaged)} />
                      <div className={`w-5 h-5 rounded border ${isDamaged ? 'bg-orange-500 border-orange-500' : 'border-slate-600'}`} />
                      <span className={`text-sm ${isDamaged ? 'text-white' : 'text-slate-400'}`}>[受損] 剩餘生命值 1-4 (命中擲骰 -1)</span>
                    </label>
                  )}
                  {defender && isStealth && (
                    <div className="flex items-center gap-3 group">
                      <div className="w-5 h-5 rounded border bg-blue-600 border-blue-600" />
                      <span className="text-sm text-white">[隱秘] 目標單位具備隱秘效果 (遠程命中-1)</span>
                    </div>
                  )}
                  {anyWeaponHas('針對飛行') && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={isFlyerTarget} onChange={() => setIsFlyerTarget(!isFlyerTarget)} />
                      <div className={`w-5 h-5 rounded border ${isFlyerTarget ? 'bg-blue-400 border-blue-400' : 'border-slate-600'}`} />
                      <span className={`text-sm ${isFlyerTarget ? 'text-white' : 'text-slate-400'}`}>[針對飛行] 目標單位具備 [飛行] 關鍵字</span>
                    </label>
                  )}
                  {anyWeaponHas('針對靈能者') && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={isPsykerTarget} onChange={() => setIsPsykerTarget(!isPsykerTarget)} />
                      <div className={`w-5 h-5 rounded border ${isPsykerTarget ? 'bg-blue-400 border-blue-400' : 'border-slate-600'}`} />
                      <span className={`text-sm ${isPsykerTarget ? 'text-white' : 'text-slate-400'}`}>[針對靈能者] 目標單位具備 [靈能者] 關鍵字</span>
                    </label>
                  )}
                  {anyWeaponIsType(WeaponType.Ranged) && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" className="hidden" checked={isInEngagementRange} onChange={() => setIsInEngagementRange(!isInEngagementRange)} />
                      <div className={`w-5 h-5 rounded border ${isInEngagementRange ? 'bg-orange-500 border-orange-500' : 'border-slate-600'}`} />
                      <span className={`text-sm ${isInEngagementRange ? 'text-white' : 'text-slate-400'}`}>[交戰距離] 單位處於敵方交戰距離內</span>
                    </label>
                  )}
                  {isInEngagementRange && anyWeaponIsType(WeaponType.Ranged) && (
                    <div className="p-3 bg-orange-950/20 border border-orange-900/30 rounded-lg flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-orange-500 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] text-orange-400 leading-tight">
                          <strong>注意 [大炮長鳴]：</strong> 單位處於交戰距離內。
                        </p>
                        {attacker?.keywords.some(k => k === '載具' || k === '怪獸') || defender?.keywords.some(k => k === '載具' || k === '怪獸') ? (
                          <p className="text-[9px] text-orange-500/80">因為包含載具/怪獸，命中擲骰已自動應用 -1 修正。</p>
                        ) : (
                          <p className="text-[9px] text-red-500 font-bold">步兵單位在交戰距離內除非具備 [手槍]，否則無法射擊！</p>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-600 italic">系統會自動檢測 [洪流]、[致命一擊]、[雙聯]、[毀滅傷害] 與 [持續打擊]</p>
                </div>

                <div className="space-y-3">
                  <div 
                    className="flex items-center justify-between cursor-pointer group hover:opacity-80 transition-all"
                    onClick={() => setShowManualMods(!showManualMods)}
                  >
                    <p className="text-xs font-mono text-slate-500 uppercase tracking-widest group-hover:text-slate-300">手動數值修正</p>
                    <ArrowUpDown className={`w-3 h-3 transition-transform ${showManualMods ? 'rotate-180 text-blue-500' : 'text-slate-600'}`} />
                  </div>
                  
                  {showManualMods && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs overflow-hidden"
                    >
                      <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                        <span className="text-slate-400">命中修正</span>
                        <input type="number" value={modifiers.hit} onChange={(e) => setModifiers({...modifiers, hit: Number(e.target.value)})} className="w-8 bg-transparent text-right font-bold text-white" />
                      </div>
                      <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                        <span className="text-slate-400">造傷修正</span>
                        <input type="number" value={modifiers.wound} onChange={(e) => setModifiers({...modifiers, wound: Number(e.target.value)})} className="w-8 bg-transparent text-right font-bold text-white" />
                      </div>
                      <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                        <span className="text-slate-400">防禦修正</span>
                        <input type="number" value={modifiers.save} onChange={(e) => setModifiers({...modifiers, save: Number(e.target.value)})} className="w-8 bg-transparent text-right font-bold text-white" />
                      </div>
                      <div className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                        <span className="text-slate-400">傷害加成</span>
                        <input type="number" value={modifiers.damage} onChange={(e) => setModifiers({...modifiers, damage: Number(e.target.value)})} className="w-8 bg-transparent text-right font-bold text-white" />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {weaponMatchError && (
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg flex items-start gap-2 mt-4">
                  <Info className="w-4 h-4 text-red-500 mt-0.5" />
                  <p className="text-[10px] text-red-400 leading-tight">
                    {weaponMatchError}
                  </p>
                </div>
              )}
              
              <div className="mt-6 flex justify-between items-center bg-slate-950/50 p-2 px-3 rounded-lg border border-slate-800">
                <span className="text-sm text-slate-300 font-medium">手動重擲骰判定模式</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isInteractiveMode} onChange={() => setIsInteractiveMode(!isInteractiveMode)} />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              {anyWeaponHas('爆炸') && isInEngagementRange ? (
                <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg flex items-start gap-2 mt-8">
                  <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5" />
                  <p className="text-[10px] text-red-400 leading-tight">
                    <strong>禁射 [爆炸]：</strong> 具備 [爆炸] 屬性的武器不能射擊處於交戰距離內的單位。
                  </p>
                </div>
              ) : (
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={(simulationState !== 'IDLE' && simulationState !== 'DONE') || !!weaponMatchError}
                  onClick={startSimulation}
                  className={`w-full mt-4 py-4 text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-3 transition-all ${
                    ((simulationState !== 'IDLE' && simulationState !== 'DONE') || !!weaponMatchError)
                      ? 'bg-slate-800 cursor-not-allowed text-slate-500 opacity-60' 
                      : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-red-900/20'
                  }`}
                >
                  <Flame className="w-6 h-6" /> 
                  {simulationState === 'IDLE' ? '按下此處進行「真實隨機擲骰」' : '再次執行模擬'}
                </motion.button>
              )}
            </div>
          )}
        </section>

        {/* Right Side: Results Log */}
        <section className="lg:col-span-5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl h-full flex flex-col backdrop-blur-sm sticky top-8 max-h-[85vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-slate-400" /> 戰鬥模擬記錄
              </h2>
              {battleResults && (
                <div className="flex items-center gap-1 text-red-500 text-sm font-bold">
                  <Skull className="w-4 h-4" /> 預計擊殺: {battleResults.deadModels}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {simulationState === 'IDLE' && !battleResults ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center space-y-4">
                  <Dices className="w-16 h-16 opacity-10" />
                  <p className="text-sm font-mono uppercase tracking-widest">等待指揮官下達攻擊指令...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {battleResults ? battleResults.logs.map((log, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="group"
                    >
                      <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 group-hover:border-slate-700 transition-colors">
                        <div className="mt-1 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {idx + 1}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-center">
                            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest">{log.step}</h3>
                            <span className="text-sm font-bold text-slate-100">{log.result}</span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{log.details}</p>
                          {log.hitRolls && log.hitRolls.length > 0 && (
                             <div className="mt-2 flex flex-col gap-1">
                               <div className="flex flex-wrap gap-1 items-center">
                                 <span className="text-[10px] text-slate-500 w-12 shrink-0">{log.hitRollsRerolled ? '命中(原):' : '命中:'}</span>
                                 {log.hitRolls.slice(0, 30).map((r, rIdx) => (
                                   <span key={rIdx} className={`min-w-5 px-1 h-5 rounded-sm flex items-center justify-center text-[10px] font-mono border ${r === 6 ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                     {r}
                                   </span>
                                 ))}
                                 {log.hitRolls.length > 30 && <span className="text-[10px] text-slate-700 self-end">...</span>}
                               </div>
                               {log.hitRollsRerolled && log.hitRollsRerolled.length > 0 && (
                                 <div className="flex flex-wrap gap-1 items-center">
                                   <span className="text-[10px] w-12 shrink-0 text-red-500 font-bold">重新投擲:</span>
                                   {log.hitRollsRerolled.slice(0, 30).map((r, rIdx) => {
                                     const isChanged = r !== log.hitRolls![rIdx];
                                     return (
                                       <span key={rIdx} className={`min-w-5 px-1 h-5 rounded-sm flex items-center justify-center text-[10px] font-mono border ${isChanged ? (r === 6 ? 'bg-red-500/30 border-red-400 text-red-300 outline outline-1 outline-red-500/50' : 'bg-slate-700 border-slate-500 text-slate-300 outline outline-1 outline-slate-500/50') : (r === 6 ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-slate-800 border-slate-700 text-slate-500')}`}>
                                         {r}
                                       </span>
                                     );
                                   })}
                                   {log.hitRollsRerolled.length > 30 && <span className="text-[10px] text-slate-700 self-end">...</span>}
                                 </div>
                               )}
                             </div>
                          )}
                          {log.woundRolls && log.woundRolls.length > 0 && (
                             <div className="mt-1 flex flex-col gap-1">
                               <div className="flex flex-wrap gap-1 items-center">
                                 <span className="text-[10px] text-slate-500 w-12 shrink-0">{log.woundRollsRerolled ? '造傷(原):' : '造傷:'}</span>
                                 {log.woundRolls.slice(0, 30).map((r, rIdx) => (
                                   <span key={rIdx} className={`min-w-5 px-1 h-5 rounded-sm flex items-center justify-center text-[10px] font-mono border ${r === 6 ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                     {r}
                                   </span>
                                 ))}
                                 {log.woundRolls.length > 30 && <span className="text-[10px] text-slate-700 self-end">...</span>}
                               </div>
                               {log.woundRollsRerolled && log.woundRollsRerolled.length > 0 && (
                                 <div className="flex flex-wrap gap-1 items-center">
                                   <span className="text-[10px] w-12 shrink-0 text-orange-500 font-bold">重新投擲:</span>
                                   {log.woundRollsRerolled.slice(0, 30).map((r, rIdx) => {
                                     const isChanged = r !== log.woundRolls![rIdx];
                                     return (
                                       <span key={rIdx} className={`min-w-5 px-1 h-5 rounded-sm flex items-center justify-center text-[10px] font-mono border ${isChanged ? (r === 6 ? 'bg-orange-500/30 border-orange-400 text-orange-300 outline outline-1 outline-orange-500/50' : 'bg-slate-700 border-slate-500 text-slate-300 outline outline-1 outline-slate-500/50') : (r === 6 ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-800 border-slate-700 text-slate-500')}`}>
                                         {r}
                                       </span>
                                     );
                                   })}
                                   {log.woundRollsRerolled.length > 30 && <span className="text-[10px] text-slate-700 self-end">...</span>}
                                 </div>
                               )}
                             </div>
                          )}
                          {log.saveRolls && log.saveRolls.length > 0 && (
                             <div className="mt-1 flex flex-wrap gap-1 items-center">
                               <span className="text-[10px] text-slate-500 w-10 shrink-0">保護:</span>
                               {log.saveRolls.slice(0, 30).map((r, rIdx) => (
                                 <span key={rIdx} className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-mono border ${r === 1 ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                   {r}
                                 </span>
                               ))}
                               {log.saveRolls.length > 30 && <span className="text-[10px] text-slate-700 self-end">...</span>}
                             </div>
                          )}
                          {log.fnpRolls && log.fnpRolls.length > 0 && (
                             <div className="mt-2 flex flex-wrap gap-1 items-center">
                               <span className="text-[10px] text-slate-500 w-10 shrink-0">FNP:</span>
                               {log.fnpRolls.slice(0, 30).map((r, rIdx) => (
                                 <span key={rIdx} className={`w-5 h-5 rounded-sm flex items-center justify-center text-[10px] font-mono border ${r === 6 ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                   {r}
                                 </span>
                               ))}
                               {log.fnpRolls.length > 30 && <span className="text-[10px] text-slate-700 self-end">...</span>}
                             </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )) : (
                    simulationState !== 'IDLE' && (
                       <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-4">
                         <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                         <p className="text-[10px] font-mono uppercase tracking-[0.2em] animate-pulse">
                            {simulationState === 'HITTING' ? '正在進行命中計算...' : 
                             simulationState === 'WOUNDING' ? '正在分析能量激發/造傷...' : 
                             '等待防禦判定結果...'}
                         </p>
                       </div>
                    )
                  )}

                  {battleResults && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6 bg-gradient-to-br from-red-600/20 to-slate-900 border border-red-900/50 rounded-2xl text-center space-y-2 mt-8"
                    >
                      <p className="text-xs font-mono text-red-400 uppercase tracking-[0.2em]">最終損傷報告</p>
                      <div className="text-5xl font-black text-white">{battleResults.totalDamage}</div>
                      <p className="text-base font-medium text-slate-300">
                        {defender?.name.split(' ')[0]} 損失了 {battleResults.totalDamage} 點生命值
                      </p>
                    </motion.div>
                  )}

                  {anyWeaponHas('危險') && battleResults && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 p-5 rounded-2xl bg-orange-950/20 border border-orange-500/30 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Zap className="w-6 h-6 text-orange-400" />
                          <div>
                            <p className="text-sm font-bold text-white uppercase tracking-tight">危險判定 (Hazardous Test)</p>
                            <p className="text-[10px] text-orange-400/60 font-mono">此武器具備 [危險] 屬性，射擊結束後需判定。</p>
                          </div>
                        </div>
                        
                        {isHazardousFailed === null ? (
                          <button 
                            onClick={runHazardousTest}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-orange-900/50"
                          >
                            進行判定
                          </button>
                        ) : (
                          <div className={`px-4 py-2 rounded-lg text-xs font-bold ${isHazardousFailed ? 'bg-red-600 text-white shadow-lg shadow-red-900/50' : 'bg-green-600 text-white'}`}>
                            {isHazardousFailed ? '判定失敗 (1)' : '判定成功'}
                          </div>
                        )}
                      </div>
                      
                      {isHazardousFailed && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="p-3 bg-red-950/40 border border-red-900/40 rounded-xl text-[11px] text-red-300 leading-relaxed"
                        >
                          <strong className="text-white block mb-1">💀 判定結果解析：</strong>
                          {(attacker?.id === 'da_redemptor' || attacker?.id === 'chaplain_mordecai') 
                            ? '此單位為載具/角色，受到 3 點致死傷害。' 
                            : '小隊中一名配備此武器的模型被摧毀。'}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {interactivePrompt && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 shadow-2xl max-w-xl w-full">
              <h3 className="text-xl font-bold text-white mb-2">{interactivePrompt.title}</h3>
              <p className="text-sm text-slate-300 mb-1">{interactivePrompt.instruction}</p>
              <p className="text-xs text-slate-400 mb-6 font-mono">{interactivePrompt.targetInfo}</p>
              
              <div className="flex flex-wrap gap-2 mb-6">
                 {interactivePrompt.dice.map((d, idx) => (
                   <div
                     key={idx}
                     className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold border transition-all
                       ${interactivePrompt.constraint(d) 
                           ? 'bg-red-900/40 border-red-500/50 text-red-400 outline outline-2 outline-offset-1 outline-red-500/30' 
                           : 'bg-slate-800 border-slate-700 text-slate-400 opacity-60'}
                     `}
                   >
                     {d}
                   </div>
                 ))}
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mb-6 flex flex-col gap-2">
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-slate-400">本次擲骰期望成功數：</span>
                   <span className="text-white font-mono">{interactivePrompt.expectedSuccesses}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-slate-400">目前實際成功數：</span>
                   <span className="text-white font-mono">{interactivePrompt.currentSuccesses}</span>
                 </div>
                 <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between items-center">
                   <span className="text-sm font-bold text-slate-300">系統分析建議：</span>
                   {interactivePrompt.currentSuccesses < interactivePrompt.expectedSuccesses ? (
                      <span className="text-red-400 font-bold flex items-center gap-1"><Zap className="w-4 h-4" /> 推薦重擲 (低於期望值)</span>
                   ) : (
                      <span className="text-emerald-400 font-bold">不推薦重擲 (已達標/高於期望)</span>
                   )}
                 </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-4">
                 <button 
                   onClick={() => interactivePrompt.resolve(false)}
                   className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
                 >
                   保留結果 (不重骰)
                 </button>
                 <button 
                   onClick={() => interactivePrompt.resolve(true)}
                   className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20"
                 >
                   一鍵重骰 (所有紅框骰子)
                 </button>
              </div>
           </div>
        </div>
      )}

      <footer className="max-w-6xl mx-auto mt-20 pt-8 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-600 text-xs font-mono mb-8">
        <p>© 2026 COMBAT PATROL SIMULATOR | DATA SOURCE: PDF DATASHEETS</p>
        <div className="flex gap-6">
          <span className="flex items-center gap-1"><Info className="w-3 h-3" /> 隨機算法: Math.random()</span>
          <span className="flex items-center gap-1 text-amber-600/80 uppercase tracking-tighter">系統已鎖定 瓦爾登加斯特 vs 阿蒙霍泰克</span>
        </div>
      </footer>
    </div>
  );
}
