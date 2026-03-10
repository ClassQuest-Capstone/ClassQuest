import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import feather from "feather-icons";
import { fetchAuthSession } from "aws-amplify/auth";

import DropDownProfile from "../features/teacher/dropDownProfile.tsx";
import { getTeacherProfile } from "../../api/teacherProfiles.js";

import { listGuildsByClass, type Guild } from "../../api/guilds.js";
import { getStudentProfile } from "../../api/studentProfiles.js";

import {
  getBossBattleInstance,
  updateBossBattleInstance,
} from "../../api/bossBattleInstances/client.js";
import type { BossBattleInstance } from "../../api/bossBattleInstances/types.js";

import {
  listBossBattleParticipants,
  kickParticipant,
  type BossBattleParticipant,
} from "../../api/bossBattleParticipants/client.js";

type TeacherUser = {
  id: string;
  role: "teacher";
  school_id: string;
  displayName?: string;
  email?: string;
};

type TeacherContext = {
  teacher_id: string;
  school_id: string;
};

type StudentNameMap = Record<string, string>;

function getTeacherIdFromLocalStorage(): string | null {
  const raw = localStorage.getItem("cq_currentUser");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return (
      parsed?.id ??
      parsed?.teacher_id ??
      parsed?.userId ??
      parsed?.sub ??
      parsed?.username ??
      null
    );
  } catch {
    return null;
  }
}

async function resolveTeacherContext(): Promise<TeacherContext> {
  let teacher_id = getTeacherIdFromLocalStorage();

  if (!teacher_id) {
    const session = await fetchAuthSession();
    const sub =
      (session as any)?.userSub ??
      (session as any)?.tokens?.idToken?.payload?.sub ??
      null;

    if (!sub) throw new Error("Could not determine teacher_id. Please log in again.");
    teacher_id = sub;
  }

  const profile = await getTeacherProfile(teacher_id);
  if (!profile?.school_id) throw new Error("Teacher profile missing school_id.");

  return { teacher_id, school_id: profile.school_id };
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

function isoNowPlusSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function getSecondsRemaining(endAt?: string | null) {
  if (!endAt) return 0;
  const end = new Date(endAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

export default function BossBattleLobbyTeacher() {
  const navigate = useNavigate();
  const { bossInstanceId } = useParams();

  const teacher = useMemo<TeacherUser | null>(() => {
    const raw = localStorage.getItem("cq_currentUser");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.role === "teacher") return parsed as TeacherUser;
    } catch {}
    return null;
  }, []);

  if (!teacher) return <Navigate to="/TeacherLogin" replace />;

  const [teacherCtx, setTeacherCtx] = useState<TeacherContext | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const [instance, setInstance] = useState<BossBattleInstance | null>(null);
  const [participants, setParticipants] = useState<BossBattleParticipant[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [nameMap, setNameMap] = useState<StudentNameMap>({});
  const [countdownLeft, setCountdownLeft] = useState(0);

  const refresh = useCallback(async () => {
    if (!bossInstanceId) {
      setError("Missing bossInstanceId in the URL.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const inst = await getBossBattleInstance(bossInstanceId);
      setInstance(inst);

      const roster = await listBossBattleParticipants(bossInstanceId);
      const items = roster.items || [];
      setParticipants(items);

      if (inst?.class_id) {
        const gs = await fetchAllGuildsByClass(inst.class_id);
        setGuilds(gs);
      } else {
        setGuilds([]);
      }

      const ids = items.map((p: any) => p.student_id);
      const nm = await fetchStudentNames(ids);
      setNameMap(nm);
    } catch (err: any) {
      console.error("Error loading teacher lobby:", err);
      setError(err?.message || "Failed to load lobby. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [bossInstanceId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const ctx = await resolveTeacherContext();
        if (!mounted) return;
        setTeacherCtx(ctx);
        await refresh();
      } catch (err: any) {
        console.error("Error resolving teacher context:", err);
        if (!mounted) return;
        setError(err?.message || "Failed to load teacher context.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [refresh]);

  useEffect(() => {
    feather.replace();
  }, [loading, participants, guilds, error, instance, busy, countdownLeft]);

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

  const joinedParticipants = useMemo(
    () => participants.filter((p: any) => String(p?.state || "").toUpperCase() === "JOINED"),
    [participants]
  );

  const spectatingParticipants = useMemo(
    () => participants.filter((p: any) => String(p?.state || "").toUpperCase() === "SPECTATE"),
    [participants]
  );

  const currentStatus = String(instance?.status || "").trim().toUpperCase();

  const hasScheduledDate = Boolean(
    (instance as any)?.scheduled_at ||
      (instance as any)?.start_time ||
      (instance as any)?.battle_date
  );

  const canOpenLobby = !hasScheduledDate;
  const canStartCountdown = currentStatus === "LOBBY";
  const canAbort = [
    "",
    "DRAFT",
    "SCHEDULED",
    "LOBBY",
    "COUNTDOWN",
    "QUESTION_ACTIVE",
    "INTERMISSION",
    "RESOLVING",
  ].includes(currentStatus);

  const rosterLocked = [
    "COUNTDOWN",
    "QUESTION_ACTIVE",
    "INTERMISSION",
    "RESOLVING",
    "COMPLETED",
    "ABORTED",
  ].includes(currentStatus);

  useEffect(() => {
    if (currentStatus !== "COUNTDOWN") {
      setCountdownLeft(0);
      return;
    }

    const endAt = (instance as any)?.countdown_end_at;
    setCountdownLeft(getSecondsRemaining(endAt));

    const timer = window.setInterval(() => {
      const remaining = getSecondsRemaining(endAt);
      setCountdownLeft(remaining);

      if (remaining <= 0) {
        window.clearInterval(timer);
        navigate(`/teacher/bossfight-monitor/${bossInstanceId}`, { replace: true });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentStatus, (instance as any)?.countdown_end_at, bossInstanceId, navigate]);

  useEffect(() => {
    if (!instance?.boss_instance_id) return;

    const teacherLiveStates = [
      "QUESTION_ACTIVE",
      "RESOLVING",
      "INTERMISSION",
      "COMPLETED",
    ];

    if (teacherLiveStates.includes(currentStatus)) {
      navigate(`/teacher/bossfight-monitor/${instance.boss_instance_id}`, {
        replace: true,
      });
    }
  }, [currentStatus, instance?.boss_instance_id, navigate]);

  async function handleKick(studentId: string) {
    if (!bossInstanceId) return;

    if (rosterLocked) {
      setError("Roster is locked. Students can only be kicked while the battle is in SCHEDULED, DRAFT, or LOBBY.");
      return;
    }

    if (!confirm("Kick this student from the lobby?")) return;

    try {
      setBusy(true);
      setError("");
      await kickParticipant(bossInstanceId, studentId, { reason: "Removed by teacher" });
      await refresh();
    } catch (err: any) {
      console.error("Kick failed:", err);
      setError(err?.message || "Failed to kick student.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenLobby() {
    if (!bossInstanceId) return;

    if (!canOpenLobby) {
      setError("Lobby cannot open because this battle already has a scheduled date.");
      return;
    }

    try {
      setBusy(true);
      setError("");

      await updateBossBattleInstance(bossInstanceId, {
        status: "LOBBY" as any,
        lobby_opened_at: new Date().toISOString(),
      } as any);

      await refresh();
    } catch (err: any) {
      console.error("Open lobby failed:", err);
      setError(err?.message || "Failed to open lobby.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStartCountdown() {
    if (!bossInstanceId) return;

    if (!canStartCountdown) {
      setError("Start Countdown is only allowed when the instance is in LOBBY.");
      return;
    }

    if (joinedParticipants.length === 0) {
      setError("You need at least one JOINED participant before starting the countdown.");
      return;
    }

    const countdownSeconds =
      Number((instance as any)?.countdown_seconds) > 0
        ? Number((instance as any).countdown_seconds)
        : 10;

    try {
      setBusy(true);
      setError("");

      await updateBossBattleInstance(bossInstanceId, {
        status: "COUNTDOWN" as any,
        countdown_seconds: countdownSeconds,
        countdown_end_at: isoNowPlusSeconds(countdownSeconds),
      } as any);

      await refresh();
    } catch (err: any) {
      console.error("Start countdown failed:", err);
      setError(err?.message || "Failed to start countdown.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAbort() {
    if (!bossInstanceId) return;

    if (!canAbort) {
      setError(`Abort is not allowed while status is ${currentStatus || "UNKNOWN"}.`);
      return;
    }

    if (!confirm("Abort this battle? This will end the lobby/battle immediately.")) return;

    try {
      setBusy(true);
      setError("");

      await updateBossBattleInstance(bossInstanceId, {
        status: "ABORTED" as any,
        outcome: "ABORTED",
        fail_reason: "ABORTED_BY_TEACHER",
        completed_at: new Date().toISOString(),
      } as any);

      await refresh();
    } catch (err: any) {
      console.error("Abort failed:", err);
      setError(err?.message || "Failed to abort battle.");
    } finally {
      setBusy(false);
    }
  }

  const statusHelpText = useMemo(() => {
    if (currentStatus === "COUNTDOWN") {
      return `Countdown in progress: ${countdownLeft}s remaining.`;
    }

    if (!hasScheduledDate) {
      return "No scheduled date is set for this battle. You can open the lobby.";
    }

    switch (currentStatus) {
      case "":
        return "Battle status is empty or not set yet.";
      case "SCHEDULED":
        return "Battle is scheduled but not open yet. Open the lobby when needed.";
      case "DRAFT":
        return "Battle created but not open yet. Students cannot officially join until you open the lobby.";
      case "LOBBY":
        return "Lobby is open. Students may join or spectate. Roster is not locked yet.";
      case "QUESTION_ACTIVE":
        return "A question is currently live. Students can submit answers.";
      case "RESOLVING":
        return "The server is resolving the current question. No new submissions should be accepted.";
      case "INTERMISSION":
        return "Short break between questions.";
      case "COMPLETED":
        return "Battle is finished.";
      case "ABORTED":
        return "Battle was manually aborted by the teacher.";
      default:
        return `Current status is "${currentStatus}".`;
    }
  }, [currentStatus, hasScheduledDate, countdownLeft]);

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat h-screen overflow-y-auto">
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="shrink-0 flex items-center">
                <Link
                  to="/teacherDashboard"
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                  <span className="text-xl font-bold">ClassQuest</span>
                </Link>
              </div>
            </div>

            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Dashboard</Link>
              <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Classes</Link>
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
              <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Activity</Link>
              <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Guilds</Link>

              <DropDownProfile
                username={teacher?.displayName || "user"}
                onLogout={() => {
                  localStorage.removeItem("cq_currentUser");
                  navigate("/TeacherLogin");
                }}
              />
            </div>

            <div className="-mr-2 flex items-center md:hidden">
              <button className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600">
                <i data-feather="menu"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
        <Link
          to="/teacherDashboard"
          className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-700 rounded-md px-3 py-2 hover:bg-indigo-700 shadow-md"
        >
          <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Back</span>
        </Link>

        <button
          className="inline-flex items-center bg-blue-600 text-white border-2 border-blue-700 rounded-md px-3 py-2 hover:bg-blue-700 shadow-md disabled:opacity-60"
          onClick={refresh}
          disabled={loading || busy}
        >
          <i data-feather="refresh-cw" className="w-5 h-5 mr-2"></i>
          <span className="text-sm font-medium">Refresh</span>
        </button>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-yellow-300">Boss Battle Lobby</h1>
            <p className="text-white">
              Teacher view of who has joined. Students are grouped by guild.
            </p>
            <p className="text-white/80 text-sm mt-1">
              Instance: <span className="font-mono">{bossInstanceId || "?"}</span>
              {instance?.class_id ? (
                <>
                  {" "}
                  · Class: <span className="font-mono">{instance.class_id}</span>
                </>
              ) : null}
              {" "}
              · Status: <b>{instance?.status || "(empty)"}</b>
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md px-4 py-3 text-gray-700">
            <div className="text-xs tracking-widest text-gray-500 font-semibold">STATUS</div>
            <div className="mt-1 text-sm">{loading ? "Loading..." : error ? "Error" : "Loaded"}</div>
            <div className="mt-1 text-xs text-gray-600">
              Joined: <b>{joinedParticipants.length}</b> · Spectating: <b>{spectatingParticipants.length}</b> · Guilds: <b>{guilds.length}</b>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-4 mb-6 text-gray-800">
          <div className="flex flex-wrap gap-3 items-start justify-between">
            <div className="min-w-0">
              <div className="text-xs tracking-widest text-gray-500 font-semibold">TEACHER CONTROLS</div>
              <div className="mt-2 text-sm text-gray-700">{statusHelpText}</div>
              <div className="mt-2 text-xs text-gray-500 space-y-1">
                <div>Scheduled at: <b>{formatDateTime((instance as any)?.scheduled_at)}</b></div>
                <div>Start time: <b>{formatDateTime((instance as any)?.start_time)}</b></div>
                <div>Battle date: <b>{formatDateTime((instance as any)?.battle_date)}</b></div>
                <div>Lobby opened at: <b>{formatDateTime((instance as any)?.lobby_opened_at)}</b></div>
                <div>Countdown seconds: <b>{Number((instance as any)?.countdown_seconds) > 0 ? Number((instance as any)?.countdown_seconds) : 10}</b></div>
                <div>Countdown ends at: <b>{formatDateTime((instance as any)?.countdown_end_at)}</b></div>
                {currentStatus === "COUNTDOWN" && (
                  <div className="text-lg font-bold text-emerald-600">
                    Countdown: {countdownLeft}
                  </div>
                )}
                <div>Roster locked: <b>{rosterLocked ? "Yes" : "No"}</b></div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 bg-slate-100 border border-slate-300 rounded-xl p-3 shadow-inner">
              <button
                className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold border-2 border-amber-700 shadow-[0_4px_0_0_#92400e] hover:bg-amber-400 hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_0_0_#92400e] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                onClick={handleOpenLobby}
                disabled={busy || loading || !canOpenLobby}
                title={
                  canOpenLobby
                    ? "Open the lobby so students can join"
                    : "Lobby cannot open because the battle already has a scheduled date"
                }
              >
                Open Lobby
              </button>

              <button
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold border-2 border-emerald-800 shadow-[0_4px_0_0_#166534] hover:bg-emerald-500 hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_0_0_#166534] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                onClick={handleStartCountdown}
                disabled={busy || loading || !canStartCountdown}
                title={canStartCountdown ? "Lock in the battle and begin countdown" : "Only available while status is LOBBY"}
              >
                Start Countdown
              </button>

              <button
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold border-2 border-red-800 shadow-[0_4px_0_0_#991b1b] hover:bg-red-500 hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_2px_0_0_#991b1b] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
                onClick={handleAbort}
                disabled={busy || loading || !canAbort}
                title={canAbort ? "Abort this battle" : "Abort is not available in the current state"}
              >
                Abort
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-white rounded-xl shadow-md p-4 text-red-600 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700 text-center">
            <p>Loading lobby...</p>
          </div>
        ) : participants.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-6 text-gray-700">
            No participants yet. Students haven’t joined yet.
            {currentStatus !== "LOBBY" ? " Open the lobby first so students can join." : ""}
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.keys.map((gid) => {
              const list = grouped.map.get(gid) || [];
              const guildName =
                gid === grouped.noGuildKey
                  ? "No Guild / Unknown"
                  : ((guildById.get(gid) as any)?.name || `Guild ${gid}`);

              const joined = list.filter(
                (p: any) => String(p.state || "").toUpperCase() === "JOINED"
              );
              const spectate = list.filter(
                (p: any) => String(p.state || "").toUpperCase() === "SPECTATE"
              );

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
                            return (
                              <div
                                key={p.student_id}
                                className="border rounded-lg p-3 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <div className="font-bold text-gray-900 truncate">{name}</div>
                                  <div className="text-xs text-gray-500 font-mono truncate">
                                    {p.student_id}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-500">
                                    State: <b>{p.state || "UNKNOWN"}</b>
                                  </div>
                                  {p.is_downed ? (
                                    <div className="mt-1 text-xs font-semibold text-red-600">
                                      DOWN
                                    </div>
                                  ) : null}
                                </div>

                                <button
                                  className="px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                                  onClick={() => handleKick(p.student_id)}
                                  disabled={busy || rosterLocked}
                                  title={rosterLocked ? "Roster is locked after countdown starts" : "Kick student from lobby"}
                                >
                                  Kick
                                </button>
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
                            return (
                              <div key={p.student_id} className="border rounded-lg p-3">
                                <div className="font-bold text-gray-900">{name}</div>
                                <div className="text-xs text-gray-500 font-mono truncate">
                                  {p.student_id}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  State: <b>{p.state || "SPECTATE"}</b>
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

        {!teacherCtx && (
          <div className="mt-6 bg-white rounded-xl shadow-md p-4 text-gray-700">
            Teacher context not loaded yet. If this persists, log out and log back in.
          </div>
        )}
      </main>
    </div>
  );
}