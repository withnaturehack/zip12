import {
  db,
  usersTable,
  hostelsTable,
  announcementsTable,
  notificationsTable,
  emergencyContactsTable,
  studentInventoryTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";

function generateId() { return crypto.randomBytes(8).toString("hex"); }
async function hashPassword(p: string) { return bcrypt.hash(p, 8); }

// 50 realistic Indian student names
const STUDENT_NAMES = [
  "Arjun Kumar","Priya Sharma","Rahul Verma","Ananya Singh","Vikram Patel",
  "Kavya Reddy","Rohit Gupta","Sneha Nair","Aditya Joshi","Pooja Iyer",
  "Karthik Menon","Divya Rao","Siddharth Mishra","Meghna Das","Nikhil Tiwari",
  "Ruchika Agarwal","Varun Bhat","Pallavi Shetty","Manish Pandey","Shreya Pillai",
  "Aarav Mahajan","Tanvi Chandra","Dhruv Naidu","Ishaan Saxena","Lakshmi Subramaniam",
  "Yash Kothari","Nandini Krishnan","Shivam Malhotra","Anjali Dubey","Pranav Goyal",
  "Swathi Venkat","Tarun Choudhary","Kriti Bansal","Gaurav Srivastava","Aditi Kulkarni",
  "Deepak Rajput","Simran Kapoor","Rajesh Nambiar","Neha Jain","Akash Bose",
  "Vidya Hegde","Aman Garg","Riya Chatterjee","Sanjay Pillai","Manya Bhatt",
  "Rohan Mathur","Sania Farooq","Chirag Desai","Bhavna Patil","Utkarsh Shukla",
];

const AREAS = ["Computer Science","Data Science","Mathematics","Electronic Systems","Physics","Chemistry","Humanities","Economics"];
const MESSES = ["Mess A","Mess B","Mess C"];
const HOSTELS_DATA = [
  { name: "Hostel Gurunath", location: "North Campus, IIT Madras", wardenName: "Dr. Ramesh Babu", wardenPhone: "+91 9876543210", totalRooms: 120 },
  { name: "Hostel Godavari", location: "South Campus, IIT Madras", wardenName: "Dr. Meena Iyer", wardenPhone: "+91 9876543211", totalRooms: 90 },
];

function genRollNumber(i: number) {
  const year = 21 + Math.floor(i / 30);
  return `${year}f${String(3000000 + i).padStart(7, "0")}`;
}

function genPhone(i: number) {
  return `+91 ${String(9000000000 + i)}`;
}

function genRoom(hostelIdx: number, i: number) {
  const block = String.fromCharCode(65 + (i % 5));
  const room = 100 + (i % 30) + 1;
  return `${block}-${room}`;
}

export async function autoSeed() {
  try {
    // --- Hostels ---
    const existingHostels = await db.select().from(hostelsTable);
    let hostelIds: string[] = [];

    if (existingHostels.length === 0) {
      for (const h of HOSTELS_DATA) {
        const id = generateId();
        await db.insert(hostelsTable).values({ id, ...h });
        hostelIds.push(id);
      }
      console.log("[seed] Hostels created");
    } else {
      hostelIds = existingHostels.map(h => h.id);
    }

    const [hostelId1, hostelId2] = [hostelIds[0], hostelIds[1] || hostelIds[0]];

    // --- Staff Demo Accounts ---
    const staffAccounts = [
      { email: "volunteer@iitm.ac.in", name: "Priya Volunteer", role: "volunteer", hostelId: hostelId1, area: "Operations" },
      { email: "coordinator@iitm.ac.in", name: "Ravi Admin", role: "admin", assignedHostelIds: JSON.stringify([hostelId1, hostelId2]), area: "Administration" },
      { email: "admin@iitm.ac.in", name: "Admin IITM", role: "admin", assignedHostelIds: JSON.stringify([hostelId1, hostelId2]) },
      { email: "superadmin@iitm.ac.in", name: "Super Admin", role: "superadmin" },
      { email: "volunteer2@iitm.ac.in", name: "Suresh Volunteer", role: "volunteer", hostelId: hostelId2, area: "Operations" },
    ];

    for (const u of staffAccounts) {
      const [ex] = await db.select().from(usersTable).where(eq(usersTable.email, u.email));
      if (!ex) {
        await db.insert(usersTable).values({
          id: generateId(), name: u.name, email: u.email,
          passwordHash: await hashPassword("123456"), role: u.role,
          hostelId: (u as any).hostelId, area: (u as any).area,
          assignedHostelIds: (u as any).assignedHostelIds || "[]",
          phone: `+91 987654${String(3000 + staffAccounts.indexOf(u)).padStart(4, "0")}`,
          isActive: true,
        });
        console.log(`[seed] Created ${u.role}: ${u.email}`);
      }
    }

    // --- Bulk Student Seeding (50 students) ---
    const [{ count: studentCount }] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "student"));
    const currentCount = Number(studentCount);

    if (currentCount < 50) {
      const toCreate = 50 - currentCount;
      const existing = await db.select({ email: usersTable.email }).from(usersTable);
      const existingEmails = new Set(existing.map(u => u.email));
      const passwordHash = await hashPassword("123456");

      let created = 0;
      for (let i = 0; i < STUDENT_NAMES.length && created < toCreate; i++) {
        const name = STUDENT_NAMES[i];
        const email = `${name.toLowerCase().replace(/\s+/g, ".")}@iitm.ac.in`;
        if (existingEmails.has(email)) continue;

        const hostelId = i % 3 === 0 ? hostelId2 : hostelId1;
        const hostelIdx = i % 3 === 0 ? 1 : 0;

        await db.insert(usersTable).values({
          id: generateId(),
          name,
          email,
          passwordHash,
          role: "student",
          rollNumber: genRollNumber(i),
          phone: genPhone(9876000 + i),
          contactNumber: String(9876000000 + i),
          hostelId,
          roomNumber: genRoom(hostelIdx, i),
          assignedMess: MESSES[i % MESSES.length],
          attendanceStatus: i % 5 === 0 ? "entered" : "not_entered",
          area: AREAS[i % AREAS.length],
          isActive: true,
          assignedHostelIds: "[]",
        });
        existingEmails.add(email);
        created++;
      }
      console.log(`[seed] Created ${created} students (total now ~${currentCount + created})`);
    } else {
      console.log(`[seed] Students already seeded (${currentCount} found)`);
    }

    // --- Seed student@iitm.ac.in (original demo) ---
    const [existingStudent] = await db.select().from(usersTable).where(eq(usersTable.email, "student@iitm.ac.in"));
    if (!existingStudent) {
      await db.insert(usersTable).values({
        id: generateId(), name: "Arjun Kumar Demo", email: "student@iitm.ac.in",
        passwordHash: await hashPassword("123456"), role: "student",
        rollNumber: "21f3001234", phone: "+91 9876543001", contactNumber: "9876543001",
        hostelId: hostelId1, roomNumber: "A-104", assignedMess: "Mess A",
        attendanceStatus: "not_entered", area: "Computer Science", isActive: true, assignedHostelIds: "[]",
      });
    }

    // --- Emergency Contacts ---
    const [{ count: contactCount }] = await db.select({ count: count() }).from(emergencyContactsTable);
    if (Number(contactCount) === 0) {
      await db.insert(emergencyContactsTable).values([
        { id: generateId(), hostelId: hostelId1, name: "Security Control Room", role: "Security", phone: "044-22578500", isAvailable24x7: "true" },
        { id: generateId(), hostelId: hostelId2, name: "Hostel Godavari Security", role: "Security", phone: "044-22578501", isAvailable24x7: "true" },
        { id: generateId(), hostelId: "", name: "Health Center", role: "Medical", phone: "044-22578430", isAvailable24x7: "true" },
        { id: generateId(), hostelId: "", name: "Dean of Students Office", role: "Administration", phone: "044-22578200", isAvailable24x7: "false" },
        { id: generateId(), hostelId: "", name: "Campus Police", role: "Security", phone: "044-22578100", isAvailable24x7: "true" },
      ]);
      console.log("[seed] Emergency contacts created");
    }

    // --- Announcements + Notifications ---
    const [{ count: annCount }] = await db.select({ count: count() }).from(announcementsTable);
    if (Number(annCount) === 0) {
      const [admin] = await db.select().from(usersTable).where(eq(usersTable.email, "admin@iitm.ac.in"));
      if (admin) {
        const announcementsData = [
          { id: generateId(), title: "Welcome to CampusOps!", content: "Your centralized portal for hostel management, attendance tracking, inventory, and campus communications.", category: "general", createdBy: admin.id },
          { id: generateId(), title: "Mess Timings — March 2026", content: "Mess A & B: Breakfast 7:00–9:00 AM | Lunch 12:00–2:00 PM | Dinner 7:00–9:30 PM\nMess C: Breakfast 7:30–9:30 AM | Lunch 12:30–2:30 PM | Dinner 7:30–10:00 PM", category: "hostel", createdBy: admin.id },
          { id: generateId(), title: "Semester Registration Open", content: "BS Program semester registration is now open. Deadline: March 30, 2026. Visit the IITM portal to register.", category: "academic", createdBy: admin.id },
          { id: generateId(), title: "Hostel Inventory Drive", content: "All students must submit mattress, bedsheet, and pillow details by March 25. Contact your hostel volunteer.", category: "hostel", createdBy: admin.id },
          { id: generateId(), title: "Campus Wi-Fi Upgrade", content: "Campus Wi-Fi infrastructure upgrade scheduled for March 22, 2:00–6:00 AM. Brief outages expected.", category: "general", createdBy: admin.id },
        ];
        await db.insert(announcementsTable).values(announcementsData);
        console.log("[seed] Announcements created");

        // Create notification records for every student for each announcement
        const students = await db.select({ id: usersTable.id })
          .from(usersTable).where(eq(usersTable.role, "student"));

        if (students.length > 0) {
          const notifValues: any[] = [];
          for (const ann of announcementsData) {
            for (const s of students) {
              notifValues.push({
                id: generateId(),
                userId: s.id,
                title: `Admin IITM: ${ann.title}`,
                body: ann.content.substring(0, 120),
                type: "announcement",
                isRead: "false",
                refId: ann.id,
              });
            }
          }
          // Insert in batches of 100 to avoid query size limits
          for (let i = 0; i < notifValues.length; i += 100) {
            await db.insert(notificationsTable).values(notifValues.slice(i, i + 100));
          }
          console.log(`[seed] Created ${notifValues.length} notification records for ${students.length} students`);
        }
      }
    }

    // --- Student Inventory Seed ---
    const [{ count: invCount }] = await db.select({ count: count() }).from(studentInventoryTable);
    if (Number(invCount) < 10) {
      const students = await db.select({ id: usersTable.id, hostelId: usersTable.hostelId })
        .from(usersTable).where(eq(usersTable.role, "student"));
      const existingInv = await db.select({ studentId: studentInventoryTable.studentId }).from(studentInventoryTable);
      const invSet = new Set(existingInv.map(i => i.studentId));

      let created = 0;
      for (const s of students.slice(0, 40)) {
        if (invSet.has(s.id)) continue;
        await db.insert(studentInventoryTable).values({
          id: generateId(), studentId: s.id, hostelId: s.hostelId,
          mattress: Math.random() > 0.2,
          bedsheet: Math.random() > 0.25,
          pillow: Math.random() > 0.35,
          updatedBy: "seed",
        });
        created++;
      }
      if (created > 0) console.log(`[seed] Created ${created} inventory records`);
    }

    console.log("[seed] Auto-seed complete ✓");
  } catch (err) {
    console.error("[seed] Error:", err);
  }
}
