# Google Play — Data safety form answers (Mu 1.0.0)

**Does your app collect or share any of the required user data types?** Yes (collects; does **not** share with third parties).
**Is all user data encrypted in transit?** Yes (HTTPS/TLS everywhere).
**Do you provide a way for users to request that their data is deleted?** Yes — in app (Settings → Delete my Mu account) and https://mu.cryptdox.com/account-deletion.

| Data type (Play category) | Collected | Shared | Optional? | Purposes |
| --- | --- | --- | --- | --- |
| Personal info → Name | Yes | No | Required | App functionality, Account management |
| Personal info → Email address | Yes | No | Required | App functionality, Account management |
| Personal info → User IDs | Yes | No | Required | App functionality, Account management |
| Photos and videos → Photos | Yes | No | Optional | App functionality (posts, chat, profile photos) |
| Audio → Voice or sound recordings | No* | No | — | *Calls/lives are real-time only, never stored |
| Messages → Other in-app messages | Yes | No | Optional | App functionality |
| App activity → Other user-generated content | Yes | No | Optional | App functionality (posts, comments, reactions) |
| App activity → App interactions | Yes | No | Required | App functionality, Fraud prevention & security (reports, moderation) |
| App info & performance → Diagnostics | Yes | No | Required | App functionality (server logs) |
| Device or other IDs | Yes | No | Required | Account management, Security (3-device limit) |

Not collected: location, contacts, financial info, health, web browsing, calendar, files.
Ephemeral processing: camera/microphone media during calls and lives (not stored).

**Content rating questionnaire**: Social/communication app; users can interact and exchange content (Yes); user-generated content is moderated with in-app reporting and blocking (Yes); shares location (No); purchases (No).
**Target audience**: 13+ (not designed for children).
**Ads**: No ads.
**App access for review**: provide a test account (email + password) in Play Console → App content → App access, because Mu requires sign-in.
