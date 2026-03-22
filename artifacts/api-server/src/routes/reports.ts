import { Router } from "express";
import {
  db,
  usersTable,
  hostelsTable,
  lostItemsTable,
  announcementsTable,
} from "@workspace/db";
import { eq, count, or } from "drizzle-orm";
import {
  requireSuperAdmin,
  requireAdmin,
  generateId,
  hashPassword,
  AuthRequest,
  COORDINATOR_ROLES,
} from "../lib/auth.js";

const router = Router();

// GET /api/reports/summary — accessible to coordinators and above
router.get("/summary", requireAdmin, async (_req, res) => {
  const [studentsCount] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "student"));
  const [hostelsCount] = await db.select({ count: count() }).from(hostelsTable);
  const [announcementsCount] = await db.select({ count: count() }).from(announcementsTable);
  const lostItems = await db.select({ status: lostItemsTable.status }).from(lostItemsTable);
  const foundItems = lostItems.filter(i => i.status === "found" || i.status === "claimed").length;

  res.json({
    totalStudents: Number(studentsCount.count),
    totalHostels: Number(hostelsCount.count),
    totalLostItems: lostItems.length,
    foundItems,
    totalAnnouncements: Number(announcementsCount.count),
    recentActivity: [],
  });
});

// GET /api/admin/admin-users — list admin and superadmin accounts
router.get("/admin-users", requireSuperAdmin, async (_req, res) => {
  const users = await db.select().from(usersTable)
    .where(or(eq(usersTable.role, "admin"), eq(usersTable.role, "superadmin")));
  res.json(users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  })));
});

// POST /api/admin/admin-users — create admin/superadmin
router.post("/admin-users", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: "Bad Request", message: "All fields required" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(400).json({ error: "Conflict", message: "Email already registered" });
    return;
  }
  const id = generateId();
  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable)
    .values({ id, name, email: email.toLowerCase(), passwordHash, role, assignedHostelIds: "[]", isActive: true })
    .returning();
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt.toISOString() });
});

// DELETE /api/admin/admin-users/:id
router.delete("/admin-users/:id", requireSuperAdmin, async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
  res.json({ success: true });
});

export default router;
