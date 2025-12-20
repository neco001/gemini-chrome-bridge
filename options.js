// options.js

const listDiv = document.getElementById('list');
const titleInput = document.getElementById('new-title');
const promptInput = document.getElementById('new-prompt');
const saveBtn = document.getElementById('save');
const statusDiv = document.getElementById('status');

// Load prompts on start
document.addEventListener('DOMContentLoaded', restoreOptions);
saveBtn.addEventListener('click', addPrompt);

function restoreOptions() {
    chrome.storage.sync.get({
        customPrompts: []
    }, (items) => {
        renderList(items.customPrompts);
    });
}

function renderList(prompts) {
    listDiv.innerHTML = '';
    prompts.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'prompt-item';
        div.innerHTML = `
            <div class="prompt-info">
                <span class="prompt-title">${escapeHtml(item.title)}</span>
                <span class="prompt-text">${escapeHtml(item.prompt)}</span>
            </div>
            <button class="btn-delete" data-index="${index}">🗑️</button>
        `;
        listDiv.appendChild(div);
    });

    // Add delete listeners
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.dataset.index);
            deletePrompt(idx);
        });
    });
}

function addPrompt() {
    const title = titleInput.value.trim();
    const prompt = promptInput.value.trim();

    if (!title || !prompt) {
        showStatus('Please fill in both fields.', 'red');
        return;
    }

    chrome.storage.sync.get({
        customPrompts: []
    }, (items) => {
        const newPrompts = items.customPrompts;
        // Generate a simple ID
        const id = 'cust_' + Date.now();
        newPrompts.push({ id, title, prompt });

        chrome.storage.sync.set({ customPrompts: newPrompts }, () => {
            // Reset form
            titleInput.value = '';
            promptInput.value = '';
            renderList(newPrompts);
            showStatus('Prompt saved!');
        });
    });
}

function deletePrompt(index) {
    chrome.storage.sync.get({
        customPrompts: []
    }, (items) => {
        const newPrompts = items.customPrompts;
        newPrompts.splice(index, 1);
        chrome.storage.sync.set({ customPrompts: newPrompts }, () => {
            renderList(newPrompts);
            showStatus('Prompt deleted.');
        });
    });
}

function showStatus(text, color = 'green') {
    statusDiv.textContent = text;
    statusDiv.style.color = color;
    setTimeout(() => {
        statusDiv.textContent = '';
    }, 2000);
}

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
