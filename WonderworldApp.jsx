/**
 * WONDERWORLD UNIFORM ORDERING SYSTEM
 * Full React App — Single File
 *
 * ============================================================
 * RECOMMENDED TECH STACK
 * ============================================================
 * Frontend:  React 18 + Vite, TailwindCSS (or CSS Modules)
 * Backend:   Node.js + Express (REST API) OR Next.js API routes
 * Database:  PostgreSQL (schema below) + Prisma ORM
 * Auth:      JWT (parents) + bcrypt password hashing
 * Storage:   AWS S3 or Cloudflare R2 for product images / logos
 * Realtime:  Socket.IO or Supabase Realtime for order status sync
 * Export:    exceljs or papaparse for CSV/XLSX generation
 * Deploy:    Vercel (frontend) + Railway or Render (backend + DB)
 *
 * ============================================================
 * POSTGRESQL DATABASE SCHEMA (Prisma SDL)
 * ============================================================
 *
 * model Admin {
 *   id         String   @id @default(cuid())
 *   name       String
 *   email      String   @unique
 *   password   String   // bcrypt hash
 *   role       AdminRole @default(STAFF)  // SUPER_ADMIN | MANAGER | STAFF
 *   isActive   Boolean  @default(true)
 *   createdAt  DateTime @default(now())
 *   updatedAt  DateTime @updatedAt
 * }
 *
 * model Parent {
 *   id        String   @id @default(cuid())
 *   firstName String
 *   lastName  String
 *   email     String   @unique
 *   phone     String
 *   password  String   // bcrypt hash
 *   isActive  Boolean  @default(true)
 *   createdAt DateTime @default(now())
 *   orders    Order[]
 * }
 *
 * model Product {
 *   id            String        @id @default(cuid())
 *   name          String
 *   description   String?
 *   imageUrl      String?
 *   sellingPrice  Decimal       @db.Decimal(10,2)
 *   costPrice     Decimal       @db.Decimal(10,2)  // Admin only
 *   category      String?
 *   isActive      Boolean       @default(true)
 *   createdAt     DateTime      @default(now())
 *   updatedAt     DateTime      @updatedAt
 *   inventory     Inventory[]
 *   orderItems    OrderItem[]
 * }
 *
 * model Inventory {
 *   id           String  @id @default(cuid())
 *   productId    String
 *   size         Size    // T1 | T2 | T3 | T4 | T5
 *   totalQty     Int     @default(0)   // physical stock
 *   reservedQty  Int     @default(0)   // held for Submitted/Review orders
 *   // availableQty = totalQty - reservedQty (computed)
 *   updatedAt    DateTime @updatedAt
 *   product      Product @relation(fields:[productId], references:[id])
 *   @@unique([productId, size])
 * }
 *
 * model Location {
 *   id        String  @id @default(cuid())
 *   name      String
 *   isActive  Boolean @default(true)
 *   isDefault Boolean @default(false)
 *   sortOrder Int     @default(0)
 *   orders    Order[]
 * }
 *
 * model Order {
 *   id              String      @id @default(cuid())
 *   orderNumber     String      @unique  // e.g. WW-2047
 *   parentId        String
 *   parentName      String
 *   parentPhone     String
 *   childName       String
 *   childClass      String
 *   locationId      String
 *   notes           String?
 *   subtotal        Decimal     @db.Decimal(10,2)
 *   discountRate    Decimal     @db.Decimal(5,4)  // 0.15 or 0
 *   discountAmount  Decimal     @db.Decimal(10,2)
 *   totalAmount     Decimal     @db.Decimal(10,2)
 *   status          OrderStatus @default(SUBMITTED)
 *   createdAt       DateTime    @default(now())
 *   updatedAt       DateTime    @updatedAt
 *   parent          Parent      @relation(fields:[parentId], references:[id])
 *   location        Location    @relation(fields:[locationId], references:[id])
 *   items           OrderItem[]
 * }
 *
 * model OrderItem {
 *   id         String  @id @default(cuid())
 *   orderId    String
 *   productId  String
 *   productName String  // snapshot at time of order
 *   size       Size
 *   quantity   Int
 *   unitPrice  Decimal @db.Decimal(10,2)  // snapshot
 *   order      Order   @relation(fields:[orderId], references:[id])
 *   product    Product @relation(fields:[productId], references:[id])
 * }
 *
 * model SiteSettings {
 *   id               String  @id @default("singleton")
 *   systemName       String  @default("Wonderworld Uniforms")
 *   logoUrl          String?
 *   welcomeTitle     String  @default("Welcome to Wonderworld!")
 *   welcomeText      String?
 *   orderInstructions String?
 *   noticeText       String?
 *   discountThreshold Decimal @db.Decimal(10,2) @default(500)
 *   discountRate     Decimal @db.Decimal(5,4)   @default(0.15)
 *   updatedAt        DateTime @updatedAt
 * }
 *
 * model FormField {
 *   id         String  @id @default(cuid())
 *   label      String
 *   fieldKey   String  @unique
 *   fieldType  String  @default("text")  // text | select | textarea
 *   isRequired Boolean @default(true)
 *   isVisible  Boolean @default(true)
 *   sortOrder  Int     @default(0)
 *   isSystem   Boolean @default(false)  // core fields can't be deleted
 * }
 *
 * enum OrderStatus { SUBMITTED REVIEW READY_FOR_PICKUP PICKED_UP CANCELLED }
 * enum Size        { T1 T2 T3 T4 T5 }
 * enum AdminRole   { SUPER_ADMIN MANAGER STAFF }
 *
 * ============================================================
 * INVENTORY LOGIC
 * ============================================================
 * SUBMITTED  → reserve qty  (reservedQty += qty)
 * REVIEW     → keep reserved (no change)
 * READY      → deduct stock  (totalQty -= qty, reservedQty -= qty)
 * PICKED_UP  → no change     (already deducted at READY)
 * CANCELLED  → restore       (reservedQty -= qty OR totalQty += qty if deducted)
 * availableQty = totalQty - reservedQty  (always computed, never stored)
 *
 * ============================================================
 * API ROUTES (Express / Next.js)
 * ============================================================
 * POST /api/auth/parent/register
 * POST /api/auth/parent/login
 * POST /api/auth/admin/login
 *
 * GET  /api/products               (parent: no cost price)
 * GET  /api/products/:id
 * POST /api/admin/products         (admin only)
 * PUT  /api/admin/products/:id
 * DEL  /api/admin/products/:id
 *
 * GET  /api/inventory              (admin only)
 * PUT  /api/admin/inventory/:id
 *
 * POST /api/orders                 (parent)
 * GET  /api/orders/mine            (parent: own orders)
 * GET  /api/admin/orders           (admin: all, with filters)
 * GET  /api/admin/orders/:id
 * PUT  /api/admin/orders/:id/status
 * GET  /api/admin/orders/export    (CSV download)
 *
 * GET  /api/locations
 * POST /api/admin/locations
 * PUT  /api/admin/locations/:id
 * DEL  /api/admin/locations/:id
 *
 * GET  /api/settings
 * PUT  /api/admin/settings
 * GET  /api/admin/form-fields
 * PUT  /api/admin/form-fields
 *
 * GET  /api/admin/stats            (dashboard)
 * GET  /api/admin/inventory/export (CSV)
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  useReducer,
} from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

//const API_BASE_URL = "http://localhost:4000";

// ─── API HELPER ───────────────────────────────────────────────
// Attaches the JWT token from localStorage to every request.
// Usage: api("/api/products")  OR  api("/api/orders", { method:"POST", body:{...} })
async function api(path, { method = "GET", body, token } = {}) {
  //  const isFormData = options.body instanceof FormData;
  const storedToken = token || localStorage.getItem("ww_token");
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── DESIGN TOKENS ────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Quicksand:wght@500;600;700&display=swap');`;

// ─── MOCK DATA ─────────────────────────────────────────────────
const INITIAL_PRODUCTS = [
  {
    id: "p1",
    name: "Polo Shirt",
    description: "Breathable cotton polo in school colours.",
    imageEmoji: "👕",
    imageBg: "#e8f7f0",
    category: "Tops",
    sellingPrice: 45,
    costPrice: 22,
    sizes: ["T1", "T2", "T3", "T4", "T5"],
    isActive: true,
  },
  {
    id: "p2",
    name: "Shorts",
    description: "Comfortable elastic-waist shorts.",
    imageEmoji: "🩳",
    imageBg: "#e6f3fb",
    category: "Bottoms",
    sellingPrice: 38,
    costPrice: 18,
    sizes: ["T1", "T2", "T3", "T4"],
    isActive: true,
  },
  {
    id: "p3",
    name: "Pinafore Dress",
    description: "Classic pinafore, machine washable.",
    imageEmoji: "👗",
    imageBg: "#fef0eb",
    category: "Bottoms",
    sellingPrice: 55,
    costPrice: 28,
    sizes: ["T2", "T3", "T4", "T5"],
    isActive: true,
  },
  {
    id: "p4",
    name: "School Jacket",
    description: "Warm fleece-lined jacket with logo.",
    imageEmoji: "🧥",
    imageBg: "#f0eeff",
    category: "Tops",
    sellingPrice: 78,
    costPrice: 41,
    sizes: ["T3", "T4", "T5"],
    isActive: true,
  },
  {
    id: "p5",
    name: "Socks (3-pack)",
    description: "White ankle socks, pack of 3 pairs.",
    imageEmoji: "🧦",
    imageBg: "#fdfae7",
    category: "Accessories",
    sellingPrice: 18,
    costPrice: 7,
    sizes: ["T1", "T2", "T3"],
    isActive: true,
  },
  {
    id: "p6",
    name: "School Backpack",
    description: "Durable backpack with name tag slot.",
    imageEmoji: "🎒",
    imageBg: "#e6f3fb",
    category: "Accessories",
    sellingPrice: 65,
    costPrice: 32,
    sizes: ["T1", "T2", "T3", "T4", "T5"],
    isActive: true,
  },
];

const INITIAL_INVENTORY = {
  p1: {
    T1: { total: 60, reserved: 5 },
    T2: { total: 55, reserved: 8 },
    T3: { total: 50, reserved: 12 },
    T4: { total: 40, reserved: 8 },
    T5: { total: 30, reserved: 3 },
  },
  p2: {
    T1: { total: 40, reserved: 6 },
    T2: { total: 45, reserved: 10 },
    T3: { total: 35, reserved: 15 },
    T4: { total: 30, reserved: 7 },
  },
  p3: {
    T2: { total: 25, reserved: 4 },
    T3: { total: 30, reserved: 9 },
    T4: { total: 30, reserved: 6 },
    T5: { total: 20, reserved: 2 },
  },
  p4: {
    T3: { total: 20, reserved: 3 },
    T4: { total: 20, reserved: 2 },
    T5: { total: 15, reserved: 1 },
  },
  p5: {
    T1: { total: 80, reserved: 10 },
    T2: { total: 70, reserved: 8 },
    T3: { total: 60, reserved: 5 },
  },
  p6: {
    T1: { total: 30, reserved: 2 },
    T2: { total: 30, reserved: 4 },
    T3: { total: 25, reserved: 3 },
    T4: { total: 20, reserved: 2 },
    T5: { total: 15, reserved: 1 },
  },
};

const INITIAL_LOCATIONS = [
  {
    id: "loc1",
    name: "Main Campus — Vancouver",
    isDefault: true,
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "loc2",
    name: "North Campus — Burnaby",
    isDefault: false,
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "loc3",
    name: "West Campus — Richmond",
    isDefault: false,
    isActive: true,
    sortOrder: 3,
  },
];

const INITIAL_ORDERS = [
  {
    id: "o1",
    orderNumber: "WW-2047",
    parentId: "par1",
    parentName: "Sarah Chen",
    parentPhone: "604-555-0100",
    childName: "Emma Chen",
    childClass: "Sunshine K2",
    locationId: "loc1",
    notes: "",
    subtotal: 542,
    discountRate: 0.15,
    discountAmount: 81.3,
    totalAmount: 460.7,
    status: "READY_FOR_PICKUP",
    createdAt: "2026-04-14",
    items: [
      {
        productId: "p1",
        productName: "Polo Shirt",
        size: "T3",
        quantity: 2,
        unitPrice: 45,
      },
      {
        productId: "p2",
        productName: "Shorts",
        size: "T3",
        quantity: 2,
        unitPrice: 38,
      },
      {
        productId: "p3",
        productName: "Pinafore Dress",
        size: "T4",
        quantity: 4,
        unitPrice: 55,
      },
      {
        productId: "p4",
        productName: "School Jacket",
        size: "T4",
        quantity: 2,
        unitPrice: 78,
      },
    ],
  },
  {
    id: "o2",
    orderNumber: "WW-2046",
    parentId: "par2",
    parentName: "James Park",
    parentPhone: "778-555-0211",
    childName: "Liam Park",
    childClass: "Rainbow K1",
    locationId: "loc2",
    notes: "",
    subtotal: 121,
    discountRate: 0,
    discountAmount: 0,
    totalAmount: 121,
    status: "SUBMITTED",
    createdAt: "2026-04-13",
    items: [
      {
        productId: "p1",
        productName: "Polo Shirt",
        size: "T2",
        quantity: 2,
        unitPrice: 45,
      },
      {
        productId: "p5",
        productName: "Socks (3-pack)",
        size: "T2",
        quantity: 1,
        unitPrice: 18,
      },
      {
        productId: "p6",
        productName: "School Backpack",
        size: "T2",
        quantity: 1,
        unitPrice: 65,
      },
    ],
  },
  {
    id: "o3",
    orderNumber: "WW-2045",
    parentId: "par3",
    parentName: "Kelly Johnson",
    parentPhone: "604-555-0322",
    childName: "Mia Johnson",
    childClass: "Stars K3",
    locationId: "loc3",
    notes: "",
    subtotal: 382,
    discountRate: 0,
    discountAmount: 0,
    totalAmount: 382,
    status: "REVIEW",
    createdAt: "2026-04-10",
    items: [
      {
        productId: "p3",
        productName: "Pinafore Dress",
        size: "T3",
        quantity: 4,
        unitPrice: 55,
      },
      {
        productId: "p4",
        productName: "School Jacket",
        size: "T3",
        quantity: 2,
        unitPrice: 78,
      },
      {
        productId: "p6",
        productName: "School Backpack",
        size: "T3",
        quantity: 1,
        unitPrice: 65,
      },
      {
        productId: "p5",
        productName: "Socks (3-pack)",
        size: "T3",
        quantity: 3,
        unitPrice: 18,
      },
    ],
  },
  {
    id: "o4",
    orderNumber: "WW-2044",
    parentId: "par4",
    parentName: "Anne Williams",
    parentPhone: "604-555-0433",
    childName: "Noah Williams",
    childClass: "Rainbow K1",
    locationId: "loc1",
    notes: "",
    subtotal: 90,
    discountRate: 0,
    discountAmount: 0,
    totalAmount: 90,
    status: "PICKED_UP",
    createdAt: "2026-03-28",
    items: [
      {
        productId: "p1",
        productName: "Polo Shirt",
        size: "T4",
        quantity: 2,
        unitPrice: 45,
      },
    ],
  },
  {
    id: "o5",
    orderNumber: "WW-2031",
    parentId: "par1",
    parentName: "Sarah Chen",
    parentPhone: "604-555-0100",
    childName: "Emma Chen",
    childClass: "Sunshine K2",
    locationId: "loc1",
    notes: "",
    subtotal: 101,
    discountRate: 0,
    discountAmount: 0,
    totalAmount: 101,
    status: "PICKED_UP",
    createdAt: "2026-03-28",
    items: [
      {
        productId: "p5",
        productName: "Socks (3-pack)",
        size: "T3",
        quantity: 2,
        unitPrice: 18,
      },
      {
        productId: "p6",
        productName: "School Backpack",
        size: "T3",
        quantity: 1,
        unitPrice: 65,
      },
    ],
  },
];

const INITIAL_SETTINGS = {
  systemName: "Wonderworld Uniforms",
  welcomeTitle: "Welcome to Wonderworld! 🌈",
  welcomeText:
    "Browse and order your child's school uniforms easily online. Orders are processed within 2–3 business days.",
  orderInstructions:
    "Please fill in all required fields accurately. Our team will review your order and update the status shortly.",
  noticeText: "Orders of $500 or more receive an automatic 15% discount!",
  discountThreshold: 500,
  discountRate: 0.15,
  logoEmoji: "🎒",
};

const INITIAL_FORM_FIELDS = [
  {
    id: "ff1",
    label: "Child's Name",
    fieldKey: "childName",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 1,
  },
  {
    id: "ff2",
    label: "Class",
    fieldKey: "childClass",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 2,
  },
  {
    id: "ff3",
    label: "Parent Name",
    fieldKey: "parentName",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 3,
  },
  {
    id: "ff4",
    label: "Phone Number",
    fieldKey: "parentPhone",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 4,
  },
  {
    id: "ff5",
    label: "School Location",
    fieldKey: "locationId",
    isRequired: true,
    isVisible: true,
    isSystem: true,
    sortOrder: 5,
  },
  {
    id: "ff6",
    label: "Notes / Special Requests",
    fieldKey: "notes",
    isRequired: false,
    isVisible: true,
    isSystem: false,
    sortOrder: 6,
  },
  {
    id: "ff7",
    label: "Teacher's Name",
    fieldKey: "teacherName",
    isRequired: false,
    isVisible: false,
    isSystem: false,
    sortOrder: 7,
  },
];

const PARENT_USER = {
  id: "par1",
  firstName: "Sarah",
  lastName: "Chen",
  email: "sarah@example.com",
  phone: "604-555-0100",
};
const ADMIN_USER = {
  id: "adm1",
  name: "Principal Wang",
  email: "wang@wonderworld.edu",
  role: "SUPER_ADMIN",
};

const STATUS_LABELS = {
  SUBMITTED: "Submitted",
  REVIEW: "Review",
  READY_FOR_PICKUP: "Ready for Pick Up",
  PICKED_UP: "Picked Up",
  CANCELLED: "Cancelled",
};
const STATUS_COLORS = {
  SUBMITTED: "#e6f3fb:#1a5f8a",
  REVIEW: "#fdfae7:#8a6e0a",
  READY_FOR_PICKUP: "#e8f7f0:#1a7a55",
  PICKED_UP: "#e8f7e8:#1a7a1a",
  CANCELLED: "#fef0eb:#a83d1e",
};

// ─── CONTEXT ──────────────────────────────────────────────────
const AppCtx = createContext(null);
function useApp() {
  return useContext(AppCtx);
}

// ─── GLOBAL STYLES ────────────────────────────────────────────
const GLOBAL_CSS = `
${FONTS}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --mint:#e8f7f0; --mint-mid:#3db882; --mint-dark:#1a7a55;
  --sky:#e6f3fb;  --sky-mid:#4da8da;  --sky-dark:#1a5f8a;
  --peach:#fef0eb;--peach-mid:#f5845a;--peach-dark:#a83d1e;
  --lemon:#fdfae7;--lemon-mid:#e8c83a;--lemon-dark:#8a6e0a;
  --purple:#f0eeff;--purple-mid:#8b72e8;--purple-dark:#4a2db5;
  --bg:#ffffff; --bg2:#f7f8fa; --bg3:#eef0f4;
  --border:#e2e5ea; --border2:#c8cdd6;
  --text:#1a1d23; --text2:#5a6072; --text3:#9198a8;
  --radius:12px; --radius-sm:8px; --radius-xs:5px;
  --shadow:0 2px 8px rgba(0,0,0,.07);
  --shadow-lg:0 8px 24px rgba(0,0,0,.10);
  --font-display:'Quicksand',sans-serif;
  --font-body:'Nunito',sans-serif;
}
body { font-family:var(--font-body); color:var(--text); background:var(--bg2); min-height:100vh; }
button { cursor:pointer; font-family:var(--font-body); }
input,select,textarea { font-family:var(--font-body); }
::-webkit-scrollbar { width:5px; height:5px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--border2); border-radius:10px; }
@keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none} }
@keyframes slideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:none} }
@keyframes popIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
.animate-fade { animation:fadeIn .25s ease both; }
.animate-slide { animation:slideIn .2s ease both; }
.animate-pop  { animation:popIn .2s ease both; }
`;

// ─── SHARED COMPONENTS ────────────────────────────────────────
function Btn({
  children,
  variant = "primary",
  size = "md",
  onClick,
  style = {},
  disabled = false,
  fullWidth = false,
}) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: "var(--radius-sm)",
    transition: "all .15s",
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? "100%" : "auto",
  };
  const sizes = {
    sm: { padding: "5px 12px", fontSize: 11 },
    md: { padding: "9px 18px", fontSize: 13 },
    lg: { padding: "12px 24px", fontSize: 15 },
  };
  const variants = {
    primary: { background: "var(--mint-dark)", color: "#fff" },
    admin: { background: "var(--sky-dark)", color: "#fff" },
    danger: { background: "var(--peach-dark)", color: "#fff" },
    ghost: {
      background: "transparent",
      color: "var(--text2)",
      border: "1px solid var(--border)",
    },
    soft: { background: "var(--mint)", color: "var(--mint-dark)" },
    softBlue: { background: "var(--sky)", color: "var(--sky-dark)" },
    softRed: { background: "var(--peach)", color: "var(--peach-dark)" },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  options = null,
  rows = 2,
  style = {},
}) {
  const field = options ? (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        fontSize: 13,
        background: "var(--bg)",
        color: "var(--text)",
        outline: "none",
      }}
    >
      <option value="">— Select —</option>
      {options.map((o) => (
        <option key={o.value || o} value={o.value || o}>
          {o.label || o}
        </option>
      ))}
    </select>
  ) : type === "textarea" ? (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        fontSize: 13,
        resize: "vertical",
        background: "var(--bg)",
        color: "var(--text)",
        outline: "none",
      }}
    />
  ) : (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "9px 12px",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        fontSize: 13,
        background: "var(--bg)",
        color: "var(--text)",
        outline: "none",
      }}
    />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      {label && (
        <label
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text2)",
            letterSpacing: ".04em",
          }}
        >
          {label}
          {required && <span style={{ color: "var(--peach-dark)" }}> *</span>}
        </label>
      )}
      {field}
    </div>
  );
}

function Badge({ status }) {
  const [bg, col] = (STATUS_COLORS[status] || "#eef0f4:#5a6072").split(":");
  return (
    <span
      style={{
        background: bg,
        color: col,
        padding: "3px 10px",
        borderRadius: 30,
        fontSize: 10,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 16,
        boxShadow: "var(--shadow)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Modal({ children, onClose, title, width = 480 }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        // background: "rgba(0,0,0,.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        marginTop: 250,
      }}
      onClick={onClose}
    >
      <div
        className="animate-pop"
        style={{
          background: "var(--bg)",
          borderRadius: "var(--radius)",
          padding: 24,
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 17,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              color: "var(--text3)",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label
      style={{
        position: "relative",
        display: "inline-block",
        width: 38,
        height: 20,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          position: "absolute",
          cursor: "pointer",
          inset: 0,
          background: checked ? "var(--mint-dark)" : "var(--border2)",
          borderRadius: 10,
          transition: ".3s",
        }}
      >
        <span
          style={{
            position: "absolute",
            content: "''",
            width: 16,
            height: 16,
            left: 2,
            top: 2,
            background: "#fff",
            borderRadius: "50%",
            transition: ".3s",
            transform: checked ? "translateX(18px)" : "none",
          }}
        />
      </span>
    </label>
  );
}

function StatCard({ label, value, sub, color = "var(--mint-dark)" }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "14px 16px",
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: "var(--text3)",
          letterSpacing: ".06em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          color,
          fontFamily: "var(--font-display)",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 3 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 17,
          color: "var(--text)",
        }}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

function EmptyState({ emoji, message }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "40px 20px",
        color: "var(--text3)",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 8 }}>{emoji}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{message}</div>
    </div>
  );
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="animate-fade"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "var(--mint-dark)",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: "var(--radius-sm)",
        fontSize: 13,
        fontWeight: 700,
        boxShadow: "var(--shadow-lg)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      ✅ {message}
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "rgba(255,255,255,.7)",
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── APP STATE REDUCER ────────────────────────────────────────
function appReducer(state, action) {
  switch (action.type) {
    case "SET_VIEW":
      return {
        ...state,
        view: action.view,
        adminPage: action.adminPage || state.adminPage,
        parentPage: action.parentPage || state.parentPage,
      };
    case "SET_PARENT_PAGE":
      return { ...state, parentPage: action.page };
    case "SET_ADMIN_PAGE":
      return { ...state, adminPage: action.page };
    case "LOGIN":
      return {
        ...state,
        currentUser: action.user,
        userRole: action.role,
        parentPage: "home",
      };
    case "LOGOUT":
      localStorage.removeItem("ww_token");
      localStorage.removeItem("ww_role");
      return {
        ...state,
        currentUser: null,
        userRole: null,
        parentPage: "login",
        adminPage: "dashboard",
        cart: [],
      };
    case "ADD_TO_CART": {
      const existing = state.cart.findIndex(
        (i) =>
          i.productId === action.item.productId && i.size === action.item.size,
      );
      if (existing >= 0) {
        const cart = [...state.cart];
        cart[existing] = {
          ...cart[existing],
          quantity: cart[existing].quantity + action.item.quantity,
        };
        return { ...state, cart };
      }
      return { ...state, cart: [...state.cart, action.item] };
    }
    case "REMOVE_FROM_CART":
      return {
        ...state,
        cart: state.cart.filter((_, i) => i !== action.index),
      };
    case "UPDATE_CART_QTY": {
      const cart = [...state.cart];
      cart[action.index] = { ...cart[action.index], quantity: action.qty };
      return { ...state, cart };
    }
    case "CLEAR_CART":
      return { ...state, cart: [] };
    case "ADD_ORDER":
      return { ...state, orders: [action.order, ...state.orders] };
    case "UPDATE_ORDER_STATUS":
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.id
            ? {
                ...o,
                status: action.status,
                updatedAt: new Date().toISOString(),
              }
            : o,
        ),
      };
    case "ADD_PRODUCT":
      return { ...state, products: [...state.products, action.product] };
    case "UPDATE_PRODUCT":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.product.id ? action.product : p,
        ),
      };
    case "DELETE_PRODUCT":
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.id),
      };
    case "UPDATE_INVENTORY":
      return {
        ...state,
        inventory: {
          ...state.inventory,
          [action.productId]: {
            ...state.inventory[action.productId],
            [action.size]: action.inv,
          },
        },
      };
    case "ADD_LOCATION":
      return { ...state, locations: [...state.locations, action.location] };
    case "UPDATE_LOCATION":
      return {
        ...state,
        locations: state.locations.map((l) =>
          l.id === action.location.id ? action.location : l,
        ),
      };
    case "DELETE_LOCATION":
      return {
        ...state,
        locations: state.locations.filter((l) => l.id !== action.id),
      };
    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.settings } };
    case "UPDATE_FORM_FIELDS":
      return { ...state, formFields: action.fields };
    case "SET_TOAST":
      return { ...state, toast: action.message };
    case "CLEAR_TOAST":
      return { ...state, toast: null };
    case "SET_PRODUCT_DETAIL":
      return { ...state, productDetail: action.product };
    case "SET_INITIAL_DATA": {
      try {
        const { products, locations, settings, formFields } = action.payload;
        return {
          ...state,
          ...(products ? { products } : {}),
          ...(locations ? { locations } : {}),
          ...(settings ? { settings } : {}),
          ...(formFields ? { formFields } : {}),
        };
      } catch (e) {
        return state;
      }
    }
    case "SET_ORDERS":
      return { ...state, orders: action.orders };
    case "SET_INVENTORY":
      return { ...state, inventory: action.inventory };
    case "SET_ADMIN_ACCOUNTS":
      return { ...state, adminAccounts: action.accounts };

    default:
      return state;
  }
}

const INITIAL_STATE = {
  view: "parent",
  parentPage: "login",
  adminPage: "dashboard",
  currentUser: null,
  userRole: null,
  cart: [],
  products: INITIAL_PRODUCTS,
  inventory: INITIAL_INVENTORY,
  orders: INITIAL_ORDERS,
  locations: [],
  settings: INITIAL_SETTINGS,
  formFields: INITIAL_FORM_FIELDS,
  adminAccounts: [],
  toast: null,
  productDetail: null,
};

// ══════════════════════════════════════════════════════════════
//  PARENT SCREENS
// ══════════════════════════════════════════════════════════════

function ParentLogin() {
  const { dispatch, state } = useApp();
  const [email, setEmail] = useState("sarah@example.com");
  const [pass, setPass] = useState("password123");
  const [isReg, setIsReg] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });

  async function handleLogin() {
    if (!email || !pass) {
      dispatch({
        type: "SET_TOAST",
        message: "Please fill in email and password",
      });
      return;
    }
    try {
      const data = await api("/api/auth/parent/login", {
        method: "POST",
        body: { email, password: pass },
      });
      localStorage.setItem("ww_token", data.token);
      localStorage.setItem("ww_role", "parent");
      dispatch({ type: "LOGIN", user: data.parent, role: "parent" });
      dispatch({ type: "SET_PARENT_PAGE", page: "home" });
    } catch (err) {
      dispatch({ type: "SET_TOAST", message: err.message || "Login failed" });
    }
  }
  async function handleRegister() {
    if (!form.firstName || !form.email || !form.password) {
      dispatch({
        type: "SET_TOAST",
        message: "Please fill in all required fields",
      });
      return;
    }
    try {
      const data = await api("/api/auth/parent/register", {
        method: "POST",
        body: form,
      });
      localStorage.setItem("ww_token", data.token);
      localStorage.setItem("ww_role", "parent");
      dispatch({ type: "LOGIN", user: data.parent, role: "parent" });
      dispatch({ type: "SET_PARENT_PAGE", page: "home" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Registration failed",
      });
    }
  }
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,var(--mint) 0%,var(--sky) 100%)",
        padding: 16,
      }}
    >
      <div
        className="animate-pop"
        style={{
          background: "var(--bg)",
          borderRadius: "var(--radius)",
          padding: 32,
          width: "100%",
          maxWidth: 380,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "var(--mint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              margin: "0 auto 12px",
            }}
          >
            {state.settings.logoEmoji}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 20,
              color: "var(--mint-dark)",
            }}
          >
            {state.settings.systemName}
          </h1>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>
            {isReg ? "Create your parent account" : "Parent Portal"}
          </p>
        </div>
        {!isReg ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="parent@email.com"
              required
            />
            <Input
              label="Password"
              value={pass}
              onChange={setPass}
              type="password"
              placeholder="••••••••"
              required
            />
            <Btn
              onClick={handleLogin}
              fullWidth
              size="lg"
              style={{ marginTop: 4 }}
            >
              Log In
            </Btn>
            <p
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "var(--text3)",
              }}
            >
              New to Wonderworld?{" "}
              <button
                onClick={() => setIsReg(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--sky-dark)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Register here
              </button>
            </p>
            <div
              style={{
                borderTop: "1px dashed var(--border)",
                paddingTop: 12,
                textAlign: "center",
              }}
            >
              <button
                onClick={async () => {
                  try {
                    const data = await api("/api/auth/admin/login", {
                      method: "POST",
                      body: {
                        email: "wang@wonderworld.edu",
                        password: "adminpass",
                      },
                    });
                    localStorage.setItem("ww_token", data.token);
                    localStorage.setItem("ww_role", "admin");
                    dispatch({
                      type: "LOGIN",
                      user: data.admin,
                      role: "admin",
                    });
                    dispatch({
                      type: "SET_VIEW",
                      view: "admin",
                      adminPage: "dashboard",
                    });
                  } catch (err) {
                    dispatch({
                      type: "SET_TOAST",
                      message: err.message || "Admin login failed",
                    });
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text3)",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Admin Login →
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <Input
                label="First Name"
                value={form.firstName}
                onChange={(v) => setForm({ ...form, firstName: v })}
                placeholder="Sarah"
                required
              />
              <Input
                label="Last Name"
                value={form.lastName}
                onChange={(v) => setForm({ ...form, lastName: v })}
                placeholder="Chen"
              />
            </div>
            <Input
              label="Email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              type="email"
              placeholder="email@example.com"
              required
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              placeholder="604-555-0100"
            />
            <Input
              label="Password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              type="password"
              placeholder="Create a password"
              required
            />
            <Btn
              onClick={handleRegister}
              fullWidth
              size="lg"
              style={{ marginTop: 4 }}
            >
              Create Account
            </Btn>
            <p
              style={{
                textAlign: "center",
                fontSize: 12,
                color: "var(--text3)",
              }}
            >
              Already registered?{" "}
              <button
                onClick={() => setIsReg(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--sky-dark)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Log in
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ParentHome() {
  const { state, dispatch } = useApp();
  const [cat, setCat] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [addSize, setAddSize] = useState("");
  const [addQty, setAddQty] = useState(1);
  const cats = ["All", "Tops", "Bottoms", "Accessories"];
  const filtered = state.products.filter(
    (p) => p.isActive && (cat === "All" || p.category === cat),
  );

  function handleAddToCart() {
    if (!addSize) {
      dispatch({ type: "SET_TOAST", message: "Please select a size" });
      return;
    }
    dispatch({
      type: "ADD_TO_CART",
      item: {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        size: addSize,
        quantity: addQty,
        unitPrice: selectedProduct.sellingPrice,
        imageEmoji: selectedProduct.imageEmoji,
        imageBg: selectedProduct.imageBg,
      },
    });
    dispatch({
      type: "SET_TOAST",
      message: `${selectedProduct.name} (${addSize}) added to cart!`,
    });
    setSelectedProduct(null);
    setAddSize("");
    setAddQty(1);
  }

  return (
    <div className="animate-fade">
      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(135deg,var(--mint) 0%,var(--sky) 100%)",
          borderRadius: "var(--radius)",
          padding: "20px 22px",
          marginBottom: 16,
          border: "1px solid rgba(61,184,130,.25)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 20,
            color: "var(--mint-dark)",
            marginBottom: 4,
          }}
        >
          {state.settings.welcomeTitle}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
          {state.settings.welcomeText}
        </p>
        {state.settings.noticeText && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--mint-dark)",
              color: "#fff",
              padding: "5px 14px",
              borderRadius: 30,
              fontSize: 11,
              fontWeight: 700,
              marginTop: 10,
            }}
          >
            🎉 {state.settings.noticeText}
          </div>
        )}
      </div>
      {/* Categories */}
      <div
        style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}
      >
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            style={{
              padding: "6px 14px",
              borderRadius: 30,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              border: "1.5px solid",
              borderColor: cat === c ? "var(--mint-dark)" : "var(--border)",
              background: cat === c ? "var(--mint-dark)" : "var(--bg)",
              color: cat === c ? "#fff" : "var(--text2)",
              transition: "all .15s",
            }}
          >
            {c}
          </button>
        ))}
      </div>
      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))",
          gap: 12,
        }}
      >
        {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => {
              setSelectedProduct(p);
              setAddSize("");
              setAddQty(1);
            }}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
              cursor: "pointer",
              transition: "all .2s",
              boxShadow: "var(--shadow)",
            }}
          >
            <div
              style={{
                height: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                background: p.imageBg,
              }}
            >
              {p.imageEmoji}
            </div>
            <div style={{ padding: "10px 12px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                {p.name}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--mint-dark)",
                  fontWeight: 800,
                }}
              >
                ${p.sellingPrice.toFixed(2)}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 3,
                  flexWrap: "wrap",
                  marginTop: 6,
                }}
              >
                {p.sizes.map((s) => (
                  <span
                    key={s}
                    style={{
                      background: "var(--bg2)",
                      border: "0.5px solid var(--border)",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 5px",
                      color: "var(--text3)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <EmptyState emoji="👕" message="No products in this category" />
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <Modal
          title={selectedProduct.name}
          onClose={() => setSelectedProduct(null)}
        >
          <div
            style={{
              height: 140,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 60,
              background: selectedProduct.imageBg,
              borderRadius: "var(--radius-sm)",
              marginBottom: 14,
            }}
          >
            {selectedProduct.imageEmoji}
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text2)",
              marginBottom: 14,
              lineHeight: 1.6,
            }}
          >
            {selectedProduct.description}
          </p>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "var(--mint-dark)",
              fontFamily: "var(--font-display)",
              marginBottom: 14,
            }}
          >
            ${selectedProduct.sellingPrice.toFixed(2)}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            {selectedProduct.sizes.map((s) => (
              <button
                key={s}
                onClick={() => setAddSize(s)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  border: "2px solid",
                  borderColor:
                    addSize === s ? "var(--mint-dark)" : "var(--border)",
                  background: addSize === s ? "var(--mint)" : "var(--bg)",
                  color: addSize === s ? "var(--mint-dark)" : "var(--text2)",
                  transition: "all .15s",
                }}
              >
                {s}{" "}
                <span style={{ fontSize: 10, opacity: 0.7 }}>
                  Age {s.replace("T", "")}
                </span>
              </button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <span
              style={{ fontSize: 12, fontWeight: 700, color: "var(--text2)" }}
            >
              Quantity:
            </span>
            <button
              onClick={() => setAddQty(Math.max(1, addQty - 1))}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              −
            </button>
            <span
              style={{
                fontWeight: 800,
                fontSize: 16,
                minWidth: 24,
                textAlign: "center",
              }}
            >
              {addQty}
            </span>
            <button
              onClick={() => setAddQty(addQty + 1)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              +
            </button>
            <span
              style={{
                marginLeft: "auto",
                fontWeight: 800,
                fontSize: 16,
                color: "var(--mint-dark)",
              }}
            >
              ${(selectedProduct.sellingPrice * addQty).toFixed(2)}
            </span>
          </div>
          <Btn onClick={handleAddToCart} fullWidth size="lg">
            Add to Cart 🛒
          </Btn>
        </Modal>
      )}
    </div>
  );
}

function ParentCart() {
  const { state, dispatch } = useApp();
  const { cart, locations, settings, formFields } = state;
  const [form, setForm] = useState({
    childName: "",
    childClass: "",
    parentName:
      state.currentUser?.firstName + " " + state.currentUser?.lastName || "",
    parentPhone: state.currentUser?.phone || "",
    locationId: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const threshold = settings.discountThreshold;
  const discountRate = subtotal >= threshold ? settings.discountRate : 0;
  const discountAmount = subtotal * discountRate;
  const total = subtotal - discountAmount;

  const visibleFields = formFields.filter((f) => f.isVisible);

  async function handleSubmit() {
    const required = visibleFields.filter((f) => f.isRequired);
    for (const f of required) {
      if (!form[f.fieldKey]) {
        dispatch({ type: "SET_TOAST", message: `Please fill in: ${f.label}` });
        return;
      }
    }
    if (cart.length === 0) {
      dispatch({ type: "SET_TOAST", message: "Your cart is empty" });
      return;
    }
    try {
      const newOrder = await api("/api/orders", {
        method: "POST",
        body: {
          ...form,
          items: cart.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            size: i.size,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      });
      dispatch({ type: "ADD_ORDER", order: newOrder });
      dispatch({ type: "CLEAR_CART" });
      dispatch({ type: "SET_TOAST", message: "Order submitted successfully!" });
      setSubmitted(true);
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to submit order",
      });
    }
  }

  if (submitted)
    return (
      <div
        className="animate-fade"
        style={{ textAlign: "center", padding: "60px 20px" }}
      >
        <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 22,
            color: "var(--mint-dark)",
            marginBottom: 8,
          }}
        >
          Order Submitted!
        </h2>
        <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 24 }}>
          Your order has been received. We'll update you when it's ready.
        </p>
        <Btn
          onClick={() => {
            setSubmitted(false);
            dispatch({ type: "SET_PARENT_PAGE", page: "orders" });
          }}
        >
          View My Orders
        </Btn>
      </div>
    );

  if (cart.length === 0)
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 60, marginBottom: 12 }}>🛒</div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 18,
            marginBottom: 8,
          }}
        >
          Your cart is empty
        </h2>
        <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>
          Browse the product list to add items.
        </p>
        <Btn
          onClick={() => dispatch({ type: "SET_PARENT_PAGE", page: "home" })}
        >
          Browse Products
        </Btn>
      </div>
    );

  return (
    <div
      className="animate-fade"
      style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}
    >
      {/* Cart Items */}
      <Card>
        <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          Cart Items ({cart.length})
        </h3>
        {cart.map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: item.imageBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                flexShrink: 0,
              }}
            >
              {item.imageEmoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {item.productName}
              </div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>
                Size {item.size} · Age {item.size.replace("T", "")}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() =>
                  item.quantity > 1
                    ? dispatch({
                        type: "UPDATE_CART_QTY",
                        index: i,
                        qty: item.quantity - 1,
                      })
                    : dispatch({ type: "REMOVE_FROM_CART", index: i })
                }
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                −
              </button>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  minWidth: 16,
                  textAlign: "center",
                }}
              >
                {item.quantity}
              </span>
              <button
                onClick={() =>
                  dispatch({
                    type: "UPDATE_CART_QTY",
                    index: i,
                    qty: item.quantity + 1,
                  })
                }
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                +
              </button>
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                color: "var(--mint-dark)",
                minWidth: 56,
                textAlign: "right",
              }}
            >
              ${(item.unitPrice * item.quantity).toFixed(2)}
            </div>
            <button
              onClick={() => dispatch({ type: "REMOVE_FROM_CART", index: i })}
              style={{
                background: "none",
                border: "none",
                color: "var(--peach-dark)",
                cursor: "pointer",
                fontSize: 16,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>
        ))}
        {/* Totals */}
        <div
          style={{
            background: subtotal >= threshold ? "var(--lemon)" : "var(--bg2)",
            border: `1px solid ${subtotal >= threshold ? "var(--lemon-mid)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            padding: 12,
            marginTop: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            <span style={{ color: "var(--text2)" }}>Subtotal</span>
            <span style={{ fontWeight: 700 }}>${subtotal.toFixed(2)}</span>
          </div>
          {discountRate > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  marginBottom: 4,
                  alignItems: "center",
                }}
              >
                <span style={{ color: "var(--text2)" }}>
                  Discount{" "}
                  <span
                    style={{
                      background: "var(--peach-mid)",
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 30,
                      marginLeft: 4,
                    }}
                  >
                    15% OFF — Order ≥ ${threshold}
                  </span>
                </span>
                <span style={{ color: "var(--peach-dark)", fontWeight: 700 }}>
                  −${discountAmount.toFixed(2)}
                </span>
              </div>
            </>
          )}
          {subtotal > 0 && subtotal < threshold && (
            <div
              style={{
                fontSize: 11,
                color: "var(--lemon-dark)",
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              💡 Add ${(threshold - subtotal).toFixed(2)} more to unlock 15%
              off!
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 16,
              fontWeight: 900,
              color: "var(--mint-dark)",
              paddingTop: 8,
              borderTop: "1px solid var(--border2)",
              marginTop: 4,
              fontFamily: "var(--font-display)",
            }}
          >
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {/* Order Form */}
      <Card>
        <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
          Delivery Details
        </h3>
        {state.settings.orderInstructions && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text2)",
              background: "var(--bg2)",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            {state.settings.orderInstructions}
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 10,
          }}
        >
          {visibleFields
            .filter((f) =>
              ["childName", "childClass", "parentName", "parentPhone"].includes(
                f.fieldKey,
              ),
            )
            .map((f) => (
              <Input
                key={f.fieldKey}
                label={f.label}
                value={form[f.fieldKey] || ""}
                onChange={(v) => setForm({ ...form, [f.fieldKey]: v })}
                required={f.isRequired}
                placeholder={`Enter ${f.label.toLowerCase()}`}
              />
            ))}
        </div>
        {visibleFields
          .filter((f) => f.fieldKey === "locationId")
          .map((f) => (
            <Input
              key={f.fieldKey}
              label={f.label}
              value={form.locationId}
              onChange={(v) => setForm({ ...form, locationId: v })}
              required={f.isRequired}
              options={locations
                .filter((l) => l.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((l) => ({ value: l.id, label: l.name }))}
              style={{ marginBottom: 10 }}
            />
          ))}
        {visibleFields
          .filter(
            (f) =>
              ![
                "childName",
                "childClass",
                "parentName",
                "parentPhone",
                "locationId",
              ].includes(f.fieldKey),
          )
          .map((f) => (
            <Input
              key={f.fieldKey}
              label={f.label}
              value={form[f.fieldKey] || ""}
              onChange={(v) => setForm({ ...form, [f.fieldKey]: v })}
              required={f.isRequired}
              type="textarea"
              placeholder="Optional…"
              style={{ marginBottom: 10 }}
            />
          ))}
        <Btn
          onClick={handleSubmit}
          fullWidth
          size="lg"
          style={{ marginTop: 6 }}
        >
          Submit Order 🎉
        </Btn>
      </Card>
    </div>
  );
}

function ParentOrders() {
  const { state, dispatch } = useApp();
  const [myOrders, setMyOrders] = useState(
    state.orders.filter((o) => o.parentId === state.currentUser?.id),
  );
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const orders = await api("/api/orders/mine");
        setMyOrders(orders);
        dispatch({ type: "SET_ORDERS", orders });
      } catch (err) {
        // fall back to local state
        setMyOrders(
          state.orders.filter((o) => o.parentId === state.currentUser?.id),
        );
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>
        Loading orders…
      </div>
    );

  if (myOrders.length === 0)
    return (
      <EmptyState
        emoji="📋"
        message="No orders yet — place your first order!"
      />
    );

  return (
    <div className="animate-fade">
      <SectionTitle>My Orders</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {myOrders.map((o) => (
          <Card
            key={o.id}
            style={{ cursor: "pointer", transition: "box-shadow .2s" }}
            onClick={() => setDetail(o)}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span
                style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)" }}
              >
                {o.orderNumber} · {o.createdAt}
              </span>
              <Badge status={o.status} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
              {o.childName} · {o.childClass}
            </div>
            <div
              style={{ fontSize: 12, color: "var(--text3)", marginBottom: 6 }}
            >
              {o.items
                .map((i) => `${i.productName} ${i.size} ×${i.quantity}`)
                .join(", ")}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--mint-dark)",
                }}
              >
                ${o.totalAmount.toFixed(2)}
              </span>
              {o.discountRate > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--peach-dark)",
                    fontWeight: 700,
                  }}
                >
                  15% discount applied
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>
      {detail && (
        <Modal
          title={`Order ${detail.orderNumber}`}
          onClose={() => setDetail(null)}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Badge status={detail.status} />
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              {detail.createdAt}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
              fontSize: 12,
            }}
          >
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 1 }}>
                Child
              </div>
              <div style={{ fontWeight: 700 }}>{detail.childName}</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 1 }}>
                Class
              </div>
              <div style={{ fontWeight: 700 }}>{detail.childClass}</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 1 }}>
                Parent
              </div>
              <div style={{ fontWeight: 700 }}>{detail.parentName}</div>
            </div>
            <div>
              <div style={{ color: "var(--text3)", marginBottom: 1 }}>
                Phone
              </div>
              <div style={{ fontWeight: 700 }}>{detail.parentPhone}</div>
            </div>
          </div>
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
              marginBottom: 12,
            }}
          >
            {detail.items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  padding: "4px 0",
                }}
              >
                <span>
                  {item.productName} ({item.size}) ×{item.quantity}
                </span>
                <span style={{ fontWeight: 700 }}>
                  ${(item.unitPrice * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "var(--bg2)",
              borderRadius: "var(--radius-sm)",
              padding: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 2,
              }}
            >
              <span style={{ color: "var(--text3)" }}>Subtotal</span>
              <span>${detail.subtotal.toFixed(2)}</span>
            </div>
            {detail.discountRate > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 2,
                  color: "var(--peach-dark)",
                }}
              >
                <span>Discount (15%)</span>
                <span>−${detail.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 15,
                fontWeight: 900,
                color: "var(--mint-dark)",
                paddingTop: 6,
                borderTop: "1px solid var(--border)",
                marginTop: 4,
              }}
            >
              <span>Total</span>
              <span>${detail.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PARENT SHELL ─────────────────────────────────────────────
function ParentShell() {
  const { state, dispatch } = useApp();
  const { parentPage, cart } = state;
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const tabs = [
    { id: "home", label: "Shop", icon: "🏪" },
    {
      id: "cart",
      label: `Cart${cartCount > 0 ? ` (${cartCount})` : ""}`,
      icon: "🛒",
    },
    { id: "orders", label: "My Orders", icon: "📋" },
  ];

  if (parentPage === "login") return <ParentLogin />;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--bg)",
          borderBottom: "1px solid var(--border)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{state.settings.logoEmoji}</span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--mint-dark)",
            }}
          >
            {state.settings.systemName}
          </span>
        </div>
        <button
          onClick={() => {
            dispatch({ type: "LOGOUT" });
          }}
          style={{
            background: "none",
            border: "none",
            fontSize: 12,
            color: "var(--text3)",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
          }}
        >
          Sign out
        </button>
      </div>
      {/* Content */}
      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
        {parentPage === "home" && <ParentHome />}
        {parentPage === "cart" && <ParentCart />}
        {parentPage === "orders" && <ParentOrders />}
      </div>
      {/* Bottom Nav */}
      <div
        style={{
          background: "var(--bg)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          position: "sticky",
          bottom: 0,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => dispatch({ type: "SET_PARENT_PAGE", page: t.id })}
            style={{
              flex: 1,
              padding: "10px 0",
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              borderTop: `2.5px solid ${parentPage === t.id ? "var(--mint-dark)" : "transparent"}`,
              transition: "all .15s",
            }}
          >
            <span style={{ fontSize: 18 }}>{t.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color:
                  parentPage === t.id ? "var(--mint-dark)" : "var(--text3)",
              }}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ADMIN SCREENS
// ══════════════════════════════════════════════════════════════

function AdminDashboard() {
  const { state, dispatch } = useApp();
  const { orders, products } = state;
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api("/api/admin/stats")
      .then(setStats)
      .catch(() => {}); // fall back to local calculation below
  }, []);

  const totalRev =
    stats?.revenue ??
    orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((s, o) => s + o.totalAmount, 0);
  const profit = stats?.profit ?? 0;
  const pending =
    stats?.pendingOrders ??
    orders.filter((o) => ["SUBMITTED", "REVIEW"].includes(o.status)).length;

  const productQtys = stats?.topProducts
    ? stats.topProducts.map((p) => ({
        id: p.productId,
        name: p.productName,
        totalQty: p._sum?.quantity || 0,
      }))
    : products
        .map((p) => ({
          ...p,
          totalQty: orders
            .filter((o) => o.status !== "CANCELLED")
            .reduce(
              (s, o) =>
                s +
                o.items
                  .filter((i) => i.productId === p.id)
                  .reduce((ss, i) => ss + i.quantity, 0),
              0,
            ),
        }))
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, 6);

  const maxQty = Math.max(...productQtys.map((p) => p.totalQty), 1);

  return (
    <div className="animate-fade">
      <SectionTitle>Dashboard</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="Total Orders"
          value={orders.length}
          sub={`${pending} pending review`}
        />
        <StatCard
          label="Revenue"
          value={`$${totalRev.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`}
          sub="After discounts"
        />
        <StatCard
          label="Gross Profit"
          value={`$${profit.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`}
          sub={`Margin ${totalRev > 0 ? ((profit / totalRev) * 100).toFixed(1) : 0}%`}
          color="var(--sky-dark)"
        />
        <StatCard
          label="Pending"
          value={pending}
          sub="Needs action"
          color="var(--peach-dark)"
        />
      </div>

      <Card style={{ marginBottom: 14 }}>
        <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          Recent Orders
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr>
                {["Order", "Child", "Location", "Total", "Status"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 8px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 800,
                      color: "var(--text3)",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((o) => (
                <tr key={o.id}>
                  {[
                    o.orderNumber,
                    `${o.childName} · ${o.childClass}`,
                    state.locations.find((l) => l.id === o.locationId)?.name ||
                      o.locationName ||
                      "",
                    `$${o.totalAmount.toFixed(2)}`,
                    <Badge status={o.status} />,
                  ].map((cell, i) => (
                    <td
                      key={i}
                      style={{
                        padding: "8px 8px",
                        borderBottom: "0.5px solid var(--border)",
                        whiteSpace: i < 3 ? "nowrap" : "normal",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
          Products by Order Volume
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {productQtys.map((p, i) => {
            const colors = [
              "var(--mint-mid)",
              "var(--sky-mid)",
              "var(--peach-mid)",
              "var(--purple-mid)",
              "var(--lemon-mid)",
              "var(--text3)",
            ];
            return (
              <div
                key={p.id}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    width: 100,
                    flexShrink: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.name}
                </span>
                <div
                  style={{
                    flex: 1,
                    background: "var(--bg3)",
                    borderRadius: 4,
                    height: 10,
                  }}
                >
                  <div
                    style={{
                      width: `${((p.totalQty / maxQty) * 100).toFixed(0)}%`,
                      height: "100%",
                      background: colors[i],
                      borderRadius: 4,
                      transition: "width .5s ease",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text3)",
                    minWidth: 28,
                    textAlign: "right",
                    fontWeight: 700,
                  }}
                >
                  {p.totalQty}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function AdminProducts() {
  const { state, dispatch } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    imageEmoji: "👕",
    imageBg: "#e8f7f0",
    category: "Tops",
    sellingPrice: "",
    costPrice: "",
    sizes: ["T1", "T2", "T3", "T4", "T5"],
    isActive: true,
  });
  const sizes = ["T1", "T2", "T3", "T4", "T5"];
  const categories = ["Tops", "Bottoms", "Accessories", "Sets"];
  const [file, setFile] = useState(null);

  function openNew() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      imageEmoji: "👕",
      imageBg: "#e8f7f0",
      category: "Tops",
      sellingPrice: "",
      costPrice: "",
      sizes: ["T1", "T2", "T3"],
      isActive: true,
    });
    setShowForm(true);
  }
  function openEdit(p) {
    setEditing(p);
    setForm({
      ...p,
      sellingPrice: String(p.sellingPrice),
      costPrice: String(p.costPrice),
    });
    setShowForm(true);
  }
  // async function handleSave() {
  //   if (!form.name || !form.sellingPrice || !form.costPrice) {
  //     dispatch({
  //       type: "SET_TOAST",
  //       message: "Name, selling price and cost price are required",
  //     });
  //     return;
  //   }
  //   const body = {
  //     ...form,
  //     sellingPrice: parseFloat(form.sellingPrice),
  //     costPrice: parseFloat(form.costPrice),
  //     sizes: form.sizes,
  //   };
  //   try {
  //     if (editing) {
  //       const product = await api(`/api/admin/products/${editing.id}`, {
  //         method: "PUT",
  //         body,
  //       });
  //       dispatch({
  //         type: "UPDATE_PRODUCT",
  //         product: { ...editing, ...product, sizes: form.sizes },
  //       });
  //     } else {
  //       const product = await api("/api/admin/products", {
  //         method: "POST",
  //         body,
  //       });
  //       dispatch({
  //         type: "ADD_PRODUCT",
  //         product: {
  //           ...product,
  //           sizes: form.sizes,
  //           imageEmoji: form.imageEmoji,
  //           imageBg: form.imageBg || "#e8f7f0",
  //         },
  //       });
  //     }
  //     dispatch({
  //       type: "SET_TOAST",
  //       message: editing ? "Product updated!" : "Product added!",
  //     });
  //     setShowForm(false);
  //   } catch (err) {
  //     dispatch({
  //       type: "SET_TOAST",
  //       message: err.message || "Failed to save product",
  //     });
  //   }
  // }

  async function handleSave() {
    if (!form.name || !form.sellingPrice || !form.costPrice) {
      dispatch({
        type: "SET_TOAST",
        message: "Name, selling price and cost price are required",
      });
      return;
    }

    try {
      const formData = new FormData();

      // append all form fields
      Object.keys(form).forEach((key) => {
        if (key === "sizes") {
          formData.append(key, JSON.stringify(form[key]));
        } else {
          formData.append(key, form[key]);
        }
      });

      // ensure numeric fields are numbers
      formData.set("sellingPrice", parseFloat(form.sellingPrice));
      formData.set("costPrice", parseFloat(form.costPrice));

      // append file (IMPORTANT)
      if (file) {
        formData.append("image", file);
      }

      let product;

      if (editing) {
        product = await api(`/api/admin/products/${editing.id}`, {
          method: "PUT",
          body: formData,
        });

        dispatch({
          type: "UPDATE_PRODUCT",
          product: { ...editing, ...product, sizes: form.sizes },
        });
      } else {
        product = await api("/api/admin/products", {
          method: "POST",
          body: formData,
        });

        dispatch({
          type: "ADD_PRODUCT",
          product: {
            ...product,
            sizes: form.sizes,
            imageEmoji: form.imageEmoji,
            imageBg: form.imageBg || "#e8f7f0",
          },
        });
      }

      dispatch({
        type: "SET_TOAST",
        message: editing ? "Product updated!" : "Product added!",
      });

      setShowForm(false);
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to save product",
      });
    }
  }

  function toggleSize(s) {
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(s)
        ? f.sizes.filter((x) => x !== s)
        : [...f.sizes, s].sort(),
    }));
  }

  return (
    <div className="animate-fade">
      <SectionTitle
        action={
          <Btn variant="admin" size="sm" onClick={openNew}>
            + Add Product
          </Btn>
        }
      >
        Products
      </SectionTitle>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            minWidth: 560,
          }}
        >
          <thead>
            <tr>
              {[
                "Product",
                "Selling",
                "Cost 🔒",
                "Profit",
                "Sizes",
                "Status",
                "",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "7px 10px",
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--text3)",
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    background: "var(--bg2)",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.products.map((p) => (
              <tr key={p.id} style={{ transition: "background .15s" }}>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        background: p.imageBg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {p.imageEmoji}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>
                        {p.category}
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                    fontWeight: 700,
                    color: "var(--mint-dark)",
                  }}
                >
                  ${p.sellingPrice}
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                    fontWeight: 700,
                    color: "var(--peach-dark)",
                  }}
                >
                  ${p.costPrice}
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                    fontWeight: 700,
                    color: "var(--sky-dark)",
                  }}
                >
                  ${(p.sellingPrice - p.costPrice).toFixed(2)}
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {p.sizes.map((s) => (
                      <span
                        key={s}
                        style={{
                          background: "var(--bg3)",
                          border: "0.5px solid var(--border)",
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 5px",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <Toggle
                    checked={p.isActive}
                    onChange={async (v) => {
                      try {
                        await api(`/api/admin/products/${p.id}`, {
                          method: "PUT",
                          body: { isActive: v },
                        });
                        dispatch({
                          type: "UPDATE_PRODUCT",
                          product: { ...p, isActive: v },
                        });
                      } catch (err) {
                        dispatch({
                          type: "SET_TOAST",
                          message: err.message || "Failed to update product",
                        });
                      }
                    }}
                  />
                </td>
                <td
                  style={{
                    padding: "10px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => openEdit(p)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 5,
                        border: "none",
                        background: "var(--sky)",
                        color: "var(--sky-dark)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await api(`/api/admin/products/${p.id}`, {
                            method: "DELETE",
                          });
                          dispatch({ type: "DELETE_PRODUCT", id: p.id });
                          dispatch({
                            type: "SET_TOAST",
                            message: "Product deleted",
                          });
                        } catch (err) {
                          dispatch({
                            type: "SET_TOAST",
                            message: err.message || "Failed to delete product",
                          });
                        }
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 5,
                        border: "none",
                        background: "var(--peach)",
                        color: "var(--peach-dark)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? "Edit Product" : "Add Product"}
          onClose={() => setShowForm(false)}
          width={500}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <Input
              label="Product Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
              style={{ gridColumn: "1/-1" }}
            />
            <Input
              label="Selling Price ($)"
              value={form.sellingPrice}
              onChange={(v) => setForm({ ...form, sellingPrice: v })}
              type="number"
              required
            />
            <Input
              label="Cost Price ($) 🔒"
              value={form.costPrice}
              onChange={(v) => setForm({ ...form, costPrice: v })}
              type="number"
              required
            />
            <Input
              label="Category"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={categories}
            />
            <Input
              label="Emoji Icon"
              value={form.imageEmoji}
              onChange={(v) => setForm({ ...form, imageEmoji: v })}
              placeholder="👕"
            />
          </div>
          <Input
            label="Description"
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            type="textarea"
            style={{ marginBottom: 10 }}
          />
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text2)",
                marginBottom: 6,
              }}
            >
              Available Sizes
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {sizes.map((s) => (
                <label
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    cursor: "pointer",
                    padding: "5px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: `2px solid ${form.sizes.includes(s) ? "var(--sky-dark)" : "var(--border)"}`,
                    background: form.sizes.includes(s)
                      ? "var(--sky)"
                      : "var(--bg)",
                    transition: "all .15s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.sizes.includes(s)}
                    onChange={() => toggleSize(s)}
                    style={{ accentColor: "var(--sky-dark)" }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: form.sizes.includes(s)
                        ? "var(--sky-dark)"
                        : "var(--text2)",
                    }}
                  >
                    {s}{" "}
                    <span style={{ fontSize: 10, opacity: 0.7 }}>
                      Age {s.replace("T", "")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn variant="admin" onClick={handleSave} style={{ flex: 1 }}>
              Save Product
            </Btn>
            <Btn variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminInventory() {
  const { state, dispatch } = useApp();
  const [filter, setFilter] = useState("");
  const [apiRows, setApiRows] = useState(null);

  useEffect(() => {
    api("/api/admin/inventory")
      .then((data) => setApiRows(data))
      .catch(() => {});
  }, []);

  const rows = apiRows
    ? apiRows.map((i) => ({
        product: { id: i.productId, name: i.product?.name || "" },
        invId: i.id,
        size: i.size,
        total: i.totalQty,
        reserved: i.reservedQty,
        available: i.availableQty,
      }))
    : state.products
        .filter((p) => p.isActive)
        .flatMap((p) =>
          p.sizes.map((s) => {
            const inv = state.inventory[p.id]?.[s] || { total: 0, reserved: 0 };
            return {
              product: p,
              size: s,
              total: inv.total,
              reserved: inv.reserved,
              available: inv.total - inv.reserved,
            };
          }),
        );

  const filtered = filter
    ? rows.filter(
        (r) =>
          r.product.name.toLowerCase().includes(filter.toLowerCase()) ||
          r.size === filter,
      )
    : rows;

  async function updateTotal(productId, size, val) {
    const inv = state.inventory[productId]?.[size] || { total: 0, reserved: 0 };
    const newTotal = Math.max(parseInt(val) || 0, inv.reserved);
    dispatch({
      type: "UPDATE_INVENTORY",
      productId,
      size,
      inv: { ...inv, total: newTotal },
    });
    // Find the inventory row id for the API call
    const row = rows.find((r) => r.product.id === productId && r.size === size);
    if (row?.invId) {
      api(`/api/admin/inventory/${row.invId}`, {
        method: "PUT",
        body: { totalQty: newTotal },
      }).catch(() => {});
    }
  }

  function exportCSV() {
    // Use the server-side export endpoint which always has the latest data
    window.open(`${API_BASE_URL}/api/admin/inventory/export`, "_blank");
  }

  return (
    <div className="animate-fade">
      <SectionTitle
        action={
          <Btn variant="admin" size="sm" onClick={exportCSV}>
            Export CSV
          </Btn>
        }
      >
        Inventory
      </SectionTitle>
      <div
        style={{
          background: "var(--lemon)",
          border: "1px solid var(--lemon-mid)",
          borderRadius: "var(--radius-sm)",
          padding: "10px 14px",
          fontSize: 12,
          color: "var(--lemon-dark)",
          fontWeight: 600,
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        📋 <strong>Submitted / Review</strong> → reserves stock &nbsp;|&nbsp;{" "}
        <strong>Ready for Pick Up</strong> → deducts from total &nbsp;|&nbsp;{" "}
        <strong>Cancelled</strong> → restores stock
      </div>
      <div style={{ marginBottom: 10 }}>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by product name…"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            background: "var(--bg)",
            color: "var(--text)",
            outline: "none",
          }}
        />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            minWidth: 480,
          }}
        >
          <thead>
            <tr>
              {[
                "Product · Size",
                "Total Stock",
                "Reserved",
                "Available",
                "Update",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "7px 10px",
                    textAlign: "left",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "var(--text3)",
                    textTransform: "uppercase",
                    letterSpacing: ".05em",
                    background: "var(--bg2)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i}>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                    fontWeight: 700,
                  }}
                >
                  <span>{r.product.name}</span>{" "}
                  <span
                    style={{
                      fontSize: 11,
                      background: "var(--bg3)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontWeight: 700,
                      marginLeft: 4,
                    }}
                  >
                    {r.size}
                  </span>
                </td>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      background: "var(--sky)",
                      color: "var(--sky-dark)",
                      padding: "3px 9px",
                      borderRadius: 30,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {r.total}
                  </span>
                </td>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      background: "var(--lemon)",
                      color: "var(--lemon-dark)",
                      padding: "3px 9px",
                      borderRadius: 30,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {r.reserved}
                  </span>
                </td>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <span
                    style={{
                      background: "var(--mint)",
                      color: "var(--mint-dark)",
                      padding: "3px 9px",
                      borderRadius: 30,
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {r.available}
                  </span>
                </td>
                <td
                  style={{
                    padding: "9px 10px",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <input
                    type="number"
                    defaultValue={r.total}
                    min={r.reserved}
                    onChange={(e) =>
                      updateTotal(r.product.id, r.size, e.target.value)
                    }
                    style={{
                      width: 64,
                      padding: "5px 8px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-xs)",
                      fontSize: 12,
                      background: "var(--bg)",
                      color: "var(--text)",
                      outline: "none",
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminOrders() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterLoc, setFilterLoc] = useState("");
  const [detail, setDetail] = useState(null);
  const [allOrders, setAllOrders] = useState(state.orders);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (filterStatus) params.set("status", filterStatus);
        if (filterLoc) params.set("locationId", filterLoc);
        const data = await api(`/api/admin/orders?${params}`);
        setAllOrders(data.orders || data);
        dispatch({ type: "SET_ORDERS", orders: data.orders || data });
      } catch {
        setAllOrders(state.orders);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, [search, filterStatus, filterLoc]);

  const filtered = allOrders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      o.childName.toLowerCase().includes(q) ||
      o.parentName.toLowerCase().includes(q) ||
      o.childClass.toLowerCase().includes(q) ||
      o.orderNumber.toLowerCase().includes(q);
    const matchStatus = !filterStatus || o.status === filterStatus;
    const matchLoc = !filterLoc || o.locationId === filterLoc;
    return matchSearch && matchStatus && matchLoc;
  });

  function exportCSV() {
    window.open(`${API_BASE_URL}/api/admin/orders/export`, "_blank");
  }

  async function handleStatusChange(orderId, newStatus) {
    try {
      const updated = await api(`/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        body: { status: newStatus },
      });
      dispatch({ type: "UPDATE_ORDER_STATUS", id: orderId, status: newStatus });
      setAllOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );
      dispatch({
        type: "SET_TOAST",
        message: `Order status updated to ${STATUS_LABELS[newStatus]}`,
      });
      if (detail?.id === orderId)
        setDetail((d) => ({ ...d, status: newStatus }));
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to update status",
      });
    }
  }

  return (
    <div className="animate-fade">
      <SectionTitle
        action={
          <Btn variant="admin" size="sm" onClick={exportCSV}>
            Export CSV
          </Btn>
        }
      >
        Order Management
      </SectionTitle>
      <div
        style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search orders…"
          style={{
            flex: 1,
            minWidth: 140,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            background: "var(--bg)",
            color: "var(--text)",
            outline: "none",
          }}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            background: "var(--bg)",
            color: "var(--text)",
            outline: "none",
          }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={filterLoc}
          onChange={(e) => setFilterLoc(e.target.value)}
          style={{
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            background: "var(--bg)",
            color: "var(--text)",
            outline: "none",
          }}
        >
          <option value="">All Locations</option>
          {state.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState emoji="🔍" message="No orders match your search" />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              minWidth: 640,
            }}
          >
            <thead>
              <tr>
                {[
                  "Order",
                  "Child · Class",
                  "Parent",
                  "Location",
                  "Total",
                  "Status",
                  "Update",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "7px 10px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 800,
                      color: "var(--text3)",
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      background: "var(--bg2)",
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  style={{ cursor: "pointer", transition: "background .15s" }}
                  onClick={() => setDetail(o)}
                >
                  <td
                    style={{
                      padding: "9px 10px",
                      borderBottom: "0.5px solid var(--border)",
                      fontWeight: 700,
                      color: "var(--sky-dark)",
                    }}
                  >
                    {o.orderNumber}
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{o.childName}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>
                      {o.childClass}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    {o.parentName}
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      borderBottom: "0.5px solid var(--border)",
                      fontSize: 11,
                    }}
                  >
                    {state.locations.find((l) => l.id === o.locationId)?.name ||
                      o.locationName ||
                      "—"}
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      borderBottom: "0.5px solid var(--border)",
                      fontWeight: 800,
                      color: "var(--mint-dark)",
                    }}
                  >
                    ${o.totalAmount.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    <Badge status={o.status} />
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={o.status}
                      onChange={(e) => handleStatusChange(o.id, e.target.value)}
                      style={{
                        padding: "4px 8px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-xs)",
                        fontSize: 11,
                        background: "var(--bg)",
                        color: "var(--text)",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <Modal
          title={`Order ${detail.orderNumber}`}
          onClose={() => setDetail(null)}
          width={520}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Badge status={detail.status} />
            <span style={{ fontSize: 11, color: "var(--text3)" }}>
              {detail.createdAt}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
              fontSize: 12,
            }}
          >
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Child
              </div>
              <div style={{ fontWeight: 700 }}>{detail.childName}</div>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Class
              </div>
              <div style={{ fontWeight: 700 }}>{detail.childClass}</div>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Parent
              </div>
              <div style={{ fontWeight: 700 }}>{detail.parentName}</div>
            </div>
            <div>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Phone
              </div>
              <div style={{ fontWeight: 700 }}>{detail.parentPhone}</div>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <div
                style={{ color: "var(--text3)", fontSize: 10, marginBottom: 1 }}
              >
                Location
              </div>
              <div style={{ fontWeight: 700 }}>
                {state.locations.find((l) => l.id === detail.locationId)
                  ?.name || detail.locationName}
              </div>
            </div>
          </div>
          <div
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 10,
              marginBottom: 10,
            }}
          >
            {detail.items.map((it, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  padding: "4px 0",
                }}
              >
                <span>
                  {it.productName} ({it.size}) ×{it.quantity}
                </span>
                <span style={{ fontWeight: 700 }}>
                  ${(it.unitPrice * it.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "var(--bg2)",
              borderRadius: "var(--radius-sm)",
              padding: 10,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginBottom: 2,
              }}
            >
              <span style={{ color: "var(--text3)" }}>Subtotal</span>
              <span>${detail.subtotal.toFixed(2)}</span>
            </div>
            {detail.discountRate > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 2,
                  color: "var(--peach-dark)",
                }}
              >
                <span>
                  Discount ({(detail.discountRate * 100).toFixed(0)}%)
                </span>
                <span>−${detail.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 15,
                fontWeight: 900,
                color: "var(--mint-dark)",
                paddingTop: 6,
                borderTop: "1px solid var(--border)",
                marginTop: 4,
              }}
            >
              <span>Total</span>
              <span>${detail.totalAmount.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>
              Update status:
            </span>
            <select
              value={detail.status}
              onChange={(e) => {
                handleStatusChange(detail.id, e.target.value);
                setDetail({ ...detail, status: e.target.value });
              }}
              style={{
                flex: 1,
                padding: "7px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                background: "var(--bg)",
                outline: "none",
              }}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AdminMasterControl() {
  const { state, dispatch } = useApp();
  const [settings, setSettings] = useState({ ...state.settings });
  const [locations, setLocations] = useState([...state.locations]);
  const [fields, setFields] = useState([...state.formFields]);
  const [newLocName, setNewLocName] = useState("");
  const [tab, setTab] = useState("locations");

  async function saveSettings() {
    try {
      const saved = await api("/api/admin/settings", {
        method: "PUT",
        body: settings,
      });
      dispatch({ type: "UPDATE_SETTINGS", settings: saved });
      dispatch({ type: "SET_TOAST", message: "Settings saved!" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to save settings",
      });
    }
  }
  async function addLocation() {
    if (!newLocName.trim()) {
      dispatch({ type: "SET_TOAST", message: "Enter a location name" });
      return;
    }
    try {
      const loc = await api("/api/admin/locations", {
        method: "POST",
        body: { name: newLocName.trim(), sortOrder: locations.length + 1 },
      });
      const updated = [...locations, loc];
      setLocations(updated);
      dispatch({ type: "ADD_LOCATION", location: loc });
      setNewLocName("");
      dispatch({ type: "SET_TOAST", message: "Location added!" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to add location",
      });
    }
  }
  async function setDefault(id) {
    try {
      await api(`/api/admin/locations/${id}`, {
        method: "PUT",
        body: { isDefault: true },
      });
      const updated = locations.map((l) => ({ ...l, isDefault: l.id === id }));
      setLocations(updated);
      updated.forEach((l) =>
        dispatch({ type: "UPDATE_LOCATION", location: l }),
      );
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to set default",
      });
    }
  }
  async function deleteLoc(id) {
    try {
      await api(`/api/admin/locations/${id}`, { method: "DELETE" });
      const updated = locations.filter((l) => l.id !== id);
      setLocations(updated);
      dispatch({ type: "DELETE_LOCATION", id });
      dispatch({ type: "SET_TOAST", message: "Location removed" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to remove location",
      });
    }
  }
  async function saveFields() {
    try {
      await api("/api/admin/form-fields", { method: "PUT", body: { fields } });
      dispatch({ type: "UPDATE_FORM_FIELDS", fields });
      dispatch({ type: "SET_TOAST", message: "Form fields saved!" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to save fields",
      });
    }
  }

  const tabs = ["locations", "branding", "form"];
  const tabLabels = {
    locations: "📍 Locations",
    branding: "🎨 Branding",
    form: "📝 Form Fields",
  };

  return (
    <div className="animate-fade">
      <SectionTitle>Master Control</SectionTitle>
      <div
        style={{
          display: "flex",
          gap: 6,
          marginBottom: 16,
          borderBottom: "1px solid var(--border)",
          paddingBottom: 0,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 14px",
              background: "none",
              border: "none",
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              borderBottom: `2.5px solid ${tab === t ? "var(--sky-dark)" : "transparent"}`,
              color: tab === t ? "var(--sky-dark)" : "var(--text3)",
              paddingBottom: 10,
              marginBottom: -1,
              transition: "all .15s",
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {tab === "locations" && (
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            School Locations
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {locations.map((l) => (
              <div
                key={l.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  background: "var(--bg2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                  {l.name}
                </span>
                {l.isDefault && (
                  <span
                    style={{
                      background: "var(--mint)",
                      color: "var(--mint-dark)",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: 30,
                    }}
                  >
                    Default
                  </span>
                )}
                {!l.isDefault && (
                  <button
                    onClick={() => setDefault(l.id)}
                    style={{
                      padding: "3px 9px",
                      border: "none",
                      borderRadius: 5,
                      background: "var(--bg3)",
                      color: "var(--text3)",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => deleteLoc(l.id)}
                  style={{
                    padding: "3px 9px",
                    border: "none",
                    borderRadius: 5,
                    background: "var(--peach)",
                    color: "var(--peach-dark)",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newLocName}
              onChange={(e) => setNewLocName(e.target.value)}
              placeholder="New location name…"
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                background: "var(--bg)",
                color: "var(--text)",
                outline: "none",
              }}
              onKeyDown={(e) => e.key === "Enter" && addLocation()}
            />
            <Btn variant="admin" onClick={addLocation}>
              + Add
            </Btn>
          </div>
        </Card>
      )}

      {tab === "branding" && (
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Branding & Page Content
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input
              label="System / Page Title"
              value={settings.systemName}
              onChange={(v) => setSettings({ ...settings, systemName: v })}
            />
            <Input
              label="Logo Emoji"
              value={settings.logoEmoji}
              onChange={(v) => setSettings({ ...settings, logoEmoji: v })}
              placeholder="🎒"
            />
            <Input
              label="Homepage Welcome Title"
              value={settings.welcomeTitle}
              onChange={(v) => setSettings({ ...settings, welcomeTitle: v })}
            />
            <Input
              label="Homepage Welcome Text"
              value={settings.welcomeText}
              onChange={(v) => setSettings({ ...settings, welcomeText: v })}
              type="textarea"
            />
            <Input
              label="Order Page Instructions"
              value={settings.orderInstructions}
              onChange={(v) =>
                setSettings({ ...settings, orderInstructions: v })
              }
              type="textarea"
            />
            <Input
              label="Notice / Announcement Text"
              value={settings.noticeText}
              onChange={(v) => setSettings({ ...settings, noticeText: v })}
              type="textarea"
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <Input
                label="Discount Threshold ($)"
                value={String(settings.discountThreshold)}
                onChange={(v) =>
                  setSettings({
                    ...settings,
                    discountThreshold: parseFloat(v) || 500,
                  })
                }
                type="number"
              />
              <Input
                label="Discount Rate (0–1)"
                value={String(settings.discountRate)}
                onChange={(v) =>
                  setSettings({
                    ...settings,
                    discountRate: parseFloat(v) || 0.15,
                  })
                }
                type="number"
              />
            </div>
            <Btn variant="admin" onClick={saveSettings} fullWidth>
              Save Branding Settings
            </Btn>
          </div>
        </Card>
      )}

      {tab === "form" && (
        <Card>
          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Order Form Fields
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              marginBottom: 14,
            }}
          >
            {fields.map((f, i) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  background: "var(--bg2)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                  {f.label}
                </span>
                {f.isRequired && (
                  <span
                    style={{
                      background: "var(--peach)",
                      color: "var(--peach-dark)",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 30,
                    }}
                  >
                    Required
                  </span>
                )}
                {f.isSystem && (
                  <span
                    style={{
                      background: "var(--bg3)",
                      color: "var(--text3)",
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "2px 7px",
                      borderRadius: 30,
                    }}
                  >
                    System
                  </span>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--text3)" }}>
                    Visible
                  </span>
                  <Toggle
                    checked={f.isVisible}
                    onChange={(v) => {
                      const updated = [...fields];
                      updated[i] = { ...f, isVisible: v };
                      setFields(updated);
                    }}
                  />
                </div>
                {!f.isSystem && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>
                      Req.
                    </span>
                    <Toggle
                      checked={f.isRequired}
                      onChange={(v) => {
                        const updated = [...fields];
                        updated[i] = { ...f, isRequired: v };
                        setFields(updated);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <Btn variant="admin" onClick={saveFields} fullWidth>
            Save Field Settings
          </Btn>
        </Card>
      )}
    </div>
  );
}

function AdminAdmins() {
  const { state, dispatch } = useApp();
  const [admins, setAdmins] = useState(state.adminAccounts || []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "STAFF",
    password: "",
  });

  useEffect(() => {
    api("/api/admin/accounts")
      .then((data) => {
        setAdmins(data);
        dispatch({ type: "SET_ADMIN_ACCOUNTS", accounts: data });
      })
      .catch(() => {});
  }, []);
  const roleColors = {
    SUPER_ADMIN: "var(--mint)",
    MANAGER: "var(--sky)",
    STAFF: "var(--lemon)",
  };
  const roleTextColors = {
    SUPER_ADMIN: "var(--mint-dark)",
    MANAGER: "var(--sky-dark)",
    STAFF: "var(--lemon-dark)",
  };

  async function handleAdd() {
    if (!form.name || !form.email || !form.password) {
      dispatch({
        type: "SET_TOAST",
        message: "Name, email and password are required",
      });
      return;
    }
    try {
      const newAdmin = await api("/api/admin/accounts", {
        method: "POST",
        body: form,
      });
      setAdmins([...admins, { ...newAdmin, isActive: true }]);
      dispatch({ type: "SET_TOAST", message: "Admin account created!" });
      setShowForm(false);
      setForm({ name: "", email: "", role: "STAFF", password: "" });
    } catch (err) {
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Failed to create admin",
      });
    }
  }

  return (
    <div className="animate-fade">
      <SectionTitle
        action={
          <Btn variant="admin" size="sm" onClick={() => setShowForm(true)}>
            + Add Admin
          </Btn>
        }
      >
        Admin Accounts
      </SectionTitle>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
      >
        <thead>
          <tr>
            {["Name", "Email", "Role", "Status", ""].map((h) => (
              <th
                key={h}
                style={{
                  padding: "7px 10px",
                  textAlign: "left",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "var(--text3)",
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  background: "var(--bg2)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <td
                style={{
                  padding: "10px 10px",
                  borderBottom: "0.5px solid var(--border)",
                  fontWeight: 700,
                }}
              >
                {a.name}
              </td>
              <td
                style={{
                  padding: "10px 10px",
                  borderBottom: "0.5px solid var(--border)",
                  color: "var(--text2)",
                }}
              >
                {a.email}
              </td>
              <td
                style={{
                  padding: "10px 10px",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                <span
                  style={{
                    background: roleColors[a.role],
                    color: roleTextColors[a.role],
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "3px 9px",
                    borderRadius: 30,
                  }}
                >
                  {a.role.replace("_", " ")}
                </span>
              </td>
              <td
                style={{
                  padding: "10px 10px",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                <span
                  style={{
                    color: a.isActive ? "var(--mint-dark)" : "var(--text3)",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {a.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td
                style={{
                  padding: "10px 10px",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                {a.role !== "SUPER_ADMIN" && (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={async () => {
                        try {
                          await api(`/api/admin/accounts/${a.id}`, {
                            method: "PUT",
                            body: { isActive: false },
                          });
                          setAdmins(admins.filter((x) => x.id !== a.id));
                          dispatch({
                            type: "SET_TOAST",
                            message: "Admin removed",
                          });
                        } catch (err) {
                          dispatch({
                            type: "SET_TOAST",
                            message: err.message || "Failed to remove admin",
                          });
                        }
                      }}
                      style={{
                        padding: "4px 10px",
                        border: "none",
                        borderRadius: 5,
                        background: "var(--peach)",
                        color: "var(--peach-dark)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showForm && (
        <Modal title="Add Admin Account" onClose={() => setShowForm(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Input
              label="Full Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
            <Input
              label="Email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              type="email"
              required
            />
            <Input
              label="Role"
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={[
                { value: "SUPER_ADMIN", label: "Super Admin" },
                { value: "MANAGER", label: "Manager" },
                { value: "STAFF", label: "Staff" },
              ]}
            />
            <Input
              label="Temporary Password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              type="password"
              required
            />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Btn variant="admin" onClick={handleAdd} style={{ flex: 1 }}>
                Create Account
              </Btn>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ADMIN SHELL ──────────────────────────────────────────────
function AdminShell() {
  const { state, dispatch } = useApp();
  const { adminPage } = state;
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊", section: null },
    { id: "products", label: "Products", icon: "👕", section: "Products" },
    { id: "inventory", label: "Inventory", icon: "📦", section: "Products" },
    { id: "orders", label: "Orders", icon: "📋", section: "Orders" },
    { id: "master", label: "Master Control", icon: "⚙️", section: "Settings" },
    { id: "admins", label: "Admin Accounts", icon: "👤", section: "Settings" },
  ];
  const sections = ["Products", "Orders", "Settings"];
  let lastSection = null;

  return (
    <div
      style={{ display: "flex", minHeight: "100vh", background: "var(--bg2)" }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? 160 : 52,
          background: "var(--sky-dark)",
          flexShrink: 0,
          transition: "width .2s",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 12px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: "1px solid rgba(255,255,255,.15)",
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>
            {state.settings.logoEmoji}
          </span>
          {sidebarOpen && (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 13,
                color: "#fff",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              Wonderworld
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.6)",
              cursor: "pointer",
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            ☰
          </button>
        </div>
        <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {navItems.map((item, idx) => {
            const showSection = item.section && item.section !== lastSection;
            if (item.section) lastSection = item.section;
            return (
              <div key={item.id}>
                {showSection && sidebarOpen && (
                  <div
                    style={{
                      padding: "8px 14px 3px",
                      fontSize: 9,
                      fontWeight: 800,
                      color: "rgba(255,255,255,.4)",
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {item.section}
                  </div>
                )}
                <button
                  onClick={() =>
                    dispatch({ type: "SET_ADMIN_PAGE", page: item.id })
                  }
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: sidebarOpen ? "8px 14px" : "8px",
                    background:
                      adminPage === item.id ? "rgba(255,255,255,.2)" : "none",
                    border: "none",
                    color:
                      adminPage === item.id ? "#fff" : "rgba(255,255,255,.7)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fontSize: 12,
                    textAlign: "left",
                    transition: ".15s",
                    borderLeft: `3px solid ${adminPage === item.id ? "rgba(255,255,255,.8)" : "transparent"}`,
                  }}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>
                    {item.icon}
                  </span>
                  {sidebarOpen && (
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
                      {item.label}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid rgba(255,255,255,.15)",
          }}
        >
          <button
            onClick={() => dispatch({ type: "LOGOUT" })}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              color: "rgba(255,255,255,.6)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              fontSize: 11,
              fontWeight: 600,
              justifyContent: sidebarOpen ? "flex-start" : "center",
            }}
          >
            <span style={{ fontSize: 14 }}>🚪</span>
            {sidebarOpen && "Sign out"}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* Admin Top Bar */}
        <div
          style={{
            background: "var(--bg)",
            borderBottom: "1px solid var(--border)",
            padding: "10px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 15,
              color: "var(--text)",
            }}
          >
            {navItems.find((n) => n.id === adminPage)?.label || "Admin"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "var(--sky)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                color: "var(--sky-dark)",
              }}
            >
              {(state.currentUser?.name || ADMIN_USER.name).charAt(0)}
            </div>
            <span
              style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}
            >
              {state.currentUser?.name || ADMIN_USER.name}
            </span>
          </div>
        </div>

        {/* Page Content */}
        <div
          style={{
            flex: 1,
            padding: 20,
            overflowY: "auto",
            maxHeight: "calc(100vh - 57px)",
          }}
        >
          {adminPage === "dashboard" && <AdminDashboard />}
          {adminPage === "products" && <AdminProducts />}
          {adminPage === "inventory" && <AdminInventory />}
          {adminPage === "orders" && <AdminOrders />}
          {adminPage === "master" && <AdminMasterControl />}
          {adminPage === "admins" && <AdminAdmins />}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ROOT APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const [email, setEmail] = useState("wang@wonderworld.edu");
  const [pass, setPass] = useState("AdminPass123!");

  // Inject global CSS once
  useEffect(() => {
    const id = "ww-global-styles";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = GLOBAL_CSS;
      document.head.appendChild(style);
    }
    return () => {}; // leave styles in
  }, []);

  useEffect(() => {
    // Restore session from localStorage on page reload
    const token = localStorage.getItem("ww_token");
    const role = localStorage.getItem("ww_role");
    if (token && role) {
      // Validate token is still good by fetching role-specific data
      // (server will 401 if expired, caught below)
    }

    async function initAppData() {
      try {
        const [products, locations, settings, formFields] = await Promise.all([
          api("/api/products"),
          api("/api/locations"),
          api("/api/settings"),
          api("/api/form-fields"),
        ]);
        dispatch({
          type: "SET_INITIAL_DATA",
          payload: { products, locations, settings, formFields },
        });
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    }
    initAppData();
  }, []);
  const showAdminDirect = !state.currentUser && state.view === "admin";

  async function handleAdminLogin(e) {
    e.preventDefault();
    // dispatch({ type: "LOGIN", user: ADMIN_USER, role: "admin" });
    // dispatch({ type: "SET_VIEW", view: "admin", adminPage: "dashboard" });
    debugger;
    const emailEl = e.target.querySelector('input[type="email"]');
    const passEl = e.target.querySelector('input[type="password"]');
    console.log(passEl.value);
    try {
      const data = await api("/api/auth/admin/login", {
        method: "POST",
        body: {
          email: emailEl?.value || "wang@wonderworld.edu",
          password: passEl?.value || "adminpass",
        },
      });
      localStorage.setItem("ww_token", data.token);
      localStorage.setItem("ww_role", "admin");
      dispatch({ type: "LOGIN", user: data.admin, role: "admin" });
      dispatch({ type: "SET_VIEW", view: "admin", adminPage: "dashboard" });
    } catch (err) {
      console.log(err);
      dispatch({
        type: "SET_TOAST",
        message: err.message || "Admin login failed",
      });
    }
  }

  return (
    <AppCtx.Provider value={{ state, dispatch }}>
      <div style={{ fontFamily: "var(--font-body)" }}>
        {/* Admin direct login */}
        {showAdminDirect && (
          <div
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg,var(--sky) 0%,var(--bg2) 100%)",
              padding: 16,
            }}
          >
            <div
              className="animate-pop"
              style={{
                background: "var(--bg)",
                borderRadius: "var(--radius)",
                padding: 32,
                width: "100%",
                maxWidth: 360,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    background: "var(--sky)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    margin: "0 auto 12px",
                  }}
                >
                  🏫
                </div>
                <h1
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 20,
                    color: "var(--sky-dark)",
                  }}
                >
                  Admin Portal
                </h1>
                <p
                  style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}
                >
                  Wonderworld Admin Dashboard
                </p>
              </div>
              <form
                onSubmit={handleAdminLogin}
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <Input
                  label="Admin Email"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  placeholder="parent@email.com"
                  required
                />
                <Input
                  label="Password"
                  value={pass}
                  onChange={setPass}
                  type="password"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="submit"
                  style={{
                    padding: "11px",
                    background: "var(--sky-dark)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Log In to Admin
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "SET_VIEW",
                      view: "parent",
                      parentPage: "login",
                    })
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text3)",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  ← Parent Portal
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Main app */}
        {!showAdminDirect && (
          <>
            {/* View switcher (demo only) */}
            {!state.currentUser && (
              <div
                style={{
                  position: "fixed",
                  top: 12,
                  right: 12,
                  zIndex: 500,
                  display: "flex",
                  gap: 6,
                }}
              >
                <button
                  onClick={() =>
                    dispatch({
                      type: "SET_VIEW",
                      view: "parent",
                      parentPage: "login",
                    })
                  }
                  style={{
                    padding: "5px 12px",
                    borderRadius: 30,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1.5px solid",
                    borderColor:
                      state.view === "parent"
                        ? "var(--mint-dark)"
                        : "var(--border)",
                    background:
                      state.view === "parent"
                        ? "var(--mint-dark)"
                        : "rgba(255,255,255,.9)",
                    color: state.view === "parent" ? "#fff" : "var(--text2)",
                  }}
                >
                  Parent
                </button>
                <button
                  onClick={() =>
                    dispatch({
                      type: "SET_VIEW",
                      view: "admin",
                      adminPage: "dashboard",
                    })
                  }
                  style={{
                    padding: "5px 12px",
                    borderRadius: 30,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1.5px solid",
                    borderColor:
                      state.view === "admin"
                        ? "var(--sky-dark)"
                        : "var(--border)",
                    background:
                      state.view === "admin"
                        ? "var(--sky-dark)"
                        : "rgba(255,255,255,.9)",
                    color: state.view === "admin" ? "#fff" : "var(--text2)",
                  }}
                >
                  Admin
                </button>
              </div>
            )}
            {(state.userRole === "parent" ||
              (state.view === "parent" && !state.currentUser)) && (
              <ParentShell />
            )}
            {(state.userRole === "admin" ||
              (state.view === "admin" && state.currentUser)) && <AdminShell />}
          </>
        )}

        {/* Toast Notification */}
        {state.toast && (
          <Toast
            message={state.toast}
            onClose={() => dispatch({ type: "CLEAR_TOAST" })}
          />
        )}
      </div>
    </AppCtx.Provider>
  );
}
