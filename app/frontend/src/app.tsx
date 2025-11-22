import { Amplify } from "aws-amplify";
//import awsExports from "./aws-exports";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './home';
import { StudentLogin, TeacherLogin, Signup, Role} from './pages/auth';
import StudentDashboard from './pages/students/studentDashboard';
import TeacherDashboard from './pages/teacher/teacherDashboard';

//Amplify.configure(awsExports); (Todo: enable when aws export is setup)

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
      </Routes>
    </BrowserRouter>
  );
}