# Phase 1 Findings

- Files inventoried: 1146
- TypeScript errors: 0 (exit 0)
- Backend imports: all successful (exit 0)
- Routers registered: 18 (auth, chat, memories, profile, study,
  code_lab, business, creator, dream, life_coach, image_lab,
  smart_home, task_manager, economy, ads, billing, referral,
  unified_chat)
- Duplicate chat paths: chat + unified_chat (must pick one)
- Ads SDK present: react-native-google-mobile-ads (must remove per decision #2)
- DB migrations: NONE in repo (critical gap)
- Sensitive perms deps: camera, face-detector, sensors, location,
  local-authentication, media-library, onesignal
- Deprecated: sentry-expo (keep @sentry/react-native only)
- Note: llmnext present (candidate for offline local model)
