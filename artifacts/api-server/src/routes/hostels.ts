import { Router } from "express";
import { db, hostelsTable, emergencyContactsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, generateId, AuthRequest } from "../lib/auth.js";

const router = Router();

// GET /api/hostels
router.get("/", requireAuth, async (req, res) => {
  const hostels = await db.select().from(hostelsTable);
  res.json(hostels.map(h => ({ ...h, createdAt: h.createdAt.toISOString() })));
});

// GET /api/hostels/:id
router.get("/:id", requireAuth, async (req, res) => {
  const [hostel] = await db.select().from(hostelsTable).where(eq(hostelsTable.id, req.params.id));
  if (!hostel) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json({ ...hostel, createdAt: hostel.createdAt.toISOString() });
});

// POST /api/hostels
router.post("/", requireAdmin, async (req, res) => {
  const { name, location, totalRooms, wardenName, wardenPhone } = req.body;
  if (!name) {
    res.status(400).json({ error: "Bad Request", message: "Name required" });
    return;
  }

  const id = generateId();
  const [hostel] = await db
    .insert(hostelsTable)
    .values({ id, name, location, totalRooms, wardenName, wardenPhone })
    .returning();

  res.status(201).json({ ...hostel, createdAt: hostel.createdAt.toISOString() });
});

// GET /api/hostel/contacts
router.get("/contacts/mine", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user?.hostelId) {
    res.json([]);
    return;
  }
  const contacts = await db.select().from(emergencyContactsTable).where(eq(emergencyContactsTable.hostelId, user.hostelId));
  res.json(contacts.map(c => ({ ...c, isAvailable24x7: c.isAvailable24x7 === "true", createdAt: undefined })));
});

export default router;
