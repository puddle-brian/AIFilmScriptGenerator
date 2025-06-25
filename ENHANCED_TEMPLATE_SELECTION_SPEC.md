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

### Phase 1: Core Structure View
- Template card + act cards display
- Hover tooltips for full information
- No editing functionality yet

### Phase 2: Basic Editing
- Inline editing for act names and descriptions
- Auto-save functionality
- Visual edit states

### Phase 3: Advanced Features
- Template name/description editing
- Elements array editing
- Custom template creation

### Phase 4: Polish
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

---

This specification transforms template selection from a blind choice into an informed architectural decision with optional customization, significantly improving the UX of Step 2 in the story development workflow. 