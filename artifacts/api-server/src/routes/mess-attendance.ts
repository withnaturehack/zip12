import { Router } from "express";
import { db, messAttendanceTable, usersTable, studentInventoryTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth, requireVolunteer, generateId, AuthRequest, COORDINATOR_ROLES } from "../lib/auth.js";

const router = Router();

function todayStr() { return new Date().toISOString().split("T")[0]; }

// POST /api/mess-attendance/:studentId — mark/toggle a student for a specific meal
router.post("/:studentId", requireVolunteer, async (req: AuthRequest, res) => {
  const { studentId } = req.params;
  const { meal, present = "true", date } = req.body;
  const targetDate = date || todayStr();

  if (!meal || !["breakfast", "lunch", "dinner", "snacks"].includes(meal)) {
    res.status(400).json({ message: "meal must be one of: breakfast, lunch, dinner, snacks" });
    return;
  }

  const [student] = await db.select({ id: usersTable.id, hostelId: usersTable.hostelId })
    .from(usersTable).where(eq(usersTable.id, studentId));

  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  // Upsert: delete existing for this student+meal+date then re-insert
  const [existing] = await db.select().from(messAttendanceTable)
    .where(and(eq(messAttendanceTable.studentId, studentId), eq(messAttendanceTable.meal, meal), eq(messAttendanceTable.date, targetDate)));

  if (existing) {
    // Toggle: if same present value, remove (toggle off); otherwise update
    const newPresent = existing.present === present ? (present === "true" ? "false" : "true") : present;
    const [updated] = await db.update(messAttendanceTable)
      .set({ present: newPresent, volunteerId: req.userId!, markedAt: new Date() })
      .where(eq(messAttendanceTable.id, existing.id))
      .returning();
    res.json({ ...updated, markedAt: updated.markedAt?.toISOString(), createdAt: updated.createdAt.toISOString() });
    return;
  }

  const [record] = await db.insert(messAttendanceTable).values({
    id: generateId(),
    studentId,
    volunteerId: req.userId!,
    hostelId: student.hostelId || "",
    date: targetDate,
    meal,
    present,
    markedAt: new Date(),
  }).returning();

  res.status(201).json({ ...record, markedAt: record.markedAt?.toISOString(), createdAt: record.createdAt.toISOString() });
});

// GET /api/mess-attendance — list today's mess attendance
router.get("/", requireVolunteer, async (req: AuthRequest, res) => {
  const { date, hostelId: filterHostelId, meal } = req.query;
  const targetDate = (date as string) || todayStr();

  const [caller] = await db.select({ role: usersTable.role, hostelId: usersTable.hostelId })
    .from(usersTable).where(eq(usersTable.id, req.userId!));

  const rows = await db.select({
    id: messAttendanceTable.id,
    studentId: messAttendanceTable.studentId,
    volunteerId: messAttendanceTable.volunteerId,
    hostelId: messAttendanceTable.hostelId,
    date: messAttendanceTable.date,
    meal: messAttendanceTable.meal,
    present: messAttendanceTable.present,
    markedAt: messAttendanceTable.markedAt,
    createdAt: messAttendanceTable.createdAt,
    studentName: usersTable.name,
    studentEmail: usersTable.email,
    studentRoom: usersTable.roomNumber,
    studentMess: usersTable.assignedMess,
  })
    .from(messAttendanceTable)
    .leftJoin(usersTable, eq(messAttendanceTable.studentId, usersTable.id))
    .where(eq(messAttendanceTable.date, targetDate))
    .orderBy(desc(messAttendanceTable.markedAt));

  let filtered = rows;

  // Scope non-coordinator to their hostel
  if (!COORDINATOR_ROLES.includes(caller?.role || "")) {
    filtered = filtered.filter(r => r.hostelId === caller?.hostelId);
  } else if (filterHostelId) {
    filtered = filtered.filter(r => r.hostelId === filterHostelId);
  }

  if (meal) filtered = filtered.filter(r => r.meal === meal);

  res.json(filtered.map(r => ({
    ...r,
    markedAt: r.markedAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
    present: r.present === "true",
  })));
});

// GET /api/mess-attendance/stats — today's mess card stats for dashboard
router.get("/stats", requireVolunteer, async (req: AuthRequest, res) => {
  const [caller] = await db.select({ role: usersTable.role, hostelId: usersTable.hostelId })
    .from(usersTable).where(eq(usersTable.id, req.userId!));

  const inventoryRows = await db.select({
    studentId: studentInventoryTable.studentId,
    hostelId: studentInventoryTable.hostelId,
    messCard: studentInventoryTable.messCard,
  }).from(studentInventoryTable);

  let relevant = inventoryRows;
  if (!COORDINATOR_ROLES.includes(caller?.role || "")) {
    relevant = inventoryRows.filter(r => r.hostelId === caller?.hostelId);
  }

  const cardGivenCount = relevant.filter(r => r.messCard === true).length;

  res.json({
    cardGivenCount,
    total: relevant.length,
  });
});

export default router;
