// background.js

const PROMPT_TEMPLATES_KEYS = {
  "verify-fact": "prompt_fact_check",
  "verify-critique": "prompt_devil_adv",
  "explain-eli5": "prompt_eli5",
  "explain-tldr": "prompt_tldr",
  "tone-passive-aggressive": "prompt_pass_aggro",
  "lang-refine": "prompt_refine"
};

// Cache for custom prompts to allow quick lookup on click
let CUSTOM_PROMPTS_CACHE = {};

// Function to rebuild the entire context menu
function updateContextMenu() {
  chrome.contextMenus.removeAll(() => {
    // Parent item
    chrome.contextMenus.create({
      id: "gemini-bridge-root",
      title: chrome.i18n.getMessage("extName"),
      contexts: ["selection"]
    });

    // --- Standard Groups ---

    // 1. Verify
    chrome.contextMenus.create({
      id: "group-verify",
      parentId: "gemini-bridge-root",
      title: chrome.i18n.getMessage("menu_verify"),
      contexts: ["selection"]
    });
    chrome.contextMenus.create({ id: "verify-fact", parentId: "group-verify", title: chrome.i18n.getMessage("menu_fact_check"), contexts: ["selection"] });
    chrome.contextMenus.create({ id: "verify-critique", parentId: "group-verify", title: chrome.i18n.getMessage("menu_devil_adv"), contexts: ["selection"] });

    // 2. Explain
    chrome.contextMenus.create({
      id: "group-explain",
      parentId: "gemini-bridge-root",
      title: chrome.i18n.getMessage("menu_explain"),
      contexts: ["selection"]
    });
    chrome.contextMenus.create({ id: "explain-eli5", parentId: "group-explain", title: chrome.i18n.getMessage("menu_eli5"), contexts: ["selection"] });
    chrome.contextMenus.create({ id: "explain-tldr", parentId: "group-explain", title: chrome.i18n.getMessage("menu_tldr"), contexts: ["selection"] });

    // 3. Tone
    chrome.contextMenus.create({
      id: "group-tone",
      parentId: "gemini-bridge-root",
      title: chrome.i18n.getMessage("menu_tone"),
      contexts: ["selection"]
    });
    chrome.contextMenus.create({ id: "tone-passive-aggressive", parentId: "group-tone", title: chrome.i18n.getMessage("menu_pass_aggro"), contexts: ["selection"] });

    // 4. Lang
    chrome.contextMenus.create({
      id: "group-lang",
      parentId: "gemini-bridge-root",
      title: chrome.i18n.getMessage("menu_lang"),
      contexts: ["selection"]
    });
    chrome.contextMenus.create({ id: "lang-refine", parentId: "group-lang", title: chrome.i18n.getMessage("menu_refine"), contexts: ["selection"] });

    // --- Custom Prompts Group ---
    chrome.storage.sync.get({ customPrompts: [] }, (items) => {
      CUSTOM_PROMPTS_CACHE = {}; // Reset cache

      if (items.customPrompts && items.customPrompts.length > 0) {
        // Separator
        chrome.contextMenus.create({
           id: "sep-custom",
           parentId: "gemini-bridge-root",
           type: "separator",
           contexts: ["selection"]
        });

        // Loop through user prompts
        items.customPrompts.forEach(p => {
            chrome.contextMenus.create({
                id: p.id,
                parentId: "gemini-bridge-root", // Add directly to root or make a "My Prompts" group? Root is faster access.
                title: "★ " + p.title,
                contexts: ["selection"]
            });
            CUSTOM_PROMPTS_CACHE[p.id] = p.prompt;
        });
      }
    });

  });
}

// Initialize context menu on installation or startup
chrome.runtime.onInstalled.addListener(updateContextMenu);
chrome.runtime.onStartup.addListener(updateContextMenu);

// Listen for changes in options to rebuild menu immediately
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.customPrompts) {
        updateContextMenu();
    }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.selectionText) {
    // 1. OPTIMISTIC OPEN: Open the side panel IMMEDIATELY.
    chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
      console.error("Side panel open error:", error);
    });

    let finalPrompt = null;

    // A. Check Standard Templates
    if (PROMPT_TEMPLATES_KEYS[info.menuItemId]) {
      const messageKey = PROMPT_TEMPLATES_KEYS[info.menuItemId];
      const pattern = chrome.i18n.getMessage(messageKey);
      if (pattern) {
        finalPrompt = `${pattern}\n\nText:\n\`\`\`text\n${info.selectionText}\n\`\`\``;
      }
    } 
    // B. Check Custom Prompts
    else if (CUSTOM_PROMPTS_CACHE[info.menuItemId]) {
       const userPattern = CUSTOM_PROMPTS_CACHE[info.menuItemId];
       finalPrompt = `${userPattern}\n\nText:\n\`\`\`text\n${info.selectionText}\n\`\`\``;
    }

    if (!finalPrompt) return; // Should not happen unless click on group parent

    // 2. DATA BRIDGE
    console.log("Saving to local storage:", finalPrompt.substring(0, 50) + "...");
    chrome.storage.local.set({
      pendingPrompt: {
        text: finalPrompt,
        timestamp: Date.now(),
        status: "pending"
      }
    });
  }
});

// Handle messages from FAB (Floating Action Button)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "open_side_panel" && request.text) {
    console.log("FAB Clicked. Text:", request.text.substring(0, 20));

    if (sender.tab) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch((err) => {
        console.error("Failed to open panel from FAB:", err);
      });
    }

    chrome.storage.local.set({
      pendingPrompt: {
        text: request.text,
        timestamp: Date.now(),
        status: "pending"
      }
    });
  }
});
