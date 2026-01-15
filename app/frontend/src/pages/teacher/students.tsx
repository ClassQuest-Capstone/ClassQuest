import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile";

const students = () => {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        feather.replace();
    })
     
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
                        to="/students"
                        className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
                      >
                        Students
                      </Link>
                      <Link
                        to="/profile"
                        className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                      >
                        Profile
                      </Link>
                      <DropDownProfile username="user"onLogout={() => {console.log("Logging out"); /**TODO: Logout logic */}}/>
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
               <main className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-indigo-600">Students</h1>
                        <p className="text-white">Add and manage students in your class </p>
                    </div>
                 </div>
                 <div className="bg-white rounded-xl shadow-lg p-6 text-gray-900">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Students in your class</h2>
                <div className="relative">
                    <input type="text" placeholder="Search students..." className="border border-gray-300 rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                    <i data-feather="search" className="absolute left-3 top-2.5 text-gray-400"></i>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">XP</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gold</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passwords</th>
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

export default students;