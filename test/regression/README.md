# Audit regressions

All 30 audit regression cases are ordinary passing tests for v0.7.0. Each case
names its audit finding and owning backlog task and asserts behavior against
real SQLite. A7 and A18 also have passing integration/unit coverage from v0.5.1.

Add a regression before changing behavior. Confirm that an unfixed case fails
for its documented reason, then require it to pass after the fix. Never weaken
assertions or leave resolved behavior marked as an expected failure.

The former v0.7.0 owners A10 (TASK-243), A12 (TASK-245), A15 (TASK-246) and A17
(TASK-244) are resolved. There are no expected-failure cases remaining.
