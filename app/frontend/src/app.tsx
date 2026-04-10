// app.tsx
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports.js";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./home.js";
import { StudentLogin, TeacherLogin, Signup, Role } from "./pages/auth/index.js";
import ForgotPassword from "./pages/auth/ForgotPassword.js";
import TeacherDashboard from "./pages/teacher/teacherDashboard.js";
import CharacterPage from "./pages/students/characterpage.js";
import Subjects from "./pages/teacher/subjects.js";
import Classes from "./pages/teacher/classes.js";
import ClassQuest from "./pages/teacher/classQuest.js";
import BossClasses from "./pages/teacher/bossClasses.js";
import Quests from "./pages/teacher/quests.js";
import Rewards from "./pages/teacher/rewards.js";
import Students from "./pages/teacher/students.js";
import Activity from "./pages/teacher/activity.tsx";
import BossFight from "./pages/students/bossFight.js";
import ProblemSolve from "./pages/students/problemsolve.js";
import Leaderboards from "./pages/students/leaderboards.js";
import Guild from "./pages/students/guilds.js";
import StudentShop from "./pages/students/studentshop.js";
import Profile from "./pages/teacher/profile.js";
import Welcome from "./pages/students/welcome.js";
import TeacherGuilds from "./pages/teacher/teacherGuilds.js";

import BossQuestions from "./pages/teacher/bossQuestions.js";
import ClassesWiki from "./pages/teacher/wiki/classesWiki.js";
import QuestsWiki from "./pages/teacher/wiki/questsWiki.js";
import GuildsWiki from "./pages/teacher/wiki/guildsWiki.js";


import ApiSmoke from "./pages/api/ApiSmoke.js";

// Lobby pages
import BossBattleLobbyStudent from "./pages/students/bossBattleLobby.js";
import BossBattleLobbyTeacher from "./pages/teacher/bossBattleLobbyTeacher.js";

/* 🔹 NEW IMPORT */
import BossBattleMonitorTeacher from "./pages/teacher/bossBattleMonitorTeacher.js";
import BossBattleDisplay from "./pages/teacher/bossBattleDisplay.js";

Amplify.configure(awsExports);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/api/api-smoke" element={<ApiSmoke />} />

        <Route path="/" element={<Home />} />
        <Route path="/role" element={<Role />} />

        <Route path="/StudentLogin" element={<StudentLogin />} />
        <Route path="/TeacherLogin" element={<TeacherLogin />} />
        <Route path="/Signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />

        <Route path="/TeacherDashboard" element={<Navigate to="/teacher/dashboard" replace />} />
        <Route path="/teacherDashboard" element={<Navigate to="/teacher/dashboard" replace />} />
        <Route path="/teacherdashboard" element={<Navigate to="/teacher/dashboard" replace />} />

        <Route path="/rewards" element={<Rewards />} />
        <Route path="/students" element={<Students />} />
        <Route path="/Activity" element={<Activity />} />
        <Route path="/classes" element={<Classes />} />
        <Route path="/wiki/classes" element={<ClassesWiki />} />
        <Route path="/wiki/quests" element={<QuestsWiki />} />
        <Route path="/wiki/guilds" element={<GuildsWiki />} />
        <Route path="/ClassQuest" element={<ClassQuest />} />
        <Route path="/bossClasses" element={<BossClasses />} />

        <Route path="/profile" element={<Profile />} />
        <Route path="/character" element={<CharacterPage />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/quests" element={<Quests />} />

        <Route path="/bossQuestions" element={<BossQuestions />} />
        <Route path="/teacher/bossQuestions" element={<BossQuestions />} />

        <Route path="/bossFight" element={<BossFight />} />
        <Route path="/problemsolve" element={<ProblemSolve />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/guilds" element={<Guild />} />
        <Route path="/shop" element={<StudentShop />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/teacherGuilds" element={<TeacherGuilds />} />

        {/* Boss Battle Lobby routes */}
        <Route
          path="/students/boss-lobby/:bossInstanceId"
          element={<BossBattleLobbyStudent />}
        />

        <Route
          path="/teacher/boss-lobby/:bossInstanceId"
          element={<BossBattleLobbyTeacher />}
        />

        <Route
          path="/teacher/bossfight-monitor/:bossInstanceId"
          element={<BossBattleMonitorTeacher />}
        />

        <Route
          path="/teacher/bossfight-display/:bossInstanceId"
          element={<BossBattleDisplay />}
        />

        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}