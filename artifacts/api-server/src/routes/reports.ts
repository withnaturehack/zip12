import { Router } from "express";
import {
  db,
  usersTable,
  hostelsTable,
  lostItemsTable,
  announcementsTable,
} from "@workspace/db";
import { eq, count, or, sql } from "drizzle-orm";
import {
  requireSuperAdmin,
  requireAdmin,
  generateId,
  hashPassword,
  AuthRequest,
} from "../lib/auth.js";

const router = Router();

// GET /api/reports/summary
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

// GET /api/admin/admin-users — list ALL staff (volunteers, coordinators, admins, superadmins)
router.get("/admin-users", requireSuperAdmin, async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      isActive: usersTable.isActive,
      phone: usersTable.phone,
      area: usersTable.area,
      hostelId: usersTable.hostelId,
      assignedHostelIds: usersTable.assignedHostelIds,
      lastActiveAt: usersTable.lastActiveAt,
      createdAt: usersTable.createdAt,
      hostelName: hostelsTable.name,
    })
    .from(usersTable)
    .leftJoin(hostelsTable, eq(usersTable.hostelId, hostelsTable.id))
    .where(
      sql`${usersTable.role} IN ('volunteer','coordinator','admin','superadmin')`
    )
    .orderBy(usersTable.role, usersTable.name);

  res.json(users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    phone: u.phone,
    area: u.area,
    hostelId: u.hostelId,
    hostelName: u.hostelName,
    assignedHostelIds: JSON.parse(u.assignedHostelIds || "[]"),
    lastActiveAt: u.lastActiveAt?.toISOString() || null,
    createdAt: u.createdAt.toISOString(),
  })));
});

// POST /api/admin/admin-users — create any staff account (volunteer/coordinator/admin/superadmin)
router.post("/admin-users", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { name, email, password, role, hostelId, assignedHostelIds, phone, area } = req.body;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: "Bad Request", message: "Name, email, password, and role are required" });
    return;
  }
  const allowed = ["volunteer", "coordinator", "admin", "superadmin"];
  if (!allowed.includes(role)) {
    res.status(400).json({ error: "Bad Request", message: "Invalid role" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(400).json({ error: "Conflict", message: "Email already registered" });
    return;
  }
  const id = generateId();
  const passwordHash = hashPassword(password);
  const ids = Array.isArray(assignedHostelIds) ? assignedHostelIds : [];
  const [user] = await db.insert(usersTable)
    .values({
      id, name, email: email.toLowerCase(), passwordHash, role,
      hostelId: hostelId || null,
      assignedHostelIds: JSON.stringify(ids),
      phone: phone || null,
      area: area || null,
      isActive: true,
    })
    .returning();
  res.status(201).json({
    id: user.id, name: user.name, email: user.email, role: user.role,
    hostelId: user.hostelId, assignedHostelIds: JSON.parse(user.assignedHostelIds || "[]"),
    createdAt: user.createdAt.toISOString(),
  });
});

// PATCH /api/admin/admin-users/:id — update staff details
router.patch("/admin-users/:id", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { name, hostelId, assignedHostelIds, phone, area, role } = req.body;
  const updates: Record<string, any> = {};
  if (name !== undefined) updates.name = name;
  if (hostelId !== undefined) updates.hostelId = hostelId || null;
  if (assignedHostelIds !== undefined) updates.assignedHostelIds = JSON.stringify(Array.isArray(assignedHostelIds) ? assignedHostelIds : []);
  if (phone !== undefined) updates.phone = phone;
  if (area !== undefined) updates.area = area;
  if (role !== undefined) updates.role = role;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.params.id)).returning();
  if (!user) { res.status(404).json({ message: "User not found" }); return; }
  res.json({
    id: user.id, name: user.name, email: user.email, role: user.role,
    hostelId: user.hostelId, assignedHostelIds: JSON.parse(user.assignedHostelIds || "[]"),
  });
});

// DELETE /api/admin/admin-users/:id
router.delete("/admin-users/:id", requireSuperAdmin, async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
  res.json({ success: true });
});

// PATCH /api/admin/assign-hostel/:id — assign hostel(s) to a staff member
router.patch("/assign-hostel/:id", requireSuperAdmin, async (req: AuthRequest, res) => {
  const { hostelId, assignedHostelIds } = req.body;
  const updates: Record<string, any> = {};

  if (hostelId !== undefined) updates.hostelId = hostelId || null;
  if (assignedHostelIds !== undefined) {
    updates.assignedHostelIds = JSON.stringify(Array.isArray(assignedHostelIds) ? assignedHostelIds : []);
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, req.params.id)).returning();
  if (!user) { res.status(404).json({ message: "User not found" }); return; }

  res.json({
    id: user.id, name: user.name, role: user.role,
    hostelId: user.hostelId,
    assignedHostelIds: JSON.parse(user.assignedHostelIds || "[]"),
  });
});

export default router;
