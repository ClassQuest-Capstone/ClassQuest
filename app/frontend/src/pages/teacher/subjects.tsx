import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import feather from "feather-icons";

type QuestCard = {
  title: string;
  subject: string;
  difficulty: string;
  description: string;
  grade: string;
  gradient: string;
  icon: string;
  reward: string;
};

const QUESTS: QuestCard[] = [
  {
    title: "Algebra Questline",
    subject: "Mathematics",
    difficulty: "Intermediate",
    description: "Solve linear equations and unlock the Portal of Numbers.",
    grade: "5th grade",
    gradient: "from-blue-500 to-indigo-600",
    icon: "activity",
    reward: "+250 XP / 150 Gold",
  },
  {
    title: "Motion & friction",
    subject: "Science",
    difficulty: "Beginner",
    description: "Force and Motion.",
    grade: "5th grade",
    gradient: "from-green-500 to-emerald-600",
    icon: "zap",
    reward: "+150 XP / Consumable",
  },
  {
    title: "The Dominion of Canada",
    subject: "Social studies",
    difficulty: "Advanced",
    description: " A Journey Through Land, People, and Power.",
    grade: "5th grade",
    gradient: "from-amber-500 to-orange-600",
    icon: "clock",
    reward: "+400 XP / Title",
  },
];

const Subjects = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    feather.replace();
  }, []);

  useEffect(() => {
    feather.replace();
  }, [isModalOpen]);

  const handleCreateQuest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Todo: Connect to backend workflow for quest creation.
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
              <a href="#" className="shrink-0 group block">
                <img
                  className="inline-block h-9 w-9 rounded-full ring-3 ring-purple-500 hover:ring-purple-700"
                  src="/assets/warrior-head.png"
                  alt="Profile"
                />
              </a>
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
            <p className="text-white">Launch, schedule, and monitor classroom quests</p>
          </div>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center"
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
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Create New Quest</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-500"
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
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="e.g. Fraction Frontier"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <select className="w-full border border-gray-300 rounded-lg px-4 py-2" required>
                  {["Mathematics", "Science", "Social Studies", "Health Education"].map((subj) => (
                    <option key={subj}>{subj}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade
                </label>
                <select className="w-full border border-gray-300 rounded-lg px-4 py-2" required>
                  {["Grade 5", "Grade 6", "Grade 7", "Grade 8"].map((grade) => (
                    <option key={grade}>{grade}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  rows={3}
                  placeholder="Brief overview for your students"
                  required
                ></textarea>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty
                  </label>
                  <select className="w-full border border-gray-300 rounded-lg px-4 py-2" required>
                    {["Beginner", "Intermediate", "Advanced"].map((level) => (
                      <option key={level}>{level}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reward
                  </label>
                  <input
                    type="text"
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
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                >
                  Start Quest
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

