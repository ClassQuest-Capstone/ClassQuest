import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { generateClassCode } from "../../utils/classCode";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName: string;
  email: string;
  classCode: string;
};

export default function TeacherRegister() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!displayName.trim() || !email.trim()) {
      setError("Please enter a name and email.");
      return;
    }

    // ✅ STEP 2 (RIGHT HERE): generate + store teacher class code on registration
    const classCode = generateClassCode(6);

    const teacherUser: TeacherUser = {
      id: crypto.randomUUID(),
      role: "teacher",
      displayName: displayName.trim(),
      email: email.trim(),
      classCode,
    };

    // store current user
    localStorage.setItem("cq_currentUser", JSON.stringify(teacherUser));
    // store class code so students can validate against it
    localStorage.setItem("cq_teacherClassCode", classCode);

    navigate("/teacher/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-2xl font-extrabold">Teacher Registration</h1>
        <p className="text-slate-300 mt-1 text-sm">
          Create your teacher account. A class code will be generated for your students.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-800 bg-red-900/20 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-sm text-slate-300">Display Name</label>
            <input
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 outline-none"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ms. Smith"
            />
          </div>

          <div>
            <label className="text-sm text-slate-300">Email</label>
            <input
              className="mt-1 w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@school.ca"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-slate-200 text-slate-950 font-semibold py-2 hover:bg-white"
          >
            Create Teacher Account
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-300">
          Student?{" "}
          <Link to="/register/student" className="underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
