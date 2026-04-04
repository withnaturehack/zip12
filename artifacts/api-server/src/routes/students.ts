import { Router } from "express";
import { db, usersTable, hostelsTable, studentInventoryTable, checkinsTable } from "@workspace/db";
import { and, eq, inArray, ilike, or, count, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, requireVolunteer, generateId, hashPassword, AuthRequest } from "../lib/auth.js";

const router = Router();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// GET /api/students — volunteers see only their hostel, coordinators/admins see assigned hostels
router.get("/", requireVolunteer, async (req: AuthRequest, res) => {
  const { limit = "100", offset = "0", search = "", hostelId: qHostelId, page } = req.query;

  const [caller] = await db.select({
    id: usersTable.id,
    role: usersTable.role,
    hostelId: usersTable.hostelId,
    assignedHostelIds: usersTable.assignedHostelIds,
  }).from(usersTable).where(eq(usersTable.id, req.userId!));

  if (!caller) { res.status(401).json({ message: "Unauthorized" }); return; }

  // Resolve page -> offset
  const lim = Math.min(Number(limit), 500);
  const off = page ? (Number(page) - 1) * lim : Number(offset);

  const q = (search as string).trim();

  // Build hostel scope filter
  let hostelFilter: string[] | null = null; // null = all

  if (caller.role === "volunteer") {
    if (!caller.hostelId) {
      res.json({ students: [], total: 0, page: off / lim + 1, limit: lim });
      return;
    }
    hostelFilter = [caller.hostelId];
  } else if (caller.role === "coordinator" || caller.role === "admin") {
    const assignedIds = JSON.parse(caller.assignedHostelIds || "[]") as string[];
    if (assignedIds.length > 0) {
      hostelFilter = assignedIds;
    }
    // Superadmin-like: if no assigned hostels, they see all (shouldn't happen in practice)
  }

  // Additional hostelId filter from query param
  if (qHostelId) {
    const qh = qHostelId as string;
    if (!hostelFilter || hostelFilter.includes(qh)) {
      hostelFilter = [qh];
    }
  }

  // Build where conditions
  const conditions: any[] = [eq(usersTable.role, "student")];
  if (hostelFilter) {
    conditions.push(inArray(usersTable.hostelId, hostelFilter));
  }
  if (q) {
    conditions.push(
      or(
        ilike(usersTable.name, `%${q}%`),
        ilike(usersTable.email, `%${q}%`),
        ilike(usersTable.rollNumber, `%${q}%`),
        ilike(usersTable.roomNumber, `%${q}%`),
        ilike(usersTable.assignedMess, `%${q}%`),
        ilike(usersTable.area, `%${q}%`),
        ilike(usersTable.hostelId, `%${q}%`),
      )
    );
  }

  const whereClause = and(...conditions);

  // Count total matching
  const [{ total }] = await db
    .select({ total: count() })
    .from(usersTable)
    .where(whereClause);

  // Fetch paginated results
  const rows = await db
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
    .where(whereClause)
    .orderBy(usersTable.name)
    .limit(lim)
    .offset(off);

  const studentIds = rows.map(s => s.id);

  const inventoryRows = studentIds.length
    ? await db.select({
        studentId: studentInventoryTable.studentId,
        messCard: studentInventoryTable.messCard,
        messCardGivenAt: studentInventoryTable.messCardGivenAt,
        messCardRevokedAt: studentInventoryTable.messCardRevokedAt,
      }).from(studentInventoryTable).where(inArray(studentInventoryTable.studentId, studentIds))
    : [];

  const checkinRows = studentIds.length
    ? await db.select({
        studentId: checkinsTable.studentId,
        checkInTime: checkinsTable.checkInTime,
        checkOutTime: checkinsTable.checkOutTime,
      }).from(checkinsTable).where(and(
        inArray(checkinsTable.studentId, studentIds),
        eq(checkinsTable.date, todayStr()),
      ))
    : [];

  const inventoryMap = new Map(inventoryRows.map(r => [r.studentId, r]));
  const checkinMap = new Map<string, { checkInTime: Date | null; checkOutTime: Date | null }>();
  for (const row of checkinRows) {
    const prev = checkinMap.get(row.studentId);
    if (!prev || (row.checkInTime?.getTime() || 0) >= (prev.checkInTime?.getTime() || 0)) {
      checkinMap.set(row.studentId, { checkInTime: row.checkInTime, checkOutTime: row.checkOutTime });
    }
  }

  const students = rows.map(s => {
    const inv = inventoryMap.get(s.id);
    const checkin = checkinMap.get(s.id);
    return {
      ...s,
      messCard: !!inv?.messCard,
      messCardGivenAt: inv?.messCardGivenAt?.toISOString() || null,
      messCardRevokedAt: inv?.messCardRevokedAt?.toISOString() || null,
      checkInTime: checkin?.checkInTime?.toISOString() || null,
      checkOutTime: checkin?.checkOutTime?.toISOString() || null,
      createdAt: s.createdAt.toISOString(),
    };
  });

  // Support both legacy (array) and new (paginated object) consumers
  res.json({ students, total: Number(total), page: Math.floor(off / lim) + 1, limit: lim });
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
    .where(and(eq(usersTable.id, req.params.id), eq(usersTable.role, "student")));

  if (!student) { res.status(404).json({ error: "Not Found" }); return; }

  const [inv] = await db.select({
    messCard: studentInventoryTable.messCard,
    messCardGivenAt: studentInventoryTable.messCardGivenAt,
    messCardRevokedAt: studentInventoryTable.messCardRevokedAt,
  }).from(studentInventoryTable).where(eq(studentInventoryTable.studentId, req.params.id));

  const [todayCheckin] = await db.select({
    checkInTime: checkinsTable.checkInTime,
    checkOutTime: checkinsTable.checkOutTime,
  }).from(checkinsTable).where(and(
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
    .values({ id, name, email: email.toLowerCase(), passwordHash, role: "student", rollNumber, hostelId, roomNumber, phone, contactNumber, area, assignedMess })
    .returning();

  const hostelName = hostelId
    ? (await db.select({ name: hostelsTable.name }).from(hostelsTable).where(eq(hostelsTable.id, hostelId)))[0]?.name ?? null
    : null;

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
