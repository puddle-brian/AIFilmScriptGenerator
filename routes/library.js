const express = require('express');
const router = express.Router();

// User Libraries Management Routes
// These endpoints handle user library operations: characters, locations, directors, etc.

// GET /api/user-libraries/:username/:type - Get user library
router.get('/user-libraries/:username/:type', async (req, res) => {
  try {
    const libraryService = req.app.get('libraryService');
    const databaseService = req.app.get('databaseService');
    
    if (libraryService) {
      console.log(`🆕 Using LibraryService to get ${req.params.type} library for user: ${req.params.username}`);
      
      const libraries = await libraryService.getUserLibrary(req.params.username, req.params.type);
      return res.json(libraries);
      
    } else {
      // Fallback to existing implementation
      const { username, type } = req.params;
      
      // Get user ID
      const userResult = await databaseService.getUserByUsername(username);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const userId = userResult.rows[0].id;
      
      // Get libraries using LibraryService
      const libraries = await libraryService.getUserLibrary(username, type);
      
      res.json(libraries);
    }
  } catch (error) {
    console.error('Failed to fetch user libraries:', error);
    res.status(500).json({ error: 'Failed to fetch user libraries' });
  }
});

// POST /api/user-libraries/:username/:type/:key - Create library entry
router.post('/user-libraries/:username/:type/:key', async (req, res) => {
  try {
    const libraryService = req.app.get('libraryService');
    
    if (libraryService) {
      console.log(`🆕 Using LibraryService to create ${req.params.type} entry for user: ${req.params.username}`);
      
      const result = await libraryService.createLibraryEntry(
        req.params.username, 
        req.params.type, 
        req.params.key, 
        req.body
      );
      return res.json(result);
      
    } else {
      throw new Error('LibraryService not available');
    }
  } catch (error) {
    // 🔧 Handle duplicate entry gracefully
    if (error.code === 'DUPLICATE_ENTRY' && error.statusCode === 409) {
      console.log(`⚠️ Duplicate entry: ${error.message}`);
      return res.status(409).json({ 
        error: error.message,
        code: 'DUPLICATE_ENTRY'
      });
    }
    
    console.error('Failed to save library entry:', error);
    res.status(500).json({ error: 'Failed to save library entry' });
  }
});

// PUT /api/user-libraries/:username/:type/:key - Update library entry
router.put('/user-libraries/:username/:type/:key', async (req, res) => {
  try {
    const libraryService = req.app.get('libraryService');
    
    if (libraryService) {
      console.log(`🆕 Using LibraryService to update ${req.params.type} entry for user: ${req.params.username}`);
      
      const result = await libraryService.updateLibraryEntry(
        req.params.username, 
        req.params.type, 
        req.params.key, 
        req.body
      );
      return res.json(result);
      
    } else {
      throw new Error('LibraryService not available');
    }
  } catch (error) {
    console.error('Failed to update library entry:', error);
    res.status(500).json({ error: 'Failed to update library entry' });
  }
});

// DELETE /api/user-libraries/:username/:type/:key - Delete library entry
router.delete('/user-libraries/:username/:type/:key', async (req, res) => {
  try {
    const libraryService = req.app.get('libraryService');
    
    if (libraryService) {
      console.log(`🆕 Using LibraryService to delete ${req.params.type} entry for user: ${req.params.username}`);
      
      const result = await libraryService.deleteLibraryEntry(
        req.params.username, 
        req.params.type, 
        req.params.key
      );
      return res.json(result);
      
    } else {
      throw new Error('LibraryService not available');
    }
  } catch (error) {
    console.error('Failed to delete library entry:', error);
    res.status(500).json({ error: 'Failed to delete library entry' });
  }
});

// POST /api/user-libraries/:username/populate-starter-pack - Populate starter pack for user
router.post('/user-libraries/:username/populate-starter-pack', async (req, res) => {
  try {
    const libraryService = req.app.get('libraryService');
    const starterPack = req.app.get('starterPack');
    
    if (libraryService) {
      console.log(`🆕 Using LibraryService to populate starter pack for user: ${req.params.username}`);
      
      // Get starter pack data from dedicated module
      const starterPackData = starterPack.getStarterPackData();
      
      const result = await libraryService.populateStarterPack(req.params.username, starterPackData);
      
      // Add original counts for compatibility
      const counts = starterPack.getStarterPackCounts();
      result.counts = {
        directors: counts.directors,
        screenwriters: counts.screenwriters,
        films: counts.films,
        tones: counts.tones,
        characters: counts.characters,
        total: result.totalInserted
      };
      
      result.message = `Starter pack populated successfully! Added ${counts.directors} directors, ${counts.screenwriters} screenwriters, ${counts.films} films, ${counts.tones} tones, and ${counts.characters} characters.`;
      
      return res.json(result);
      
    } else {
      throw new Error('LibraryService not available');
    }
    
  } catch (error) {
    console.error('Failed to populate starter pack:', error);
    res.status(500).json({ error: 'Failed to populate starter pack' });
  }
});

module.exports = { router }; 