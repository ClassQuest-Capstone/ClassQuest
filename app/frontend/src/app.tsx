import { Amplify } from "aws-amplify";
// import awsExports from "./aws-exports";
//Amplify.configure(awsExports); (Todo: enable when aws export is setup)
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './home';
import { StudentLogin, TeacherLogin, Signup, Role } from './pages/auth';
import StudentDashboard from './pages/students/studentDashboard';
import TeacherDashboard from './pages/teacher/teacherDashboard';
import CharacterPage from './pages/students/characterpage';
import Subjects from './pages/teacher/subjects';
import Quests from './pages/teacher/quests';
import Rewards from './pages/teacher/rewards';
import Students from './pages/teacher/students';
import Activity from './pages/teacher/Activity';
import BossFight from './pages/students/bossFight';
import ProblemSolve from './pages/students/problemsolve';
import Leaderboards from "./pages/students/leaderboards";
import Guild from "./pages/students/guilds";
import StudentShop from "./pages/students/studentshop";
import Profile from './pages/teacher/profile';
import Welcome from "./pages/students/welcome";

//-------------- api test component --------------
import ApiSmoke from "./pages/api/ApiSmoke";
1//-------------- end api test component --------------


export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/*-------------- api test route --------------*/}
        <Route path="/api/api-smoke" element={<ApiSmoke />} />
        {/*-------------- end api test route --------------*/}

        <Route path="/" element={<Home />} />
        <Route path="/role" element={<Role />} />
        <Route path="/StudentLogin" element={<StudentLogin />} />
        <Route path="/TeacherLogin" element={<TeacherLogin />} />
        <Route path="/Signup" element={<Signup />} />
        <Route path="/StudentDashboard" element={<StudentDashboard />} />
        <Route path="/TeacherDashboard" element={<TeacherDashboard />} />
        <Route path='/rewards' element={<Rewards/>} />
        <Route path='/students' element={<Students/>} />
        <Route path='/Activity' element={<Activity/>} />
        <Route path="/bossFight" element={<BossFight />} />
        <Route path='/profile' element={<Profile />} />
        <Route path="/character" element={<CharacterPage />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/problemsolve" element={<ProblemSolve />} />
        <Route path="/leaderboards" element={<Leaderboards />} />
        <Route path="/guilds" element={<Guild />} />
        {<Route path="/quests" element={<Quests />} />}
        <Route path="/shop" element={<StudentShop />} />
        <Route path="/welcome" element={<Welcome />} />
      </Routes>
    </BrowserRouter>
  );
}