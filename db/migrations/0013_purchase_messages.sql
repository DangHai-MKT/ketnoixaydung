CREATE TABLE purchase_messages (
  id uuid PRIMARY KEY,
  purchase_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_messages_body_length CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX purchase_messages_thread_idx
  ON purchase_messages (purchase_id, created_at DESC, id DESC);
