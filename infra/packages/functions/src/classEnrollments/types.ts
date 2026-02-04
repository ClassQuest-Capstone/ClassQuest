export type EnrollmentItem = {
    enrollment_id: string;  // UUID - Primary Key
    class_id: string;       // For querying students in a class (GSI1)
    student_id: string;     // For querying classes a student is in (GSI2)
    joined_at: string;      // ISO timestamp when student joined
    status: "active" | "dropped";  // Enrollment status
    dropped_at?: string;    // ISO timestamp when student dropped (if status="dropped")
};
