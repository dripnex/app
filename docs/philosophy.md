# Why Dripnex is the hackable AI note taker

Dripnex is not a files-first Markdown editor.

It is an AI note taker you can hack. Messy input becomes a document a person will send — not a model dump.

---

## The store

Notes live in local SQLite. That is the product identity.

Plain files are easy to romanticize. `.md` is export. It is not how the app works, and it is not how you open Dripnex.

---

## The hack

Hackability is `init.js`, `styles.css`, and satellite packs. Official themes stay empty (`OFFICIAL_THEMES = []`). There is no public marketplace.

---

## Opening the workspace

The workspace opens without an account. Sign-in is only for cloud sync (ADR 007). Sync stays optional and end-to-end. Encryption and passphrase flows stay.

There is no guest identity and no continue-locally path.

---

## What that is not

This is not a manifesto about reducing the ship rate, or about notes living on disk as files.

Those lines are dead. The product is the hackable AI note taker.
