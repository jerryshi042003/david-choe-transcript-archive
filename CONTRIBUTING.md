# Contributing

## For Tom

Use a fork. Do not ask for or clone any private Jerry repository.

1. Fork `jerryshi042003/david-choe-transcript-archive` on GitHub.
2. Create `tom/<short-description>` from Jerry's current `dev` branch.
3. Make one scoped change.
4. Preview both the archive root and `/tennis-culture/` locally.
5. Run `python3 scripts/check_site.py` and paste the passing result into the pull request.
6. Push to your fork and open a pull request with Jerry's `dev` branch as the base.
7. Include what changed, why, sources used, and screenshots when layout changed.

Jerry reviews and merges into `dev`. Jerry alone promotes reviewed changes from `dev` to production `main`.

## Content rules

- Separate Jerry/Tom statements, proposed plans, public facts, and Choe's first-person accounts.
- Cite the closest primary or official source. Include transcript record and timestamp when available.
- Use short quotations; summarize the surrounding context.
- Label uncertainty. Do not turn memory into fact.
- Link lawful public sources. Do not commit downloaded audio/video, pirate scans, or private material.
- Keep the site black and white, one readable type system, and object/source-first. Do not add navigation, cards, dashboards, hero sections, decorative slogans, or framework dependencies without agreement.
- Images are optional. Use them only when they add source information that text and a link cannot.

## Pull-request scope

Prefer one change per pull request:

- one person/place correction;
- one source or transcript correction;
- one Choe story accumulation;
- one layout or readability fix.

Do not mix archive-wide data rewrites with tennis-culture editorial changes. Never commit secrets or machine-specific absolute paths.

## Production rule

`main` is not a working branch. It is the exact public release. Development and review happen through `dev`; production changes happen only after review.
