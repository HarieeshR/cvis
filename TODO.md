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

## Planned: Analyzer AI Chatbot
- [ ] Add an AI-powered analyzer chatbot in the Analysis tab.
- [ ] Add login/auth gating for AI chatbot usage (user sessions + quotas).
- [ ] Feed chatbot with code, compile output, runtime output, and trace context.
- [ ] Add structured prompt templates for beginner-friendly feedback.
- [ ] Add safety checks (no hallucinated compiler claims, clear confidence labels).

## Planned: LeetCode + HackerRank Integration
- [ ] Add problem import flow for LeetCode and HackerRank practice statements.
- [ ] Map imported problems to local starter templates (C focus).
- [ ] Add sample input/output test harness for imported problems.
- [ ] Add “Run against test cases” + result breakdown (pass/fail per case).
- [ ] Add progress tracking for solved attempts inside the app.

## Planned: Modern Onboarding UX (Claude/ChatGPT-level feel)
- [ ] Design a polished first-run onboarding flow (welcome, quick tour, first action).
- [ ] Add starter templates + guided “first compile/run/trace” walkthrough.
- [ ] Add contextual empty states with clear next actions in each tab.
- [ ] Add keyboard shortcuts hint sheet and discoverability prompts.
- [ ] Add progressive disclosure so beginner mode stays simple and advanced tools are optional.
- [ ] Add account-aware onboarding states (guest vs logged in learners).
- [ ] Match modern assistant UX references (ChatGPT/Claude/macOS app polish) for spacing, hierarchy, and micro-interactions.

## Planned: Visual Aesthetic Refresh (Hyprland-inspired)
- [ ] Introduce subtle rounded corners, tinted glass surfaces, and translucent layered panels.
- [ ] Apply consistent blur + contrast treatment for headers, popovers, and action bars.
- [ ] Refresh buttons with soft gradients, cleaner hover states, and modern depth cues.
- [ ] Improve typography rhythm and layout density for a premium desktop-like feel.
- [ ] Add tasteful motion (tab transitions, panel reveals, loading states) without distraction.

## Integration Readiness Checklist (Java / Python / AI)
- [ ] Java integration readiness:
  - language switch enabled
  - compile pipeline for Java
  - run pipeline for Java
  - multi-file class/project handling
  - Java-specific analysis/tracing strategy
- [ ] Python integration readiness:
  - language switch enabled
  - run pipeline for Python
  - package/import handling policy
  - Python-specific analysis/tracing strategy
- [ ] AI integration readiness:
  - auth + usage limits
  - prompt/system policy for reliable feedback
  - code/output/trace context packaging for model input
  - safety + confidence labeling
  - cost/latency monitoring and fallback behavior
