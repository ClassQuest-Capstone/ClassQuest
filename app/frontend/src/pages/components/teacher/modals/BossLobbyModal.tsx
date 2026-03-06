import React, { useState, useEffect, useCallback } from "react";
import feather from "feather-icons";
import type { BossBattleInstance } from "../../../../api/bossBattleInstances/types.ts";
import {
  listBossBattleParticipants,
  kickParticipant,
} from "../../../../api/bossBattleParticipants/client.ts";
import { updateBossBattleInstance } from "../../../../api/bossBattleInstances/client.ts";
import type { BossBattleParticipant } from "../../../../api/bossBattleParticipants/types.ts";

interface BossLobbyModalProps {
  isOpen: boolean;
  instance: BossBattleInstance;
  classId: string;
  onClose: () => void;
  onCountdownStarted?: () => void;
}

interface GroupedParticipants {
  [guildId: string]: {
    guildName?: string;
    joined: BossBattleParticipant[];
    spectating: BossBattleParticipant[];
  };
}

const BossLobbyModal: React.FC<BossLobbyModalProps> = ({
  isOpen,
  instance,
  classId,
  onClose,
  onCountdownStarted,
}) => {
  const [participants, setParticipants] = useState<BossBattleParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(5);
  const [isStarting, setIsStarting] = useState(false);
  const [isAborting, setIsAborting] = useState(false);

  const instanceId = String(
    (instance as any)?.boss_instance_id || (instance as any)?.id || ""
  );

  useEffect(() => {
    feather.replace();
  }, [isOpen, participants]);

  // Load participants periodically
  const loadParticipants = useCallback(async () => {
    if (!instanceId) return;

    try {
      const res = await listBossBattleParticipants(instanceId);
      const items = (res as any)?.items || [];
      setParticipants(items);
      setError(null);
    } catch (e: any) {
      console.error("Failed to load participants:", e);
      setError(e?.message || "Failed to load participants");
    }
  }, [instanceId]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Load participants on mount and set up polling
  useEffect(() => {
    if (!isOpen || !instanceId) return;

    setLoading(true);
    loadParticipants().finally(() => setLoading(false));

    // Poll every 2 seconds for real-time updates
    const pollInterval = setInterval(loadParticipants, 2000);
    return () => clearInterval(pollInterval);
  }, [isOpen, instanceId, loadParticipants]);

  // Group participants by guild
  const groupedParticipants: GroupedParticipants = {};
  participants.forEach((p) => {
    const guildId = p.guild_id || "unguilded";
    if (!groupedParticipants[guildId]) {
      groupedParticipants[guildId] = {
        guildName: guildId,
        joined: [],
        spectating: [],
      };
    }

    if (p.state === "SPECTATE") {
      groupedParticipants[guildId].spectating.push(p);
    } else if (p.state === "JOINED") {
      groupedParticipants[guildId].joined.push(p);
    }
  });

  const handleKickParticipant = async (studentId: string) => {
    if (!instanceId) return;

    const confirmed = window.confirm(
      "Are you sure you want to kick this student?"
    );
    if (!confirmed) return;

    try {
      await kickParticipant(instanceId, studentId, {
        reason: "Kicked by teacher",
      });
      await loadParticipants();
    } catch (e: any) {
      console.error("Failed to kick participant:", e);
      alert(e?.message || "Failed to kick participant");
    }
  };

  const handleStartCountdown = async () => {
    if (!instanceId || !countdownSeconds) return;

    setIsStarting(true);
    setError(null);

    try {
      const now = new Date();
      const countdownEndAt = new Date(now.getTime() + countdownSeconds * 1000);

      await updateBossBattleInstance(instanceId, {
        status: "COUNTDOWN",
        countdown_seconds: countdownSeconds,
        countdown_end_at: countdownEndAt.toISOString(),
      });

      onCountdownStarted?.();
      onClose();
    } catch (e: any) {
      console.error("Failed to start countdown:", e);
      setError(e?.message || "Failed to start countdown");
    } finally {
      setIsStarting(false);
    }
  };

  const handleAbortBattle = async () => {
    if (!instanceId) return;

    const confirmed = window.confirm(
      "Are you sure you want to abort this boss battle?"
    );
    if (!confirmed) return;

    setIsAborting(true);
    setError(null);

    try {
      await updateBossBattleInstance(instanceId, {
        status: "ABORTED",
      });

      onClose();
    } catch (e: any) {
      console.error("Failed to abort battle:", e);
      setError(e?.message || "Failed to abort battle");
    } finally {
      setIsAborting(false);
    }
  };

  if (!isOpen) return null;

  // Count participants
  const totalJoined = Object.values(groupedParticipants).reduce(
    (sum, g) => sum + g.joined.length,
    0
  );
  const totalSpectating = Object.values(groupedParticipants).reduce(
    (sum, g) => sum + g.spectating.length,
    0
  );

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Boss Battle Lobby</h2>
            <p className="text-indigo-100 text-sm mt-1">
              Joined: {totalJoined} | Spectating: {totalSpectating}
            </p>
          </div>
          <button
            className="text-white/90 hover:text-white"
            onClick={onClose}
          >
            <i data-feather="x-circle"></i>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && participants.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <p>Loading participants...</p>
            </div>
          )}

          {/* Participants by Guild */}
          {!loading && participants.length > 0 && (
            <div className="space-y-4">
              {Object.entries(groupedParticipants).map(
                ([guildId, guildData]) => (
                  <div key={guildId} className="border border-gray-300 rounded-lg">
                    <div className="bg-gray-100 px-4 py-3 border-b border-gray-300">
                      <h3 className="font-bold text-gray-800">
                        {guildData.guildName || "Unknown Guild"}
                      </h3>
                    </div>
                    <div className="p-4 space-y-2">
                      {/* Joined Students */}
                      {guildData.joined.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-green-700 uppercase mb-2">
                            JOINED ({guildData.joined.length})
                          </p>
                          <div className="space-y-2 ml-2">
                            {guildData.joined.map((participant) => (
                              <div
                                key={participant.student_id}
                                className="flex items-center justify-between bg-green-50 px-3 py-2 rounded border border-green-200"
                              >
                                <span className="text-gray-800 font-medium text-sm">
                                  Student ID: {participant.student_id}
                                </span>
                                <button
                                  onClick={() =>
                                    handleKickParticipant(participant.student_id)
                                  }
                                  className="text-red-600 hover:text-red-800 text-sm font-semibold flex items-center gap-1"
                                >
                                  <i data-feather="trash-2" className="w-4 h-4"></i>
                                  Kick
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Spectating Students */}
                      {guildData.spectating.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-blue-700 uppercase mb-2 mt-4">
                            SPECTATING ({guildData.spectating.length})
                          </p>
                          <div className="space-y-2 ml-2">
                            {guildData.spectating.map((participant) => (
                              <div
                                key={participant.student_id}
                                className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded border border-blue-200"
                              >
                                <span className="text-gray-800 font-medium text-sm">
                                  Student ID: {participant.student_id} (Spectator)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* No Participants */}
          {!loading && participants.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <p>No students have joined the lobby yet.</p>
            </div>
          )}

          {/* Countdown Duration Selection */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Countdown Duration (seconds){" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[3, 5, 10].map((seconds) => (
                <button
                  key={seconds}
                  onClick={() => setCountdownSeconds(seconds)}
                  className={`py-2 px-3 rounded-lg font-semibold transition text-sm ${
                    countdownSeconds === seconds
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-indigo-600 border border-indigo-300 hover:bg-indigo-50"
                  }`}
                >
                  {seconds}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer - Action Buttons */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
          <button
            onClick={handleAbortBattle}
            disabled={isAborting || isStarting}
            className="px-4 py-2 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <i data-feather="slash" className="w-5 h-5"></i>
            Abort Battle
          </button>
          <button
            onClick={handleStartCountdown}
            disabled={!countdownSeconds || isStarting || isAborting}
            className="px-4 py-2 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            <i data-feather="play-circle" className="w-5 h-5"></i>
            {isStarting ? "Starting..." : "Start Quest"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BossLobbyModal;
