export interface DefaultTemplate {
  title: string;
  content: string;
}

function withInstruction(instruction: string, body: string): string {
  const indented = instruction
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
  return `---\ninstruction: |\n${indented}\n---\n${body}`;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    title: 'Meeting',
    content: withInstruction(
      'Capture attendees, decisions, and next actions. Prefer bullets. Do not invent attendees.',
      `# Meeting

**Date:**
**Attendees:**

## Notes

-

## Decisions

-

## Actions

- [ ]
`
    ),
  },
  {
    title: 'Decision',
    content: withInstruction(
      'State the decision, options considered, and consequences. Keep status honest.',
      `# Decision

**Status:** proposed
**Date:**

## Context

## Options

## Decision

## Consequences
`
    ),
  },
  {
    title: 'Daily',
    content: withInstruction(
      'List what you will do today. Keep it short. Do not rewrite the past.',
      `# Daily

**Date:**

## Today

- [ ]

## Notes

`
    ),
  },
  {
    title: 'Weekly',
    content: withInstruction(
      'What shipped, what is still open, what next week is for. No status theater.',
      `# Weekly

**Week of:**

## Shipped

-

## Still open

- [ ]

## Next week

- [ ]
`
    ),
  },
  {
    title: 'Reading',
    content: withInstruction(
      'What it is about, the quotes that matter, and why you kept it.',
      `# Reading

**Source:**
**Date:**

## What it's about

## Highlights

==quote==

## Why it matters

`
    ),
  },
  {
    title: 'Feasibility spike',
    content: withInstruction(
      'Time-boxed. Answer the question, say what you tried, then go or no-go.',
      `# Feasibility spike

Time-boxed look at whether something is worth building.

## Question

## Time box

## What we tried

-

## What we learned

-

## Go / no-go

`
    ),
  },
  {
    title: 'Options comparison',
    content: withInstruction(
      'Compare real options. End with one recommendation.',
      `# Options comparison

## Problem

## Options

| Option | Pros | Cons | Cost |
| --- | --- | --- | --- |
| A |  |  |  |
| B |  |  |  |

## Recommendation

`
    ),
  },
  {
    title: 'Codebase exploration',
    content: withInstruction(
      'What you expected, what you found, entry points, open questions.',
      `# Codebase exploration

## Area

## What I expected

## What I found

-

## Entry points

-

## Open questions

- [ ]
`
    ),
  },
  {
    title: 'Crash',
    content: withInstruction(
      'Summary, repro, stack, environment. Do not paste secrets.',
      `# Crash

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
`
    ),
  },
  {
    title: 'Bug fix',
    content: withInstruction(
      'What is broken, expected, repro, fix, how we will know.',
      `# Bug fix

## What's broken

## Expected

## Repro

1.

## Fix

## How we'll know it's fixed

`
    ),
  },
  {
    title: 'Data integrity',
    content: withInstruction(
      'What looks wrong, who is affected, the write path, recovery steps.',
      `# Data integrity

## What looks wrong

## Who / what is affected

## Suspected write path

## Recovery

- [ ]
`
    ),
  },
  {
    title: 'Security',
    content: withInstruction(
      'Report, impact, attack path, mitigation. No credentials in the note.',
      `# Security

## Report

## Impact

## Attack path

## Mitigation

- [ ]

## Follow-up

- [ ]
`
    ),
  },
  {
    title: 'Race condition',
    content: withInstruction(
      'Symptom, shared state, timing, repro, fix.',
      `# Race condition

## Symptom

## Shared state

## Timing

## Repro

1.

## Fix
`
    ),
  },
  {
    title: 'Design',
    content: withInstruction(
      'Problem, constraints, proposal, alternatives, risks.',
      `# Design

## Problem

## Constraints

## Proposal

## Alternatives

## Risks
`
    ),
  },
  {
    title: 'Postmortem',
    content: withInstruction(
      'What happened, impact, timeline, root cause, actions. No blame.',
      `# Postmortem

**Date:**
**Severity:**

## What happened

## Impact

## Timeline

## Root cause

## What went well

## Action items

- [ ]
`
    ),
  },
  {
    title: 'PR review',
    content: withInstruction(
      'What you checked, notes, verdict. Be specific about risk.',
      `# PR review

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

`
    ),
  },
];
