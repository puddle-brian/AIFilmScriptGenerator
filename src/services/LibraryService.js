class LibraryService {
  constructor(databaseService, logger = console) {
    this.db = databaseService;
    this.logger = logger;
    
    // Valid library types
    this.validTypes = ['directors', 'screenwriters', 'films', 'tones', 'characters', 'storyconcepts'];
  }

  // ==================================================
  // LIBRARY RETRIEVAL
  // ==================================================

  async getUserLibrary(username, type) {
    try {
      this.validateLibraryType(type);
      this.logger.log(`📖 Loading ${type} library for user: ${username}`);
      
      // Get user ID
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userResult.rows[0].id;
      
      // Get library entries
      const result = await this.db.getUserLibraryEntries(userId, type);
      
      this.logger.log(`✅ Loaded ${result.rows.length} ${type} entries for user: ${username}`);
      return result.rows;
      
    } catch (error) {
      this.logger.error(`Error loading ${type} library for ${username}:`, error);
      throw error;
    }
  }

  async getAllUserLibraries(username) {
    try {
      this.logger.log(`📚 Loading all libraries for user: ${username}`);
      
      const libraries = {};
      
      // Load each library type
      for (const type of this.validTypes) {
        try {
          libraries[type] = await this.getUserLibrary(username, type);
        } catch (error) {
          this.logger.warn(`Failed to load ${type} library for ${username}:`, error.message);
          libraries[type] = [];
        }
      }
      
      const totalEntries = Object.values(libraries).reduce((sum, lib) => sum + lib.length, 0);
      this.logger.log(`✅ Loaded all libraries for ${username}: ${totalEntries} total entries`);
      
      return libraries;
      
    } catch (error) {
      this.logger.error(`Error loading all libraries for ${username}:`, error);
      throw error;
    }
  }

  // ==================================================
  // LIBRARY ENTRY MANAGEMENT
  // ==================================================

  async createLibraryEntry(username, type, key, entryData) {
    try {
      this.validateLibraryType(type);
      this.validateEntryData(entryData, type);
      
      this.logger.log(`💾 Creating ${type} entry "${key}" for user: ${username}`);
      
      // Get user ID
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userResult.rows[0].id;
      
      // Create entry using DatabaseService
      const result = await this.db.createLibraryEntry(userId, type, key, entryData);
      
      this.logger.log(`✅ Created ${type} entry "${key}" for user: ${username}`);
      return result.rows[0];
      
    } catch (error) {
      // 🔧 Handle duplicate key constraint gracefully
      if (error.code === '23505' && error.constraint === 'user_libraries_user_id_library_type_entry_key_key') {
        const friendlyName = entryData.name || key;
        const errorMessage = `${type.charAt(0).toUpperCase() + type.slice(0, -1)} "${friendlyName}" already exists in your library.`;
        
        this.logger.warn(`⚠️ Duplicate ${type} entry attempted for ${username}: ${key}`);
        
        const duplicateError = new Error(errorMessage);
        duplicateError.code = 'DUPLICATE_ENTRY';
        duplicateError.statusCode = 409;
        throw duplicateError;
      }
      
      this.logger.error(`Error creating ${type} entry for ${username}:`, error);
      throw error;
    }
  }

  async updateLibraryEntry(username, type, key, entryData) {
    try {
      this.validateLibraryType(type);
      this.validateEntryData(entryData, type);
      
      this.logger.log(`📝 Updating ${type} entry "${key}" for user: ${username}`);
      
      // Get user ID
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userResult.rows[0].id;
      
      // Update entry using DatabaseService
      const result = await this.db.updateLibraryEntry(userId, type, key, entryData);
      
      if (result.rows.length === 0) {
        throw new Error('Library entry not found');
      }
      
      this.logger.log(`✅ Updated ${type} entry "${key}" for user: ${username}`);
      return result.rows[0];
      
    } catch (error) {
      this.logger.error(`Error updating ${type} entry for ${username}:`, error);
      throw error;
    }
  }

  async deleteLibraryEntry(username, type, key) {
    try {
      this.validateLibraryType(type);
      
      this.logger.log(`🗑️ Deleting ${type} entry "${key}" for user: ${username}`);
      
      // Get user ID
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userResult.rows[0].id;
      
      // Delete entry using DatabaseService
      const result = await this.db.deleteLibraryEntry(userId, type, key);
      
      if (result.rows.length === 0) {
        throw new Error('Library entry not found');
      }
      
      this.logger.log(`✅ Deleted ${type} entry "${key}" for user: ${username}`);
      return { success: true };
      
    } catch (error) {
      this.logger.error(`Error deleting ${type} entry for ${username}:`, error);
      throw error;
    }
  }

  // ==================================================
  // STARTER PACK MANAGEMENT
  // ==================================================

  async populateStarterPack(username, starterPackData) {
    try {
      this.logger.log(`🎁 Populating starter pack for user: ${username}`);
      
      // Get user ID
      const userResult = await this.db.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userResult.rows[0].id;
      
      let totalInserted = 0;
      const results = {};
      
      // Process each library type
      for (const [type, items] of Object.entries(starterPackData)) {
        if (!this.validTypes.includes(type)) {
          this.logger.warn(`Skipping invalid library type: ${type}`);
          continue;
        }
        
        let typeInserted = 0;
        
        for (const item of items) {
          try {
            // Generate entry key and data based on type
            const { entryKey, entryData } = this.processStarterPackItem(item, type);
            
            // Insert entry (with conflict handling)
            await this.db.createLibraryEntry(userId, type, entryKey, entryData, true); // allowConflicts = true
            typeInserted++;
            totalInserted++;
            
          } catch (error) {
            this.logger.warn(`Failed to insert ${type} item:`, error.message);
          }
        }
        
        results[type] = typeInserted;
        this.logger.log(`   - ${type}: ${typeInserted} entries`);
      }
      
      this.logger.log(`✅ Starter pack populated for ${username}: ${totalInserted} total entries`);
      
      return {
        success: true,
        totalInserted,
        results,
        message: `Starter pack populated with ${totalInserted} entries`
      };
      
    } catch (error) {
      this.logger.error(`Error populating starter pack for ${username}:`, error);
      throw error;
    }
  }

  // ==================================================
  // UTILITY METHODS
  // ==================================================

  validateLibraryType(type) {
    if (!this.validTypes.includes(type)) {
      throw new Error(`Invalid library type: ${type}. Valid types: ${this.validTypes.join(', ')}`);
    }
  }

  validateEntryData(entryData, type) {
    if (!entryData || typeof entryData !== 'object') {
      throw new Error('Entry data must be an object');
    }
    
    // Type-specific validation
    switch (type) {
      case 'characters':
      case 'storyconcepts':
        if (!entryData.name || !entryData.description) {
          throw new Error(`${type} entries must have both name and description`);
        }
        break;
      
      case 'directors':
      case 'screenwriters':
      case 'films':
      case 'tones':
        if (!entryData.name) {
          throw new Error(`${type} entries must have a name`);
        }
        break;
      
      default:
        if (!entryData.name) {
          throw new Error('Entry must have a name');
        }
    }
  }

  generateEntryKey(name) {
    // Create a URL-safe key from the name
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')  // Remove special characters
      .replace(/\s+/g, '_')         // Replace spaces with underscores
      .substring(0, 50);            // Limit length
  }

  processStarterPackItem(item, type) {
    let entryKey, entryData;
    
    if (typeof item === 'string') {
      // Simple string item (directors, films, etc.)
      entryKey = this.generateEntryKey(item);
      entryData = { name: item };
    } else if (typeof item === 'object' && item.name) {
      // Object with name and possibly description (characters, story concepts)
      entryKey = this.generateEntryKey(item.name);
      entryData = {
        name: item.name,
        description: item.description || ''
      };
    } else {
      throw new Error('Invalid starter pack item format');
    }
    
    return { entryKey, entryData };
  }

  // ==================================================
  // BULK OPERATIONS
  // ==================================================

  async bulkCreateEntries(username, type, entries) {
    try {
      this.validateLibraryType(type);
      
      this.logger.log(`📦 Bulk creating ${entries.length} ${type} entries for user: ${username}`);
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      for (const entry of entries) {
        try {
          const entryKey = this.generateEntryKey(entry.name);
          const result = await this.createLibraryEntry(username, type, entryKey, entry);
          results.push({ success: true, entry: result });
          successCount++;
        } catch (error) {
          results.push({ success: false, error: error.message });
          errorCount++;
        }
      }
      
      this.logger.log(`✅ Bulk create completed: ${successCount} success, ${errorCount} errors`);
      
      return {
        success: true,
        totalProcessed: entries.length,
        successCount,
        errorCount,
        results
      };
      
    } catch (error) {
      this.logger.error(`Error in bulk create for ${username}:`, error);
      throw error;
    }
  }

  async getLibraryStats(username) {
    try {
      this.logger.log(`📊 Getting library stats for user: ${username}`);
      
      const stats = {};
      let totalEntries = 0;
      
      for (const type of this.validTypes) {
        try {
          const entries = await this.getUserLibrary(username, type);
          stats[type] = entries.length;
          totalEntries += entries.length;
        } catch (error) {
          stats[type] = 0;
        }
      }
      
      stats.total = totalEntries;
      
      this.logger.log(`✅ Library stats for ${username}:`, stats);
      return stats;
      
    } catch (error) {
      this.logger.error(`Error getting library stats for ${username}:`, error);
      throw error;
    }
  }
}

module.exports = LibraryService; 