// gemini_driver.js

// Check if we are running in the Side Panel (iframe)
// window.name comes from the <iframe> tag in sidepanel.html
const debugName = window.name;
const debugIframe = window.top !== window.self;

// Strict check: Only the actual iframe we created in sidepanel.html should be the driver.
// Nested iframes (ads, login, gtm) won't have this name.
const IS_SIDE_PANEL = debugName === 'gemini_side_panel';

if (IS_SIDE_PANEL) {
    console.log(`[Gemini Bridge] Operating in SIDE PANEL mode. (name="${debugName}")`);
} else {
    // If we are in an iframe but NOT ours, log it as ignored utility frame
    if (debugIframe) {
         console.log(`[Gemini Bridge] Ignored nested iframe. (name="${debugName}")`);
    } else {
         console.log(`[Gemini Bridge] Operating in MAIN TAB mode. Ignored.`);
    }
}

// --- Selectors & Helpers ---

const SELECTORS = {
    // Priority 1: Modern Rich Text Editor (standard)
    richTextEditor: 'div[contenteditable="true"]',
    // Priority 2: Accessibility Role
    roleTextbox: 'div[role="textbox"]',
    // Priority 3: Gemini specific (sometimes it's a paragraph inside a wrapper)
    geminiInput: 'rich-textarea p',
    
    // Buttons
    sendButton: 'button[aria-label="Send message"], button[aria-label="Submit"], button[data-test-id="send-button"]'
};

function humanDelay(min = 300, max = 600) {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

function findInput() {
    // Try standard editable divs
    let el = document.querySelector(SELECTORS.richTextEditor);
    if (el) return el;
    
    el = document.querySelector(SELECTORS.roleTextbox);
    if (el) return el;

    // Try Gemini specific custom element structure
    el = document.querySelector(SELECTORS.geminiInput);
    if (el) return el;

    return null;
}

function findSendButton() {
    // Use the combined selector string which handles multiple attributes
    return document.querySelector(SELECTORS.sendButton);
}

// --- Injection Logic ---

async function injectPrompt(text) {
    try {
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
        document.execCommand('insertText', false, text);

        await humanDelay(300, 600);

        // 3. Send Logic (Robust)
        // Re-query button repeatedly until it's ready
        let sendBtn = findSendButton();
        let waitAttempts = 0;
        const maxWaitAttempts = 10; // 5 seconds max

        while (waitAttempts < maxWaitAttempts) {
            // Check if button exists and is enabled
            const isDisabled = !sendBtn || sendBtn.disabled || sendBtn.getAttribute('aria-disabled') === 'true';

            if (!isDisabled) {
                break; // Ready to click!
            }

            console.log(`[Gemini Bridge] Waiting for Send button... (${waitAttempts + 1}/${maxWaitAttempts})`);
            await new Promise(r => setTimeout(r, 500));
            
            // IMPORTANT: Re-query the DOM element because React might have re-rendered it
            sendBtn = findSendButton(); 
            waitAttempts++;
        }

        if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
            sendBtn.click();
            console.log("[Gemini Bridge] Prompt sent successfully.");
        } else {
            console.error("[Gemini Bridge] Failed to send: Button not found or permanently disabled.");
        }
    } catch (err) {
        console.error("[Gemini Bridge] Critical error during injection:", err);
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
