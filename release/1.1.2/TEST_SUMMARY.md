# Garb & Grime 1.1.2 — Test Summary

New regression coverage verifies that the Actors tab uses bounded pagination, hydrates portraits only after pagination, caches lightweight Actor index rows, releases the cache on close, invalidates entries on Actor/folder changes, bounds image-failure caches, and reads directory state without deep-cloning full Actor state.

All previous regression coverage remains active.

Result before packaging: **76/76 tests passed**.
