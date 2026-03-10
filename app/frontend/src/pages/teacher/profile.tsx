import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.tsx";
import ProfileModal from "../features/teacher/ProfileModal.js";

// TODO: this page will be used for stylized profile management, character selection/customization, and other user-specific settings in the future. For now it just has a placeholder and the edit profile modal form.

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
  const [loading, setIsLoading] = useState(false);
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Form states for profile editing
  const [formData, setFormData] = useState({
    displayName: "",
    password: "",
    confirmPassword: "",
    selectedCharacter: "mage",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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
        setFormData(prev => ({
          ...prev,
          displayName: teacherData.displayName || "",
        }));
      } catch (error) {
        console.error("Failed to parse teacher data from localStorage:", error);
      }
    }
  }, []);

  // Handle form input changes
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submission for profile updates
  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Validation
    if (!formData.displayName.trim()) {
      setErrorMessage("Display name cannot be empty");
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    if (formData.password && formData.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters");
      return;
    }

    try {
      setIsLoading(true);

      // TODO: Update display name and password via Cognito (current local storrage)
      if (teacher) {
        const updatedTeacher = {
          ...teacher,
          displayName: formData.displayName,
        };
        localStorage.setItem("cq_currentUser", JSON.stringify(updatedTeacher));
        setTeacher(updatedTeacher);
      }

      setSuccessMessage("Profile updated successfully!");
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccessMessage("");
      }, 1500);
    } catch (err) {
      setErrorMessage("Failed to update profile. Please try again.");
      console.error("Error updating profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = () => {
    setErrorMessage("");
    setSuccessMessage("");
    setFormData(prev => ({
      ...prev,
      displayName: teacher?.displayName || "",
      password: "",
      confirmPassword: "",
    }));
    setIsModalOpen(true);
  };

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
                  <span className="text-xl font-bold">ClassQuest</span>
                </Link>
              </div>
            </div>
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Dashboard</Link>
              <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Classes</Link>
              <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
              <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Activity</Link>
              <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Guilds</Link>
              <Link to="/profile" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">Profile</Link>
               <DropDownProfile
                                      username={teacher?.displayName || "user"}
                                      onLogout={() => {
                                        localStorage.removeItem("cq_currentUser");
                                        navigate("/TeacherLogin");
                                      }}
                                      onProfileClick={() => setIsProfileModalOpen(true)}
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

      <main className="max-w-7xl mx-auto px-4 py-8">
       {/* Header */}
        <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-yellow-300">
              Profile
            </h1>
            <p className="text-white">Manage your profile information here.</p>
          </div>
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
      <p className="mt-0.5 text-lg font-bold text-white"> Name: {teacher?.displayName}</p>
      <p className="text-white text-lg font-bold items-center justify-between">
        Password: •••••••• {/*{showPassword ? profile.password : "••••••••"}*/}
      </p>
      <button
        className="mt-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-lg flex items-center"
        onClick={() => openModal()}
      >
        <i data-feather="edit" className="mr-2"></i> Edit Profile
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-start justify-center">
          <div className="relative top-20 mx-auto p-8 border w-full max-w-lg shadow-xl rounded-lg bg-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {errorMessage}
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              {/* Display Name Input */}
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your display name"
                  required
                />
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password (Optional)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Leave blank to keep current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                  >
                    <i data-feather={showPassword ? "eye-off" : "eye"} className="w-5 h-5"></i>
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              {formData.password && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm your new password"
                    required={!!formData.password}
                  />
                </div>
              )}

              {/* Character Selection */}
              <div>
                <label htmlFor="selectedCharacter" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Character (TODO: Character Customization)
                </label>
                <select
                  id="selectedCharacter"
                  name="selectedCharacter"
                  value={formData.selectedCharacter}
                  onChange={handleFormChange}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="mage">Mage</option>
                  <option value="guardian">Guardian</option>
                  <option value="healer">Healer</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Coming soon - Character selection and customization</p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:bg-gray-400"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )} 
{/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      
      </div>
      </main>
    </div>
  );
};

export default Profile;
