import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.tsx";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};


const Profile = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const profile = {}
  const [loading, setIsLoading] = useState(false); // Loading state
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);

  useEffect(() => {
    feather.replace();
  }, []);

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


<button onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}>
  <i data-feather="menu" />
</button>

{isMobileNavOpen && (
  <div className="md:hidden bg-blue-700 text-white">
    <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Dashboard</Link>
    <Link to="/Students" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Students</Link>
    <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
    <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Activity</Link>
    <Link to="/rewards" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Rewards</Link>
    <DropDownProfile
                                    username={teacher?.displayName || "user"}
                                    onLogout={() => {
                                      localStorage.removeItem("cq_currentUser");
                                      navigate("/TeacherLogin");
                                    }}
                                  />
  </div>
)}

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
              <DropDownProfile
                                    username={teacher?.displayName || "user"}
                                    onLogout={() => {
                                      localStorage.removeItem("cq_currentUser");
                                      navigate("/TeacherLogin");
                                    }}
                                  />
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

      {/* Content */}
      <div className="rounded-2xl p-4 bg-[#efe6bc] shadow-lg transform transition hover:-translate-y-1 hover:shadow-2xl cursor-pointer max-w-80 mx-auto max-h-">
    {/** Character card */}
      <div className="w-full flex justify-center">
        <img

          src="/assets/cards/Mage_1.png"
          alt="charcater"
          className="h-100 w-65 "
        />
      </div>
      
    </div>
    {/** Character name and role */}
    <div className="rounded-2xl p-4 bg-indigo-600 max-w-80 mx-auto mt-3 mb-5">
      <p className="mt-0.5 text-lg font-bold text-white"> Name: </p>
      <p className="text-white text-lg font-bold items-center justify-between">
        Password: {/*{showPassword ? profile.password : "••••••••"}*/}
      </p>
      <i
        data-feather="edit"
        className="mt-3 flex cursor-pointer"
        onClick={() => setIsModalOpen(true)}
      />

      {/*isModalOpen && (
        <EditProfileModal
          profile={profile}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )*/}

      </div>
    </div>
  );
};

export default Profile;
