# Plot Point Distribution System Specification

## Problem Statement

**Current Issue**: The plot point generation system assigns a fixed number of plot points (default 4) to each story act regardless of the act's narrative importance or duration. This creates several problems:

1. **Inconsistent Script Lengths**: Templates with more acts generate longer scripts
   - Save the Cat (15 acts): 60 plot points
   - Three-Act (9 acts): 36 plot points  
   - Hero's Journey (12 acts): 48 plot points
   
2. **Poor Pacing**: All acts receive equal plot point allocation regardless of narrative weight
   - Brief transition moments get same weight as major dramatic sections
   - Setup gets same attention as climax
   - No reflection of actual story rhythm

3. **Template Structure Confusion**: More detailed templates create artificially longer stories

## Solution Overview

**Intelligent Plot Point Distribution**: Implement a system where each template defines percentage-based plot point distribution that reflects realistic narrative pacing and maintains consistent total script length.

### Core Principles:
1. **Fixed Total Plot Points**: All templates generate same total (30-40 plot points)
2. **Template-Specific Distribution**: Each act gets plot points based on narrative importance
3. **Realistic Pacing**: Major dramatic sections receive more development
4. **User Override**: Maintain ability to manually adjust via dropdowns

## Technical Requirements

### Data Structure Enhancement

#### Template Schema Addition
```json
{
  "name": "Template Name",
  "category": "essential",
  "structure": {
    "act_key": {
      "name": "Act Name",
      "description": "Act description",
      "elements": ["element1", "element2"],
      "distribution": {
        "percentage": 15.0,    // Percentage of total plot points
        "plotPoints": 6,       // Calculated from total * percentage
        "narrative_weight": "major" | "minor" | "transition"
      }
    }
  },
  "total_plot_points": 40,      // NEW: Total plot points for this template
  "distribution_philosophy": "Brief description of pacing approach"
}
```

### System Configuration
```javascript
const PLOT_POINT_CONFIG = {
  DEFAULT_TOTAL: 40,           // Default total plot points
  MIN_TOTAL: 30,               // Minimum allowed
  MAX_TOTAL: 60,               // Maximum allowed
  MIN_ACT_POINTS: 1,           // Minimum per act
  ROUNDING_METHOD: 'round'     // How to handle fractional plot points
};
```

## Implementation Phases

### Phase 1: Data Preparation ✅
**Goal**: Add distribution data to all templates

#### Step 1.1: Essential Templates Distribution
- **Save the Cat**: Research Blake Snyder's pacing recommendations
- **Three-Act Structure**: Apply traditional act structure percentages
- **Hero's Journey**: Balance based on Campbell's story phases

#### Step 1.2: Template Analysis
For each template, determine:
- **Narrative weight** of each act (major/minor/transition)
- **Traditional pacing** expectations
- **Story rhythm** requirements

#### Step 1.3: Calculate Distributions
- Assign percentages based on narrative importance
- Ensure percentages sum to 100%
- Calculate plot point counts (round to nearest integer)
- Handle rounding discrepancies

### Phase 2: Backend Integration 🔄
**Goal**: Update generation system to use distributions

#### Step 2.1: Template Loading Enhancement
```javascript
// Enhanced template loader
function loadTemplateWithDistribution(templateId) {
  const template = loadTemplate(templateId);
  const totalPlotPoints = template.total_plot_points || PLOT_POINT_CONFIG.DEFAULT_TOTAL;
  
  // Calculate actual plot points from percentages
  Object.keys(template.structure).forEach(actKey => {
    const act = template.structure[actKey];
    if (act.distribution) {
      act.distribution.plotPoints = Math.round(
        (act.distribution.percentage / 100) * totalPlotPoints
      );
    }
  });
  
  return template;
}
```

#### Step 2.2: Plot Point Generation Update
```javascript
// Updated generation endpoint
app.post('/api/generate-plot-points-for-act/:projectPath/:actKey', async (req, res) => {
  const { templateData } = req.body;
  const actKey = req.params.actKey;
  
  // Use template distribution instead of user dropdown (as default)
  const act = templateData.structure[actKey];
  const defaultPlotPoints = act.distribution?.plotPoints || 4;
  const requestedPlotPoints = req.body.desiredSceneCount || defaultPlotPoints;
  
  // Generate with intelligent default but allow user override
  // ... rest of generation logic
});
```

#### Step 2.3: Context Building Enhancement
Update hierarchical context to include distribution information for better AI generation.

### Phase 3: Frontend Integration 🔄
**Goal**: Update UI to reflect intelligent distributions

#### Step 3.1: Template Display Enhancement
```javascript
// Show distribution info in template cards
function createActCards(templateStructure, totalPlotPoints = 40) {
  Object.entries(templateStructure).forEach(([actKey, act]) => {
    const distribution = act.distribution;
    const plotPoints = distribution?.plotPoints || 4;
    const percentage = distribution?.percentage || 0;
    
    // Display plot point allocation in act card
    const actCard = createActCardElement({
      name: act.name,
      description: act.description,
      plotPoints: plotPoints,
      percentage: percentage.toFixed(1) + '%'
    });
  });
}
```

#### Step 3.2: Plot Points UI Update
```javascript
// Update dropdown defaults to use template distribution
function displayElementPlotPoints(structureKey, templateData) {
  const act = templateData.structure[structureKey];
  const recommendedPlotPoints = act.distribution?.plotPoints || 4;
  
  // Set dropdown default to template recommendation
  const dropdown = document.getElementById(`plotPointsCount-${structureKey}`);
  dropdown.value = recommendedPlotPoints;
  
  // Add visual indicator of template recommendation
  addRecommendationBadge(dropdown, recommendedPlotPoints);
}
```

#### Step 3.3: Visual Pacing Indicators
- **Progress bars** showing relative act sizes
- **Pacing labels** (Setup, Development, Climax, Resolution)
- **Plot point allocation** preview in template selection

### Phase 4: Advanced Features 🔮
**Goal**: Enhanced distribution capabilities

#### Step 4.1: Dynamic Total Adjustment
- Allow users to adjust total plot points (30-60 range)
- Automatically recalculate all act distributions
- Maintain percentage relationships

#### Step 4.2: Custom Distribution Editor
- Visual slider interface for adjusting act percentages
- Real-time preview of plot point allocation
- Template-based presets with customization

#### Step 4.3: Pacing Analysis
- Visual pacing charts
- Story rhythm recommendations
- Comparison with successful film structures

## Detailed Template Distributions

### Save the Cat (40 total plot points)
```json
{
  "total_plot_points": 40,
  "structure": {
    "opening_image": { "percentage": 2.5, "plotPoints": 1 },
    "theme_stated": { "percentage": 2.5, "plotPoints": 1 },
    "setup": { "percentage": 15.0, "plotPoints": 6 },
    "catalyst": { "percentage": 5.0, "plotPoints": 2 },
    "debate": { "percentage": 10.0, "plotPoints": 4 },
    "break_into_two": { "percentage": 2.5, "plotPoints": 1 },
    "b_story": { "percentage": 5.0, "plotPoints": 2 },
    "fun_and_games": { "percentage": 20.0, "plotPoints": 8 },
    "midpoint": { "percentage": 5.0, "plotPoints": 2 },
    "bad_guys_close_in": { "percentage": 15.0, "plotPoints": 6 },
    "all_is_lost": { "percentage": 2.5, "plotPoints": 1 },
    "dark_night_of_soul": { "percentage": 5.0, "plotPoints": 2 },
    "break_into_three": { "percentage": 2.5, "plotPoints": 1 },
    "finale": { "percentage": 15.0, "plotPoints": 6 },
    "final_image": { "percentage": 2.5, "plotPoints": 1 }
  }
}
```

### Three-Act Structure (40 total plot points)
```json
{
  "total_plot_points": 40,
  "structure": {
    "act1_setup": { "percentage": 20.0, "plotPoints": 8 },
    "act1_inciting_incident": { "percentage": 5.0, "plotPoints": 2 },
    "act1_plot_point_1": { "percentage": 5.0, "plotPoints": 2 },
    "act2a_rising_action": { "percentage": 15.0, "plotPoints": 6 },
    "act2_midpoint": { "percentage": 10.0, "plotPoints": 4 },
    "act2b_obstacles": { "percentage": 15.0, "plotPoints": 6 },
    "act2_plot_point_2": { "percentage": 5.0, "plotPoints": 2 },
    "act3_climax": { "percentage": 15.0, "plotPoints": 6 },
    "act3_resolution": { "percentage": 10.0, "plotPoints": 4 }
  }
}
```

### Hero's Journey (40 total plot points)
```json
{
  "total_plot_points": 40,
  "structure": {
    "ordinary_world": { "percentage": 10.0, "plotPoints": 4 },
    "call_to_adventure": { "percentage": 5.0, "plotPoints": 2 },
    "refusal_of_call": { "percentage": 5.0, "plotPoints": 2 },
    "meeting_mentor": { "percentage": 5.0, "plotPoints": 2 },
    "crossing_threshold": { "percentage": 7.5, "plotPoints": 3 },
    "tests_allies_enemies": { "percentage": 15.0, "plotPoints": 6 },
    "approach": { "percentage": 7.5, "plotPoints": 3 },
    "ordeal": { "percentage": 12.5, "plotPoints": 5 },
    "reward": { "percentage": 7.5, "plotPoints": 3 },
    "road_back": { "percentage": 7.5, "plotPoints": 3 },
    "resurrection": { "percentage": 10.0, "plotPoints": 4 },
    "return_with_elixir": { "percentage": 7.5, "plotPoints": 3 }
  }
}
```

## Backward Compatibility

### Existing Projects
- **Legacy projects** continue to work with current system
- **Migration path** available for upgrading to new distribution
- **No breaking changes** to existing API endpoints

### Transition Strategy
1. **Soft launch**: New system available but optional
2. **Gradual migration**: Encourage use in new projects
3. **Full adoption**: Eventually make distribution system default

## Testing Strategy

### Unit Tests
- **Distribution calculation** accuracy
- **Percentage validation** (sum to 100%)
- **Plot point allocation** edge cases
- **Rounding logic** consistency

### Integration Tests  
- **Template loading** with distributions
- **Plot point generation** using new system
- **UI display** of distribution information
- **User override** functionality

### User Testing
- **Template selection** with distribution previews
- **Plot point adjustment** usability
- **Story quality** comparison (old vs new system)
- **Learning curve** for new interface

## Success Metrics

### Technical Metrics
- **Consistent script lengths** across templates
- **Improved story pacing** (user feedback)
- **Reduced user confusion** about plot point allocation
- **Better AI generation** quality due to proper pacing

### User Experience Metrics
- **Template selection** confidence increase
- **Plot point adjustment** frequency decrease
- **Story completion** rate improvement
- **User satisfaction** with pacing

## Migration Timeline

### Week 1-2: Template Analysis & Data Preparation
- Research pacing for essential templates
- Calculate percentage distributions
- Create distribution data files

### Week 3-4: Backend Implementation
- Update template loading system
- Modify plot point generation endpoints
- Implement distribution calculation logic

### Week 5-6: Frontend Integration
- Update template display components
- Modify plot point UI elements
- Add distribution visualization

### Week 7-8: Testing & Refinement
- Comprehensive testing
- User feedback collection
- Performance optimization
- Documentation updates

## Future Enhancements

### Advanced Distribution Features
- **Genre-specific** pacing adjustments
- **Runtime-based** scaling (feature vs short film)
- **AI-suggested** distribution improvements
- **Community-contributed** template distributions

### Analytics Integration
- **Pacing analysis** for completed scripts
- **Distribution effectiveness** tracking
- **Template popularity** based on pacing
- **Success correlation** with distribution adherence

---

This specification provides a comprehensive roadmap for implementing intelligent plot point distribution that will significantly improve story pacing and consistency across all templates. 