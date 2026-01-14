import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile";

const rewards = () => {
    const navigate = useNavigate();
     const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        feather.replace();
    })
    const handleCreateQuest = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
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
                          <span className="text-xl font-bold">classQuest</span>
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
              {/* Back button */}
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                          <Link to="/teacherDashboard" className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700">
                            <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
                            <span className="text-sm font-medium">Back</span>
                          </Link>
                        </div>
              {/** Intro and create item */}
              <main className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-indigo-600">Shop & Reward</h1>
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white">
                          <div className="bg-gradient-to-r from-pink-300 to-pink-500 rounded-lg shadow-sm p-4 text-center">
                              <div className="bg-pink-50 text-pink-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                                  <i data-feather="user" className="w-6 h-6"></i>
                              </div>
                              <a href="#" className="font-medium hover:text-gray-300">Avatar Items</a>
                          </div>
                          <div className="bg-gradient-to-r from-blue-300 to-indigo-500 rounded-lg shadow-sm p-4 text-center">
                              <div className="bg-blue-50 text-blue-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                                  <i data-feather="map" className="w-6 h-6"></i>
                              </div>
                              <a href="#" className="font-medium hover:text-gray-300">Quest Items</a>
                          </div>
                          <div className="bg-gradient-to-r from-yellow-300 to-orange-400 rounded-lg shadow-sm p-4 text-center">
                              <div className="bg-yellow-50 text-yellow-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                                  <i data-feather="zap" className="w-6 h-6"></i>
                              </div>
                              <a href="#" className="font-medium hover:text-gray-300">Power-ups</a>
                          </div>
                          <div className="bg-gradient-to-r from-green-300 to-green-500 rounded-lg shadow-sm p-4 text-center">
                              <div className="bg-green-50 text-green-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                                  <i data-feather="gift" className="w-6 h-6"></i>
                              </div>
                              <a href="#" className="font-medium hover:text-gray-300">Special offers</a>
                          </div>
                      </div>
                    </div>
                    {/** Rewards table */}
                    <div className="bg-white rounded-xl shadow-lg p-6 text-gray-900">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">All Shop Items</h2>
                <div className="relative">
                    <input type="text" placeholder="Search items..." className="border border-gray-300 rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                    <i data-feather="search" className="absolute left-3 top-2.5 text-gray-400"></i>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rarity</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200"></tbody>
                </table>
             </div>
           </div>
          </main>
        </div>
    );
}

export default rewards;