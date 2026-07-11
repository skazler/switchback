-- Non-lift logging formats (rides, climbs). A set already carries reps/weight
-- (strength) and duration_s (time); add distance for rides/runs and grade for
-- climbs. All nullable — a set uses only the fields its format needs.

ALTER TABLE sets ADD COLUMN distance REAL;   -- miles (ride / run)
ALTER TABLE sets ADD COLUMN grade TEXT;      -- climbing grade, e.g. "V4"
