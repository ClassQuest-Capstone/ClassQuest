// src/pages/students/bossFight.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import feather from "feather-icons";

import "../../styles/boss.css";

import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";

import {
  listBossBattleInstancesByClass,
  getBossBattleInstance,
} from "../../api/bossBattleInstances/client.js";
import { submitBossBattleAnswer } from "../../api/bossBattleInstances/client.js";
import { leaveBossBattle } from "../../api/bossBattleParticipants/client.js";
import type { BossBattleInstance } from "../../api/bossBattleInstances/types.js";

import {
  listBossBattleParticipants,
} from "../../api/bossBattleParticipants/client.js";
import type { BossBattleParticipant } from "../../api/bossBattleParticipants/types.js";

import { getBossBattleTemplate } from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";

import { getBossQuestion, listBossQuestionsByTemplate } from "../../api/bossQuestions/client.js";
import type { BossQuestion } from "../../api/bossQuestions/types.js";

import { getStudentProfile } from "../../api/studentProfiles.js";
import { getBossResults, computeBossResults } from "../../api/bossResults/client.js";
import { getGuild } from "../../api/guilds.js";
import { useBattlePolling, useRosterPolling } from "../../hooks/useBattlePolling.ts";
import { listEquippedItemsByClass } from "../../api/equippedItems/client.js";
import type { EquippedItems as EquippedItemsRecord } from "../../api/equippedItems/types.js";
import { listShopItems } from "../../api/shopItems/client.js";
import type { ShopItem } from "../../api/shopItems/types.js";
import { getAssetUrl } from "../../api/imageUpload/assetUrl.js";
import { listRewardMilestonesByClass } from "../../api/rewardMilestones/client.js";
import { StudentNavDropdown } from "./StudentNavDropdown.js";

// --- NPC sprites (non-bg_ variants, one per slot for variety) ---
const NPC_SPRITES_10 = [
  "/assets/seed/avatar-assets/bases/guardian/male/white/base_guardian_male_white.png",
  "/assets/seed/avatar-assets/bases/mage/female/brown/base_mage_female_brown.png",
  "/assets/seed/avatar-assets/bases/healer/male/dark/base_healer_male_dark.png",
  "/assets/seed/avatar-assets/bases/guardian/female/white/base_guardian_female_white.png",
  "/assets/seed/avatar-assets/bases/mage/male/brown/base_mage_male_brown.png",
  "/assets/seed/avatar-assets/bases/healer/female/dark/base_healer_female_dark.png",
  "/assets/seed/avatar-assets/bases/guardian/male/brown/base_guardian_male_brown.png",
  "/assets/seed/avatar-assets/bases/mage/female/white/base_mage_female_white.png",
  "/assets/seed/avatar-assets/bases/healer/male/white/base_healer_male_white.png",
  "/assets/seed/avatar-assets/bases/guardian/female/dark/base_guardian_female_dark.png",
];


type CharacterGridSlot = {
  type: "player" | "npc";
  studentId?: string;
  displayName?: string;
  baseSpriteUrl: string;
  helmetUrl?: string;
  weaponUrl?: string;
  armourUrl?: string;
  petUrl?: string;
  isDowned?: boolean;
};

const CharacterCard: React.FC<{ slot: CharacterGridSlot }> = ({ slot }) => (
  <div className="flex flex-col items-center">
    <div className={`relative w-36 h-52 pixel-art transition-opacity ${slot.isDowned ? "opacity-40 grayscale" : ""}`}>
      <img
        src={slot.baseSpriteUrl}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        onError={(e) => { (e.target as HTMLImageElement).src = "/assets/seed/avatar-assets/bases/default/base_default_global.png"; }}
        alt=""
      />
      {slot.helmetUrl && <img src={slot.helmetUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="" />}
      {slot.weaponUrl && <img src={slot.weaponUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="" />}
      {slot.armourUrl && <img src={slot.armourUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="" />}
      {slot.petUrl && <img src={slot.petUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none" alt="" />}
      {slot.isDowned && (
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-[8px] font-bold text-red-300 bg-black/70 px-1 rounded">DOWN</span>
        </div>
      )}
    </div>
    <div className={`mt-0.5 text-[9px] max-w-[112px] truncate text-center leading-tight ${
      slot.type === "npc" ? "text-gray-500 italic" : "text-white/90"
    }`}>
      {slot.displayName ?? "NPC"}
    </div>
  </div>
);

type StudentUser = {
  id: string;
  role: "student";
  displayName?: string;
  email?: string;
  classId?: string;
};

type RosterStudent = {
  studentId: string;
  guildId: string;
  state: string;
  isDowned: boolean;
  frozenUntil?: string;
  displayName: string;
};

type BattleLogEntry = {
  id: string;
  text: string;
  kind?: "info" | "success" | "danger" | "warning";
};

type NormalizedOption = {
  value: string;
  label: string;
};

type BossResultGuildRow = {
  guild_id: string;
  guild_total_correct: number;
  guild_total_incorrect: number;
  guild_total_attempts: number;
  guild_total_damage_to_boss: number;
  guild_total_hearts_lost: number;
  guild_xp_awarded_total: number;
  guild_gold_awarded_total: number;
  guild_members_joined: number;
  guild_members_downed: number;
};

type BossResultStudentRow = {
  student_id: string;
  guild_id: string;
  total_correct: number;
  total_incorrect: number;
  total_attempts: number;
  total_damage_to_boss: number;
  hearts_lost: number;
  xp_awarded: number;
  gold_awarded: number;
  participation_state: string;
  last_answered_at?: string;
};

type BossResultsResponse = {
  outcome?: "WIN" | "FAIL" | "ABORTED";
  completed_at?: string;
  fail_reason?: string;
  guild_results?: BossResultGuildRow[];
  student_results?: BossResultStudentRow[];
};

type PartySlot = {
  key: string;
  image: string;
  name: string;
  position: "front" | "back-left" | "back-right";
};

function getCurrentStudent(): StudentUser | null {
  const raw = localStorage.getItem("cq_currentUser");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.role === "student") return parsed;
  } catch {
    // ignore bad local storage
  }

  return null;
}

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getRemainingSeconds(targetIso?: string | null) {
  if (!targetIso) return null;
  const end = new Date(targetIso).getTime();
  if (!Number.isFinite(end)) return null;
  const diff = Math.ceil((end - Date.now()) / 1000);
  return Math.max(0, diff);
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "LOBBY":
      return "Lobby Open";
    case "COUNTDOWN":
      return "Battle Starting";
    case "QUESTION_ACTIVE":
      return "Question Active";
    case "RESOLVING":
      return "Resolving Answers";
    case "INTERMISSION":
      return "Intermission";
    case "COMPLETED":
      return "Battle Complete";
    case "ABORTED":
      return "Battle Aborted";
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Active";
    default:
      return status || "Unknown";
  }
}

function optionTextFromUnknown(value: any): string {
  if (value == null) return "";

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (typeof value === "object") {
    return String(
      value.text ??
        value.label ??
        value.value ??
        value.option_text ??
        value.option ??
        value.answer_text ??
        value.name ??
        ""
    ).trim();
  }

  return String(value);
}

function normalizeOptions(options: any): NormalizedOption[] {
  if (!options) return [];

  if (Array.isArray(options)) {
    return options
      .map((item, index) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const label = optionTextFromUnknown(item);
          const value = String(
            item.value ??
              item.label ??
              item.text ??
              item.option_text ??
              item.option ??
              label
          ).trim();

          return {
            value: value || label || String(index + 1),
            label: label || value || `Option ${index + 1}`,
          };
        }

        const text = optionTextFromUnknown(item);
        return {
          value: text,
          label: text,
        };
      })
      .filter((x) => x.label);
  }

  if (typeof options === "object") {
    return Object.entries(options)
      .map(([key, value]) => {
        const label = optionTextFromUnknown(value);
        const fallback = String(key).trim();

        return {
          value: fallback || label,
          label: label || fallback,
        };
      })
      .filter((x) => x.label);
  }

  return [];
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

async function fetchBossBattleResultsSafe(bossInstanceId: string): Promise<BossResultsResponse> {
  const tryGet = async (): Promise<BossResultsResponse> => {
    const r = await getBossResults(bossInstanceId);
    // r already matches BossResultsResponse shape from the backend
    return {
      outcome: (r as any).outcome ?? "FAIL",
      completed_at: (r as any).completed_at ?? "",
      fail_reason: (r as any).fail_reason,
      guild_results: (r as any).guild_results ?? [],
      student_results: (r as any).student_results ?? [],
    };
  };

  try {
    return await tryGet();
  } catch {
    // Results may not be computed yet; trigger computation then retry
    try {
      await computeBossResults(bossInstanceId);
      return await tryGet();
    } catch {
      throw new Error("Results not available yet.");
    }
  }
}

const BossFight: React.FC = () => {
  const student = useMemo(() => getCurrentStudent(), []);
  const studentId = student?.id ?? null;

  const [classId, setClassId] = useState<string | null>(null);

  const [instance, setInstance] = useState<BossBattleInstance | null>(null);
  const [loadingInstance, setLoadingInstance] = useState(true);

  const [template, setTemplate] = useState<BossBattleTemplate | null>(null);
  const [question, setQuestion] = useState<BossQuestion | null>(null);

  const [participants, setParticipants] = useState<BossBattleParticipant[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmittedCurrentQuestion, setHasSubmittedCurrentQuestion] = useState(false);

  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number | null>(null);
  const [intermissionLeft, setIntermissionLeft] = useState<number | null>(null);

  const [allQuestions, setAllQuestions] = useState<BossQuestion[]>([]);
  const [localHeartsLost, setLocalHeartsLost] = useState(0);
  const [heartFlash, setHeartFlash] = useState(0); // number of hearts just lost; >0 triggers flash
  const pendingHeartFlashRef = useRef(0); // hearts lost this question — shown at INTERMISSION, not on submit
  const [intermissionCountdown, setIntermissionCountdown] = useState<number | null>(null);
  const lastSubmitAtRef = useRef<number>(0);

  const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);

  // Character data for the 10-slot party grid
  const [allEquippedItems, setAllEquippedItems] = useState<EquippedItemsRecord[]>([]);
  const [shopItemMap, setShopItemMap] = useState<Map<string, ShopItem>>(new Map());
  // reward_id → image_asset_key  (items stored by reward_id in EquippedItems)
  const [rewardImageMap, setRewardImageMap] = useState<Map<string, string>>(new Map());
  // reward_target_id → image_asset_key  (resolves old default shop item IDs that became rewards)
  const [targetIdImageMap, setTargetIdImageMap] = useState<Map<string, string>>(new Map());

  const [showResultModal, setShowResultModal] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [resultsCountdown, setResultsCountdown] = useState<number | null>(null);
  const [bossResults, setBossResults] = useState<BossResultsResponse | null>(null);
  const [myGuildName, setMyGuildName] = useState<string | null>(null);
  const [guildNameMap, setGuildNameMap] = useState<Record<string, string>>({});
  const [resultStudentNameMap, setResultStudentNameMap] = useState<Record<string, string>>({});

  const { profile, refreshHearts } = usePlayerProgression(studentId || "", classId || "");

  const polledInstance = useBattlePolling(instance?.boss_instance_id ?? undefined, 2500);
  const polledParticipants = useRosterPolling(instance?.boss_instance_id ?? undefined, 3000);
  const prevActiveQuestionIdRef = useRef<string | null | undefined>(undefined);
  // Stores whether the student was correct on the last answered question (shown during INTERMISSION)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [lastXpEarned, setLastXpEarned] = useState<number>(0);

  useEffect(() => {
    if (student?.classId) {
      setClassId(student.classId);
      return;
    }

    const stored = localStorage.getItem("cq_currentClassId");
    if (stored) {
      setClassId(stored);
      return;
    }

    setClassId(null);
  }, [student?.classId]);

  useEffect(() => {
    feather.replace();
  }, [
    instance?.status,
    template?.title,
    question?.question_id,
    roster.length,
    battleLog.length,
    selectedAnswer,
    submitting,
    showResultModal,
    loadingResults,
    localHeartsLost,
  ]);

  useEffect(() => {
    setSelectedAnswer(null);
    setSubmitting(false);
    setHasSubmittedCurrentQuestion(false);
    setLastAnswerCorrect(null);
    setLastXpEarned(0);
    // NOTE: do NOT clear pendingHeartFlashRef here — it must survive until INTERMISSION renders
  }, [question?.question_id]);

  const myParticipant = useMemo(() => {
    if (!studentId) return null;
    return participants.find((p) => p.student_id === studentId) ?? null;
  }, [participants, studentId]);

  const joinedRoster = useMemo(() => {
    return roster.filter((r) => r.state === "JOINED");
  }, [roster]);

  const myGuildRoster = useMemo(() => {
    if (!myParticipant?.guild_id) return [];
    return roster.filter((r) => r.guildId === myParticipant.guild_id);
  }, [roster, myParticipant?.guild_id]);

  // Fetch avatar bases, shop items, equipped items, and reward milestones once per class
  useEffect(() => {
    if (!classId) return;
    Promise.allSettled([
      listEquippedItemsByClass(classId, { limit: 100 }),
      listShopItems({ limit: 200 }),
      listRewardMilestonesByClass(classId),
    ]).then(([equippedResult, shopResult, rewardsResult]) => {
      if (equippedResult.status === "fulfilled") {
        setAllEquippedItems((equippedResult.value as any).items ?? []);
      } else {
        console.warn("[BossFight] listEquippedItemsByClass failed:", equippedResult.reason);
      }
      if (shopResult.status === "fulfilled") {
        setShopItemMap(new Map(
          ((shopResult.value as any).items ?? []).map((s: ShopItem) => [s.item_id, s])
        ));
      }
      if (rewardsResult.status === "fulfilled") {
        const rewards: any[] = (rewardsResult.value as any) ?? [];
        const rMap = new Map<string, string>();
        const tMap = new Map<string, string>();
        for (const r of rewards) {
          if (r.reward_id && r.image_asset_key) rMap.set(r.reward_id, r.image_asset_key);
          if (r.reward_target_id && r.image_asset_key) tMap.set(r.reward_target_id, r.image_asset_key);
        }
        setRewardImageMap(rMap);
        setTargetIdImageMap(tMap);
      } else {
        console.warn("[BossFight] listRewardMilestonesByClass failed:", rewardsResult.reason);
      }
    });
  }, [classId]);

  // Build the 10-slot party grid: guild members first, NPCs fill the rest
  // Synchronously derived from already-fetched data — no async waterfall needed.
  const partyGrid = useMemo<CharacterGridSlot[]>(() => {
    const classMap: Record<string, string> = { Guardian: "guardian", Mage: "mage", Healer: "healer" };
    const genderMap: Record<string, string> = { M: "male", F: "female" };
    const skinMap: Record<string, string> = { white: "white", brown: "brown", black: "dark" };

    const DEFAULT_SPRITE = "/assets/seed/avatar-assets/bases/default/base_default_global.png";

    const getItemSprite = (itemId?: string): string | undefined => {
      if (!itemId) return undefined;
      // 1. Shop item (purchased from shop)
      const shopItem = shopItemMap.get(itemId);
      if (shopItem) return getAssetUrl(shopItem.sprite_path) ?? shopItem.sprite_path;
      // 2. Reward item stored by reward_id (e.g. "seed_reward_v2_guardian_helmet")
      const rewardKey = rewardImageMap.get(itemId);
      if (rewardKey) return getAssetUrl(rewardKey);
      // 3. Old default shop item ID that became a reward (e.g. "guardian_helmet_copper")
      const targetKey = targetIdImageMap.get(itemId);
      if (targetKey) return getAssetUrl(targetKey);
      return undefined;
    };

    const slots: CharacterGridSlot[] = [];

    for (const member of myGuildRoster.slice(0, 10)) {
      const equippedRecord = allEquippedItems.find((r) => r.student_id === member.studentId);

      // Resolve base sprite
      let baseSpriteUrl: string | undefined;

      // Current user: read from localStorage
      if (member.studentId === studentId) {
        try {
          const raw = localStorage.getItem(`cq_characterData_${studentId}`);
          if (raw) {
            const cd = JSON.parse(raw);
            const c = classMap[cd.class] ?? cd.class?.toLowerCase();
            const g = genderMap[cd.gender] ?? cd.gender?.toLowerCase();
            const s = skinMap[cd.skin] ?? cd.skin;
            if (c && g && s) {
              baseSpriteUrl = `/assets/seed/avatar-assets/bases/${c}/${g}/${s}/base_${c}_${g}_${s}.png`;
            }
          }
        } catch { /* ignore */ }
      }

      // Other members: parse avatar_base_id (e.g. "guardian_male_brown")
      if (!baseSpriteUrl && equippedRecord?.avatar_base_id) {
        const id = equippedRecord.avatar_base_id.toLowerCase();
        const c = ["guardian", "mage", "healer"].find((x) => id.includes(x));
        const g = ["male", "female"].find((x) => id.includes(x));
        const s = ["white", "brown", "dark"].find((x) => id.includes(x));
        if (c && g && s) {
          baseSpriteUrl = `/assets/seed/avatar-assets/bases/${c}/${g}/${s}/base_${c}_${g}_${s}.png`;
        }
      }

      // Always resolve equipment regardless of whether base sprite was found
      slots.push({
        type: "player",
        studentId: member.studentId,
        displayName: member.displayName,
        baseSpriteUrl: baseSpriteUrl ?? DEFAULT_SPRITE,
        helmetUrl: getItemSprite(equippedRecord?.helmet_item_id),
        weaponUrl: getItemSprite(equippedRecord?.hand_item_id),
        armourUrl: getItemSprite(equippedRecord?.armour_item_id),
        petUrl: getItemSprite(equippedRecord?.pet_item_id),
        isDowned: member.isDowned,
      });
    }

    // Fill remaining slots with NPCs
    while (slots.length < 10) {
      const spriteUrl = NPC_SPRITES_10[slots.length % NPC_SPRITES_10.length];
      const npcClass = ["Guardian", "Mage", "Healer"].find((c) => spriteUrl.includes(c.toLowerCase())) ?? "NPC";
      slots.push({
        type: "npc",
        displayName: npcClass,
        baseSpriteUrl: spriteUrl,
      });
    }

    return slots;
  }, [myGuildRoster, allEquippedItems, shopItemMap, rewardImageMap, targetIdImageMap, studentId]);

  const canAnswer = useMemo(() => {
    if (!instance || !myParticipant || !question) return false;
    if (instance.status !== "QUESTION_ACTIVE") return false;
    if (myParticipant.state !== "JOINED") return false;
    if (hasSubmittedCurrentQuestion) return false;

    if (myParticipant.frozen_until) {
      const frozenUntil = new Date(myParticipant.frozen_until).getTime();
      if (Number.isFinite(frozenUntil) && frozenUntil > Date.now()) return false;
    }

    if (
      instance.mode_type === "TURN_BASED_GUILD" &&
      instance.active_guild_id &&
      myParticipant.guild_id !== instance.active_guild_id
    ) {
      return false;
    }

    return true;
  }, [instance, myParticipant, question, hasSubmittedCurrentQuestion]);

  const freezeSecondsLeft = useMemo(() => {
    if (!myParticipant?.frozen_until) return 0;
    const diff = getRemainingSeconds(myParticipant.frozen_until);
    return diff ?? 0;
  }, [myParticipant?.frozen_until, countdownLeft, questionTimeLeft, intermissionLeft]);

  const myStudentResult = useMemo(() => {
    if (!bossResults?.student_results || !studentId) return null;
    return bossResults.student_results.find((r) => r.student_id === studentId) ?? null;
  }, [bossResults, studentId]);

  const myGuildResult = useMemo(() => {
    if (!bossResults?.guild_results || !myParticipant?.guild_id) return null;
    return bossResults.guild_results.find((r) => r.guild_id === myParticipant.guild_id) ?? null;
  }, [bossResults, myParticipant?.guild_id]);

  const bossHpPercent = useMemo(() => {
    const initial = Number(instance?.initial_boss_hp ?? 0);
    const current = Number(instance?.current_boss_hp ?? 0);
    if (initial <= 0) return 0;
    return Math.max(0, Math.min(100, (current / initial) * 100));
  }, [instance?.initial_boss_hp, instance?.current_boss_hp]);

  const loadParticipants = useCallback(async (bossInstanceId: string) => {
    try {
      const res = await listBossBattleParticipants(bossInstanceId);
      const items = res?.items ?? [];
      setParticipants(items);

      const rosterRows = await Promise.all(
        items.map(async (p) => {
          let displayName = p.student_id;

          try {
            const sp = await getStudentProfile(p.student_id);
            displayName =
              sp?.display_name ||
              sp?.displayName ||
              sp?.name ||
              p.student_id;
          } catch {
            displayName = p.student_id;
          }

          return {
            studentId: p.student_id,
            guildId: p.guild_id,
            state: p.state,
            isDowned: p.is_downed,
            frozenUntil: p.frozen_until,
            displayName,
          } as RosterStudent;
        })
      );

      setRoster(rosterRows);
    } catch (error) {
      console.error("Failed to load participants:", error);
      setParticipants([]);
      setRoster([]);
    }
  }, []);

  const loadInstance = useCallback(async () => {
    if (!classId) {
      setInstance(null);
      setLoadingInstance(false);
      return;
    }

    setLoadingInstance(true);

    try {
      const list = await listBossBattleInstancesByClass(classId, { limit: 25 });
      const items = list?.items ?? [];

      const liveStatuses = [
        "LOBBY",
        "COUNTDOWN",
        "QUESTION_ACTIVE",
        "RESOLVING",
        "INTERMISSION",
      ];

      const picked =
        items.find((x) => liveStatuses.includes(x.status)) ||
        items
          .filter((x) => x.status === "COMPLETED")
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          )[0] ||
        null;

      if (!picked) {
        setInstance(null);
        setTemplate(null);
        setQuestion(null);
        setParticipants([]);
        setRoster([]);
        setLoadingInstance(false);
        return;
      }

      const fresh = await getBossBattleInstance(picked.boss_instance_id);
      setInstance(fresh);

      await loadParticipants(fresh.boss_instance_id);

      try {
        const tpl = await getBossBattleTemplate(fresh.boss_template_id);
        setTemplate(tpl);
      } catch (error) {
        console.error("Failed to load boss template:", error);
        setTemplate(null);
      }

      if (fresh.mode_type === "RANDOMIZED_PER_GUILD" && fresh.boss_template_id) {
        try {
          const qRes = await listBossQuestionsByTemplate(fresh.boss_template_id, { limit: 200 });
          const sorted = (qRes.items || []).sort((a, b) => a.order_index - b.order_index);
          setAllQuestions(sorted);
          // The per-guild question derivation effect will set the displayed question
        } catch (error) {
          console.error("Failed to load questions for RANDOMIZED_PER_GUILD:", error);
          setAllQuestions([]);
          setQuestion(null);
        }
      } else if (fresh.active_question_id) {
        try {
          const q = await getBossQuestion(fresh.active_question_id);
          setQuestion(q);
        } catch (error) {
          console.error("Failed to load active question:", error);
          setQuestion(null);
        }
      } else {
        setQuestion(null);
      }
    } catch (error) {
      console.error("Failed to load boss battle instance:", error);
      setInstance(null);
      setTemplate(null);
      setQuestion(null);
      setParticipants([]);
      setRoster([]);
    } finally {
      setLoadingInstance(false);
    }
  }, [classId, loadParticipants]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  useEffect(() => {
    if (!instance) {
      setCountdownLeft(null);
      setQuestionTimeLeft(null);
      setIntermissionLeft(null);
      return;
    }

    const tick = () => {
      setCountdownLeft(getRemainingSeconds(instance.countdown_end_at));
      setQuestionTimeLeft(getRemainingSeconds(instance.question_ends_at));
      setIntermissionLeft(getRemainingSeconds(instance.intermission_ends_at));
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [
    instance?.countdown_end_at,
    instance?.question_ends_at,
    instance?.intermission_ends_at,
    instance,
  ]);

  // Merge polled instance — also detect question changes
  useEffect(() => {
    if (!polledInstance) return;
    setInstance(polledInstance);

    // RANDOMIZED_PER_GUILD: question is derived by a separate effect
    if (polledInstance.mode_type === "RANDOMIZED_PER_GUILD") return;

    const newQId = polledInstance.active_question_id ?? null;
    if (newQId !== prevActiveQuestionIdRef.current) {
      prevActiveQuestionIdRef.current = newQId;
      if (newQId) {
        getBossQuestion(newQId)
          .then((q) => setQuestion(q))
          .catch(() => setQuestion(null));
      } else {
        setQuestion(null);
      }
    }
  }, [polledInstance]);

  // When INTERMISSION starts: fire heart-loss flash + start 3-second countdown.
  // This fires once per INTERMISSION entry. The countdown is cosmetic — actual
  // question advance is driven by the teacher monitor.
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const newStatus = instance?.status;
    const wasActive = prevStatusRef.current === "QUESTION_ACTIVE";
    prevStatusRef.current = newStatus;

    if (!wasActive || newStatus !== "INTERMISSION") return;

    // --- Fire heart-loss flash ---
    if (pendingHeartFlashRef.current > 0) {
      // Student submitted a wrong answer this round
      const lost = pendingHeartFlashRef.current;
      pendingHeartFlashRef.current = 0;
      setHeartFlash(lost);
      setTimeout(() => setHeartFlash(0), 1600);
    } else {
      // No local submission — check if server deducted hearts (force-skip)
      const displayedBefore = Math.max(0, (profile.hearts ?? 0) - localHeartsLost);
      refreshHearts().then((newHearts) => {
        if (newHearts !== null && newHearts < displayedBefore) {
          const lost = displayedBefore - newHearts;
          setHeartFlash(lost);
          setTimeout(() => setHeartFlash(0), 1600);
        }
      });
    }
    setLocalHeartsLost(0);

    // --- 3-second countdown ---
    setIntermissionCountdown(3);
  }, [instance?.status]);

  // Tick the intermission countdown down every second
  useEffect(() => {
    if (intermissionCountdown === null || intermissionCountdown <= 0) return;
    const t = setTimeout(() => setIntermissionCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [intermissionCountdown]);

  // Clear countdown when status moves away from INTERMISSION
  useEffect(() => {
    if (instance?.status !== "INTERMISSION") setIntermissionCountdown(null);
  }, [instance?.status]);

  // Merge polled roster — update participant states without re-fetching display names
  useEffect(() => {
    if (polledParticipants.length > 0) {
      setParticipants(polledParticipants);
      // Update display states in roster without re-fetching names
      setRoster((prev) =>
        prev.map((r) => {
          const updated = polledParticipants.find((p) => p.student_id === r.studentId);
          if (!updated) return r;
          return {
            ...r,
            state: updated.state,
            isDowned: updated.is_downed,
            frozenUntil: updated.frozen_until,
          };
        })
      );
    }
  }, [polledParticipants]);

  // Derive displayed question from per_guild_question_index for RANDOMIZED_PER_GUILD mode
  useEffect(() => {
    if (instance?.mode_type !== "RANDOMIZED_PER_GUILD") return;
    if (allQuestions.length === 0) return;
    if (!myParticipant?.guild_id) return;
    const idx = instance.per_guild_question_index?.[myParticipant.guild_id] ?? 0;
    setQuestion(allQuestions[idx] ?? null);
  }, [instance?.mode_type, instance?.per_guild_question_index, myParticipant?.guild_id, allQuestions]);

  useEffect(() => {
    if (!instance) return;

    const baseLog: BattleLogEntry[] = [];

    if (instance.status === "LOBBY") {
      baseLog.push({
        id: "lobby",
        text: "The teacher has opened the boss lobby. Waiting for battle start.",
        kind: "info",
      });
    }

    if (instance.status === "COUNTDOWN") {
      baseLog.push({
        id: "countdown",
        text: "Roster locked. The battle is about to begin.",
        kind: "warning",
      });
    }

    if (instance.status === "QUESTION_ACTIVE" && question) {
      baseLog.push({
        id: "question-active",
        text: `Question live: ${question.question_text}`,
        kind: "info",
      });
    }

    if (instance.status === "RESOLVING") {
      baseLog.push({
        id: "resolving",
        text: "Answers are being resolved...",
        kind: "warning",
      });
    }

    if (instance.status === "INTERMISSION") {
      baseLog.push({
        id: "intermission",
        text: "Take a breath. The next question is coming soon.",
        kind: "info",
      });
    }

    if (instance.status === "COMPLETED") {
      baseLog.push({
        id: "completed",
        text: `Battle ended with outcome: ${instance.outcome ?? "UNKNOWN"}.`,
        kind: instance.outcome === "WIN" ? "success" : "danger",
      });
    }

    if (instance.status === "ABORTED") {
      baseLog.push({
        id: "aborted",
        text: "The teacher aborted the battle.",
        kind: "danger",
      });
    }

    setBattleLog((prev) => {
      const keepLocal = prev.filter((x) => x.id.startsWith("local-"));
      return [...baseLog, ...keepLocal].slice(-10);
    });
  }, [instance, question]);

  useEffect(() => {
    const status = String(instance?.status || "").toUpperCase();
    if (!instance?.boss_instance_id) return;
    if (!["COMPLETED", "ABORTED"].includes(status)) return;
    if (showResultModal) return;

    let mounted = true;

    (async () => {
      try {
        // Wait 10 seconds so the backend can finish writing rewards before we read results
        const DELAY_SECONDS = 10;
        setResultsCountdown(DELAY_SECONDS);
        for (let i = DELAY_SECONDS - 1; i >= 0; i--) {
          await new Promise((r) => setTimeout(r, 1000));
          if (!mounted) return;
          setResultsCountdown(i);
        }
        setResultsCountdown(null);

        setLoadingResults(true);
        const res = await fetchBossBattleResultsSafe(instance.boss_instance_id);
        if (!mounted) return;
        setBossResults(res);

        // Fetch guild names and student names for the results screen in parallel
        const guildIds = (res.guild_results ?? []).map((g) => g.guild_id).filter(Boolean);
        const resultStudentIds = Array.from(
          new Set((res.student_results ?? []).map((s) => s.student_id).filter(Boolean))
        );

        const [guildEntries, studentEntries] = await Promise.all([
          Promise.all(
            guildIds.map(async (gid) => {
              try {
                const g = await getGuild(gid);
                return [gid, (g as any).name ?? gid] as const;
              } catch {
                return [gid, gid] as const;
              }
            })
          ),
          Promise.all(
            resultStudentIds.map(async (sid) => {
              // Prefer the name already in roster (already fetched)
              const fromRoster = roster.find((r) => r.studentId === sid)?.displayName;
              if (fromRoster) return [sid, fromRoster] as const;
              try {
                const sp = await getStudentProfile(sid);
                const name =
                  (sp as any).display_name ||
                  (sp as any).displayName ||
                  (sp as any).username ||
                  (sp as any).name ||
                  sid;
                return [sid, name] as const;
              } catch {
                return [sid, sid] as const;
              }
            })
          ),
        ]);

        if (mounted) {
          const guildMap: Record<string, string> = {};
          for (const [gid, name] of guildEntries) guildMap[gid] = name;
          setGuildNameMap(guildMap);
          if (myParticipant?.guild_id) setMyGuildName(guildMap[myParticipant.guild_id] ?? null);

          const studentMap: Record<string, string> = {};
          for (const [sid, name] of studentEntries) studentMap[sid] = name;
          setResultStudentNameMap(studentMap);
        }
      } catch (error) {
        console.error("Failed to load boss results:", error);
        if (!mounted) return;
        setBossResults({
          outcome: (instance.outcome as any) || (status === "ABORTED" ? "ABORTED" : "FAIL"),
          completed_at: instance.completed_at ?? "",
          fail_reason: instance.fail_reason,
          guild_results: [],
          student_results: [],
        });
      } finally {
        if (mounted) {
          setResultsCountdown(null);
          setLoadingResults(false);
          setShowResultModal(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [
    instance?.status,
    instance?.boss_instance_id,
    instance?.outcome,
    instance?.completed_at,
    instance?.fail_reason,
    showResultModal,
  ]);

  const handleLeaveBattle = async () => {
    if (!instance) {
      window.location.href = "/guilds";
      return;
    }

    const confirmLeave = window.confirm(
      "Are you sure you want to flee the battle?"
    );
    if (!confirmLeave) return;

    try {
      await leaveBossBattle(instance.boss_instance_id);
    } catch (error) {
      console.error("Failed to leave battle:", error);
    }

    window.location.href = "/guilds";
  };

  const handleSubmitAnswer = async () => {
    if (!instance || !question || !studentId || !myParticipant) return;
    if (!canAnswer || submitting || !selectedAnswer) return;

    // Anti-spam: enforce minimum interval between submissions
    const antiSpamMs = instance.anti_spam_min_submit_interval_ms ?? 1500;
    if (Date.now() - lastSubmitAtRef.current < antiSpamMs) return;
    lastSubmitAtRef.current = Date.now();

    setSubmitting(true);

    try {
      // Build the value to submit:
      //   MCQ  — letter key (A/B/C/D) maps back to the raw option text (opt.value)
      //   T/F  — normalize to lowercase so the server's String(true)==="true" comparison works
      let answerValue = selectedAnswer;
      const qType = (question as any).question_type;
      if (qType === "MCQ_SINGLE") {
        const mcqLetters = ["A", "B", "C", "D", "E", "F"];
        const idx = mcqLetters.indexOf(selectedAnswer);
        if (idx !== -1) {
          const opts = normalizeOptions((question as any).options);
          if (opts[idx]) answerValue = opts[idx].value;
        }
      } else if (qType === "TRUE_FALSE") {
        answerValue = selectedAnswer.toLowerCase(); // "true" / "false"
      }

      // Server reads answer_raw.value (not .answer)
      const result = await submitBossBattleAnswer(instance.boss_instance_id, {
        student_id: studentId,
        answer_raw: { value: answerValue },
      });

      setHasSubmittedCurrentQuestion(true);
      setLastAnswerCorrect(result.is_correct);

      if (result.is_correct) {
        setLastXpEarned(result.xp_earned ?? 0);
        setBattleLog((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            text: `Correct! ${result.xp_earned && result.xp_earned > 0 ? `+${result.xp_earned} XP. ` : ""}+${result.damage_to_boss} damage to boss.`,
            kind: "success",
          },
        ]);
      } else {
        setLastXpEarned(0);
        const heartsLost = Math.abs(result.hearts_delta_student ?? 0);
        if (heartsLost > 0) {
          setLocalHeartsLost((prev) => prev + heartsLost);
          // Store — flash fires at INTERMISSION (when right/wrong is revealed), not here
          pendingHeartFlashRef.current += heartsLost;
        }
        const frozenMsg = result.frozen_until ? ` Frozen for ${instance.freeze_on_wrong_seconds}s.` : "";
        setBattleLog((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            text: `Wrong answer.${heartsLost > 0 ? ` Lost ${heartsLost} heart(s).` : ""}${frozenMsg}`,
            kind: "danger",
          },
        ]);
      }

      // Update local participant frozen_until so canAnswer reacts immediately
      if (result.frozen_until) {
        setParticipants((prev) =>
          prev.map((p) =>
            p.student_id === studentId
              ? { ...p, frozen_until: result.frozen_until ?? undefined }
              : p
          )
        );
      }
    } catch (error: any) {
      console.error("Failed to submit answer:", error);
      const msg = error?.message || "Failed to submit answer. Try again.";
      setBattleLog((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, text: msg, kind: "danger" },
      ]);
    } finally {
      setSubmitting(false);
    }
  };

  const renderAnswerButtons = (q: BossQuestion) => {
    const disabledBase = !canAnswer || submitting;
    const type = q.question_type;

    if (type === "TRUE_FALSE") {
      const tfOptions = ["True", "False"];

      return (
        <div className="grid grid-cols-2 gap-3">
          {tfOptions.map((opt, idx) => (
            <button
              key={opt}
              disabled={disabledBase}
              onClick={() => setSelectedAnswer(opt)}
              className={`${
                selectedAnswer === opt
                  ? "from-yellow-500 to-yellow-700 border-yellow-300"
                  : "from-blue-600 to-blue-800 border-blue-400"
              } bg-gradient-to-br hover:from-blue-500 hover:to-blue-700 text-white p-4 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 border-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-bold">{idx === 0 ? "T" : "F"}</span>
              </div>
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (type === "MCQ_SINGLE") {
      const options = normalizeOptions((q as any).options);
      const letters = ["A", "B", "C", "D", "E", "F"];

      return (
        <div className="grid grid-cols-2 gap-3">
          {options.length === 0 ? (
            <div className="col-span-2 bg-gray-900 p-6 rounded-lg border border-red-700">
              <p className="text-red-300 text-sm text-center">
                No multiple choice options were found for this question.
              </p>
            </div>
          ) : (
            options.map((opt, idx) => (
              <button
                key={`${idx}-${opt.value}-${opt.label}`}
                disabled={disabledBase}
                onClick={() => setSelectedAnswer(letters[idx] ?? String(idx))}
                className={`${
                  selectedAnswer === (letters[idx] ?? String(idx))
                    ? "from-yellow-500 to-yellow-700 border-yellow-300"
                    : "from-blue-600 to-blue-800 border-blue-400"
                } bg-gradient-to-br hover:from-blue-500 hover:to-blue-700 text-white p-4 rounded-lg text-sm font-semibold transition-all transform hover:scale-105 active:scale-95 border-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-bold">{letters[idx] ?? idx + 1}</span>
                </div>
                <div className="break-words whitespace-normal">{opt.label}</div>
              </button>
            ))
          )}
        </div>
      );
    }

    return (
      <div className="bg-gray-900 p-6 rounded-lg border border-red-700">
        <p className="text-red-300 text-sm text-center">
          This question type is not supported yet on the student battle screen.
          <br />
          Supported right now: MCQ_SINGLE and TRUE_FALSE.
        </p>
      </div>
    );
  };

  const renderQuestionArea = () => {
    if (!instance) {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-gray-400 text-center text-sm">
            No active boss battle found for this class.
          </p>
        </div>
      );
    }

    if (instance.status === "LOBBY") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-gray-300 text-center text-sm">
            The lobby is open. Waiting for the teacher to start the countdown.
          </p>
        </div>
      );
    }

    if (instance.status === "COUNTDOWN") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex flex-col items-center justify-center">
          <p className="text-yellow-300 text-lg font-bold mb-2">Battle starts in</p>
          <p className="text-white text-4xl font-extrabold">
            {formatSeconds(countdownLeft ?? 0)}
          </p>
        </div>
      );
    }

    if (instance.status === "RESOLVING") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-orange-300 text-center text-sm">
            Answers are being resolved. Please wait for the next update.
          </p>
        </div>
      );
    }

    if (instance.status === "INTERMISSION") {
      // Resolve correct_answer — MCQ stores { index: n }, resolve to option text
      let correctAnswer: string | null = null;
      if (question?.correct_answer != null) {
        const ca = question.correct_answer as any;
        if (typeof ca === "object" && ca !== null && "index" in ca && question.options) {
          const opts = normalizeOptions(question.options);
          correctAnswer = opts[ca.index]?.label ?? opts[ca.index]?.value ?? null;
        } else {
          correctAnswer = optionTextFromUnknown(ca) || null;
        }
      }
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex flex-col items-center justify-center gap-3">
          <p className="text-cyan-300 text-lg font-bold">
            Round Over —{" "}
            {intermissionCountdown !== null && intermissionCountdown > 0
              ? `Next question in ${intermissionCountdown}…`
              : "Next question coming soon…"}
          </p>

          {lastAnswerCorrect === true && (
            <div className="bg-green-900/60 border border-green-500 rounded-lg px-4 py-2 text-center">
              <p className="text-green-300 font-bold text-lg">✓ You answered correctly!</p>
              {lastXpEarned > 0 && (
                <p className="text-yellow-300 text-sm font-semibold mt-1">+{lastXpEarned} XP earned!</p>
              )}
            </div>
          )}
          {lastAnswerCorrect === false && (
            <div className="bg-red-900/60 border border-red-500 rounded-lg px-4 py-2 text-center">
              <p className="text-red-300 font-bold text-lg">✗ Incorrect answer</p>
              {correctAnswer && (
                <p className="text-white text-sm mt-1">
                  Correct answer: <span className="font-bold text-green-300">{correctAnswer}</span>
                </p>
              )}
            </div>
          )}
          {lastAnswerCorrect === null && (
            <p className="text-gray-400 text-sm">You didn't submit an answer for this question.</p>
          )}

          {correctAnswer && lastAnswerCorrect !== false && (
            <p className="text-gray-300 text-sm">
              Correct answer: <span className="font-bold text-green-300">{correctAnswer}</span>
            </p>
          )}
        </div>
      );
    }

    if (instance.status === "COMPLETED") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex flex-col items-center justify-center">
          <p className="text-yellow-300 text-lg font-bold mb-2">Battle Complete</p>
          <p className="text-white text-xl">
            Outcome: <span className="font-extrabold">{instance.outcome ?? "UNKNOWN"}</span>
          </p>
          {instance.fail_reason ? (
            <p className="text-gray-300 text-sm mt-2">Reason: {instance.fail_reason}</p>
          ) : null}
        </div>
      );
    }

    if (instance.status === "ABORTED") {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-red-300 text-center text-sm">
            This boss battle was aborted by the teacher.
          </p>
        </div>
      );
    }

    if (instance.status !== "QUESTION_ACTIVE" || !question) {
      return (
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 min-h-[180px] flex items-center justify-center">
          <p className="text-gray-400 text-center text-sm">
            Waiting for the current question...
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="bg-gray-900 p-6 rounded-lg mb-6 border border-gray-700 min-h-[140px]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-yellow-300/80">
                Question {(instance?.current_question_index ?? 0) + 1}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Type: {question.question_type.replaceAll("_", " ")}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-red-900/60 border border-red-500 text-red-200 text-xs font-semibold">
                Boss HP: {instance.initial_boss_hp > 0 ? ((instance.current_boss_hp / instance.initial_boss_hp) * 100).toFixed(2) : "0.00"}%
              </span>

              {questionTimeLeft !== null ? (
                <span className="px-3 py-1 rounded-full bg-blue-900/60 border border-blue-500 text-blue-200 text-xs font-semibold">
                  Time Left: {formatSeconds(questionTimeLeft)}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-purple-900/60 border border-purple-500 text-purple-200 text-xs font-semibold">
                  Untimed
                </span>
              )}
            </div>
          </div>

          <p className="text-white text-base leading-7">{question.question_text}</p>

          {instance.mode_type === "TURN_BASED_GUILD" &&
            instance.active_guild_id &&
            myParticipant?.guild_id !== instance.active_guild_id ? (
            <div className="mt-4 p-3 rounded-lg bg-slate-800 border border-slate-600 text-sm text-cyan-300">
              It is another guild's turn. Your guild will answer next. Active guild: <span className="font-bold">{instance.active_guild_id}</span>
            </div>
          ) : instance.mode_type === "TURN_BASED_GUILD" && instance.active_guild_id ? (
            <div className="mt-4 text-sm text-green-300 font-semibold">
              It is your guild's turn! Active guild: <span className="font-bold">{instance.active_guild_id}</span>
            </div>
          ) : null}

          {myParticipant?.state === "SPECTATE" ? (
            <div className="mt-4 text-sm text-gray-300">
              You are currently spectating and cannot submit answers.
            </div>
          ) : null}

          {myParticipant?.state === "KICKED" ? (
            <div className="mt-4 text-sm text-red-300">
              You were removed from this boss battle.
            </div>
          ) : null}

          {freezeSecondsLeft > 0 ? (
            <div className="mt-4 text-sm text-orange-300">
              You are frozen for {freezeSecondsLeft}s after a wrong answer.
            </div>
          ) : null}

          {hasSubmittedCurrentQuestion ? (
            <div className="mt-4 text-sm text-emerald-300">
              ✓ Answer submitted — waiting for all players to answer…
            </div>
          ) : null}

          {submitting ? (
            <div className="mt-4 text-sm text-yellow-300">
              Submitting your answer...
            </div>
          ) : null}
        </div>

        {renderAnswerButtons(question)}

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSubmitAnswer}
            disabled={!selectedAnswer || !canAnswer || submitting}
            className="inline-flex items-center bg-emerald-600 text-white border-2 border-emerald-800 rounded-md px-4 py-2 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i data-feather="send" className="mr-2"></i>
            <span className="text-sm font-medium">
              {submitting ? "Submitting..." : "Submit Answer"}
            </span>
          </button>
        </div>
      </>
    );
  };

  if (!studentId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-bold mb-3">No student session found</h1>
          <p className="text-slate-300">Please log in as a student first.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Heart-loss flash overlay */}
      {heartFlash > 0 && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div className="animate-bounce flex flex-col items-center gap-2">
            <span className="text-8xl drop-shadow-[0_0_20px_rgba(239,68,68,0.9)]">💔</span>
            <span className="text-4xl font-black text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]">
              -{heartFlash} ❤️
            </span>
          </div>
          <div className="absolute inset-0 bg-red-500/20 animate-pulse" />
        </div>
      )}
      <div className="font-poppins bg-[url('/assets/boss-bckgnd.png')] bg-no-repeat bg-center min-h-screen" style={{ backgroundSize: "150%" }}>
        <nav className="bg-blue-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <Link
                    to="/character"
                    className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                  >
                    <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                    <span className="text-xl font-bold"> ClassQuest</span>
                  </Link>
                </div>
              </div>

              <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
                <Link
                  to="/character"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  Character
                </Link>

                <Link
                  to="/guilds"
                  className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
                >
                  Guilds
                </Link>

                <Link
                  to="/leaderboards"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  Leaderboard
                </Link>

                <div className="flex items-center ml-4">
                  <Link
                    to="/shop"
                    className="flex items-center bg-primary-600 px-3 py-1 rounded-full hover:bg-primary-700 transition"
                  >
                    <img
                      src="/assets/icons/gold-bar.png"
                      alt="Gold"
                      className="h-5 w-5 mr-1"
                    />
                    <span className="text-white font-medium">
                      {Number(profile?.gold ?? 0).toLocaleString()}
                    </span>
                  </Link>
                </div>

                <StudentNavDropdown displayName={student?.displayName ?? "Student"} />
              </div>

              <div className="-mr-2 flex items-center md:hidden">
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600 focus:outline-none"
                >
                  <i data-feather="menu" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="relative h-[560px] w-[1300px] max-w-[95%] mx-auto mb-8">
          <div
              className="absolute inset-0 rounded-xl overflow-hidden border border-white/10 bg-cover bg-center"
              style={{
                backgroundImage: "url('/assets/background/goblin_stage.png')",
                backgroundPosition: "center 80%",
              }}
            >
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={handleLeaveBattle}
                className="inline-flex items-center bg-lime-600 text-white border-2 border-lime-900 rounded-md px-3 py-2 hover:bg-lime-700"
              >
                <i data-feather="x" className="mr-2"></i>
                <span className="text-sm font-medium">Flee Battle</span>
              </button>
            </div>

            <div className="absolute top-4 right-4 z-20 flex flex-wrap gap-2 justify-end">
              <span className="px-3 py-1 rounded-full bg-slate-800/90 border border-slate-600 text-slate-100 text-xs font-semibold">
                {loadingInstance ? "Loading..." : getStatusLabel(instance?.status)}
              </span>

              {myParticipant ? (
                <span className="px-3 py-1 rounded-full bg-emerald-900/80 border border-emerald-500 text-emerald-200 text-xs font-semibold">
                  You: {myParticipant.state}
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-900/80 border border-amber-500 text-amber-200 text-xs font-semibold">
                  Not in roster
                </span>
              )}

              {myParticipant && myParticipant.state === "JOINED" && (
                <span className={`flex items-center gap-0.5 px-3 py-1 rounded-full bg-red-900/80 border text-xs font-semibold transition-all duration-150 ${heartFlash > 0 ? "border-red-300 scale-125 shadow-[0_0_12px_4px_rgba(239,68,68,0.7)]" : "border-red-500"}`}>
                  {Array.from({ length: profile.maxHearts || 5 }).map((_, i) => {
                    const currentHearts = Math.max(0, (profile.hearts ?? profile.maxHearts ?? 5) - localHeartsLost);
                    const filled = i < currentHearts;
                    return filled ? (
                      <svg key={i} className="w-4 h-4 text-red-400 fill-red-400" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                    ) : (
                      <svg key={i} className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    );
                  })}
                </span>
              )}
            </div>

            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[420px] max-w-[92%]">
              <div className="rounded-2xl bg-black/70 border border-red-500/60 p-4 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-red-200 text-xs uppercase tracking-[0.25em] font-bold">
                    Boss HP
                  </span>
                  <span className="text-white text-sm font-bold">
                    {Number(instance?.initial_boss_hp ?? 0) > 0
                      ? ((Number(instance?.current_boss_hp ?? 0) / Number(instance?.initial_boss_hp ?? 1)) * 100).toFixed(2)
                      : "0.00"}%
                  </span>
                </div>

                <div className="w-full h-5 rounded-full bg-slate-900 border border-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-400 transition-all duration-300"
                    style={{ width: `${bossHpPercent}%` }}
                  />
                </div>

                <div className="mt-2 text-center text-xs text-slate-300">
                  {template?.title ?? "Goblin King"}
                </div>
              </div>
            </div>

            <div className="absolute inset-0 z-10">
              {/* Party side — 10 slots (guild members replace NPCs as they join) */}
              <div className="absolute left-[1%] top-[2%] bottom-[2%] w-[48%] flex items-center">
                <div className="grid grid-cols-5 gap-x-1 gap-y-2 w-full px-1 pt-12">
                  {partyGrid.map((slot, i) => (
                    <CharacterCard key={slot.studentId ?? `npc-${i}`} slot={slot} />
                  ))}
                </div>
              </div>

              {/* Boss side */}
              <div className="absolute right-[6%] bottom-[22%] w-[34%] h-[70%] flex items-end justify-center">
                <img
                  src="/assets/boss/goblin_king.png"
                  alt="Goblin King"
                  className="w-[200px] md:w-[240px] lg:w-[280px] drop-shadow-[0_18px_28px_rgba(0,0,0,0.8)]"
                />
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-4 h-32 overflow-y-auto border-t-2 border-yellow-500 z-20">
              <div className="text-sm font-mono space-y-2">
                {battleLog.length === 0 ? (
                  <p className="text-slate-400">Battle log will appear here...</p>
                ) : (
                  battleLog.map((entry) => (
                    <p
                      key={entry.id}
                      className={
                        entry.kind === "success"
                          ? "text-emerald-300"
                          : entry.kind === "danger"
                          ? "text-red-300"
                          : entry.kind === "warning"
                          ? "text-yellow-300"
                          : "text-slate-200"
                      }
                    >
                      • {entry.text}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 mb-8 px-6 lg:px-0 max-w-7xl mx-auto">
          <div className="battle-box bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-yellow-500 rounded-xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-6 text-yellow-300 flex items-center gap-2">
              <i data-feather="book-open" className="text-yellow-400"></i>
              Problem
            </h2>

            {renderQuestionArea()}
          </div>
        </div>
      </div>

      {resultsCountdown !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="text-center">
            <p className="text-yellow-300 text-2xl font-bold mb-4">Battle Over!</p>
            <p className="text-slate-300 text-lg mb-6">Calculating rewards…</p>
            <div className="w-24 h-24 rounded-full border-4 border-yellow-500 flex items-center justify-center mx-auto">
              <span className="text-4xl font-extrabold text-yellow-300">{resultsCountdown}</span>
            </div>
          </div>
        </div>
      )}

      {showResultModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border-2 border-yellow-500 bg-gradient-to-br from-gray-900 to-slate-900 shadow-2xl text-white overflow-hidden">

            {/* Header */}
            <div className={`px-6 py-5 border-b border-white/10 text-center ${bossResults?.outcome === "WIN" ? "bg-gradient-to-r from-emerald-700 to-green-700" : "bg-gradient-to-r from-red-800 to-rose-800"}`}>
              <p className="text-3xl font-extrabold tracking-wide">
                {bossResults?.outcome === "WIN" ? "Victory!" : bossResults?.outcome === "ABORTED" ? "Battle Aborted" : "Defeated"}
              </p>
              {myGuildName && (
                <p className="text-sm text-white/80 mt-1 font-semibold">{myGuildName}</p>
              )}
              <p className="text-xs text-white/60 mt-1">
                {formatDateTime(bossResults?.completed_at || instance?.completed_at)}
              </p>
              {(bossResults?.fail_reason || instance?.fail_reason) ? (
                <p className="text-xs text-white/70 mt-1">
                  Reason: {bossResults?.fail_reason || instance?.fail_reason}
                </p>
              ) : null}
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {loadingResults ? (
                <div className="text-center text-slate-300 py-8">Loading results...</div>
              ) : (
                <>
                  {/* Rewards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-900/20 p-4 text-center">
                      <p className="text-xs uppercase tracking-widest text-yellow-400/70 mb-1">XP Earned</p>
                      <p className="text-3xl font-extrabold text-yellow-300">
                        {myStudentResult?.xp_awarded ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-4 text-center">
                      <p className="text-xs uppercase tracking-widest text-amber-400/70 mb-1">Gold Earned</p>
                      <p className="text-3xl font-extrabold text-amber-300">
                        {myStudentResult?.gold_awarded ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Your score */}
                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Your Score</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-white">
                        {myStudentResult?.total_correct ?? 0}
                        <span className="text-sm font-normal text-slate-400"> correct</span>
                      </span>
                      <span className="text-sm text-slate-400">
                        {myStudentResult?.total_incorrect ?? 0} wrong
                      </span>
                    </div>
                    {(() => {
                      const guildStudents = bossResults?.student_results?.filter(r => r.guild_id === myParticipant?.guild_id) ?? [];
                      if (guildStudents.length <= 1) return null;
                      const avg = guildStudents.length > 0
                        ? (guildStudents.reduce((s, r) => s + r.total_correct, 0) / guildStudents.length).toFixed(1)
                        : "0";
                      return <p className="text-xs text-cyan-400/70 mt-1">Guild average: {avg} correct</p>;
                    })()}
                  </div>

                  {/* Guild members */}
                  {(() => {
                    const guildStudents = bossResults?.student_results?.filter(r => r.guild_id === myParticipant?.guild_id) ?? [];
                    if (guildStudents.length === 0) return null;
                    return (
                      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                        <p className="text-xs uppercase tracking-widest text-cyan-400/70 mb-3">
                          {myParticipant?.guild_id ? (guildNameMap[myParticipant.guild_id] ?? "Guild") : "Guild"} Members
                        </p>
                        <div className="space-y-2">
                          {guildStudents.map(sr => {
                            const isMe = sr.student_id === studentId;
                            const memberName = isMe
                              ? "You"
                              : (resultStudentNameMap[sr.student_id] || roster.find(r => r.studentId === sr.student_id)?.displayName || sr.student_id.slice(0, 8));
                            const heartsDisplay = sr.hearts_lost > 0
                              ? `${sr.hearts_lost} heart${sr.hearts_lost !== 1 ? "s" : ""} lost`
                              : "No hearts lost";
                            return (
                              <div
                                key={sr.student_id}
                                className={`flex items-center justify-between rounded-lg px-3 py-2 ${isMe ? "bg-yellow-900/30 border border-yellow-600/30" : "bg-white/5"}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`text-sm font-semibold truncate ${isMe ? "text-yellow-300" : "text-white"}`}>
                                    {memberName}
                                  </span>
                                  {sr.participation_state === "DOWNED" && (
                                    <span className="text-xs text-red-400 shrink-0">(downed)</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm shrink-0">
                                  <span className="text-emerald-400 font-bold">{sr.total_correct} correct</span>
                                  <span className={`${sr.hearts_lost > 0 ? "text-red-400" : "text-green-400"}`}>
                                    {heartsDisplay}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Guild contribution rankings */}
                  {(() => {
                    const guildResults = bossResults?.guild_results ?? [];
                    if (guildResults.length === 0) return null;
                    const RANK_LABELS: Record<number, string> = { 1: "🥇 1st", 2: "🥈 2nd", 3: "🥉 3rd" };
                    const BONUS_LABELS: Record<number, string> = { 1: "+25%", 2: "+15%", 3: "+10%" };
                    const sorted = [...guildResults].sort((a, b) => b.guild_total_damage_to_boss - a.guild_total_damage_to_boss);
                    return (
                      <div className="rounded-xl border border-purple-500/30 bg-purple-900/10 p-4">
                        <p className="text-xs uppercase tracking-widest text-purple-400/70 mb-3">
                          Guild Damage Rankings
                        </p>
                        <div className="space-y-2">
                          {sorted.map(gr => {
                            const rank = gr.contribution_rank;
                            const isMyGuild = gr.guild_id === myParticipant?.guild_id;
                            const bonusLabel = rank ? BONUS_LABELS[rank] : null;
                            const rankLabel = rank ? RANK_LABELS[rank] : null;
                            return (
                              <div
                                key={gr.guild_id}
                                className={`flex items-center justify-between rounded-lg px-3 py-2 ${isMyGuild ? "bg-purple-900/40 border border-purple-500/30" : "bg-white/5"}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-white">
                                    {guildNameMap[gr.guild_id] ?? "Guild"}
                                  </span>
                                  {rankLabel && <span className="text-xs text-yellow-300">{rankLabel}</span>}
                                </div>
                                <div className="flex items-center gap-3 text-sm shrink-0">
                                  <span className="text-cyan-400">{gr.guild_total_correct} correct</span>
                                  {bonusLabel && (
                                    <span className="text-emerald-400 font-bold">{bonusLabel} bonus</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            <div className="flex justify-end px-5 py-4 border-t border-white/10 bg-black/20">
              <button
                onClick={() => { window.location.href = "/guilds"; }}
                className="px-4 py-2 rounded-md bg-emerald-600 border border-emerald-800 text-white hover:bg-emerald-700"
              >
                Back to Guilds
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default BossFight;