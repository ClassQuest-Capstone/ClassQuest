export type LocalClass = {
  code: string;
  teacherId: string;
  createdAt: string;
  studentIds: string[];
};

const CLASSES_KEY = "cq_classes";

function readClasses(): Record<string, LocalClass> {
  const raw = localStorage.getItem(CLASSES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, LocalClass>;
  } catch {
    return {};
  }
}

function writeClasses(classes: Record<string, LocalClass>) {
  localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
}

export function ensureClassExists(code: string, teacherId: string) {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return;

  const classes = readClasses();
  if (!classes[cleaned]) {
    classes[cleaned] = {
      code: cleaned,
      teacherId,
      createdAt: new Date().toISOString(),
      studentIds: [],
    };
    writeClasses(classes);
  }
}

export function classExists(code: string): boolean {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return false;
  const classes = readClasses();
  return Boolean(classes[cleaned]);
}

export function joinClass(code: string, studentId: string) {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) throw new Error("Invalid class code.");

  const classes = readClasses();
  const cls = classes[cleaned];
  if (!cls) throw new Error("Invalid class code.");

  if (!cls.studentIds.includes(studentId)) {
    cls.studentIds.push(studentId);
    classes[cleaned] = cls;
    writeClasses(classes);
  }

  return cls;
}

export function getClass(code: string): LocalClass | null {
  const cleaned = code.trim().toUpperCase();
  const classes = readClasses();
  return classes[cleaned] || null;
}
