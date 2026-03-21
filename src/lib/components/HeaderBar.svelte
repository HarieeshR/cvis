<script lang="ts">
  import { Check, ChevronDown } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { selectedLanguage } from '$lib/stores';
  import { LANGUAGE_OPTIONS, getLanguageOption, type LanguageOption } from '$lib/languages';

  let isSelectorOpen = false;
  let selectorRef: HTMLDivElement;

  $: activeLanguage = getLanguageOption($selectedLanguage);

  function toggleSelector() {
    isSelectorOpen = !isSelectorOpen;
  }

  function selectLanguage(option: LanguageOption) {
    if (!option.enabled) {
      return;
    }

    selectedLanguage.set(option.id);
    isSelectorOpen = false;
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!selectorRef) {
      return;
    }

    const target = event.target;
    if (target instanceof Node && !selectorRef.contains(target)) {
      isSelectorOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  });
</script>

<header class="header-bar">
  <div class="logo-section">
    <div class="selector-shell" bind:this={selectorRef}>
      <button
        type="button"
        class="logo-icon-btn"
        aria-label="Open language selector"
        aria-haspopup="menu"
        aria-expanded={isSelectorOpen}
        on:click|stopPropagation={toggleSelector}
      >
        <span class="code-glyph">&lt;/&gt;</span>
        <ChevronDown size={14} class={isSelectorOpen ? 'is-open' : ''} />
      </button>

      {#if isSelectorOpen}
        <div class="language-popover" role="menu" aria-label="Language selector">
          <div class="popover-title">Language Selector</div>
          {#each LANGUAGE_OPTIONS as option}
            <button
              type="button"
              role="menuitemradio"
              aria-checked={$selectedLanguage === option.id}
              disabled={!option.enabled}
              class="language-option"
              class:selected={$selectedLanguage === option.id}
              class:disabled={!option.enabled}
              on:click|stopPropagation={() => selectLanguage(option)}
            >
              <span class="option-left">
                <span class="option-label">{option.label}</span>
                {#if !option.enabled}
                  <span class="option-tag">Soon</span>
                {/if}
              </span>
              {#if $selectedLanguage === option.id}
                <Check size={13} color="#98c379" />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="logo-text">
      <h1 class="title">{activeLanguage.label} Cloud Compiler</h1>
      <span class="subtitle">Interactive Visualizer</span>
    </div>
  </div>
</header>

<style>
  :root {
    --od-bg-main: #282c34;
    --od-bg-deep: #21252b;
    --od-bg-hover: #2c313a;
    --od-border: #3e4451;
    --od-text: #abb2bf;
    --od-text-dim: #5c6370;
    --od-text-bright: #e5e5e5;
    --od-green: #98c379;
    --od-blue: #61afef;
  }

  .header-bar {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 12px 16px;
    background: var(--od-bg-deep);
    border-bottom: 1px solid var(--od-border);
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    position: relative;
    z-index: 20;
  }

  .logo-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .selector-shell {
    position: relative;
  }

  .logo-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 48px;
    height: 36px;
    background: linear-gradient(135deg, rgba(97, 175, 239, 0.15), rgba(97, 175, 239, 0.05));
    border: 1px solid rgba(97, 175, 239, 0.28);
    border-radius: 8px;
    transition: all 0.2s ease;
    cursor: pointer;
    color: #61afef;
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  }

  .logo-icon-btn:hover {
    background: linear-gradient(135deg, rgba(97, 175, 239, 0.25), rgba(97, 175, 239, 0.1));
    border-color: rgba(97, 175, 239, 0.45);
  }

  .logo-icon-btn :global(svg) {
    transition: transform 0.15s ease;
  }

  .code-glyph {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: #61afef;
    line-height: 1;
  }

  .logo-icon-btn :global(.is-open) {
    transform: rotate(180deg);
  }

  .language-popover {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: 220px;
    background: #1f2329;
    border: 1px solid var(--od-border);
    border-radius: 10px;
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.32);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .popover-title {
    font-size: 10px;
    color: var(--od-text-dim);
    font-weight: 700;
    letter-spacing: 0.35px;
    text-transform: uppercase;
    padding: 4px 6px;
  }

  .language-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--od-border);
    border-radius: 7px;
    background: var(--od-bg-main);
    color: var(--od-text);
    padding: 8px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  }

  .language-option:hover:not(.disabled) {
    border-color: rgba(97, 175, 239, 0.5);
    background: var(--od-bg-hover);
    color: var(--od-text-bright);
  }

  .language-option.selected {
    border-color: rgba(152, 195, 121, 0.45);
    background: color-mix(in srgb, var(--od-green) 10%, var(--od-bg-main));
  }

  .language-option.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .option-left {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .option-label {
    font-size: 12px;
    font-weight: 600;
  }

  .option-tag {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #d19a66;
    border: 1px solid rgba(209, 154, 102, 0.45);
    border-radius: 9px;
    padding: 2px 5px;
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: var(--od-text-bright);
    letter-spacing: 0.3px;
  }

  .subtitle {
    font-size: 11px;
    color: var(--od-text-dim);
    font-weight: 500;
  }
</style>
