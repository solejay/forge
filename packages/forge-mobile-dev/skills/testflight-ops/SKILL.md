---
name: testflight-ops
description: >
  Operational TestFlight tasks: check build processing status, manage beta groups,
  prepare release notes, submit for external testing review, monitor post-upload.
  Triggers on: TestFlight status, beta group, build processing, release notes,
  external testers, testflight ops.
triggers: ["TestFlight status", "beta group", "build processing", "release notes", "external testers", "testflight ops"]
version: 1.0.0
---

# TestFlight Operations

Operational tasks for managing TestFlight builds and beta distribution.

## Check Build Processing Status

```bash
# List recent builds
asc builds list --limit 5

# Check specific build by bundle ID
asc builds list --bundle-id {BUNDLE_ID} --limit 3
```

Build processing typically takes 5-30 minutes. Statuses:
- **Processing** — Apple is processing the build
- **Ready to Submit** — available for internal/external testing
- **Invalid Binary** — build rejected; check email for details

## Manage Beta Groups

```bash
# List beta groups
asc testflight groups list

# Add tester to group
asc testflight testers add --email {EMAIL} --group {GROUP_NAME}

# Remove tester
asc testflight testers remove --email {EMAIL} --group {GROUP_NAME}
```

## Prepare Release Notes

TestFlight "What to Test" notes should be concise and actionable:

```
What to Test:
- {Feature 1}: {how to test it}
- {Feature 2}: {how to test it}
- Known issues: {list any known problems}

Build: {version} ({build_number})
```

## Submit for External Testing Review

External testing requires Apple review (~24-48 hours):

```bash
# Submit latest build for external review
asc testflight submit-for-review

# Check review status
asc testflight builds list --limit 3
```

Requirements before external submission:
- [ ] App icon set
- [ ] Privacy policy URL configured
- [ ] Export compliance (encryption) answered
- [ ] Beta app description filled in
- [ ] Contact info set

## Monitor Post-Upload

After uploading a build:

1. **Check processing** (5-30 min): `asc builds list --limit 1`
2. **Check for email** from Apple about any issues
3. **Verify internal testers** can install
4. **Check crash reports** after testers install:
   - App Store Connect > TestFlight > Crashes
   - Or use crash-triage skill with Crashlytics data
5. **Review tester feedback** in App Store Connect > TestFlight > Feedback

## Common Issues

| Issue | Fix |
|-------|-----|
| Build stuck processing | Wait up to 1 hour; if still stuck, re-upload with bumped build number |
| "Missing Compliance" | Add `ITSAppUsesNonExemptEncryption = false` to Info.plist |
| External review rejected | Check email for reason; fix and re-submit |
| Testers can't see build | Verify they're in the correct beta group and build is distributed |
| Install fails on device | Check minimum OS version matches tester's device |
