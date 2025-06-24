# Project System Architecture Upgrade Plan

**Goal**: Simplify project management, eliminate "invalid project folder" errors, and create a robust foundation for feature completion.

**Philosophy**: Each step reduces complexity while fixing real problems. Every change is incremental, testable, and reversible.

---

## Current Problems (User Impact)
- ❌ "Skipping invalid project folder" spam in logs
- ❌ Some projects don't appear in project list
- ❌ Inconsistent project loading behavior
- ❌ Complex dual storage system (files + database)

## Success Vision (After Completion)
- ✅ All projects load reliably
- ✅ Clean logs with no "skipping" messages
- ✅ Single source of truth for project data
- ✅ Simpler codebase with fewer edge cases

---

## Phase 1: Stop the Bleeding (Week 1)
**Goal**: Fix immediate user-facing issues without architectural changes

### Step 1.1: Robust Project Detection + Story-Concept-First Hierarchical
**What**: Make project listing handle both old and new formats gracefully + Fix new projects to start hierarchical
**Why**: Eliminates "invalid project folder" errors + Ensures new projects use modern format from day one
**Complexity**: Reduces (removes error spam, handles edge cases, fixes architectural flaw)

**Critical Fix**: New projects with just story concept should be hierarchical, not partial/legacy!

**Implementation**:
```javascript
// Replace current rigid detection with flexible detection
async function detectProjectFormat(projectPath) {
  // Check for hierarchical format - EITHER structure OR story concept
  if (await fileExists('01_structure/plot_structure.json')) return 'hierarchical';
  if (await fileExists('01_structure/story_concept.json')) return 'hierarchical'; // NEW!
  // Check for old format
  if (await fileExists('project.json')) return 'legacy';
  // Check for incomplete projects
  if (await fileExists('context.json')) return 'partial';
  return 'invalid';
}

// NEW: Auto-save creates hierarchical projects from the start
async function autoSaveProject(projectData) {
  // Save story concept to hierarchical location
  await saveFile('01_structure/story_concept.json', {
    storyInput: projectData.storyInput,
    projectId: projectData.projectId,
    createdAt: new Date().toISOString()
  });
  // Structure will be added later when generated
}
```

**Success Metrics**:
- [ ] Zero "Skipping invalid project folder" messages in logs
- [ ] All existing projects appear in project list (even if marked as "needs migration")
- [ ] No breaking changes to existing functionality

**Test Plan**:
1. Start server, check logs - should be clean
2. Visit project list - should show all projects
3. Load various project types - should work or show helpful message

---

### Step 1.2: Graceful Project Loading
**What**: Add fallback loading for different project formats
**Why**: Users can access all their projects regardless of format
**Complexity**: Reduces (unified loading interface)

**Implementation**:
```javascript
async function loadProjectUniversal(projectPath) {
  const format = await detectProjectFormat(projectPath);
  
  switch(format) {
    case 'hierarchical': return loadHierarchicalProject(projectPath);
    case 'legacy': return loadLegacyProject(projectPath);
    case 'partial': return loadPartialProject(projectPath);
    default: throw new Error(`Project ${projectPath} is corrupted`);
  }
}
```

**Success Metrics**:
- [ ] All project types load without errors
- [ ] Legacy projects show "migration available" notice
- [ ] Partial projects show "completion available" notice
- [ ] Clean error messages for truly corrupted projects

**Test Plan**:
1. Load each project type from the project list
2. Verify correct data displays for each format
3. Confirm appropriate notices appear

---

## Phase 2: Simplify Storage (Week 2)
**Goal**: Move to database-first architecture, eliminate dual storage complexity

### Step 2.1: Database-First Project Saving
**What**: Make database the primary storage, files become cache
**Why**: Eliminates sync issues between file system and database
**Complexity**: Reduces (single source of truth)

**Current Problem**: 
```javascript
// Complex dual save that can get out of sync
await saveToFileSystem(projectData);
await saveToDatabase(projectData);
```

**Simplified Solution**:
```javascript
// Simple: database is truth, files are cache
await saveToDatabase(projectData);
await cacheToFileSystem(projectData); // Optional, for performance
```

**Success Metrics**:
- [x] All new projects save to database first
- [x] File system becomes optional cache layer
- [x] No sync conflicts between storage systems
- [x] Faster project saves (no dual writes)

**Test Plan**:
1. Create new project - should save to database immediately
2. Check file system - cache should be created asynchronously
3. Delete file cache - project should still load from database

---

### Step 2.2: Unified Project Format
**What**: Standardize all projects to single JSON format in database
**Why**: Eliminates format detection complexity
**Complexity**: Reduces (one format to handle)

**Implementation**:
```javascript
// Single, comprehensive project format
const unifiedProjectFormat = {
  id: 'uuid',
  title: 'string',
  userId: 'string',
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  
  // All project data in one place
  storyInput: {},
  template: {},
  structure: {},
  plotPoints: {},
  scenes: {},
  dialogue: {},
  
  // Metadata
  formatVersion: '2.0',
  completionStatus: 'draft|structured|scenes|dialogue|complete'
};
```

**Success Metrics**:
- [ ] New projects use unified format
- [ ] Old projects can be migrated on-demand
- [ ] Project loading code simplified (no format switching)
- [ ] Database queries more efficient

**Test Plan**:
1. Create new project - should use unified format
2. Load old project - should offer migration
3. Migrate old project - should work seamlessly

---

## Phase 3: Migration Strategy (Week 3)
**Goal**: Move existing projects to new system without data loss

### Step 3.1: Lazy Migration
**What**: Migrate projects when they're accessed, not all at once
**Why**: Reduces risk, spreads load, preserves working projects
**Complexity**: Reduces (eliminates big-bang migration complexity)

**Implementation**:
```javascript
async function loadProject(projectId) {
  // Try database first
  let project = await loadFromDatabase(projectId);
  
  // If not in database, migrate from file system
  if (!project) {
    project = await migrateProjectFromFileSystem(projectId);
    await saveToDatabase(project);
  }
  
  return project;
}
```

**Success Metrics**:
- [ ] Projects migrate automatically when accessed
- [ ] No mass migration required
- [ ] Failed migrations don't break other projects
- [ ] Migration progress is visible to users

**Test Plan**:
1. Access old project - should migrate automatically
2. Check database - should contain migrated project
3. Access same project again - should load from database
4. Simulate migration failure - should not break system

---

### Step 3.2: Migration UI
**What**: Add simple UI for users to see migration status
**Why**: Users understand what's happening, can control process
**Complexity**: Reduces (clear user communication)

**Implementation**:
```javascript
// Simple migration status component
{
  "projectId": "123",
  "title": "My Story",
  "status": "needs_migration", // or "migrated", "migrating", "error"
  "migrateButton": true
}
```

**Success Metrics**:
- [ ] Users can see which projects need migration
- [ ] Users can trigger migration manually if desired
- [ ] Clear progress indicators during migration
- [ ] Helpful error messages for failed migrations

**Test Plan**:
1. Project list shows migration status
2. Click migrate button - should show progress
3. Refresh page - should show updated status
4. Simulate error - should show helpful message

---

## Phase 4: Cleanup (Week 4)
**Goal**: Remove old code, simplify architecture

### Step 4.1: Remove Dual Storage Code
**What**: Delete file-system-first project code
**Why**: Eliminates complexity, reduces maintenance burden
**Complexity**: Reduces (less code, fewer paths)

**What Gets Removed**:
- Dual save functions
- Format detection logic
- Complex fallback loading
- File system sync code

**What Stays**:
- Database operations
- Caching layer (optional)
- Migration utilities (temporarily)

**Success Metrics**:
- [ ] 30% reduction in project-related code
- [ ] No dual storage complexity
- [ ] Faster project operations
- [ ] Cleaner error handling

---

### Step 4.2: Performance Optimization
**What**: Add intelligent caching since database is now source of truth
**Why**: Fast loading without file system complexity
**Complexity**: Reduces (simple cache vs complex dual storage)

**Implementation**:
```javascript
// Simple in-memory cache
const projectCache = new Map();

async function loadProject(projectId) {
  // Check cache first
  if (projectCache.has(projectId)) {
    return projectCache.get(projectId);
  }
  
  // Load from database
  const project = await loadFromDatabase(projectId);
  projectCache.set(projectId, project);
  return project;
}
```

**Success Metrics**:
- [ ] Sub-100ms project loading (cached)
- [ ] Sub-500ms project loading (uncached)
- [ ] Memory usage stays reasonable
- [ ] Cache invalidation works correctly

---

## Implementation Strategy

### Development Approach
1. **Feature Flags**: Each step behind a flag, can be toggled off
2. **Backwards Compatibility**: Old system works until new system proven
3. **Incremental Testing**: Each step tested in isolation
4. **Rollback Plan**: Every step can be undone quickly

### Risk Mitigation
- **Database Backup**: Before any database changes
- **File System Backup**: Before any file operations
- **Staged Rollout**: Test with subset of projects first
- **Monitoring**: Track success metrics at each step

### Success Criteria for Full Completion
- [ ] Zero "invalid project folder" messages
- [ ] All projects load reliably
- [ ] Single source of truth (database)
- [ ] 30% less project-related code
- [ ] Sub-500ms average project load time
- [ ] No user data loss during migration

---

## Why This Approach Works

1. **Incremental**: Each step is small and testable
2. **Reversible**: Can roll back any step if issues arise
3. **User-Focused**: Fixes visible problems first
4. **Simplifying**: Each step reduces overall complexity
5. **Risk-Aware**: Migration strategy prevents data loss

This plan prioritizes **working software** over perfect architecture, while still moving toward a cleaner system. Each phase builds on the previous one, and you can stop at any point with a working system that's better than what you started with. 