#!/usr/bin/env node

/**
 * List Available ElevenLabs Voices
 * Helper script to see available voices for batch generation setup
 */

const { getAvailableVoices } = require('./voice-utils.js');

async function listVoices() {
    console.log('🎭 Fetching Available ElevenLabs Voices...\n');
    
    // Check if API key is set
    if (!process.env.ELEVENLABS_API_KEY) {
        console.error('❌ ELEVENLABS_API_KEY environment variable is not set');
        console.log('\nPlease set your ElevenLabs API key:');
        console.log('export ELEVENLABS_API_KEY=your_api_key_here');
        console.log('or add it to your .env file');
        process.exit(1);
    }
    
    try {
        const voices = await getAvailableVoices();
        
        if (voices.length === 0) {
            console.log('❌ No voices found or API error');
            return;
        }
        
        console.log(`✅ Found ${voices.length} available voices:\n`);
        
        // Sort voices by category and name
        const sortedVoices = voices.sort((a, b) => {
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            return a.name.localeCompare(b.name);
        });
        
        let currentCategory = '';
        
        for (const voice of sortedVoices) {
            // Print category header
            if (voice.category !== currentCategory) {
                currentCategory = voice.category;
                console.log(`\n📂 ${currentCategory.toUpperCase()} VOICES:`);
                console.log('═'.repeat(50));
            }
            
            // Voice details
            console.log(`🎤 ${voice.name}`);
            console.log(`   ID: ${voice.voice_id}`);
            console.log(`   Description: ${voice.description || 'No description'}`);
            console.log(`   Gender: ${voice.labels?.gender || 'Unknown'}`);
            console.log(`   Age: ${voice.labels?.age || 'Unknown'}`);
            console.log(`   Accent: ${voice.labels?.accent || 'Unknown'}`);
            console.log(`   Use Case: ${voice.labels?.["use case"] || 'General'}`);
            console.log('');
        }
        
        console.log('\n📋 Configuration Format:');
        console.log('Copy voice IDs to use in your batch configuration:');
        console.log('\nvoiceAssignments: {');
        
        // Show first few voices as examples
        const exampleVoices = voices.slice(0, 3);
        exampleVoices.forEach((voice, index) => {
            console.log(`    'CHARACTER_${index + 1}': '${voice.voice_id}', // ${voice.name}`);
        });
        
        console.log('    // Add more character-to-voice mappings as needed');
        console.log('}');
        
    } catch (error) {
        console.error('❌ Error fetching voices:', error.message);
    }
}

// Run the script
listVoices(); 