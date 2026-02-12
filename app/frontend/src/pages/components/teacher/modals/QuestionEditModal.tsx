import React from "react";
import { QuestQuestion } from "../../../../api/questQuestions.js";

interface QuestionEditState {
  prompt: string;
  format: string;
  hint: string;
  explanation: string;
  maxPoints: number;
  difficulty: string;
  timeLimitSeconds: number;
  optionsJson: string;
  correctAnswerJson: string;
  autoGradable: boolean;
}

interface QuestionEditModalProps {
  isOpen: boolean;
  editingQuestion: QuestQuestion | null;
  editFormState: QuestionEditState;
  questionEditLoading: boolean;
  questionEditError: string | null;
  inputBox: string;
  onFormFieldChange: <K extends keyof QuestionEditState>(key: K, value: QuestionEditState[K]) => void;
  onClose: () => void;
  onSave: () => void;
}

export const QuestionEditModal: React.FC<QuestionEditModalProps> = ({
  isOpen,
  editingQuestion,
  editFormState,
  questionEditLoading,
  questionEditError,
  inputBox,
  onFormFieldChange,
  onClose,
  onSave,
}) => {
  if (!isOpen || !editingQuestion) return null;

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center px-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-xl overflow-hidden mt-10 mb-10">
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Question</h2>
          <button
            className="text-white/90 hover:text-white"
            onClick={onClose}
            disabled={questionEditLoading}
          >
            <i data-feather="x-circle"></i>
          </button>
        </div>

        <div className="p-6 space-y-4 text-black">
          {questionEditError && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
              {questionEditError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Question Prompt</label>
              <textarea
                className={inputBox}
                value={editFormState.prompt}
                onChange={(e) => onFormFieldChange("prompt", e.target.value)}
                disabled={questionEditLoading}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Question Type</label>
                <select 
                  className={inputBox} 
                  value={editFormState.format} 
                  onChange={(e) => onFormFieldChange("format", e.target.value)}
                  disabled={questionEditLoading}
                >
                  <option value="MCQ_SINGLE">MCQ (Single)</option>
                  <option value="TRUE_FALSE">True/False</option>
                  <option value="SHORT_ANSWER">Short Answer</option>
                  <option value="ESSAY">Essay</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Difficulty</label>
                <select 
                  className={inputBox} 
                  value={editFormState.difficulty}
                  onChange={(e) => onFormFieldChange("difficulty", e.target.value)}
                  disabled={questionEditLoading}
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Max Points</label>
                <input 
                  type="number" 
                  className={inputBox} 
                  value={editFormState.maxPoints}
                  onChange={(e) => onFormFieldChange("maxPoints", Number(e.target.value))}
                  disabled={questionEditLoading}
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Hint (Optional)</label>
              <input 
                type="text" 
                className={inputBox} 
                value={editFormState.hint}
                onChange={(e) => onFormFieldChange("hint", e.target.value)}
                disabled={questionEditLoading}
                placeholder="Hint for students"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Explanation (Optional)</label>
              <textarea 
                className={inputBox}
                value={editFormState.explanation}
                onChange={(e) => onFormFieldChange("explanation", e.target.value)}
                disabled={questionEditLoading}
                rows={3}
                placeholder="Explanation shown after answer"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Time Limit (seconds, optional)</label>
              <input 
                type="number" 
                className={inputBox} 
                value={editFormState.timeLimitSeconds}
                onChange={(e) => onFormFieldChange("timeLimitSeconds", Number(e.target.value))}
                disabled={questionEditLoading}
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Answer Options (JSON, Optional)</label>
              <textarea 
                className={inputBox}
                value={editFormState.optionsJson}
                onChange={(e) => onFormFieldChange("optionsJson", e.target.value)}
                disabled={questionEditLoading}
                rows={3}
                placeholder={`Example for MCQ:\n["Option A", "Option B", "Option C"]\n\nFor True/False:\n["True", "False"]`}
              />
              <p className="text-xs text-gray-500 mt-1">Enter options as a JSON array. Format depends on question type.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Correct Answer (JSON, Optional)</label>
              <textarea 
                className={inputBox}
                value={editFormState.correctAnswerJson}
                onChange={(e) => onFormFieldChange("correctAnswerJson", e.target.value)}
                disabled={questionEditLoading}
                rows={3}
                placeholder={`Example for MCQ (index): 0\nFor multiple answers: [0, 2]\nFor short answer: "correct text"\nFor numeric: 42`}
              />
              <p className="text-xs text-gray-500 mt-1">The correct answer - can be index, string, number, or array depending on format.</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="autoGradable"
                type="checkbox"
                checked={editFormState.autoGradable}
                onChange={(e) => onFormFieldChange("autoGradable", e.target.checked)}
                disabled={questionEditLoading}
                className="h-4 w-4"
              />
              <label htmlFor="autoGradable" className="text-sm text-gray-700">
                Auto-gradable (can be automatically graded)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              className="px-4 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-black"
              onClick={onClose}
              disabled={questionEditLoading}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60"
              onClick={onSave}
              disabled={questionEditLoading}
            >
              {questionEditLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
