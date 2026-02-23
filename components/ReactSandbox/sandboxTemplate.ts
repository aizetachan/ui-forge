/**
 * generateSandboxHTML — Generates the isolated iframe HTML for the React sandbox.
 *
 * Contains:
 * - React 18 runtime from CDN
 * - Theme CSS injection point  
 * - Component CSS injection point
 * - Message-based communication protocol with parent
 * - Component rendering and computed style extraction
 */

/**
 * Generate the complete HTML document for the preview iframe.
 * Includes React runtime, theme styles, and message handler.
 */
export function generateSandboxHTML(themeCSS: string = ''): string {
  // Build absolute URLs for scripts — srcdoc iframes don't resolve relative paths
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Diagnostic: capture script loading errors -->
  <script>
    window.addEventListener('error', function(e) {
      if (e.target && (e.target.tagName === 'IMG' || e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK')) {
        console.warn('[Sandbox DIAG] Asset failed to load:', e.target.src || e.target.href || e.target);
        return;
      }
      console.error('[Sandbox DIAG] Error:', e.message || e, e.filename, e.lineno);
    }, true);
  </script>
  
  <!-- React 18 from local bundles (absolute URLs for srcdoc iframe) -->
  <script src="${origin}/react.development.js"></script>
  <script src="${origin}/react-dom.development.js"></script>
  
  <!-- Verify React loaded -->
  <script>
    if (typeof React === 'undefined') {
      console.error('[Sandbox DIAG] React failed to load! Trying to report to parent...');
      document.title = 'REACT_LOAD_FAILED';
    } else {
      console.log('[Sandbox DIAG] React loaded OK, version:', React.version);
    }
    if (typeof ReactDOM === 'undefined') {
      console.error('[Sandbox DIAG] ReactDOM failed to load!');
    } else {
      console.log('[Sandbox DIAG] ReactDOM loaded OK');
    }
  </script>
  
  <style id="theme-styles">
    /* Theme CSS (design tokens) */
    ${themeCSS}
  </style>
  
  <style id="component-styles">
    /* Component CSS will be injected here */
  </style>
  
  <style id="override-styles">
    /* Style overrides from Properties Panel will be injected here */
  </style>
  
  <style>
    /* Base styles */
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: transparent;
      font-family: var(--sg-font-family, system-ui, -apple-system, sans-serif);
      color: var(--sg-color-text-primary, #fafafa);
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    body.layout-stretch {
      align-items: stretch;
      justify-content: stretch;
    }
    body.layout-natural {
      display: block;
    }
    #root {
      display: inline-flex;
      flex-direction: column;
      align-items: stretch;
    }
    #forge-portal-root {
      position: fixed;
      top: 0;
      left: 0;
      z-index: 9999;
    }
    .error-message {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      padding: 16px;
      font-family: monospace;
      white-space: pre-wrap;
      max-width: 100%;
      overflow-x: auto;
    }
    .loading {
      color: #a1a1aa;
      font-size: 14px;
    }
    /* Icon stub styling */
    .icon-stub {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1em;
      height: 1em;
      font-size: 16px;
    }
    /* ── Always-On Interactive Selector ───────────── */
    .forge-interactive-hover {
      box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
      cursor: pointer !important;
    }
    .forge-interactive-selected {
      box-shadow: inset 0 0 0 2px rgba(59, 130, 246, 1) !important;
    }
    /* ── Inspector Mode Styles ────────────────────────── */
    #inspector-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 99998;
      display: none;
    }
    #inspector-overlay.active {
      display: block;
    }
    #inspector-margin-box {
      position: absolute;
      background: rgba(246, 178, 107, 0.25);
      pointer-events: none;
    }
    #inspector-border-box {
      position: absolute;
      background: rgba(255, 213, 79, 0.35);
      pointer-events: none;
    }
    #inspector-padding-box {
      position: absolute;
      background: rgba(130, 202, 156, 0.35);
      pointer-events: none;
    }
    #inspector-content-box {
      position: absolute;
      background: rgba(111, 168, 220, 0.35);
      pointer-events: none;
    }
    #inspector-tooltip {
      position: fixed;
      background: #1e1e2e;
      color: #cdd6f4;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #45475a;
      pointer-events: none;
      z-index: 99999;
      display: none;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    #inspector-tooltip .tag-name {
      color: #cba6f7;
      font-weight: 600;
    }
    #inspector-tooltip .class-name {
      color: #89b4fa;
    }
    #inspector-tooltip .dimensions {
      color: #a6adc8;
      margin-left: 6px;
    }
    body.inspector-active * {
      cursor: crosshair !important;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="forge-portal-root"></div>
  
  <!-- Inspector overlay layers -->
  <div id="inspector-overlay">
    <div id="inspector-margin-box"></div>
    <div id="inspector-border-box"></div>
    <div id="inspector-padding-box"></div>
    <div id="inspector-content-box"></div>
  </div>
  <div id="inspector-tooltip"></div>
  
  <script>
    // Current component and props
    let currentComponent = null;
    let currentProps = {};
    let currentWrapper = null;
    let currentStyleOverrides = {}; // Style overrides from panel
    let currentOverrideSelector = ''; // CSS selector for overrides
    let currentShowcaseRender = null; // Showcase render function for compound components
    let reactRoot = null; // Cache the React root
    let currentComponentCSS = ''; // Raw CSS for forceState pseudo-class simulation
    let currentForceState = 'default'; // Current forced pseudo-state
    let previousComponentGlobals = []; // D2: Keys added by previous component's eval()
    
    // Create a placeholder icon element for ReactNode props (leftIcon, rightIcon, etc.)
    // Uses a FILLED SVG shape so it's visible at any size (stroked SVGs become invisible at small sizes)
    function createPlaceholderIcon() {
      return React.createElement('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '1em', height: '1em', viewBox: '0 0 24 24',
        fill: 'currentColor', stroke: 'none',
        style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }
      },
        // Filled star shape — always visible regardless of size
        React.createElement('path', { d: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' })
      );
    }
    
    // Process props: convert placeholder markers to React elements, strip nulls
    function processProps(rawProps) {
      var processed = {};
      for (var key in rawProps) {
        if (rawProps[key] === null || rawProps[key] === undefined) continue;
        if (rawProps[key] === '\u2b21') {
          // Convert icon marker to a visible filled SVG placeholder
          processed[key] = createPlaceholderIcon();
        } else if (rawProps[key] === '__CALLBACK_STUB__') {
          // Phase 7A: Convert callback stub marker to a real no-op function
          // so components can safely call onClose(), onDismiss(), etc.
          processed[key] = function() {};
        } else {
          processed[key] = rawProps[key];
        }
      }
      return processed;
    }
    
    // ── Shared styles extraction ─────────────────────────────────
    var STYLES_TO_EXTRACT = [
      'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'gap',
      'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
      'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform',
      'color', 'backgroundColor', 'borderColor', 'borderWidth', 'borderRadius', 'borderStyle',
      'opacity', 'boxShadow', 'overflow', 'cursor', 'position', 'top', 'right', 'bottom', 'left', 'zIndex',
    ];
    
    // Extract computed styles and report selector to parent.
    // Returns true if extraction succeeded, false if element not yet ready.
    function extractAndReportStyles() {
      var rootEl = document.getElementById('root');
      var componentEl = rootEl.querySelector('[data-forge-root]') || rootEl.firstElementChild;
      
      // Fallback for Modals/Portals that render directly to document.body
      if (!componentEl) {
         var bodyChildren = document.body.children;
         for (var i = bodyChildren.length - 1; i >= 0; i--) {
            var child = bodyChildren[i];
            // Skip scripts, styles, the root div itself, and inspector UI overlay/tooltips
            if (child.tagName === 'DIV' && child.id !== 'root' && child.id !== 'inspector-overlay' && !child.id.startsWith('inspector-')) {
               componentEl = child;
               break;
            }
         }
      }

      if (!componentEl) return false;
      
      // Report the actual CSS class selector to the parent
      var classes = (typeof componentEl.className === 'string' ? componentEl.className : '').trim().split(/\\s+/).filter(Boolean);
      if (classes.length > 0) {
        parent.postMessage({
          type: 'COMPONENT_ROOT_SELECTOR',
          selector: '.' + classes.join('.')
        }, '*');
      }
      
      // Extract computed styles
      var computed = window.getComputedStyle(componentEl);
      var styles = {};
      STYLES_TO_EXTRACT.forEach(function(prop) {
        styles[prop] = computed.getPropertyValue(
          prop.replace(/([A-Z])/g, '-$1').toLowerCase()
        );
      });
      parent.postMessage({ type: 'COMPUTED_STYLES', styles: styles }, '*');
      return true;
    }
    
    // D6: Extract computed styles for a specific sub-element by CSS selector
    function extractSubElementStyles(subSelector) {
      var rootEl = document.getElementById('root');
      if (!rootEl) return;
      var el = rootEl.querySelector(subSelector);
      if (!el) {
        console.log('[Sandbox] Sub-element not found:', subSelector);
        return;
      }
      var computed = window.getComputedStyle(el);
      var styles = {};
      STYLES_TO_EXTRACT.forEach(function(prop) {
        styles[prop] = computed.getPropertyValue(
          prop.replace(/([A-Z])/g, '-$1').toLowerCase()
        );
      });
      parent.postMessage({ type: 'COMPUTED_STYLES', styles: styles, subSelector: subSelector }, '*');
    }
    
    // Try extraction with rAF + exponential backoff retry (up to 5 attempts)
    function scheduleStyleExtraction() {
      var attempts = 0;
      function tryExtract() {
        requestAnimationFrame(function() {
          if (!extractAndReportStyles() && attempts < 5) {
            attempts++;
            setTimeout(tryExtract, 100 * attempts);
          }
        });
      }
      tryExtract();
    }
    
    // Render the component with current props
    function renderComponent() {
      const rootEl = document.getElementById('root');
      
      if (!currentComponent) {
        rootEl.innerHTML = '';
        return;
      }
      
      try {
        // Process props: convert icon markers to elements, strip nulls
        var resolvedProps = processProps(currentProps);
        
        // Extract children from props - React.createElement needs it as 3rd arg
        var children = resolvedProps.children;
        var propsWithoutChildren = Object.assign({}, resolvedProps);
        delete propsWithoutChildren.children;
        
        // Style overrides are now applied via CSS injection (#override-styles)
        // instead of inline style prop to work with all components
        
        // If we have a showcase render function, use it (compound components)
        // Otherwise fall back to simple React.createElement
        var element;
        if (currentShowcaseRender) {
          try {
            element = React.createElement(currentShowcaseRender, propsWithoutChildren);
            console.log('[Sandbox] Rendered via showcase function');
          } catch (scErr) {
            console.warn('[Sandbox] Showcase render failed, falling back:', scErr.message);
            element = children !== undefined
              ? React.createElement(currentComponent, propsWithoutChildren, children)
              : React.createElement(currentComponent, propsWithoutChildren);
          }
        } else {
          // Simple component: createElement with props
          element = children !== undefined
            ? React.createElement(currentComponent, propsWithoutChildren, children)
            : React.createElement(currentComponent, propsWithoutChildren);
        }
        
        // Phase 7C: Wrap with context provider if specified
        if (currentWrapper && window[currentWrapper]) {
           const WrapperComponent = window[currentWrapper];
           console.log('[Sandbox] Wrapping component with', currentWrapper);
           element = React.createElement(WrapperComponent, null, element);
        }
        
        // Create root only once, then reuse it
        if (!reactRoot) {
          rootEl.innerHTML = ''; // Clear loading message before first render
          reactRoot = ReactDOM.createRoot(rootEl);
        }
        
        reactRoot.render(element);
        
        // After render, extract computed styles using rAF + retry
        scheduleStyleExtraction();
        
        // Notify parent of successful render
        parent.postMessage({ type: 'RENDER_SUCCESS' }, '*');
      } catch (error) {
        console.error('[Sandbox] Render error:', error);
        rootEl.innerHTML = '<div class="error-message">Render Error: ' + error.message + '</div>';
        parent.postMessage({ type: 'RENDER_ERROR', error: error.message }, '*');
      }
    }
    
    // Handle messages from parent
    window.addEventListener('message', (event) => {
      const { type, code, css, props, defaultProps, componentName,
              componentType, wrapperStyle, disableAnimations, elementProps, wrapper } = event.data;
      
      switch (type) {
        case 'LOAD_COMPONENT':
          try {
            console.log('[Sandbox] LOAD_COMPONENT received:', componentName, 'props:', props, 'wrapper:', wrapper);
            currentWrapper = wrapper || null;
            
            // IMPORTANT: Reset React root when loading a new component
            // This ensures the previous component is fully unmounted
            if (reactRoot) {
              try {
                reactRoot.unmount();
              } catch (e) {
                console.warn('[Sandbox] Error unmounting previous root:', e);
              }
              reactRoot = null;
            }
            
            // Clear the root element
            const rootEl = document.getElementById('root');
            rootEl.innerHTML = '<div class="loading">Loading ' + componentName + '...</div>';
            
            // Fix 4: Clear leftover force-state styles from previous component
            var stateEl = document.getElementById('state-styles');
            if (stateEl) stateEl.textContent = '';
            currentForceState = 'default';
            
            // Fix B2: Clear leftover style overrides from previous component
            var overrideEl = document.getElementById('override-styles');
            if (overrideEl) overrideEl.textContent = '';
            
            // D2: Clean up globals from previous component to prevent variable leaks
            if (previousComponentGlobals.length > 0) {
              for (var g = 0; g < previousComponentGlobals.length; g++) {
                try { delete window[previousComponentGlobals[g]]; } catch(e) {}
              }
              previousComponentGlobals = [];
            }
            
            // Inject component CSS
            document.getElementById('component-styles').textContent = css || '';
            
            // Execute the compiled code (includes component + showcase in same scope)
            // The code defines window.__PreviewComponent__ and optionally window.__showcaseRender__
            console.log('[Sandbox] Executing compiled code...');
            // IMPORTANT: Clear previous showcase before eval — prevents stale showcase
            // from leaking into the next component's typeof check
            window.__showcaseRender__ = null;
            
            // D2: Snapshot globals before eval to track what gets added
            var preEvalKeys = new Set(Object.keys(window));
            eval(code);
            // D2: Record new globals so we can clean them up on next load
            var postEvalKeys = Object.keys(window);
            previousComponentGlobals = postEvalKeys.filter(function(k) { return !preEvalKeys.has(k); });
            
            currentComponent = window.__PreviewComponent__;
            currentShowcaseRender = window.__showcaseRender__ || null;
            console.log('[Sandbox] __PreviewComponent__ =', currentComponent ? 'FOUND' : 'NOT FOUND');
            if (currentShowcaseRender) {
              console.log('[Sandbox] Showcase render function found for', componentName);
            }
            
            // Also check for the component by name on window
            if (!currentComponent && window[componentName]) {
              currentComponent = window[componentName];
              console.log('[Sandbox] Found component on window.' + componentName);
            }
            
            // Note: window.__createIcon__ is now exposed directly from import stubs
            // (set at end of createImportStubs output, evaluated as part of the bundle)
            
            // Merge default props with user props (user props take precedence)
            var evaledDefaults = {};
            try {
              evaledDefaults = eval('(' + (defaultProps || '{}') + ')');
              console.log('[Sandbox] Default props:', evaledDefaults);
            } catch (e) {
              console.warn('[Sandbox] Could not eval default props:', e);
            }
            
            // Filter out undefined/null values so component defaults apply
            var filteredProps = props || {};
            var cleanProps = {};
            for (var key in filteredProps) {
              if (filteredProps[key] !== undefined && filteredProps[key] !== null) {
                cleanProps[key] = filteredProps[key];
              }
            }
            
            // Include the variant and size from props
            currentProps = Object.assign({}, evaledDefaults, cleanProps);
            console.log('[Sandbox] Final props:', currentProps);
            
            if (currentComponent) {
              // Phase 7A: Apply per-component metadata before rendering
              var rootEl2 = document.getElementById('root');
              
              // Note: componentType layout handling removed — the default centered
              // flexbox on the iframe body works for all types. Per-component layout
              // can be configured via wrapperStyle in forgecore.json instead.
              
              // Apply wrapperStyle from forgecore preview config
              if (wrapperStyle && typeof wrapperStyle === 'object') {
                for (var wk in wrapperStyle) {
                  rootEl2.style[wk] = wrapperStyle[wk];
                }
              }
              
              // Apply disableAnimations: inject CSS to kill all transitions/animations
              var animStyleEl = document.getElementById('state-styles');
              if (disableAnimations) {
                var disableCSS = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }';
                // Prepend to state-styles (won't conflict — state-styles is cleared on new load)
                animStyleEl.textContent = disableCSS + '\\n' + (animStyleEl.textContent || '');
              }
              
              // Store elementProps for processProps to use (phase 7A)
              window.__currentElementProps__ = elementProps || [];
              
              console.log('[Sandbox] Calling renderComponent()');
              renderComponent();
            } else {
              var errMsg = 'Component not found: ' + componentName + '. Available: ' + Object.keys(window).filter(k => typeof window[k] === 'function').slice(0,10).join(', ');
              console.error('[Sandbox]', errMsg);
              document.getElementById('root').innerHTML = 
                '<div class="error-message">' + errMsg + '</div>';
              parent.postMessage({ type: 'LOAD_ERROR', error: errMsg }, '*');
            }
          } catch (error) {
            console.error('[Sandbox] Load error:', error);
            document.getElementById('root').innerHTML = 
              '<div class="error-message">Load Error: ' + error.message + '</div>';
            parent.postMessage({ type: 'LOAD_ERROR', error: error.message }, '*');
          }
          break;
          
        case 'UPDATE_PROPS':
          // Full replacement: parent always sends complete props state
          // null values represent removed props (stripped in processProps)
          currentProps = Object.assign({}, props || {});
          renderComponent();
          break;
          
        case 'APPLY_STYLE_OVERRIDES':
          // Support overrideGroups array (sub-element overrides) or legacy single selector
          var groups = event.data.overrideGroups || [];
          // Backward compat: single selector/overrides
          if (!groups.length && event.data.selector) {
            groups = [{ selector: event.data.selector, overrides: event.data.overrides || {} }];
          }
          console.log('[Sandbox] Style override groups:', groups.length);
          var overrideEl = document.getElementById('override-styles');
          if (overrideEl) {
            var allRules = [];
            for (var g = 0; g < groups.length; g++) {
              var grpSelector = groups[g].selector;
              var grpOverrides = groups[g].overrides || {};
              var cssRules = [];
              for (var prop in grpOverrides) {
                var kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
                cssRules.push('  ' + kebab + ': ' + grpOverrides[prop] + ' !important;');
              }
              if (cssRules.length > 0) {
                allRules.push(grpSelector + ' {' + '\\n' + cssRules.join('\\n') + '\\n' + '}');
              }
            }
            overrideEl.textContent = allRules.join('\\n\\n');
            console.log('[Sandbox] Override CSS set (' + allRules.length + ' rules, ' + overrideEl.textContent.length + ' chars):', overrideEl.textContent.substring(0, 200));
          }
          // Re-extract computed styles so the panel reflects override values
          requestAnimationFrame(function() { extractAndReportStyles(); });
          break;
          
        case 'UPDATE_CSS':
          document.getElementById('component-styles').textContent = event.data.css || '';
          currentComponentCSS = event.data.css || '';
          // Re-apply force state if active (new CSS may have different pseudo rules)
          if (currentForceState !== 'default') {
            applyForceState(currentForceState, currentComponentCSS);
          }
          // F7: Re-extract computed styles so the panel reflects updated CSS values
          requestAnimationFrame(function() { extractAndReportStyles(); });
          break;
          
        case 'UPDATE_THEME_CSS':
          document.getElementById('theme-styles').textContent = event.data.themeCSS || '';
          // Re-render so CSS variables resolve with updated theme
          if (currentComponent) renderComponent();
          break;
          
        case 'SET_THEME':
          // Phase 7D: Apply theme attribute or class to the requested element
          var targetEl = document.documentElement; // Default to <html>
          if (event.data.applyTo === 'body') {
            targetEl = document.body;
          } else if (event.data.applyTo === 'root') {
             targetEl = document.getElementById('root');
          }
          
          if (event.data.strategy === 'class') {
            // Remove previous theme classes (simple heuristic: remove any class matching the theme list)
            if (event.data.values) {
              event.data.values.forEach(v => targetEl.classList.remove(v));
            }
            targetEl.classList.add(event.data.theme);
          } else {
            // Strategy: attribute
            var attr = event.data.attribute || 'data-theme';
            targetEl.setAttribute(attr, event.data.theme);
          }
          
          console.log('[Sandbox] Theme applied:', event.data.theme, 'strategy:', event.data.strategy);
          // Re-extract styles since CSS variables probably changed
          requestAnimationFrame(function() { extractAndReportStyles(); });
          break;
          
        case 'FORCE_STATE':
          // Simulate pseudo-state by duplicating :pseudo CSS rules as regular rules
          var forceState = event.data.state || 'default';
          currentForceState = forceState;
          currentComponentCSS = event.data.componentCSS || currentComponentCSS;
          applyForceState(forceState, currentComponentCSS);
          break;
          
        case 'REQUEST_STYLES':
          // E2: Re-extract root styles (used when switching back from sub-element view)
          extractAndReportStyles();
          break;
          
        case 'REQUEST_SUB_STYLES':
          // D6: Extract computed styles for a specific sub-element
          if (event.data.subSelector) {
            extractSubElementStyles(event.data.subSelector);
          }
          break;
          
        case 'SET_LAYOUT':
          // E4: Apply body layout class based on previewConfig
          var layoutMode = event.data.layout || 'center';
          document.body.classList.remove('layout-stretch', 'layout-natural');
          if (layoutMode === 'stretch') {
            document.body.classList.add('layout-stretch');
          } else if (layoutMode === 'natural') {
            document.body.classList.add('layout-natural');
          }
          // Re-render to reflect layout change
          if (currentComponent) renderComponent();
          break;
          
        // ── Interactive Selector ────────────────────────────────
        case 'UPDATE_INTERACTIVE_STATE':
          updateInteractiveState(event.data.subElements || [], event.data.selectedSubElement || null, event.data.enabled);
          break;
          
        // ── Inspector Mode ──────────────────────────────────────
        case 'ENABLE_INSPECTOR':
          enableInspector();
          break;
        case 'DISABLE_INSPECTOR':
          disableInspector();
          break;
      }
    });
    
    // ── Inspector Mode Implementation ──────────────────────────
    var inspectorEnabled = false;
    var inspectorHoveredEl = null;
    
    function enableInspector() {
      if (inspectorEnabled) return;
      inspectorEnabled = true;
      document.body.classList.add('inspector-active');
      document.getElementById('inspector-overlay').classList.add('active');
      document.addEventListener('mousemove', inspectorMouseMove, true);
      document.addEventListener('click', inspectorClick, true);
      document.addEventListener('mouseout', inspectorMouseOut, true);
      console.log('[Sandbox] Inspector enabled');
    }
    
    function disableInspector() {
      if (!inspectorEnabled) return;
      inspectorEnabled = false;
      inspectorHoveredEl = null;
      document.body.classList.remove('inspector-active');
      document.getElementById('inspector-overlay').classList.remove('active');
      document.getElementById('inspector-tooltip').style.display = 'none';
      document.removeEventListener('mousemove', inspectorMouseMove, true);
      document.removeEventListener('click', inspectorClick, true);
      document.removeEventListener('mouseout', inspectorMouseOut, true);
      console.log('[Sandbox] Inspector disabled');
    }
    
    function inspectorMouseMove(e) {
      if (!inspectorEnabled) return;
      var el = document.elementFromPoint(e.clientX, e.clientY);
      // Skip inspector overlay elements, body, html, #root itself
      if (!el || el.id === 'inspector-overlay' || el.id === 'inspector-tooltip'
          || el.id === 'inspector-margin-box' || el.id === 'inspector-border-box'
          || el.id === 'inspector-padding-box' || el.id === 'inspector-content-box'
          || el === document.body || el === document.documentElement) {
        return;
      }
      if (el === inspectorHoveredEl) return;
      inspectorHoveredEl = el;
      drawInspectorOverlay(el);
      drawInspectorTooltip(el, e.clientX, e.clientY);
    }
    
    function inspectorMouseOut(e) {
      if (!inspectorEnabled) return;
      // Hide when cursor leaves the iframe viewport
      if (e.relatedTarget === null || e.relatedTarget === document.documentElement) {
        inspectorHoveredEl = null;
        hideInspectorOverlay();
      }
    }
    
    function inspectorClick(e) {
      if (!inspectorEnabled || !inspectorHoveredEl) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      var el = inspectorHoveredEl;
      var computed = window.getComputedStyle(el);
      var styles = {};
      STYLES_TO_EXTRACT.forEach(function(prop) {
        styles[prop] = computed.getPropertyValue(
          prop.replace(/([A-Z])/g, '-$1').toLowerCase()
        );
      });
      
      // Build element info
      var tagName = el.tagName.toLowerCase();
      var classList = (typeof el.className === 'string' ? el.className : '').trim();
      var rect = el.getBoundingClientRect();
      
      parent.postMessage({
        type: 'INSPECTOR_SELECT',
        styles: styles,
        elementInfo: {
          tagName: tagName,
          className: classList,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      }, '*');
      
      console.log('[Sandbox] Inspector selected:', tagName + '.' + classList.split(' ').join('.'));
    }
    
    // ── Interactive Selector Implementation ────────────────────
    var activeSubElements = [];
    var activeSelectedSubElement = null;
    var currentInteractiveHoverEl = null;
    var interactiveEnabled = true;
    
    function updateInteractiveState(subElements, selectedSubElement, enabled) {
      activeSubElements = subElements || [];
      activeSelectedSubElement = selectedSubElement;
      interactiveEnabled = enabled !== undefined ? enabled : true;
      
      // Setup listeners if not already done
      if (!window.__interactiveListenersSetup) {
        document.addEventListener('mousemove', handleInteractiveMouseMove, true);
        document.addEventListener('click', handleInteractiveClick, true);
        document.addEventListener('mouseout', handleInteractiveMouseOut, true);
        window.__interactiveListenersSetup = true;
      }
      
      refreshInteractiveStyles();
    }
    
    function refreshInteractiveStyles() {
      // Clear all existing interact styles
      var els = document.querySelectorAll('.forge-interactive-selected, .forge-interactive-hover');
      for (var i = 0; i < els.length; i++) {
        els[i].classList.remove('forge-interactive-selected', 'forge-interactive-hover');
      }
      
      // Apply selected style
      if (activeSelectedSubElement) {
        // Find element matching the class, removing the leading dot
        var className = activeSelectedSubElement.startsWith('.') ? activeSelectedSubElement.substring(1) : activeSelectedSubElement;
        if (className) {
           var targetEl = document.querySelector('.' + className);
           if (targetEl) {
             targetEl.classList.add('forge-interactive-selected');
           }
        }
      }
      
      // Re-apply hover if mouse is still on it
      if (currentInteractiveHoverEl) {
         currentInteractiveHoverEl.classList.add('forge-interactive-hover');
      }
    }
    
    function findMatchingSubElement(el) {
       if (!el || !el.classList) return null;
       for (var i = 0; i < activeSubElements.length; i++) {
         var subClass = activeSubElements[i].startsWith('.') ? activeSubElements[i].substring(1) : activeSubElements[i];
         // G5: Handle mangled class names by checking if the element's classes contain our target subClass
         // e.g. el.className = "Button_label__123", subClass = "label"
         for (var j = 0; j < el.classList.length; j++) {
           if (el.classList[j].includes(subClass)) {
             return activeSubElements[i]; // Return original format, e.g., ".label"
           }
         }
       }
       return null;
    }
    
    function handleInteractiveMouseMove(e) {
      if (inspectorEnabled || activeSubElements.length === 0 || !interactiveEnabled) return;
      
      var el = document.elementFromPoint(e.clientX, e.clientY);
      // We want to find the first ancestor that matches a sub-element class
      var matchedEl = null;
      var currentCheck = el;
      while (currentCheck && currentCheck !== document.documentElement && currentCheck !== document.body) {
        if (findMatchingSubElement(currentCheck)) {
           matchedEl = currentCheck;
           break;
        }
        currentCheck = currentCheck.parentElement;
      }
      
      if (matchedEl !== currentInteractiveHoverEl) {
         if (currentInteractiveHoverEl) {
            currentInteractiveHoverEl.classList.remove('forge-interactive-hover');
         }
         currentInteractiveHoverEl = matchedEl;
         if (currentInteractiveHoverEl) {
             currentInteractiveHoverEl.classList.add('forge-interactive-hover');
         }
      }
    }
    
    function handleInteractiveMouseOut(e) {
       if (inspectorEnabled || activeSubElements.length === 0 || !interactiveEnabled) return;
       // We only clear hover if leaving the document
       if (e.relatedTarget === null || e.relatedTarget === document.documentElement) {
          if (currentInteractiveHoverEl) {
            currentInteractiveHoverEl.classList.remove('forge-interactive-hover');
            currentInteractiveHoverEl = null;
          }
       }
    }
    
    function handleInteractiveClick(e) {
       if (inspectorEnabled || activeSubElements.length === 0 || !interactiveEnabled) return;
       
       if (currentInteractiveHoverEl) {
          e.preventDefault();
          e.stopPropagation();
          var matchedSubElement = findMatchingSubElement(currentInteractiveHoverEl);
          console.log('[Sandbox] Interactive Click target:', currentInteractiveHoverEl, 'matched:', matchedSubElement);
          if (matchedSubElement) {
             parent.postMessage({
               type: 'INTERACTIVE_SELECT',
               subElement: matchedSubElement
             }, '*');
          }
       } else {
          // If clicked outside any sub-element, clear selection by sending null/main
          parent.postMessage({
            type: 'INTERACTIVE_SELECT',
            subElement: '__main__'
          }, '*');
       }
    }
    
    function drawInspectorOverlay(el) {
      var rect = el.getBoundingClientRect();
      var computed = window.getComputedStyle(el);
      
      var pt = parseFloat(computed.paddingTop) || 0;
      var pr = parseFloat(computed.paddingRight) || 0;
      var pb = parseFloat(computed.paddingBottom) || 0;
      var pl = parseFloat(computed.paddingLeft) || 0;
      
      var bt = parseFloat(computed.borderTopWidth) || 0;
      var br_ = parseFloat(computed.borderRightWidth) || 0;
      var bb = parseFloat(computed.borderBottomWidth) || 0;
      var bl = parseFloat(computed.borderLeftWidth) || 0;
      
      var mt = parseFloat(computed.marginTop) || 0;
      var mr = parseFloat(computed.marginRight) || 0;
      var mb = parseFloat(computed.marginBottom) || 0;
      var ml = parseFloat(computed.marginLeft) || 0;
      
      // Margin box (outermost)
      var marginBox = document.getElementById('inspector-margin-box');
      marginBox.style.left = (rect.left - ml) + 'px';
      marginBox.style.top = (rect.top - mt) + 'px';
      marginBox.style.width = (rect.width + ml + mr) + 'px';
      marginBox.style.height = (rect.height + mt + mb) + 'px';
      
      // Border box
      var borderBox = document.getElementById('inspector-border-box');
      borderBox.style.left = rect.left + 'px';
      borderBox.style.top = rect.top + 'px';
      borderBox.style.width = rect.width + 'px';
      borderBox.style.height = rect.height + 'px';
      
      // Padding box (inside border)
      var paddingBox = document.getElementById('inspector-padding-box');
      paddingBox.style.left = (rect.left + bl) + 'px';
      paddingBox.style.top = (rect.top + bt) + 'px';
      paddingBox.style.width = (rect.width - bl - br_) + 'px';
      paddingBox.style.height = (rect.height - bt - bb) + 'px';
      
      // Content box (innermost)
      var contentBox = document.getElementById('inspector-content-box');
      contentBox.style.left = (rect.left + bl + pl) + 'px';
      contentBox.style.top = (rect.top + bt + pt) + 'px';
      contentBox.style.width = (rect.width - bl - br_ - pl - pr) + 'px';
      contentBox.style.height = (rect.height - bt - bb - pt - pb) + 'px';
    }
    
    function drawInspectorTooltip(el, mouseX, mouseY) {
      var tooltip = document.getElementById('inspector-tooltip');
      var tagName = el.tagName.toLowerCase();
      var classList = (typeof el.className === 'string' ? el.className : '').trim();
      var rect = el.getBoundingClientRect();
      
      // Build display: truncate long class names
      var classDisplay = '';
      if (classList) {
        var classes = classList.split(/\\s+/).slice(0, 2);
        classDisplay = '.' + classes.join('.');
        if (classList.split(/\\s+/).length > 2) classDisplay += '…';
      }
      
      tooltip.innerHTML = '<span class="tag-name">' + tagName + '</span>'
        + (classDisplay ? '<span class="class-name">' + classDisplay + '</span>' : '')
        + '<span class="dimensions">' + Math.round(rect.width) + ' × ' + Math.round(rect.height) + '</span>';
      
      tooltip.style.display = 'block';
      
      // Position tooltip near cursor, but keep within viewport
      var tx = mouseX + 12;
      var ty = mouseY + 12;
      var tw = tooltip.offsetWidth;
      var th = tooltip.offsetHeight;
      if (tx + tw > window.innerWidth - 8) tx = mouseX - tw - 8;
      if (ty + th > window.innerHeight - 8) ty = mouseY - th - 8;
      if (tx < 4) tx = 4;
      if (ty < 4) ty = 4;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
    }
    
    function hideInspectorOverlay() {
      document.getElementById('inspector-tooltip').style.display = 'none';
      var ids = ['inspector-margin-box', 'inspector-border-box', 'inspector-padding-box', 'inspector-content-box'];
      for (var i = 0; i < ids.length; i++) {
        var box = document.getElementById(ids[i]);
        box.style.width = '0';
        box.style.height = '0';
      }
    }
    
    // ── Force State simulation ──────────────────────────────────
    // Uses the CSSOM API to find rules with :pseudo selectors and duplicates them
    // as regular rules with !important. This correctly handles @media, @supports,
    // nested selectors and avoids brittle regex parsing.
    function applyForceState(state, componentCSS) {
      var stateEl = document.getElementById('state-styles');
      if (!stateEl) {
        stateEl = document.createElement('style');
        stateEl.id = 'state-styles';
        document.head.appendChild(stateEl);
      }
      
      if (state === 'default' || !componentCSS) {
        stateEl.textContent = '';
        // Re-extract styles for default state
        requestAnimationFrame(function() { extractAndReportStyles(); });
        return;
      }
      
      var pseudo = ':' + state;
      var rules = [];
      
      // Use CSSOM: iterate #component-styles sheet for accurate parsing
      var compStyleEl = document.getElementById('component-styles');
      if (compStyleEl && compStyleEl.sheet) {
        collectPseudoRules(compStyleEl.sheet.cssRules, pseudo, rules);
      }
      
      // Also check #theme-styles for theme-level pseudo rules
      var themeStyleEl = document.getElementById('theme-styles');
      if (themeStyleEl && themeStyleEl.sheet) {
        collectPseudoRules(themeStyleEl.sheet.cssRules, pseudo, rules);
      }

      // For disabled state, also set the disabled attribute on interactive elements
      var rootEl = document.getElementById('root');
      var componentEl = rootEl ? (rootEl.querySelector('[data-forge-root]') || rootEl.firstElementChild) : null;
      if (componentEl) {
        if (state === 'disabled') {
          componentEl.setAttribute('disabled', '');
          componentEl.setAttribute('aria-disabled', 'true');
          // Also disable inner form elements if root is a wrapper (e.g., div wrapping a button)
          var formEls = componentEl.querySelectorAll('button, input, select, textarea');
          for (var f = 0; f < formEls.length; f++) {
            formEls[f].setAttribute('disabled', '');
            formEls[f].setAttribute('aria-disabled', 'true');
          }
        } else {
          componentEl.removeAttribute('disabled');
          componentEl.removeAttribute('aria-disabled');
          var formEls = componentEl.querySelectorAll('[disabled]');
          for (var f = 0; f < formEls.length; f++) {
            formEls[f].removeAttribute('disabled');
            formEls[f].removeAttribute('aria-disabled');
          }
        }
      }
      
      stateEl.textContent = rules.join('\\n');
      console.log('[Sandbox] Force state:', state, '- injected', rules.length, 'rules');
      
      // Re-extract computed styles to reflect the forced state
      requestAnimationFrame(function() { extractAndReportStyles(); });
    }
    
    // Recursively collect rules matching a pseudo-class from a CSSRuleList.
    // Handles nested @media/@supports by descending into their cssRules.
    function collectPseudoRules(cssRules, pseudo, out) {
      if (!cssRules) return;
      for (var i = 0; i < cssRules.length; i++) {
        var rule = cssRules[i];
        // CSSStyleRule (type 1) — has a selectorText
        if (rule.type === 1 && rule.selectorText && rule.selectorText.indexOf(pseudo) >= 0) {
          // Handle comma-separated selectors: only re-emit those containing the pseudo
          var parts = rule.selectorText.split(',');
          var matching = [];
          for (var p = 0; p < parts.length; p++) {
            var part = parts[p].trim();
            if (part.indexOf(pseudo) >= 0) {
              // Remove the pseudo-class so the rule applies unconditionally
              matching.push(part.replace(new RegExp(':' + pseudo.substring(1), 'g'), ''));
            }
          }
          if (matching.length > 0) {
            // Re-emit with !important on each property
            var body = rule.style.cssText.replace(/;/g, ' !important;');
            out.push(matching.join(', ') + ' { ' + body + ' }');
          }
        }
        // CSSMediaRule (type 4), CSSSupportsRule (type 12) — recurse into nested rules
        else if (rule.cssRules) {
          var nested = [];
          collectPseudoRules(rule.cssRules, pseudo, nested);
          if (nested.length > 0) {
            // Wrap re-emitted rules in the same @-block
            out.push(rule.cssText.substring(0, rule.cssText.indexOf('{') + 1)
              + '\\n' + nested.join('\\n') + '\\n}');
          }
        }
      }
    }
    
    // Notify parent that iframe is ready
    parent.postMessage({ type: 'SANDBOX_READY' }, '*');
  </script>
</body>
</html>
`;
}
