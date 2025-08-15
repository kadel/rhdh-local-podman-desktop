<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import Prism from 'prismjs';
  
  // Import core languages
  import 'prismjs/components/prism-yaml';
  import 'prismjs/components/prism-properties';
  import 'prismjs/components/prism-bash';
  
  // Import theme
  import 'prismjs/themes/prism-tomorrow.css';
  
  export let value: string = '';
  export let language: string = 'yaml';
  export let placeholder: string = 'Enter content...';
  export let readonly: boolean = false;
  export let className: string = '';
  
  let textareaElement: HTMLTextAreaElement;
  let highlightElement: HTMLElement;
  let containerElement: HTMLDivElement;
  
  // Determine language based on file type or content
  function getLanguage(lang: string): string {
    switch (lang.toLowerCase()) {
      case 'env':
      case 'environment':
        return 'properties';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'bash':
      case 'sh':
        return 'bash';
      default:
        return 'yaml'; // Default to YAML
    }
  }
  
  function highlightCode() {
    if (highlightElement && value) {
      const actualLanguage = getLanguage(language);
      try {
        const highlighted = Prism.highlight(value, Prism.languages[actualLanguage] || Prism.languages.yaml, actualLanguage);
        highlightElement.innerHTML = highlighted;
      } catch (error) {
        // Fallback to plain text if highlighting fails
        highlightElement.textContent = value;
      }
    } else if (highlightElement) {
      highlightElement.innerHTML = '';
    }
  }
  
  function syncScroll() {
    if (textareaElement && highlightElement) {
      highlightElement.scrollTop = textareaElement.scrollTop;
      highlightElement.scrollLeft = textareaElement.scrollLeft;
    }
  }
  
  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    value = target.value;
  }
  
  function handleKeydown(event: KeyboardEvent) {
    // Handle tab key for indentation
    if (event.key === 'Tab') {
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      // Insert 2 spaces for tab
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      value = newValue;
      
      // Restore cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  }
  
  onMount(() => {
    highlightCode();
  });
  
  afterUpdate(() => {
    highlightCode();
  });
  
  // React to value changes
  $: if (value !== undefined) {
    highlightCode();
  }
</script>

<!-- Code editor with syntax highlighting -->
<div class="code-editor-container {className}" bind:this={containerElement}>
  <!-- Syntax highlighted background -->
  <div
    bind:this={highlightElement}
    class="highlight-layer"
    aria-hidden="true"
  ></div>
  
  <!-- Editable textarea -->
  <textarea
    bind:this={textareaElement}
    bind:value
    {readonly}
    {placeholder}
    spellcheck="false"
    class="edit-layer"
    on:input={handleInput}
    on:scroll={syncScroll}
    on:keydown={handleKeydown}
  ></textarea>
</div>

<style>
  .code-editor-container {
    position: relative;
    width: 100%;
    min-height: 320px; /* Taller default height - h-80 equivalent */
    background: #1a202c;
    border: 1px solid var(--pd-content-divider);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .code-editor-container:focus-within {
    border-color: #9f7aea;
    box-shadow: 0 0 0 2px rgba(159, 122, 234, 0.2);
  }
  
  /* Base styling for both layers */
  .highlight-layer,
  .edit-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 1rem;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Fira Code', 'Consolas', monospace;
    font-size: 14px;
    line-height: 1.5;
    white-space: pre;
    overflow: auto;
    tab-size: 2;
    box-sizing: border-box;
  }
  
  /* Syntax highlight layer - visible background */
  .highlight-layer {
    color: #e2e8f0;
    background: transparent;
    pointer-events: none;
    z-index: 1;
    overflow-wrap: normal;
    word-wrap: normal;
    word-break: normal;
  }
  
  /* Edit layer - transparent text with visible caret */
  .edit-layer {
    background: transparent;
    color: transparent;
    caret-color: #e2e8f0;
    border: none;
    outline: none;
    resize: none;
    z-index: 2;
  }
  
  .edit-layer::placeholder {
    color: rgba(113, 128, 150, 0.8);
  }
  
  .edit-layer::selection {
    background: rgba(56, 178, 172, 0.3);
  }
  
  /* Scrollbar styling */
  .edit-layer::-webkit-scrollbar,
  .highlight-layer::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  .edit-layer::-webkit-scrollbar-track,
  .highlight-layer::-webkit-scrollbar-track {
    background: #2d3748;
    border-radius: 4px;
  }
  
  .edit-layer::-webkit-scrollbar-thumb,
  .highlight-layer::-webkit-scrollbar-thumb {
    background: #4a5568;
    border-radius: 4px;
  }
  
  .edit-layer::-webkit-scrollbar-thumb:hover,
  .highlight-layer::-webkit-scrollbar-thumb:hover {
    background: #718096;
  }
  
  /* Readonly state */
  .code-editor-container:has(.edit-layer[readonly]) {
    opacity: 0.8;
  }
  
  .edit-layer[readonly] {
    cursor: not-allowed;
  }
  
  /* Syntax highlighting colors */
  :global(.code-editor-container .token.comment) {
    color: #718096 !important;
  }
  
  :global(.code-editor-container .token.property) {
    color: #63b3ed !important;
  }
  
  :global(.code-editor-container .token.string) {
    color: #68d391 !important;
  }
  
  :global(.code-editor-container .token.number) {
    color: #f6ad55 !important;
  }
  
  :global(.code-editor-container .token.boolean) {
    color: #fc8181 !important;
  }
  
  :global(.code-editor-container .token.key) {
    color: #81e6d9 !important;
  }
  
  :global(.code-editor-container .token.punctuation) {
    color: #a0aec0 !important;
  }
  
  :global(.code-editor-container .token.scalar) {
    color: #fbb6ce !important;
  }
  
  :global(.code-editor-container .token.important) {
    color: #f56565 !important;
  }
  
  :global(.code-editor-container .token.anchor) {
    color: #d69e2e !important;
  }
  
  :global(.code-editor-container .token.tag) {
    color: #9f7aea !important;
  }
  
  :global(.code-editor-container .token.value) {
    color: #68d391 !important;
  }
</style>
