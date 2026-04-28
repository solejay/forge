/**
 * routing.ts — Mobile keyword detection and agent routing
 *
 * Replaces mobile-keyword-detector.mjs hook.
 * Analyzes user input with weighted keyword scoring and injects
 * platform routing context so the agent routes to the right persona/skill.
 */

// --- Weighted signal definitions ---
// Each entry: [pattern, weight]

const iosStrong: [string, number][] = [
  ["swiftui", 3],
  ["xcodeproj", 3],
  ["xcworkspace", 3],
  ["simctl", 3],
  ["testflight", 3],
  ["xctest", 3],
  ["xctestcase", 3],
  ["@viewbuilder", 3],
  ["navigationstack", 3],
  ["navigationview", 3],
  ["scenedelegate", 3],
  ["appdelegate", 3],
  ["fastlane ios", 3],
  ["#preview", 3],
];

const iosMedium: [string, number][] = [
  ["swift", 2],
  ["uikit", 2],
  ["xcode", 2],
  ["info.plist", 2],
  [".ipa", 2],
  ["codesign", 2],
  ["notarize", 2],
  ["provisioning", 2],
  ["xcrun", 2],
  ["pod install", 2],
  ["swiftpackage", 2],
  ["@observedobject", 2],
  ["@stateobject", 2],
  ["@environmentobject", 2],
];

const iosWeak: [string, number][] = [
  ["ios", 1],
  ["iphone", 1],
  ["ipad", 1],
  ["@state", 1],
  ["@binding", 1],
  ["spm", 1],
  ["watchos", 1],
  ["macos", 1],
];

const androidStrong: [string, number][] = [
  ["@composable", 3],
  ["androidmanifest", 3],
  ["lazycolumn", 3],
  ["lazyrow", 3],
  ["jetpack compose", 3],
  ["navhost", 3],
  ["play store", 3],
  ["google play", 3],
  ["fastlane android", 3],
  ["firebase android", 3],
  ["android studio", 3],
  ["navcontroller", 3],
];

const androidMedium: [string, number][] = [
  ["kotlin", 2],
  ["gradle", 2],
  ["hilt", 2],
  ["dagger", 2],
  ["room", 2],
  ["stateflow", 2],
  ["livedata", 2],
  [".apk", 2],
  [".aab", 2],
  ["apk", 2],
  ["aab", 2],
  ["minsdk", 2],
  ["targetsdk", 2],
  ["proguard", 2],
  ["r8", 2],
];

const androidWeak: [string, number][] = [
  ["compose", 1],
  ["activity", 1],
  ["fragment", 1],
  ["viewmodel", 1],
  ["coroutines", 1],
  ["adb", 1],
  ["jetpack", 1],
  ["android", 1],
];

const rnSignals: [string, number][] = [
  ["react native", 3],
  ["react-native", 3],
  ["expo", 3],
  ["metro", 2],
  ["platform.os", 2],
  ["nativemodules", 2],
  ["turbomodules", 2],
  [".ios.tsx", 2],
  [".android.tsx", 2],
  ["eas build", 2],
  ["expo go", 2],
  ["bare workflow", 2],
  ["managed workflow", 2],
];

const mobileLoopSignals: [string, number][] = [
  ["simulator", 2],
  ["emulator", 2],
  ["how does it look", 2],
  ["screenshot", 2],
  ["preview", 1],
  ["visual", 1],
  ["ui bug", 2],
  ["layout issue", 2],
  ["see the screen", 2],
  ["what does it look like", 2],
  ["show me", 1],
  ["check the ui", 2],
];

const crashSignals: [string, number][] = [
  ["crash", 2],
  ["stack trace", 2],
  ["sigsegv", 3],
  ["exc_bad_access", 3],
  ["sigabrt", 3],
  ["fatal exception", 2],
  ["anr", 2],
  ["oom", 1],
  ["out of memory", 2],
  ["crashlytics", 3],
  ["symbolicate", 3],
  ["tombstone", 3],
  ["force unwrap", 2],
  ["null pointer", 2],
];

const deploySignals: [string, number][] = [
  ["testflight", 3],
  ["play store", 3],
  ["distribute", 2],
  ["beta", 1],
  ["submit to", 2],
  ["upload to", 2],
  ["fastlane", 2],
  ["ship it", 1],
];

const scaffoldSignals: [string, number][] = [
  ["scaffold feature", 3],
  ["feature scaffold", 3],
  ["new feature", 2],
  ["create feature", 2],
  ["generate feature", 2],
  ["add feature", 2],
  ["add module", 2],
  ["new module", 2],
];

const perfSignals: [string, number][] = [
  ["performance audit", 3],
  ["performance review", 3],
  ["jank", 3],
  ["launch time", 3],
  ["memory pressure", 3],
  ["app size", 2],
  ["unused resources", 2],
  ["scroll performance", 3],
];

const signingSignals: [string, number][] = [
  ["code signing", 3],
  ["code sign error", 3],
  ["provisioning profile", 3],
  ["signing identity", 3],
  ["entitlements", 3],
  ["certificate", 2],
  ["team id", 2],
];

const a11ySignals: [string, number][] = [
  ["accessibility audit", 3],
  ["accessibility review", 3],
  ["voiceover", 3],
  ["talkback", 3],
  ["dynamic type", 3],
  ["color contrast", 3],
  ["wcag", 3],
  ["a11y", 3],
];

const androidDebugSignals: [string, number][] = [
  ["logcat", 3],
  ["anr trace", 3],
  ["strictmode", 3],
  ["leakcanary", 3],
  ["compose recomposition", 3],
  ["heap dump", 2],
  ["thread dump", 2],
  ["anr", 2],
];

const motionSignals: [string, number][] = [
  ["animation", 2],
  ["transition", 2],
  ["spring animation", 3],
  ["haptic", 3],
  ["haptic feedback", 3],
  ["motion design", 3],
  ["entrance animation", 3],
  ["screen transition", 3],
  ["loading animation", 3],
  ["success animation", 3],
  ["micro-interaction", 3],
  ["micro interaction", 3],
  ["animate", 2],
  ["lottie", 3],
  ["shimmer", 3],
  ["skeleton loading", 3],
  ["bounce", 2],
  ["easing", 3],
  ["withanimation", 3],
  ["matchedgeometryeffect", 3],
  ["animatedasstate", 3],
  ["spring(", 3],
  ["app feels static", 3],
  ["feels lifeless", 3],
  ["add motion", 3],
  ["add animations", 3],
  ["stagger", 3],
  ["parallax", 3],
];

const ambiguousMotion: Record<string, string[]> = {
  animation: ["ios", "android", "swift", "kotlin", "swiftui", "compose", "app", "mobile", "screen", "view", "button", "card", "list", "transition", "spring", "haptic"],
  transition: ["ios", "android", "swift", "kotlin", "swiftui", "compose", "screen", "navigation", "push", "modal", "tab", "animate"],
  animate: ["ios", "android", "swift", "kotlin", "swiftui", "compose", "view", "screen", "button", "card", "transition", "spring"],
  bounce: ["ios", "android", "swift", "kotlin", "spring", "animation", "button", "press"],
};

// --- Negative filters ---
// Ambiguous terms only count if corroborating context exists

const ambiguousAndroid: Record<string, string[]> = {
  compose: ["android", "kotlin", "jetpack", "@composable", "composable", "lazycolumn", "lazyrow", "navhost"],
  activity: ["android", "kotlin", "fragment", "intent", "manifest", "gradle", "lifecycle"],
  fragment: ["android", "kotlin", "activity", "navigation", "gradle", "lifecycle"],
  viewmodel: ["android", "kotlin", "hilt", "stateflow", "livedata", "compose"],
  coroutines: ["android", "kotlin", "flow", "stateflow", "suspend", "launch"],
  adb: ["android", "emulator", "device", "logcat", "install"],
};

const ambiguousDeploy: Record<string, string[]> = {
  deploy: ["testflight", "play store", "ipa", "apk", "aab", "fastlane", "simulator", "emulator", "ios", "android", "mobile"],
  release: ["testflight", "play store", "ipa", "apk", "aab", "fastlane", "app store", "ios", "android", "mobile", "beta"],
  "ship it": ["testflight", "play store", "ipa", "apk", "aab", "fastlane", "ios", "android", "mobile"],
};

const ambiguousPerf: Record<string, string[]> = {
  slow: ["ios", "android", "swift", "kotlin", "app", "mobile", "simulator", "emulator", "launch", "scroll"],
  optimize: ["ios", "android", "swift", "kotlin", "app", "mobile", "performance"],
};

const ambiguousAndroidDebug: Record<string, string[]> = {
  debug: ["android", "kotlin", "logcat", "anr", "compose", "emulator", "gradle", "adb"],
  bug: ["android", "kotlin", "crash", "logcat", "compose", "adb"],
};

// --- Scoring functions ---

function scoreSignals(signals: [string, number][], prompt: string): number {
  let total = 0;
  for (const [pattern, weight] of signals) {
    if (prompt.includes(pattern)) {
      total += weight;
    }
  }
  return total;
}

function scoreWithFilters(
  signals: [string, number][],
  filters: Record<string, string[]>,
  prompt: string,
): number {
  let total = 0;
  for (const [pattern, weight] of signals) {
    if (!prompt.includes(pattern)) continue;
    if (filters[pattern]) {
      const hasContext = filters[pattern].some((ctx) => prompt.includes(ctx));
      if (hasContext) {
        total += weight;
      }
    } else {
      total += weight;
    }
  }
  return total;
}

// --- Thresholds ---

const PLATFORM_THRESHOLD = 4;
const DUAL_THRESHOLD = 3;
const MOBILE_LOOP_THRESHOLD = 3;
const CRASH_THRESHOLD = 2;
const DEPLOY_THRESHOLD = 3;
const SCAFFOLD_THRESHOLD = 3;
const PERF_THRESHOLD = 3;
const SIGNING_THRESHOLD = 3;
const A11Y_THRESHOLD = 3;
const ANDROID_DEBUG_THRESHOLD = 4;
const MOTION_THRESHOLD = 3;

export interface RoutingScores {
  iosScore: number;
  androidScore: number;
  rnScore: number;
  isDualPlatform: boolean;
  isIosPrimary: boolean;
  isAndroidPrimary: boolean;
  isPlatformSpecific: boolean;
  needsMobileLoop: boolean;
  isCrash: boolean;
  isDeploy: boolean;
  isScaffold: boolean;
  isPerf: boolean;
  isSigning: boolean;
  isA11y: boolean;
  isAndroidDebug: boolean;
  isMotion: boolean;
}

export function scorePrompt(prompt: string): RoutingScores {
  const p = prompt.toLowerCase();

  const iosScore = scoreSignals(iosStrong, p) + scoreSignals(iosMedium, p) + scoreSignals(iosWeak, p);

  const androidScore =
    scoreSignals(androidStrong, p) + scoreSignals(androidMedium, p) + scoreWithFilters(androidWeak, ambiguousAndroid, p);

  const rnScore = scoreSignals(rnSignals, p);

  const mobileLoopScore = scoreSignals(mobileLoopSignals, p);
  const crashScore = scoreSignals(crashSignals, p);
  const scaffoldScore = scoreSignals(scaffoldSignals, p);
  const perfScore = scoreSignals(perfSignals, p) + scoreWithFilters([["slow", 2], ["optimize", 2]], ambiguousPerf, p);
  const signingScore = scoreSignals(signingSignals, p);
  const a11yScore = scoreSignals(a11ySignals, p);
  const androidDebugScore =
    scoreSignals(androidDebugSignals, p) + scoreWithFilters([["debug", 2], ["bug", 1]], ambiguousAndroidDebug, p);

  const motionScore =
    scoreWithFilters(motionSignals, ambiguousMotion, p);

  // Deploy scoring with its own negative filters
  let deployScore = scoreSignals(deploySignals, p);
  for (const term of Object.keys(ambiguousDeploy)) {
    if (p.includes(term)) {
      const hasContext = ambiguousDeploy[term].some((ctx) => p.includes(ctx));
      if (hasContext) deployScore += 2;
    }
  }

  const isDualPlatform = (iosScore >= DUAL_THRESHOLD && androidScore >= DUAL_THRESHOLD) || rnScore >= 4;
  const isIosPrimary = iosScore >= PLATFORM_THRESHOLD && iosScore > androidScore;
  const isAndroidPrimary = androidScore >= PLATFORM_THRESHOLD && androidScore > iosScore;

  return {
    iosScore,
    androidScore,
    rnScore,
    isDualPlatform,
    isIosPrimary,
    isAndroidPrimary,
    isPlatformSpecific: isIosPrimary || isAndroidPrimary,
    needsMobileLoop: mobileLoopScore >= MOBILE_LOOP_THRESHOLD && (iosScore >= 1 || androidScore >= 1 || rnScore >= 1),
    isCrash: crashScore >= CRASH_THRESHOLD,
    isDeploy: deployScore >= DEPLOY_THRESHOLD,
    isScaffold: scaffoldScore >= SCAFFOLD_THRESHOLD,
    isPerf: perfScore >= PERF_THRESHOLD,
    isSigning: signingScore >= SIGNING_THRESHOLD,
    isA11y: a11yScore >= A11Y_THRESHOLD,
    isAndroidDebug: androidDebugScore >= ANDROID_DEBUG_THRESHOLD && androidScore >= 1,
    isMotion: motionScore >= MOTION_THRESHOLD && (iosScore >= 1 || androidScore >= 1 || rnScore >= 1),
  };
}

export function buildRoutingContext(scores: RoutingScores): string | null {
  const parts: string[] = [];

  if (scores.isDualPlatform || scores.isPlatformSpecific) {
    let ctx = `[Mobile Platform Context]\nPlatform scores: iOS=${scores.iosScore} Android=${scores.androidScore} RN=${scores.rnScore}`;
    if (scores.isDualPlatform) {
      ctx += "\nDUAL-PLATFORM: Use mobile-split skill. Delegate iOS work to ios-engineer persona and Android work to android-engineer persona in parallel.";
    }
    if (scores.isIosPrimary) {
      ctx += "\nPRIMARY PLATFORM: iOS — use ios-engineer persona for implementation tasks.";
    }
    if (scores.isAndroidPrimary) {
      ctx += "\nPRIMARY PLATFORM: Android — use android-engineer persona for implementation tasks.";
    }
    parts.push(ctx);
  }

  if (scores.needsMobileLoop) {
    parts.push(
      "[Visual Verification Required]\nThis task involves mobile UI. After implementing changes, use the mobile_loop tool to build, launch on simulator, take a screenshot, and visually verify the result.",
    );
  }

  if (scores.isCrash) {
    parts.push(
      "[Crash Analysis Mode]\nCrash signals detected. Use crash-triage skill to:\n1. Parse and symbolicate the stack trace\n2. Identify the crashing frame in project code\n3. Synthesize root cause\n4. Delegate targeted fix",
    );
  }

  if (scores.isDeploy) {
    parts.push("[Deployment Mode]\nDeploy signals detected. Use mobile-deploy skill after tests pass.");
  }

  if (scores.isScaffold) {
    parts.push(
      "[Feature Scaffold Mode]\nUse the feature-scaffold skill to auto-detect architecture, discover naming conventions, and generate the full architecture stack with compilable stubs.",
    );
  }

  if (scores.isPerf) {
    parts.push(
      "[Performance Audit Mode]\nUse the performance-audit skill to run static checks across 6 dimensions (launch, scroll, memory, assets, unused, main thread).",
    );
  }

  if (scores.isSigning) {
    parts.push(
      "[Code Signing Issue]\nUse the code-signing-doctor skill to check certificates, provisioning profiles, entitlements, and build settings.",
    );
  }

  if (scores.isA11y) {
    parts.push(
      "[Accessibility Audit Mode]\nUse the accessibility-audit skill to audit across 6 dimensions (screen reader, font scaling, contrast, touch targets, semantic grouping, focus).",
    );
  }

  if (scores.isAndroidDebug) {
    parts.push(
      "[Android Debug Mode]\nAndroid debugging signals detected. Use android-debugger persona for Logcat analysis, ANR diagnosis, StrictMode violations, LeakCanary heap dumps, and Compose recomposition debugging.",
    );
  }

  if (scores.isMotion) {
    parts.push(
      "[Motion Design Mode]\nAnimation/motion signals detected. Use the motion-design skill to:\n" +
      "1. Derive the app's Motion DNA (tempo, spring feel, celebration style) from the project\n" +
      "2. Design motion specs for screen transitions and micro-interactions\n" +
      "3. Generate AppAnimation.swift (iOS) and/or AppMotion.kt (Android) with springs, haptics, and entrance modifiers\n" +
      "4. Delegate implementation to ios-engineer or android-engineer",
    );
  }

  return parts.length > 0 ? parts.join("\n\n") : null;
}
