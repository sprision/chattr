-- Friends and Direct Messages schema

-- Friends table tracks requests and accepted friendships
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','declined','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sender_id, receiver_id),
  CONSTRAINT no_self_friend CHECK (sender_id <> receiver_id)
);

ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

-- Allow involved users to view friend rows
CREATE POLICY "Friends: involved users can select"
  ON public.friends FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Allow user to create requests as sender
CREATE POLICY "Friends: users can insert as sender"
  ON public.friends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id AND sender_id <> receiver_id);

-- Allow receiver to update status, and sender to cancel (update to declined)
CREATE POLICY "Friends: involved users can update"
  ON public.friends FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Direct message rooms (one per user pair)
CREATE TABLE IF NOT EXISTS public.dm_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dm_pair_unique UNIQUE (LEAST(user_a_id, user_b_id), GREATEST(user_a_id, user_b_id)),
  CONSTRAINT dm_no_self CHECK (user_a_id <> user_b_id)
);

ALTER TABLE public.dm_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM rooms: involved users can select"
  ON public.dm_rooms FOR SELECT
  TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "DM rooms: involved users can insert"
  ON public.dm_rooms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- Direct messages
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.dm_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM messages: involved users can select"
  ON public.dm_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_rooms r
      WHERE r.id = room_id AND (auth.uid() = r.user_a_id OR auth.uid() = r.user_b_id)
    )
  );

CREATE POLICY "DM messages: sender must be in room"
  ON public.dm_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM public.dm_rooms r
      WHERE r.id = room_id AND (auth.uid() = r.user_a_id OR auth.uid() = r.user_b_id)
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.friends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;


