# Supabase Cross-Device Resume Sync Setup Guide

This guide walks you through configuring **Supabase Auth, PostgreSQL with Row Level Security (RLS), and Private Storage** for CareerPilot AI cross-device resume synchronization.

---

## 1. Create a Supabase Project

1. Go to [https://supabase.com/](https://supabase.com/) and sign in (or create a free account).
2. Click **New Project**.
3. Choose a name (e.g. `careerpilot-ai`) and set a strong database password.
4. Select the region closest to you.
5. Wait ~1 minute for your project to provision.

---

## 2. Apply Database Schema & Row Level Security (RLS)

1. In your Supabase Dashboard, click on **SQL Editor** in the left sidebar.
2. Open the migration file in this repository:
   `supabase/migrations/20261121_resume_sync.sql`
3. Copy its entire contents, paste them into the SQL Editor, and click **Run**.
4. This script creates:
   - `public.resume_versions` table with candidate metadata, target platform, and timestamps.
   - Strict **Row Level Security (RLS)** policies ensuring users can only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` their own resume records (`auth.uid() = user_id`).
   - Private storage bucket `resumes` with folder-based RLS policies matching user IDs (`auth.uid() = (storage.foldername(name))[1]`).

---

## 3. Configure Frontend Environment Variables

1. In the Supabase Dashboard, navigate to **Project Settings** (gear icon) -> **API**.
2. Copy:
   - **Project URL**
   - **Project API Keys** -> `anon` / `public` key
3. In `frontend/`, copy `.env.example` to `.env`:
   ```bash
   cd frontend
   cp .env.example .env
   ```
4. Set the variables in `frontend/.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
5. **CRITICAL SECURITY RULE**:
   - Use ONLY the `anon` public key in the frontend.
   - **NEVER** expose your `service_role` secret key in frontend code, git commits, or browser assets.

---

## 4. Verify & Sync

1. Start (or refresh) the frontend app:
   ```bash
   cd frontend && npm run dev
   ```
2. In CareerPilot AI, click the **Cloud / Account** button in the top navigation bar.
3. Sign up with your email and password.
4. Open **Saved Resume Versions** and click **Sync to Account**.
5. Your local resume library will be migrated to your cloud database with real-time progress.
6. Open CareerPilot AI on another browser or device, sign in, and your resume library will automatically load!
