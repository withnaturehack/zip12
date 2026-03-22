import { Router } from "express";
import { db, emergencyContactsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, generateId, AuthRequest } from "../lib/auth.js";

const router = Router();

// GET /api/hostel/contacts?hostelId=xxx
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  // Use query param hostelId if provided, otherwise fall back to the caller's own hostelId
  const queryHostelId = req.query.hostelId as string | undefined;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  const targetHostelId = queryHostelId || user?.hostelId || "";

  const allContacts = await db.select().from(emergencyContactsTable);
  const contacts = allContacts.filter(c =>
    !c.hostelId || c.hostelId === "" || c.hostelId === targetHostelId
  );
  res.json(contacts.map(c => ({ ...c, isAvailable24x7: c.isAvailable24x7 === "true" })));
});

// POST /api/hostel/contacts
router.post("/", requireAdmin, async (req, res) => {
  const { hostelId, name, role, phone, isAvailable24x7 } = req.body;
  if (!name || !role || !phone) {
    res.status(400).json({ error: "Bad Request", message: "name, role, phone required" });
    return;
  }

  const id = generateId();
  const [contact] = await db
    .insert(emergencyContactsTable)
    .values({ id, hostelId: hostelId || "", name, role, phone, isAvailable24x7: isAvailable24x7 ? "true" : "false" })
    .returning();

  res.status(201).json({ ...contact, isAvailable24x7: contact.isAvailable24x7 === "true" });
});

export default router;
