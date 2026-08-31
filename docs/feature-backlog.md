# Feature backlog — what we borrow from other social suites

Triple Jeopardy's wedge is the **approval workflow** (see the scope doc). But to
be a real social suite it also has to cover the table-stakes features that Buffer,
Hootsuite, Later, Sprout Social, Planable, Agorapulse, SocialPilot and MeetEdgar
all have. This is that checklist, grouped by area, with the source apps and where
it lands for us.

Status: **✅ done · 🔜 next · P1–P4 planned phase · 💤 maybe later**

---

## 1. Compose & schedule — *Buffer, everyone*

| Feature | Source | Status |
|---|---|---|
| Multi-network composer, one draft | Buffer, Hootsuite | ✅ (Bluesky) / P1 (Meta) |
| Per-network text & media overrides | Buffer, Hootsuite | P1 |
| Character counters per network | Buffer | ✅ |
| Schedule for a specific time | Buffer | ✅ |
| Add to a posting-time queue ("next slot") | Buffer | P2 |
| Recurring / repeat posts | SocialPilot, Sprout | P2 |
| Draft → schedule → publish states | Buffer | ✅ |
| Publish now | Buffer | ✅ |
| Timezone-aware scheduling | Hootsuite | ✅ (campaign tz) |
| Best-time-to-post suggestions | Buffer, Sprout | P2 |
| Thread / carousel composer | Typefully, Buffer | P2 |
| First-comment scheduling | Later, Buffer | P2 |
| Link shortening + UTM builder | Buffer (bit.ly) | P2 |
| Post previews in true network chrome | Later, Planable | P1 (also the review room) |
| Saved caption / hashtag snippets | Later, Planoly | P2 |
| Hashtag groups / suggestions | Later, Planoly | P2 |
| Emoji & mention pickers | all | P2 |

## 2. Calendar & planning — *Later, Planoly, Hootsuite*

| Feature | Source | Status |
|---|---|---|
| Month calendar of scheduled posts | Hootsuite, Later | ✅ |
| Click a day to compose for it | Later | ✅ |
| Reschedule from the calendar (drag) | Later, Planoly | 🔜 (reschedule modal ✅, drag P2) |
| Week / list views | Hootsuite | P2 |
| Visual grid preview (IG feed mockup) | Later, Planoly | P2 |
| Filter calendar by campaign / network / status | Hootsuite | P2 |
| Campaign date anchors (election day, filing deadlines, debates) | *ours* | P2 |
| Content gaps / cadence warnings | *ours* | P3 |
| Color-coding by campaign or pillar | Planable | P2 |
| Google Calendar connection — push scheduled posts to a Google Calendar (or an iCal subscription feed) so the whole team sees them alongside everything else | Buffer (iCal), *ours* | P2 |

## 3. Collaboration & approvals — *Planable, Sprout, Hootsuite*

| Feature | Source | Status |
|---|---|---|
| **Contract approval modes (candidate / designee / waived)** | *ours* | 🔜 P1 |
| **Approval gate before scheduling** | Planable, Sprout | 🔜 P1 |
| **Magic-link review room (no login)** | Planable | P1 |
| Approve / request changes with a reason | Planable | P1 |
| Inline comments on the caption / on the image | Planable | P2 |
| Suggested edits (accept/reject) | Planable | P2 |
| Revision-round tracking | Planable | P1 |
| Multi-stage / role-based routing | Sprout, Hootsuite | P3 |
| Approval deadlines + auto-nudge | *ours* | P2 |
| Internal notes / activity feed per post | Planable, Sprout | P2 |
| **Immutable approval archive (who approved what, when)** | *ours* | P1 |
| Roles & granular permissions | Hootsuite, Sprout | P3 |
| Multiple workspaces | Hootsuite (Teams) | ✅ |
| Team members in a workspace | Hootsuite | P3 |
| Content library / shared assets | Sprout, Hootsuite | P2 |
| Client / stakeholder view (read-only calendar) | Planable, Sprout | P2 |

## 4. Analytics & reporting — *Sprout, Hootsuite, Later*

| Feature | Source | Status |
|---|---|---|
| Per-post metrics (reach, likes, comments, shares) | all | P1 (basic pull) |
| Nightly metric snapshots → time series | Sprout | P1 |
| Plain-language campaign recap | *ours* | P2 |
| Goal / pacing scorecard | Sprout | P2 |
| Top & bottom posts | Buffer, Later | P2 |
| Network breakdown | Hootsuite | P2 |
| Link-click & conversion tracking (via our shortener) | Buffer, Bitly | P2 |
| Donation / signup / RSVP attribution | *ours* | P2 |
| Message-pillar performance | *ours* | P2 |
| Audience growth over a campaign window | Later | P3 |
| Scheduled report emails | Sprout, Hootsuite | P2 |
| Shareable live report link | Sprout | P2 |
| PDF / CSV export | Hootsuite, Sprout | P2 |
| Competitor benchmarking | Sprout, Rival IQ | P4 |
| Custom dashboards | Sprout, Hootsuite | P4 |

## 5. Engagement / unified inbox — *Agorapulse, Sprout, Hootsuite*

| Feature | Source | Status |
|---|---|---|
| Unified inbox: comments, mentions, DMs | Agorapulse, Sprout | P4 |
| Assign / resolve / status | Agorapulse | P4 |
| Canned replies / saved responses | Sprout | P4 |
| Sentiment tagging | Sprout | P4 |
| Hide / delete / report (moderation) | Agorapulse | P4 |
| Threat & harassment triage (candidate safety) | *ours* | P4 |
| SLA / response-time tracking | Sprout | P4 |

## 6. Listening & monitoring — *Brandwatch, Sprout, Hootsuite*

| Feature | Source | Status |
|---|---|---|
| Keyword / hashtag streams | Hootsuite Streams | P4 |
| Brand & candidate mention monitoring | Sprout | P4 |
| Opponent / competitor tracking | Sprout | P4 |
| Narrative / trend alerts | Brandwatch | P4 |

## 7. Content sourcing & automation — *MeetEdgar, SmarterQueue, Buffer*

| Feature | Source | Status |
|---|---|---|
| RSS feed → draft posts | Buffer, Hootsuite | P2 |
| Evergreen recycling / content categories | MeetEdgar, SmarterQueue | P2 |
| Bulk upload via CSV | Hootsuite, SocialPilot | P2 |
| Draft-from-a-link (paste article/opponent post → AI drafts) | *ours* | P2 |
| Content idea inbox (client drops photos / ideas) | *ours* | P2 |
| Content request board (kanban) | *ours* | P2 |
| Kill switch — pause all scheduled posts | *ours* | P2 |

## 8. AI — *Buffer AI Assistant, Hootsuite OwlyWriter, Later*

| Feature | Source | Status |
|---|---|---|
| Caption generation / rewrite | Buffer, Hootsuite | P2 |
| Tone adjustment | Buffer | P2 |
| Hashtag suggestions | Later | P2 |
| Repurpose one post across networks | Buffer | P2 |
| Rapid-response draft options (statement / rebuttal / contrast) | *ours* | P2 |
| "Feedback translator" — vague note → concrete edits | *ours* | P2 |

## 9. Compliance & campaign-native — *ours (no competitor has this)*

| Feature | Status |
|---|---|
| Disclaimer engine ("Paid for by …") per committee / jurisdiction | P1 |
| Publish blocked without required disclaimer | P1 |
| Boost / paid-spend log for FEC & state reports | P2 |
| Account-type firewall (official / personal / surrogate) | P3 |
| Source-required posts (citation before approval) | P2 |
| Takedown log | P2 |
| Message-discipline guardrails (banned words, contrast framing) | P2 |
| Fundraising post type + goal thermometer + ActBlue/WinRed attribution | P2 |
| GOTV phase templates (persuasion → mobilization → turnout) | P3 |

## 10. Media tools — *Later, Canva*

| Feature | Source | Status |
|---|---|---|
| Client-side media validation per network | *ours* | ✅ |
| Media library | Sprout, Later | P2 |
| Basic image crop / aspect presets | Buffer, Later | P2 |
| Video support (validate + passthrough) | Later | P2 |
| Manual Canva export → upload (Download PNG in Canva, then attach) | — | ✅ works today |
| Canva Connect API — browse your Canva designs/folders in-app and import one into a post (needs a Canva dev account + API-access approval + OAuth) | Later, Buffer | P2 |
| "Share to Triple Jeopardy" button inside Canva (build + publish a Canva marketplace app, Canva review) | Buffer, Later | P3 |
| Alt-text fields | Later, Buffer | P2 (Bluesky ✅) |

## 11. Platform & delivery

| Feature | Source | Status |
|---|---|---|
| Web app | all | ✅ |
| Autonomous scheduled publishing (cron) | all | ✅ |
| Encrypted credential storage + token refresh | all | ✅ / P1 (Meta refresh) |
| Network adapter pattern (add networks without rewrites) | *ours* | ✅ |
| Mobile PWA / "share to" | Buffer, Later | P3 |
| Browser extension | Buffer, Hootsuite | 💤 |
| White-label review rooms & reports | Sprout, Planable | P3 |
| Zapier / webhook integrations | Buffer, Hootsuite | P3 |

---

### Networks we'll support

Facebook · Instagram · Threads · Bluesky (✅) · TikTok · YouTube.
Not doing X/Twitter (paid API). LinkedIn — 💤 later if a client needs it.
