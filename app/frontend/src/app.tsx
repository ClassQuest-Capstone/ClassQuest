import { Amplify } from "aws-amplify";
//import awsExports from "./aws-exports";
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './home';
import { StudentLogin, TeacherLogin, Signup, Role} from './pages/auth';

//Amplify.configure(awsExports); (Todo: enable when aws export is setup)

export default function AppWrapper() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/role" element={<Role />} />
        <Route path="/StudentLogin" element={<StudentLogin />} />
        <Route path="/TeacherLogin" element={<TeacherLogin />} />
        <Route path="/Signup" element={<Signup />} />
      </Routes>
    </BrowserRouter>
  );
}