# Gemini Chrome Bridge

**Gemini Chrome Bridge** is a Chrome Extension that seamlessly connects your browsing experience with Google Gemini. It allows you to send selected text or custom prompts directly from any webpage to a Gemini session running in the side panel.

## 🚀 Key Features

- **⚡ Context Menu Integration**: Right-click on any selected text to instantly verify facts, explain concepts (ELI5), analyze tone, or refine language using Gemini.
- **✨ Floating Action Button (FAB)**: A subtle sparkle button appears when you select text, allowing for quick ad-hoc queries without cluttering your interface.
- **📂 Side Panel Architecture**: Uses the modern Chrome Side Panel API to keep Gemini accessible alongside your content, preventing context switching.
- **🔒 Smart Context Handling**: Automatically directs prompts to the Side Panel session, ignoring other open Gemini tabs to prevent confusion.
- **No API Keys Required**: It acts as a bridge to the web interface of Gemini (`gemini.google.com`), effectively utilizing your existing logged-in session.

## 🛠️ Installation (Developer Mode)

Since this is a specialized tool, you install it as an "Unpacked Extension":

1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Toggle **Developer mode** in the top-right corner.
4.  Click **Load unpacked**.
5.  Select the directory where you cloned this repo.

## 📖 Usage

1.  **Select text** on any webpage.
2.  **Right-click** to see the "Gemini Bridge" menu with predefined templates (Verify, Explain, Tone, Language).
3.  **OR** click the **Sparkle Icon (✨)** that appears near your selection to type a custom command.
4.  The **Side Panel** will open automatically, and Gemini will generate your response.

---

**Disclaimer**: This is an unofficial tool and is not affiliated with Google. It relies on the DOM structure of the Gemini web application, which may change over time.
