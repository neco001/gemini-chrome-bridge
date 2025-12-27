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

    // 0. Custom Input (New)
    chrome.contextMenus.create({
      id: "custom-prompt-trigger",
      parentId: "gemini-bridge-root",
      title: "✎ " + chrome.i18n.getMessage("menu_custom_prompt") || "Własna instrukcja...",
      contexts: ["selection"]
    });

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
  // Handler for Custom Prompt (Floating Window)
  // We DO NOT open the side panel yet. We wait for the user to type and click "Send".
  // The "Send" action in content script will trigger "open_side_panel" message, which opens the panel.
  if (info.menuItemId === "custom-prompt-trigger") {
      chrome.tabs.sendMessage(tab.id, { 
          action: "show_floating_input", 
          selectionText: info.selectionText 
      });
      return; 
  }

  // Handler for Standard Templates (TL;DR, Explain, etc.)
  if (info.selectionText) {
    // 1. Open the side panel IMMEDIATELY for these direct actions.
    chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
      console.error("Side panel open error:", error);
    });

    // Helper to process and save the final prompt
    const savePrompt = (selection, context) => {
        let finalPrompt = null;
        
        // Prepare context text
        let contentPart = "";
        if (context && context.trim() !== selection.trim()) {
            contentPart = `Context:\n\`\`\`text\n${context}\n\`\`\`\n\nTarget:\n\`\`\`text\n${selection}\n\`\`\``;
        } else {
             contentPart = `Text:\n\`\`\`text\n${selection}\n\`\`\``;
        }

        // A. Check Standard Templates
        if (PROMPT_TEMPLATES_KEYS[info.menuItemId]) {
          const messageKey = PROMPT_TEMPLATES_KEYS[info.menuItemId];
          const pattern = chrome.i18n.getMessage(messageKey);
          if (pattern) {
            finalPrompt = `${pattern}\n\n${contentPart}`;
          }
        } 
        // B. Check Custom Prompts (from Context Menu options, not floating window)
        else if (CUSTOM_PROMPTS_CACHE[info.menuItemId]) {
           const userPattern = CUSTOM_PROMPTS_CACHE[info.menuItemId];
           finalPrompt = `${userPattern}\n\n${contentPart}`;
        }

        if (!finalPrompt) return;

        // 2. DATA BRIDGE
        console.log("Saving to local storage:", finalPrompt.substring(0, 50) + "...");
        chrome.storage.local.set({
          pendingPrompt: {
            text: finalPrompt,
            timestamp: Date.now(),
            status: "pending"
          }
        });
    };

    // Attempt to get richer context from the content script
    chrome.tabs.sendMessage(tab.id, { action: "get_selection_context" }, (response) => {
        if (chrome.runtime.lastError || !response) {
            // Fallback to standard info.selectionText if script not ready/blocked
            console.warn("Context fetch failed, using fallback:", chrome.runtime.lastError);
            savePrompt(info.selectionText, null);
        } else {
            // Use rich context
            savePrompt(response.selection, response.context);
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
