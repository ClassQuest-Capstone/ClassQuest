import React, { useState, useEffect } from "react";
import feather from "feather-icons";
import EditProfileModal from "./EditProfileModal.js";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      feather.replace();
    }
  }, [isOpen]);

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
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="relative mx-auto p-8 border w-full max-w-sm shadow-xl rounded-lg bg-white/50 backdrop-blur">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-indigo-700 hover:text-indigo-800">
                <i data-feather="x-circle"></i>
          </button>
          {/* Header */}
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile</h2>

          {/* Profile Picture */}
          <div className="flex justify-center mb-6">
            <img
              className="inline-block h-33 w-33 rounded-full ring-3 ring-purple-500 hover:ring-purple-700"
              src="/assets/warrior-head.png"
              alt="Profile"
            />
          </div>

          {/* Profile Info Card */}
          <div className="rounded-lg p-4 bg-indigo-600 mb-5">
            <p className="text-lg font-bold text-white mb-2">
              Name: {teacher?.displayName || "User"}
            </p>
            <p className="text-lg font-bold text-white mb-4">
              Password: ••••••••
            </p>

            {/* Edit Profile Button */}
            <button
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center"
              onClick={() => setShowEditModal(true)}
            >
              <i data-feather="edit" className="mr-2 w-5 h-5"></i>
              Edit Profile
            </button>
          </div>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="w-full bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          // Reload teacher data after editing
          const currentUserJson = localStorage.getItem("cq_currentUser");
          if (currentUserJson) {
            try {
              const teacherData = JSON.parse(currentUserJson) as TeacherUser;
              setTeacher(teacherData);
            } catch (error) {
              console.error("Failed to parse teacher data:", error);
            }
          }
        }}
      />
    </>
  );
};

export default ProfileModal;
