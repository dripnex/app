export interface DefaultTemplate {
  title: string;
  content: string;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    title: 'Meeting',
    content: `# Meeting

**Date:**
**Attendees:**

## Notes

-

## Decisions

-

## Actions

- [ ]
`,
  },
  {
    title: 'Decision',
    content: `# Decision

**Status:** proposed
**Date:**

## Context

## Options

## Decision

## Consequences
`,
  },
  {
    title: 'Daily',
    content: `# Daily

**Date:**

## Today

- [ ]

## Notes

`,
  },
  {
    title: 'Weekly',
    content: `# Weekly

**Week of:**

## Shipped

-

## Still open

- [ ]

## Next week

- [ ]
`,
  },
  {
    title: 'Reading',
    content: `# Reading

**Source:**
**Date:**

## What it's about

## Highlights

==quote==

## Why it matters

`,
  },
  {
    title: 'Feasibility spike',
    content: `# Feasibility spike

Time-boxed look at whether something is worth building.

## Question

## Time box

## What we tried

-

## What we learned

-

## Go / no-go

`,
  },
  {
    title: 'Options comparison',
    content: `# Options comparison

## Problem

## Options

| Option | Pros | Cons | Cost |
| --- | --- | --- | --- |
| A |  |  |  |
| B |  |  |  |

## Recommendation

`,
  },
  {
    title: 'Codebase exploration',
    content: `# Codebase exploration

## Area

## What I expected

## What I found

-

## Entry points

-

## Open questions

- [ ]
`,
  },
  {
    title: 'Crash',
    content: `# Crash

For triaging a crash or unhandled exception.

## Summary

-

## Related

-

## Repro

1.

## Stack trace

\`\`\`
paste here
\`\`\`

## Environment

- Platform:
- Version:

## Investigation

- Does it reproduce consistently?
- Did it start after a dependency bump, OS update, or commit?
- Does the stack point at our code or a native/dependency module?
`,
  },
  {
    title: 'Bug fix',
    content: `# Bug fix

## What's broken

## Expected

## Repro

1.

## Fix

## How we'll know it's fixed

`,
  },
  {
    title: 'Data integrity',
    content: `# Data integrity

## What looks wrong

## Who / what is affected

## Suspected write path

## Recovery

- [ ]
`,
  },
  {
    title: 'Security',
    content: `# Security

## Report

## Impact

## Attack path

## Mitigation

- [ ]

## Follow-up

- [ ]
`,
  },
  {
    title: 'Race condition',
    content: `# Race condition

## Symptom

## Shared state

## Timing

## Repro

1.

## Fix
`,
  },
  {
    title: 'Design',
    content: `# Design

## Problem

## Constraints

## Proposal

## Alternatives

## Risks
`,
  },
  {
    title: 'Postmortem',
    content: `# Postmortem

**Date:**
**Severity:**

## What happened

## Impact

## Timeline

## Root cause

## What went well

## Action items

- [ ]
`,
  },
  {
    title: 'PR review',
    content: `# PR review

**PR:**
**Author:**

## Summary

## What I checked

- [ ] Correctness
- [ ] Tests
- [ ] Naming / API
- [ ] Security / PHI

## Notes

## Verdict

`,
  },
];
