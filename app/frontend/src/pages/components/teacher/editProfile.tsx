/*import { useState } from "react";
import { createTeacherProfile, getTeacherProfile } from "../../api/teacherProfiles.ts";

const EditProfileModal = ({ profile, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    display_name: profile.display_name,
    email: profile.email,
    characterImage: profile.characterImage || "",
    password: "", // optional depending on your auth flow
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    // Call your SST API instead of GraphQL
    await createTeacherProfile({
      teacher_id: profile.teacher_id,
      school_id: profile.school_id,
      display_name: formData.display_name,
      email: formData.email,
      // characterImage + password handled separately if needed
    });

    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>

        <input
          name="display_name"
          value={formData.display_name}
          onChange={handleChange}
          placeholder="Display Name"
          className="border p-2 w-full mb-3"
        />

        <input
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="Email"
          className="border p-2 w-full mb-3"
        />

        <input
          name="characterImage"
          value={formData.characterImage}
          onChange={handleChange}
          placeholder="Character Image URL"
          className="border p-2 w-full mb-3"
        />

        <input
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="New Password (optional)"
          className="border p-2 w-full mb-3"
        />

        <div className="flex justify-end gap-3">
          <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded">
            Save
          </button>
          <button onClick={onClose} className="bg-gray-300 px-4 py-2 rounded">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal;
*/