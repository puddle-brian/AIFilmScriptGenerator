# Film Script Generator - System Specification

## Overview

The Film Script Generator is a hierarchical story development system that uses **progressive prompt refinement** to guide users from high-level story concepts to detailed screenplay content. The core principle is that each level of detail builds upon all previous levels, creating a coherent narrative structure through **hierarchical context management**.

## Core Architecture: Hierarchical Context System

The system operates on a **5-level hierarchical context architecture** where each level contains and builds upon all previous levels:

### Level 1: Story Foundation
- **Purpose**: Establishes the fundamental story concept and creative influences
- **Contains**: 
  - Story title, logline, main characters
  - Tone/style selection
  - Creative influences (directors, screenwriters, films)
  - Total scene count target
- **Context Role**: Forms the base context that influences all subsequent generations

### Level 2: Structure Template
- **Purpose**: Applies a proven narrative structure framework
- **Contains**:
  - Selected story structure template (Hero's Journey, Three-Act, Save the Cat, etc.)
  - Template-specific story acts and their purposes
  - Story act relationships and flow
- **Context Role**: Provides the architectural framework for story development

### Level 3: Generated Story Acts
- **Purpose**: Creates the specific story acts for this story
- **Contains**:
  - Detailed story acts with titles and descriptions
  - Character development arcs within each act
  - Thematic progression through the acts
- **Context Role**: Establishes the specific narrative spine that guides all scene development

### Level 4: Plot Points
- **Purpose**: Creates causal story beats that connect story acts
- **Contains**:
  - Specific plot points for each story act
  - Causal connections using "and then" / "therefore" logic
  - Character actions and consequences at beat level
- **Context Role**: Provides the causal narrative thread that ensures scene coherence
- **Key Insight**: Plot points must be generated BEFORE scenes to establish proper causality

### Level 5: Individual Scenes
- **Purpose**: Implements specific plot points as dramatic scenes
- **Contains**:
  - Scene-specific details (location, time, characters present)
  - Scene description implementing the assigned plot point
  - Dialogue and action within the scene context
- **Context Role**: Executes the story at the most granular level while maintaining hierarchical coherence

## Hierarchical Prompt Construction

### The "Trunk to Leaves" Principle
Each prompt includes **all previous levels** of context, creating a progressive refinement system:

```
Level 5 Scene Prompt = 
  Story Foundation + 
  Structure Template + 
  Generated Story Acts + 
  Assigned Plot Points + 
  Scene-Specific Requirements
```

### Context Persistence
- All context is saved to `context.json` in each project directory
- Context is rebuilt and validated at each level
- Missing context triggers appropriate error handling and user guidance

## User Workflow

### Step 1: Story Input
- User defines story concept, characters, influences, tone
- System captures creative DNA of the project
- **Output**: Level 1 context established

### Step 2: Template Selection  
- User selects from curated story structure templates
- Each template provides proven narrative frameworks
- **Output**: Level 2 context established

### Step 3: Act Generation
- System generates specific story acts using Levels 1+2
- User can review, edit, and regenerate acts
- **Output**: Level 3 context established

### Step 4: Plot Points Generation (Critical Step)
- System generates causal plot points for each story act
- Uses ONLY structural context (no existing scenes referenced)
- Creates "but and therefore" causal chains (avoiding weak "and then" chronological sequencing)
- **Output**: Level 4 context established
- **Why Critical**: Without this step, scenes lack causal coherence

### Step 5: Scene Generation
- System generates scenes implementing specific plot points
- Each scene references its hierarchical context chain
- Scenes maintain structural and causal coherence
- **Output**: Level 5 context established

### Step 6: Dialogue Generation
- System generates screenplay dialogue for each scene
- Maintains character voice and story tone throughout
- **Output**: Screenplay content ready for export

### Step 7: Export & Finalization
- User can export completed screenplay in multiple formats
- Project state is preserved for future editing

## Technical Implementation

### Context Management Class
```javascript
class HierarchicalContext {
  // Level 1: Story Foundation
  buildStoryFoundationContext()
  
  // Level 2: Structure Template  
  buildStructureTemplateContext()
  
  // Level 3: Generated Story Acts
  buildGeneratedActsContext()
  
  // Level 4: Plot Points
  buildPlotPointsContext()
  
  // Level 5: Scene Context
  buildSceneContext()
  
  // Master prompt builder
  generateHierarchicalPrompt(level, specificContext)
}
```

### API Endpoints
- `/api/generate-structure` - Generates Level 3 story acts from Levels 1+2
- `/api/generate-plot-points-for-act/:projectPath/:actKey` - Generates Level 4 from Levels 1+2+3
- `/api/generate-scene/:projectPath/:actKey` - Generates Level 5 from Levels 1+2+3+4
- `/api/generate-dialogue` - Generates screenplay from all levels

### File Structure
```
generated/
  [ProjectName]/
    01_context/
      context.json          # Complete hierarchical context
      story-input.json      # Level 1 data
      story-acts.json       # Level 3 data
    02_plot-points/
      [act].json            # Level 4 data per story act
    03_scenes/
      [act]/                # Level 5 data per story act
        scene-[n].json
    04_dialogue/
      [act]/
        scene-[n].json
```

## Key Design Principles

### 1. Hierarchical Coherence
Every piece of content is generated with full awareness of all higher-level context, ensuring thematic and structural consistency.

### 2. Causal Narrative Flow
Plot points establish causal relationships between story beats, preventing disconnected or arbitrary scene sequences.

### 3. Progressive Refinement
Each level adds specificity while maintaining the essence established in previous levels.

### 4. Context Preservation
All context is persistent and reloadable, allowing for iterative development and revision.

### 5. Template Flexibility
Multiple story structure templates accommodate different narrative approaches while maintaining the hierarchical system.

## Critical Success Factors

### 1. Plot Points Before Scenes
The system MUST generate plot points before scenes. Attempting to generate plot points from existing scenes creates backwards causality and narrative incoherence.

### 2. Complete Context Chains
Every generation must include the complete context chain from Level 1 through the current level.

### 3. Template Adherence
Generated content must respect the selected story structure template while incorporating the specific story acts.

### 4. Causal Logic
Plot points must use explicit causal connectors ("BUT" for conflict/complications, "THEREFORE" for consequences/progress) to create logical story progression, avoiding weak "and then" chronological sequencing.

## User Experience Goals

1. **Guided Creativity**: System provides structure while preserving creative freedom
2. **Coherent Development**: Every step maintains connection to the overall story vision
3. **Iterative Refinement**: Users can regenerate any level while maintaining hierarchical integrity
4. **Professional Output**: Final screenplay meets industry standards and narrative coherence

## Future Enhancements

- Character arc tracking across hierarchical levels
- Theme development integration
- Multiple ending generation and comparison
- Collaborative editing with shared context management
- AI-assisted story analysis and improvement suggestions

---

This specification serves as the definitive guide for understanding and maintaining the Film Script Generator's hierarchical prompt architecture. 