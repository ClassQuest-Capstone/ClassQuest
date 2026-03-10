import React, { useState, useEffect } from "react";
import feather from "feather-icons";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    displayName: "",
    password: "",
    confirmPassword: "",
    selectedCharacter: "mage",
  });

  useEffect(() => {
    if (isOpen) {
      feather.replace();
      const currentUserJson = localStorage.getItem("cq_currentUser");
      if (currentUserJson) {
        try {
          const teacherData = JSON.parse(currentUserJson) as TeacherUser;
          setTeacher(teacherData);
          setFormData((prev) => ({
            ...prev,
            displayName: teacherData.displayName || "",
          }));
        } catch (error) {
          console.error("Failed to parse teacher data:", error);
        }
      }
    }
  }, [isOpen]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

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

      // TODO: Update display name and password via Cognito
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
        onClose();
        setSuccessMessage("");
      }, 1500);
    } catch (err) {
      setErrorMessage("Failed to update profile. Please try again.");
      console.error("Error updating profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center">
      <div className="relative top-20 mx-auto p-8 border w-full max-w-lg shadow-xl rounded-lg bg-white">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-blue-500 hover:text-blue-700">
                <i data-feather="x-circle"></i>
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
            <label
              htmlFor="displayName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
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
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
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
                <i
                  data-feather={showPassword ? "eye-off" : "eye"}
                  className="w-5 h-5"
                ></i>
              </button>
            </div>
          </div>

          {/* Confirm Password Input */}
          {formData.password && (
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
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
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
