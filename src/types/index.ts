export interface StudentRecord {
  registerNumber: string; // REGISTER NUMBER
  name: string;           // NAME
  fatherName: string;     // FATHER NAME
  gender: string;         // GENDER
  dob: string;            // DATE OF B IRTH
  nationality: string;    // NATIONALITY
  year: string;           // YEAR
  branch: string;         // BRANCH
  specialization: string; // SPECIALIZATION
}

export type ApprovalStatus = 
  | 'PENDING_TEACHER' 
  | 'PENDING_HOD' 
  | 'APPROVED' 
  | 'REJECTED_BY_TEACHER' 
  | 'REJECTED_BY_HOD';

export interface SubmissionRecord {
  submissionId: string;      // Submission_ID (Col A)
  studentEmail: string;      // Student_Email (Col B)
  registerNumber: string;    // Register_Number (Col C)
  studentName: string;       // Student_Name (Col D)
  fatherName: string;        // Father_Name (Col E)
  gender: string;            // Gender (Col F)
  dob: string;               // DOB (Col G)
  nationality: string;       // Nationality (Col H)
  departmentBranch: string;  // Department_Branch (Col I)
  specialization: string;    // Specialization (Col J)
  semester: string;          // Semester (Col K - e.g. VIII, VII, VI, V, IV, III)
  section: string;           // Section (Col L)
  batch: string;             // Batch (Col M)
  photoUpload: string;       // Photo_Upload (Col N - e.g. 19136010.jpg)
  finalDriveUrl: string;     // Final_Drive_URL (Col O)
  proof10thUrl?: string;     // Proof_10th_URL (Col P)
  proofTcUrl?: string;       // Proof_TC_URL (Col Q)
  validationNotes: string;   // Validation_Notes (Col R)
  approvalStatus: ApprovalStatus; // Approval_Status (Col S)
  teacherRemarks?: string;   // Teacher_Remarks (Col T)
  hodRemarks?: string;       // HOD_Remarks (Col U)
  deanRemarks?: string;      // Dean_Remarks (Col V)
  submittedAt?: string;
  updatedAt?: string;
}

export interface FacultyScope {
  role: 'TEACHER' | 'HOD' | 'DEAN' | 'COE';
  department: string;
  specialization: string;
  semester?: string;
  batch: string;
  section: string;
}

export interface FacultyRecord {
  email: string;             // Email (Col A)
  name: string;              // Name (Col B)
  role: 'TEACHER' | 'HOD' | 'DEAN' | 'COE'; // Role (Col C)
  department: string;        // Department (Col D)
  specialization: string;    // Specialization (Col E)
  semester: string;          // Semester (Col F - e.g. VIII, VII, ALL)
  batch: string;             // Batch (Col G)
  section: string;           // Section (Col H)
  scopes?: FacultyScope[];
}

export interface OtpSession {
  email: string;
  otp: string;
  expiresAt: number;
  portalType: 'student' | 'faculty' | 'coe';
}

export interface CoeSettings {
  spreadsheetUrl: string;
  spreadsheetId: string;
  driveFolderUrl: string;
  driveFolderId: string;
  academicYear: string;
  convocationBatch: string;
}

export interface CoeUserRecord {
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ACOE_ENGINEERING' | 'ACOE_NON_ENGINEERING';
  streamScope: 'ALL' | 'ENGINEERING' | 'NON_ENGINEERING';
  password?: string;
  isDefaultPassword?: boolean;
  addedAt?: string;
}

export interface CoeOverviewStats {
  totalStudents: number;
  totalSubmissions: number;
  approved: number;
  pendingTeacher: number;
  pendingHod: number;
  rejected: number;
  totalHods: number;
  totalTeachers: number;
  streamScope?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  user?: any;
  coeUser?: any;
  users?: any[];
  student?: StudentRecord;
  submission?: SubmissionRecord;
  settings?: CoeSettings;
  stats?: CoeOverviewStats;
  hods?: FacultyRecord[];
}

