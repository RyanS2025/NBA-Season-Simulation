---
name: checkpoint
description: Verify and commit the current checkpoint — runs tsc type check, browser test, then commits with a clean developer-voice message
disable-model-invocation: true
---

Run through the checkpoint verification and commit workflow:

## Steps

1. **Type check**: Run `npx tsc --noEmit` from the `frontend/` directory. If there are errors, fix them before proceeding.

2. **Browser test**: Take a screenshot of the relevant pages to verify the UI renders correctly. If the dev server isn't running, start it with `npm run dev` from `frontend/`.

3. **Commit**: Stage all changed files and commit with a descriptive message.
   - NEVER reference Claude, AI, or any AI assistant in the commit message
   - Write in the developer's voice (e.g. "Add possession engine with 14-zone shot charts")
   - Keep it concise — 1-2 sentences max
   - Don't use checkpoint numbers in the message

4. **Push**: Push to origin/main after committing.
