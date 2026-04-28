---
name: code-signing-doctor
description: >
  Diagnose iOS code signing issues: provisioning profiles, certificates,
  entitlements, team IDs, capability mismatches. The #1 time sink in iOS dev.
  Triggers on: code signing, provisioning profile, certificate, entitlements,
  codesign, signing identity, team ID, code sign error.
triggers: ["code signing", "provisioning profile", "certificate", "entitlements", "codesign", "signing identity", "team ID", "code sign error"]
version: 1.0.0
---

# Code Signing Doctor

Systematic diagnosis of iOS code signing issues across 5 layers.

## When to Use
- "No profiles for 'com.example.app' were found"
- "Code signing error: certificate not found"
- "Provisioning profile doesn't include signing certificate"
- "App ID doesn't match provisioning profile"
- Any build error containing "codesign", "signing", or "provisioning"

## Layer 1: Certificates

### Check installed certificates
```bash
# List signing identities
security find-identity -v -p codesigning

# Check for expired certificates
security find-identity -v -p codesigning 2>&1 | grep -i "expired\|invalid\|CSSMERR"

# List by name
security find-certificate -a -c "Apple Development" -p ~/Library/Keychains/login.keychain-db | head -5
security find-certificate -a -c "Apple Distribution" -p ~/Library/Keychains/login.keychain-db | head -5
```

### Certificate Status Table
| Status | Meaning | Fix |
|--------|---------|-----|
| Valid | Current | No action |
| Expired | Past validity | Revoke in Apple Developer portal + create new |
| Revoked | Explicitly revoked | Create new in Apple Developer portal |
| Missing private key | Cert without matching key | Re-export from original Mac or create new |

## Layer 2: Provisioning Profiles

### Check installed profiles
```bash
# List all
ls ~/Library/MobileDevice/Provisioning\ Profiles/

# Decode a profile
security cms -D -i ~/Library/MobileDevice/Provisioning\ Profiles/{UUID}.mobileprovision

# Extract specific fields
security cms -D -i {PROFILE_PATH} | plutil -extract Name raw -
security cms -D -i {PROFILE_PATH} | plutil -extract ExpirationDate raw -
security cms -D -i {PROFILE_PATH} | plutil -extract Entitlements xml1 -
```

### Profile Validation Checklist
- [ ] Not expired (`ExpirationDate` > now)
- [ ] App ID matches bundle ID (exact or wildcard)
- [ ] Includes the signing certificate (`DeveloperCertificates` array)
- [ ] Type matches config (Development for Debug, Distribution for Release)
- [ ] Includes device UDIDs (for Dev/Ad Hoc)

## Layer 3: Entitlements

### Compare project entitlements with profile
```bash
# Read project entitlements
cat {PROJECT_DIR}/*.entitlements

# Read profile entitlements
security cms -D -i {PROFILE_PATH} | plutil -extract Entitlements xml1 -o /tmp/profile_ents.plist -

# Diff
diff <(plutil -convert xml1 {PROJECT_DIR}/*.entitlements -o -) /tmp/profile_ents.plist
```

### Common Entitlement Mismatches Table
| Entitlement | Issue | Fix |
|-------------|-------|-----|
| `aps-environment` | Push not in profile | Add Push capability in portal, regenerate |
| `com.apple.developer.applesignin` | Sign in with Apple missing | Add capability in portal |
| `com.apple.developer.associated-domains` | Associated domains missing | Add capability in portal |
| `keychain-access-groups` | Keychain group mismatch | Update entitlements or regenerate profile |

## Layer 4: Team ID & Build Settings

```bash
xcodebuild -scheme {SCHEME} -showBuildSettings 2>/dev/null | \
  grep -E "DEVELOPMENT_TEAM|CODE_SIGN_IDENTITY|PROVISIONING_PROFILE|CODE_SIGN_STYLE"
```

### Validation
- [ ] `DEVELOPMENT_TEAM` is set (not empty)
- [ ] `CODE_SIGN_STYLE` is Automatic or Manual (consistent across targets)
- [ ] `CODE_SIGN_IDENTITY` matches certificate type
- [ ] `PROVISIONING_PROFILE_SPECIFIER` matches installed profile (if Manual)

## Layer 5: Common Error Patterns & Fixes

| Error Message | Root Cause | Fix |
|---------------|-----------|-----|
| `No profiles for 'X' were found` | No matching profile | Download from portal or use automatic signing |
| `Provisioning profile doesn't include signing certificate` | Cert not in profile | Regenerate profile with current cert |
| `Code signing error: certificate not found` | Missing/expired cert | Check Keychain, re-download from Apple |
| `The certificate chain is not valid` | Missing intermediate cert | Download Apple WWDR CA, add to Keychain |
| `A valid provisioning profile for this executable was not found` | Profile/app ID mismatch | Verify bundle ID matches exactly |
| `Xcode couldn't find any provisioning profiles matching` | Automatic signing can't resolve | Switch to manual or fix portal config |

## Delegation

This skill does NOT delegate to ios-engineer. Code signing requires human action in Apple Developer portal / Xcode GUI. Output a clear ordered action list for the user.

## Output Report

```markdown
# Code Signing Doctor Report

## Certificate Status
{table of installed certs with validity}

## Provisioning Profiles
{table of relevant profiles with expiry + bundle ID match}

## Entitlements
{match/mismatch analysis}

## Build Settings
{DEVELOPMENT_TEAM, CODE_SIGN_STYLE, etc.}

## Diagnosis
{root cause statement}

## Action Required (ordered steps)
1. {step}
2. {step}
...
```
