// app.tsx
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports.js";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./home.js";
import { StudentLogin, TeacherLogin, Signup, Role } from "./pages/auth/index.js";
import TeacherDashboard from "./pages/teacher/teacherDashboard.js";
import CharacterPage from "./pages/students/characterpage.js";
import Subjects from "./pages/teacher/subjects.js";
import Classes from "./pages/teacher/classes.js"
import ClassQuest from "./pages/teacher/classQuest.js";
import Quests from "./pages/teacher/quests.js";
import Rewards from "./pages/teacher/rewards.js";
import Students from "./pages/teacher/students.js";
import Activity from "./pages/teacher/Activity.js";
import BossFight from "./pages/students/bossFight.js";
import ProblemSolve from "./pages/students/problemsolve.js"; 
import Leaderboards from "./pages/students/leaderboards.js";
import Guild from "./pages/students/guilds.js";
import StudentShop from "./pages/students/studentshop.js";
import Profile from "./pages/teacher/profile.js";
import Welcome from "./pages/students/welcome.js";
import TeacherGuilds from "./pages/teacher/teacherGuilds.js";

// -------------- api test component --------------
import ApiSmoke from "./pages/api/ApiSmoke.js";
// -------------- end api test component --------------

// ✅ Enable Amplify Auth (Cognito User Pool config)
Amplify.configure(awsExports);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* -------------- api test route -------------- */}
        <Route path="/api/api-smoke" element={<ApiSmoke />} />
        {/* -------------- end api test route -------------- */}

        <Route path="/" element={<Home />} />
        <Route path="/role" element={<Role />} />

        <Route path="/StudentLogin" element={<StudentLogin />} />
        <Route path="/TeacherLogin" element={<TeacherLogin />} />
        <Route path="/Signup" element={<Signup />} />


        {/* ✅ Teacher Dashboard (canonical route) */}
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />

        {/* ✅ Backwards compatibility: old routes redirect to new */}
        <Route
          path="/TeacherDashboard"
          element={<Navigate to="/teacher/dashboard" replace />}
        />
        <Route
          path="/teacherDashboard"
          element={<Navigate to="/teacher/dashboard" replace />}
        />
        <Route
          path="/teacherdashboard"
          element={<Navigate to="/teacher/dashboard" replace />}
        />

        <Route path="/rewards" element={<Rewards />} />
        <Route path="/students" element={<Students />} />
        <Route path="/Activity" element={<Activity />} />
        <Route path='/classes' element={<Classes />} />
        <Route path='/ClassQuest' element={<ClassQuest />} />
        <Route path="/bossFight" element={<BossFight />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/character" element={<CharacterPage />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/quests" element={<Quests />} />
        <Route path="/problemsolve" element={<ProblemSolve />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/guilds" element={<Guild />} />
        <Route path="/shop" element={<StudentShop />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/teacherGuilds" element={<TeacherGuilds />} />
        {/* Optional fallback */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
