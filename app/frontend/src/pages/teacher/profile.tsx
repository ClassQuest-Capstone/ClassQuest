import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile";

const Profile = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen">
      {/* Navigation */}
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
              <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Dashboard</Link>
              <Link to="/Students" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Students</Link>
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
              <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Activity</Link>
              <Link to="/rewards" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Rewards</Link>
              <Link to="/settings" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Settings</Link>
              <DropDownProfile username="user" onLogout={() => console.log("Logging out")} />
            </div>
          </div>
        </div>
      </nav>

      {/* Profile Card Section */}
      <section className="py-10 flex justify-center">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl overflow-hidden flex">
          {/* Left side */}
          <div className="bg-gradient-to-b from-blue-600 to-blue-400 text-white flex flex-col items-center justify-center p-6 w-1/3">
            <img
              src="/assets/warrior-head.png"
              alt="Avatar"
              className="w-20 h-20 rounded-full mb-4"
            />
            <h5 className="text-lg font-semibold">User</h5>
            <p className="text-sm">Grade 5 teacher</p>
            <i data-feather="edit" className="mt-5"></i>
          </div>

          {/* Right side */}
          <div className="flex-1 p-6">
            <h6 className="text-gray-700 font-semibold">Information</h6>
            <hr className="my-2" />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h6 className="text-gray-700 font-semibold">Email</h6>
                <p className="text-gray-500 text-sm">info@example.com</p>
              </div>
              <div>
                <h6 className="text-gray-700 font-semibold">Phone</h6>
                <p className="text-gray-500 text-sm">123 456 789</p>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex space-x-4 mt-4">
              <a href="#!" className="text-blue-600 hover:text-blue-800">
                <i data-feather="facebook"></i>
              </a>
              
              <a href="#!" className="text-pink-500 hover:text-pink-700">
                <i data-feather="instagram"></i>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Profile;
