// background.js

// background.js

const PROMPT_TEMPLATES = {
  "verify-fact": "Zweryfikuj prawdziwość poniższego tekstu. Wskaż potencjalne błędy, przekłamania lub brakujące konteksty. Bądź krytyczny. Tekst:\n\n%s",
  "verify-critique": "Przeanalizuj ten tekst i znajdź luki w argumentacji, błędy logiczne lub słabe punkty. Zaatakuj tezę postawioną w tekście (Adwokat Diabła). Tekst:\n\n%s",

  "explain-eli5": "Wyjaśnij zaznaczony fragment używając prostych analogii, jakbyś tłumaczył to inteligentnemu 12-latkowi. Pomiń żargon. Tekst:\n\n%s",
  "explain-tldr": "Stwórz zwięzłe podsumowanie w punktach (bullet points) zawierające tylko najważniejsze informacje z tego tekstu. Tekst:\n\n%s",

  "tone-passive-aggressive": "Przeanalizuj ton poniższej wypowiedzi. Skup się na wykryciu pasywnej agresji, ukrytych pretensji, sarkazmu lub fałszywej uprzejmości. Oceń czy intencja jest szczera czy manipulacyjna. Tekst:\n\n%s",

  "lang-refine": "Popraw błędy gramatyczne i stylistyczne w tym tekście. Spraw, by brzmiał bardziej profesjonalnie i klarownie, ale koniecznie zachowaj oryginalny sens. Tekst:\n\n%s"
};

// Initialize context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  // Parent item
  chrome.contextMenus.create({
    id: "gemini-bridge-root",
    title: "Gemini Bridge",
    contexts: ["selection"]
  });

  // 1. Weryfikacja
  chrome.contextMenus.create({
    id: "group-verify",
    parentId: "gemini-bridge-root",
    title: "🕵️ Weryfikacja",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({ id: "verify-fact", parentId: "group-verify", title: "🔍 Sprawdź Fakty", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "verify-critique", parentId: "group-verify", title: "😈 Adwokat Diabła", contexts: ["selection"] });

  // 2. Synteza
  chrome.contextMenus.create({
    id: "group-explain",
    parentId: "gemini-bridge-root",
    title: "🧠 Synteza",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({ id: "explain-eli5", parentId: "group-explain", title: "👶 Wyjaśnij jak dziecku (ELI5)", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "explain-tldr", parentId: "group-explain", title: "📋 Skróć (TL;DR)", contexts: ["selection"] });

  // 3. Analiza Tonu (Nowe!)
  chrome.contextMenus.create({
    id: "group-tone",
    parentId: "gemini-bridge-root",
    title: "🎭 Analiza Tonu",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({ id: "tone-passive-aggressive", parentId: "group-tone", title: "🌡️ Detektor Pasywnej Agresji", contexts: ["selection"] });

  // 4. Język
  chrome.contextMenus.create({
    id: "group-lang",
    parentId: "gemini-bridge-root",
    title: "🌍 Język",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({ id: "lang-refine", parentId: "group-lang", title: "✨ Wypoleruj tekst", contexts: ["selection"] });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.selectionText) {
    // 1. OPTIMISTIC OPEN: Open the side panel IMMEDIATELY.
    // This must happen synchronously to satisfy the "User Gesture" requirement.
    // We catch errors in case it's already open or blocked, but we don't await it.
    chrome.sidePanel.open({ tabId: tab.id }).catch((error) => {
      console.error("Side panel open error:", error);
    });

    let finalPrompt = info.selectionText;

    // Check if clicked item maps to a template
    if (PROMPT_TEMPLATES[info.menuItemId]) {
      finalPrompt = PROMPT_TEMPLATES[info.menuItemId].replace("%s", info.selectionText);
    } else {
      if (!info.menuItemId.startsWith('gemini-bridge')) return;
      if (!PROMPT_TEMPLATES[info.menuItemId]) return;
    }

    // 2. DATA BRIDGE: REVERTING TO LOCAL STORAGE
    // It appears content scripts (isolated world) might have issues accessing storage.session
    // reliably in all contexts or it requires specific permissions/trusted contexts.
    // For MV3 "Hacker Style" stability, we go back to the battle-tested local storage.
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

    // OPTIMISTIC OPEN from Message
    // Important: This might FAIL if not triggered by user gesture (click on FAB).
    // Since the message comes from a 'mousedown'/'click' event in content script,
    // Chrome *should* treat it as user gesture.
    if (sender.tab) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch((err) => {
        console.error("Failed to open panel from FAB:", err);
        // Fallback? Maybe notify user.
      });
    }

    // Save Data
    // FAB is generic "Ask", so we don't have templates. Just raw text.
    chrome.storage.local.set({
      pendingPrompt: {
        text: request.text,
        timestamp: Date.now(),
        status: "pending"
      }
    });
  }
});
