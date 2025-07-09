/**
 * Batch Voice Generation Script
 * Processes multiple scenes for voice generation at once
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Database connection (you'll need to update with your database config)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Import the voice generation utilities
const { 
    generateAudioForText, 
    parseDialogueIntoLines, 
    estimateAudioDuration,
    extractCharactersFromDialogue 
} = require('./voice-utils.js');

class BatchVoiceGenerator {
    constructor() {
        this.defaultVoiceSettings = {
            model: 'eleven_turbo_v2_5',
            stability: 0.5,
            similarityBoost: 0.8,
            styleExaggeration: 0.0,
            speakerBoost: false
        };
        
        this.pauseDuration = 1.0; // seconds between dialogue lines
        this.voiceAssignments = {};
        this.processedScenes = [];
        this.totalCharactersProcessed = 0;
        this.totalScenesProcessed = 0;
    }

    /**
     * Load project data from database
     */
    async loadProject(username, projectPath) {
        try {
            const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            
            if (userResult.rows.length === 0) {
                throw new Error('User not found');
            }

            const userId = userResult.rows[0].id;
            const projectResult = await pool.query(
                'SELECT project_context FROM user_projects WHERE user_id = $1 AND project_name = $2',
                [userId, projectPath]
            );

            if (projectResult.rows.length === 0) {
                throw new Error('Project not found');
            }

            const projectContext = JSON.parse(projectResult.rows[0].project_context);
            return projectContext;
        } catch (error) {
            console.error('Error loading project:', error);
            throw error;
        }
    }

    /**
     * Extract all scenes with dialogue from project
     */
    extractScenesWithDialogue(projectContext) {
        const scenesWithDialogue = [];
        
        // Check generatedDialogues for scenes with dialogue
        if (projectContext.generatedDialogues) {
            for (const [sceneId, dialogueData] of Object.entries(projectContext.generatedDialogues)) {
                if (dialogueData.dialogue && dialogueData.dialogue.trim()) {
                    scenesWithDialogue.push({
                        sceneId: sceneId,
                        title: dialogueData.title || 'Untitled Scene',
                        dialogue: dialogueData.dialogue,
                        characters: extractCharactersFromDialogue(dialogueData.dialogue)
                    });
                }
            }
        }

        return scenesWithDialogue;
    }

    // Character extraction is now handled by voice-utils.js

    /**
     * Set voice assignments for all characters
     */
    setVoiceAssignments(assignments) {
        this.voiceAssignments = assignments;
        console.log('🎭 Voice assignments set:', assignments);
    }

    /**
     * Set voice generation settings
     */
    setVoiceSettings(settings) {
        this.defaultVoiceSettings = { ...this.defaultVoiceSettings, ...settings };
        console.log('🔧 Voice settings updated:', this.defaultVoiceSettings);
    }

    /**
     * Generate voice for a single scene
     */
    async generateSceneVoice(scene) {
        console.log(`🎙️ Generating voice for scene: ${scene.title}`);
        
        try {
            // Parse dialogue into lines
            const parsedLines = parseDialogueIntoLines(scene.dialogue);
            const dialogueLines = parsedLines.filter(line => line.type === 'dialogue' && line.character);
            
            console.log(`📝 Processing ${dialogueLines.length} dialogue lines`);
            
            // Generate audio for each dialogue line
            const audioSegments = [];
            let totalDuration = 0;
            let charactersProcessed = 0;
            
            for (const line of dialogueLines) {
                const voiceId = this.voiceAssignments[line.character];
                
                if (!voiceId) {
                    console.warn(`⚠️ No voice assigned to character: ${line.character}`);
                    continue;
                }
                
                try {
                    const audioBuffer = await generateAudioForText(line.text, voiceId, this.defaultVoiceSettings);
                    const duration = estimateAudioDuration(line.text);
                    
                    audioSegments.push({
                        type: line.type,
                        character: line.character,
                        text: line.text,
                        audioBuffer: audioBuffer,
                        duration: duration
                    });
                    
                    totalDuration += duration;
                    charactersProcessed += line.text.length;
                    
                    // Add pause between segments
                    if (this.pauseDuration > 0) {
                        audioSegments.push({
                            type: 'pause',
                            duration: this.pauseDuration
                        });
                        totalDuration += this.pauseDuration;
                    }
                    
                    console.log(`✅ Generated audio for ${line.character}: "${line.text.substring(0, 50)}..."`);
                    
                } catch (error) {
                    console.error(`❌ Failed to generate audio for line: ${line.text}`, error);
                }
            }
            
            // Save audio segments to files
            await this.saveSceneAudio(scene.sceneId, audioSegments);
            
            this.totalCharactersProcessed += charactersProcessed;
            this.totalScenesProcessed++;
            
            console.log(`🎉 Scene complete: ${scene.title} (${audioSegments.length} segments, ${Math.round(totalDuration)}s)`);
            
            return {
                sceneId: scene.sceneId,
                title: scene.title,
                audioSegments: audioSegments.length,
                duration: totalDuration,
                charactersProcessed: charactersProcessed
            };
            
        } catch (error) {
            console.error(`❌ Failed to generate voice for scene: ${scene.title}`, error);
            throw error;
        }
    }

    /**
     * Save scene audio to files
     */
    async saveSceneAudio(sceneId, audioSegments) {
        const audioDir = path.join(__dirname, 'batch_audio_output');
        const sceneDir = path.join(audioDir, sceneId);
        
        // Create directories
        await fs.mkdir(sceneDir, { recursive: true });
        
        // Save individual audio files
        for (let i = 0; i < audioSegments.length; i++) {
            const segment = audioSegments[i];
            if (segment.type === 'pause') continue;
            
            const filename = `${sceneId}_${segment.character}_${i}.mp3`;
            const filepath = path.join(sceneDir, filename);
            
            await fs.writeFile(filepath, Buffer.from(segment.audioBuffer));
            segment.audioFile = filepath;
        }
        
        // Save metadata
        const metadataPath = path.join(sceneDir, 'metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify({
            sceneId: sceneId,
            segments: audioSegments.map(segment => ({
                type: segment.type,
                character: segment.character,
                text: segment.text,
                duration: segment.duration,
                audioFile: segment.audioFile
            })),
            generatedAt: new Date().toISOString()
        }, null, 2));
    }

    /**
     * Process all scenes in batch
     */
    async processBatch(username, projectPath, options = {}) {
        try {
            console.log(`🚀 Starting batch voice generation for ${username}/${projectPath}`);
            
            // Load project data
            const projectContext = await this.loadProject(username, projectPath);
            
            // Extract scenes with dialogue
            const scenes = this.extractScenesWithDialogue(projectContext);
            
            if (scenes.length === 0) {
                console.log('❌ No scenes with dialogue found');
                return;
            }
            
            console.log(`📋 Found ${scenes.length} scenes with dialogue`);
            
            // Get all unique characters
            const allCharacters = new Set();
            scenes.forEach(scene => {
                scene.characters.forEach(character => allCharacters.add(character));
            });
            
            console.log(`🎭 Characters found: ${Array.from(allCharacters).join(', ')}`);
            
            // Check voice assignments
            const missingVoices = Array.from(allCharacters).filter(char => !this.voiceAssignments[char]);
            if (missingVoices.length > 0) {
                console.error(`❌ Missing voice assignments for: ${missingVoices.join(', ')}`);
                return;
            }
            
            // Process scenes
            const startTime = Date.now();
            const results = [];
            
            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                console.log(`\n🎬 Processing scene ${i + 1}/${scenes.length}: ${scene.title}`);
                
                try {
                    const result = await this.generateSceneVoice(scene);
                    results.push(result);
                    
                    // Add delay between scenes to avoid rate limiting
                    if (i < scenes.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    
                } catch (error) {
                    console.error(`❌ Failed to process scene: ${scene.title}`, error);
                    results.push({
                        sceneId: scene.sceneId,
                        title: scene.title,
                        error: error.message
                    });
                }
            }
            
            // Generate summary
            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            
            console.log(`\n🎉 Batch processing complete!`);
            console.log(`📊 Processed: ${this.totalScenesProcessed}/${scenes.length} scenes`);
            console.log(`📝 Characters processed: ${this.totalCharactersProcessed.toLocaleString()}`);
            console.log(`⏱️ Time taken: ${duration}s`);
            console.log(`💰 Estimated cost: $${(this.totalCharactersProcessed * 0.00015).toFixed(2)} (Turbo model)`);
            
            // Save batch summary
            const summaryPath = path.join(__dirname, 'batch_audio_output', 'batch_summary.json');
            await fs.writeFile(summaryPath, JSON.stringify({
                projectPath: projectPath,
                username: username,
                processedAt: new Date().toISOString(),
                scenesProcessed: this.totalScenesProcessed,
                totalScenes: scenes.length,
                charactersProcessed: this.totalCharactersProcessed,
                duration: duration,
                voiceAssignments: this.voiceAssignments,
                voiceSettings: this.defaultVoiceSettings,
                results: results
            }, null, 2));
            
            return results;
            
        } catch (error) {
            console.error('❌ Batch processing failed:', error);
            throw error;
        }
    }
}

// Example usage function
async function runBatchGeneration() {
    const batchGenerator = new BatchVoiceGenerator();
    
    // Configure voice assignments (you'll need to update these with actual voice IDs)
    batchGenerator.setVoiceAssignments({
        'ALICE': 'voice_id_1',
        'BOB': 'voice_id_2',
        'CHARLIE': 'voice_id_3',
        // Add more character-to-voice mappings as needed
    });
    
    // Configure voice settings (optional)
    batchGenerator.setVoiceSettings({
        model: 'eleven_turbo_v2_5', // Use cheaper Turbo model
        stability: 0.6,
        similarityBoost: 0.8,
        styleExaggeration: 0.2
    });
    
    // Run batch processing
    try {
        const results = await batchGenerator.processBatch('your_username', 'your_project_path');
        console.log('Batch generation complete!', results);
    } catch (error) {
        console.error('Batch generation failed:', error);
    }
}

// Export for use as a module
module.exports = {
    BatchVoiceGenerator,
    runBatchGeneration
};

// Allow running as a script
if (require.main === module) {
    runBatchGeneration();
} 