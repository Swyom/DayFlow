# Privacy Policy for DayFlow

**Last Updated:** October 17, 2026  
**Effective Date:** October 17, 2026  
**Application:** DayFlow (`com.swyomsanjog.dayflow`)  
**Developer:** Swyom Sanjog  
**Contact Email:** swyomsanjog2004@gmail.com  

---

## 1. Introduction

DayFlow ("we", "our", or "the app") is committed to protecting your privacy. This Privacy Policy clearly outlines what personal and device data we collect, why we collect it, how it is safeguarded, and how you can exercise full control or deletion of your data.

DayFlow is built with a **local-first, privacy-conscious architecture**: your habits, tasks, and digital wellbeing data belong to you.

---

## 2. What Data We Collect and Why We Collect It

We only collect data strictly necessary to provide and personalize DayFlow's core features.

### A. Personal Information (Stored in Cloud / Supabase)

| Data Collected | Why We Collect It (Purpose) | Where It Is Stored |
| :--- | :--- | :--- |
| **Full Name** | To personalize your greeting on the Home and Profile screens (*e.g., "Good morning, Alex"*). | Supabase (Cloud Database) |
| **Email Address** | Used as a unique account identifier for cloud backup, account management, and profile recovery. | Supabase (Cloud Database) |
| **Mobile Number** | Used for account verification and identity linking. | Supabase (Cloud Database) |
| **Age** | To ensure compliance with global digital age regulations (such as COPPA, requiring users to be 13 or older). | Supabase (Cloud Database) |
| **City / Location Label** | Displayed on your profile card. If you allow location access, your position is read once, on your phone, to look up the city name; the GPS coordinates are then discarded and never stored or uploaded. Only the city/region text is saved. | Supabase (Cloud Database) |
| **Profile Photo (Avatar)** | Optional photo chosen by you to display on your profile and home header. | Supabase Storage (Private Bucket) |

---

### B. Health & Fitness Data (Processed and Stored Locally ONLY)

| Data Collected | Why We Access It (Purpose) | Storage & Collection Status |
| :--- | :--- | :--- |
| **Daily Step Counts** | Collected via your device's built-in motion sensor / pedometer hardware (`ACTIVITY_RECOGNITION`) to track daily steps, distance, and calorie estimates. | ❌ **NOT UPLOADED TO DATABASE** (Stored strictly on-device in persistent local storage. Never synced or uploaded to Supabase or any remote server). |
| **Daily Step Goal** | Your personal target (e.g., 8,000 steps) to render the daily activity progress ring. | Stored strictly locally on-device. |

---

### C. Digital Wellbeing & Screen Time (Processed and Stored Locally ONLY)

| Data Accessed | Why We Access It | Storage & Collection Status |
| :--- | :--- | :--- |
| **App Usage & Screen Time** | Read via Android's `UsageStatsManager` after you grant explicit permission in Settings. Used to display the interactive Donut Chart, app-by-app usage, and total daily screen time. | ❌ **NOT UPLOADED TO DATABASE** (Stored strictly on-device in persistent local storage with up to 90-day retention. Never synced or uploaded to Supabase or any remote server). |

---

### D. Advertising Identifiers (Google AdMob)

| Data Accessed | Why We Use It | Third-Party Involved |
| :--- | :--- | :--- |
| **Advertising ID & Diagnostics** | Used by the Google Mobile Ads SDK to serve banner advertisements in the app. In regions requiring consent (EEA/UK), user consent is requested via Google's UMP consent form prior to serving ads. | [Google AdMob Privacy Policy](https://policies.google.com/technologies/ads) |

---

## 3. How Your Data Is Protected and Secured

We implement strict industry-standard security practices to protect your data:

1. **Encryption in Transit:** All communication between the DayFlow app and our Supabase backend is encrypted using **HTTPS / TLS 1.3**.
2. **Encryption at Rest:** All data stored in the database and photo storage is encrypted at rest using **AES-256**.
3. **Database Row Level Security (RLS):** Every database profile row and avatar file is strictly bound to your individual anonymous user ID (`auth.uid()`). No other user or device can read, query, modify, or delete your data.
4. **Local Data Isolation:** Activity data (step counts, screen time, habits, and tasks) resides in private device-local sandbox storage and is never exposed or uploaded remotely.
5. **No Sale of Data:** We **never** sell, rent, trade, or share your personal information with data brokers or commercial third parties.

---

## 4. User Rights and Data Deletion

You retain complete ownership and control over your data at all times:

### In-App Deletion:
Open DayFlow &rarr; **Settings** &rarr; **Delete profile & data**, type DELETE and choose one of:

**1. Restorable for 7 days (default)**
- Your profile photo is deleted from DayFlow's cloud immediately and can't be restored.
- Your profile details (name, email, mobile number, age, location, step goal and registration date) are moved to a restricted area of the database that no app, device or user can read, and are kept for **7 days** so you can change your mind.
- Your habits, tasks, step counts and screen-time history stay **only on the same phone** for those 7 days. They are never uploaded.
- To restore, choose **Restore a deleted profile** on the setup screen and enter the same email address and mobile number. Your details are checked on our server. For your security, only **5 failed attempts per 24 hours** are allowed per email address and per device, with a wider limit per network address. After that, restoring is blocked for 24 hours. Error messages never say whether an account exists.
- After 7 days, the retained profile is **permanently deleted** from the cloud by a daily clean-up, and the data kept on your phone is erased the next time DayFlow opens. It can't be restored after that.

**2. Delete permanently now**
- Your profile, photo, habits, tasks, step counts and screen-time history are erased from your phone and from DayFlow's cloud immediately. Nothing can be restored.

### Manual Deletion Requests:
You may also request complete data deletion by emailing us at **swyomsanjog2004@gmail.com**. We will process and verify your request within 48 hours.

---

## 5. Children's Privacy

DayFlow is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we discover that a user under 13 has submitted personal information, we promptly delete it from our systems.

---

## 6. Permissions Requested by DayFlow

| Permission | Category | Purpose |
| :--- | :--- | :--- |
| `ACTIVITY_RECOGNITION` | Normal / Runtime | Reads the hardware pedometer to count daily steps. |
| `PACKAGE_USAGE_STATS` | Special Access | Reads foreground app time to show the local Screen Time Donut Chart. Must be manually enabled by the user in device Settings. |
| `ACCESS_COARSE_LOCATION` | Runtime | Used once (only if the user taps "Use GPS") to detect their city name for the profile. |
| `READ_MEDIA_IMAGES` | Runtime | Allows selecting a photo from the gallery for the profile picture. |

---

## 7. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Any changes will be reflected in the updated policy document within the application repository and on the Google Play Store listing.

---

## 8. Contact Us

If you have any questions, feedback, or concerns regarding this Privacy Policy or your data, please contact:

* **Developer:** Swyom Sanjog  
* **Email:** swyomsanjog2004@gmail.com  
* **Repository:** [https://github.com/Swyom/DayFlow](https://github.com/Swyom/DayFlow)  
