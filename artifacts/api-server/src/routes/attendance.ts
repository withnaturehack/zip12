import { Router } from "express";
import { db, attendanceTable, usersTable, studentInventoryTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, requireVolunteer, generateId, AuthRequest, COORDINATOR_ROLES } from "../lib/auth.js";

const router = Router();

function todayStr() { return new Date().toISOString().split("T")[0]; }

// GET /api/attendance?hostelId=&date= — returns students with attendance + inventory data
router.get("/", requireVolunteer, async (req: AuthRequest, res) => {
  const { hostelId, date } = req.query;
  const targetDate = (date as string) || todayStr();
  const [caller] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!caller) { res.status(401).json({ message: "Unauthorized" }); return; }

  const isCoordPlus = COORDINATOR_ROLES.includes(caller.role || "");
  const targetHostelId = hostelId ? (hostelId as string) : (isCoordPlus ? null : (caller.hostelId || ""));

  // Volunteers without a hostel assignment → nothing to show
  if (!isCoordPlus && !targetHostelId) { res.json([]); return; }

  const students = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    rollNumber: usersTable.rollNumber,
    phone: usersTable.phone,
    contactNumber: usersTable.contactNumber,
    roomNumber: usersTable.roomNumber,
    assignedMess: usersTable.assignedMess,
    hostelId: usersTable.hostelId,
  }).from(usersTable).where(
    targetHostelId
      ? and(eq(usersTable.hostelId, targetHostelId), eq(usersTable.role, "student"))
      : eq(usersTable.role, "student")
  );

  const records = await db.select().from(attendanceTable).where(
    targetHostelId
      ? and(eq(attendanceTable.hostelId, targetHostelId), eq(attendanceTable.date, targetDate))
      : eq(attendanceTable.date, targetDate)
  );

  // Fetch inventory
  const inventoryRecords = await db.select().from(studentInventoryTable).where(
    targetHostelId ? eq(studentInventoryTable.hostelId, targetHostelId) : sql`1=1`
  );

  const recordMap: Record<string, typeof records[0]> = {};
  records.forEach(r => { recordMap[r.studentId] = r; });

  const inventoryMap: Record<string, typeof inventoryRecords[0]> = {};
  inventoryRecords.forEach(i => { inventoryMap[i.studentId] = i; });

  const result = students.map(s => ({
    ...s,
    attendance: recordMap[s.id] || { status: "not_entered", date: targetDate },
    hasAttendance: !!recordMap[s.id],
    inventory: inventoryMap[s.id] ? {
      mattress: inventoryMap[s.id].mattress,
      bedsheet: inventoryMap[s.id].bedsheet,
      pillow: inventoryMap[s.id].pillow,
    } : { mattress: false, bedsheet: false, pillow: false },
    hasInventory: !!inventoryMap[s.id],
  }));

  res.json(result);
});

// POST /api/attendance/:studentId — mark attendance
router.post("/:studentId", requireVolunteer, async (req: AuthRequest, res) => {
  const { status, mess } = req.body;
  const { studentId } = req.params;
  const date = todayStr();

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, studentId));
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  const hostelId = student.hostelId || "";
  const [existing] = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.studentId, studentId), eq(attendanceTable.date, date)));

  let record;
  if (existing) {
    [record] = await db.update(attendanceTable)
      .set({ status: status || "entered", volunteerId: req.userId!, mess: mess || student.assignedMess, updatedAt: new Date() })
      .where(eq(attendanceTable.id, existing.id))
      .returning();
  } else {
    [record] = await db.insert(attendanceTable).values({
      id: generateId(),
      studentId,
      volunteerId: req.userId!,
      hostelId,
      mess: mess || student.assignedMess || null,
      roomNumber: student.roomNumber || null,
      status: status || "entered",
      date,
    }).returning();
  }

  await db.update(usersTable).set({ attendanceStatus: status || "entered" }).where(eq(usersTable.id, studentId));
  res.json({ ...record, createdAt: record.createdAt?.toISOString(), updatedAt: record.updatedAt?.toISOString() });
});

// GET /api/attendance/stats — stats for today (all hostels)
router.get("/stats", requireVolunteer, async (_req: AuthRequest, res) => {
  const date = todayStr();
  const records = await db.select().from(attendanceTable).where(eq(attendanceTable.date, date));
  const entered = records.filter(r => r.status === "entered").length;
  const total = records.length;
  res.json({ date, total, entered, notEntered: total - entered });
});

// GET /api/attendance/student/:studentId — student's attendance history
router.get("/student/:studentId", requireAuth, async (req: AuthRequest, res) => {
  const records = await db.select().from(attendanceTable)
    .where(eq(attendanceTable.studentId, req.params.studentId));
  res.json(records.map(r => ({ ...r, createdAt: r.createdAt?.toISOString(), updatedAt: r.updatedAt?.toISOString() })));
});

// GET /api/attendance/inventory/:studentId — get inventory for a student
router.get("/inventory/:studentId", requireAuth, async (req: AuthRequest, res) => {
  const { studentId } = req.params;
  const [record] = await db.select().from(studentInventoryTable).where(eq(studentInventoryTable.studentId, studentId));
  res.json(record || { studentId, mattress: false, bedsheet: false, pillow: false });
});

// PATCH /api/attendance/inventory/:studentId — update inventory for a student
router.patch("/inventory/:studentId", requireVolunteer, async (req: AuthRequest, res) => {
  const { mattress, bedsheet, pillow } = req.body;
  const { studentId } = req.params;

  const [student] = await db.select({ hostelId: usersTable.hostelId }).from(usersTable).where(eq(usersTable.id, studentId));
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  const [existing] = await db.select().from(studentInventoryTable).where(eq(studentInventoryTable.studentId, studentId));

  if (existing) {
    const [updated] = await db.update(studentInventoryTable).set({
      mattress: mattress !== undefined ? mattress : existing.mattress,
      bedsheet: bedsheet !== undefined ? bedsheet : existing.bedsheet,
      pillow: pillow !== undefined ? pillow : existing.pillow,
      updatedBy: req.userId!,
      updatedAt: new Date(),
    }).where(eq(studentInventoryTable.studentId, studentId)).returning();
    res.json(updated);
  } else {
    const [record] = await db.insert(studentInventoryTable).values({
      id: generateId(),
      studentId,
      hostelId: student.hostelId || "",
      mattress: mattress || false,
      bedsheet: bedsheet || false,
      pillow: pillow || false,
      updatedBy: req.userId!,
    }).returning();
    res.json(record);
  }
});

export default router;
