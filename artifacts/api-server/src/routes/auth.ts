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
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Bad Request", message: "Email and password required" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase()));

    if (!user) {
      return res.status(401).json({ error: "Unauthorized", message: "User not found" });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
    }

    // Block pending users from logging in
    if (user.role === "pending") {
      return res.status(403).json({
        error: "Pending",
        message: "Your account is pending approval from the Super Admin. Please wait for approval before logging in.",
        isPending: true,
      });
    }

    const token = generateToken(user.id, user.role);

    return res.json({
      success: true,
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
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ error: "Internal Server Error", message: "Something went wrong" });
  }
});

// POST /api/auth/register — sets role to "pending", no token issued
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, rollNumber } = req.body;

    if (!name || !email || !password || !rollNumber) {
      return res.status(400).json({ error: "Bad Request", message: "All fields required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const passwordHash = await hashPassword(password);
    const id = generateId();

    await db.insert(usersTable).values({
      id,
      name,
      email: cleanEmail,
      passwordHash,
      role: "pending",
      rollNumber,
      isActive: false,
    });

    return res.status(201).json({
      success: true,
      pending: true,
      message: "Registration successful! Your account is pending approval from the Super Admin. You will be notified once approved.",
    });
  } catch (err: any) {
    console.error("REGISTER ERROR:", err);
    if (err?.code === "23505") {
      return res.status(400).json({ error: "Conflict", message: "Email or roll number already registered" });
    }
    return res.status(500).json({ error: "Internal Server Error", message: "Something went wrong" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));

    if (!user) {
      return res.status(404).json({ error: "Not Found", message: "User not found" });
    }

    return res.json({
      success: true,
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
  } catch (err) {
    console.error("ME ERROR:", err);
    return res.status(500).json({ error: "Internal Server Error", message: "Something went wrong" });
  }
});

export default router;
