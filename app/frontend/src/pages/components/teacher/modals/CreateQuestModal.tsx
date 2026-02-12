import React from "react";

interface CreateQuestModalProps {
  isOpen: boolean;
  inputBox: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export const CreateQuestModal: React.FC<CreateQuestModalProps> = ({
  isOpen,
  inputBox,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden">
        <div className="bg-linear-to-r from-blue-500 to-indigo-600 text-white px-6 py-4">
          <h2 className="text-xl font-bold">Create New Quest Template</h2>
        </div>

        <div className="p-6 text-black">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Quest Name</label>
              <input type="text" name="questName" className={inputBox} required />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Subject</label>
              <input type="text" name="subject" className={inputBox} required />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Description</label>
              <textarea name="description" className={inputBox} rows={3} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700">Type</label>
                <select name="type" className={inputBox} required>
                  <option value="QUEST">QUEST</option>
                  <option value="DAILY_QUEST">DAILY_QUEST</option>
                  <option value="BOSS_FIGHT">BOSS_FIGHT</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Difficulty</label>
                <select name="difficulty" className={inputBox} required>
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700">Grade</label>
                <input type="number" name="grade" className={inputBox} required />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700">Base XP</label>
                <input type="number" name="base_xp_reward" className={inputBox} defaultValue="0" />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Base Gold</label>
              <input type="number" name="base_gold_reward" className={inputBox} defaultValue="0" />
            </div>

            <div className="flex items-center justify-between pt-4 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:border-gray-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
              >
                Create Quest
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
