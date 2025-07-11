# VEO Video Generation - Step 8 Specification

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Platform:** Screenplay Genie (AI Film Script Generator)

---

## Executive Summary

This specification outlines the implementation of **Step 8: Video Production** - an optional video generation feature that transforms completed screenplays into VEO-compatible video content. This system is designed as a standalone, non-disruptive addition to the existing 7-step screenplay generation workflow.

### Key Features
- Optional Step 8 accessible after screenplay completion
- Credit-gated video generation using existing payment system
- Global cinematography settings with per-scene overrides
- Character reference image management
- Full VEO prompt transparency and editing
- Local video file storage (no server storage costs)
- Individual scene-based generation for cost control

---

## Design Principles

### **Non-Disruptive Integration**
- Completely standalone system that doesn't interfere with core screenplay functionality
- Separate codebase sections with minimal dependencies on existing workflow
- Optional feature that doesn't change Steps 1-6 experience

### **Cost Management**
- Credit-gated access using existing credit system
- Higher costs for video generation (50-100 credits vs 2-10 for screenplay)
- No subsidized experiments - full cost for all generations
- Clear cost warnings before any generation

### **Professional Transparency**
- Full VEO prompt visibility before generation
- Editable prompts with complete user control
- Technical parameter transparency
- "What you see is what gets sent" philosophy

### **Scalable Architecture**
- Local video storage (user's computer)
- Database storage for metadata only
- Queue management for VEO API rate limits
- Individual scene generation for manageable costs

---

## User Journey Overview

```
Steps 1-6: Complete Screenplay Generation
     ↓
Step 6: Export Screenplay (Current final step)
     ↓
Step 8: Video Production (NEW - Optional)
     ↓
8A: Setup Global Settings & Character Images
     ↓
8B: Generate VEO Prompts for Scenes
     ↓
8C: Review/Edit Prompts
     ↓
8D: Generate Videos (Individual scenes)
     ↓
Download Videos to Local Computer
```

---

## Technical Architecture

### **Entry Requirements**
- Project must have completed Step 6 (screenplay export)
- Project must have dialogue generated for at least one scene
- User must have sufficient credits for video generation

### **Database Schema Extensions**
```json
// Add to existing projectContext
{
  "videoProduction": {
    "globalSettings": {
      "cinematography": {
        "cameraStyle": {
          "movement": "handheld|static|smooth tracking|crane",
          "lensStyle": "wide angle|telephoto|standard|fisheye",
          "composition": "close-up heavy|wide shot heavy|balanced|dynamic"
        },
        "artDirection": {
          "lightingMood": "natural|dramatic|soft|high contrast",
          "colorPalette": "warm|cool|desaturated|vibrant",
          "visualStyle": "realistic|cinematic|stylized|documentary"
        },
        "audioStyle": {
          "dialogueDelivery": "natural|theatrical|intimate|dramatic",
          "ambientSound": "minimal|atmospheric|rich|immersive"
        },
        "aspectRatio": "16:9|9:16"
      },
      "characterImages": {
        "heroName": {
          "referenceImage": "path/to/image.jpg",
          "visualNotes": "Always wears dark clothing",
          "usedInScenes": ["opening_image-0", "setup-1"]
        }
      }
    },
    "scenePrompts": {
      "opening_image-0": {
        "prompt": "Generated VEO prompt text...",
        "customizations": {
          "cameraOverride": "crane shot",
          "lightingOverride": "dramatic"
        },
        "generatedAt": "2024-01-01T12:00:00Z",
        "status": "ready|generating|completed|failed",
        "creditsCost": 5
      }
    },
    "generatedVideos": {
      "opening_image-0": {
        "filename": "fear_of_rings_opening_image_0_20240101.mp4",
        "creditsCost": 75,
        "generatedAt": "2024-01-01T12:05:00Z",
        "veoOperationId": "abc123",
        "downloadUrl": "temp_download_link"
      }
    }
  }
}
```

### **New API Endpoints**
```
# Video Production Management
GET  /api/video-production/project/:projectPath
PUT  /api/video-production/settings/:projectPath

# Prompt Generation & Management
POST /api/video-production/generate-prompt/:projectPath/:sceneId
PUT  /api/video-production/edit-prompt/:projectPath/:sceneId
GET  /api/video-production/preview-prompt/:projectPath/:sceneId

# Video Generation & Download
POST /api/video-production/generate-video/:projectPath/:sceneId
GET  /api/video-production/status/:operationId
GET  /api/video-production/download/:projectPath/:sceneId

# Character Management
POST /api/user-libraries/:username/characters/upload-image
PUT  /api/user-libraries/:username/characters/:characterId/image
```

---

## Interface Design

### **Step 8 Main Interface**
Similar layout to existing Step 6 with hierarchical scene display:

```
┌─ PROJECT: Fear of the Rings ─────────────────────────────────────┐
│  Step 8: Video Production                                        │
│  📊 Credits: 450 available                                       │
│                                                                  │
│  ┌─ Global Settings ─────────────────────────────────────────┐  │
│  │ 🎬 Cinematography Settings                                │  │
│  │ 👥 Character Images (3 uploaded, 2 missing)             │  │
│  │ 🎵 Audio & Style Settings                                │  │
│  │ [📝 Edit Global Settings]                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Act 1: Opening Image ─────────────────────────────────── │  │
│  │  🎬 Scene 1.1: Hero Enters Tavern                        │  │
│  │     💬 Has Dialogue | ⏳ Prompt Ready | 🎥 Video Generated │  │
│  │     [🎬 Generate Prompt] [👁️ Preview] [⚙️ Scene Settings]   │  │
│  │                                                           │  │
│  │  🎬 Scene 1.2: Meeting the Bartender                     │  │
│  │     💬 Has Dialogue | ❌ No Prompt                        │  │
│  │     [🎬 Generate Prompt] [👁️ Preview] [⚙️ Scene Settings]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─ Batch Operations ──────────────────────────────────────┐  │
│  │  [🎬 Generate All Prompts] (25 scenes × 5 credits = 125) │  │
│  │  ⚠️ Note: Videos generated individually due to cost       │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## VEO Prompt Generation System

### **Optimal VEO Prompt Structure**
Based on research of VEO best practices:

```
Subject: [Primary character/focus from scene data]
Context: [Location + environmental details + time of day]
Action: [Key dialogue snippets + physical actions from scene]
Style: [Cinematographic style from global settings + story influences]
Camera Motion: [Movement type from global settings]
Composition: [Shot framing and angle preferences]
Ambiance: [Lighting + color palette + mood from art direction]
Audio: [Dialogue delivery style + ambient sound preferences]
```

### **Data Source Mapping**
```javascript
// Existing scene data
{
  title: "Hero Enters Tavern",
  location: "Medieval Tavern", 
  time_of_day: "Night",
  description: "Hero pushes through heavy wooden doors into smoky tavern...",
  characters: ["Hero", "Bartender"],
  emotional_beats: ["tension", "anticipation"],
  dialogue: "HERO\nI need information about the missing crown..."
}

// + Global cinematography settings
// + Character reference images
// + Scene-specific overrides
// + Story influences (directors, films, tone)
// = Complete VEO prompt
```

---

## Character Management System

### **Character Library Enhancement**
Extend existing `/api/user-libraries/{username}/characters` with image support:

```json
{
  "characterId": "hero_001",
  "name": "Hero",
  "description": "Tall, dark hair, serious expression",
  "referenceImage": {
    "filename": "hero_reference.jpg",
    "uploadedAt": "2024-01-01T12:00:00Z",
    "fileSize": 2048000,
    "dimensions": "1024x1024"
  },
  "visualNotes": "Always wears dark traveling cloak",
  "usedInProjects": ["fear_of_rings", "another_project"],
  "usedInScenes": ["opening_image-0", "setup-1", "finale-5"]
}
```

### **Image Upload Requirements**
- **Formats**: JPEG, PNG
- **Size Limit**: 5MB per image
- **Dimensions**: Recommended 1024x1024 or 512x512
- **Storage**: User's character library (cross-project reuse)

---

## Credit System Integration

### **Pricing Structure**
Credit costs scaled based on computational requirements:

```
Screenplay Generation:
├── Scene Generation: 2-5 credits
├── Dialogue Generation: 5-10 credits
└── Plot Points: 3-8 credits

Video Production:
├── Prompt Generation: 5-10 credits (same as dialogue)
├── Video Generation: 50-100 credits (scale with VEO API costs)
└── Batch Prompt Generation: 5 × number of scenes
```

### **Cost Display Strategy**
- **Clear Warnings**: "This will cost 75 credits"
- **Running Total**: Show remaining credits after operation
- **Batch Calculations**: "25 scenes × 5 credits = 125 total"
- **No Refunds**: Clear messaging about full-cost policy

---

## Video Storage & Download System

### **Local Storage Strategy**
- **No Server Storage**: Videos download directly to user's computer
- **File Naming**: `{projectName}_{sceneId}_{timestamp}.mp4`
- **Auto-Download**: Browser triggers download after generation completion
- **User Management**: Users organize their own video library

### **Video Metadata Tracking**
```json
{
  "videoId": "opening_image_0_20240101",
  "sceneId": "opening_image-0",
  "filename": "fear_of_rings_opening_image_0_20240101.mp4",
  "generatedAt": "2024-01-01T12:05:00Z",
  "creditsCost": 75,
  "veoOperationId": "veo_abc123",
  "promptUsed": "Subject: Hooded hero...",
  "technicalParams": {
    "model": "veo-3",
    "duration": "5-8 seconds",
    "resolution": "720p",
    "aspectRatio": "16:9"
  }
}
```

---

## Error Handling & Edge Cases

### **Failed Video Generation**
- **Credit Policy**: Credits consumed regardless of failure (no refunds)
- **Error Messaging**: Clear explanation of VEO API errors
- **Retry Options**: Allow regeneration with modified prompt
- **Logging**: Track failures for debugging and support

### **VEO API Rate Limiting**
- **Limits**: 10-20 requests per minute depending on VEO tier
- **Queue System**: Manage multiple scene requests
- **User Notifications**: Show queue position and estimated wait time
- **Graceful Degradation**: Handle peak usage periods

### **Missing Dialogue Handling**
- **Scene Filtering**: Only show scenes with dialogue in Step 8
- **Clear Messaging**: "Generate dialogue first to enable video production"
- **Progressive Enhancement**: Step 8 improves as more dialogue is added

---

## Implementation Phases

### **Phase 1A: Prompt Generation Foundation (NO VEO API)**
**Focus:** Build and perfect the prompt generation system without VEO dependencies

**Core Components:**
1. Database schema extensions for videoProduction
2. Basic Step 8 UI framework (matches existing Step 6 layout)
3. Global cinematography settings management
4. Character image upload system integration
5. Scene data → VEO prompt conversion engine
6. Prompt preview and editing interface
7. Mock video generation (shows success without actual video)

**Validation Strategy:**
- Test with existing "Fear of the Rings" project (2 dialogue scenes available)
- Focus on prompt quality and user experience
- Ensure complete Step 8 workflow without VEO API calls
- Character image integration testing

**Benefits:**
- No Google Cloud/VEO API dependencies
- Faster development and iteration
- Easier debugging and troubleshooting
- User experience validation before complexity

### **Phase 1B: VEO API Integration**
**Focus:** Add real VEO API once prompt generation is solid

**Core Components:**
1. VEO API client with authentication
2. Long-running operation handling and polling
3. Progress tracking system
4. Video download and local storage management
5. Rate limiting and queue management
6. Error handling for API failures

**Prerequisites:**
- Phase 1A fully complete and tested
- VEO API access and credentials obtained
- Prompt generation producing high-quality results

### **Phase 2: Advanced Features**
1. Batch prompt generation operations
2. Advanced cinematography controls
3. Character image optimization
4. Prompt caching and reuse

### **Phase 3: Polish & Optimization**
1. Performance optimization
2. Enhanced error handling
3. User experience refinements
4. Analytics and monitoring

### **Phase 4: Future Enhancements**
1. Video assembly pipeline
2. Transition effects
3. Advanced audio integration
4. Professional export options

---

## Phase 1A: Mock VEO Integration Strategy

### **Mock Video Generation Approach**
To validate the complete user experience without VEO API complexity:

**Mock "Generate Video" Flow:**
1. User clicks "Generate Video" button (costs credits as normal)
2. System shows realistic loading state (2-3 seconds)
3. Success message: "Video generated successfully!"
4. Mock download: "fear_of_rings_opening_image_0_mock.mp4" 
5. Database stores mock video metadata for consistency

**Benefits:**
- Complete workflow testing without API costs or dependencies
- Focus on prompt quality and user experience
- Realistic timing and credit cost simulation
- Database schema validation and testing

**Mock Data Storage:**
```json
{
  "generatedVideos": {
    "opening_image-0": {
      "filename": "fear_of_rings_opening_image_0_mock.mp4",
      "creditsCost": 75,
      "generatedAt": "2024-01-01T12:05:00Z",
      "veoOperationId": "mock_abc123",
      "status": "completed_mock",
      "promptUsed": "Subject: Hooded hero in medieval clothing...",
      "technicalParams": {
        "model": "mock-veo-3",
        "duration": "5-8 seconds",
        "resolution": "720p",
        "aspectRatio": "16:9"
      }
    }
  }
}
```

**User Experience Testing:**
- All UI elements function as designed
- Credit costs are calculated, displayed, and deducted
- Progress tracking works (loading states, success messages)
- Download simulation (could generate a small placeholder video file)
- Database persistence for mock video metadata

**Phase 1A Validation Focus:**
- **Prompt Quality**: Are generated prompts cinematic and VEO-optimized?
- **UI Flow**: Does the Step 8 workflow feel natural and intuitive?
- **Settings Integration**: Are global cinematography settings properly applied?
- **Character Images**: Do character images integrate smoothly with prompts?
- **Cost Transparency**: Is the credit cost structure clear to users?
- **Data Flow**: Does scene data → prompt conversion work reliably?

**Mock Implementation Notes:**
- Credit deduction should work exactly as real implementation
- All database operations should be production-ready
- UI should be indistinguishable from real VEO integration
- Focus on perfecting the most complex part: prompt generation

---

## Success Metrics

### **Technical Metrics**
- **Prompt Quality**: User prompt edit rate (target: <30%)
- **Generation Success**: Video generation success rate (target: >95%)
- **Performance**: Average prompt generation time (target: <2 seconds)
- **Reliability**: API error rate (target: <5%)

### **Business Metrics**
- **Adoption**: Percentage of projects that use Step 8 (target: 20%+)
- **Revenue**: Video production revenue vs screenplay revenue
- **User Satisfaction**: User ratings for video quality
- **Cost Efficiency**: Credit cost per successful video

---

## Risk Assessment & Mitigation

### **Technical Risks**
- **VEO API Changes**: Monitor VEO API updates, maintain flexible integration
- **Rate Limiting**: Implement robust queue management and user communication
- **Video Quality**: Provide clear expectations about AI video limitations

### **Business Risks**
- **Cost Overruns**: Strict credit checking, no subsidized generations
- **User Confusion**: Clear separation from core screenplay workflow
- **Feature Complexity**: Maintain simplicity, avoid feature creep

---

## Future Enhancements

### **Advanced Features**
- **Video Assembly**: Stitch multiple scene videos into complete film
- **Transition Effects**: Add transitions between scenes
- **Audio Enhancement**: Custom music and sound effects
- **Batch Download**: Download all project videos as zip file

### **Technical Improvements**
- **Caching**: Cache frequently used prompts and settings
- **Preprocessing**: Pre-generate prompts during dialogue creation
- **Analytics**: Advanced usage analytics and optimization suggestions
- **Integration**: Deeper integration with existing creative direction system

---

## Conclusion

This specification provides a comprehensive roadmap for implementing VEO video generation as Step 8 while maintaining the integrity and simplicity of the existing screenplay generation workflow. The system is designed to be financially sustainable, technically robust, and user-friendly, providing genuine value to users while protecting the core business model.

The modular architecture ensures that video production capabilities can be developed and deployed independently, with minimal risk to the existing platform functionality. The credit-gated approach naturally controls costs while providing users with powerful video generation capabilities that complement their completed screenplays.

---

**Document End**

*This specification serves as the primary reference for VEO Video Generation Step 8 implementation. All development decisions should align with the principles and architecture outlined in this document.*
