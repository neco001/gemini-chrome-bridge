// gemini_driver.js

console.log("[Gemini Bridge] Driver loaded.");

// Check if we are running in the Side Panel (iframe)
const IS_SIDE_PANEL = window.name === 'gemini_side_panel' || window.top !== window.self;
if (IS_SIDE_PANEL) {
    console.log("[Gemini Bridge] Operating in Side Panel mode.");
} else {
    console.log("[Gemini Bridge] Operating in Main Tab mode (passive).");
}

// --- Selectors & Helpers ---

const SELECTORS = {
    // Priority 1: Modern Rich Text Editor
    richTextEditor: 'div[contenteditable="true"]',
    // Priority 2: Accessibility Role
    roleTextbox: 'div[role="textbox"]',
    // Priority 3: Send Button
    sendButton: 'button[aria-label="Send message"], button[aria-label="Submit"]'
};

function humanDelay(min = 300, max = 600) {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

function findInput() {
    return document.querySelector(SELECTORS.richTextEditor) ||
        document.querySelector(SELECTORS.roleTextbox);
}

function findSendButton() {
    // Try explicit aria-label selectors first
    let btn = document.querySelector('button[aria-label="Send message"]');
    if (btn) return btn;

    btn = document.querySelector('button[aria-label="Submit"]');
    if (btn) return btn;

    // Fallback: finding the send button relative to the input usually isn't reliable 
    // due to shadow DOMs or complex hierarchies in Google apps, 
    // so we stick to aria-labels which are fairly stable.
    return null;
}

// --- Injection Logic ---

async function injectPrompt(text) {
    console.log("[Gemini Bridge] Attempting to inject prompt...");

    // Retry logic for finding the input (it might take a moment to load)
    let input = findInput();
    let attempts = 0;
    while (!input && attempts < 10) {
        await new Promise(r => setTimeout(r, 500));
        input = findInput();
        attempts++;
    }

    if (!input) {
        console.error("[Gemini Bridge] Error: Could not find input field.");
        return;
    }

    // 1. Focus
    input.focus();
    await humanDelay(100, 200);

    // 2. Insert Text
    // This deprecated command is still the most reliable way to trigger 
    // all the necessary internal events for React/Angular apps.
    document.execCommand('insertText', false, text);

    await humanDelay(300, 600);

    // 3. Send
    const sendBtn = findSendButton();
    if (sendBtn) {
        // Ensure the button is clickable
        if (sendBtn.disabled || sendBtn.getAttribute('aria-disabled') === 'true') {
            console.warn("[Gemini Bridge] Send button is disabled. Waiting...");
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
            sendBtn.click();
            console.log("[Gemini Bridge] Prompt sent.");
        } else {
            console.error("[Gemini Bridge] Send button is still disabled.");
        }
    } else {
        console.warn("[Gemini Bridge] Send button not found. You might need to press Enter manually.");
    }
}

// --- Event Listeners ---

// 1. Check for pending prompts on load
chrome.storage.local.get(['pendingPrompt'], async (result) => {
    console.log("[Gemini Bridge] Checking storage...", result);
    if (result.pendingPrompt && result.pendingPrompt.status === 'pending') {
        if (!IS_SIDE_PANEL) {
            console.log("[Gemini Bridge] Pending prompt found, but this is a main tab. Leaving for Side Panel.");
            return;
        }
        const { text, timestamp } = result.pendingPrompt;

        // Expiry check (1 minute)
        if (Date.now() - timestamp < 60000) {
            console.log("[Gemini Bridge] Found pending prompt.");
            // Mark as processing immediately to prevent loops
            chrome.storage.local.set({
                pendingPrompt: { ...result.pendingPrompt, status: 'processing' }
            });

            await injectPrompt(text);

            // Clear storage after success
            chrome.storage.local.remove('pendingPrompt');
        } else {
            console.log("[Gemini Bridge] Prompt expired.");
        }
    }
});

// 2. Listen for new prompts while running
chrome.storage.onChanged.addListener((changes, area) => {
    // console.log("[Gemini Bridge] Storage changed:", area, changes);
    if (area === 'local' && changes.pendingPrompt) {
        const newValue = changes.pendingPrompt.newValue;
        if (newValue && newValue.status === 'pending') {
            if (!IS_SIDE_PANEL) {
                console.log("[Gemini Bridge] New prompt detected, but ignoring in main tab.");
                return;
            }
            console.log("[Gemini Bridge] New prompt received via listener.");
            injectPrompt(newValue.text);
            // Updating status to Done
            chrome.storage.local.set({
                pendingPrompt: { ...newValue, status: 'done' }
            });
        }
    }
});
