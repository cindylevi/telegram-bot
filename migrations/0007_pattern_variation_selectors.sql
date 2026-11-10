UPDATE results
SET pattern = REPLACE(REPLACE(pattern, char(65039), ''), char(65038), '')
WHERE instr(pattern, char(65039)) > 0 OR instr(pattern, char(65038)) > 0;
