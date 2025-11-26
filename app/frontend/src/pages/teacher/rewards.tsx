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
              {/** Intro and create item */}
              <main className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-indigo-800">Shop & Reward</h1>
                        <p className="text-white">Add and manage items available for students to purchase</p>
                    </div>
                    <button
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2 rounded-lg flex items-center"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <i data-feather="plus" className="mr-2"></i> Create Items
                    </button>
                    </div>
                    {/** */}
                    <div>

                    </div>
                </main>
        </div>
    );
}

export default rewards;