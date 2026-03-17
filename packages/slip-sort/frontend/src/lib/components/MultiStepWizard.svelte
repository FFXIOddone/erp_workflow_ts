<script>
    /**
     * MultiStepWizard Component
     * A flexible wizard component for multi-step forms and processes.
     * Features: step validation, navigation controls, progress indicator, and slot-based content.
     */
    import { createEventDispatcher, setContext } from 'svelte';
    import { writable } from 'svelte/store';
    import { fade, fly } from 'svelte/transition';
    
    /**
     * @typedef {Object} WizardStep
     * @property {string} id - Unique step identifier
     * @property {string} title - Step title
     * @property {string} [description] - Optional description
     * @property {string} [icon] - Optional icon
     * @property {(() => boolean|Promise<boolean>|Object)} [validate] - Optional validation function
     */
    
    /** @type {WizardStep[]} */
    export let steps = [];
    export let currentStep = 0;
    export let allowSkip = false;
    export let showProgress = true;
    export let linear = true; // Must complete steps in order
    export let completeButtonText = 'Complete';
    export let nextButtonText = 'Next';
    export let prevButtonText = 'Back';
    
    const dispatch = createEventDispatcher();
    
    /** @type {Record<string, string>} */
    let validationErrors = {};
    let stepStates = steps.map(() => ({ visited: false, completed: false }));
    // eslint-disable-next-line no-unused-vars
    let isTransitioning = false; // Used in setTimeout callback for animation state
    let direction = 1; // 1 = forward, -1 = backward
    
    // Create stores for child components
    const wizardStore = writable({
        currentStep,
        totalSteps: steps.length,
        isFirst: currentStep === 0,
        isLast: currentStep === steps.length - 1,
        canGoNext: true,
        canGoPrev: currentStep > 0,
    });
    
    // Update store when currentStep changes
    $: wizardStore.set({
        currentStep,
        totalSteps: steps.length,
        isFirst: currentStep === 0,
        isLast: currentStep === steps.length - 1,
        canGoNext: !linear || stepStates[currentStep]?.completed || !steps[currentStep]?.validate,
        canGoPrev: currentStep > 0,
    });
    
    // Provide context for child components
    setContext('wizard', {
        store: wizardStore,
        /** @param {number} step @param {any} data */
        setStepData: (step, data) => dispatch('stepData', { step, data }),
        markComplete: () => { stepStates[currentStep].completed = true; stepStates = stepStates; },
        /** @param {string} field @param {string} message */
        setError: (field, message) => { validationErrors[field] = message; validationErrors = validationErrors; },
        /** @param {string} field */
        clearError: (field) => { delete validationErrors[field]; validationErrors = validationErrors; },
    });
    
    $: progress = ((currentStep + 1) / steps.length) * 100;
    $: currentStepData = steps[currentStep];
    
    async function validateCurrentStep() {
        if (!currentStepData?.validate) return true;
        
        try {
            const result = await currentStepData.validate();
            if (result === true || result === undefined) {
                validationErrors = {};
                return true;
            }
            if (typeof result === 'object' && result !== null) {
                validationErrors = /** @type {Record<string, string>} */ (result);
            }
            return false;
        } catch (e) {
            validationErrors = { _error: e instanceof Error ? e.message : 'Unknown error' };
            return false;
        }
    }
    
    /** @param {number} index */
    async function goToStep(index) {
        if (index === currentStep) return;
        if (index < 0 || index >= steps.length) return;
        
        // Check if we can navigate (linear mode)
        if (linear && index > currentStep) {
            // Must complete all previous steps
            for (let i = currentStep; i < index; i++) {
                if (steps[i]?.validate && !stepStates[i].completed) {
                    dispatch('validationError', { step: i, message: 'Please complete this step first' });
                    return;
                }
            }
        }
        
        // Validate current step before moving forward
        if (index > currentStep) {
            const isValid = await validateCurrentStep();
            if (!isValid) {
                dispatch('validationError', { step: currentStep, errors: validationErrors });
                return;
            }
            stepStates[currentStep].completed = true;
        }
        
        // Animate direction
        direction = index > currentStep ? 1 : -1;
        isTransitioning = true;
        
        stepStates[currentStep].visited = true;
        currentStep = index;
        stepStates[currentStep].visited = true;
        stepStates = stepStates;
        
        setTimeout(() => { isTransitioning = false; }, 300);
        
        dispatch('stepChange', { step: currentStep, direction });
    }
    
    async function next() {
        if (currentStep < steps.length - 1) {
            await goToStep(currentStep + 1);
        } else {
            await complete();
        }
    }
    
    function prev() {
        if (currentStep > 0) {
            goToStep(currentStep - 1);
        }
    }
    
    async function complete() {
        const isValid = await validateCurrentStep();
        if (!isValid) {
            dispatch('validationError', { step: currentStep, errors: validationErrors });
            return;
        }
        
        stepStates[currentStep].completed = true;
        stepStates = stepStates;
        
        dispatch('complete', { stepStates });
    }
    
    function skip() {
        if (allowSkip && currentStep < steps.length - 1) {
            goToStep(currentStep + 1);
        }
    }
</script>

<div class="wizard">
    <!-- Progress Header -->
    {#if showProgress}
        <div class="wizard-header">
            <div class="progress-bar">
                <div class="progress-fill" style="width: {progress}%"></div>
            </div>
            
            <nav class="steps-nav" aria-label="Wizard steps">
                {#each steps as step, i}
                    <button
                        type="button"
                        class="step-indicator"
                        class:active={i === currentStep}
                        class:completed={stepStates[i].completed}
                        class:visited={stepStates[i].visited}
                        class:disabled={linear && i > currentStep && !stepStates[i - 1]?.completed}
                        on:click={() => goToStep(i)}
                        disabled={linear && i > currentStep && !stepStates[currentStep]?.completed}
                        aria-current={i === currentStep ? 'step' : undefined}
                    >
                        <span class="step-number">
                            {#if stepStates[i].completed}
                                ✓
                            {:else if step.icon}
                                {step.icon}
                            {:else}
                                {i + 1}
                            {/if}
                        </span>
                        <span class="step-title">{step.title}</span>
                    </button>
                    
                    {#if i < steps.length - 1}
                        <div class="step-connector" class:completed={stepStates[i].completed}></div>
                    {/if}
                {/each}
            </nav>
        </div>
    {/if}
    
    <!-- Step Content -->
    <div class="wizard-body">
        {#if currentStepData?.description}
            <p class="step-description">{currentStepData.description}</p>
        {/if}
        
        <!-- Validation Errors -->
        {#if Object.keys(validationErrors).length > 0}
            <div class="validation-errors" transition:fade={{ duration: 150 }}>
                {#each Object.entries(validationErrors) as [field, message]}
                    <p class="error-message">
                        {#if field !== '_error'}
                            <strong>{field}:</strong>
                        {/if}
                        {message}
                    </p>
                {/each}
            </div>
        {/if}
        
        <!-- Step Content Slot -->
        <div 
            class="step-content"
            in:fly={{ x: direction * 50, duration: 200, delay: 100 }}
            out:fly={{ x: -direction * 50, duration: 200 }}
        >
            <slot step={currentStepData} {currentStep} stepId={currentStepData?.id}>
                <p class="no-content">Step content for "{currentStepData?.title}" goes here.</p>
            </slot>
        </div>
    </div>
    
    <!-- Navigation Footer -->
    <div class="wizard-footer">
        <div class="footer-left">
            {#if currentStep > 0}
                <button type="button" class="btn btn-secondary" on:click={prev}>
                    ← {prevButtonText}
                </button>
            {/if}
        </div>
        
        <div class="footer-center">
            <span class="step-counter">
                Step {currentStep + 1} of {steps.length}
            </span>
        </div>
        
        <div class="footer-right">
            {#if allowSkip && currentStep < steps.length - 1}
                <button type="button" class="btn btn-ghost" on:click={skip}>
                    Skip
                </button>
            {/if}
            
            <button 
                type="button" 
                class="btn btn-primary" 
                on:click={next}
            >
                {currentStep === steps.length - 1 ? completeButtonText : nextButtonText} →
            </button>
        </div>
    </div>
</div>

<style>
    .wizard {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--color-bg, #fff);
        border-radius: 0.5rem;
        overflow: hidden;
    }
    
    /* Header & Progress */
    .wizard-header {
        padding: 1.5rem;
        border-bottom: 1px solid var(--color-border, #e5e7eb);
        background: var(--color-bg-secondary, #f9fafb);
    }
    
    .progress-bar {
        height: 4px;
        background: var(--color-border, #e5e7eb);
        border-radius: 2px;
        margin-bottom: 1.5rem;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        background: var(--color-primary, #3b82f6);
        transition: width 0.3s ease;
    }
    
    .steps-nav {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0;
    }
    
    .step-indicator {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .step-indicator:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
    
    .step-number {
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.875rem;
        background: var(--color-border, #e5e7eb);
        color: var(--color-text-secondary, #6b7280);
        transition: all 0.2s ease;
    }
    
    .step-indicator.active .step-number {
        background: var(--color-primary, #3b82f6);
        color: white;
        box-shadow: 0 0 0 4px var(--color-primary-light, rgba(59, 130, 246, 0.2));
    }
    
    .step-indicator.completed .step-number {
        background: var(--color-success, #10b981);
        color: white;
    }
    
    .step-indicator.visited:not(.active):not(.completed) .step-number {
        background: var(--color-primary-light, rgba(59, 130, 246, 0.2));
        color: var(--color-primary, #3b82f6);
    }
    
    .step-title {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #6b7280);
        white-space: nowrap;
    }
    
    .step-indicator.active .step-title {
        color: var(--color-primary, #3b82f6);
        font-weight: 500;
    }
    
    .step-connector {
        flex: 1;
        height: 2px;
        max-width: 80px;
        background: var(--color-border, #e5e7eb);
        transition: background 0.3s ease;
    }
    
    .step-connector.completed {
        background: var(--color-success, #10b981);
    }
    
    /* Body */
    .wizard-body {
        flex: 1;
        padding: 2rem;
        overflow-y: auto;
    }
    
    .step-description {
        color: var(--color-text-secondary, #6b7280);
        margin-bottom: 1.5rem;
        font-size: 0.875rem;
    }
    
    .validation-errors {
        background: var(--color-error-light, #fef2f2);
        border: 1px solid var(--color-error, #ef4444);
        border-radius: 0.375rem;
        padding: 1rem;
        margin-bottom: 1.5rem;
    }
    
    .error-message {
        color: var(--color-error, #ef4444);
        font-size: 0.875rem;
        margin: 0;
    }
    
    .error-message + .error-message {
        margin-top: 0.5rem;
    }
    
    .step-content {
        min-height: 200px;
    }
    
    .no-content {
        color: var(--color-text-muted, #9ca3af);
        text-align: center;
        padding: 3rem;
    }
    
    /* Footer */
    .wizard-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--color-border, #e5e7eb);
        background: var(--color-bg-secondary, #f9fafb);
    }
    
    .footer-left, .footer-right {
        display: flex;
        gap: 0.75rem;
    }
    
    .footer-center {
        flex: 1;
        text-align: center;
    }
    
    .step-counter {
        font-size: 0.875rem;
        color: var(--color-text-secondary, #6b7280);
    }
    
    .btn {
        padding: 0.625rem 1.25rem;
        border-radius: 0.375rem;
        font-weight: 500;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none;
    }
    
    .btn-primary {
        background: var(--color-primary, #3b82f6);
        color: white;
    }
    
    .btn-primary:hover {
        background: var(--color-primary-dark, #2563eb);
    }
    
    .btn-secondary {
        background: var(--color-bg, #fff);
        color: var(--color-text, #111827);
        border: 1px solid var(--color-border, #e5e7eb);
    }
    
    .btn-secondary:hover {
        background: var(--color-bg-secondary, #f9fafb);
    }
    
    .btn-ghost {
        background: transparent;
        color: var(--color-text-secondary, #6b7280);
    }
    
    .btn-ghost:hover {
        background: var(--color-bg-secondary, #f9fafb);
    }
    
    /* Responsive */
    @media (max-width: 640px) {
        .step-title {
            display: none;
        }
        
        .step-connector {
            max-width: 40px;
        }
        
        .footer-center {
            display: none;
        }
    }
</style>
