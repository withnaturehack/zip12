import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  generateId,
  generateToken,
  hashPassword,
  comparePassword,
  requireAuth,
  AuthRequest,
} from "../lib/auth.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Bad Request", message: "Email and password required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.trim().toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Unauthorized", message: "User not found" });
    return;
  }

  const isMatch = await comparePassword(password, user.passwordHash);

  if (!isMatch) {
    res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    return;
  }

  const token = generateToken(user.id, user.role);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      rollNumber: user.rollNumber,
      hostelId: user.hostelId,
      roomNumber: user.roomNumber,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

// POST /api/auth/register
// Handles burst registrations safely: no pre-check SELECT, relies on
// the DB unique constraint so 300 concurrent requests don't race.
router.post("/register", async (req, res) => {
  const { name, email, password, rollNumber } = req.body;

  if (!name || !email || !password || !rollNumber) {
    res.status(400).json({ error: "Bad Request", message: "All fields required" });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const passwordHash = await hashPassword(password);
    const id = generateId();

    const [user] = await db
      .insert(usersTable)
      .values({ id, name, email: cleanEmail, passwordHash, role: "student", rollNumber })
      .returning();

    const token = generateToken(user.id, user.role);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        rollNumber: user.rollNumber,
        hostelId: user.hostelId,
        roomNumber: user.roomNumber,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (err: any) {
    // Postgres unique_violation code 23505 means duplicate email/rollNumber
    if (err?.code === "23505") {
      res.status(400).json({ error: "Conflict", message: "Email or roll number already registered" });
      return;
    }
    throw err;
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "Not Found", message: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    rollNumber: user.rollNumber,
    hostelId: user.hostelId,
    roomNumber: user.roomNumber,
    phone: user.phone,
    contactNumber: user.contactNumber,
    area: user.area,
    assignedMess: user.assignedMess,
    assignedHostelIds: user.assignedHostelIds,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
