-- Minute Cryptic: el tiempo deja de contar para el ranking y pasa al detalle del MEGA matchi matchi.
-- "1 pista · 24m 12s" → display "1 pista", tiebreak NULL y el tiempo como último renglón del pattern.
UPDATE results
SET pattern = CASE
      WHEN pattern IS NULL THEN NULL
      WHEN pattern = '' THEN substr(display, instr(display, ' · ') + 3)
      ELSE pattern || char(10) || substr(display, instr(display, ' · ') + 3)
    END,
    display = substr(display, 1, instr(display, ' · ') - 1),
    tiebreak = NULL
WHERE game = 'minute-cryptic' AND instr(display, ' · ') > 0;
