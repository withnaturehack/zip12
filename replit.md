# CampusOps Expo — IIT Madras BS Student Portal

## Project Overview

Full-stack mobile application for IIT Madras BS students using Expo React Native, Express backend, and PostgreSQL.
Targets 15,000–20,000 concurrent users with production-grade pooling, gzip compression, and caching.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (trust proxy enabled)
- **Database**: PostgreSQL + Drizzle ORM (pool: max:20, min:2)
- **Mobile**: Expo SDK 53, React Native, Expo Router v6
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Rate limiting**: `express-rate-limit` (2000 req/15min general, 50 auth)
- **Compression**: `compression` gzip
- **CSV parsing**: `csv-parse` (server-side import)
- **PDF generation**: `pdfkit` (server-side PDF export)
- **File uploads**: `multer` (in-memory, max 5MB)

## Structure

```text
workspace/
├── artifacts/
│   ├── api-server/       # Express REST API (port 8080, previewPath /api)
│   └── mobile/           # Expo React Native app
├── lib/
│   ├── api-spec/         # OpenAPI spec
│   └── db/               # Drizzle ORM schema + DB connection
└── pnpm-workspace.yaml
```

## Role Structure

5-level hierarchy:
- `student` — basic access (hostel info, lost & found, notifications)
- `volunteer` — marks attendance+inventory, staff status, global search
- `coordinator` — manages multiple hostels, all volunteer features, announcements
- `admin` — full access except superadmin-only tools
- `superadmin` — master table, CSV import, full PDF/CSV exports, activity logs, manage all users

## Demo Accounts (password: 123456)

- `student@iitm.ac.in`
- `volunteer@iitm.ac.in`
- `coordinator@iitm.ac.in`
- `admin@iitm.ac.in`
- `superadmin@iitm.ac.in`

## API Routes

### Auth
- `POST /api/auth/login` — login
- `POST /api/auth/register` — register
- `GET /api/auth/me` — get current user

### Students, Hostels, Search
- `GET /api/students`, `POST /api/students`, etc.
- `GET /api/hostels`, `GET /api/hostels/:id`
- `GET /api/search?q=...&limit=&offset=` — global paginated search

### Attendance (merged with inventory)
- `GET /api/attendance?hostelId=` — returns students with attendance + inventory data
- `POST /api/attendance/:studentId` — mark attendance (entered/not_entered)
- `GET /api/attendance/stats` — today's counts
- `PATCH /api/attendance/inventory/:studentId` — update mattress/bedsheet/pillow

### Staff Active/Inactive Status
- `POST /api/staff/go-active` — mark self active (body: { remark })
- `POST /api/staff/go-inactive` — mark self inactive (body: { remark })
- `POST /api/staff/heartbeat` — keep active status alive (call every 5 min)
- `GET /api/staff/me-status` — get own active status
- `GET /api/staff/active-list` — get currently active staff (last 10 min)
- `GET /api/staff/all` — all staff with online/offline status
- `GET /api/staff/logs?limit=&offset=` — activity logs with user info

### CSV Import (SuperAdmin only)
- `POST /api/import/students` — bulk import students from CSV (multipart/form-data)
- `POST /api/import/mess` — bulk mess allocation from CSV
- `POST /api/import/hostel-assignment` — bulk hostel assignment
- `GET /api/import/template/students` — download sample CSV
- `GET /api/import/template/mess` — download mess template
- `GET /api/import/template/hostel-assignment` — download hostel template

### PDF Export (SuperAdmin)
- `GET /api/pdf/students` — students PDF
- `GET /api/pdf/attendance?date=` — attendance report PDF
- `GET /api/pdf/activity-logs` — staff activity logs PDF
- `GET /api/pdf/full-report` — full campus report PDF

### CSV Export (Admin+)
- `GET /api/export/students.csv`
- `GET /api/export/attendance.csv?date=`
- `GET /api/export/inventory.csv`
- `GET /api/export/full-report.csv`
- `GET /api/export/timelogs` — activity logs CSV

### Lost & Found (all authenticated users)
- `GET /api/lostitems` — list all
- `POST /api/lostitems` — report item (title, description, location)
- `PATCH /api/lostitems/:id` — update status (admin+)
- `DELETE /api/lostitems/:id` — delete (own item or admin+)

### Timelogs / Activity
- `GET /api/timelogs` — own logs (or all if admin)
- `POST /api/timelogs` — add timelog entry (types: login/logout/checkin/entry/active/inactive/custom)
- `GET /api/timelogs/today` — today's logs

### Reports
- `GET /api/reports/summary` — system counts (students, hostels, items, announcements)

## Mobile Screens

### All Roles
- `app/(tabs)/index.tsx` — Home (role-adaptive: student/volunteer/coordinator)
- `app/(tabs)/profile.tsx` — Profile + tools menu + logout (fixed for web)
- `app/(tabs)/lostandfound.tsx` — Attendance+Inventory (staff) / Lost & Found (students)
- `app/(tabs)/hostel.tsx` — Hostel/Students list
- `app/(tabs)/notifications.tsx` — Notifications

### Staff Tools
- `app/admin/search.tsx` — Global search with student profile modal (click to view)
- `app/admin/staff-status.tsx` — Staff active/inactive management with real-time polling
- `app/admin/activity-logs.tsx` — Real-time activity logs with filter, search, PDF/CSV download
- `app/admin/inventory-table.tsx` — Inventory table

### SuperAdmin Tools
- `app/admin/reports.tsx` — Reports with CSV + PDF download buttons
- `app/admin/csv-import.tsx` — CSV import for students, mess allocation, hostel assignment
- `app/admin/master-table.tsx` — Master student table
- `app/admin/manage-admins.tsx` — Manage staff users

## Key Features Built

1. **Merged Attendance + Inventory** — Student cards show name/email/contact + mattress/bedsheet/pillow checkboxes + attendance toggle
2. **Staff Active/Inactive** — Button to go active/inactive with remark; auto-inactive after 10 minutes; heartbeat every 5 min
3. **Activity Logs** — Real-time (20s polling) with filter by type, search by name/remark; PDF/CSV export
4. **Student Profile from Search** — Click any search result to open full profile modal
5. **Lost & Found for All** — Any authenticated user (student/staff) can report lost items with location
6. **CSV Import** — SuperAdmin can bulk-import students, mess allocation, hostel assignments; download templates
7. **PDF Export** — Server-side pdfkit PDFs for students, attendance, activity logs, full report
8. **Logout fix** — Web uses `window.confirm`, native uses `Alert.alert`
9. **Trust proxy** — Fixed rate-limiter X-Forwarded-For warning

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret (default: campusops-secret-2024)
- `PORT` — API server port (set to 8080)
- `EXPO_PUBLIC_API_URL` — API base URL (set in `artifacts/mobile/.env`)

## DB Schema

Key tables:
- `users` — id, name, email, role, rollNumber, hostelId, roomNumber, assignedMess, isActive, lastActiveAt
- `hostels` — id, name, description, capacity
- `attendance` — id, studentId, volunteerId, hostelId, date, status, mess, roomNumber
- `student_inventory` — id, studentId, hostelId, mattress, bedsheet, pillow
- `time_logs` — id, userId, hostelId, type, note, createdAt
- `lost_items` — id, title, description, imageUrl, location, status, reportedBy
- `announcements` — id, title, content, priority, hostelId
- `notifications` — id, userId, title, body, type, isRead, refId
