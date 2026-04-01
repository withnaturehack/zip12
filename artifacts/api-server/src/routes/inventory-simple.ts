import { Router } from "express";
import { db, studentInventoryTable, usersTable, checkinsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireVolunteer, generateId, AuthRequest, COORDINATOR_ROLES } from "../lib/auth.js";

const router = Router();

function todayStr() { return new Date().toISOString().split("T")[0]; }

// Auto-compute inventoryLocked: locked when all given items are also submitted
function computeLocked(inv: {
  mattress: boolean | null; bedsheet: boolean | null; pillow: boolean | null;
  mattressSubmitted: boolean | null; bedsheetSubmitted: boolean | null; pillowSubmitted: boolean | null;
}): boolean {
  const mattressOk = !inv.mattress || inv.mattressSubmitted;
  const bedsheetOk = !inv.bedsheet || inv.bedsheetSubmitted;
  const pillowOk = !inv.pillow || inv.pillowSubmitted;
  // At least one item must have been given for locking to apply
  const anyGiven = inv.mattress || inv.bedsheet || inv.pillow;
  return !!(anyGiven && mattressOk && bedsheetOk && pillowOk);
}

// GET /api/inventory-simple — list inventory for hostel
router.get("/", requireVolunteer, async (req: AuthRequest, res) => {
  const { hostelId } = req.query;
  const [caller] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!caller) { res.status(401).json({ message: "Unauthorized" }); return; }

  const isCoordinator = COORDINATOR_ROLES.includes(caller.role as any);
  const targetHostelId = hostelId ? (hostelId as string) : caller.hostelId || "";

  if (!targetHostelId && !isCoordinator) { res.json([]); return; }

  const students = targetHostelId
    ? await db.select({
        id: usersTable.id, name: usersTable.name, phone: usersTable.phone,
        contactNumber: usersTable.contactNumber, rollNumber: usersTable.rollNumber,
        roomNumber: usersTable.roomNumber, hostelId: usersTable.hostelId,
      }).from(usersTable).where(and(eq(usersTable.hostelId, targetHostelId), eq(usersTable.role, "student")))
    : await db.select({
        id: usersTable.id, name: usersTable.name, phone: usersTable.phone,
        contactNumber: usersTable.contactNumber, rollNumber: usersTable.rollNumber,
        roomNumber: usersTable.roomNumber, hostelId: usersTable.hostelId,
      }).from(usersTable).where(eq(usersTable.role, "student"));

  const inventoryRecords = targetHostelId
    ? await db.select().from(studentInventoryTable).where(eq(studentInventoryTable.hostelId, targetHostelId))
    : await db.select().from(studentInventoryTable);

  const invMap: Record<string, any> = {};
  inventoryRecords.forEach(r => { invMap[r.studentId] = r; });

  res.json(students.map(s => ({
    ...s,
    inventory: invMap[s.id] || {
      mattress: false, bedsheet: false, pillow: false,
      mattressSubmitted: false, bedsheetSubmitted: false, pillowSubmitted: false,
      messCard: false, inventoryLocked: false,
    },
  })));
});

// PATCH /api/inventory-simple/:studentId — update given state (mattress/bedsheet/pillow)
// Blocked if no check-in today
router.patch("/:studentId", requireVolunteer, async (req: AuthRequest, res) => {
  const { mattress, bedsheet, pillow } = req.body;
  const { studentId } = req.params;

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, studentId));
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  // Must have checked in today to give inventory
  const [checkin] = await db.select().from(checkinsTable)
    .where(and(eq(checkinsTable.studentId, studentId), eq(checkinsTable.date, todayStr())));

  if (!checkin) {
    res.status(400).json({ message: "Student must be checked in before giving inventory." });
    return;
  }
  if (checkin.checkOutTime) {
    res.status(400).json({ message: "Student has already checked out. Cannot modify inventory." });
    return;
  }

  const [existing] = await db.select().from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, studentId));

  const newMattress = mattress !== undefined ? mattress : (existing?.mattress ?? false);
  const newBedsheet = bedsheet !== undefined ? bedsheet : (existing?.bedsheet ?? false);
  const newPillow = pillow !== undefined ? pillow : (existing?.pillow ?? false);
  const newMattressSubmitted = existing?.mattressSubmitted ?? false;
  const newBedsheetSubmitted = existing?.bedsheetSubmitted ?? false;
  const newPillowSubmitted = existing?.pillowSubmitted ?? false;

  const locked = computeLocked({
    mattress: newMattress, bedsheet: newBedsheet, pillow: newPillow,
    mattressSubmitted: newMattressSubmitted, bedsheetSubmitted: newBedsheetSubmitted, pillowSubmitted: newPillowSubmitted,
  });

  let record;
  if (existing) {
    [record] = await db.update(studentInventoryTable).set({
      mattress: newMattress,
      bedsheet: newBedsheet,
      pillow: newPillow,
      inventoryLocked: locked,
      updatedBy: req.userId!,
      updatedAt: new Date(),
    }).where(eq(studentInventoryTable.id, existing.id)).returning();
  } else {
    [record] = await db.insert(studentInventoryTable).values({
      id: generateId(),
      studentId,
      hostelId: student.hostelId || null,
      mattress: newMattress,
      bedsheet: newBedsheet,
      pillow: newPillow,
      mattressSubmitted: false,
      bedsheetSubmitted: false,
      pillowSubmitted: false,
      inventoryLocked: locked,
      updatedBy: req.userId!,
    }).returning();
  }

  res.json(record);
});

// POST /api/inventory-simple/:studentId/submit — submit (lock) individual items
router.post("/:studentId/submit", requireVolunteer, async (req: AuthRequest, res) => {
  const { mattress: mattressSubmit, bedsheet: bedsheetSubmit, pillow: pillowSubmit } = req.body;
  const { studentId } = req.params;

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, studentId));
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  // Must have checked in today
  const [checkin] = await db.select().from(checkinsTable)
    .where(and(eq(checkinsTable.studentId, studentId), eq(checkinsTable.date, todayStr())));

  if (!checkin) {
    res.status(400).json({ message: "Student must be checked in before submitting inventory." });
    return;
  }
  if (checkin.checkOutTime) {
    res.status(400).json({ message: "Student has already checked out." });
    return;
  }

  const [existing] = await db.select().from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, studentId));

  if (!existing) {
    res.status(400).json({ message: "No inventory record found. Give inventory first." });
    return;
  }

  // Validate: can only submit items that were given
  if (mattressSubmit && !existing.mattress) {
    res.status(400).json({ message: "Cannot submit mattress: it was not given." });
    return;
  }
  if (bedsheetSubmit && !existing.bedsheet) {
    res.status(400).json({ message: "Cannot submit bedsheet: it was not given." });
    return;
  }
  if (pillowSubmit && !existing.pillow) {
    res.status(400).json({ message: "Cannot submit pillow: it was not given." });
    return;
  }

  const newMattressSubmitted = mattressSubmit !== undefined ? mattressSubmit : (existing.mattressSubmitted ?? false);
  const newBedsheetSubmitted = bedsheetSubmit !== undefined ? bedsheetSubmit : (existing.bedsheetSubmitted ?? false);
  const newPillowSubmitted = pillowSubmit !== undefined ? pillowSubmit : (existing.pillowSubmitted ?? false);

  const locked = computeLocked({
    mattress: existing.mattress, bedsheet: existing.bedsheet, pillow: existing.pillow,
    mattressSubmitted: newMattressSubmitted, bedsheetSubmitted: newBedsheetSubmitted, pillowSubmitted: newPillowSubmitted,
  });

  const now = new Date();
  const [record] = await db.update(studentInventoryTable).set({
    mattressSubmitted: newMattressSubmitted,
    bedsheetSubmitted: newBedsheetSubmitted,
    pillowSubmitted: newPillowSubmitted,
    inventoryLocked: locked,
    lockedBy: locked ? req.userId! : existing.lockedBy,
    lockedAt: locked ? now : existing.lockedAt,
    updatedBy: req.userId!,
    updatedAt: now,
  }).where(eq(studentInventoryTable.id, existing.id)).returning();

  res.json(record);
});

// PATCH /api/inventory-simple/:studentId/mess-card — toggle mess card
router.patch("/:studentId/mess-card", requireVolunteer, async (req: AuthRequest, res) => {
  const { studentId } = req.params;
  const { messCard } = req.body;

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, studentId));
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  const [existing] = await db.select().from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, studentId));

  const newValue = messCard !== undefined ? !!messCard : !(existing?.messCard ?? false);

  let record;
  if (existing) {
    [record] = await db.update(studentInventoryTable)
      .set({ messCard: newValue, updatedBy: req.userId!, updatedAt: new Date() })
      .where(eq(studentInventoryTable.id, existing.id))
      .returning();
  } else {
    [record] = await db.insert(studentInventoryTable).values({
      id: generateId(),
      studentId,
      hostelId: student.hostelId || null,
      mattress: false, bedsheet: false, pillow: false,
      mattressSubmitted: false, bedsheetSubmitted: false, pillowSubmitted: false,
      messCard: newValue,
      inventoryLocked: false,
      updatedBy: req.userId!,
    }).returning();
  }

  res.json({ ...record, messCard: newValue });
});

// GET /api/inventory-simple/student/:studentId — single student inventory
router.get("/student/:studentId", requireAuth, async (req, res) => {
  const [inv] = await db.select().from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, req.params.studentId));
  res.json(inv || {
    mattress: false, bedsheet: false, pillow: false,
    mattressSubmitted: false, bedsheetSubmitted: false, pillowSubmitted: false,
    inventoryLocked: false,
  });
});

export default router;
