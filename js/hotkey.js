// js/hotkey.js

let isCapturingHotkey = false;
let capturedKeys = new Set();

export function setupHotkeyCapture() {
    const hotkeyInput = document.getElementById('soundHotkey');
    if (!hotkeyInput) return;

    hotkeyInput.addEventListener('focus', () => {
        isCapturingHotkey = true;
        capturedKeys.clear();
        hotkeyInput.value = '';
        hotkeyInput.placeholder = 'Pressione as teclas...';
    });

    hotkeyInput.addEventListener('blur', () => {
        isCapturingHotkey = false;
        if (hotkeyInput.value === '') {
            hotkeyInput.placeholder = 'Clique aqui e pressione as teclas...';
        }
    });

    // Attach the keydown listener specifically for capturing
    // We attach it to the document, but it only acts when isCapturingHotkey is true
    // Ensure this listener doesn't conflict with other global listeners
    document.addEventListener('keydown', handleCaptureKeydown);
}

function handleCaptureKeydown(e) {
    const hotkeyInput = document.getElementById('soundHotkey');
    if (isCapturingHotkey && hotkeyInput && document.getElementById('addModal').style.display === 'block') {
        e.preventDefault();
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return; // Ignore modifier keys alone

        const keys = [];
        if (e.ctrlKey) keys.push('CommandOrControl');
        if (e.shiftKey) keys.push('Shift');
        if (e.altKey) keys.push('Alt');

        let key = e.key;
        const specialKeys = { /* ... your special keys map ... */ };
        if (specialKeys[key]) key = specialKeys[key];
        else if (key.length === 1) key = key.toUpperCase();

        // Only add non-modifier keys
        if (!['CONTROL', 'SHIFT', 'ALT', 'COMMANDORCONTROL', 'META'].includes(key.toUpperCase())) {
            keys.push(key);
        }

        // Ensure at least one non-modifier key exists unless it's just modifiers
        if (keys.length > 0 && keys.slice(0, -1).every(k => ['CommandOrControl', 'Shift', 'Alt'].includes(k))) {
             if (!['CommandOrControl', 'Shift', 'Alt'].includes(keys.at(-1))) {
                 hotkeyInput.value = keys.join('+');
             } else if (keys.length === 1 && ['CommandOrControl', 'Shift', 'Alt'].includes(keys[0])) {
                  // Allow single modifier if needed? Usually not. Let's clear.
                  hotkeyInput.value = ''; // Or provide feedback
             } else {
                 hotkeyInput.value = keys.join('+'); // Allows Mod+Mod if needed?
             }
        } else if (keys.length === 0 && !['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
             // Handle single non-modifier key like 'A', 'F1', 'Space'
             hotkeyInput.value = key;
        }


        // Automatically blur after capture (optional)
        // setTimeout(() => {
        //     isCapturingHotkey = false;
        //     hotkeyInput.blur();
        // }, 100);
    }
}


export function clearHotkey() {
    const hotkeyInput = document.getElementById('soundHotkey');
    if(hotkeyInput) hotkeyInput.value = '';
    capturedKeys.clear();
     isCapturingHotkey = false; // Ensure capture stops
}

// Function to remove the listener if needed (e.g., when modal closes)
export function removeHotkeyCaptureListener() {
    document.removeEventListener('keydown', handleCaptureKeydown);
}