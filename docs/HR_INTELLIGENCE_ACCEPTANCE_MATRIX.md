# HR Intelligence acceptance matrix

Date: 2026-09-01  
Dataset: generated people/stores/companies only (Northwind-style fixtures). No customer data.  
Processing mode for automated rows: Jest with `LLM_MODE` from `tests/setup-env.cjs` (mocked Gemini) unless noted as `npm run eval:run` (fixture subject heuristic).  
Confidence column is the **application’s stored match/classification confidence**, not a live-model claim.

Pass/fail:

- **Pass** — an automated test or fixture eval case covers the scenario and matches expected behavior
- **Fail** — code/tests show the expected behavior is not met
- **Not run** — implemented path exists; no dedicated scenario test in this pass

---

## Identity resolution

| # | Scenario | Input | Expected | Actual (from code/tests) | Confidence | Manual review | Related | Stakeholders | Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Exact employee email | Contact email equals directory email | Single exact match | `employeeRepository.findByEmail` → `EMPLOYEE_MATCH_METHOD.EXACT` score 100 | 100 | No if only one match | Same identity id | Directory CC if store known | matching service + existing employee tests | Pass |
| 2 | Employee ID match | Stable HR employee id in payload | Match on directory employee id | **No dedicated employee-number column lookup.** Matching is email, Intercom contact id, canonical name, alias, token/fuzzy | n/a | n/a | n/a | n/a | code inspection `employee.matching.service.ts` | Fail (gap) |
| 3 | Name + store | “Jordan Hale” + store 1042 inbox | Prefer store roster | Store path runs before domain/name (`EMPLOYEE_SEARCH_PATH.STORE`) | ≥ threshold | If 0 or >1 match | Same identity | Store CC | employee search-scope tests | Pass |
| 4 | Nickname / alias | Alias row for identity | `ALIAS` method | Alias lookup in matching service | typically 100 | No if unique | Alias names in related search bag | Unchanged | matching alias path | Pass |
| 5 | Same employee across conversations | Two tickets, same identity | Same `employee_identity_id`; related list includes peer | `conversation_employees` + related retrieval by identity ids | snapshot confidence | No | Yes if identity shared | Per store | related retrieval + sibling tests | Pass |
| 6 | Two employees same name | Two roster rows “Jordan Hale” | Do not force a single high-confidence winner without extra attributes | Multiple matches / possible-same-person; `requiresManualReview` when `length !== 1` | not 100 forced | Yes | May list both identities’ cases | Unchanged | processor `requiresManualReview` | Pass |
| 7 | Ambiguous identity | Subject “Coaching — Jordan” | Manual review | Eval case `ambiguous-1`; processor review when match count ≠ 1 | low | Yes | No strong related | Store CC if store present | `eval/dataset.v1.json` `ambiguous-1` | Pass (fixture) |
| 8 | Missing employee information | No name in subject/body | No employee match canvas copy | `NO_EMPLOYEE_MATCH` canvas state | 0 | Yes | No related | Store CC still possible | canvas contract smoke | Pass |
| 9 | Conflicting indicators | Email identity A, extracted name identity B | Domain gate + scoring; not silent merge | Domain gate filters; possible-same-person hints | reduced | Yes if ≠ 1 | Identity ids that survived | Unchanged | domain-gate + matching util tests | Pass |
| 10 | Unknown person must not be force-matched | Novel name, empty roster | May **create** a new identity on `CREATED` path | Store miss can create identity (`EMPLOYEE_SEARCH_PATH.CREATED`) — useful for learning, **can** force a new person | 100 on create | Notices in canvas | None yet | Unchanged | matching create path | Fail vs “never force-match unknown” if create is considered force-match |

---

## Store / company resolution

| # | Scenario | Input | Expected | Actual | Confidence | Manual review | Related | Stakeholders | Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Store number in sender address | `1042@northwind.co` | Store 1042 | `parseReporterContext` digits-only local part | n/a | No | Scope historically store; related currently all stores for same employee | CC for 1042 | reporter-context tests + eval `store-email-1` | Pass |
| 2 | Store number in email body | Body “store 1042”, personal gmail sender | Prefer explicit store; do not treat dates/phones as store | Body is **not** a first-class store extractor. Store comes from reporter email/name, Canvas manual entry, or directory | n/a | Yes if missing | Unscoped | `CC_NO_STORE` until entered | code inspection | Fail (body not parsed as store) |
| 3 | Store number in subject | Subject includes 1042 | Same as body | Subject is not parsed as store id | n/a | Yes if reporter has no store | Unscoped | Manual Canvas store | code inspection | Fail |
| 4 | Company-domain match | `alex@northwind.co` non-numeric local | Domain `northwind.co`; no fake store | Personal-looking local parts rejected; domain extracted | n/a | Store missing → CC empty | Domain was used for employee search | No store CC | reporter-context + email-domain tests | Pass |
| 5 | Missing store number | Gmail sender, no store | No store; manual review often true | Eval `missing-store-1` | n/a | Yes in fixture eval | Related still by employee name | no_store CC | eval fixture | Pass |
| 6 | Conflicting store numbers | Email 1042, body 88 | Must not silently pick both | Only reporter email/name store is used; Canvas manual store overwrites reporter store | n/a | Operator can set store | Unchanged until re-analyze | CC follows stored store number | Canvas store submit | Pass (email wins unless operator sets) |
| 7 | Store alias / alternate format | `01042` vs `1042` | Normalize numeric | `normalizeStoreNumber` strips leading zeros for pure digits | n/a | No | Lookup uses normalized | Directory match | store-directory.parser | Pass |
| 8 | Store belonging to wrong company | Store 1042 exists on two tenants | Must not suggest other company stakeholders | CC lookup is ambiguous when multiple companies share a store number (`status: 'ambiguous'`) | n/a | Yes | Employee related still global | No CC list | cc-recipients service | Pass |

Phone numbers, ISO dates, and Intercom conversation ids are not treated as store ids in the **email local-part** parser (digits glued to 5+ letter names are rejected). Unrelated numbers in **body/subject** are not extracted as stores (gap #2–3).

---

## Classification

| # | Scenario | Input | Expected | Actual | Confidence | Manual review | Related | Stakeholders | Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Clear category | “Attendance — Jordan Hale” | `attendance` | Keyword + Gemini `caseType` + similar-subject | extraction 85 gemini / 55 fallback | Not from category alone | Related currently **not** filtered by category (Amber test comment in processor) | Unchanged | `case-type.util` + eval `conf-1` | Pass (category); related-category filter off |
| 2 | Multiple possible categories | Attendance + conduct in subject | Priority list (attendance before conduct) | `CASE_TYPE_PRIORITY` | n/a | No | Same | Unchanged | case-type unit tests | Pass |
| 3 | Low-confidence classification | Fallback extraction | extractionConfidence 55; manual review if employee weak | Processor sets extractionConfidence from source | 55 fallback | If employee ≠ 1 or score < `MANUAL_REVIEW_CONFIDENCE` (60) | May still link by employee | Unchanged | processor persist | Pass |
| 4 | Missing information | Empty body | Subject keywords / general | `general` fallback possible | low | Often yes | Weak | Unchanged | case-type util | Pass |
| 5 | Malformed LLM response | Invalid JSON | Fallback extraction, not crash | name-extraction service fallback path | fallback | Often yes | Keyword related | Unchanged | extraction tests | Pass |
| 6 | LLM timeout | Gemini timeout | Failure attempts, bounded retries, safe error | `MAX_INTELLIGENCE_ATTEMPTS`, classify timeout | n/a | Failed canvas state | none | Unchanged | retry + intelligence-attempt tests | Pass |
| 7 | Fixture-mode classification | `LLM_MODE=fixture` / `processingMode=fixture` | Deterministic, labelled fixture | snapshot `processingMode: 'fixture'`, model `fixture-v1` | n/a | Dataset-driven | Heuristic in eval | Unchanged | `eval:run` | Pass |
| 8 | Human correction of category | Dashboard `caseType` correction | Persist + `operatorConfirmedFields` includes `caseType`; later AI keeps it unless Re-analyze | `applyOperatorCorrectionToSnapshot` + processor honor | 100 manual | Operator choice | Rebuilt unless dismissed | Unchanged | operator-correction unit | Pass |

---

## Related cases

Retrieval (product): conversations sharing employee identity ids and/or name-bag terms, 6-month window, list limit 20. Category filter is **currently disabled** in `intelligence.processor.ts`. Evidence shown: “Linked because: same employee (names)”.

Eval related precision/recall is **not** this SQL service — it is “predicted employee equals expected employee”.

| # | Scenario | Input | Expected | Actual | Confidence | Manual review | Related | Stakeholders | Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Same employee, relevant issue | Two attendance tickets, identity 4 | Peer appears | Identity id search | n/a | No | Yes | Per store | related retrieval tests | Pass |
| 2 | Same employee, unrelated issue | Attendance vs uniform | Should exclude if category filter on | **Currently included** (same employee, any category) | n/a | Operator dismiss | Yes (broader than desired) | Unchanged | processor comment “TEMP (Amber test)” | Fail vs strict relevance |
| 3 | Same store, different employee | Store 1042, Riley vs Jordan | Should not list as related | Related is employee/name based, not store-only | n/a | No | No | Same store CC independently | related search input | Pass |
| 4 | Similar wording, different people | Shared “late again” | Must not be strong evidence | Weak keywords without name bag should not dominate; name terms min length 3 | n/a | No | No if names differ | Unchanged | `related-case-name-match` | Pass |
| 5 | Nickname across cases | Alias on identity | Name bag includes variants | `getNameMatchVariants` + aliases | n/a | No | Yes | Unchanged | related-case-search.util | Pass |
| 6 | Multiple historical cases | Several peers | Up to 20, newest first | `RELATED_CASE_LIST_LIMIT` | n/a | No | Multiple | Unchanged | constants + retrieval | Pass |
| 7 | No relevant historical case | First ticket | Empty related + canvas copy | `NO_RELATED_CASES` | n/a | No | None | Unchanged | canvas smoke | Pass |
| 8 | Exclude despite shared keywords | Shared “employee” / “issue” | Noise words dropped | `SUBJECT_NOISE_WORDS` in case-type; related search min term 3 | n/a | No | Should not link on “issue” alone | Unchanged | name-match util | Pass |

Fixture eval (`eval-v1`, 6 cases) related precision/recall: **run `npm run eval:run` and record the JSON** — do not copy stale 362-test-era numbers.

---

## Stakeholder routing

| # | Scenario | Input | Expected | Actual | Confidence | Manual review | Related | Stakeholders | Test | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Correct company and store recipients | Store 1042 Northwind | Directory + fixed contacts | `ccRecipientsService.resolveForStoreNumber` | n/a | No | Unchanged | Named recipients | cc-recipients tests | Pass |
| 2 | Multiple addresses for one group | Several emails on store row | All unique emails | `pushUnique` by email | n/a | No | Unchanged | Deduped list | cc-recipients | Pass |
| 3 | Missing stakeholder mapping | Unknown store | `not_found` message, empty list | Canvas copy | n/a | Operator may edit store | Unchanged | Empty | canvas CC | Pass |
| 4 | Duplicate recipients | Same email twice | One row | `pushUnique` | n/a | No | Unchanged | One | cc-recipients | Pass |
| 5 | Invalid / inactive recipient | Blank or non-email | Dropped | Requires `@` | n/a | No | Unchanged | Omitted | cc-recipients | Pass |
| 6 | Manual stakeholder correction | Dashboard `stakeholders` field | Persist on snapshot; later AI keeps if confirmed | `operatorConfirmedFields` includes `stakeholders` | n/a | Operator | Unchanged | Manual list | operator-correction util | Pass (unit) |
| 7 | Wrong tenant never suggested | Other company store 1042 | Ambiguous or company-scoped directory | Ambiguous if two companies share number; directory import is this app’s data | n/a | Yes if ambiguous | Unchanged | Empty if ambiguous | cc-recipients ambiguous | Pass |

---

## Notes for recruiters

This matrix is **synthetic**. Live Intercom rows are **Not run**. Related-case product recall is broader than “same issue” while the Amber category filter is off. Employee **ID** match (scenario I2) is not implemented as a directory key.
