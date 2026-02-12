import React from "react";
import { QuestQuestion } from "../../../../api/questQuestions.js";

interface QuestionsListModalProps {
  isOpen: boolean;
  questionsList: QuestQuestion[];
  inputBox: string;
  onClose: () => void;
  onEditClick: (question: QuestQuestion) => void;
  onDeleteClick: (question: QuestQuestion) => void;
}

export const QuestionsListModal: React.FC<QuestionsListModalProps> = ({
  isOpen,
  questionsList,
  inputBox,
  onClose,
  onEditClick,
  onDeleteClick,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center px-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl overflow-hidden mt-10 mb-10">
        <div className="bg-indigo-700 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Quest Questions</h2>
          <button
            className="text-white/90 hover:text-white"
            onClick={onClose}
          >
            <i data-feather="x-circle"></i>
          </button>
        </div>

        <div className="p-6 space-y-4 text-black">
          {questionsList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No questions added yet.</p>
              <p className="text-xs text-gray-400 mt-2">Add questions by clicking the Questions button on the quest card.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questionsList.map((q: QuestQuestion, idx: number) => (
                <div key={q.question_id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">Question {idx + 1}</p>
                      <p className="text-xs text-gray-500">Format: {q.question_format} | Points: {q.max_points}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      q.difficulty === "EASY" ? "bg-green-100 text-green-800"
                      : q.difficulty === "MEDIUM" ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                    }`}>
                      {q.difficulty || "—"}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm mb-2">{q.prompt}</p>
                  {q.hint && (
                    <p className="text-xs text-gray-600 italic">💡 Hint: {q.hint}</p>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-gray-600 mt-2">📝 Explanation: {q.explanation}</p>
                  )}
                  
                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-300">
                    <button
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-xs flex items-center justify-center gap-1"
                      onClick={() => onEditClick(q)}
                    >
                      <i data-feather="edit" className="w-3 h-3"></i> Edit
                    </button>
                    <button
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-xs flex items-center justify-center gap-1"
                      onClick={() => onDeleteClick(q)}
                    >
                      <i data-feather="trash-2" className="w-3 h-3"></i> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              className="px-4 py-2 rounded-lg bg-indigo-700 text-white hover:bg-indigo-800"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
