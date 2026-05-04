INSERT INTO users (email, username, hashed_password, is_active, is_superuser, balance)
VALUES (
  'admin@predictionmarket.mn',
  'admin',
  '$2b$12$bkXJBMUnj8KMvcxXIicXrembVTe96sE6SJZI71C9FwncDnNi.gIDW',
  TRUE,
  TRUE,
  1000.00
)
ON CONFLICT (email) DO UPDATE SET is_superuser = TRUE
RETURNING id, email, is_superuser;
