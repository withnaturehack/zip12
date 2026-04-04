import { Router } from "express";
import { db, usersTable, hostelsTable, studentInventoryTable, checkinsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, requireVolunteer, generateId, hashPassword, AuthRequest } from "../lib/auth.js";

const router = Router();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

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

  // Role-based filtering — enforce hostel scope
  if (caller.role === "volunteer") {
    rows = rows.filter(s => s.hostelId === caller.hostelId);
  } else if (caller.role === "coordinator" || caller.role === "admin") {
    const assignedIds = JSON.parse(caller.assignedHostelIds || "[]") as string[];
    if (assignedIds.length > 0) {
      rows = rows.filter(s => assignedIds.includes(s.hostelId || ""));
    }
    if (qHostelId && (assignedIds.length === 0 || assignedIds.includes(qHostelId as string))) {
      rows = rows.filter(s => s.hostelId === qHostelId);
    }
  } else if (caller.role === "superadmin") {
    if (qHostelId) rows = rows.filter(s => s.hostelId === qHostelId);
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

  const lim = Math.min(Number(limit), 500);
  const off = Number(offset);
  const paginated = rows.slice(off, off + lim);

  const studentIds = paginated.map(s => s.id);
  const inventoryRows = studentIds.length
    ? await db
      .select({
        studentId: studentInventoryTable.studentId,
        messCard: studentInventoryTable.messCard,
        messCardGivenAt: studentInventoryTable.messCardGivenAt,
        messCardRevokedAt: studentInventoryTable.messCardRevokedAt,
      })
      .from(studentInventoryTable)
      .where(inArray(studentInventoryTable.studentId, studentIds))
    : [];

  const checkinRows = studentIds.length
    ? await db
      .select({
        studentId: checkinsTable.studentId,
        checkInTime: checkinsTable.checkInTime,
        checkOutTime: checkinsTable.checkOutTime,
      })
      .from(checkinsTable)
      .where(and(
        inArray(checkinsTable.studentId, studentIds),
        eq(checkinsTable.date, todayStr()),
      ))
    : [];

  const inventoryByStudentId = new Map(
    inventoryRows.map(row => [row.studentId, row]),
  );

  const checkinByStudentId = new Map<string, { checkInTime: Date | null; checkOutTime: Date | null }>();
  for (const row of checkinRows) {
    const prev = checkinByStudentId.get(row.studentId);
    const rowTs = row.checkInTime?.getTime() || 0;
    const prevTs = prev?.checkInTime?.getTime() || 0;
    if (!prev || rowTs >= prevTs) {
      checkinByStudentId.set(row.studentId, {
        checkInTime: row.checkInTime,
        checkOutTime: row.checkOutTime,
      });
    }
  }

  res.json(paginated.map(s => {
    const inv = inventoryByStudentId.get(s.id);
    const checkin = checkinByStudentId.get(s.id);
    return {
      ...s,
      messCard: !!inv?.messCard,
      messCardGivenAt: inv?.messCardGivenAt?.toISOString() || null,
      messCardRevokedAt: inv?.messCardRevokedAt?.toISOString() || null,
      checkInTime: checkin?.checkInTime?.toISOString() || null,
      checkOutTime: checkin?.checkOutTime?.toISOString() || null,
      createdAt: s.createdAt.toISOString(),
    };
  }));
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

  const [inv] = await db
    .select({
      messCard: studentInventoryTable.messCard,
      messCardGivenAt: studentInventoryTable.messCardGivenAt,
      messCardRevokedAt: studentInventoryTable.messCardRevokedAt,
    })
    .from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, req.params.id));

  const [todayCheckin] = await db
    .select({
      checkInTime: checkinsTable.checkInTime,
      checkOutTime: checkinsTable.checkOutTime,
    })
    .from(checkinsTable)
    .where(and(
      eq(checkinsTable.studentId, req.params.id),
      eq(checkinsTable.date, todayStr()),
    ));

  res.json({
    ...student,
    messCard: !!inv?.messCard,
    messCardGivenAt: inv?.messCardGivenAt?.toISOString() || null,
    messCardRevokedAt: inv?.messCardRevokedAt?.toISOString() || null,
    checkInTime: todayCheckin?.checkInTime?.toISOString() || null,
    checkOutTime: todayCheckin?.checkOutTime?.toISOString() || null,
    createdAt: student.createdAt.toISOString(),
  });
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
