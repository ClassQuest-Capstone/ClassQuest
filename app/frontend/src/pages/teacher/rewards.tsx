import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.js";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

const rewards = () => {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setIsLoading] = useState(false); // Loading state
    const [teacher, setTeacher] = useState<TeacherUser | null>(null);
    const [rewardType, setRewardType] = useState("");
    const [price, setPrice] = useState("");
    const [rewardLevel, setRewardLevel] = useState("");

    useEffect(() => {
        feather.replace();
    })
    // Load teacher data from localStorage
      useEffect(() => {
        const currentUserJson = localStorage.getItem("cq_currentUser");
        if (currentUserJson) {
          try {
            const teacherData = JSON.parse(currentUserJson) as TeacherUser;
            setTeacher(teacherData);
          } catch (error) {
            console.error("Failed to parse teacher data from localStorage:", error);
          }
        }
      }, []);
    const handleCreateQuest = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        // TODO: Send reward data to API
        console.log({
            rewardType,
            price,
            rewardLevel
        });
        // Reset form
        setRewardType("");
        setPrice("");
        setRewardLevel("");
        setIsModalOpen(false);
    }
    

    return (
        <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen">
              <nav className="bg-blue-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between h-16">
                    <div className="flex items-center">
                      <div className="shrink-0 flex items-center">
                        {/* Logo and Nav Links */}
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
                     <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Dashboard</Link>
                      <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">Classes</Link>
                      <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
                      <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Activity</Link>
                      <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Guilds</Link>
                      <Link to="/profile" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Profile</Link>
                      <DropDownProfile
                                            username={teacher?.displayName || "user"}
                                            onLogout={() => {
                                              localStorage.removeItem("cq_currentUser");
                                              navigate("/TeacherLogin");
                                            }}
                                          />
                    </div>
                    <div className="-mr-2 flex items-center md:hidden">
                      <button className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600">
                        <i data-feather="menu"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </nav>
              {/* Back button */}
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                          <Link to="/classes" className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700">
                            <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
                            <span className="text-sm font-medium">Back</span>
                          </Link>
                        </div>
              {/** Intro and create item */}
              <main className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-yellow-300">Class Rewards</h1>
                        <p className="text-white">Add and manage items available for students to purchase</p>
                    </div>
                    <button
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2 rounded-lg flex items-center"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <i data-feather="plus" className="mr-2"></i> Create Items
                    </button>
                    </div>
                    {/** Categories*/}
                    <div className="mb-8">
                      <div className="grid grid-cols-1 gap-4 text-white">
                          
                          <div className="bg-gradient-to-r from-green-300 to-green-500 rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
                              <div className="flex items-center justify-center gap-6">
                                <div className="bg-green-50 text-green-700 rounded-full w-24 h-24 flex items-center justify-center">
                                  <i data-feather="gift" className="w-12 h-12"></i>
                              </div>
                              <div className="text-left">
                                <h3 className="text-2xl font-bold text-green-900">Rewards</h3>
                                <p className="text-green-800">Create exciting in class rewards fot your students</p>
                              </div>
                              </div>
                          </div>
                      </div>
                    </div>
                    {/** Rewards table */}
                    <div className="bg-white rounded-xl shadow-lg p-6 text-gray-900">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">All Shop Items</h2>
                {/*<div className="relative">
                    <input type="text" placeholder="Search items..." className="border border-gray-300 rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                    <i data-feather="search" className="absolute left-3 top-2.5 text-gray-400"></i>
                </div>*/}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200"></tbody>
                </table>
             </div>
             {/* Save changes button with warning */}
          {/*<div className="mt-6 flex flex-wrap gap-4 items-center">
            <button
              disabled={!unsavedChanges || saving}
              onClick={handleSaveChanges}
              className={`px-6 py-2 rounded-md text-white font-medium transition-colors ${
                unsavedChanges
                  ? "bg-green-600 hover:bg-green-700 cursor-pointer"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {unsavedChanges && (
              <span className="text-sm text-orange-600 font-medium">
                You have unsaved changes
              </span>
            )}
           </div>*/}
            </div>
          </main>
          {/* Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-white/300 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
              <div className="relative top-20 mx-auto p-5 border w-full max-w-xl shadow-lg rounded-md bg-white">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Reward </h2>
                
                <form onSubmit={handleCreateQuest} className="space-y-5">
                  {/* Reward Type Dropdown */}
                  <div>
                    <label htmlFor="rewardType" className="block text-sm font-medium text-gray-700 mb-2">
                      Reward Type
                    </label>
                    <select
                      id="rewardType"
                      value={rewardType}
                      onChange={(e) => setRewardType(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a reward type...</option>
                      <option value="Music Time">Music Time</option>
                      <option value="Phone Break">Phone Break (5mins)</option>
                      <option value="Seat Choice">Seat Choice</option>
                      <option value="Pick your partner">Pick your partner</option>
                      <option value="Snack Pass">Snack Pass</option>
                      <option value="Quick classroom game (10 min)">Quick classroom game (10 min)</option>
                    </select>
                  </div>

                  {/* Price Dropdown */}
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                      Price (Gold)
                    </label>
                    <select
                      id="price"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a price...</option>
                      <option value="100">100</option>
                      <option value="250">250</option>
                      <option value="500">500</option>
                      <option value="750">750</option>
                      <option value="1000">1000</option>
                      <option value="1500">1500</option>
                      <option value="2000">2000</option>
                    </select>
                  </div>

                  {/* Reward Level Dropdown */}
                  <div>
                    <label htmlFor="rewardLevel" className="block text-sm font-medium text-gray-700 mb-2">
                       Level
                    </label>
                    <select
                      id="rewardLevel"
                      value={rewardLevel}
                      onChange={(e) => setRewardLevel(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a level...</option>
                      <option value="5">Level 5</option>
                      <option value="10">Level 10</option>
                      <option value="15">Level 15</option>
                      <option value="20">Level 20</option>
                      <option value="25">Level 25</option>
                      <option value="30">Level 30</option>
                    </select>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:bg-gray-400"
                    >
                      {loading ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setRewardType("");
                        setPrice("");
                        setRewardLevel("");
                      }}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}        </div>
    );
}

export default rewards;