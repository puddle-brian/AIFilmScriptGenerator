#!/usr/bin/env node

/**
 * Simple Script to Run Batch Voice Generation
 * 
 * Usage: node run-batch-voice.js
 */

const { BatchVoiceGenerator } = require('./batch-voice-generator');

async function main() {
    console.log('🎙️ Batch Voice Generation Setup');
    console.log('================================\n');
    
    // Initialize batch generator
    const batchGenerator = new BatchVoiceGenerator();
    
    // Configuration - UPDATE THESE VALUES FOR YOUR PROJECT
    const CONFIG = {
        username: 'your_username',           // Your username
        projectPath: 'your_project_path',    // Your project name
        
        // Voice assignments - Map character names to ElevenLabs voice IDs
        voiceAssignments: {
            'MAIN_CHARACTER': 'voice_id_here',
            'SUPPORTING_CHARACTER': 'voice_id_here',
            'NARRATOR': 'voice_id_here',
            // Add more character-to-voice mappings as needed
        },
        
        // Voice settings
        voiceSettings: {
            model: 'eleven_turbo_v2_5',    // Use cheaper Turbo model (50% cheaper)
            stability: 0.6,                 // Voice stability (0.0-1.0)
            similarityBoost: 0.8,           // Similarity boost (0.0-1.0)
            styleExaggeration: 0.2,         // Style exaggeration (0.0-1.0)
            speakerBoost: true              // Speaker boost (true/false)
        },
        
        pauseDuration: 1.0                  // Pause between dialogue lines (seconds)
    };
    
    // Validate configuration
    if (CONFIG.username === 'your_username' || CONFIG.projectPath === 'your_project_path') {
        console.error('❌ Please update the CONFIG section in run-batch-voice.js with your actual values');
        console.log('\nYou need to set:');
        console.log('- username: Your login username');
        console.log('- projectPath: Your project name');
        console.log('- voiceAssignments: Character names mapped to ElevenLabs voice IDs');
        process.exit(1);
    }
    
    // Configure the batch generator
    batchGenerator.setVoiceAssignments(CONFIG.voiceAssignments);
    batchGenerator.setVoiceSettings(CONFIG.voiceSettings);
    batchGenerator.pauseDuration = CONFIG.pauseDuration;
    
    console.log('⚙️ Configuration:');
    console.log(`   Username: ${CONFIG.username}`);
    console.log(`   Project: ${CONFIG.projectPath}`);
    console.log(`   Voice Model: ${CONFIG.voiceSettings.model}`);
    console.log(`   Characters: ${Object.keys(CONFIG.voiceAssignments).join(', ')}`);
    console.log('');
    
    // Run the batch generation
    try {
        console.log('🚀 Starting batch generation...\n');
        const results = await batchGenerator.processBatch(CONFIG.username, CONFIG.projectPath);
        
        console.log('\n✅ Batch generation completed successfully!');
        console.log('📁 Audio files saved to: ./batch_audio_output/');
        console.log('📋 Summary saved to: ./batch_audio_output/batch_summary.json');
        
    } catch (error) {
        console.error('\n❌ Batch generation failed:', error.message);
        process.exit(1);
    }
}

// Helper function to get available voice IDs (you can run this separately)
async function listAvailableVoices() {
    console.log('🎭 Available ElevenLabs Voices');
    console.log('==============================\n');
    
    // This would require your ElevenLabs API key to be set
    // You can get voice IDs from your ElevenLabs dashboard or API
    console.log('To get voice IDs:');
    console.log('1. Go to https://elevenlabs.io/speech-synthesis');
    console.log('2. Copy the voice ID from the URL when you select a voice');
    console.log('3. Or use the ElevenLabs API: GET /v1/voices');
    console.log('');
    console.log('Example voice IDs:');
    console.log('- Adam: "pNInz6obpgDQGcFmaJgB"');
    console.log('- Bella: "EXAVITQu4vr4xnSDxMaL"');
    console.log('- Charlie: "IKne3meq5aSn9XLyUdCD"');
    console.log('- Dorothy: "ThT5KcBeYPX3keUQqHPh"');
}

// Run the main function
if (require.main === module) {
    // Check if user wants to list voices
    if (process.argv.includes('--list-voices')) {
        listAvailableVoices();
    } else {
        main().catch(console.error);
    }
} 