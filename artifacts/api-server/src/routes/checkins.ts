import { Router } from "express";
import { db, checkinsTable, usersTable, hostelsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, requireVolunteer, requireAdmin, generateId, AuthRequest, COORDINATOR_ROLES } from "../lib/auth.js";

const router = Router();

function todayStr() { return new Date().toISOString().split("T")[0]; }

// POST /api/checkins/:studentId — mark student check-in
router.post("/:studentId", requireVolunteer, async (req: AuthRequest, res) => {
  const { studentId } = req.params;
  const { note } = req.body;
  const date = todayStr();

  const [student] = await db.select({
    id: usersTable.id,
    hostelId: usersTable.hostelId,
  }).from(usersTable).where(eq(usersTable.id, studentId));

  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  // Check for existing check-in today (no duplicates)
  const [existing] = await db.select().from(checkinsTable)
    .where(and(eq(checkinsTable.studentId, studentId), eq(checkinsTable.date, date)));

  if (existing) {
    res.json({ ...existing, checkInTime: existing.checkInTime?.toISOString() || null, checkOutTime: existing.checkOutTime?.toISOString() || null, alreadyCheckedIn: true });
    return;
  }

  const [record] = await db.insert(checkinsTable).values({
    id: generateId(),
    studentId,
    volunteerId: req.userId!,
    hostelId: student.hostelId || "",
    checkInTime: new Date(),
    date,
    note: note || null,
  }).returning();

  res.status(201).json({
    ...record,
    checkInTime: record.checkInTime?.toISOString() || null,
    checkOutTime: null,
    createdAt: record.createdAt.toISOString(),
  });
});

// PATCH /api/checkins/:id/checkout — mark checkout time
router.patch("/:id/checkout", requireVolunteer, async (req: AuthRequest, res) => {
  const [record] = await db.update(checkinsTable)
    .set({ checkOutTime: new Date() })
    .where(eq(checkinsTable.id, req.params.id))
    .returning();

  if (!record) { res.status(404).json({ message: "Checkin record not found" }); return; }
  res.json({
    ...record,
    checkInTime: record.checkInTime?.toISOString() || null,
    checkOutTime: record.checkOutTime?.toISOString() || null,
    createdAt: record.createdAt.toISOString(),
  });
});

// GET /api/checkins — list check-ins (with optional hostelId + date filters)
router.get("/", requireVolunteer, async (req: AuthRequest, res) => {
  const { hostelId, date, limit: rawLimit, offset: rawOffset } = req.query;
  const limit = Math.min(Number(rawLimit) || 100, 500);
  const offset = Number(rawOffset) || 0;
  const targetDate = (date as string) || todayStr();

  const [caller] = await db.select({
    role: usersTable.role,
    hostelId: usersTable.hostelId,
    assignedHostelIds: usersTable.assignedHostelIds,
  }).from(usersTable).where(eq(usersTable.id, req.userId!));

  const rows = await db.select({
    id: checkinsTable.id,
    studentId: checkinsTable.studentId,
    volunteerId: checkinsTable.volunteerId,
    hostelId: checkinsTable.hostelId,
    checkInTime: checkinsTable.checkInTime,
    checkOutTime: checkinsTable.checkOutTime,
    date: checkinsTable.date,
    note: checkinsTable.note,
    createdAt: checkinsTable.createdAt,
    studentName: usersTable.name,
    studentEmail: usersTable.email,
    studentRoll: usersTable.rollNumber,
    studentRoom: usersTable.roomNumber,
    studentMess: usersTable.assignedMess,
  }).from(checkinsTable)
    .leftJoin(usersTable, eq(checkinsTable.studentId, usersTable.id))
    .orderBy(desc(checkinsTable.checkInTime))
    .limit(limit)
    .offset(offset);

  let filtered = rows.filter(r => r.date === targetDate);

  // Scope non-superadmin/admin to their hostel
  if (!COORDINATOR_ROLES.includes(caller?.role || "")) {
    const myHostelId = caller?.hostelId || "";
    filtered = filtered.filter(r => r.hostelId === myHostelId);
  } else if (hostelId) {
    filtered = filtered.filter(r => r.hostelId === hostelId);
  }

  res.json(filtered.map(r => ({
    ...r,
    checkInTime: r.checkInTime?.toISOString() || null,
    checkOutTime: r.checkOutTime?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
  })));
});

// GET /api/checkins/stats — today's check-in counts
router.get("/stats", requireVolunteer, async (req: AuthRequest, res) => {
  const date = todayStr();
  const all = await db.select({
    id: checkinsTable.id,
    checkOutTime: checkinsTable.checkOutTime,
    hostelId: checkinsTable.hostelId,
  }).from(checkinsTable).where(eq(checkinsTable.date, date));

  const [caller] = await db.select({ role: usersTable.role, hostelId: usersTable.hostelId })
    .from(usersTable).where(eq(usersTable.id, req.userId!));

  let relevant = all;
  if (!COORDINATOR_ROLES.includes(caller?.role || "")) {
    relevant = all.filter(r => r.hostelId === caller?.hostelId);
  }

  res.json({
    date,
    total: relevant.length,
    checkedIn: relevant.length,
    checkedOut: relevant.filter(r => !!r.checkOutTime).length,
  });
});

export default router;
