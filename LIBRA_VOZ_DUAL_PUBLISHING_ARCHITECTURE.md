# LIBRA VOZ — Dual publishing architecture

Product decision (2026-11-08): support independent-author publishing and a managed LIBRA editorial route. In managed publishing, the publishing entity receives KDP royalties and settles the author's share under a written agreement. Preserve the mobile-first LIBRA experience; KDP is the distribution destination, not the user experience.

## 1. Two publishing lanes
### Lane A — Independent author
- Author is the KDP account holder and publisher of record; Amazon pays the author's configured payment destination.
- LIBRA prepares manuscript, cover, metadata, exports, checks and guided handoff.
- Author personally completes KDP identity, tax, banking, rights, price and final submission.
- LIBRA never collects Amazon passwords, one-time codes, bank credentials, identity document images or Amazon session cookies.

### Lane B — LIBRA managed editorial
- A legally constituted LIBRA publishing entity (not an individual's personal account by default) is the KDP account holder/publisher.
- LIBRA accepts only works with documented publishing/distribution authorization and a signed author agreement.
- KDP royalties are paid to the publisher entity. LIBRA maintains a per-title ledger and pays authors under the agreed royalty base, percentage, deductions, currency, threshold, schedule, statements, tax treatment, refunds and termination terms.
- Author approves final work, cover, metadata, territories, formats, price and rights grant before submission.
- No managed title is submitted until legal, tax, accounting and rights review is complete.

Important: KDP's agreement binds the individual or entity identified in the KDP account as publisher. The account holder makes rights/compliance warranties and is responsible for required licenses and payments to co-owners. A personal account must not be treated as a pooled account for unrelated authors. Validate the managed model with Argentine publishing/IP counsel and tax/accounting advisers, and confirm eligibility with Amazon.

## 2. Mobile LIBRA experience
1. Mi editorial — visual cover, title, progress and next action.
2. Elegí cómo publicar — independent author or LIBRA editorial, with clear explanation of publisher and royalty recipient.
3. Ficha del libro — select an existing LIBRA book; prefill title, author and description.
4. Derechos y autoría — confirm ownership/permissions, collaborators, image and translation rights, public-domain status and third-party material.
5. Declaración de IA — record whether text, images or translations were AI-generated or AI-assisted; derive KDP declaration from asset provenance, never a blanket checkbox.
6. Ediciones — Kindle eBook, paperback, hardcover where supported; select trim size, bleed, paper and ink for print.
7. Preparación automática — generate EPUB, print interior PDF and full-wrap cover; run deterministic preflight and explain issues.
8. Economía — estimate price, printing cost/royalty where reliable, LIBRA share and author settlement. Never promise exact net income until marketplace inputs are confirmed.
9. Aprobación — show exact files, metadata, rights, price and route; require explicit author approval.
10. Submit/handoff — independent lane uses official KDP; managed lane uses only an authorized Amazon workflow. No automation that bypasses controls.
11. Seguimiento — draft, files ready, author approval, submitted, in review, live, blocked or withdrawn. Say published only after KDP confirms live status.

## 3. Technical architecture
### Client
- Existing IndexedDB books remains canonical manuscript store.
- Add publicationProjects keyed by stable project ID and linked to bookId.
- Store immutable metadata/file revisions, rights/provenance, approvals and audit timestamps. Never overwrite manuscript content.
- Keep screens responsive and in-app; external KDP handoff only at the final authorized step.

### Backend (future, gated)
- Authenticated API for project sync, generation jobs, preflight, audit events and managed editorial workflow.
- Server-side secrets only; never expose provider keys in app JS.
- Object storage for immutable EPUB/PDF/cover artifacts and short-lived signed links.
- Database entities: users, books, publication_projects, publication_versions, rights_grants, author_agreements, approvals, artifacts, kdp_submissions, royalty_statements, author_settlements and audit_events.
- Author sees own projects/statements; editorial staff sees authorized managed titles; finance sees settlement data; least privilege.
- No Amazon API until Amazon confirms a supported official mechanism and grants access. No scraping KDP or storing credentials/session cookies.

### AI orchestration
- Manuscript editor: source-grounded revisions and change tracking.
- Metadata assistant: description, category and keyword suggestions; user approves.
- Production assistant: EPUB/PDF/cover generation to explicit print specs.
- Preflight: deterministic validation first; AI can explain errors but cannot waive hard failures.
- Rights/provenance assistant asks factual questions; never invents ownership or consent.
- Asset provenance ledger classifies human-created, AI-assisted or AI-generated assets with source and approval.

## 4. Managed royalty ledger
Record actual KDP royalty by marketplace, format and currency; refunds/reversals/withholding/FX separately; contract royalty base and author percentage; LIBRA share/fees; amount payable, currency, date, payment reference and reconciliation. Reconcile only against actual KDP statements, never estimated retail sales. Preserve immutable corrections and audit history.

## 5. Security, compliance and consent
- No Amazon credentials, OTPs, cookies, identity documents or bank details in LIBRA.
- Encrypt contract/tax/payment data in transit and at rest; restrict access and log reads/writes.
- Contract defines rights, formats, territories, term, exclusivity, royalty base, deductions, reporting, payment cadence, taxes, warranties, takedown, dispute and termination.
- Legal review before managed publishing, royalty collection or author payouts are enabled.

## 6. Delivery plan
### Phase 1 — Local mobile editorial dossier
- Select an actual book from IndexedDB; prefill/edit title, author and description.
- Choose publishing lane and target formats.
- Persist a versioned local project linked to bookId.
- Add rights and AI provenance checklist fields; no legal consent is preselected.
- Show readiness truthfully; preparation saved is not KDP-ready.
- No backend, paid service, Amazon credentials, API, upload or payout.
### Phase 2 — File production
- Generate valid EPUB, print-ready interior PDF and full-wrap cover.
- Ask trim size, paper, ink, bleed and page count before cover dimensions.
- Validate deterministically and use real KDP preview/proof; preserve source and generated versions.
### Phase 3 — Independent KDP handoff
- Package files, metadata and AI disclosure checklist; guide through official KDP on mobile.
- Record author-confirmed KDP status and product URL.
### Phase 4 — LIBRA managed editorial pilot
- Establish legal entity, bank/tax setup, contracts, accounting and support.
- Confirm KDP eligibility and permitted workflow with Amazon.
- Pilot only with explicitly contracted authors; reconcile real KDP statements before scaling.
### Phase 5 — Official integration
- Evaluate Amazon-approved APIs/partner mechanisms and scopes only if available.
- Keep LIBRA UI; change only compliant publishing adapter.
- Never reverse-engineer or automate around KDP controls.

## 7. Phase 1 acceptance criteria
- Existing recordings/books remain readable; no destructive IndexedDB reset.
- Open editorial from library, select a real book and see its title/author.
- Save/reopen project without changing manuscript.
- Change publishing lane and formats; collect no credentials.
- No rights or AI declaration pre-checked.
- Readiness says no KDP submission has occurred.
- Android CI and physical-device selection/save/reload/navigation tests pass.
## 8. Multi-platform distribution research (2026-11-08)

### Important correction: no 400/500-copy KDP requirement
Amazon KDP publishes print books on demand. KDP states that authors do not pay upfront printing costs or hold inventory; print cost is deducted from royalties when a customer orders. Proof/author copies are optional and charged at author/print cost plus shipping. LIBRA must not tell users they must buy 400 or 500 copies.
Official references:
- https://kdp.amazon.com/es_ES/help/topic/GHKDSCW2KQ3K4UU4
- https://kdp.amazon.com/en_US/help/topic/G201834340
- https://kdp.amazon.com/en_US/help/topic/G7BBN68RYX5UMDZF
- https://kdp.amazon.com/en_US/help/topic/G2MYNEKHT443C2H2

### Platforms evaluated
- Amazon KDP: eBook, paperback and hardcover; print on demand; no mandatory author bulk purchase; optional proof/author copies at print cost plus shipping.
- IngramSpark: print and eBook global distribution; current pricing page says account signup and title upload are free; print/ship costs and commercial discount/other current terms must be calculated per title.
- Lulu: print on demand, no minimum/maximum order quantity; retail/global distribution currently lists a one-time non-refundable USD 4.99 first-submission review fee and requires an approved proof copy where applicable; process can take at least 12 weeks. Critical overlap restriction: Lulu says titles already listed on Amazon or another retail partner are not eligible for its Global Distribution. Do not promise simultaneous duplicate distribution through Lulu and KDP.
- Kobo Writing Life: eBooks and audiobooks, no fee to distribute eBooks, non-exclusive; no print-on-demand service.
- Apple Books: direct eBook publishing signup is free; selling requires tax and banking details.
- Barnes & Noble Press: no platform publishing fee and print/eBook options, but currently available only to publishers in US, UK, Ireland, Canada, Australia, New Zealand, France, Italy, Germany, Spain, Netherlands and Belgium. Personal print orders ship only within the US; not presently available to Argentina-based publishers under the listed eligibility.
- Draft2Digital: potential ebook aggregation partner; Amazon distribution is invitation-only. Do not show as a direct LIBRA connector until current fees, territory and eligibility are separately validated.

### Multi-channel rules
- Separate eBook distribution from print distribution; never assume each provider offers both.
- KDP Select makes the enrolled eBook exclusive to Amazon for the enrollment period; do not simultaneously distribute that same eBook elsewhere while enrolled. Print editions can have separate channel decisions.
- Avoid duplicate retailer feeds and conflicting ISBN/imprint metadata. Ask the author to choose direct vs aggregator distribution per retailer.
- Before enabling any platform, show country eligibility, file formats, ISBN requirements, one-time review/setup fees, proof-copy requirements, print/ship cost, sales commission/royalty, payout threshold/schedule and exclusivity.
- Display estimates only as estimates. Require explicit user acceptance of the exact charge before any paid proof, review or print order.
- Platform requirements and fees change; store a verified-at date and link to official terms. Re-check before each submission.

### Product implementation in Phase 1
- Added a mobile platform comparison directory inside Mi Editorial with the above current findings and official links.
- The directory is informational only; no account credentials are collected and no submission is made.
- Future architecture should support a distribution plan per book, with distinct eBook channels and print channels, retailer feed ownership, ISBN allocation, exclusivity windows, fees accepted, proof approval, and submission status per platform.