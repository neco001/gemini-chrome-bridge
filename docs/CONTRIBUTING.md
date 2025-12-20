# Contributing to Gemini Chrome Bridge

We welcome contributions! This project is a lightweight wrapper, and there are many opportunities to improve its stability and feature set.

## Roadmap & Ideas

Below are some planned features and areas for improvement. Feel free to pick one up!

- [ ] **Streamlined DOM Selectors**: The `gemini_driver.js` relies on specific CSS selectors that might change if Google updates their UI. Implementing a robust fallback strategy would be valuable.
- [ ] **Response Extraction**: Currently, the communication is one-way (Extension -> Gemini). A future goal is to read the generated response from the DOM and perhaps display a notification or copy it to the clipboard.
- [ ] **Custom Prompt Templates**: Allow users to define their own context menu templates via an Options page.
- [ ] **Keyboard Shortcuts**: Add hotkeys for quickly opening the panel or triggering the last action.

## Development Setup

1.  Follow the installation steps in `README.md`.
2.  Make changes to the code.
3.  Go to `chrome://extensions/` and click the **Reload** icon on the extension card to apply changes.
4.  If you modify the Content Scripts (`gemini_driver.js`, `fab_script.js`), you must reload the target web page as well.
