# Thrive Temp Staging and Job-Ticket Naming

AGENT-AUTO | COMPLETE

## Goal
Keep Fiery/Vutek on the JDF/JMF path, and make Thrive-only sends stage a renamed copy of the source PDF into the hotfolder so the file name carries the job-ticket context we need for record keeping and linkage.

## Tasks
- [x] Define a stable Thrive filename convention that encodes WO, customer, and job description.
- [x] Add a Thrive-only temp staging helper that renames the file before copying it into the hotfolder.
- [x] Extend Thrive parsing so the new filename convention recovers the same metadata.
- [x] Add tests covering the naming helper, parser round-trip, and temp cleanup behavior.
- [x] Update the relevant operator docs so the new Thrive-only flow is clear.

## Notes
- Fiery/Vutek must remain on the existing JDF/JMF flow.
- The new naming convention should only apply to Thrive jobs.
- The temp file should be deleted after the hotfolder copy succeeds.
