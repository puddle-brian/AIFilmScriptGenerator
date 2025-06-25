# Enhanced Template Selection UX Specification

## Problem Statement

**Current Issue**: Template selection (Step 2) provides insufficient information for informed decision-making. Users select narrative architecture without seeing the structural blueprint, leading to:
- Uninformed template choices
- Potential project restarts after realizing structure mismatch
- Lack of confidence in template selection
- No understanding of what they're committing to

**Core Insight**: Templates are structural blueprints containing act sequences with editable prompts. Users need to see and optionally customize this structure before proceeding.

## Solution Overview

**"Reveal and Customize" Workflow**: Transform template selection from blind choice to informed architectural review with optional customization.

### Key Features:
1. **Template Gallery → Selected Template + Act Structure View**
2. **Horizontal Act Cards** displaying numbered, titled structural elements
3. **Inline Editability** of act names and prompt descriptions
4. **Visual Differentiation** from vertical Act Generation step
5. **Progressive Disclosure** with hover details and click-to-edit

## UX Flow Specification

### Current Flow:
```
Template Gallery → Click Template → Selected State (title + description only)
```

### Enhanced Flow:
```
Template Gallery → Click Template → Selected Template Card + Horizontal Act Cards → Optional Editing → Proceed
```

## Visual Layout Specification

### Layout Architecture: **Horizontal Design**
- **Rationale**: Differentiates from vertical Act Generation step, maximizes screen real estate
- **Structure**: Template card above, act cards in horizontal scrollable row below

### Template Card (Selected State)
```
┌─────────────────────────────────────────────────────────────────────┐
│ 🎬 Hero's Journey                                     [Edit Template] │
│ Joseph Campbell's monomyth structure following the hero's            │
│ transformative journey through concrete actions and choices          │
│                                                                      │
│ Category: Criterion Patterns                                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Elements:**
- Template name (editable)
- Description (editable) 
- Category badge
- Edit toggle button

### Act Cards Row (Horizontal Scroll)
```
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│ [1] │ │ [2] │ │ [3] │ │ [4] │ │ [5] │ │ [6] │ │ ... │
│ Ord │ │ Call│ │Refus│ │Meet │ │Cross│ │Tests│ │ ... │
│World│ │Adv  │ │Call │ │Ment │ │Thres│ │Ally │ │     │
│     │ │     │ │     │ │     │ │     │ │Enemy│ │     │
│  📝 │ │  📝 │ │  📝 │ │  📝 │ │  📝 │ │  📝 │ │     │
└─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘
```

**Act Card Structure:**
- **Number Badge**: [1], [2], [3]...
- **Act Name**: Truncated, full name on hover
- **Visual Edit Indicator**: Small edit icon (📝)
- **Consistent Size**: Fixed width for visual rhythm

## Data Structure Requirements

### Template Object Structure:
```javascript
{
  "name": "Hero's Journey",
  "description": "Joseph Campbell's monomyth structure...",
  "category": "criterion_patterns",
  "structure": {
    "ordinary_world": {
      "name": "Ordinary World",                    // ← EDITABLE
      "description": "The hero's normal life...",  // ← EDITABLE (key prompt)
      "elements": ["Daily Routine", "Character Behavior"] // ← EDITABLE (advanced)
    }
    // ... more acts
  }
}
```

### Editable Elements:
1. **Template Level**: name, description
2. **Act Level**: name, description (prompt text)
3. **Advanced Level**: elements array (future enhancement)

## Interactive Behaviors

### State Transitions:
1. **Gallery State**: Multiple template cards visible
2. **Selected State**: Single template + act cards revealed
3. **Editing State**: Inline editors activated

### Hover Behaviors:
- **Act Card Hover**: Show tooltip with full act name + description
- **Edit Icon Hover**: Show "Click to edit" tooltip
- **Template Card Hover**: Subtle elevation/shadow

### Click Behaviors:
- **Template Card**: Select template, reveal act cards
- **Act Card**: Enter edit mode for that act
- **Edit Icon**: Toggle edit mode
- **Outside Click**: Save changes, exit edit mode

### Edit Behaviors:
- **Inline Editing**: Click to edit, tab to next field
- **Auto-Save**: Changes saved on blur/tab
- **Visual Feedback**: Border color change during editing
- **Validation**: Prevent empty names/descriptions

## Technical Implementation Notes

### Component Structure:
```
TemplateSelector
├── TemplateGallery (existing)
├── SelectedTemplateView (new)
│   ├── TemplateCard (enhanced)
│   └── ActCardsRow (new)
│       └── ActCard (new)
└── EditableField (new utility)
```

### Data Flow:
1. **Load Templates**: From `/templates/*.json`
2. **Select Template**: Update state, show act cards
3. **Edit Template**: Update template object in memory
4. **Save Changes**: Persist to project context
5. **Proceed**: Continue with modified template

### CSS Considerations:
- **Horizontal Scrolling**: Smooth scroll, grab cursor
- **Responsive Design**: Stack vertically on mobile
- **Edit States**: Clear visual differentiation
- **Accessibility**: Focus management, keyboard navigation

## Success Metrics

### User Experience:
- **Reduced Template Changes**: Users less likely to switch templates mid-project
- **Increased Confidence**: Users understand what they're selecting
- **Faster Decision Making**: Clear structure visualization speeds choice
- **Enhanced Customization**: Power users can tailor templates

### Technical Success:
- **Smooth Interactions**: No lag in editing/scrolling
- **Data Integrity**: Edits properly saved and restored
- **Backward Compatibility**: Existing projects unaffected

## Implementation Phases

### ✅ Phase 1: Core Structure View (COMPLETED)
- ✅ Template card + act cards display
- ✅ Hover tooltips for full information
- ✅ Horizontal scrollable act cards layout
- ✅ Template persistence across navigation
- ✅ Step 2 navigation logic fix

### ✅ Phase 2: Basic Editing (COMPLETED)
- ✅ Inline editing for act names and descriptions
- ✅ Auto-save functionality
- ✅ Visual edit states (green borders, pencil icons)
- ✅ Click-to-toggle editing mode
- ✅ Single-edit-mode (only one card editable at a time)

### 🔄 Phase 3: Visual Polish (IN PROGRESS)
- ⚠️ Template display styling (reverted to functional state)
- 🎯 NEXT: Clean template card design (without breaking functionality)
- 🎯 NEXT: Responsive gallery layout improvements
- 🎯 NEXT: Enhanced act card visual design

### 🔮 Phase 4: Advanced Features (PLANNED)
- Template name/description editing
- Elements array editing
- Custom template creation
- Enhanced animations
- Advanced keyboard shortcuts
- Template sharing/export

## Edge Cases & Considerations

### Data Validation:
- Handle missing template fields gracefully
- Validate edited content (no empty strings)
- Preserve original template structure

### Performance:
- Lazy load act card details
- Debounce edit auto-save
- Optimize horizontal scroll performance

### Accessibility:
- Screen reader support for act cards
- Keyboard navigation through acts
- Focus management during editing

### Mobile Considerations:
- Touch-friendly edit interactions
- Responsive horizontal scroll
- Fallback to vertical layout if needed

## 🎯 Current Status & Next Steps

### What We've Achieved ✅
1. **Full Enhanced Template Selection System**: Users can now see template structure with horizontal act cards
2. **Complete Inline Editing**: Click-to-edit functionality for act names and descriptions with auto-save
3. **Robust State Management**: Template selection persists across navigation, no more lost selections
4. **Navigation Bug Fixes**: Resolved template gallery reappearing issue with proper step 2 logic
5. **Professional UX**: Single-edit mode, visual feedback, responsive design

### Current State ⚠️
- **Functionality**: 100% working - all core features implemented and stable
- **Visual Design**: Functional but not polished (old banner style template display)
- **User Experience**: Excellent - users can select, view, edit, and navigate seamlessly

### 🚨 CRITICAL NEXT STEP: Act Integration Fix
**Priority**: HIGH - Core functionality broken

**Problem**: Template act edits made in Step 2 are not reflected in Step 4 (Acts). Users can edit act descriptions in template cards, but when they navigate to the Acts step, they see the original template descriptions instead of their customized versions.

**Investigation Steps**:
1. **Trace Data Flow**: How does Step 4 (Acts) load and display act information?
2. **Check State Connection**: Does Acts step use `appState.templateData.structure` or fetch fresh from server?
3. **Verify Save Logic**: Are template edits properly updating the correct state structures?

**Implementation Plan**:
1. **Step 1**: Investigate current Acts step data loading logic
2. **Step 2**: Ensure Acts step uses modified `appState.templateData.structure`
3. **Step 3**: Update act display functions to show customized descriptions
4. **Step 4**: Test that changes persist across navigation and saves

**Success Criteria**:
- ✅ Act descriptions edited in Step 2 appear correctly in Step 4
- ✅ Changes persist across navigation and page refreshes
- ✅ Template customizations are preserved in project saves

### Secondary Next Steps 🎯
1. **Template Card Visual Polish**: Update selected template display to clean card design (without breaking functionality)
2. **Gallery Layout Refinements**: Improve responsive behavior and visual consistency
3. **Act Cards Visual Enhancement**: Subtle design improvements for better visual hierarchy

### Long-term Roadmap 🔮
- Template metadata editing (name/description)
- Custom template creation workflow
- Template sharing and export features
- Advanced keyboard navigation
- Enhanced animations and micro-interactions

### Key Learnings 📚
- **Stability First**: Core functionality must be rock-solid before visual polish
- **Incremental Changes**: Small, targeted updates prevent breaking working systems
- **State Management**: Proper navigation logic is crucial for complex multi-step workflows

---

This specification has been successfully implemented as a comprehensive enhanced template selection system, transforming template selection from a blind choice into an informed architectural decision with full customization capabilities. 