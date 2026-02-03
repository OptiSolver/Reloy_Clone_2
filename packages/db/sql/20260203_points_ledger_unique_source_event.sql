-- Evita duplicar asientos por el mismo evento
CREATE UNIQUE INDEX IF NOT EXISTS ux_points_ledger_source_event_id
ON points_ledger (source_event_id)
WHERE source_event_id IS NOT NULL;