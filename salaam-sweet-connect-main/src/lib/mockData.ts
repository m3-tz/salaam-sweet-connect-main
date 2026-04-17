// ============= TYPES =============

export type UserRole = 'admin' | 'student' | 'engineer';

export interface User {
  id: number;
  username: string;
  password: string;
  role: UserRole;
  name: string;
  studentId?: string;
  isBanned?: boolean;
}

export interface Component {
  id: number;
  name: string;
  code: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  drawerNumber: string;
  description: string;
  imageUrl?: string;
}

export interface Student {
  id: number;
  studentId: string;
  name: string;
  username: string;
  role: 'student' | 'engineer';
  isBanned: boolean;
  activeLoans: number;
}

export interface Loan {
  id: number;
  studentId: string;
  studentName: string;
  componentId: number;
  componentName: string;
  componentCode: string;
  quantity: number;
  borrowDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: 'active' | 'returned' | 'overdue';
  isEngineer?: boolean;
}

export interface Camp {
  id: number;
  name: string;
  organization: string;
  responsible: string;
  createdDate: string;
  expectedReturnDate: string;
  status: 'active' | 'returned';
  items: CampItem[];
}

export interface CampItem {
  componentId: number;
  componentName: string;
  quantity: number;
  returned: boolean;
}

// Cart/Request system
export interface CartRequest {
  id: number;
  studentId: string;
  studentName: string;
  studentRole: 'student' | 'engineer';
  requestDate: string;
  expectedReturnDate: string;
  status: 'pending' | 'approved' | 'partial' | 'rejected';
  items: CartRequestItem[];
  note?: string;
}

export interface CartRequestItem {
  componentId: number;
  componentName: string;
  componentCode: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  status: 'pending' | 'approved' | 'rejected';
}

// Registration requests
export interface RegistrationRequest {
  id: number;
  name: string;
  username: string;
  password: string;
  role: 'student' | 'engineer';
  studentId?: string;
  requestDate: string;
  status: 'pending' | 'approved' | 'rejected';
}

// Department
export interface Department {
  id: number;
  name: string;
  code: string;
}

// ============= MOCK DATA =============

export const MOCK_USERS: User[] = [
  { id: 1, username: 'admin', password: '123456', role: 'admin', name: 'المشرف أحمد' },
  { id: 2, username: 's001', password: '123456', role: 'student', name: 'محمد علي', studentId: '2021001' },
  { id: 3, username: 's002', password: '123456', role: 'student', name: 'سارة أحمد', studentId: '2021002' },
  { id: 4, username: 's003', password: '123456', role: 'student', name: 'خالد محمد', studentId: '2021003' },
  { id: 5, username: 'eng001', password: '123456', role: 'engineer', name: 'م. سلطان العمري', studentId: 'ENG-001' },
];

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 1, name: 'هندسة الكهرباء', code: 'EE' },
  { id: 2, name: 'هندسة الحاسبات', code: 'CE' },
  { id: 3, name: 'هندسة الميكانيكا', code: 'ME' },
  { id: 4, name: 'هندسة الصناعة', code: 'IE' },
];

export const MOCK_COMPONENTS: Component[] = [
  { id: 1, name: 'Arduino Uno', code: 'ARD-001', category: 'ميكروكنترولر', totalQuantity: 10, availableQuantity: 7, drawerNumber: 'A-01', description: 'لوحة تطوير أردوينو أونو R3 المتوافقة مع ATmega328P', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Arduino_Uno_-_R3.jpg' },
  { id: 2, name: 'Raspberry Pi 4', code: 'RPI-004', category: 'ميكروكنترولر', totalQuantity: 5, availableQuantity: 3, drawerNumber: 'A-02', description: 'حاسب صغير يعمل بنظام Linux مثالي للمشاريع المتقدمة', imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Raspberry_Pi_4_Model_B_-_Side.jpg' },
  { id: 3, name: 'حساس درجة الحرارة DHT22', code: 'SNS-T22', category: 'حساسات', totalQuantity: 20, availableQuantity: 15, drawerNumber: 'B-01', description: 'حساس دقيق لقياس درجة الحرارة والرطوبة', imageUrl: '' },
  { id: 4, name: 'حساس الصوت', code: 'SNS-SND', category: 'حساسات', totalQuantity: 8, availableQuantity: 0, drawerNumber: 'B-02', description: 'وحدة الكشف عن الصوت مع خرج رقمي وتناظري', imageUrl: '' },
  { id: 5, name: 'حساس المسافة HC-SR04', code: 'SNS-DST', category: 'حساسات', totalQuantity: 15, availableQuantity: 10, drawerNumber: 'B-03', description: 'حساس مسافة بالموجات فوق الصوتية يقيس من 2cm إلى 4m', imageUrl: '' },
  { id: 6, name: 'مقاومة 220Ω', code: 'RES-220', category: 'مكونات أساسية', totalQuantity: 100, availableQuantity: 85, drawerNumber: 'C-01', description: 'مقاومة ثابتة 220 أوم للحماية', imageUrl: '' },
  { id: 7, name: 'LED أحمر', code: 'LED-RED', category: 'مكونات أساسية', totalQuantity: 50, availableQuantity: 42, drawerNumber: 'C-02', description: 'ثنائي ضوئي أحمر 5mm', imageUrl: '' },
  { id: 8, name: 'أسلاك تومباك (20 قطعة)', code: 'WIR-JMP', category: 'أسلاك وتوصيلات', totalQuantity: 30, availableQuantity: 20, drawerNumber: 'D-01', description: 'أسلاك ذكر-ذكر للتوصيل على لوحة التجارب', imageUrl: '' },
  { id: 9, name: 'لوحة تجارب 830 نقطة', code: 'BRD-830', category: 'أسلاك وتوصيلات', totalQuantity: 12, availableQuantity: 8, drawerNumber: 'D-02', description: 'لوحة تجارب بدون لحام سعة 830 نقطة توصيل', imageUrl: '' },
  { id: 10, name: 'شاشة LCD 16x2', code: 'DSP-LCD', category: 'شاشات وعرض', totalQuantity: 6, availableQuantity: 4, drawerNumber: 'E-01', description: 'شاشة سائل بلوري 16 عمود و 2 سطر مع خلفية إضاءة', imageUrl: '' },
  { id: 11, name: 'ESP8266 WiFi Module', code: 'ESP-01', category: 'ميكروكنترولر', totalQuantity: 8, availableQuantity: 5, drawerNumber: 'A-03', description: 'وحدة WiFi صغيرة قابلة للبرمجة مناسبة لمشاريع IoT', imageUrl: '' },
  { id: 12, name: 'محرك سيرفو SG90', code: 'MTR-SRV', category: 'محركات', totalQuantity: 10, availableQuantity: 7, drawerNumber: 'F-01', description: 'محرك سيرفو صغير يعمل بزاوية 0-180 درجة', imageUrl: '' },
];

export const MOCK_STUDENTS: Student[] = [
  { id: 1, studentId: '2021001', name: 'محمد علي', username: 's001', role: 'student', isBanned: false, activeLoans: 1 },
  { id: 2, studentId: '2021002', name: 'سارة أحمد', username: 's002', role: 'student', isBanned: false, activeLoans: 0 },
  { id: 3, studentId: '2021003', name: 'خالد محمد', username: 's003', role: 'student', isBanned: true, activeLoans: 0 },
  { id: 4, studentId: '2021004', name: 'فاطمة حسن', username: 's004', role: 'student', isBanned: false, activeLoans: 2 },
  { id: 5, studentId: '2021005', name: 'عمر إبراهيم', username: 's005', role: 'student', isBanned: false, activeLoans: 0 },
  { id: 6, studentId: 'ENG-001', name: 'م. سلطان العمري', username: 'eng001', role: 'engineer', isBanned: false, activeLoans: 0 },
];

const today = new Date();
const addDays = (d: number) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split('T')[0];
};

export const MOCK_LOANS: Loan[] = [
  { id: 1, studentId: '2021001', studentName: 'محمد علي', componentId: 1, componentName: 'Arduino Uno', componentCode: 'ARD-001', quantity: 1, borrowDate: addDays(-10), expectedReturnDate: addDays(4), status: 'active' },
  { id: 2, studentId: '2021004', studentName: 'فاطمة حسن', componentId: 3, componentName: 'حساس درجة الحرارة DHT22', componentCode: 'SNS-T22', quantity: 2, borrowDate: addDays(-20), expectedReturnDate: addDays(-5), status: 'overdue' },
  { id: 3, studentId: '2021004', studentName: 'فاطمة حسن', componentId: 8, componentName: 'أسلاك تومباك (20 قطعة)', componentCode: 'WIR-JMP', quantity: 1, borrowDate: addDays(-15), expectedReturnDate: addDays(-2), status: 'overdue' },
  { id: 4, studentId: '2021002', studentName: 'سارة أحمد', componentId: 2, componentName: 'Raspberry Pi 4', componentCode: 'RPI-004', quantity: 1, borrowDate: addDays(-30), expectedReturnDate: addDays(-15), actualReturnDate: addDays(-16), status: 'returned' },
  { id: 5, studentId: '2021005', studentName: 'عمر إبراهيم', componentId: 10, componentName: 'شاشة LCD 16x2', componentCode: 'DSP-LCD', quantity: 1, borrowDate: addDays(-45), expectedReturnDate: addDays(-30), actualReturnDate: addDays(-31), status: 'returned' },
];

export const MOCK_CART_REQUESTS: CartRequest[] = [
  {
    id: 1,
    studentId: '2021002',
    studentName: 'سارة أحمد',
    studentRole: 'student',
    requestDate: addDays(-1),
    expectedReturnDate: addDays(7),
    status: 'pending',
    items: [
      { componentId: 1, componentName: 'Arduino Uno', componentCode: 'ARD-001', requestedQuantity: 2, status: 'pending' },
      { componentId: 5, componentName: 'حساس المسافة HC-SR04', componentCode: 'SNS-DST', requestedQuantity: 1, status: 'pending' },
    ],
    note: 'لمشروع التخرج - روبوت متحرك'
  },
];

export const MOCK_REGISTRATION_REQUESTS: RegistrationRequest[] = [
  {
    id: 1,
    name: 'نورة السالم',
    username: 'noura_s',
    password: '123456',
    role: 'student',
    studentId: '2022010',
    requestDate: addDays(-2),
    status: 'pending',
  },
  {
    id: 2,
    name: 'م. بدر الغامدي',
    username: 'eng_badr',
    password: '123456',
    role: 'engineer',
    requestDate: addDays(-1),
    status: 'pending',
  },
];

export const MOCK_CAMPS: Camp[] = [
  {
    id: 1, name: 'هاكاثون الربيع 2025', organization: 'نادي الهندسة', responsible: 'أ. محمد الزهراني',
    createdDate: addDays(-5), expectedReturnDate: addDays(3), status: 'active',
    items: [
      { componentId: 1, componentName: 'Arduino Uno', quantity: 3, returned: false },
      { componentId: 8, componentName: 'أسلاك تومباك (20 قطعة)', quantity: 5, returned: false },
      { componentId: 9, componentName: 'لوحة تجارب 830 نقطة', quantity: 3, returned: false },
    ]
  },
  {
    id: 2, name: 'ورشة IoT', organization: 'قسم الحاسبات', responsible: 'د. سارة المطيري',
    createdDate: addDays(-60), expectedReturnDate: addDays(-45), status: 'returned',
    items: [
      { componentId: 11, componentName: 'ESP8266 WiFi Module', quantity: 5, returned: true },
      { componentId: 3, componentName: 'حساس درجة الحرارة DHT22', quantity: 3, returned: true },
    ]
  },
];

export const CATEGORIES = ['الكل', 'ميكروكنترولر', 'حساسات', 'مكونات أساسية', 'أسلاك وتوصيلات', 'شاشات وعرض', 'محركات'];
