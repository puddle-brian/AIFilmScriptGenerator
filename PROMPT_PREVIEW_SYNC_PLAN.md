# Prompt Preview Synchronization Fix Plan

## Problem Overview

### The Issue: Prompt Drift
The Film Script Generator has separate implementations for:
- **Generation Endpoints**: Build prompts for actual AI generation
- **Preview Endpoints**: Build prompts to show users what will be sent to AI

This creates a **"prompt drift" problem** where:
- Preview endpoints may show different prompts than what's actually sent to the AI
- Users cannot trust preview content to represent actual generation
- Debugging becomes difficult when previews don't match reality
- Prompt modifications become error-prone due to dual maintenance

### Current Architecture Problem
```
Generation Endpoint (e.g., /api/generate-scenes)
├── buildScenePrompt() - Custom implementation
└── Send to Claude API

Preview Endpoint (e.g., /api/preview-scene-prompt)  
├── buildScenePromptPreview() - Separate implementation
└── Return to frontend

❌ TWO DIFFERENT IMPLEMENTATIONS = PROMPT DRIFT RISK
```

### Impact Assessment
- **User Trust**: Users cannot rely on previews to understand what AI receives
- **Development Speed**: Changes require updating multiple locations
- **Quality Assurance**: Hard to verify prompt consistency across endpoints
- **Debugging Complexity**: Preview vs actual generation mismatches create confusion

## Solution: Easy Fix Approach (2-4 Hours)

### Strategy: Extract Shared Prompt Building Functions
Create centralized prompt building functions that both generation and preview endpoints use.

### Target Architecture
```
Prompt Template Files (NEW - Non-Programmer Friendly!)
├── prompts/scene-generation.txt
├── prompts/plot-points-generation.txt  
├── prompts/dialogue-generation.txt
└── prompts/structure-generation.txt

Shared Prompt Builders (NEW)
├── buildScenePrompt() → Loads template + replaces {{PLACEHOLDERS}}
├── buildPlotPointPrompt() → Loads template + replaces {{PLACEHOLDERS}}
├── buildDialoguePrompt() → Loads template + replaces {{PLACEHOLDERS}}
└── buildStructurePrompt() → Loads template + replaces {{PLACEHOLDERS}}

Generation Endpoints
├── Call shared prompt builder
└── Send result to Claude API

Preview Endpoints  
├── Call same shared prompt builder
└── Return result to frontend

✅ SINGLE SOURCE OF TRUTH = NO PROMPT DRIFT
✅ NON-PROGRAMMER EDITABLE PROMPT FILES
```

## Implementation Plan

### Phase 1: Analysis & Setup (30 minutes)

#### Step 1.1: Identify All Prompt Building Locations
- [ ] **Map Generation Endpoints**
  - [ ] List all `/api/generate-*` endpoints
  - [ ] Document current prompt building logic in each
  - [ ] Note any custom logic or special cases

- [ ] **Map Preview Endpoints**
  - [ ] List all `/api/preview-*-prompt` endpoints  
  - [ ] Document current preview prompt building logic
  - [ ] Identify differences from generation counterparts

- [ ] **Create Prompt Building Inventory**
  - [ ] Scene generation prompts
  - [ ] Plot point generation prompts
  - [ ] Dialogue generation prompts
  - [ ] Structure generation prompts
  - [ ] Any other generation types

#### Step 1.2: Setup Shared Module & Template System
- [ ] **Create Prompt Template Directory**
  - [ ] Create `prompts/` directory
  - [ ] Create placeholder template files (will be populated in each phase)
  - [ ] Add `prompts/README.md` with editing instructions for non-programmers

- [ ] **Create Prompt Builders Module**
  - [ ] Create `prompt-builders.js` file
  - [ ] Add template loading functionality
  - [ ] Add placeholder replacement system ({{VARIABLE}} → actual value)
  - [ ] Add module exports structure
  - [ ] Add comprehensive JSDoc documentation

### Phase 2: Extract Scene Prompt Building (45 minutes)

#### Step 2.1: Extract Scene Generation Logic
- [ ] **Analyze Current Scene Generation**
  - [ ] Review `/api/generate-scene` endpoint prompt building
  - [ ] Review `/api/generate-individual-scene` endpoint
  - [ ] Document all variables and context used

- [ ] **Create Scene Prompt Template File**
  - [ ] Create `prompts/scene-generation.txt` with current prompt text
  - [ ] Replace dynamic values with clear placeholders (e.g., `{{PROJECT_TITLE}}`, `{{SCENE_DESCRIPTION}}`)
  - [ ] Add comments explaining each placeholder for non-programmers

- [ ] **Create Shared buildScenePrompt Function**
  - [ ] Load template from `prompts/scene-generation.txt`
  - [ ] Replace placeholders with actual project data
  - [ ] Accept all necessary parameters (projectContext, sceneIndex, etc.)
  - [ ] Handle all edge cases from original implementations
  - [ ] Add input validation and error handling

- [ ] **Update Generation Endpoints**
  - [ ] Modify `/api/generate-scene` to use shared function
  - [ ] Modify `/api/generate-individual-scene` to use shared function
  - [ ] Remove duplicate prompt building code

#### Step 2.2: Update Scene Preview Endpoint
- [ ] **Modify Preview Endpoint**
  - [ ] Update `/api/preview-scene-prompt` to use shared function
  - [ ] Remove duplicate preview-specific prompt building
  - [ ] Ensure exact same output as generation endpoints

#### Step 2.3: Test Scene Prompt Consistency
- [ ] **Verification Testing**
  - [ ] Generate scene prompt via generation endpoint (capture before sending to AI)
  - [ ] Generate scene prompt via preview endpoint
  - [ ] Compare outputs character-by-character
  - [ ] Fix any discrepancies

### Phase 3: Extract Plot Point Prompt Building (45 minutes)

#### Step 3.1: Extract Plot Point Generation Logic
- [ ] **Analyze Current Plot Point Generation**
  - [ ] Review `/api/generate-plot-points` endpoint
  - [ ] Review `/api/generate-plot-point` (single) endpoint
  - [ ] Review `/api/regenerate-plot-point` endpoint
  - [ ] Document context requirements

- [ ] **Create Shared buildPlotPointPrompt Function**
  - [ ] Extract plot point prompt building logic
  - [ ] Handle both bulk and individual plot point generation
  - [ ] Support regeneration scenarios
  - [ ] Add comprehensive parameter validation

- [ ] **Update Generation Endpoints**
  - [ ] Modify all plot point generation endpoints
  - [ ] Remove duplicate prompt building code
  - [ ] Ensure consistent behavior

#### Step 3.2: Update Plot Point Preview Endpoints
- [ ] **Modify Preview Endpoints**
  - [ ] Update `/api/preview-act-plot-points-prompt`
  - [ ] Update `/api/preview-individual-plot-point-prompt`
  - [ ] Use shared prompt building function

#### Step 3.3: Test Plot Point Prompt Consistency
- [ ] **Verification Testing**
  - [ ] Test bulk plot points generation vs preview
  - [ ] Test individual plot point generation vs preview
  - [ ] Test regeneration scenarios
  - [ ] Verify all outputs match exactly

### Phase 4: Extract Dialogue Prompt Building (30 minutes)

#### Step 4.1: Extract Dialogue Generation Logic
- [ ] **Analyze Current Dialogue Generation**
  - [ ] Review dialogue generation endpoints
  - [ ] Document prompt structure and variables
  - [ ] Note any special formatting requirements

- [ ] **Create Shared buildDialoguePrompt Function**
  - [ ] Extract dialogue prompt building logic
  - [ ] Handle scene context and character information
  - [ ] Support different dialogue generation modes

- [ ] **Update Generation & Preview Endpoints**
  - [ ] Modify generation endpoints to use shared function
  - [ ] Update `/api/preview-dialogue-prompt` to use shared function
  - [ ] Remove duplicate code

#### Step 4.2: Test Dialogue Prompt Consistency
- [ ] **Verification Testing**
  - [ ] Compare generation vs preview outputs
  - [ ] Test with different scene types
  - [ ] Verify character information consistency

### Phase 5: Extract Structure Prompt Building (30 minutes)

#### Step 5.1: Extract Structure Generation Logic
- [ ] **Analyze Structure Generation**
  - [ ] Review structure generation endpoint
  - [ ] Document template integration
  - [ ] Note story input processing

- [ ] **Create Shared buildStructurePrompt Function**
  - [ ] Extract structure prompt building
  - [ ] Handle different template types
  - [ ] Process story input consistently

- [ ] **Update Endpoints**
  - [ ] Modify structure generation to use shared function
  - [ ] Update any structure preview endpoints

### Phase 6: Final Integration & Testing (30 minutes)

#### Step 6.1: Integration Testing
- [ ] **End-to-End Workflow Testing**
  - [ ] Test complete workflow: Structure → Plot Points → Scenes → Dialogue
  - [ ] Verify all previews match actual generation
  - [ ] Test with different templates and story types
  - [ ] Test edge cases and error scenarios

- [ ] **Performance Verification**
  - [ ] Ensure no performance regression
  - [ ] Verify memory usage remains stable
  - [ ] Check response times for preview endpoints

#### Step 6.2: Code Cleanup
- [ ] **Remove Dead Code**
  - [ ] Delete unused prompt building functions
  - [ ] Remove duplicate logic
  - [ ] Clean up imports and exports

- [ ] **Documentation Updates**
  - [ ] Update JSDoc comments
  - [ ] Create usage examples for shared functions
  - [ ] Document any breaking changes

## Success Metrics

### Primary Success Criteria
- [ ] **100% Prompt Consistency**: All preview endpoints return identical prompts to generation endpoints
- [ ] **Zero Regression**: All existing functionality works exactly as before
- [ ] **Simplified Maintenance**: Single location for each prompt type's logic

### Verification Checklist
- [ ] **Automated Testing**
  - [ ] Create test that compares generation vs preview outputs
  - [ ] Test passes for all prompt types
  - [ ] Test covers edge cases and different project states

- [ ] **Manual Verification**
  - [ ] User can preview scene prompt and see exact text sent to AI
  - [ ] User can preview plot point prompt and see exact text sent to AI
  - [ ] User can preview dialogue prompt and see exact text sent to AI
  - [ ] Preview content matches generation logs

### Quality Assurance
- [ ] **Code Quality**
  - [ ] All shared functions have comprehensive JSDoc
  - [ ] Input validation prevents invalid parameters
  - [ ] Error handling provides clear messages
  - [ ] Functions are pure (no side effects)

- [ ] **System Stability**
  - [ ] No crashes or errors introduced
  - [ ] Server startup/restart works normally
  - [ ] Memory usage remains stable
  - [ ] Response times within acceptable range

## Risk Mitigation

### Potential Issues & Mitigation
1. **Breaking Changes During Refactor**
   - **Risk**: Accidentally changing prompt behavior
   - **Mitigation**: Character-by-character comparison testing before/after

2. **Complex Context Dependencies**
   - **Risk**: Missing subtle context requirements
   - **Mitigation**: Thorough analysis phase, comprehensive parameter passing

3. **Performance Impact**
   - **Risk**: Function call overhead
   - **Mitigation**: Performance testing, optimize if needed

### Rollback Plan
- [ ] **Git Checkpoint**: Commit working state before starting
- [ ] **Backup Strategy**: Keep original functions commented out initially
- [ ] **Testing Gate**: Don't remove old code until new code proven working
- [ ] **Quick Revert**: If issues found, revert to shared function approach

## Implementation Schedule

### Time Estimates
- **Phase 1**: 30 minutes (Analysis & Setup)
- **Phase 2**: 45 minutes (Scene Prompts)  
- **Phase 3**: 45 minutes (Plot Point Prompts)
- **Phase 4**: 30 minutes (Dialogue Prompts)
- **Phase 5**: 30 minutes (Structure Prompts)
- **Phase 6**: 30 minutes (Integration & Testing)

**Total Estimated Time: 3 hours 30 minutes**

### Recommended Approach
1. **Complete One Phase at a Time**: Don't move to next phase until current phase 100% complete
2. **Test After Each Phase**: Verify functionality before proceeding
3. **Commit After Each Phase**: Git checkpoint for safe rollback
4. **Document Issues**: Track any unexpected complexities for future reference

## Post-Implementation Benefits

### Immediate Benefits
- **User Confidence**: Previews accurately represent AI input
- **Developer Efficiency**: Single location to modify prompt logic
- **Quality Assurance**: Easy to verify prompt consistency
- **Debugging Simplification**: Preview matches generation exactly

### Long-term Benefits
- **Easier Prompt Evolution**: Changes only need to be made once
- **Reduced Bug Risk**: No synchronization issues between preview/generation
- **Better Testing**: Can test prompt building logic independently
- **Documentation**: Clear prompt building logic in shared functions

## Next Steps After Completion

Once this synchronization fix is complete, the user will have:
1. **Reliable Preview System**: Can trust previews to show actual AI input
2. **Simplified Prompt Modifications**: Safe to make changes based on preview content
3. **Better Development Experience**: Single source of truth for all prompt building
4. **Foundation for Future Improvements**: Easy to add new prompt types or modify existing ones

This foundation will enable confident prompt improvements and system enhancements without the risk of preview/generation mismatches.

## Template File Examples (Non-Programmer Friendly)

### Example: `prompts/scene-generation.txt`
```
// This template generates individual scenes based on plot points
// You can edit this text directly - just keep the {{PLACEHOLDERS}} intact!

You are an expert screenwriter creating a scene for the film "{{PROJECT_TITLE}}".

STORY CONTEXT:
- Title: {{PROJECT_TITLE}}  
- Logline: {{PROJECT_LOGLINE}}
- Overall tone: {{PROJECT_TONE}}
- Characters: {{PROJECT_CHARACTERS}}

SCENE TO GENERATE:
- Act: {{SCENE_ACT}}
- Scene Description: {{SCENE_DESCRIPTION}}
- Character Development: {{SCENE_CHARACTER_DEVELOPMENT}}

PREVIOUS SCENES CONTEXT:
{{PREVIOUS_SCENES_SUMMARY}}

Generate a detailed scene that:
1. Advances the plot as described
2. Develops the characters as specified  
3. Maintains the established tone
4. Connects naturally with previous scenes

Format as a proper screenplay scene with scene headings, action lines, and dialogue.
```

### Example: `prompts/plot-points-generation.txt`
```
// This template generates plot points for story acts
// Edit this text to change how plot points are created

You are creating detailed plot points for "{{PROJECT_TITLE}}".

STORY FOUNDATION:
- Title: {{PROJECT_TITLE}}
- Logline: {{PROJECT_LOGLINE}}
- Structure Template: {{TEMPLATE_NAME}}
- Target Scene Count: {{TOTAL_SCENES}}

CURRENT ACT: {{ACT_NAME}}
Act Description: {{ACT_DESCRIPTION}}
Key Events: {{ACT_KEY_EVENTS}}

Generate {{SCENES_PER_ACT}} specific plot points that:
1. Break down the act into concrete scenes
2. Maintain story momentum and character development
3. Follow the {{TEMPLATE_NAME}} structure principles
4. Connect smoothly between scenes

Return as a JSON array with scene descriptions and character development notes.
```

### Benefits of Template Files:
- **Non-Programmer Friendly**: Edit prompts like regular text files
- **Version Control**: Track prompt changes separately from code changes  
- **Easy Experimentation**: Test different prompt variations quickly
- **Clear Organization**: All prompts in one dedicated directory
- **Collaborative**: Multiple people can edit prompts without touching code
- **Backup/Restore**: Easy to revert prompt changes independently 