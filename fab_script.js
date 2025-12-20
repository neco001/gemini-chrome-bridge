// fab_script.js

// Configuration
const FAB_ID = 'gemini-bridge-fab-container';
const BTN_SIZE = 32;

// State
let lastSelection = "";
let traceSelection = ""; // Keep track of selection even if lost focus
let fabContainer = null;
let isExpanded = false;

function createFab() {
    if (fabContainer) return;

    // Create host for Shadow DOM
    const host = document.createElement('div');
    host.id = FAB_ID;
    host.style.position = 'absolute';
    host.style.zIndex = '2147483647';
    host.style.top = '0px';
    host.style.left = '0px';
    host.style.pointerEvents = 'none'; // Pass through clicks when hidden

    // Attach Shadow DOM
    const shadow = host.attachShadow({ mode: 'open' });

    // 1. Sparkle Button
    const btn = document.createElement('button');
    btn.className = 'sparkle-btn';
    btn.innerHTML = '✨';
    btn.innerHTML = '✨';
    btn.title = chrome.i18n.getMessage("extName");

    // 2. Input Window (Hidden by default)
    const windowDiv = document.createElement('div');
    windowDiv.className = 'prompt-window';
    const placeholder = chrome.i18n.getMessage("fab_placeholder");
    windowDiv.innerHTML = `
        <textarea placeholder="${placeholder}"></textarea>
        <div class="actions">
            <button id="send">🚀</button>
        </div>
    `;

    // Styles
    const style = document.createElement('style');
    style.textContent = `
        /* Sparkle Button */
        .sparkle-btn {
            width: ${BTN_SIZE}px;
            height: ${BTN_SIZE}px;
            border-radius: 50%;
            border: 1px solid #ddd;
            background: linear-gradient(135deg, #FFF 0%, #F5F7FF 100%);
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.1s, opacity 0.2s;
            opacity: 0;
            pointer-events: auto;
            transform: scale(0.8);
            outline: none;
            position: absolute;
            top: 0;
            left: 0;
            display: flex;
        }
        .sparkle-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 12px rgba(30,144,255,0.3);
            border-color: #4285f4;
        }
        .sparkle-btn.visible {
            opacity: 1;
            transform: scale(1);
        }

        /* Prompt Window */
        .prompt-window {
            position: absolute;
            top: 0;
            left: ${BTN_SIZE + 10}px; /* Appears to the right of cursor anchor */
            width: 250px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 16px rgba(0,0,0,0.15);
            border: 1px solid #e0e0e0;
            padding: 8px;
            display: none;
            flex-direction: column;
            gap: 8px;
            pointer-events: auto;
            font-family: sans-serif;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.2s, transform 0.2s;
        }
        .prompt-window.visible {
            display: flex;
            opacity: 1;
            transform: translateY(0);
        }
        textarea {
            width: 100%;
            height: 60px;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 8px;
            font-size: 13px;
            resize: none;
            outline: none;
            box-sizing: border-box;
            font-family: inherit;
        }
        textarea:focus {
            border-color: #4285f4;
        }
        .actions {
            display: flex;
            justify-content: flex-end;
        }
        #send {
            background: #4285f4;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 4px 12px;
            cursor: pointer;
            font-weight: bold;
        }
        #send:hover {
            background: #3367d6;
        }
    `;

    shadow.appendChild(style);
    shadow.appendChild(btn);
    shadow.appendChild(windowDiv);
    document.body.appendChild(host);

    fabContainer = { host, shadow, btn, windowDiv };
    const textarea = windowDiv.querySelector('textarea');
    const sendBtn = windowDiv.querySelector('#send');

    // --- Interactions ---

    // 1. Expand on Click
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        expandWindow();
    });

    // 3. Send Logic
    const performSend = () => {
        const userPrompt = textarea.value.trim();
        const context = traceSelection || lastSelection;

        if (context) {
            let finalPayload = context;
            // If user typed something, wrap it.
            if (userPrompt) {
                const ctxLabel = chrome.i18n.getMessage("fab_context_label");
                const cmdLabel = chrome.i18n.getMessage("fab_command_label");
                finalPayload = `${cmdLabel}\n${userPrompt}\n\n${ctxLabel}\n\`\`\`text\n${context}\n\`\`\``;
            } else {
                 // Context only (e.g. just Explain this) - though usually FAB implies a custom command.
                 // If sending RAW context without command, maybe just wrap it too?
                 // Let's assume clear intention:
                 finalPayload = `${context}`;
            }

            // Send to background
            chrome.runtime.sendMessage({
                action: "open_side_panel",
                text: finalPayload
            });
        }

        // Reset and hide
        textarea.value = '';
        hideFab(true);
    };

    sendBtn.addEventListener('click', performSend);

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            performSend();
        }
        if (e.key === 'Escape') {
            hideFab(true);
        }
    });

    // Stop propagation in window to prevent closing on click inside
    windowDiv.addEventListener('mousedown', e => e.stopPropagation());
    windowDiv.addEventListener('mouseup', e => e.stopPropagation());
}

function expandWindow() {
    if (!fabContainer) return;
    isExpanded = true;

    const { btn, windowDiv } = fabContainer;

    // Hide button, show window
    btn.style.display = 'none';
    windowDiv.classList.add('visible');

    // Focus textarea
    setTimeout(() => {
        const ta = windowDiv.querySelector('textarea');
        ta.focus();
    }, 50);
}

function showFab(x, y) {
    if (!fabContainer) createFab();

    // If expanded, don't move it around while typing
    if (isExpanded) return;

    const { host, btn, windowDiv } = fabContainer;
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;

    // Ensure separate visibility states
    btn.style.display = 'flex';
    requestAnimationFrame(() => {
        btn.classList.add('visible');
    });
}

function hideFab(force = false) {
    if (!fabContainer) return;

    // If we are typing (expanded), don't hide on accidental mouse moves outside
    // Only hide if Force (Send/Esc) or Selection Cleared
    if (isExpanded && !force) return;

    const { btn, windowDiv } = fabContainer;

    btn.classList.remove('visible');
    windowDiv.classList.remove('visible');

    // Reset state after animation
    setTimeout(() => {
        if (!isExpanded) return; // Race condition check
        btn.style.display = 'flex';
        isExpanded = false;
    }, 200);
}

// Event Listeners
document.addEventListener('mouseup', (e) => {
    // Ignore clicks inside our own FAB
    if (fabContainer && fabContainer.host.contains(e.target)) return;

    // Get selection
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
        lastSelection = text;
        traceSelection = text; // Keep a trace for instructions

        // Calculate position
        const x = e.pageX + 10;
        const y = e.pageY - 40;

        showFab(x, y);
    } else {
        // Only hide if we aren't interfering with the window
        // If user clicks away, we generally close everything
        hideFab(true);
    }
});

// Close on scroll to avoid floating weirdness
document.addEventListener('scroll', () => {
    if (!isExpanded) hideFab(true);
}, { passive: true });
