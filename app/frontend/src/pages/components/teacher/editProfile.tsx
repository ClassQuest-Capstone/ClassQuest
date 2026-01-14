/*import { useState } from "react";

const EditProfileModal = ({ profile, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: profile.name,
    password: profile.password,
    classCode: profile.classCode,
    characterImage: profile.characterImage,
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    await API.graphql({
      query: updateTeacherProfile,
      variables: { input: { id: profile.id, ...formData } },
    });
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
        <input name="name" value={formData.name} onChange={handleChange} />
        <input name="password" type="password" value={formData.password} onChange={handleChange} />
        <input name="classCode" value={formData.classCode} onChange={handleChange} />
        <input name="characterImage" value={formData.characterImage} onChange={handleChange} />
        <button onClick={handleSubmit}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};*/
