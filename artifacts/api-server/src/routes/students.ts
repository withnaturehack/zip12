import { Router } from "express";
import { db, usersTable, hostelsTable } from "@workspace/db";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, requireVolunteer, generateId, hashPassword, AuthRequest, COORDINATOR_ROLES, VOLUNTEER_ROLES } from "../lib/auth.js";

const router = Router();

// GET /api/students — accessible to volunteers and above; volunteers see only their hostel
router.get("/", requireVolunteer, async (req: AuthRequest, res) => {
  const { limit = "100", offset = "0", search = "", hostelId: qHostelId } = req.query;

  const [caller] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!caller) { res.status(401).json({ message: "Unauthorized" }); return; }

  // Build where clause
  let rows = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      rollNumber: usersTable.rollNumber,
      phone: usersTable.phone,
      contactNumber: usersTable.contactNumber,
      area: usersTable.area,
      hostelId: usersTable.hostelId,
      roomNumber: usersTable.roomNumber,
      assignedMess: usersTable.assignedMess,
      attendanceStatus: usersTable.attendanceStatus,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
      hostelName: hostelsTable.name,
    })
    .from(usersTable)
    .leftJoin(hostelsTable, eq(usersTable.hostelId, hostelsTable.id))
    .where(eq(usersTable.role, "student"));

  // Role-based filtering
  if (caller.role === "volunteer") {
    rows = rows.filter(s => s.hostelId === caller.hostelId);
  } else if (qHostelId) {
    rows = rows.filter(s => s.hostelId === qHostelId);
  }

  // Search filtering (in JS for simplicity)
  const q = (search as string).trim().toLowerCase();
  if (q) {
    rows = rows.filter(s =>
      (s.name || "").toLowerCase().includes(q) ||
      (s.rollNumber || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.roomNumber || "").toLowerCase().includes(q) ||
      (s.assignedMess || "").toLowerCase().includes(q) ||
      (s.area || "").toLowerCase().includes(q)
    );
  }

  const total = rows.length;
  const lim = Math.min(Number(limit), 500);
  const off = Number(offset);
  const paginated = rows.slice(off, off + lim);

  res.json(paginated.map(s => ({ ...s, createdAt: s.createdAt.toISOString() })));
});

// GET /api/students/:id
router.get("/:id", requireAuth, async (req, res) => {
  const [student] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      rollNumber: usersTable.rollNumber,
      phone: usersTable.phone,
      contactNumber: usersTable.contactNumber,
      area: usersTable.area,
      hostelId: usersTable.hostelId,
      roomNumber: usersTable.roomNumber,
      assignedMess: usersTable.assignedMess,
      attendanceStatus: usersTable.attendanceStatus,
      createdAt: usersTable.createdAt,
      hostelName: hostelsTable.name,
    })
    .from(usersTable)
    .leftJoin(hostelsTable, eq(usersTable.hostelId, hostelsTable.id))
    .where(eq(usersTable.id, req.params.id));

  if (!student) { res.status(404).json({ error: "Not Found" }); return; }
  res.json({ ...student, createdAt: student.createdAt.toISOString() });
});

// POST /api/students
router.post("/", requireAdmin, async (req: AuthRequest, res) => {
  const { name, email, password, rollNumber, hostelId, roomNumber, phone, contactNumber, area, assignedMess } = req.body;
  if (!name || !email || !password || !rollNumber) {
    res.status(400).json({ error: "Bad Request", message: "Required fields missing" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(400).json({ error: "Bad Request", message: "Email already registered" });
    return;
  }

  const id = generateId();
  const passwordHash = hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({
      id, name, email: email.toLowerCase(), passwordHash,
      role: "student", rollNumber, hostelId, roomNumber,
      phone, contactNumber, area, assignedMess,
    })
    .returning();

  let hostelName: string | null = null;
  if (hostelId) {
    const [hostel] = await db.select().from(hostelsTable).where(eq(hostelsTable.id, hostelId));
    hostelName = hostel?.name ?? null;
  }

  res.status(201).json({
    id: user.id, name: user.name, email: user.email,
    rollNumber: user.rollNumber, hostelId: user.hostelId, hostelName,
    roomNumber: user.roomNumber, createdAt: user.createdAt.toISOString(),
  });
});

// PATCH /api/students/:id — update student details
router.patch("/:id", requireAdmin, async (req: AuthRequest, res) => {
  const { hostelId, roomNumber, assignedMess, attendanceStatus, phone, contactNumber, area } = req.body;
  const [user] = await db
    .update(usersTable)
    .set({
      ...(hostelId !== undefined && { hostelId }),
      ...(roomNumber !== undefined && { roomNumber }),
      ...(assignedMess !== undefined && { assignedMess }),
      ...(attendanceStatus !== undefined && { attendanceStatus }),
      ...(phone !== undefined && { phone }),
      ...(contactNumber !== undefined && { contactNumber }),
      ...(area !== undefined && { area }),
    })
    .where(eq(usersTable.id, req.params.id))
    .returning();

  if (!user) { res.status(404).json({ message: "Student not found" }); return; }
  res.json(user);
});

export default router;
