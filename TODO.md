# TODO

## Current Focus: Input + Terminal Emulation
- [ ] Make runtime input/output feel like a real C terminal session for learners.
- [ ] Validate `scanf` menu loops (prompt + typed input shown inline in output).
- [ ] Add more edge-case tests for interactive input (EOF, invalid input, long sessions).

## Deferred (Later)
- [ ] Adopt an Algorithm Visualizer style architecture:
  - split execution/tracer events from rendering
  - keep algorithm content/catalog separate from engine/runtime
  - standardize trace-event contracts between interpreter and UI
  - reference: https://github.com/algorithm-visualizer/algorithm-visualizer
