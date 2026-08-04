# BreedSmart Bug Report Template

Copy this section for every defect. Use one bug ID per independent root problem.

---

## BUG-[000] — Short factual title

### Classification

| Field | Value |
| --- | --- |
| Status | OPEN |
| Severity | Blocker / High / Medium / Low |
| Priority | P0 / P1 / P2 / P3 |
| Reporter | |
| Assigned owner | |
| Date reported | |
| Related test ID | |
| Platform | Farmer Mobile / Technician Mobile / Technician Web / Admin Web / Backend |

### Tested build

| Field | Value |
| --- | --- |
| Branch | `codex/mobile-readiness-checkpoint` |
| Commit | |
| Environment | Development/QA |
| Device or browser | |
| App/build version | |

### Test data

| Field | Value |
| --- | --- |
| User role/account alias | |
| Farmer alias | |
| Animal tag | |
| Request ID | |
| Task ID | |
| Related record ID | |
| Seed scenario | Fresh / QA-RC-XX |

Do not enter passwords, tokens, secrets, or production personal information.

### Preconditions

1.
2.

### Steps to reproduce

1.
2.
3.

### Expected result

Describe the observable correct behavior and required data state.

### Actual result

Describe exactly what happened. Do not diagnose the root cause here.

### Frequency

- [ ] Always
- [ ] Intermittent
- [ ] Once

Attempts reproduced: `__ / __`

### Evidence

- Screenshot:
- Screen recording:
- Browser console or Mobile log:
- Failed API method and URL:
- HTTP status:
- Request payload with secrets removed:
- Response body with secrets removed:
- Relevant timestamp in Asia/Manila:

### Impact

Explain who is affected, whether data is incorrect, and whether testing can continue.

### Workaround

`None` or describe the safe workaround. Never use direct database editing as a workaround.

### Developer resolution

- Root cause:
- Files changed:
- Fix commit:
- Automated test added/updated:
- Known limitations:

### Retest

| Field | Value |
| --- | --- |
| Retester | |
| Retest commit | |
| Retest date | |
| Original case | PASS / FAIL |
| Neighboring regression | PASS / FAIL |
| Negative/retry case | PASS / FAIL |
| Final status | VERIFIED / REOPENED |

Retest evidence:

---

## Severity reminder

- **Blocker:** cannot continue, security exposure, or corrupt/unsafe data.
- **High:** core workflow or official record is wrong/unusable.
- **Medium:** workaround exists; status, synchronization, navigation, or secondary behavior is wrong.
- **Low:** cosmetic, copy, or minor usability issue.

## Status workflow

```text
OPEN → TRIAGED → IN PROGRESS → READY FOR RETEST → VERIFIED
                                      ↘ REOPENED
```
