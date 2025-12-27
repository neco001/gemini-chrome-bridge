// gemini_content_ui.js (formerly fab_script.js)

// Configuration
const UI_ID = 'gemini-bridge-ui-host';

// State
let uiContainer = null;
let lastContextData = { selection: "", context: "" };

/**
 * Helper to extract context from current selection
 * Reused by both the message listener and the internal UI
 */
function getContextFromSelection() {
    const selection = window.getSelection();
    let selectedText = "";
    let contextText = "";

    if (selection && selection.rangeCount > 0 && selection.toString().trim().length > 0) {
        selectedText = selection.toString();
        
        try {
            const range = selection.getRangeAt(0);
            let node = range.commonAncestorContainer;
            
            if (node.nodeType === 3) { // Text node
                node = node.parentElement;
            }

            const blockTags = ["P", "DIV", "ARTICLE", "SECTION", "BLOCKQUOTE", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TD", "PRE", "CODE"];
            
            let contextNode = node;
            while (contextNode && contextNode !== document.body && contextNode !== document.documentElement) {
                if (blockTags.includes(contextNode.tagName)) {
                    break;
                }
                contextNode = contextNode.parentElement;
            }

            if (contextNode) {
                contextText = contextNode.innerText;
            }

        } catch (e) {
            console.error("Error finding context:", e);
        }
    } 
    
    return { selection: selectedText, context: contextText };
}


function createUi() {
    if (uiContainer) return;

    const host = document.createElement('div');
    host.id = UI_ID;
    host.style.position = 'fixed'; // Fixed for viewport positioning
    host.style.zIndex = '2147483647';
    host.style.top = '0px';
    host.style.left = '0px';
    host.style.width = '0px';
    host.style.height = '0px';

    const shadow = host.attachShadow({ mode: 'open' });

    // Window UI
    const windowDiv = document.createElement('div');
    windowDiv.className = 'prompt-window';
    
    let placeholder = "Ask Gemini..."; // Default fallback
    try {
        if (chrome && chrome.i18n) {
            placeholder = chrome.i18n.getMessage("fab_placeholder") || placeholder;
        }
    } catch (e) {
        // Extension context invalidated
        console.warn("Gemini Bridge: Extension context invalid, using default strings.");
    }
    
    windowDiv.innerHTML = `
        <div class="header">
            <span class="title">Gemini Bridge</span>
            <button id="close" title="Close">✕</button>
        </div>
        <textarea id="prompt-input" placeholder="${placeholder}"></textarea>
        <div class="preview" id="context-preview"></div>
        <div class="actions">
            <button id="send">🚀 Send</button>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        .prompt-window {
            position: fixed;
            top: 15%;
            left: 50%;
            transform: translateX(-50%) translateY(-20px);
            width: 400px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.25);
            border: 1px solid #e0e0e0;
            padding: 16px;
            display: none;
            flex-direction: column;
            gap: 12px;
            font-family: system-ui, -apple-system, sans-serif;
            opacity: 0;
            transition: opacity 0.2s, transform 0.2s;
        }
        .prompt-window.visible {
            display: flex;
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: #5f6368;
            font-size: 14px;
            font-weight: 600;
        }
        #close {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 16px;
            color: #999;
            padding: 4px;
        }
        #close:hover { color: #333; }
        
        textarea {
            width: 100%;
            height: 80px;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 10px;
            font-size: 14px;
            resize: vertical;
            outline: none;
            box-sizing: border-box;
            font-family: inherit;
        }
        textarea:focus {
            border-color: #4285f4;
            box-shadow: 0 0 0 2px rgba(66,133,244,0.2);
        }

        .preview {
            max-height: 100px;
            overflow-y: auto;
            background: #f1f3f4;
            border-radius: 6px;
            padding: 8px;
            font-size: 11px;
            color: #555;
            white-space: pre-wrap;
            display: none; /* hidden if empty */
        }

        .actions {
            display: flex;
            justify-content: flex-end;
        }
        #send {
            background: #1a73e8;
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 20px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: background 0.2s;
        }
        #send:hover {
            background: #1557b0;
        }
    `;

    shadow.appendChild(style);
    shadow.appendChild(windowDiv);
    document.body.appendChild(host);

    uiContainer = { host, shadow, windowDiv };
    
    // Elements
    const textarea = windowDiv.querySelector('#prompt-input');
    const sendBtn = windowDiv.querySelector('#send');
    const closeBtn = windowDiv.querySelector('#close');
    const preview = windowDiv.querySelector('#context-preview');

    // -- Bind Interactions --

    const closeUi = () => {
        windowDiv.classList.remove('visible');
        setTimeout(() => { 
            if (!windowDiv.classList.contains('visible')) {
                windowDiv.style.display = 'none'; 
            }
        }, 200);
    };

    const performSend = () => {
        const userPrompt = textarea.value.trim();
        const { selection, context } = lastContextData;

        // Construct final payload
        // Logic: Instruction + Context wrap
        let finalPayload = "";
        
        const contentPart = (context && context.trim() !== selection.trim()) 
            ? `Context:\n\`\`\`text\n${context}\n\`\`\`\n\nTarget:\n\`\`\`text\n${selection}\n\`\`\``
            : `Text:\n\`\`\`text\n${selection}\n\`\`\``;

        if (userPrompt) {
            finalPayload = `${userPrompt}\n\n${contentPart}`;
        } else {
            // No instruction, just send content (?)
            finalPayload = contentPart;
        }

        // Send to background
        chrome.runtime.sendMessage({
            action: "open_side_panel",
            text: finalPayload
        });

        // Clear and close
        textarea.value = '';
        closeUi();
    };

    closeBtn.addEventListener('click', closeUi);
    sendBtn.addEventListener('click', performSend);

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            performSend();
        }
        if (e.key === 'Escape') {
            closeUi();
        }
    });

    // Close on click outside (on the window background if we had a backdrop, but we don't)
    // Actually, let's just listen to document mousedown if visible
}

function showUi(initialSelection) {
    if (!uiContainer) createUi();
    
    // Refresh Data
    lastContextData = getContextFromSelection();
    
    // Fallback if selection was lost but passed via message
    if (!lastContextData.selection && initialSelection) {
        lastContextData.selection = initialSelection;
    }

    const { windowDiv, shadow } = uiContainer;
    const textarea = shadow.querySelector('#prompt-input');
    const preview = shadow.querySelector('#context-preview');

    // Update Preview
    if (lastContextData.context) {
        preview.textContent = "Context captured: " + lastContextData.context.substring(0, 150) + "...";
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }

    windowDiv.style.display = 'flex';
    // Trigger reflow
    windowDiv.offsetHeight; 
    windowDiv.classList.add('visible');

    textarea.focus();
}


// --- Listeners ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. Context Request (from Right Click standard menu)
    if (request.action === "get_selection_context") {
        const data = getContextFromSelection();
        sendResponse(data);
        return true;
    }

    // 2. Show Custom Input (from Right Click "Custom Prompt")
    if (request.action === "show_floating_input") {
        showUi(request.selectionText);
    }
});
