import React from "react";
import { QuestTemplate } from "../../../../api/questTemplates.js";
import { ClassItem } from "../../../../api/classes.js";

interface AssignQuestModalProps {
  isOpen: boolean;
  assigningTemplate: QuestTemplate | null;
  assignError: string | null;
  assignLoading: boolean;
  assignClassId: string;
  assignStartDate: string;
  assignDueDate: string;
  assignManualApproval: boolean;
  assignTitleOverride: string;
  assignDescriptionOverride: string;
  classes: ClassItem[];
  inputBox: string;
  onClassChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onManualApprovalChange: (value: boolean) => void;
  onTitleOverrideChange: (value: string) => void;
  onDescriptionOverrideChange: (value: string) => void;
  onClose: () => void;
  onAssign: () => void;
  safeStr: (val: unknown) => string;
}

export const AssignQuestModal: React.FC<AssignQuestModalProps> = ({
  isOpen,
  assigningTemplate,
  assignError,
  assignLoading,
  assignClassId,
  assignStartDate,
  assignDueDate,
  assignManualApproval,
  assignTitleOverride,
  assignDescriptionOverride,
  classes,
  inputBox,
  onClassChange,
  onStartDateChange,
  onDueDateChange,
  onManualApprovalChange,
  onTitleOverrideChange,
  onDescriptionOverrideChange,
  onClose,
  onAssign,
  safeStr,
}) => {
  if (!isOpen || !assigningTemplate) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center px-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl overflow-hidden">
        <div className="bg-green-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Assign Quest to Class</h2>
          <button
            className="text-white/90 hover:text-white"
            onClick={onClose}
            disabled={assignLoading}
          >
            <i data-feather="x-circle"></i>
          </button>
        </div>

        <div className="p-6 space-y-4 text-black">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm font-semibold text-blue-700">Quest Template</p>
            <p className="text-lg font-bold text-blue-900">{safeStr((assigningTemplate as any).title)}</p>
            <p className="text-sm text-blue-700">{safeStr((assigningTemplate as any).subject)}</p>
          </div>

          {assignError && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
              {assignError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Select Class <span className="text-red-500">*</span>
              </label>
              <select
                className={inputBox}
                value={assignClassId}
                onChange={(e) => onClassChange(e.target.value)}
                required
                disabled={assignLoading}
              >
                <option value="">Choose a class...</option>
                {classes
                  .filter((cls) => (cls as any).is_active !== false)
                  .map((cls) => (
                    <option key={(cls as any).class_id} value={(cls as any).class_id}>
                      {(cls as any).name} (Grade {(cls as any).grade_level})
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                <input
                  type="datetime-local"
                  className={inputBox}
                  value={assignStartDate}
                  onChange={(e) => onStartDateChange(e.target.value)}
                  disabled={assignLoading}
                />
                <p className="text-xs text-gray-500 mt-1">Optional - when quest becomes available</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  className={inputBox}
                  value={assignDueDate}
                  onChange={(e) => onDueDateChange(e.target.value)}
                  disabled={assignLoading}
                />
                <p className="text-xs text-gray-500 mt-1">Optional - when quest expires</p>
              </div>
            </div>

            <p className="text-sm text-red-500">
              Assigning this quest to a class will make it live for students in that class.
            </p>

            <div className="flex items-center gap-2">
              <input
                id="manualApproval"
                type="checkbox"
                checked={assignManualApproval}
                onChange={(e) => onManualApprovalChange(e.target.checked)}
                disabled={assignLoading}
                className="h-4 w-4"
              />
              <label htmlFor="manualApproval" className="text-sm text-gray-700">
                Requires manual approval (teacher must review submissions)
              </label>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Override Fields (Optional)</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Title</label>
                  <input
                    type="text"
                    className={inputBox}
                    value={assignTitleOverride}
                    onChange={(e) => onTitleOverrideChange(e.target.value)}
                    placeholder="Leave empty to use template title"
                    disabled={assignLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Description</label>
                  <textarea
                    className={inputBox + " min-h-20"}
                    value={assignDescriptionOverride}
                    onChange={(e) => onDescriptionOverrideChange(e.target.value)}
                    placeholder="Leave empty to use template description"
                    disabled={assignLoading}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <button
              className="px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-black"
              onClick={onClose}
              disabled={assignLoading}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-60"
              onClick={onAssign}
              disabled={assignLoading || !assignClassId}
            >
              {assignLoading ? "Assigning..." : "Assign to Class"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
