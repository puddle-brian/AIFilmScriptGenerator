# Progress Meter Implementation Guide

## Overview
Add radial progress meters next to each step header to show completion progress within each step. The system will provide visual feedback on how much work remains in the current step and update in real-time during batch generation.

## Visual Design Specification

### Component Design
- **Type**: Circular radial progress meter
- **Size**: 40px diameter 
- **Position**: Next to step header text (inline with step number)
- **Content**: Percentage displayed inside circle (e.g., "67%")
- **Animation**: Smooth CSS transition (0.3s ease) for progress changes

### Visual States
- **Empty (0%)**: Light gray ring, "0%" text
- **In Progress (1-99%)**: Accent color fill (matches current step), percentage text
- **Complete (100%)**: Full accent color fill, "100%" text
- **Current Step**: Enhanced glow/brightness when active

## Implementation Phases

### Phase 1: Core Progress Calculation Module
**Goal**: Create self-contained progress calculation system

**Files to Create/Modify**:
- `public/progress-tracker.js` (new file)

**Implementation**:
```javascript
class ProgressTracker {
  static calculateStepProgress(stepNumber, appState) {
    switch(stepNumber) {
      case 1: return this.calculateStoryProgress(appState);
      case 2: return this.calculateTemplateProgress(appState);
      case 3: return this.calculateStructureProgress(appState);
      case 4: return this.calculatePlotPointsProgress(appState);
      case 5: return this.calculateScenesProgress(appState);
      case 6: return this.calculateDialogueProgress(appState);
      case 7: return this.calculateExportProgress(appState);
      default: return 0;
    }
  }
  
  static calculateStoryProgress(appState) {
    // Binary: 0% or 100% based on title + logline
    return (appState.title && appState.logline) ? 100 : 0;
  }
  
  static calculateTemplateProgress(appState) {
    // Binary: 0% or 100% based on template selection
    return appState.selectedTemplate ? 100 : 0;
  }
  
  static calculateStructureProgress(appState) {
    // Based on structure completion
    if (!appState.generatedStructure) return 0;
    const keys = Object.keys(appState.generatedStructure);
    if (keys.length === 0) return 0;
    
    const completedKeys = keys.filter(key => 
      appState.generatedStructure[key] && 
      typeof appState.generatedStructure[key] === 'object' &&
      Object.keys(appState.generatedStructure[key]).length > 0
    );
    
    return Math.round((completedKeys.length / keys.length) * 100);
  }
  
  static calculatePlotPointsProgress(appState) {
    // Based on plot points completion
    if (!appState.plotPoints) return 0;
    const keys = Object.keys(appState.plotPoints);
    if (keys.length === 0) return 0;
    
    const completedKeys = keys.filter(key => 
      appState.plotPoints[key] && 
      appState.plotPoints[key].trim().length > 0
    );
    
    return Math.round((completedKeys.length / keys.length) * 100);
  }
  
  static calculateScenesProgress(appState) {
    // Based on scenes completion
    if (!appState.generatedScenes) return 0;
    const keys = Object.keys(appState.generatedScenes);
    if (keys.length === 0) return 0;
    
    const completedKeys = keys.filter(key => 
      appState.generatedScenes[key] && 
      appState.generatedScenes[key].trim().length > 0
    );
    
    return Math.round((completedKeys.length / keys.length) * 100);
  }
  
  static calculateDialogueProgress(appState) {
    // Based on dialogue completion
    if (!appState.generatedScenes || !appState.dialogue) return 0;
    const sceneKeys = Object.keys(appState.generatedScenes);
    if (sceneKeys.length === 0) return 0;
    
    let dialogueCount = 0;
    sceneKeys.forEach(sceneKey => {
      const dialogueKey = sceneKey.replace('_', '-'); // Handle key format difference
      if (appState.dialogue[dialogueKey] && appState.dialogue[dialogueKey].trim().length > 0) {
        dialogueCount++;
      }
    });
    
    return Math.round((dialogueCount / sceneKeys.length) * 100);
  }
  
  static calculateExportProgress(appState) {
    // Binary: based on export completion
    return appState.hasExported ? 100 : 0;
  }
}
```

**Testing**: Verify calculations work correctly with existing project data

---

### Phase 2: Visual Component Creation
**Goal**: Create the radial progress meter UI component

**Files to Modify**:
- `public/styles.css`

**Implementation**:
```css
/* Progress Meter Styles */
.progress-meter {
  display: inline-block;
  width: 40px;
  height: 40px;
  margin-left: 12px;
  position: relative;
  vertical-align: middle;
}

.progress-meter svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg); /* Start from top */
}

.progress-meter .progress-bg {
  fill: none;
  stroke: #e5e7eb;
  stroke-width: 3;
}

.progress-meter .progress-fill {
  fill: none;
  stroke: var(--accent-color, #3b82f6);
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease;
}

.progress-meter .progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  pointer-events: none;
}

/* Current step enhancement */
.step.current .progress-meter .progress-fill {
  stroke: var(--accent-color, #3b82f6);
  filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.4));
}

/* Completed step styling */
.step.fully-complete .progress-meter .progress-fill {
  stroke: #10b981;
}
```

**HTML Structure**:
```html
<div class="progress-meter">
  <svg viewBox="0 0 40 40">
    <circle class="progress-bg" cx="20" cy="20" r="16"></circle>
    <circle class="progress-fill" cx="20" cy="20" r="16" 
            stroke-dasharray="0 100.48" stroke-dashoffset="0"></circle>
  </svg>
  <div class="progress-text">0%</div>
</div>
```

**Testing**: Create static progress meters with different percentages

---

### Phase 3: Integration with Step Headers
**Goal**: Add progress meters to existing step navigation

**Files to Modify**:
- `public/script.js` (updateStepIndicators function)
- `public/index.html` (if step structure needs modification)

**Implementation**:
```javascript
// Add to updateStepIndicators function
function updateStepIndicators() {
  const steps = document.querySelectorAll('.step');
  
  steps.forEach((step, index) => {
    const stepNumber = index + 1;
    
    // Existing step indicator logic...
    const canNavigate = canNavigateToStep(stepNumber);
    const isFullyComplete = isStepFullyComplete(stepNumber);
    
    // NEW: Progress meter logic
    const progressMeter = step.querySelector('.progress-meter');
    if (progressMeter) {
      updateProgressMeter(progressMeter, stepNumber);
    }
    
    // Existing CSS class logic...
  });
}

function updateProgressMeter(progressMeterElement, stepNumber) {
  const progress = ProgressTracker.calculateStepProgress(stepNumber, appState);
  
  const circle = progressMeterElement.querySelector('.progress-fill');
  const textElement = progressMeterElement.querySelector('.progress-text');
  
  // Calculate stroke-dasharray for circular progress
  const circumference = 2 * Math.PI * 16; // radius = 16
  const progressLength = (progress / 100) * circumference;
  const remainingLength = circumference - progressLength;
  
  circle.style.strokeDasharray = `${progressLength} ${remainingLength}`;
  textElement.textContent = `${progress}%`;
}

// Call updateStepIndicators whenever appState changes
```

**Testing**: Verify progress meters appear and show correct percentages

---

### Phase 4: Real-Time Updates During Generation
**Goal**: Update progress meters during batch generation processes

**Files to Modify**:
- `public/script.js` (generation functions)

**Implementation Strategy**:
```javascript
// Modify existing generation functions to call progress updates

async function generateAllPlotPoints() {
  const keys = Object.keys(appState.generatedStructure);
  let completed = 0;
  
  for (const key of keys) {
    // Existing generation logic...
    await generatePlotPoint(key);
    
    // NEW: Update progress after each completion
    completed++;
    updateProgressMeterForStep(4); // Step 4 = Plot Points
    
    // Optional: Small delay to show progress visually
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function generateAllScenes() {
  const keys = Object.keys(appState.generatedStructure);
  let completed = 0;
  
  for (const key of keys) {
    // Existing generation logic...
    await generateScene(key);
    
    // NEW: Update progress after each completion
    completed++;
    updateProgressMeterForStep(5); // Step 5 = Scenes
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

function updateProgressMeterForStep(stepNumber) {
  const step = document.querySelector(`.step:nth-child(${stepNumber})`);
  const progressMeter = step?.querySelector('.progress-meter');
  if (progressMeter) {
    updateProgressMeter(progressMeter, stepNumber);
  }
}
```

**Testing**: Verify smooth progress updates during batch generation

---

### Phase 5: Polish and Edge Cases
**Goal**: Handle edge cases and add visual polish

**Enhancements**:
1. **Empty State Handling**: Show 0% for completely empty steps
2. **Error State**: Handle calculation errors gracefully
3. **Performance**: Debounce rapid updates if needed
4. **Accessibility**: Add ARIA labels for screen readers
5. **Mobile Responsiveness**: Ensure meters work on small screens

**Files to Modify**:
- `public/script.js` (error handling)
- `public/styles.css` (responsive design)

**Implementation**:
```javascript
// Enhanced error handling
static calculateStepProgress(stepNumber, appState) {
  try {
    // Existing calculation logic...
  } catch (error) {
    console.warn(`Progress calculation error for step ${stepNumber}:`, error);
    return 0; // Fallback to 0% on error
  }
}

// Accessibility enhancement
function createProgressMeter(stepNumber) {
  const progressMeter = document.createElement('div');
  progressMeter.className = 'progress-meter';
  progressMeter.setAttribute('aria-label', `Step ${stepNumber} progress`);
  progressMeter.setAttribute('role', 'progressbar');
  progressMeter.setAttribute('aria-valuemin', '0');
  progressMeter.setAttribute('aria-valuemax', '100');
  
  // SVG and text content...
  
  return progressMeter;
}
```

**Testing**: Test with various project states, empty projects, and error conditions

---

## Success Criteria

### Functional Requirements
- [ ] Progress meters show accurate percentages for all 7 steps
- [ ] Real-time updates during batch generation work smoothly
- [ ] Progress calculations handle edge cases (empty data, errors)
- [ ] Integration doesn't break existing step navigation

### Visual Requirements  
- [ ] Meters are visually consistent with existing design
- [ ] Smooth animations between progress states
- [ ] Clear percentage display inside circles
- [ ] Proper highlighting for current/completed steps

### Performance Requirements
- [ ] No noticeable lag when updating progress
- [ ] Calculations complete quickly (<50ms per step)
- [ ] Smooth animations don't impact generation performance

## Testing Strategy

### Unit Testing
- Test progress calculation functions with various appState configurations
- Verify edge cases (empty objects, missing data, malformed data)
- Test progress meter rendering with different percentages

### Integration Testing  
- Test with real project data from existing projects
- Verify progress updates during actual generation workflows
- Test step navigation still works correctly

### User Experience Testing
- Verify progress meters provide clear feedback about completion status
- Test real-time updates feel responsive and helpful
- Ensure meters don't distract from main workflow

## Rollback Plan
If implementation proves too complex or causes issues:
1. Remove progress meter HTML/CSS
2. Restore original `updateStepIndicators` function
3. Remove `ProgressTracker` class
4. Existing step completion indicators remain functional

## Implementation Notes
- Start with Phase 1 to establish solid calculation foundation
- Test each phase thoroughly before proceeding
- Keep existing step logic intact during integration
- Consider feature flag to enable/disable progress meters during development 