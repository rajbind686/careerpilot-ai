-- =============================================================================
-- CareerPilot AI - Supabase Cross-Device Resume Sync Migration
-- Schema Version: 20261121_resume_sync
-- =============================================================================

-- 1. Create resume_versions table
CREATE TABLE IF NOT EXISTS public.resume_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    resume_text TEXT NOT NULL,
    word_count INT DEFAULT 0,
    char_count INT DEFAULT 0,
    source_version_id UUID,
    target_platform TEXT DEFAULT 'general',
    target_role TEXT,
    storage_path TEXT,
    sync_status TEXT DEFAULT 'synced',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast user queries and ordering
CREATE INDEX IF NOT EXISTS idx_resume_versions_user_id ON public.resume_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_created_at ON public.resume_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_versions_user_platform ON public.resume_versions(user_id, target_platform);

-- 3. Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_resume_versions_updated_at ON public.resume_versions;
CREATE TRIGGER trigger_resume_versions_updated_at
BEFORE UPDATE ON public.resume_versions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.resume_versions ENABLE ROW LEVEL SECURITY;

-- 5. Strict User-Scoped RLS Policies
-- Users can only read their own records
CREATE POLICY "Users can only select their own resume versions"
ON public.resume_versions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can only insert their own records
CREATE POLICY "Users can only insert their own resume versions"
ON public.resume_versions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can only update their own records
CREATE POLICY "Users can only update their own resume versions"
ON public.resume_versions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own records
CREATE POLICY "Users can only delete their own resume versions"
ON public.resume_versions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 6. Private File Storage Bucket for Resume Binaries (PDF/DOCX)
-- Create private bucket if storage schema is available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('resumes', 'resumes', false)
        ON CONFLICT (id) DO UPDATE SET public = false;
    END IF;
END $$;

-- 7. Private Storage Bucket RLS Policies (User-folder isolation)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        -- Allow authenticated users to view their own uploaded resume files
        DROP POLICY IF EXISTS "Users can only read their own resume objects" ON storage.objects;
        CREATE POLICY "Users can only read their own resume objects"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

        -- Allow authenticated users to upload files to their own user directory
        DROP POLICY IF EXISTS "Users can only insert their own resume objects" ON storage.objects;
        CREATE POLICY "Users can only insert their own resume objects"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

        -- Allow authenticated users to delete their own resume files
        DROP POLICY IF EXISTS "Users can only delete their own resume objects" ON storage.objects;
        CREATE POLICY "Users can only delete their own resume objects"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END $$;
