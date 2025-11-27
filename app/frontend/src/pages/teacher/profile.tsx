import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile";

const profile = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() =>{
    feather.replace();
  })

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
                        to="/Students"
                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                      >
                        Students
                      </Link>
                      <Link
                        to="/Subjects"
                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                      >
                        Quests
                      </Link>
                      <Link
                        to="/Activity"
                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                      >
                        Activity
                      </Link>
                     < Link
                        to="/rewards"
                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                      >
                        Rewards
                      </Link>
                      <DropDownProfile username="user"onLogout={() => {console.log("Logging out"); /**TODO: Logout logic */}}/>
                    </div>
                  </div>
                </div>
              </nav>

              </div>
  );
};

export default profile;