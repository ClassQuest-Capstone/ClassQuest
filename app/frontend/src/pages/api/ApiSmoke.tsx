import { useEffect, useState } from "react";
import { createStudentProfile, getStudentProfile, listStudentsBySchool } from "../../api/studentProfiles";
import { createTeacherProfile, getTeacherProfile, listTeachersBySchool } from "../../api/teacherProfiles";

export default function ApiSmoke() {
    const [out, setOut] = useState<any>({ status: "running" });

    useEffect(() => {
        (async () => {
        const school_id = "school-001";

        await createStudentProfile({
            student_id: "u-student-frontend-001",
            school_id,
            display_name: "Frontend Student",
            email: "frontend-student@example.com",
            grade: "6",
        });

        await createTeacherProfile({
            teacher_id: "u-teacher-frontend-001",
            school_id,
            display_name: "Frontend Teacher",
            email: "frontend-teacher@example.com",
        });

        const student = await getStudentProfile("u-student-frontend-001");
        const teacher = await getTeacherProfile("u-teacher-frontend-001");

        const students = await listStudentsBySchool(school_id);
        const teachers = await listTeachersBySchool(school_id);

        setOut({ student, teacher, students, teachers });
        })().catch((e) => setOut({ error: String(e) }));
    }, []);

    return <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(out, null, 2)}</pre>;
}
