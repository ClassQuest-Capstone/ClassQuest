import React from "react";
import { QuestTemplate } from "../../../../api/questTemplates.js";
import { QuestInstance } from "../../../../api/questInstances.js";
import { ClassItem } from "../../../../api/classes.js";

interface EditQuestModalProps {
  isOpen: boolean;
  editing: QuestTemplate | null;
  editError: string | null;
  editSaving: boolean;
  eTitle: string;
  eSubject: string;
  eDescription: string;
  eType: string;
  eDifficulty: string;
  eGrade: number;
  eDuration: number;
  eXP: number;
  eGold: number;
  ePublic: boolean;
  questInstances: Map<string, QuestInstance[]>;
  classes: ClassItem[];
  inputBox: string;
  onTitleChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onDifficultyChange: (value: string) => void;
  onGradeChange: (value: number) => void;
  onDurationChange: (value: number) => void;
  onXPChange: (value: number) => void;
  onGoldChange: (value: number) => void;
  onPublicChange: (value: boolean) => void;
  onClose: () => void;
  onSave: () => void;
  onExtensionClick: (instance: QuestInstance) => void;
  onRemoveAssignment: (instance: QuestInstance) => void;
  getInstancesForTemplate: (templateId: string) => QuestInstance[];
  getClassNameById: (classId: string) => string;
}

export const EditQuestModal: React.FC<EditQuestModalProps> = ({
  isOpen,
  editing,
  editError,
  editSaving,
  eTitle,
  eSubject,
  eDescription,
  eType,
  eDifficulty,
  eGrade,
  eDuration,
  eXP,
  eGold,
  ePublic,
  inputBox,
  onTitleChange,
  onSubjectChange,
  onDescriptionChange,
  onTypeChange,
  onDifficultyChange,
  onGradeChange,
  onDurationChange,
  onXPChange,
  onGoldChange,
  onPublicChange,
  onClose,
  onSave,
  onExtensionClick,
  onRemoveAssignment,
  getInstancesForTemplate,
  getClassNameById,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center px-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl overflow-hidden">
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Template</h2>
          <button
            className="text-white/90 hover:text-white"
            onClick={onClose}
          >
            <i data-feather="x-circle"></i>
          </button>
        </div>

        <div className="p-6 space-y-4 text-black">
          {editError && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
              {editError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Title</label>
              <input className={inputBox} value={eTitle} onChange={(e) => onTitleChange(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Subject</label>
              <input className={inputBox} value={eSubject} onChange={(e) => onSubjectChange(e.target.value)} />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-700">Description</label>
              <textarea
                className={inputBox + " min-h-28"}
                value={eDescription}
                onChange={(e) => onDescriptionChange(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Type</label>
              <select className={inputBox} value={eType} onChange={(e) => onTypeChange(e.target.value)}>
                <option value="QUEST">QUEST</option>
                <option value="DAILY_QUEST">DAILY_QUEST</option>
                <option value="BOSS_FIGHT">BOSS_FIGHT</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Difficulty</label>
              <select className={inputBox} value={eDifficulty} onChange={(e) => onDifficultyChange(e.target.value)}>
                <option value="EASY">EASY</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HARD">HARD</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Grade</label>
              <input type="number" className={inputBox} value={eGrade} onChange={(e) => onGradeChange(Number(e.target.value))} />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Duration (min)</label>
              <input
                type="number"
                className={inputBox}
                value={eDuration}
                onChange={(e) => onDurationChange(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Base XP</label>
              <input type="number" className={inputBox} value={eXP} onChange={(e) => onXPChange(Number(e.target.value))} />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Base Gold</label>
              <input type="number" className={inputBox} value={eGold} onChange={(e) => onGoldChange(Number(e.target.value))} />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="public"
                type="checkbox"
                checked={ePublic}
                onChange={(e) => onPublicChange(e.target.checked)}
              />
              <label htmlFor="public" className="text-sm text-gray-700">
                Shared publicly
              </label>
            </div>
          </div>

          {editing && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Manage Assignments</h3>
              {(() => {
                const templateId = (editing as any).quest_template_id;
                const instances = getInstancesForTemplate(templateId);
                
                if (instances.length === 0) {
                  return (
                    <p className="text-sm text-gray-500 italic">No assignments yet. Use the "Assign" button to create one.</p>
                  );
                }

                return (
                  <div className="space-y-3">
                    {instances.map((instance) => (
                      <div key={instance.quest_instance_id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-gray-800">{getClassNameById(instance.class_id)}</p>
                            <p className="text-xs text-gray-500">ID: {instance.quest_instance_id}</p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${
                            instance.status === "ACTIVE" ? "bg-green-100 text-green-800"
                            : instance.status === "DRAFT" ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                          }`}>
                            {instance.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2 mb-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600">Start Date</label>
                            <p className="text-sm text-gray-700">{instance.start_date ? new Date(instance.start_date).toLocaleString() : "Not set"}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600">Due Date</label>
                            <p className="text-sm text-gray-700">{instance.due_date ? new Date(instance.due_date).toLocaleString() : "Not set"}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1 px-2 rounded flex items-center justify-center gap-1"
                            onClick={() => onExtensionClick(instance)}
                          >
                            <i data-feather="calendar" className="w-3 h-3"></i> Edit Due Date
                          </button>
                          <button
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1 px-2 rounded flex items-center justify-center gap-1"
                            onClick={() => onRemoveAssignment(instance)}
                          >
                            <i data-feather="trash-2" className="w-3 h-3"></i> Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200 mt-6">
            <button
              className="px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-black"
              onClick={onClose}
              disabled={editSaving}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
              onClick={onSave}
              disabled={editSaving}
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
