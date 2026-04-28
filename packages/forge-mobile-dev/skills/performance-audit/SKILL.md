---
name: performance-audit
description: >
  Proactive performance analysis for iOS and Android apps: app launch time,
  scroll jank, memory pressure, large assets, unused resources, main thread
  violations. Runs static checks and suggests dynamic profiling where needed.
  Triggers on: performance audit, slow, jank, launch time, memory pressure,
  app size, unused resources, performance review.
triggers: ["performance audit", "slow", "jank", "launch time", "memory pressure", "app size", "unused resources", "performance review"]
version: 1.0.0
---

# Performance Audit

Systematic performance analysis across 6 dimensions. Runs static analysis first, then recommends dynamic profiling where needed.

## Platform Detection

Same as mobile-loop: `.xcodeproj`/`.xcworkspace` → iOS, `build.gradle` → Android, both → both.

## Dimension 1: App Launch Time

### iOS Static Checks
- Count `+load` methods (ObjC static initializers): `grep -rn "+load" --include="*.m" .`
- Large storyboards loaded at launch (Main.storyboard size)
- `@UIApplicationMain` / `@main` entry point for synchronous work
- Dynamic framework count: `find . -name "*.framework" -not -path "*/DerivedData/*" | wc -l`
- Pre-main overhead: mention `DYLD_PRINT_STATISTICS=1` env var

### Android Static Checks
- `Application.onCreate()` for heavy initialization
- ContentProvider count in AndroidManifest (each adds startup cost)
- Multidex check (increases cold start)
- Launch theme / splash screen optimization
- Baseline Profile presence: `find . -name "baseline-prof.txt"`

### Thresholds Table
| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| iOS cold start | <1s | 1-2s | >2s |
| Android cold start | <1s | 1-3s | >3s |
| Dynamic frameworks (iOS) | <10 | 10-20 | >20 |
| ContentProviders (Android) | <5 | 5-10 | >10 |

## Dimension 2: Scroll/Render Performance

### iOS Static Checks
- `AnyView` usage in list contexts: grep for `AnyView` in files with `List`/`LazyVStack`
- Non-lazy stacks with many children: `VStack`/`HStack` with >20 child views
- Missing `equatable()` on heavy views
- `GeometryReader` inside scroll views (forces full measurement)
- Synchronous image loading in list cells
- `drawingGroup()` candidates: complex overlapping effects

### Android Static Checks
- Missing `key()` in `LazyColumn`/`LazyRow` items
- Unstable parameters (check compose compiler metrics if available)
- Nested RecyclerView (horizontal inside vertical)
- Deep view hierarchy in XML layouts (overdraw)
- Image loading without Coil/Glide caching in list items

## Dimension 3: Memory Pressure

### iOS Static Checks
- Large image assets: `find . -path "*/Assets.xcassets/*" -name "*.png" -size +500k`
- UIImage without downsampling for thumbnails
- Strong delegate references: grep `var delegate:` without `weak`
- Missing `[weak self]` in closures stored as properties
- Core Data faulting: large fetch requests without `fetchBatchSize`

### Android Static Checks
- Large drawables: `find . -path "*/res/drawable*" -name "*.png" -size +500k`
- Bitmap loading without `inSampleSize` or Coil/Glide
- `GlobalScope.launch` (coroutine leaks)
- Fragment view binding not cleared in `onDestroyView()`
- Large object caches without `LruCache` bounds

## Dimension 4: Asset Size

### Both Platforms
```bash
# Find all image assets over 200KB
find . \( -name "*.png" -o -name "*.jpg" -o -name "*.webp" \) \
  -not -path "*/DerivedData/*" -not -path "*/build/*" -not -path "*/.git/*" \
  -size +200k -exec ls -lh {} \;

# Total asset size
find . -path "*/Assets.xcassets/*" -o -path "*/res/drawable*" | \
  xargs du -sh 2>/dev/null | sort -rh | head -20
```

### Recommendations
- PNG → WebP conversion for Android
- Asset catalog optimization for iOS
- Vector drawables (Android) / SF Symbols (iOS) for icons
- PDF vs SVG vs @1x/@2x/@3x strategy

## Dimension 5: Unused Resources

### iOS
- Recommend `periphery` for dead code: `brew install periphery && periphery scan`
- Find images in Assets.xcassets not referenced in any .swift file

### Android
- `./gradlew lint 2>&1 | grep -i "unused"`
- Resource shrinking: `./gradlew assembleRelease -Pandroid.enableResourceOptimizations=true`

## Dimension 6: Main Thread Violations

### iOS
- `DispatchQueue.main.sync` calls (deadlock risk)
- Network calls not on background: `URLSession` outside async context
- Heavy computation in `.body` or `.onAppear`

### Android
- Room DAO without `suspend`
- SharedPreferences `commit()` instead of `apply()`
- Network calls without `withContext(Dispatchers.IO)`

## Delegation

For issues found, delegate targeted fixes:
Use the `delegate_to_agent` tool:
```
delegate_to_agent(
  agent="ios-engineer",  // or "android-engineer"
  task="Fix performance issue: {description}
  File: {path}
  Current: {problematic_code}
  Suggested: {fix_approach}"
)
```

## Output Report

```markdown
# Performance Audit Report

Platform: iOS / Android / Both
Date: {timestamp}

| Dimension | Status | Issues | Severity |
|-----------|--------|--------|----------|
| Launch Time | PASS/WARN/FAIL | {count} | {highest} |
| Scroll/Render | PASS/WARN/FAIL | {count} | {highest} |
| Memory | PASS/WARN/FAIL | {count} | {highest} |
| Asset Size | PASS/WARN/FAIL | {count} | {highest} |
| Unused Resources | PASS/WARN/FAIL | {count} | {highest} |
| Main Thread | PASS/WARN/FAIL | {count} | {highest} |

## Issues Found
{numbered list: file path, description, severity, suggested fix}

## Dynamic Profiling Recommended
{list of Instruments traces or Android Profiler captures to run}
```
