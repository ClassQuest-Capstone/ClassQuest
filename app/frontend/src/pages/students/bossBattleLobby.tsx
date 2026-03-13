// src/pages/students/bossBattleLobby.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import feather from "feather-icons";

import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";

// class resolution
import {
  getStudentEnrollments,
  type EnrollmentItem,
} from "../../api/classEnrollments.js";

import type { ClassItem } from "../../api/classes.js";
import { api } from "../../api/http.js";

// guilds + membership
import { listGuildsByClass, type Guild } from "../../api/guilds.js";
import {
  getGuildMembership,
  type GuildMembership,
} from "../../api/guildMemberships.js";

// student profiles
import { getStudentProfile } from "../../api/studentProfiles.js";

// boss instance + template
import { getBossBattleInstance } from "../../api/bossBattleInstances/client.js";
import type { BossBattleInstance } from "../../api/bossBattleInstances/types.js";

import { getBossBattleTemplate } from "../../api/bossBattleTemplates/client.js";
import type { BossBattleTemplate } from "../../api/bossBattleTemplates/types.js";

// participants
import {
  joinBossBattle,
  spectateBossBattle,
  leaveBossBattle,
  listBossBattleParticipants,
} from "../../api/bossBattleParticipants/client.js";
import type { BossBattleParticipant } from "../../api/bossBattleParticipants/types.js";

import { useBattlePolling, useRosterPolling } from "../../hooks/useBattlePolling.ts";

// --------------------
// Student helper
// --------------------
type StudentUser = {
  id: string;
  role: "student";
  displayName?: string;
  email?: string;
  classId?: string;
};

type StudentNameMap = Record<string, string>;

function getCurrentStudent(): StudentUser | null {
  const raw = localStorage.getItem("cq_currentUser");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.role === "student") return parsed as StudentUser;
  } catch {}

  return null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchStudentNames(studentIds: string[]): Promise<StudentNameMap> {
  const unique = Array.from(new Set(studentIds)).filter(Boolean);
  const map: StudentNameMap = {};

  for (const batch of chunk(unique, 12)) {
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          const prof: any = await getStudentProfile(id);
          const name =
            prof?.display_name ||
            prof?.displayName ||
            prof?.username ||
            prof?.name ||
            id;
          return [id, name] as const;
        } catch {
          return [id, id] as const;
        }
      })
    );

    for (const [id, name] of results) map[id] = name;
  }

  return map;
}

async function fetchAllGuildsByClass(classId: string) {
  const all: Guild[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const res = await listGuildsByClass(classId, 100, cursor);
    all.push(...(res.items || []));
    if (!res.hasMore) break;
    cursor = res.nextCursor;
    if (!cursor) break;
  }

  return all;
}

function getStatusColor(status?: string): string {
  const stat = status?.toLowerCase() ?? "";

  if (stat === "completed") return "bg-green-500";
  if (stat === "lobby" || stat === "countdown") return "bg-blue-500";
  if (stat === "question_active" || stat === "resolving") return "bg-purple-500";
  if (stat === "intermission") return "bg-cyan-500";
  if (stat === "aborted") return "bg-red-500";

  return "bg-yellow-500";
}

function getGradientBySubject(subject?: string): string {
  if (!subject) return "from-yellow-400 to-yellow-600";

  const normalized = subject.toLowerCase().trim();

  if (normalized === "math") return "from-blue-500 to-purple-500";
  if (normalized === "science") return "from-emerald-400 to-cyan-500";
  if (normalized === "social studies") return "from-orange-400 to-red-500";

  return "from-yellow-400 to-yellow-600";
}

function getSecondsRemaining(endAt?: string | null) {
  if (!endAt) return 0;
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

export default function BossBattleLobbyStudent() {
  const navigate = useNavigate();
  const { bossInstanceId } = useParams();

  const student = useMemo<StudentUser | null>(() => getCurrentStudent(), []);
  const studentId = student?.id ?? null;

  if (!student) return <Navigate to="/StudentLogin" replace />;
  if (!bossInstanceId) return <Navigate to="/guilds" replace />;

  // --------------------
  // state
  // --------------------
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [classId, setClassId] = useState<string | null>(null);
  const [classInfo, setClassInfo] = useState<ClassItem | null>(null);

  const [membership, setMembership] = useState<GuildMembership | null>(null);

  const [instance, setInstance] = useState<BossBattleInstance | null>(null);
  const [template, setTemplate] = useState<BossBattleTemplate | null>(null);

  const [participants, setParticipants] = useState<BossBattleParticipant[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [nameMap, setNameMap] = useState<StudentNameMap>({});
  const [countdownLeft, setCountdownLeft] = useState(0);

  const polledInstance = useBattlePolling(bossInstanceId, 2500);
  const polledParticipants = useRosterPolling(bossInstanceId, 3000);

  // gold display
  const { profile } = usePlayerProgression(studentId || "", classId || "");

  useEffect(() => {
    let cancelled = false;

    async function resolveClassId() {
      if (student?.classId) {
        if (!cancelled) setClassId(student.classId);
        return;
      }

      const stored = localStorage.getItem("cq_currentClassId");
      if (stored) {
        if (!cancelled) setClassId(stored);
        return;
      }

      if (!studentId) return;

      try {
        const res = await getStudentEnrollments(studentId);
        const items: EnrollmentItem[] = res?.items ?? [];

        const active = items.filter((e) => e.status === "active");
        if (active.length === 0) {
          if (!cancelled) setClassId(null);
          return;
        }

        active.sort(
          (a, b) =>
            new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
        );

        const cid = active[0].class_id;

        if (!cancelled) {
          setClassId(cid);
          localStorage.setItem("cq_currentClassId", cid);
        }
      } catch {
        if (!cancelled) setClassId(null);
      }
    }

    resolveClassId();
    return () => {
      cancelled = true;
    };
  }, [student?.classId, studentId]);

  // --------------------
  // refresh everything
  // --------------------
  const refresh = useCallback(async () => {
    if (!bossInstanceId) {
      setError("Missing bossInstanceId in the URL.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      // 1) instance
      const inst = await getBossBattleInstance(bossInstanceId);
      setInstance(inst);

      // 2) class id from instance as source of truth
      const resolvedClassId = inst?.class_id || classId || null;
      if (resolvedClassId) {
        setClassId(resolvedClassId);

        try {
          const cls = await api<ClassItem>(
            `/classes/${encodeURIComponent(resolvedClassId)}`
          );
          setClassInfo(cls);
        } catch {
          setClassInfo(null);
        }

        try {
          const guildMembership = studentId
            ? await getGuildMembership(resolvedClassId, studentId)
            : null;
          setMembership(guildMembership);
        } catch {
          setMembership(null);
        }

        try {
          const gs = await fetchAllGuildsByClass(resolvedClassId);
          setGuilds(gs);
        } catch {
          setGuilds([]);
        }
      } else {
        setGuilds([]);
        setMembership(null);
      }

      // 3) template
      if (inst?.boss_template_id) {
        try {
          const t = await getBossBattleTemplate(inst.boss_template_id);
          setTemplate(t);
        } catch {
          setTemplate(null);
        }
      } else {
        setTemplate(null);
      }

      // 4) participants
      const roster = await listBossBattleParticipants(bossInstanceId);
      const items = roster.items || [];
      setParticipants(items);

      // 5) names
      const ids = items.map((p) => p.student_id);
      const nm = await fetchStudentNames(ids);
      setNameMap(nm);
    } catch (err: any) {
      console.error("Error loading student lobby:", err);
      setError(err?.message || "Failed to load lobby. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [bossInstanceId, classId, studentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Merge polled instance into state
  useEffect(() => {
    if (polledInstance) setInstance(polledInstance);
  }, [polledInstance]);

  // Merge polled roster into state and hydrate any new names
  useEffect(() => {
    if (polledParticipants.length > 0 || instance) setParticipants(polledParticipants);

    const missingIds = polledParticipants
      .map((p) => p.student_id)
      .filter((id) => id && !nameMap[id]);

    if (missingIds.length > 0) {
      fetchStudentNames(missingIds).then((nm) =>
        setNameMap((prev) => ({ ...prev, ...nm }))
      );
    }
  }, [polledParticipants]);

  // local countdown tick
  useEffect(() => {
    if (instance?.status !== "COUNTDOWN") {
      setCountdownLeft(0);
      return;
    }

    const tick = () => {
      setCountdownLeft(getSecondsRemaining(instance?.countdown_end_at));
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, [instance?.status, instance?.countdown_end_at]);

  // icons
  useEffect(() => {
    feather.replace();
  }, [loading, participants, guilds, error, success, instance, template, membership, countdownLeft]);

  const guildById = useMemo(() => {
    const m = new Map<string, Guild>();
    for (const g of guilds) m.set((g as any).guild_id, g);
    return m;
  }, [guilds]);

  const grouped = useMemo(() => {
    const noGuildKey = "__NO_GUILD__";
    const map = new Map<string, BossBattleParticipant[]>();

    for (const p of participants) {
      const gid = (p as any)?.guild_id || noGuildKey;
      if (!map.has(gid)) map.set(gid, []);
      map.get(gid)!.push(p);
    }

    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === noGuildKey) return 1;
      if (b === noGuildKey) return -1;
      const an = (guildById.get(a) as any)?.name || `Guild ${a}`;
      const bn = (guildById.get(b) as any)?.name || `Guild ${b}`;
      return String(an).localeCompare(String(bn));
    });

    return { keys, map, noGuildKey };
  }, [participants, guildById]);

  const myParticipant = useMemo(() => {
    return participants.find((p) => p.student_id === studentId) || null;
  }, [participants, studentId]);

  const myGuildName = useMemo(() => {
    const gid = membership?.guild_id;
    if (!gid) return null;
    return (guildById.get(gid) as any)?.name || gid;
  }, [membership, guildById]);

  const subjectGradient = getGradientBySubject(template?.subject);
  const statusBg = getStatusColor(instance?.status);

  const initialHp = instance?.initial_boss_hp || 0;
  const currentHp = instance?.current_boss_hp || 0;
  const hpPercent =
    initialHp > 0 ? Math.max(0, Math.min(100, (currentHp / initialHp) * 100)) : 0;

  const canJoin =
    instance?.status === "LOBBY" || instance?.status === "COUNTDOWN";

  // --------------------
  // auto redirect to boss fight when battle goes live
  // --------------------
  useEffect(() => {
    if (!bossInstanceId || !instance || !myParticipant) return;

    const allowedParticipantStates = ["JOINED", "SPECTATE"];
    const liveBattleStates = [
      "QUESTION_ACTIVE",
      "RESOLVING",
      "INTERMISSION",
      "COMPLETED",
    ];

    if (
      allowedParticipantStates.includes(myParticipant.state) &&
      liveBattleStates.includes(instance.status)
    ) {
      navigate("/bossFight", { replace: true });
      return;
    }

    if (
      allowedParticipantStates.includes(myParticipant.state) &&
      instance.status === "COUNTDOWN" &&
      countdownLeft <= 0
    ) {
      navigate("/bossFight", { replace: true });
    }
  }, [bossInstanceId, instance, myParticipant, countdownLeft, navigate]);

  async function handleJoin() {
    if (!bossInstanceId) return;

    if (!membership?.guild_id) {
      setError("You must be assigned to a guild before joining this lobby.");
      setSuccess("");
      return;
    }

    try {
      setBusy(true);
      setError("");
      setSuccess("");

      try {
        await leaveBossBattle(bossInstanceId);
      } catch {
        // ignore
      }

      await joinBossBattle(bossInstanceId, {
        guild_id: membership.guild_id,
      });

      setSuccess("You joined the boss battle lobby.");
      await refresh();
    } catch (err: any) {
      console.error("Join failed:", err);
      setError(err?.message || "Failed to join lobby.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSpectate() {
    if (!bossInstanceId) return;

    try {
      setBusy(true);
      setError("");
      setSuccess("");

      await spectateBossBattle(bossInstanceId);
      setSuccess("You are now spectating.");
      await refresh();
    } catch (err: any) {
      console.error("Spectate failed:", err);
      setError(err?.message || "Failed to spectate.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!bossInstanceId) return;

    try {
      setBusy(true);
      setError("");
      setSuccess("");

      await leaveBossBattle(bossInstanceId);
      setSuccess("You left the boss battle lobby.");
      await refresh();
    } catch (err: any) {
      console.error("Leave failed:", err);
      setError(err?.message || "Failed to leave lobby.");
    } finally {
      setBusy(false);
    }
  }

  const classLabel = classInfo?.name ?? instance?.class_id ?? "—";

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat bg-gray-900"
      style={{ backgroundImage: "url('/assets/background/guilds-bg.png')" }}
    >
      {/* Nav */}
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

              <Link
                to="/shop"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Shop
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
                    {profile?.gold?.toLocaleString?.() ?? "0"}
                  </span>
                </Link>
              </div>

              <div className="relative ml-3">
                <button
                  id="user-menu-button"
                  className="flex items-center text-sm rounded-full focus:outline-none"
                >
                  <img
                    className="h-8 w-8 rounded-full"
                    src="http://static.photos/people/200x200/8"
                    alt=""
                  />
                  <span className="ml-2 text-sm font-medium">
                    {student?.displayName ?? "Student"}
                  </span>
                </button>
              </div>
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

      {/* Top actions */}
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate("/guilds")}
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </button>

        <button
          className="inline-flex items-center bg-blue-600 text-white border-2 border-blue-600 rounded-md px-3 py-2 hover:bg-blue-700 disabled:opacity-60"
          onClick={refresh}
          disabled={loading || busy}
        >
          <i data-feather="refresh-cw" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Refresh</span>
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-100">Boss Battle Lobby</h1>
            <p className="text-white">
              See who has joined and wait for your teacher to start the battle.
            </p>
            <p className="text-white/80 text-sm mt-1">
              Instance: <span className="font-mono">{bossInstanceId}</span>
              {" "}· Class: <span className="font-semibold">{classLabel}</span>
              {instance?.status ? (
                <>
                  {" "}· Status: <b>{instance.status}</b>
                </>
              ) : null}
              {instance?.status === "COUNTDOWN" ? (
                <>
                  {" "}· Countdown: <b>{countdownLeft}</b>
                </>
              ) : null}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md px-4 py-3 text-gray-700">
            <div className="text-xs tracking-widest text-gray-500 font-semibold">
              YOUR STATUS
            </div>
            <div className="mt-1 text-sm">
              {myParticipant ? `IN LOBBY (${myParticipant.state})` : "NOT JOINED"}
            </div>
            <div className="mt-1 text-xs text-gray-600">
              Guild: <b>{myGuildName || "None"}</b>
            </div>
            {instance?.status === "COUNTDOWN" && (
              <div className="mt-1 text-xs text-gray-600">
                Countdown: <b>{countdownLeft}</b>
              </div>
            )}
          </div>
        </div>

        {/* Main battle card */}
        {instance && (
          <div
            className={`bg-gradient-to-r ${subjectGradient} text-white rounded-xl shadow-lg overflow-hidden mb-6`}
          >
            <div className="p-6">
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    {template?.title || "Unnamed Boss"}
                  </h2>
                  <p className="text-sm opacity-90 mt-1">
                    {template?.description || "No description provided."}
                  </p>
                </div>

                <div
                  className={`${statusBg} text-white px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap`}
                >
                  {instance.status || "DRAFT"}
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <span className="bg-white/20 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold">
                  {template?.subject || "Other"}
                </span>

                {membership?.guild_id && (
                  <span className="bg-green-300/30 text-green-100 px-3 py-1 rounded-full text-xs font-semibold">
                    Guild Ready
                  </span>
                )}

                {instance.status === "COUNTDOWN" && (
                  <span className="bg-black/20 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold">
                    Starts In: {countdownLeft}
                  </span>
                )}
              </div>

              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold">Boss Health</span>
                  <span className="text-sm font-semibold">
                    {currentHp.toLocaleString()} / {initialHp.toLocaleString()} HP
                  </span>
                </div>

                <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-white h-full transition-all duration-300"
                    style={{ width: `${hpPercent}%` }}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5 bg-white/10 backdrop-blur p-4 rounded-lg">
                <div>
                  <p className="text-xs opacity-75 mb-1">Max HP</p>
                  <p className="text-lg font-bold">
                    {(template?.max_hp ?? initialHp)?.toLocaleString?.() ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs opacity-75 mb-1">XP Reward</p>
                  <p className="text-lg font-bold">
                    +{template?.base_xp_reward?.toLocaleString?.() ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs opacity-75 mb-1">Gold Reward</p>
                  <p className="text-lg font-bold">
                    +{template?.base_gold_reward?.toLocaleString?.() ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs opacity-75 mb-1">Participants</p>
                  <p className="text-lg font-bold">{participants.length}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  className={`w-full font-bold py-3 rounded-lg transition-colors shadow-lg ${
                    canJoin && membership?.guild_id && !busy
                      ? "bg-white text-gray-800 hover:bg-gray-100"
                      : "bg-white/40 text-white/90 cursor-not-allowed"
                  }`}
                  onClick={handleJoin}
                  disabled={!canJoin || !membership?.guild_id || busy}
                  title={
                    canJoin
                      ? "Join the lobby"
                      : "Lobby is not open for joining."
                  }
                >
                  Join Lobby
                </button>

                <button
                  className={`w-full font-bold py-3 rounded-lg transition-colors shadow-lg ${
                    !busy
                      ? "bg-blue-900/70 text-white hover:bg-blue-900"
                      : "bg-white/40 text-white/90 cursor-not-allowed"
                  }`}
                  onClick={handleSpectate}
                  disabled={busy}
                >
                  Spectate
                </button>

                <button
                  className={`w-full font-bold py-3 rounded-lg transition-colors shadow-lg ${
                    !busy
                      ? "bg-red-900/70 text-white hover:bg-red-900"
                      : "bg-white/40 text-white/90 cursor-not-allowed"
                  }`}
                  onClick={handleLeave}
                  disabled={busy}
                >
                  Leave Lobby
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-100 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <i data-feather="alert-triangle" className="w-5 h-5" />
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500/40 text-green-100 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <i data-feather="check-circle" className="w-5 h-5" />
              <span>{success}</span>
            </div>
          </div>
        )}

        {/* Loading / empty / grouped participants */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700 text-center">
            <p>Loading lobby...</p>
          </div>
        ) : participants.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700">
            No participants yet. Join the lobby to show up here.
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.keys.map((gid) => {
              const list = grouped.map.get(gid) || [];
              const guildName =
                gid === grouped.noGuildKey
                  ? "No Guild / Unknown"
                  : (guildById.get(gid) as any)?.name || `Guild ${gid}`;

              const joined = list.filter((p: any) => p.state === "JOINED");
              const spectate = list.filter((p: any) => p.state === "SPECTATE");

              return (
                <div key={gid} className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="bg-linear-to-r from-blue-500 to-indigo-600 p-5 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold">{guildName}</h3>
                        <p className="text-white/80 text-sm">
                          Joined: {joined.length} · Spectating: {spectate.length}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                        <i data-feather="shield" className="w-6 h-6 text-gray-800"></i>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-xs tracking-widest text-gray-500 font-semibold mb-2">
                        JOINED
                      </div>
                      {joined.length === 0 ? (
                        <div className="text-gray-600">None</div>
                      ) : (
                        <div className="space-y-2">
                          {joined.map((p: any) => {
                            const name = nameMap[p.student_id] || p.student_id;
                            const isMe = p.student_id === studentId;

                            return (
                              <div
                                key={p.student_id}
                                className={`border rounded-lg p-3 ${
                                  isMe ? "bg-blue-50 border-blue-300" : ""
                                }`}
                              >
                                <div className="font-bold text-gray-900 truncate">
                                  {name} {isMe ? "(You)" : ""}
                                </div>
                                {p.is_downed ? (
                                  <div className="mt-1 text-xs font-semibold text-red-600">
                                    DOWN
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs tracking-widest text-gray-500 font-semibold mb-2">
                        SPECTATING
                      </div>
                      {spectate.length === 0 ? (
                        <div className="text-gray-600">None</div>
                      ) : (
                        <div className="space-y-2">
                          {spectate.map((p: any) => {
                            const name = nameMap[p.student_id] || p.student_id;
                            const isMe = p.student_id === studentId;

                            return (
                              <div
                                key={p.student_id}
                                className={`border rounded-lg p-3 ${
                                  isMe ? "bg-blue-50 border-blue-300" : ""
                                }`}
                              >
                                <div className="font-bold text-gray-900 truncate">
                                  {name} {isMe ? "(You)" : ""}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}