# Body Map — Emotion & Sensation Tracker

## 1. Purpose

A personal, private app for managing anxiety and depression. The user taps a part of an illustrated human body and records **what they feel** (emotion), **how it feels physically** (sensation), and **how strong it is**. Over time the app shows where feelings tend to show up in the body and how they change.

The app is a self-awareness aid. It does not diagnose or treat, and it must never feel clinical, judgmental, or like a chore.

## 2. Core principles

- **Private by default.** All data stays on the device. There are no accounts, no analytics, and no network calls for user data.
- **Low friction.** A full check-in takes under 30 seconds and 3 taps minimum.
- **Gentle tone.** No streaks, no guilt, no "you missed a day". Neutral, warm copy.
- **Works on a phone.** Mobile-first, installable as a PWA, works offline.
- **Accessible.** Colour is never the only signal (always pair it with an emoji or label), tap targets are at least 44px, and every body region has a list fallback.

## 3. Tech stack

- **React + TypeScript + Vite**
- **Tailwind CSS** for styling
- **Inline SVG** for the body, with each region as its own `<path>` carrying an `id`
- **IndexedDB** (via `idb` or `Dexie`) for storage, which also stores custom images as blobs
- **vite-plugin-pwa** for install and offline support
- No backend

## 4. The body map

### Views
- **Front** and **Back** views, with a toggle between them.
- The figure is gender-neutral and simple, drawn as a soft outline rather than anatomical detail.

### Regions (each is a separate clickable SVG path)

| Front | Back |
|---|---|
| Head (top) | Back of head |
| Forehead / eyes | Neck (back) |
| Jaw / mouth | Upper back / shoulder blades |
| Throat | Mid back |
| Chest (left, right) | Lower back |
| Heart area | Buttocks / hips |
| Stomach (upper) | Back of thighs |
| Gut / lower abdomen | Calves |
| Shoulders (L, R) | |
| Upper arms (L, R) | |
| Forearms (L, R) | |
| Hands (L, R) | |
| Hips / pelvis | |
| Thighs (L, R) | |
| Knees (L, R) | |
| Lower legs (L, R) | |
| Feet (L, R) | |

Add one extra option, **"Whole body / everywhere"**, as a button outside the figure.

### Interaction
- Hovering or focusing a region highlights it with a soft glow.
- Tapping a region opens the **Check-in sheet** (section 5).
- A region can be tapped several times in one session to add several entries.
- Once an entry exists, the region fills with that emotion's colour and shows its emoji as a small badge.
- The figure supports keyboard navigation: Tab moves through the regions and Enter selects one.
- A "List view" toggle shows all regions as plain buttons, for accessibility and precision.

## 5. Check-in sheet

This is a bottom sheet on mobile and a side panel on desktop. It contains:

1. **Region name**, for example "Chest (left)".
2. **Emotion picker.** Emoji tiles grouped as below. Multi-select is allowed.
3. **Sensation picker** (optional chips): Tight, Heavy, Buzzing, Fluttery, Hot, Cold, Numb, Aching, Pressure, Restless, Hollow, Racing.
4. **Intensity slider** from 1 to 10. It defaults to 5 and is labelled "Barely there" at one end and "Overwhelming" at the other.
5. **Note** (optional): free text, e.g. "after the call with…".
6. **Save**, which closes the sheet and updates the body.

### Default emotion set

Each emotion has an emoji, a colour, and a label. The user can edit, add, or delete emotions.

| Group | Emotions |
|---|---|
| Anxious | Anxious 😰, Worried 😟, Panicky 😱, Overwhelmed 🌊, On edge ⚡ |
| Low | Sad 😢, Empty 🕳️, Numb 😶, Heavy 🪨, Lonely 🥀, Hopeless 🌧️ |
| Hurt / angry | Angry 😠, Frustrated 😤, Irritable 🌶️, Ashamed 😳, Guilty 😔 |
| Tired | Exhausted 😩, Drained 🔋, Flat 😐 |
| Okay / good | Calm 😌, Safe 🏠, Content 🙂, Hopeful 🌱, Grateful 🙏, Joyful 😄 |
| Unsure | "Don't know / can't name it" ❓ |

The "Don't know" option is important because not being able to name a feeling is valid data.

### Custom pictures
- In Settings, the user can create an emotion from an uploaded image (camera or gallery) instead of an emoji.
- The image is resized client-side to about 256px and stored in IndexedDB.

## 6. Sessions (check-ins)

- A **session** is one sitting that contains one or more region entries.
- The session starts when the first entry is saved.
- **"Finish check-in"** closes the session and shows a summary card: a mini body map, the list of entries, and an optional overall-mood slider plus a reflection prompt ("What might have brought this on?" / "What might help right now?").
- After finishing, show one gentle, optional grounding suggestion based on the most intense entry, for example a 4-7-8 breathing animation or the 5-4-3-2-1 senses exercise. It can be dismissed with a single tap.

## 7. History & insights

- **Timeline:** sessions listed by date. Tapping one reopens its body map as read-only.
- **Heatmap body:** a body map coloured by how often each region was logged over a chosen range (7 days, 30 days, or all time). Tapping a region shows its most common emotions and sensations.
- **Filters:** by emotion, by region, and by date range.
- **Simple trends:** average intensity over time, and the top 3 emotions for the period.
- Everything is computed locally.

## 8. Data model

```ts
type Emotion = {
  id: string;
  label: string;
  group: string;
  emoji?: string;        // either emoji or imageId
  imageId?: string;      // ref to Blob in images store
  color: string;         // hex
  isDefault: boolean;
  archived: boolean;
};

type RegionId = string;  // e.g. "front.chest.left", "back.lower-back"

type Entry = {
  id: string;
  sessionId: string;
  regionId: RegionId;
  emotionIds: string[];
  sensations: string[];
  intensity: number;     // 1–10
  note?: string;
  createdAt: string;     // ISO
};

type Session = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  overallMood?: number;  // 1–10
  reflection?: string;
};

type ImageRecord = { id: string; blob: Blob; createdAt: string };
```

## 9. Settings

- Manage emotions: add, edit, reorder, archive, and set a custom image.
- Theme: light, dark, or system. Use a calm palette with muted tones and no harsh reds for the UI chrome.
- **Export** all data as JSON and entries as CSV, so they can be shared with a therapist.
- **Import** a JSON backup.
- **Delete all data**, protected by a confirmation step.
- Optional **app lock** with a 4–6 digit PIN, stored hashed locally.
- A **support contact** field for a user-defined person or number that is shown in the Help screen. The Help screen also lists SADAG's 24-hour helpline by default, 0800 567 567 (South Africa); verify this number before shipping.

## 10. Screens

1. **Home / Body map.** Contains the figure, the front/back toggle, the "Whole body" button, and the "Finish check-in" button.
2. **Check-in sheet** (overlay).
3. **Session summary**, including the grounding suggestion.
4. **History**, with Timeline and Heatmap tabs.
5. **Settings.**
6. **Help & support.**

## 11. Visual direction

- Soft, rounded, calming, and uncluttered.
- The body is drawn as a single-colour outline with gently filled regions.
- Fills are semi-transparent. When a region has several emotions, show a split fill or the strongest emotion's colour plus a count badge.
- Use subtle motion only. Respect `prefers-reduced-motion`.

## 12. Build order

Build and verify one phase at a time. Stop after each phase for review.

1. **Scaffold.** Set up Vite, React, TypeScript, and Tailwind with an empty layout and PWA config.
2. **Body SVG.** Build the front and back figure with every region clickable, logging `regionId` to the console, plus the list-view fallback.
3. **Check-in sheet.** Add the emotion picker, sensations, intensity, and note. Entries are held in memory only.
4. **Persistence.** Store sessions and entries in IndexedDB, and colour regions from saved entries.
5. **Session finish.** Add the summary card, reflection, and grounding suggestion.
6. **History.** Add the timeline and read-only session view.
7. **Heatmap and insights.**
8. **Settings.** Add emotion management, custom images, export/import, and delete-all.
9. **Polish.** Add the PIN lock, dark mode, the accessibility pass, and offline/PWA install testing.

## 13. Acceptance criteria

- A check-in can be logged in 3 taps or fewer (region → emotion → save).
- All data survives a page reload and works offline.
- No network requests are made containing user data, which can be checked in the DevTools Network tab.
- Every region is reachable by keyboard and by list view.
- The app works at 360px width and on desktop.
- An export round-trips: exporting to JSON, deleting all data, and importing the file restores everything.
- A custom image emotion can be created and used on a region.

## 14. Out of scope (for now)

- Accounts, cloud sync, sharing links
- AI analysis of entries
- Notifications and reminders (could be added later as opt-in only)
