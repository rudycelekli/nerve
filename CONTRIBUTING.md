# Contributing to NERVE

Issues, recordings that reveal a comparison problem, documentation fixes, accessibility improvements, and pull requests are welcome.

## Local setup

Use Node.js 22+ and pnpm. Run `pnpm install`, `pnpm test`, and `pnpm build` before opening a pull request.

For signal-processing changes, include a test with a clear expected result. Synthetic signals are useful for regressions; real-world recordings are needed to evaluate field behavior. Do not commit recordings of people or private spaces without permission. A useful issue describes the machine, operating mode, microphone position, environment, browser, and expected versus observed result.

Keep claims about machine health aligned with measured evidence. NERVE detects changes in sound; a changed sound alone does not identify a specific fault.

By contributing, you agree that your contribution is licensed under the project's MIT license.
