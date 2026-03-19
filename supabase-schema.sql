-- ============================================================
-- GeoLearn Japan — Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- 1. USER PROGRESS TABLE
-- Stores all localStorage data as a JSON blob per user
CREATE TABLE IF NOT EXISTS public.user_progress (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 2. ANALYTICS EVENTS TABLE
-- Stores page views, quiz completions, and other events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON public.analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON public.analytics_events(created_at DESC);

-- 3. ROW LEVEL SECURITY (RLS)
-- Users can only read/write their own data

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- user_progress: users can read/write only their own row
CREATE POLICY "Users can read own progress"
  ON public.user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.user_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- analytics_events: users can insert their own events, read their own
CREATE POLICY "Users can insert own analytics"
  ON public.analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can read own analytics"
  ON public.analytics_events FOR SELECT
  USING (auth.uid() = user_id);

-- Allow anonymous analytics (for non-logged-in tracking)
CREATE POLICY "Allow anonymous analytics inserts"
  ON public.analytics_events FOR INSERT
  WITH CHECK (user_id IS NULL);
