export type ClassItem = {
    class_id: string;              // UUID - Primary Key
    school_id: string;             // For multi-tenancy queries (GSI2)
    name: string;                  // Class name (e.g., "Math 101")
    subject?: string;              // Optional subject (e.g., "Mathematics")
    grade_level: number;           // Target grade (5-8), stored as number not string
    created_by_teacher_id: string; // Teacher who created the class (GSI1)
    join_code: string;             // 6-char uppercase alnum code for students to join (GSI3)
    is_active: boolean;            // Soft delete flag - false when deactivated
    deactivated_at?: string;       // ISO timestamp when class was deactivated
    created_at: string;            // ISO timestamp when class was created
    updated_at?: string;           // ISO timestamp when class was last updated
};
