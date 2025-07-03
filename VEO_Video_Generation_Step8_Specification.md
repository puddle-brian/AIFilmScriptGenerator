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

### **Scene Detail Interface**
```
┌─ Scene 1.1: Hero Enters Tavern ─────────────────────────────────┐
│  📍 Medieval Tavern • 🕐 Night • 👥 Hero, Bartender, Crowd      │
│  💬 "HERO: I need information about the missing crown..."       │
│                                                                 │
│  ┌─ VEO Prompt ────────────────────────────────────────────┐   │
│  │ Status: ⏳ Ready to Generate                             │   │
│  │ Cost: 75 credits                                        │   │
│  │                                                         │   │
│  │ [🎬 Generate VEO Prompt] (5 credits)                   │   │
│  │ [👁️ Preview Prompt] [⚙️ Scene Overrides]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─ Generated Prompt (Editable) ──────────────────────────┐   │
│  │ Subject: Hooded hero in medieval clothing               │   │
│  │ Context: Dimly lit tavern with stone walls, wooden...   │   │
│  │ Action: Hero pushes through heavy doors, approaches...  │   │
│  │ Style: Cinematic, dramatic lighting, handheld camera... │   │
│  │ Camera Motion: Slow tracking shot following hero...     │   │
│  │ Composition: Medium shot transitioning to close-up...   │   │
│  │ Ambiance: Warm firelight, deep shadows, atmospheric...  │   │
│  │ Audio: "I need information about the missing crown"...  │   │
│  │                                                         │   │
│  │ [💾 Save Changes] [🎬 Generate Video] (75 credits)     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
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

### **Prompt Generation Algorithm**
1. **Subject Extraction**: Identify primary character from scene.characters[0]
2. **Context Building**: Combine location + time_of_day + description atmosphere
3. **Action Synthesis**: Extract key dialogue + physical actions from description
4. **Style Application**: Apply global cinematography + story influences
5. **Technical Parameters**: Add camera motion, composition, audio settings
6. **Character Integration**: Include character images if available
7. **Customization Layer**: Apply any scene-specific overrides

---

## Character Management System

### **Character Library Enhancement**
Extend existing `/api/user-libraries/{username}/characters` with image support:

```json
{
  "characterId": "hero_001",
  "name": "Hero",
  "description": "Tall, dark hair, serious expression",
  "personality_traits": ["brave", "determined", "mysterious"],
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

### **Character Consistency Strategy**
- **Auto-Detection**: System identifies characters in scenes
- **Image Mapping**: Links scene characters to library entries with images
- **Fallback Graceful**: Uses text descriptions when no image available
- **Consistency Warnings**: "3 characters missing images - add for visual consistency?"

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

### **Credit Checking Flow**
```javascript
// Before every operation
async function checkCredits(operation, estimatedCost) {
  const userCredits = await getUserCredits(userId);
  
  if (userCredits < estimatedCost) {
    showInsufficientCreditsModal(estimatedCost, userCredits);
    return false;
  }
  
  showCostConfirmation(operation, estimatedCost);
  return true;
}
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

### **Download Management**
- **Temporary URLs**: VEO provides temporary download links
- **Browser Download API**: Automatic file download trigger
- **Progress Tracking**: Show download progress for large files
- **Retry Mechanism**: Handle failed downloads gracefully

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

### **Character Image Fallbacks**
- **Text-Only Mode**: Generate prompts using character descriptions
- **Partial Images**: Handle projects with some character images missing
- **Quality Warnings**: Inform users about consistency impact

---

## Implementation Phases

### **Phase 1: Core Infrastructure**
1. Database schema extensions
2. Basic Step 8 UI framework
3. Global settings management
4. Character image upload system

### **Phase 2: Prompt Generation**
1. VEO prompt builder system
2. Scene data integration
3. Global settings application
4. Prompt preview and editing

### **Phase 3: Video Generation**
1. VEO API integration
2. Long-running operation handling
3. Progress tracking system
4. Download management

### **Phase 4: Polish & Optimization**
1. Batch operations
2. Advanced error handling
3. Performance optimization
4. User experience refinements

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

### **User Experience Metrics**
- **Workflow Completion**: Percentage of users who complete video generation after starting
- **Credit Spend**: Average credits spent per project on video production
- **Support Tickets**: Video-related support requests (target: minimize)

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

### **User Experience Risks**
- **Expensive Mistakes**: Clear cost warnings, prompt previews
- **Technical Barriers**: Graceful fallbacks, helpful error messages
- **Workflow Disruption**: Complete isolation from Steps 1-6

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

### **Business Expansion**
- **Premium Features**: Advanced cinematography options for higher tiers
- **Bulk Pricing**: Discounts for large-scale video generation
- **Professional Tools**: Export options for professional video editing software

---

## Conclusion

This specification provides a comprehensive roadmap for implementing VEO video generation as Step 8 while maintaining the integrity and simplicity of the existing screenplay generation workflow. The system is designed to be financially sustainable, technically robust, and user-friendly, providing genuine value to users while protecting the core business model.

The modular architecture ensures that video production capabilities can be developed and deployed independently, with minimal risk to the existing platform functionality. The credit-gated approach naturally controls costs while providing users with powerful video generation capabilities that complement their completed screenplays.

---

**Document End**

*This specification serves as the primary reference for VEO Video Generation Step 8 implementation. All development decisions should align with the principles and architecture outlined in this document.* 