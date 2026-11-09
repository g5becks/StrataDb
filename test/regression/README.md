# Audit regressions

Each case names its audit finding and owning backlog task. Cases assert the
intended behavior against real SQLite and start as `test.failing` while the bug
exists. Inspect the actual failure to confirm the documented reason before
checking TASK-227's criteria.

When implementing a fix, convert its cases to plain `test` and require them to
pass. Add regression cases before changing behavior. Never weaken the assertion
or keep a passing case marked `test.failing`.

At v0.6.0 only A10 (TASK-243), A12 (TASK-245), A15 (TASK-246), and A17
(TASK-244) may remain expected failures. At v0.7.0 none may remain. A7 and A18
were already fixed in v0.5.1 and have passing integration/unit coverage.
