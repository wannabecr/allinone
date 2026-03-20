# NullYex — AI & DS Batch 2025–2029

> A unified student platform for B.Tech AI & Data Science (IBM Integrated) batch at Arka Jain University, Jamshedpur.

Built by **Farhan Khalid** & **Team NullYex**

---

## What's inside

| File | Purpose |
|---|---|
| `index.html` | Landing page + Sign In / Sign Up + Profile Setup |
| `app.html` | Main app — TaskBoard, AttendEX, Notices, Cover Page |
| `sw.js` | Service Worker — offline support, caching, push notifications |
| `manifest.json` | PWA manifest — installable on Android & iOS |
| `subjects-why-not.json` | Timetable data for AttendEX smart schedule |
| `humans-xD.json` | Student list for AttendEX (can be encrypted) |

---

## Features

### TaskBoard
- Assignments per subject with due dates, remarks, and question file upload
- Syllabus topics and lecture notes per subject
- Admin-only add/edit/delete — students get read-only access
- Student answer upload per assignment
- Cover page generator (Arka Jain University format, PNG download)
- Sort by due date / name / status

### AttendEX
- Smart schedule — auto-detects current class from timetable
- Manual day/slot selection override
- Click to cycle attendance: Null → Present → Absent
- Batch filter (All / C1 / C2)
- Export to `.xlsx`, `.txt`
- WhatsApp share with formatted report
- Raw text view with clipboard copy

### Home
- Personalised greeting
- Stats bar (subjects, total tasks, pending, completed, overdue)
- Latest 4 notices inline
- Pending assignments across all subjects
- Recently added resources

### Notices
- Admin posts class announcements with optional file attachment
- Shows on home page and full notices page

### Auth
- Email + password signup / login
- Google OAuth
- Profile setup on first login (Enrollment No, Roll No, Section, Batch)
- Session persists across visits

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — single file, no build step |
| Auth | Supabase Auth (email + Google OAuth) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (`assignment-pdfs` bucket) |
| API | Cloudflare Worker (CORS proxy + auth check) |
| PWA | Service Worker + Web App Manifest |
| Fonts | Inter + JetBrains Mono (Google Fonts) |
| Excel export | SheetJS (xlsx) |

---

## Deployment

### GitHub Pages

1. Push all files to a GitHub repository
2. Go to **Settings → Pages → Source → Deploy from branch → main / root**
3. Your site will be live at `https://<username>.github.io/<repo>/`

### Files required at root
```
index.html
app.html
sw.js
manifest.json
subjects-why-not.json
humans-xD.json
icons/
  icon-192.png
  icon-512.png
```

---

## Supabase Setup

### Tables

Run this in your Supabase **SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS public.student_profiles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email text,
    full_name text,
    enrollment_no text,
    roll_no text,
    section text,
    batch text,
    program text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    subject_id text,
    due_date date,
    remarks text,
    question_url text,
    uploads jsonb DEFAULT '[]',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.syllabus (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    body text,
    ref_url text,
    subject_id text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    body text,
    ref_url text,
    subject_id text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    body text,
    file_url text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text,
    category text,
    title text,
    body text,
    subject_id text,
    subject_name text,
    ref_type text,
    ref_id text,
    status text DEFAULT 'open',
    submitter_email text,
    submitter_name text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription jsonb,
    user_email text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_completions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid,
    assignment_id uuid,
    created_at timestamptz DEFAULT now()
);
```

### RLS Policies

```sql
DO $$ BEGIN

  ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.syllabus ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.user_completions ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users manage own profile" ON public.student_profiles;
  CREATE POLICY "Users manage own profile" ON public.student_profiles FOR ALL USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Public read" ON public.assignments;
  DROP POLICY IF EXISTS "Admin insert" ON public.assignments;
  DROP POLICY IF EXISTS "Admin update" ON public.assignments;
  DROP POLICY IF EXISTS "Admin delete" ON public.assignments;
  CREATE POLICY "Public read" ON public.assignments FOR SELECT USING (true);
  CREATE POLICY "Admin insert" ON public.assignments FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = ANY(ARRAY['farhankhalid626@gmail.com','gissamrit@gmail.com']));
  CREATE POLICY "Admin update" ON public.assignments FOR UPDATE USING (auth.jwt() ->> 'email' = ANY(ARRAY['farhankhalid626@gmail.com','gissamrit@gmail.com']));
  CREATE POLICY "Admin delete" ON public.assignments FOR DELETE USING (auth.jwt() ->> 'email' = ANY(ARRAY['farhankhalid626@gmail.com','gissamrit@gmail.com']));

  DROP POLICY IF EXISTS "Public read" ON public.syllabus;
  DROP POLICY IF EXISTS "Admin insert" ON public.syllabus;
  DROP POLICY IF EXISTS "Admin update" ON public
