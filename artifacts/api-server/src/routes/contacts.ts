import { Router } from "express";
import { db, emergencyContactsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, generateId, AuthRequest } from "../lib/auth.js";

const router = Router();

// GET /api/hostel/contacts
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  // Return all contacts: global ones (hostelId="") + user's hostel-specific ones
  const allContacts = await db.select().from(emergencyContactsTable);
  const contacts = allContacts.filter(c =>
    !c.hostelId || c.hostelId === "" || c.hostelId === user?.hostelId
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
