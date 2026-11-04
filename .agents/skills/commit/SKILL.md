---
name: commit
description: Write Conventional Commit messages and create commits when requested.
---

# Commit

Use this skill for commit messages or explicitly requested commits. Do not commit completed work without a request.

For a commit, inspect the status and diff, including relevant untracked files. Stage only files belonging to the requested change. Run relevant checks when appropriate and report failures. Ask only when the commit scope or type cannot be inferred reliably.

Use this subject format:

```text
<type>(<scope>): <emoji> <imperative summary>
```

Use a standard type, omit an unhelpful scope, choose one relevant emoji, and avoid a trailing period. Example: `feat(types): 🧩 name discriminated union variants`.

Preserve the configured Git author. NEVER add self attribution. Amend, rebase, or push only when requested.

After committing, verify the hash, subject, author, and working-tree status, then report the result.
