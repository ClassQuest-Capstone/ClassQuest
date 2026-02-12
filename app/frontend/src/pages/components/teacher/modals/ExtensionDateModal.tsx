import React from "react";
import { QuestInstance } from "../../../../api/questInstances.js";

interface ExtensionDateModalProps {
  isOpen: boolean;
  selectedInstance: QuestInstance | null;
  extensionDueDate: string;
  extensionError: string | null;
  extensionSaving: boolean;
  inputBox: string;
  onDueDateChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  getClassNameById: (classId: string) => string;
}

export const ExtensionDateModal: React.FC<ExtensionDateModalProps> = ({
  isOpen,
  selectedInstance,
  extensionDueDate,
  extensionError,
  extensionSaving,
  inputBox,
  onDueDateChange,
  onClose,
  onSave,
  getClassNameById,
}) => {
  if (!isOpen || !selectedInstance) return null;

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden mt-20">
        <div className="bg-purple-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Extend Due Date</h2>
          <button
            className="text-white/90 hover:text-white"
            onClick={onClose}
            disabled={extensionSaving}
          >
            <i data-feather="x-circle"></i>
          </button>
        </div>

        <div className="p-6 space-y-4 text-black">
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Class:</strong> {getClassNameById(selectedInstance.class_id)}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Current Due: {selectedInstance.due_date ? new Date(selectedInstance.due_date).toLocaleString() : "Not set"}
            </p>
          </div>

          {extensionError && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
              {extensionError}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">New Due Date & Time</label>
            <input
              type="datetime-local"
              className={inputBox}
              value={extensionDueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              disabled={extensionSaving}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              className="px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-black"
              onClick={onClose}
              disabled={extensionSaving}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-60"
              onClick={onSave}
              disabled={extensionSaving}
            >
              {extensionSaving ? "Updating..." : "Update Due Date"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
