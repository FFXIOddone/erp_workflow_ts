<script>
    /**
     * InlineEdit Component
     * Allows inline editing of text with auto-save capabilities.
     * Supports validation, keyboard shortcuts, and undo/redo.
     */
    import { createEventDispatcher } from 'svelte';
    import { fade, slide } from 'svelte/transition';
    
    export let value = '';
    export let type = 'text'; // text, number, textarea
    export let placeholder = 'Click to edit...';
    export let disabled = false;
    export let required = false;
    export let minLength = 0;
    export let maxLength = Infinity;
    /** @type {string|null} */
    export let pattern = null;
    export let autoSave = false;
    export let autoSaveDelay = 1000; // ms
    export let showSaveIndicator = true;
    export let label = '';
    
    const dispatch = createEventDispatcher();
    
    let editing = false;
    let inputValue = value;
    /** @type {HTMLInputElement|HTMLTextAreaElement|undefined} */
    let inputElement;
    /** @type {ReturnType<typeof setTimeout>|undefined} */
    let saveTimeout;
    let saveState = 'idle'; // idle, saving, saved, error
    let error = '';
    let history = [value];
    let historyIndex = 0;
    
    $: if (value !== inputValue && !editing) {
        inputValue = value;
    }
    
    function startEditing() {
        if (disabled) return;
        editing = true;
        setTimeout(() => inputElement?.focus(), 10);
    }
    
    function validate() {
        if (required && !inputValue.trim()) {
            error = 'This field is required';
            return false;
        }
        if (inputValue.length < minLength) {
            error = `Minimum ${minLength} characters required`;
            return false;
        }
        if (inputValue.length > maxLength) {
            error = `Maximum ${maxLength} characters allowed`;
            return false;
        }
        if (pattern && !new RegExp(pattern).test(inputValue)) {
            error = 'Invalid format';
            return false;
        }
        error = '';
        return true;
    }
    
    function save() {
        if (!validate()) return;
        
        if (inputValue !== value) {
            // Add to history
            history = [...history.slice(0, historyIndex + 1), inputValue];
            historyIndex = history.length - 1;
            
            dispatch('change', { value: inputValue, oldValue: value });
            
            if (autoSave) {
                saveState = 'saving';
                dispatch('save', { 
                    value: inputValue,
                    done: () => { saveState = 'saved'; setTimeout(() => saveState = 'idle', 2000); },
                    fail: (/** @type {string} */ msg) => { saveState = 'error'; error = msg; }
                });
            }
        }
        
        editing = false;
    }
    
    function cancel() {
        inputValue = value;
        error = '';
        editing = false;
        dispatch('cancel');
    }
    
    /** @param {KeyboardEvent} e */
    function handleKeydown(e) {
        if (e.key === 'Enter' && type !== 'textarea') {
            e.preventDefault();
            save();
        } else if (e.key === 'Escape') {
            cancel();
        } else if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    }
    
    function handleInput() {
        if (autoSave) {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                if (validate() && inputValue !== value) {
                    save();
                }
            }, autoSaveDelay);
        }
    }
    
    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            inputValue = history[historyIndex];
            dispatch('change', { value: inputValue, oldValue: value });
        }
    }
    
    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            inputValue = history[historyIndex];
            dispatch('change', { value: inputValue, oldValue: value });
        }
    }
    
    function handleBlur() {
        if (editing) {
            save();
        }
    }
</script>

<div class="inline-edit" class:editing class:disabled class:error={!!error}>
    {#if label}
        <!-- svelte-ignore a11y-label-has-associated-control -->
        <label class="inline-edit-label">{label}</label>
    {/if}
    
    {#if editing}
        <div class="edit-container" transition:fade={{ duration: 150 }}>
            {#if type === 'textarea'}
                <textarea
                    bind:this={inputElement}
                    bind:value={inputValue}
                    {placeholder}
                    on:keydown={handleKeydown}
                    on:input={handleInput}
                    on:blur={handleBlur}
                    class:error={!!error}
                    rows="3"
                ></textarea>
            {:else if type === 'number'}
                <input
                    bind:this={inputElement}
                    bind:value={inputValue}
                    type="number"
                    {placeholder}
                    on:keydown={handleKeydown}
                    on:input={handleInput}
                    on:blur={handleBlur}
                    class:error={!!error}
                />
            {:else}
                <input
                    bind:this={inputElement}
                    bind:value={inputValue}
                    type="text"
                    {placeholder}
                    on:keydown={handleKeydown}
                    on:input={handleInput}
                    on:blur={handleBlur}
                    class:error={!!error}
                />
            {/if}
            
            <div class="edit-actions">
                <button type="button" class="save-btn" on:click={save} title="Save (Enter)">
                    ✓
                </button>
                <button type="button" class="cancel-btn" on:click={cancel} title="Cancel (Esc)">
                    ✕
                </button>
            </div>
        </div>
        
        {#if error}
            <span class="error-message" transition:slide={{ duration: 150 }}>{error}</span>
        {/if}
    {:else}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <span 
            class="display-value" 
            class:placeholder={!value}
            on:click={startEditing}
            on:dblclick={startEditing}
        >
            {value || placeholder}
            {#if !disabled}
                <span class="edit-hint">✎</span>
            {/if}
        </span>
        
        {#if showSaveIndicator && saveState !== 'idle'}
            <span class="save-indicator" class:saving={saveState === 'saving'} class:saved={saveState === 'saved'} class:error={saveState === 'error'}>
                {#if saveState === 'saving'}
                    Saving...
                {:else if saveState === 'saved'}
                    ✓ Saved
                {:else if saveState === 'error'}
                    ✕ Error
                {/if}
            </span>
        {/if}
    {/if}
</div>

<style>
    .inline-edit {
        position: relative;
        display: inline-flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .inline-edit-label {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-secondary, #6b7280);
    }
    
    .display-value {
        cursor: pointer;
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        border: 1px solid transparent;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .display-value:hover {
        background: var(--color-bg-hover, #f3f4f6);
        border-color: var(--color-border, #e5e7eb);
    }
    
    .display-value.placeholder {
        color: var(--color-text-muted, #9ca3af);
        font-style: italic;
    }
    
    .edit-hint {
        opacity: 0;
        font-size: 0.875rem;
        color: var(--color-text-muted, #9ca3af);
        transition: opacity 0.15s ease;
    }
    
    .display-value:hover .edit-hint {
        opacity: 1;
    }
    
    .edit-container {
        display: flex;
        gap: 0.5rem;
        align-items: flex-start;
    }
    
    input, textarea {
        padding: 0.5rem;
        border: 1px solid var(--color-border, #e5e7eb);
        border-radius: 0.25rem;
        font-size: inherit;
        font-family: inherit;
        background: var(--color-bg, #fff);
        color: var(--color-text, #111827);
        min-width: 200px;
    }
    
    input:focus, textarea:focus {
        outline: none;
        border-color: var(--color-primary, #3b82f6);
        box-shadow: 0 0 0 2px var(--color-primary-light, rgba(59, 130, 246, 0.2));
    }
    
    input.error, textarea.error {
        border-color: var(--color-error, #ef4444);
    }
    
    .edit-actions {
        display: flex;
        gap: 0.25rem;
    }
    
    .save-btn, .cancel-btn {
        padding: 0.5rem;
        border: none;
        border-radius: 0.25rem;
        cursor: pointer;
        font-size: 0.875rem;
        transition: all 0.15s ease;
    }
    
    .save-btn {
        background: var(--color-success, #10b981);
        color: white;
    }
    
    .save-btn:hover {
        background: var(--color-success-dark, #059669);
    }
    
    .cancel-btn {
        background: var(--color-bg-secondary, #f3f4f6);
        color: var(--color-text-secondary, #6b7280);
    }
    
    .cancel-btn:hover {
        background: var(--color-bg-tertiary, #e5e7eb);
    }
    
    .error-message {
        font-size: 0.75rem;
        color: var(--color-error, #ef4444);
    }
    
    .save-indicator {
        font-size: 0.75rem;
        padding: 0.125rem 0.5rem;
        border-radius: 0.25rem;
    }
    
    .save-indicator.saving {
        color: var(--color-warning, #f59e0b);
    }
    
    .save-indicator.saved {
        color: var(--color-success, #10b981);
    }
    
    .save-indicator.error {
        color: var(--color-error, #ef4444);
    }
    
    .disabled .display-value {
        cursor: not-allowed;
        opacity: 0.6;
    }
    
    .disabled .display-value:hover {
        background: transparent;
        border-color: transparent;
    }
</style>
