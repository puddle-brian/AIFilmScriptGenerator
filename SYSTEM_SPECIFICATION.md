# Film Script Generator - System Specification

## Overview

The Film Script Generator is a hierarchical story development system that uses **progressive prompt refinement** to guide users from high-level story concepts to detailed screenplay content. The core principle is that each level of detail builds upon all previous levels, creating a coherent narrative structure through **hierarchical context management**.

The system now includes a comprehensive **Profile System** with PostgreSQL database integration for managing custom libraries, project persistence, and user data across multiple devices.

## Core Architecture: Hierarchical Context System

The system operates on a **5-level hierarchical context architecture** where each level contains and builds upon all previous levels:

### Level 1: Story Foundation
- **Purpose**: Establishes the fundamental story concept and creative influences
- **Contains**: 
  - Story title, logline, structured character data
  - Tone/style selection
  - Creative influences (directors, screenwriters, films) from default + custom libraries
  - Total scene count target
- **Context Role**: Forms the base context that influences all subsequent generations
- **Database Integration**: Story input data is stored in PostgreSQL for project persistence

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

## Profile System & Database Integration

### Database Architecture
The system uses **PostgreSQL** with the following schema:

```sql
-- Users table for profile management
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User libraries for custom influences
CREATE TABLE user_libraries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    library_type VARCHAR(50) NOT NULL, -- 'directors', 'screenwriters', 'films', 'tones', 'characters'
    entry_key VARCHAR(255) NOT NULL,
    entry_data JSONB NOT NULL, -- Flexible storage for name, description, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User projects for persistence across devices
CREATE TABLE user_projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    project_title VARCHAR(255) NOT NULL,
    project_data JSONB NOT NULL, -- Complete project state
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Profile Management Features

#### Custom Libraries
- **Directors Library**: Store custom directors with descriptions and styles
- **Screenwriters Library**: Store custom screenwriters with notable works and approaches
- **Films Library**: Store custom film references with analysis and influence notes
- **Tones Library**: Store custom tones and mood descriptors
- **Characters Library**: Store reusable character templates with names and descriptions

#### Project Management
- **Project Persistence**: All projects saved to database with complete state
- **Cross-Device Access**: Projects accessible from any device with profile login
- **Project Cards**: Visual project browser with titles, loglines, and progress indicators
- **Project Migration**: Automatic migration from file-based to database storage

### Character Management System

#### Structured Character Input
- **Replaces**: Single textarea for character descriptions
- **New System**: Modal-based character creation with structured fields
- **Features**:
  - Individual character cards with name and description
  - Edit/delete functionality for each character
  - Import from character library
  - Visual character list with validation
  - Backward compatibility with existing projects

#### Character Library Integration
- **Reusable Characters**: Build library of character templates
- **Quick Import**: One-click import from personal character library
- **Structured Data**: Maintains AI prompt compatibility while providing organization

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
- Context is also stored in PostgreSQL for cross-device access
- Context is rebuilt and validated at each level
- Missing context triggers appropriate error handling and user guidance

### Custom Library Integration
- Influence dropdowns combine default JSON data with user's custom libraries
- Real-time loading of user libraries during dropdown population
- Automatic deduplication of entries across default and custom sources

## User Workflow

### Step 0: Profile Setup (New)
- User creates profile and manages custom libraries
- Import existing projects from file system to database
- Set up reusable characters, directors, screenwriters, films, and tones
- **Output**: Personalized creative environment established

### Step 1: Story Input (Enhanced)
- User defines story concept using structured character system
- Select influences from combined default + custom libraries
- System captures creative DNA of the project
- **Output**: Level 1 context established
- **Database**: Story input saved to user_projects table

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
- **Database**: Final project state saved with completion status

## Technical Implementation

### Database Connection
```javascript
// PostgreSQL connection using environment variables
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

### API Endpoints

#### Core Generation
- `/api/generate-structure` - Generates Level 3 story acts from Levels 1+2
- `/api/generate-plot-points-for-act/:projectPath/:actKey` - Generates Level 4 from Levels 1+2+3
- `/api/generate-scene/:projectPath/:actKey` - Generates Level 5 from Levels 1+2+3+4
- `/api/generate-dialogue` - Generates screenplay from all levels

#### Profile Management
- `/api/users` - User CRUD operations
- `/api/user-libraries/:userId/:type` - Library management (GET, POST, PUT, DELETE)
- `/api/user-projects/:userId` - Project management (GET, POST, PUT, DELETE)

#### Project Persistence
- `/api/save-project` - Dual save to file system and database
- `/api/load-project/:projectPath` - Load project with database fallback
- `/api/migrate-projects` - Migrate existing file-based projects to database

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
  
  // Database integration
  saveContextToDatabase(userId, projectId, context)
  loadContextFromDatabase(userId, projectId)
}
```

### Dual Storage System
The system maintains both file-based storage (for app functionality) and database storage (for profiles):

```javascript
async function saveProject(projectData) {
  // Save to file system for app functionality
  await saveToFileSystem(projectData);
  
  // Save to database for profile system
  await saveToDatabase(projectData);
}
```

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

public/
  profile.html              # Profile management interface
  profile.css               # Profile styling
  profile.js                # Profile functionality
  regenerate.html           # Project regeneration interface
```

## Key Design Principles

### 1. Hierarchical Coherence
Every piece of content is generated with full awareness of all higher-level context, ensuring thematic and structural consistency.

### 2. Causal Narrative Flow
Plot points establish causal relationships between story beats, preventing disconnected or arbitrary scene sequences.

### 3. Progressive Refinement
Each level adds specificity while maintaining the essence established in previous levels.

### 4. Context Preservation
All context is persistent and reloadable, allowing for iterative development and revision across devices.

### 5. Template Flexibility
Multiple story structure templates accommodate different narrative approaches while maintaining the hierarchical system.

### 6. User-Centric Design (New)
Profile system provides personalized creative environment with custom libraries and project management.

### 7. Data Persistence (New)
Dual storage ensures both immediate functionality and long-term accessibility across devices.

## Critical Success Factors

### 1. Plot Points Before Scenes
The system MUST generate plot points before scenes. Attempting to generate plot points from existing scenes creates backwards causality and narrative incoherence.

### 2. Complete Context Chains
Every generation must include the complete context chain from Level 1 through the current level.

### 3. Template Adherence
Generated content must respect the selected story structure template while incorporating the specific story acts.

### 4. Causal Logic
Plot points must use explicit causal connectors ("BUT" for conflict/complications, "THEREFORE" for consequences/progress) to create logical story progression, avoiding weak "and then" chronological sequencing.

### 5. Database Integrity (New)
All database operations must maintain referential integrity and handle connection failures gracefully.

### 6. Backward Compatibility (New)
New systems must maintain compatibility with existing file-based projects during migration.

## User Experience Goals

1. **Guided Creativity**: System provides structure while preserving creative freedom
2. **Coherent Development**: Every step maintains connection to the overall story vision
3. **Iterative Refinement**: Users can regenerate any level while maintaining hierarchical integrity
4. **Professional Output**: Final screenplay meets industry standards and narrative coherence
5. **Personalized Environment**: Custom libraries and project management enhance creative workflow
6. **Cross-Device Continuity**: Projects and libraries accessible from any device
7. **Structured Data Entry**: Character and influence systems provide organization without limiting creativity

## Security Considerations

### Database Security
- Connection strings stored in environment variables
- SQL injection prevention through parameterized queries
- User data isolation through proper foreign key constraints

### Data Privacy
- User projects stored with user-specific access controls
- No sensitive personal data collection beyond username/email
- Optional email field for future feature development

## Future Enhancements

### Immediate Roadmap
- Multi-user collaboration on projects
- Advanced character arc tracking across hierarchical levels
- Theme development integration
- Export to professional screenplay formats (Final Draft, Celtx)

### Long-term Vision
- AI-assisted story analysis and improvement suggestions
- Multiple ending generation and comparison
- Collaborative editing with shared context management
- Integration with professional writing tools
- Advanced analytics on story structure effectiveness

### Profile System Extensions
- Team/organization accounts for collaborative writing
- Public library sharing for community-contributed influences
- Project templates based on successful story patterns
- Advanced project analytics and writing habit tracking

---

This specification serves as the definitive guide for understanding and maintaining the Film Script Generator's hierarchical prompt architecture and integrated profile system. The combination of structured story development with personalized creative tools creates a comprehensive screenwriting environment that scales from individual creativity to professional production workflows. 