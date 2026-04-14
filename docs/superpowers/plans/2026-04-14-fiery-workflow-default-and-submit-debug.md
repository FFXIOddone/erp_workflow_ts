# Fiery Workflow Default and Submit Debug

AGENT-AUTO | COMPLETE

## Goal
Make Fiery workflow selection explicit, persistent, and visible in both the Rip Queue and Shop Floor Fiery diagnostics, default the controller workflow to `Zund G7`, and tighten the JMF/test-submit path so the same chosen workflow is used there.

## Slices
- [x] Add a persisted Fiery workflow setting to system config and default it to `Zund G7` in the server Fiery defaults.
- [x] Replace the static workflow text in the Rip Queue and Shop Floor Fiery diagnostics panels with a real dropdown backed by discovered workflows and the persisted default.
- [x] Feed the persisted workflow into the Fiery JMF/test-submit path so the selected controller default is actually used for JDF generation.
- [x] Validate the affected server, web, and shop-floor packages and log the slice.

## Notes
- The normal Fiery hotfolder copy path still does not consume the workflow name; this slice focuses on the controller-default surfaces and the JMF/test-submit path that actually read the workflow setting.
- If the workflow selection still fails after this, the next step is to inspect the hotfolder copy path separately from the JMF path.
