import React from "react";
import type { BossBattleTemplate } from "../../../../api/bossBattleTemplates/types.js";
import type { BossBattleInstance } from "../../../../api/bossBattleInstances/types.js";

const inputBox =
  "w-full mt-1 border border-gray-300 rounded-lg px-3 py-2 text-black bg-white " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

// Hard-coded defaults for system constraints
const ANTI_SPAM_MIN_INTERVAL_MS = 1500;
const FREEZE_ON_WRONG_SECONDS = 3;

/**
 * Speed Bonus Multiplier Calculation:
 * if speed_bonus_enabled:
 *   if time_limit_seconds (T) is set:
 *     m = max(floor, 1 - elapsed/T)
 *   else:
 *     m = max(floor, 1 - elapsed/speed_window_seconds)
 * else:
 *   m = 1 (no bonus)
 *
 * where m is the final damage multiplier applied to correct answers
 */

interface BossAssignModalProps {
  isOpen: boolean;
  bossAssigning: BossBattleTemplate | null;
  bossAssignError: string | null;
  bossAssignLoading: boolean;
  bossAssignClassId: string;
  bossAssignStartDate: string;
  bossAssignDueDate: string;
  bossAssignManualApproval: boolean;
  bossAssignTitleOverride: string;
  bossAssignDescriptionOverride: string;
  // Battle mechanics
  bossAssignModeType: string;
  bossAssignQuestionSelectionMode: string;
  bossAssignLateJoinPolicy: string;
  bossAssignPassingScorePercent: number;
  bossAssignCountdownSeconds: number;
  bossAssignQuestionTimeLimit: number | "";
  bossAssignSpeedBonusEnabled: boolean;
  bossAssignSpeedBonusFloor: number;
  bossAssignSpeedWindow: number;
  classes: any[];
  onClassIdChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onManualApprovalChange: (value: boolean) => void;
  onTitleOverrideChange: (value: string) => void;
  onDescriptionOverrideChange: (value: string) => void;
  // Battle mechanics handlers
  onModeTypeChange: (value: string) => void;
  onQuestionSelectionModeChange: (value: string) => void;
  onLateJoinPolicyChange: (value: string) => void;
  onPassingScorePercentChange: (value: number) => void;
  onCountdownSecondsChange: (value: number) => void;
  onQuestionTimeLimitChange: (value: number | "") => void;
  onSpeedBonusEnabledChange: (value: boolean) => void;
  onSpeedBonusFloorChange: (value: number) => void;
  onSpeedWindowChange: (value: number) => void;
  onClose: () => void;
  onAssign: () => void;
}

export const BossAssignModal: React.FC<BossAssignModalProps> = ({
  isOpen,
  bossAssigning,
  bossAssignError,
  bossAssignLoading,
  bossAssignClassId,
  //bossAssignStartDate,
  //bossAssignDueDate,
  bossAssignManualApproval,
  bossAssignTitleOverride,
  bossAssignDescriptionOverride,
  bossAssignModeType,
  bossAssignQuestionSelectionMode,
  bossAssignLateJoinPolicy,
  bossAssignPassingScorePercent,
  bossAssignCountdownSeconds,
  bossAssignQuestionTimeLimit,
  bossAssignSpeedBonusEnabled,
  bossAssignSpeedBonusFloor,
  bossAssignSpeedWindow,
  classes,
  onClassIdChange,
  onStartDateChange,
  onDueDateChange,
  onManualApprovalChange,
  onTitleOverrideChange,
  onDescriptionOverrideChange,
  onModeTypeChange,
  onQuestionSelectionModeChange,
  onLateJoinPolicyChange,
  onPassingScorePercentChange,
  onCountdownSecondsChange,
  onQuestionTimeLimitChange,
  onSpeedBonusEnabledChange,
  onSpeedBonusFloorChange,
  onSpeedWindowChange,
  onClose,
  onAssign,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900 p-4">
      <div className="relative mx-auto w-full max-w-2xl shadow-lg rounded-lg bg-white overflow-hidden">
       <div className="bg-purple-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Assign Bossbattle to Class</h2>
          <button
            className="text-white/90 hover:text-white"
            onClick={onClose}
            disabled={bossAssignLoading}
          >
            <i data-feather="x-circle"></i>
          </button>
        </div>

        <div className="space-y-4 p-6 max-h-[calc(200vh-300px)] overflow-y-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="font-semibold">Template title: {String((bossAssigning as any)?.title ?? "")}</div>
            <p className="text-md text-blue-700"> Subject: {String((bossAssigning as any)?.subject ?? "")}</p>
          </div>

          {bossAssignError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">{bossAssignError}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class <span className="text-red-500">*</span></label>
            <select className={inputBox} value={bossAssignClassId} onChange={(e) => onClassIdChange(e.target.value)}>
              <option value="">Select a class</option>
              {classes
                  .filter((cls) => (cls as any).is_active !== false)
                  .map((cls) => (
                    <option key={(cls as any).class_id} value={(cls as any).class_id}>
                      {(cls as any).name} (Grade {(cls as any).grade_level})
                    </option>
                  ))}
            </select>
          </div>

          {/*<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="datetime-local" className={inputBox} value={bossAssignStartDate} onChange={(e) => onStartDateChange(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="datetime-local" className={inputBox} value={bossAssignDueDate} onChange={(e) => onDueDateChange(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={bossAssignManualApproval} onChange={(e) => onManualApprovalChange(e.target.checked)} />
              Requires manual approval
            </label>
          </div>*/}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title Override</label>
            <input className={inputBox} value={bossAssignTitleOverride} onChange={(e) => onTitleOverrideChange(e.target.value)} placeholder="Optional" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description Override</label>
            <textarea
              className={inputBox}
              value={bossAssignDescriptionOverride}
              onChange={(e) => onDescriptionOverrideChange(e.target.value)}
              rows={3}
              placeholder="Optional"
            />
          </div>

          <hr className="my-6" />
          <h3 className="text-md font-semibold text-gray-800 mb-4">Battle Configuration</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Boss battle mode <span className="text-red-500">*</span></label>
              <select className={inputBox} value={bossAssignModeType} onChange={(e) => onModeTypeChange(e.target.value)}>
                <option value="">Select mode</option>
                <option value="SIMULTANEOUS_ALL">All Questions sent to Guilds</option>
                <option value="TURN_BASED_GUILD">Guild Rotation (Turn Based)</option>
                {/*<option value="RANDOMIZED_PER_GUILD">Random Guild Challenge</option> */}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Distribution Mode <span className="text-red-500">*</span></label>
              <select className={inputBox} value={bossAssignQuestionSelectionMode} onChange={(e) => onQuestionSelectionModeChange(e.target.value)}>
                <option value="">Select mode</option>
                <option value="ORDERED">Sequential Order</option>
                <option value="RANDOM_NO_REPEAT">Shuffle Mode</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Late Join Policy</label>
              <select className={inputBox} value={bossAssignLateJoinPolicy} onChange={(e) => onLateJoinPolicyChange(e.target.value)}>
                <option value="">Select policy</option>
                <option value="DISALLOW_AFTER_COUNTDOWN">Disallow After Countdown</option>
                <option value="ALLOW_SPECTATE">Allow Spectate</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Win Threshold <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={bossAssignPassingScorePercent}
                  onChange={(e) => onPassingScorePercentChange(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-14 text-right font-bold text-purple-700 text-sm">
                  {bossAssignPassingScorePercent}%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Class must deal at least {bossAssignPassingScorePercent}% of boss HP to WIN and earn full rewards. Below this threshold they earn 50%.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/*<div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Countdown Duration (seconds) <span className="text-red-500">*</span></label>
              <select className={inputBox} value={bossAssignCountdownSeconds} onChange={(e) => onCountdownSecondsChange(Number(e.target.value))}>
                <option value="0">Select duration</option>
                <option value="3">3 seconds</option>
                <option value="5">5 seconds</option>
                <option value="10">10 seconds</option>
              </select>
            </div>*/}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Question Time Limit (Seconds)</label>
              <select className={inputBox} value={bossAssignQuestionTimeLimit} onChange={(e) => onQuestionTimeLimitChange(e.target.value === "" ? "" : Number(e.target.value))}>
                <option value="">Select Limit</option>
                <option value="15">15 Seconds</option>
                <option value="30">30 Seconds</option>
                <option value="60">1 Minute</option>
              </select>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={bossAssignSpeedBonusEnabled} onChange={(e) => onSpeedBonusEnabledChange(e.target.checked)} />
              Enable Speed Bonus
            </label>
            {bossAssignSpeedBonusEnabled && (
              <div className="mt-3 space-y-3 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="text-xs text-blue-700 bg-white p-2 rounded border border-blue-100">
                  <p className="font-semibold mb-1">Speed Bonus Formula:</p>
                  <p className="font-mono text-xs leading-relaxed">
                    m = max(floor, 1 - elapsed/{bossAssignQuestionTimeLimit || 'speed_window'})
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Speed Bonus Floor (%)</label>
                    <input 
                      type="number" 
                      className={inputBox} 
                      min="0" 
                      max="100" 
                      step="0.1"
                      value={bossAssignSpeedBonusFloor} 
                      onChange={(e) => onSpeedBonusFloorChange(Number(e.target.value))} 
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum multiplier (e.g., 0.2 = 20% minimum damage)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Speed Window (seconds)</label>
                    <input 
                      type="number" 
                      className={inputBox} 
                      min="5"
                      value={bossAssignSpeedWindow} 
                      onChange={(e) => onSpeedWindowChange(Number(e.target.value))} 
                    />
                    <p className="text-xs text-gray-500 mt-1">Window for bonus if no time limit set</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded border border-gray-200">
            <p><strong>System Defaults:</strong></p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Anti-Spam Interval: 1.5s</li>
              <li>Freeze on Wrong Question: {FREEZE_ON_WRONG_SECONDS}s</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-500"
              disabled={bossAssignLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAssign}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
              disabled={bossAssignLoading}
            >
              {bossAssignLoading ? "Assigning…" : "Assign"}
            </button>
          </div>
        </div>
        </div>
  );
};

interface BossExtendModalProps {
  isOpen: boolean;
  bossSelectedForExtension: BossBattleInstance | null;
  bossExtensionDueDate: string;
  bossExtensionError: string | null;
  bossExtensionSaving: boolean;
  getClassNameById: (classId: string) => string;
  onDueDateChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

function getClassIdFromBossInstance(i: BossBattleInstance): string {
  return String((i as any)?.class_id ?? (i as any)?.classId ?? "");
}

export const BossExtendModal: React.FC<BossExtendModalProps> = ({
  isOpen,
  bossSelectedForExtension,
  bossExtensionDueDate,
  bossExtensionError,
  bossExtensionSaving,
  getClassNameById,
  onDueDateChange,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900 p-4">
      <div className="relative my-8 mx-auto w-full max-w-xl shadow-lg rounded-lg bg-white overflow-hidden">
        <div className="bg-purple-700 text-white px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Extend Boss Battle Due Date</h3>
          <button
            onClick={onClose}
            className="text-white/90 hover:text-white"
          >
            <i data-feather="x-circle"></i>
          </button>
        </div>

        <div className="p-6 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
          {bossExtensionError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
              {bossExtensionError}
            </div>
          )}

          <div className="text-sm text-gray-700">
            <div className="font-semibold">Class:</div>
            <div>{getClassNameById(getClassIdFromBossInstance(bossSelectedForExtension || ({} as any)))}</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Due Date</label>
            <input
              type="datetime-local"
              className={inputBox}
              value={bossExtensionDueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-500"
              disabled={bossExtensionSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
              disabled={bossExtensionSaving}
            >
              {bossExtensionSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
  );
};
