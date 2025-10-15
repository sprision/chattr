-- Add new interest: GGGG and create its default chat room

-- Insert or update the interest to be idempotent on re-run
WITH new_interest AS (
  INSERT INTO public.interests (name, icon, color, description)
  VALUES ('GGGG', '🏛', '#0EA5E9', 'Club GGGG')
  ON CONFLICT (name) DO UPDATE
    SET icon = EXCLUDED.icon,
        color = EXCLUDED.color,
        description = EXCLUDED.description
  RETURNING id, name, description
)
-- Create a lounge chat room for this interest if it doesn't already exist
INSERT INTO public.chat_rooms (interest_id, name, description)
SELECT ni.id,
       ni.name || ' Lounge',
       'Chat about ' || COALESCE(ni.description, ni.name)
FROM new_interest ni
LEFT JOIN public.chat_rooms cr ON cr.interest_id = ni.id
WHERE cr.id IS NULL;


