# Architecture Overview

This extension uses a "Bridge" pattern to connect standard web pages with the Google Gemini web application (`gemini.google.com`) running in a Chrome Side Panel. This approach avoids using paid APIs by leveraging the user's existing browser session.

## Core Components

### 1. Side Panel (`sidepanel.html`)

- Hosts an `<iframe>` loading `https://gemini.google.com/app`.
- The iframe is named `gemini_side_panel` to allow unique identification.
- **Rules (`rules.json`)**: Uses `declarativeNetRequest` to strip `X-Frame-Options` headers from Google's response, allowing it to load within the side panel iframe.

### 2. Context Interaction (`fab_script.js`)

- Injected into every webpage (`<all_urls>`).
- Listens for text selection events.
- **Sparkle Button (FAB)**: Renders a Shadow DOM floating button near selected text.
- **Prompt Window**: A small popup allowing users to type custom commands or send just the selected context.

### 3. Background Service (`background.js`)

- Manages the **Context Menus** (Verify, Explain, Tone, etc.).
- Orchestrates the opening of the Side Panel via `chrome.sidePanel.open` (requires a user gesture).
- Initializes the prompting flow by setting a `pendingPrompt` in `chrome.storage.local`.

### 4. Gemini Driver (`gemini_driver.js`)

- Injected into `https://gemini.google.com/*`.
- **Mode Detection**: Checks if it's running inside the Side Panel (`window.name === 'gemini_side_panel'`) to avoid conflicting with other open Gemini tabs.
- **Prompt Injection**:
  1.  Polls `chrome.storage.local` for `pendingPrompt`.
  2.  Locates the rich text editor in the DOM.
  3.  Uses `document.execCommand('insertText')` (legacy but reliable) to insert the text.
  4.  Simulates a click on the "Send" button.

## Data Flow

1.  **User Trigger**: User selects text and clicks FAB or Context Menu item.
2.  **Storage**: The extension saves the prompt payload to `chrome.storage.local`.
3.  **Panel Open**: The extension forces the Side Panel to open.
4.  **Driver Execution**: The `gemini_driver.js` script _inside_ the panel detects the new storage entry.
5.  **Execution**: The driver injects the text into the chat interface and submits it.
6.  **Cleanup**: The storage entry is marked as `done` or removed to prevent loops.
