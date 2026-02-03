CREATE TABLE IF NOT EXISTS points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  merchant_id uuid NOT NULL REFERENCES merchants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),

  branch_id uuid REFERENCES branches(id),
  staff_id uuid REFERENCES staff(id),

  source_event_id uuid REFERENCES events(id),

  delta_points integer NOT NULL,
  reason text NOT NULL, -- visit | checkin | checkout | redeem | manual
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_merchant_customer
  ON points_ledger (merchant_id, customer_id, created_at DESC);
