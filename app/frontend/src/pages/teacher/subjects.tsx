import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile";


type QuestCard = {
  title: string;
  subject: string;
  difficulty: string;
  description: string;
  type: string;
  grade: string;
  gradient: string;
  icon: string;
  reward: string;
};

const QUESTS: QuestCard[] = [
  {
    title: "Algebra Questline",
    subject: "Mathematics",
    difficulty: "Medium",
    description: "Solve fractions and unlock the Portal of Numbers.",
    type: "Quest",
    grade: "5th grade",
    gradient: "from-blue-500 to-indigo-600",
    icon: "activity",
    reward: "+150 XP / 150 Gold",
  },
  {
    title: "Motion & friction",
    subject: "Science",
    difficulty: "Easy",
    description: "Force and Motion.",
    type: "Quest",
    grade: "5th grade",
    gradient: "from-green-500 to-emerald-600",
    icon: "zap",
    reward: "+150 XP / Consumable",
  },
  {
    title: "The Dominion of Canada",
    subject: "Social studies",
    difficulty: "Hard",
    description: " A Journey Through Land, People, and Power.",
    type: "Quest",
    grade: "5th grade",
    gradient: "from-amber-500 to-orange-600",
    icon: "clock",
    reward: "+400 XP / Title",
  },
];

const Subjects = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    feather.replace();
  }, []);

  useEffect(() => {
    feather.replace();
  }, [isModalOpen]);

const handleCreateQuest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
  
  const questData = {
    name: formData.get("questName"),
    type: formData.get("type"),
    subject: formData.get("subject"),
    grade: formData.get("grade"),
    description: formData.get("description"),
    difficulty: formData.get("difficulty"),
    reward: formData.get("reward"),
  };
    // Todo: Connect to backend workflow for quest creation.
    setIsModalOpen(false);
    navigate("/quests", { state: { questData } });
    setIsModalOpen(false);
  };


  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen">
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
              <Link
                to="/teacherDashboard"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Dashboard
              </Link>
              <Link
                to="/Subjects"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Quests
              </Link>
              <Link
                to="/"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Activity
              </Link>
             <DropDownProfile username="user"onLogout={() => {console.log("Logging out"); /**TODO: Logout logic */}}/>
            </div>
            <div className="-mr-2 flex items-center md:hidden">
              <button className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600">
                <i data-feather="menu"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-indigo-800">Quest Management</h1>
            <p className="text-white">Create, Launch, schedule, and monitor classroom quests</p>
          </div>
          <button
            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2 rounded-lg flex items-center"
            onClick={() => setIsModalOpen(true)}
          >
            <i data-feather="plus" className="mr-2"></i> Create Quest
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {QUESTS.map((quest) => (
            <div
              key={quest.title}
              className="bg-white rounded-xl shadow-md overflow-hidden transition duration-300"
            >
              <div
                className={`bg-linear-to-r ${quest.gradient} p-6 text-white text-center`}
              >
                <div className="mx-auto w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4">
                  <i data-feather={quest.icon} className="w-10 h-10 text-gray-800"></i>
                </div>
                <h3 className="text-xl font-bold">{quest.title}</h3>
                <p className="text-white/80">{quest.subject}</p>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-sm text-gray-500 uppercase tracking-wide">{quest.difficulty}</p>
                <p className="text-gray-700 text-sm">{quest.description}</p>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{quest.type}</span>
                  <span className="font-semibold text-gray-900">{quest.reward}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="bg-green-600 hover:bg-green-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center">
                    <i data-feather="play" className="mr-1 w-4 h-4"></i> Launch
                  </button>
                  <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center">
                    <i data-feather="clock" className="mr-1 w-4 h-4"></i> Schedule
                  </button>
                  <button className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white px-2 py-2 rounded-lg text-sm flex items-center justify-center">
                    <i data-feather="edit" className="mr-1 w-4 h-4"></i> Edit Quest
                  </button>
                  <button className="col-span-2 bg-gray-100 hover:bg-gray-200 text-red-600 border border-red-600 px-2 py-2 rounded-lg text-sm flex items-center justify-center">
                    <i data-feather="trash-2" className="mr-1 w-4 h-4"></i> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {isModalOpen && (
        
        <div className="fixed inset-0 bg-white/300 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create New Quest</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-blue-500 hover:text-blue-700"
              >
                <i data-feather="x"></i>
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateQuest}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quest Name
                </label>
                <input
                  type="text"
                  name="questName"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="e.g. Polynomial peaks"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select name="type" className="w-full border border-gray-300 rounded-lg px-4 py-2" required>
                  <option>Quest</option>
                  <option>Boss Fight</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select name="subject" className="w-full border border-gray-300 rounded-lg px-4 py-2" required>
                  <option>Mathematics</option>
                  <option>Science</option>
                  <option>Social Studies</option>
                  <option>Health Education</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <select name="grade" className="w-full border border-gray-300 rounded-lg px-4 py-2" required>
                  <option>Grade 5</option>
                  <option>Grade 6</option>
                  <option>Grade 7</option>
                  <option>Grade 8</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  rows={3}
                  placeholder="Brief overview for your students"
                  required
                ></textarea>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select name="difficulty" className="w-full border border-gray-300 rounded-lg px-4 py-2" required>
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reward</label>
                  <input
                    type="text"
                    name="reward"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    placeholder="+150 XP / 50 Gold"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
      )}
    </div>
  );
};

export default Subjects;

