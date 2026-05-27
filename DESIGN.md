# AwesomeIBE - Design Content & Copy Guide

This document contains all text content, copy, and UI labels for the Identity-Based Encryption application. Use this as a reference for designing pages and components.

---

## Application Overview

**App Name:** AwesomeIBE
**Tagline:** Identity-Based Encryption
**Meta Description:** Encrypt data for anyone using just their email. Decryption keys distributed across multiple servers.

---

## Page Structure

### 1. Landing Page (Unauthenticated Users)

#### Hero Section

**Headline:**
> Identity-Based Encryption

**Subheadline/Description:**
> Encrypt data for anyone using just their email address. No need to exchange public keys. Decryption keys are distributed across multiple servers.

**CTA:** Sign in with email (magic link flow)

---

#### Feature Cards (3 cards in a row)

**Card 1 - No Key Exchange**
- Icon: Checkmark
- Title: No Key Exchange
- Description: Encrypt for anyone using their email. No need to get their public key first.

**Card 2 - Threshold Security**
- Icon: Shield
- Title: Threshold Security
- Description: Keys split across 3 servers. Need 2 to decrypt. No single point of failure.

**Card 3 - Privacy First**
- Icon: Eye
- Title: Privacy First
- Description: Encryption happens locally. Servers never see your plaintext data.

---

### 2. Main Dashboard (Authenticated Users)

#### Header

**Logo Text:** AwesomeIBE
**Logo Subtitle:** Identity-Based Encryption
**User Display:** Shows user email
**Sign Out Button:** Sign Out

---

#### User Identity Banner

**Label:** Your identity:
**Identity Format:** `user:{email}`
**Helper Text:** Others can encrypt data for you using this identity. You can decrypt anything encrypted for this identity.

---

#### System Configuration Panel

**Section Title:** System Configuration

**Config Source Badges:**
- "Live from servers" (green badge - when fetched from live servers)
- "From environment" (yellow badge - when using environment variables)

**Fields:**

| Label | Display Format |
|-------|---------------|
| Threshold | `{threshold} of {total_servers}` (e.g., "2 of 3") |
| Master Public Key | Hex string with expand/collapse + Copy button |
| Key Servers | List of server URLs with status indicators |

**Server Status Indicators:**
- Green dot: Online
- Red dot: Offline
- Pulsing gray dot: Checking...

**Buttons:**
- Copy (for master public key)

---

#### Encrypt Form (Left Column)

**Section Title:** Encrypt Data
**Badge:** Server-side
**Description:** Encrypt data for a specific user using Identity-Based Encryption. The message will be encrypted by the key server.

**Form Fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Recipient | Recipient Email | recipient@example.com |
| Message | Message to Encrypt | Enter your secret message... |

**Buttons:**
- Primary: Encrypt
- Loading state: Encrypting...

**Output Section:**
- Label: Encrypted Output
- Buttons: Copy, Download
- Download filename format: `encrypted-for-{recipient}.sealed.json`

---

#### Decrypt Form (Right Column)

**Section Title:** Decrypt Data
**Description:** Decrypt data that was encrypted for your identity ({user_email}).

**Form Fields:**

| Field | Label | Placeholder |
|-------|-------|-------------|
| Sealed Data | Sealed Data (JSON) | `{"version":1,"key_id":"user:...","threshold":2,...}` |

**File Upload:**
- Button text: Upload .sealed.json
- Accepts: .json files

**Buttons:**
- Primary: Decrypt
- Loading state: Decrypting...

**Output Section:**
- Label: Decrypted Message
- Display: Green highlighted box with decrypted text

---

#### How It Works Section

**Section Title:** How it works

**Step 1:**
- Number badge: 1
- Title: Encrypt Locally
- Description: Encryption happens in your browser using the recipient's email as their identity. No server sees your plaintext.

**Step 2:**
- Number badge: 2
- Title: Distributed Keys
- Description: Decryption keys are split across 3 servers. At least 2 must cooperate to decrypt (threshold = 2).

**Step 3:**
- Number badge: 3
- Title: Identity Verified
- Description: Servers verify your identity (via GitHub or email) before releasing key shares. Only you can decrypt your messages.

---

### 3. Authentication Flow

#### Sign In Component

**Input Placeholder:** Enter your email
**Submit Button:** Send Magic Link
**Loading State:** Sending...

**Success Message:**
> Check your email for the magic link!

---

## Status Messages & Notifications

### Loading States

| Context | Message |
|---------|---------|
| Sending magic link | Sending... |
| Encrypting data | Encrypting... |
| Decrypting data | Decrypting... |
| Parsing input | Parsing sealed data... |
| Fetching keys | Fetching key shares from servers... |

### Success States

| Context | Message |
|---------|---------|
| Magic link sent | Check your email for the magic link! |
| Encryption complete | (Shows encrypted output JSON) |
| Decryption complete | (Shows decrypted message in green box) |

---

## Error Messages

| Error Type | Message |
|------------|---------|
| Invalid JSON | Invalid JSON format. Please paste valid sealed data. |
| Wrong recipient | This message was encrypted for {key_id}, but you are {user_key_id} |
| Config load failure | Failed to load system configuration: {error} |
| General encryption error | Encryption failed |
| General decryption error | Decryption failed |
| Network/unknown error | Unknown error |

---

## Buttons Reference

| Button | Context | Variant |
|--------|---------|---------|
| Send Magic Link | Auth form | Primary (blue) |
| Sign Out | Header | Secondary (gray border) |
| Encrypt | Encrypt form | Primary (blue) |
| Decrypt | Decrypt form | Primary (green) |
| Copy | Multiple locations | Text link / Small gray |
| Download | Encrypt output | Small gray |
| Upload .sealed.json | Decrypt form | Small gray with icon |

---

## Color Semantics

| Color | Usage |
|-------|-------|
| Blue | Primary actions, encryption, information banners |
| Green | Success states, decryption, online status |
| Red | Errors, offline status |
| Purple | System configuration, branding accent |
| Yellow | Warning, environment config source |
| Gray | Secondary actions, neutral states |

---

## Typography Hierarchy

| Element | Usage |
|---------|-------|
| H1 | App name in header (AwesomeIBE) |
| H2 | Page headlines (Identity-Based Encryption) |
| H3 | Section titles (How it works, System Configuration) |
| H4 | Feature card titles, step titles |
| Body | Descriptions, helper text |
| Code/Mono | Email identities, keys, JSON data, server URLs |
| Small/Caption | Badges, status text, helper descriptions |

---

## Key UI Patterns

### Identity Display
Format: `user:{email}`
Example: `user:alice@example.com`

### Threshold Display
Format: `{threshold} of {total}`
Example: `2 of 3`

### Sealed Data JSON Structure
```json
{
  "version": 1,
  "key_id": "user:recipient@example.com",
  "threshold": 2,
  ...
}
```

### Server URL Display
Format: `http://{host}:{port}`
Example: `http://3.213.0.115:3021`

---

## Responsive Considerations

| Breakpoint | Layout |
|------------|--------|
| Desktop | 2-column grid for Encrypt/Decrypt forms, 3-column for features |
| Tablet | 2-column for features, stacked forms |
| Mobile | Single column throughout |

---

## Icons Used

| Icon | Context |
|------|---------|
| Lock (padlock) | App logo, branding |
| Checkmark | Success, "No Key Exchange" feature |
| Shield | Security, "Threshold Security" feature |
| Eye | Privacy, "Privacy First" feature |
| Upload arrow | File upload |
| Spinner | Loading states |

---

## Content Tone Guidelines

- **Clear and concise:** Technical concepts explained simply
- **Reassuring:** Emphasize security and privacy
- **Action-oriented:** Clear CTAs and next steps
- **Technical but accessible:** Use code formatting for identities and keys, plain language for descriptions

---
