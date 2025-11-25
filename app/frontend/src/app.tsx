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


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/role" element={<Role />} />
        <Route path="/StudentLogin" element={<StudentLogin />} />
        <Route path="/TeacherLogin" element={<TeacherLogin />} />
        <Route path="/Signup" element={<Signup />} />
        <Route path="/StudentDashboard" element={<StudentDashboard />} />
        <Route path="/TeacherDashboard" element={<TeacherDashboard />} />
        <Route path="/character" element={<CharacterPage />} />
        <Route path="/subjects" element={<Subjects />} />
        {<Route path="/quests" element={<Quests />} />}
      </Routes>
    </BrowserRouter>
  );
}
