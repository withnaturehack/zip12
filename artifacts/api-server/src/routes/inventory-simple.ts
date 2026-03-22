import { Router } from "express";
import { db, studentInventoryTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireVolunteer, generateId, AuthRequest, COORDINATOR_ROLES } from "../lib/auth.js";

const router = Router();

const STUDENT_FIELDS = {
  id: usersTable.id,
  name: usersTable.name,
  phone: usersTable.phone,
  contactNumber: usersTable.contactNumber,
  rollNumber: usersTable.rollNumber,
  roomNumber: usersTable.roomNumber,
  hostelId: usersTable.hostelId,
};

// GET /api/inventory-simple?hostelId= - get inventory table (Name|Contact|Mattress|Bedsheet|Pillow)
router.get("/", requireVolunteer, async (req: AuthRequest, res) => {
  const { hostelId } = req.query;
  const [caller] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!caller) { res.status(401).json({ message: "Unauthorized" }); return; }

  const isCoordinator = COORDINATOR_ROLES.includes(caller.role as any);
  const targetHostelId = hostelId
    ? (hostelId as string)
    : caller.hostelId || "";

  // Non-coordinator without a hostelId → empty
  if (!targetHostelId && !isCoordinator) { res.json([]); return; }

  const students = targetHostelId
    ? await db.select(STUDENT_FIELDS).from(usersTable)
        .where(and(eq(usersTable.hostelId, targetHostelId), eq(usersTable.role, "student")))
    : await db.select(STUDENT_FIELDS).from(usersTable)
        .where(eq(usersTable.role, "student"));

  const inventoryRecords = targetHostelId
    ? await db.select().from(studentInventoryTable)
        .where(eq(studentInventoryTable.hostelId, targetHostelId))
    : await db.select().from(studentInventoryTable);

  const invMap: Record<string, typeof inventoryRecords[0]> = {};
  inventoryRecords.forEach(r => { invMap[r.studentId] = r; });

  const result = students.map(s => ({
    ...s,
    inventory: invMap[s.id] || { mattress: false, bedsheet: false, pillow: false },
  }));

  res.json(result);
});

// PATCH /api/inventory-simple/:studentId - update inventory (mattress, bedsheet, pillow)
router.patch("/:studentId", requireVolunteer, async (req: AuthRequest, res) => {
  const { mattress, bedsheet, pillow } = req.body;
  const { studentId } = req.params;

  const [student] = await db.select().from(usersTable).where(eq(usersTable.id, studentId));
  if (!student) { res.status(404).json({ message: "Student not found" }); return; }

  const [existing] = await db.select().from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, studentId));

  let record;
  if (existing) {
    [record] = await db.update(studentInventoryTable)
      .set({
        mattress: mattress !== undefined ? mattress : existing.mattress,
        bedsheet: bedsheet !== undefined ? bedsheet : existing.bedsheet,
        pillow: pillow !== undefined ? pillow : existing.pillow,
        updatedBy: req.userId!,
        updatedAt: new Date(),
      })
      .where(eq(studentInventoryTable.id, existing.id))
      .returning();
  } else {
    [record] = await db.insert(studentInventoryTable).values({
      id: generateId(),
      studentId,
      hostelId: student.hostelId || null,
      mattress: mattress || false,
      bedsheet: bedsheet || false,
      pillow: pillow || false,
      updatedBy: req.userId!,
    }).returning();
  }

  res.json(record);
});

// GET /api/inventory-simple/student/:studentId - single student inventory
router.get("/student/:studentId", requireAuth, async (req, res) => {
  const [inv] = await db.select().from(studentInventoryTable)
    .where(eq(studentInventoryTable.studentId, req.params.studentId));
  res.json(inv || { mattress: false, bedsheet: false, pillow: false });
});

export default router;
