# Multi-Threading Plot Points - Design Specification

## Vision & Problem Statement

**Current System**: The Film Script Generator creates single-threaded plot points - each plot point advances one main storyline in a linear progression with causal chain icons (🔗).

**The Opportunity**: Real screenplays often weave multiple storylines together - A-plots and B-plots, dual timelines, ensemble character arcs, parallel narratives. These create richer, more engaging stories by allowing different threads to intersect, conflict, and complement each other.

## Core Concept

Add **multi-threaded plot point generation** that maintains the existing causal chain system but allows each plot point to contain multiple story threads that can:
- Run parallel to each other
- Intersect at dramatic moments  
- Have different pacing and focus
- Maintain separate causal chains with distinct icons (🔗A, 🔗B, etc.)

## Key Design Principles

### 1. **Backward Compatibility**
- All existing projects continue working unchanged
- Single-thread remains the default mode
- Multi-threading is an optional enhancement layer

### 2. **Chain Icon Evolution** 
- Preserve the beloved 🔗 system users are familiar with
- Extend it naturally: 🔗A for A-thread, 🔗B for B-thread, etc.
- Each thread maintains its own causal flow

### 3. **User Experience Goals**
- **Simple Selection**: Choose from preset patterns like "A-Plot/B-Plot", "Dual Timeline", "Ensemble Cast"
- **Clear Visualization**: See which threads are active in each plot point
- **Intersection Highlights**: Special callouts when threads intersect or influence each other
- **Familiar Interface**: Feels like a natural extension of current system

## Threading Patterns

### Pattern 1: A-Plot/B-Plot (70/30)
- **A-Thread**: Main story progression (action, external conflict)
- **B-Thread**: Character/relationship development (emotional, internal growth)
- **Rhythm**: A,A,B,A,A,B (A-thread dominates, B-thread provides emotional beats)
- **Use Case**: Classic Hollywood structure where plot drives but character depth adds richness

### Pattern 2: Dual Timeline
- **A-Thread**: Present day events
- **B-Thread**: Flashbacks/memories that reveal backstory
- **Intersections**: Moments where past and present connect dramatically
- **Use Case**: Mysteries, character studies, non-linear narratives

### Pattern 3: Ensemble Cast
- **A-Thread**: Main protagonist journey
- **B-Thread**: Secondary character arc
- **C-Thread**: Antagonist/parallel story
- **Use Case**: Complex narratives with multiple important characters

### Pattern 4: Single Thread (Default)
- Current system behavior
- Single 🔗 chain
- Linear progression

## User Interface Vision

### Thread Selection
```
Plot Point Generation:
┌─────────────────────────────────────────┐
│ Threading Pattern: [A-Plot/B-Plot ▼]    │
│                                         │
│ ○ Single Thread (current)               │
│ ● A-Plot/B-Plot (70/30)                │
│ ○ Dual Timeline                        │
│ ○ Ensemble Cast                        │
└─────────────────────────────────────────┘
```

### Plot Point Display
```
Current Single Thread:
1. Hero receives mysterious letter that changes everything 🔗

Multi-Thread Example:
1. [A] Hero receives mysterious letter at work 🔗A
   [B] Meanwhile, his sister discovers family secret 🔗B
   🔀 Intersection: Both revelations connect to same hidden truth

2. [A] Hero investigates letter's origin 🔗A

3. [B] Sister confronts parents about secret 🔗B
```

## Technical Approach (High Level)

### Data Structure
- **Backward Compatible**: Existing string plot points continue working
- **Enhanced Format**: New plot points can contain multiple threads
- **Thread Metadata**: Track which threads are active, their relationships
- **Intersection Data**: Special markers for convergence points

### Generation Process
- **Pattern Selection**: User chooses threading pattern
- **Rhythm Control**: System follows pattern's rhythm (A,A,B,A,A,B)
- **Context Aware**: Each thread maintains its own causal history
- **Intersection Logic**: Special handling for convergence points

## Current Status & Next Steps

### ✅ Completed (Technical Foundation)
- Threading pattern definitions
- Core engine for managing multiple threads
- Enhanced prompt system for AI generation
- Backward compatibility systems
- API enhancements for threading support

### 🚧 In Progress
- User interface integration
- Thread visualization components
- Pattern selection interface

### 📋 Future Enhancements
- **Custom Patterns**: Let users define their own threading rhythms
- **Visual Thread Mapping**: Flowchart view of how threads intersect
- **Template Integration**: Threading patterns specific to story structures
- **Advanced Intersections**: More sophisticated thread relationships

## Success Criteria

### For Users
- **Intuitive**: Feels like natural extension of current system
- **Optional**: Can ignore threading and use system as before  
- **Powerful**: Enables more sophisticated story structures
- **Clear**: Easy to see which threads are active when

### For System
- **Stable**: No breaking changes to existing functionality
- **Scalable**: Easy to add new threading patterns
- **Maintainable**: Clean separation between single and multi-thread logic
- **Performance**: No slowdown for users who don't use threading

## Why This Matters

**For Screenwriters**: Enables creation of more sophisticated, professionally-structured screenplays with multiple interwoven storylines.

**For the Platform**: Differentiates from simpler story generators by supporting complex narrative structures that mirror professional screenwriting techniques.

**For User Experience**: Provides growth path - users can start simple and gradually explore more advanced storytelling as they become comfortable with the system.

---

*This spec captures the vision for multi-threaded plot point generation. The technical implementation can be revisited and refined based on user feedback and system requirements.* 