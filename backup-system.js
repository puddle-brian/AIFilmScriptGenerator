/**
 * Database Backup System
 * Handles all backup-related functionality for Screenplay Genie
 */

const fs = require('fs');
const path = require('path');

class BackupSystem {
  constructor(dbClient, __dirname) {
    this.dbClient = dbClient;
    this.baseDir = __dirname;
    this.backupDir = path.join(__dirname, 'backups', 'database');
    
    // Ensure backup directory exists
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('📁 Created backup directory:', this.backupDir);
    }
  }

  async createBackup(options = {}) {
    const {
      saveToServer = true,
      download = true,
      createdBy = 'system'
    } = options;

    console.log('📦 Starting database backup...');
    
    // Generate timestamp for backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `screenplay_genie_backup_${timestamp}`;
    
    // Get all table data
    const backupData = {
      metadata: {
        backupName,
        timestamp: new Date().toISOString(),
        version: '1.0',
        createdBy: createdBy,
        databaseUrl: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'unknown'
      },
      tables: {}
    };

    // Core tables to backup
    const tables = [
      'users',
      'user_projects', 
      'user_libraries',
      'usage_logs_v2',
      'credit_transactions'
    ];

    // Backup each table
    for (const table of tables) {
      try {
        console.log(`📋 Backing up table: ${table}`);
        
        // Get table schema
        const schemaResult = await this.dbClient.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = $1 
          ORDER BY ordinal_position
        `, [table]);

        // Get table data
        const dataResult = await this.dbClient.query(`SELECT * FROM ${table} ORDER BY id`);
        
        // Get row count
        const countResult = await this.dbClient.query(`SELECT COUNT(*) FROM ${table}`);
        
        backupData.tables[table] = {
          schema: schemaResult.rows,
          data: dataResult.rows,
          rowCount: parseInt(countResult.rows[0].count),
          backedUpAt: new Date().toISOString()
        };
        
        console.log(`✅ Table ${table}: ${backupData.tables[table].rowCount} rows backed up`);
      } catch (tableError) {
        console.error(`❌ Error backing up table ${table}:`, tableError.message);
        backupData.tables[table] = {
          error: tableError.message,
          backedUpAt: new Date().toISOString()
        };
      }
    }

    // Add system statistics
    try {
      const statsResult = await this.dbClient.query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM user_projects) as total_projects,
          (SELECT COUNT(*) FROM user_libraries) as total_library_entries,
          (SELECT COUNT(*) FROM usage_logs_v2) as total_usage_logs,
          (SELECT COUNT(*) FROM credit_transactions) as total_credit_transactions,
          (SELECT SUM(credits_remaining) FROM users) as total_credits_remaining,
          (SELECT MAX(created_at) FROM users) as last_user_created
      `);
      
      backupData.statistics = statsResult.rows[0];
    } catch (statsError) {
      console.error('❌ Error getting statistics:', statsError.message);
      backupData.statistics = { error: statsError.message };
    }

    // Calculate backup size
    const backupJson = JSON.stringify(backupData, null, 2);
    const backupSize = Buffer.byteLength(backupJson, 'utf8');
    backupData.metadata.backupSize = backupSize;
    backupData.metadata.backupSizeFormatted = `${(backupSize / 1024 / 1024).toFixed(2)} MB`;

    console.log(`✅ Database backup completed successfully`);
    console.log(`📊 Backup statistics:`, {
      tables: Object.keys(backupData.tables).length,
      size: backupData.metadata.backupSizeFormatted,
      timestamp: timestamp
    });

    // Save to server if requested
    let serverPath = null;
    if (saveToServer) {
      try {
        serverPath = path.join(this.backupDir, `${backupName}.json`);
        fs.writeFileSync(serverPath, backupJson);
        console.log(`✅ Backup saved to server: ${serverPath}`);
      } catch (saveError) {
        console.error('❌ Error saving backup to server:', saveError.message);
      }
    }

    return {
      success: true,
      backupData,
      backupJson,
      backupName,
      serverPath,
      statistics: {
        tables: Object.keys(backupData.tables).length,
        size: backupData.metadata.backupSizeFormatted,
        timestamp: timestamp,
        createdBy: createdBy
      }
    };
  }

  listBackups() {
    console.log('🔍 Listing available backups');
    console.log('📁 Checking backup directory:', this.backupDir);
    
    if (!fs.existsSync(this.backupDir)) {
      console.log('⚠️ Backup directory does not exist');
      return { backups: [], totalBackups: 0, totalSize: 0, directory: this.backupDir };
    }

    const files = fs.readdirSync(this.backupDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          filename: file,
          size: stats.size,
          sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
          created: stats.birthtime,
          modified: stats.mtime,
          fullPath: filePath
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created)); // Newest first

    return { 
      backups: files,
      totalBackups: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      directory: this.backupDir
    };
  }

  getBackupPath(filename) {
    // Security: only allow .json files with specific naming pattern
    if (!filename.match(/^screenplay_genie_backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/)) {
      throw new Error('Invalid backup filename');
    }
    
    const filePath = path.join(this.backupDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Backup file not found');
    }

    return filePath;
  }

  deleteBackup(filename) {
    const filePath = this.getBackupPath(filename); // This handles validation
    
    fs.unlinkSync(filePath);
    console.log(`🗑️ Backup deleted: ${filename}`);
    
    return { 
      success: true,
      message: 'Backup deleted successfully',
      filename: filename
    };
  }

  // Express middleware factory for backup routes
  createRoutes(authenticateApiKey) {
    return {
      // Create backup endpoint
      createBackup: async (req, res) => {
        if (!req.user.is_admin) {
          return res.status(403).json({ error: 'Admin access required' });
        }

        try {
          const options = {
            download: req.body.download !== false,
            saveToServer: req.body.saveToServer !== false,
            createdBy: req.user.username,
            ...req.body
          };
          
          const result = await this.createBackup(options);
          
          if (options.download) {
            // Set response headers for download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${result.backupName}.json"`);
            res.setHeader('Cache-Control', 'no-cache');
            
            // Send the backup data
            res.send(result.backupJson);
          } else {
            // Send success response without download
            res.json({
              success: true,
              message: 'Database backup completed',
              backupName: result.backupName,
              serverPath: result.serverPath,
              statistics: result.statistics
            });
          }
          
        } catch (error) {
          console.error('❌ Database backup failed:', error);
          res.status(500).json({ 
            error: 'Database backup failed',
            details: error.message,
            timestamp: new Date().toISOString()
          });
        }
      },

      // List backups endpoint
      listBackups: async (req, res) => {
        if (!req.user.is_admin) {
          return res.status(403).json({ error: 'Admin access required' });
        }

        try {
          const result = this.listBackups();
          res.json(result);
        } catch (error) {
          console.error('❌ Error listing backups:', error);
          res.status(500).json({ 
            error: 'Failed to list backups',
            details: error.message 
          });
        }
      },

      // Download backup endpoint
      downloadBackup: async (req, res) => {
        if (!req.user.is_admin) {
          return res.status(403).json({ error: 'Admin access required' });
        }

        try {
          const { filename } = req.params;
          const filePath = this.getBackupPath(filename);

          // Set headers for download
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.setHeader('Cache-Control', 'no-cache');
          
          // Stream the file
          const fileStream = fs.createReadStream(filePath);
          fileStream.pipe(res);
        } catch (error) {
          console.error('❌ Error downloading backup:', error);
          if (error.message === 'Invalid backup filename') {
            res.status(400).json({ error: error.message });
          } else if (error.message === 'Backup file not found') {
            res.status(404).json({ error: error.message });
          } else {
            res.status(500).json({ 
              error: 'Failed to download backup',
              details: error.message 
            });
          }
        }
      },

      // Delete backup endpoint
      deleteBackup: async (req, res) => {
        if (!req.user.is_admin) {
          return res.status(403).json({ error: 'Admin access required' });
        }

        try {
          const { filename } = req.params;
          const result = this.deleteBackup(filename);
          res.json(result);
        } catch (error) {
          console.error('❌ Error deleting backup:', error);
          if (error.message === 'Invalid backup filename') {
            res.status(400).json({ error: error.message });
          } else if (error.message === 'Backup file not found') {
            res.status(404).json({ error: error.message });
          } else {
            res.status(500).json({ 
              error: 'Failed to delete backup',
              details: error.message 
            });
          }
        }
      }
    };
  }

  // Register all backup routes with Express app
  registerRoutes(app, authenticateApiKey) {
    const routes = this.createRoutes(authenticateApiKey);
    
    // Register backup routes
    app.post('/api/admin/backup-database', authenticateApiKey, routes.createBackup);
    app.get('/api/admin/backups', authenticateApiKey, routes.listBackups);
    app.get('/api/admin/backups/:filename', authenticateApiKey, routes.downloadBackup);
    app.delete('/api/admin/backups/:filename', authenticateApiKey, routes.deleteBackup);
    
    console.log('✅ Backup system routes registered');
  }
}

module.exports = BackupSystem; 