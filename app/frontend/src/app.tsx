import { Amplify } from "aws-amplify";
// import awsExports from "./aws-exports";
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './home';
import { StudentLogin, TeacherLogin, Signup, Role } from './pages/auth';

import StudentDashboard from './pages/students/studentDashboard';
import TeacherDashboard from './pages/teacher/teacherDashboard';
<<<<<<< HEAD

// ⭐ NEW CHARACTER PAGE ⭐
import CharacterPage from './pages/students/characterpage';

// Amplify.configure(awsExports); // (Todo: enable when aws export is setup)
=======
//import DropDownProfile from './pages/features/teacher/dropDownProfile';
//Amplify.configure(awsExports); (Todo: enable when aws export is setup)
>>>>>>> 5c8e9f59679146f31282f3a74496d3f23ef1977f

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/role" element={<Role />} />
        <Route path="/StudentLogin" element={<StudentLogin />} />
        <Route path="/TeacherLogin" element={<TeacherLogin />} />
        <Route path="/Signup" element={<Signup />} />
        
        {/* Dashboards */}
        <Route path="/StudentDashboard" element={<StudentDashboard />} />
        <Route path="/TeacherDashboard" element={<TeacherDashboard />} />
<<<<<<< HEAD

        {/* ⭐ Character Page ⭐ */}
        <Route path="/character" element={<CharacterPage />} />
=======
        {/*<Route path="/dropDownProfile" element={<DropDownProfile />} /> */}
>>>>>>> 5c8e9f59679146f31282f3a74496d3f23ef1977f
      </Routes>
    </BrowserRouter>
  );
}
