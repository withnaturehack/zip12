import { Router } from "express";
import { db, checkinsTable, usersTable, studentInventoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireVolunteer, generateId, AuthRequest, COORDINATOR_ROLES } from "../lib/auth.js";

const router = Router();

function todayStr() { return new Date().toISOString().split("T")[0]; }

// Reset inventory to blank state (called on check-in or clear)
async function resetInventory(studentId: string, hostelId: string, updatedBy: string) {
  const [existing] = await db.select().from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, studentId));

  if (existing) {
    await db.update(studentInventoryTable).set({
      mattress: false,
      bedsheet: false,
      pillow: false,
      mattressSubmitted: false,
      bedsheetSubmitted: false,
      pillowSubmitted: false,
      inventoryLocked: false,
      messCard: false,
      lockedBy: null,
      lockedAt: null,
      updatedBy,
      updatedAt: new Date(),
    }).where(eq(studentInventoryTable.id, existing.id));
  } else {
    await db.insert(studentInventoryTable).values({
      id: generateId(),
      studentId,
      hostelId: hostelId || null,
      mattress: false,
      bedsheet: false,
      pillow: false,
      mattressSubmitted: false,
      bedsheetSubmitted: false,
      pillowSubmitted: false,
      inventoryLocked: false,
      messCard: false,
      updatedBy,
    });
  }
}

// POST /api/checkins/:studentId — mark student check-in (resets inventory)
router.post("/:studentId", requireVolunteer, async (req: AuthRequest, res) => {
  const { studentId } = req.params;
  const { note } = req.body;
  const date = todayStr();

  const [student] = await db.select({ id: usersTable.id, hostelId: usersTable.hostelId })
    .from(usersTable).where(eq(usersTable.id, studentId));

  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  // Check for existing check-in today
  const [existing] = await db.select().from(checkinsTable)
    .where(and(eq(checkinsTable.studentId, studentId), eq(checkinsTable.date, date)));

  if (existing) {
    res.json({
      ...existing,
      checkInTime: existing.checkInTime?.toISOString() || null,
      checkOutTime: existing.checkOutTime?.toISOString() || null,
      alreadyCheckedIn: true,
    });
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

  // Reset inventory fresh on every new check-in
  await resetInventory(studentId, student.hostelId || "", req.userId!);

  res.status(201).json({
    ...record,
    checkInTime: record.checkInTime?.toISOString() || null,
    checkOutTime: null,
    createdAt: record.createdAt.toISOString(),
  });
});

// PATCH /api/checkins/:id/checkout — check out (requires inventory locked)
router.patch("/:id/checkout", requireVolunteer, async (req: AuthRequest, res) => {
  const [checkin] = await db.select().from(checkinsTable).where(eq(checkinsTable.id, req.params.id));
  if (!checkin) { res.status(404).json({ message: "Checkin record not found" }); return; }

  const [inv] = await db.select().from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, checkin.studentId));

  if (!inv?.inventoryLocked) {
    res.status(400).json({ message: "Cannot check out: submit all given inventory items first." });
    return;
  }

  const [record] = await db.update(checkinsTable)
    .set({ checkOutTime: new Date() })
    .where(eq(checkinsTable.id, req.params.id))
    .returning();

  res.json({
    ...record,
    checkInTime: record.checkInTime?.toISOString() || null,
    checkOutTime: record.checkOutTime?.toISOString() || null,
    createdAt: record.createdAt.toISOString(),
  });
});

// DELETE /api/checkins/:studentId/today — clear today's check-in + reset inventory
router.delete("/:studentId/today", requireVolunteer, async (req: AuthRequest, res) => {
  const { studentId } = req.params;
  const date = todayStr();

  const [student] = await db.select({ id: usersTable.id, hostelId: usersTable.hostelId })
    .from(usersTable).where(eq(usersTable.id, studentId));

  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  // Delete today's check-in record
  await db.delete(checkinsTable)
    .where(and(eq(checkinsTable.studentId, studentId), eq(checkinsTable.date, date)));

  // Reset inventory
  await resetInventory(studentId, student.hostelId || "", req.userId!);

  res.json({ success: true, message: "Check-in and inventory cleared for today" });
});

// GET /api/checkins/:studentId/today — get today's check-in status for a student
router.get("/:studentId/today", requireVolunteer, async (req: AuthRequest, res) => {
  const { studentId } = req.params;
  const date = todayStr();

  const [checkin] = await db.select().from(checkinsTable)
    .where(and(eq(checkinsTable.studentId, studentId), eq(checkinsTable.date, date)));

  const [inv] = await db.select().from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, studentId));

  res.json({
    checkin: checkin ? {
      ...checkin,
      checkInTime: checkin.checkInTime?.toISOString() || null,
      checkOutTime: checkin.checkOutTime?.toISOString() || null,
      createdAt: checkin.createdAt.toISOString(),
    } : null,
    inventory: inv || {
      mattress: false, bedsheet: false, pillow: false,
      mattressSubmitted: false, bedsheetSubmitted: false, pillowSubmitted: false,
      inventoryLocked: false, messCard: false,
    },
  });
});

// GET /api/checkins — list check-ins
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

// GET /api/checkins/stats
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
