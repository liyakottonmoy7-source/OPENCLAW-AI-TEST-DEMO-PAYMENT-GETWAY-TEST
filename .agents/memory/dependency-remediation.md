---
name: Dependency remediation constraints
description: Why targeted security overrides are needed for Firebase and Drizzle dependencies.
---

Prefer compatible parent upgrades, but retain narrowly scoped security overrides when upstream release constraints still select vulnerable dependencies.

**Why:** The latest Firebase Firestore client still pinned gRPC to the vulnerable 1.9 release line, and Drizzle's legacy esbuild-kit loader still pinned esbuild below the security fix. Removing those overrides can reintroduce findings even after upgrading the direct parents.

**How to apply:** Check current upstream dependency metadata before removing either override. Exercise Firebase entry points and the legacy loader's TypeScript transforms when changing their overridden dependencies.
