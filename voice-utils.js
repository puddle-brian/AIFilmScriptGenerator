/**
 * Voice Generation Utilities
 * Contains helper functions for voice generation and dialogue processing
 */

const fs = require('fs').promises;

/**
 * Parse dialogue text into structured lines
 */
function parseDialogueIntoLines(dialogueText) {
    if (!dialogueText || typeof dialogueText !== 'string') {
        return [];
    }
    
    const lines = dialogueText.split('\n');
    const parsedLines = [];
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) {
            continue;
        }
        
        // Scene headings (INT./EXT. or scene numbers)
        if (trimmedLine.match(/^(INT\.|EXT\.|SCENE|FADE|CUT)/i)) {
            parsedLines.push({
                type: 'scene_heading',
                text: trimmedLine,
                character: null,
                shouldSpeak: false
            });
        }
        // Character names (all caps, possibly with (V.O.) or (O.S.))
        else if (trimmedLine.match(/^[A-Z][A-Z\s\.\(\)]+$/)) {
            // Extract character name (remove parentheticals like (V.O.))
            const characterName = trimmedLine.replace(/\s*\([^)]*\)\s*$/, '').trim();
            
            parsedLines.push({
                type: 'character',
                text: trimmedLine,
                character: characterName,
                shouldSpeak: false  // Character names themselves are not spoken
            });
        }
        // Dialogue lines (follow character names)
        else if (parsedLines.length > 0 && parsedLines[parsedLines.length - 1].type === 'character') {
            const lastCharacter = parsedLines[parsedLines.length - 1].character;
            
            // Clean the dialogue text
            const cleanedText = removeParentheticalContent(trimmedLine);
            
            // Only add if there's actual content after cleaning
            if (cleanedText.trim()) {
                parsedLines.push({
                    type: 'dialogue',
                    text: cleanedText,
                    character: lastCharacter,
                    shouldSpeak: true
                });
            }
        }
        // Dialogue continuation (indented or following dialogue)
        else if (parsedLines.length > 0 && parsedLines[parsedLines.length - 1].type === 'dialogue') {
            const lastDialogue = parsedLines[parsedLines.length - 1];
            const cleanedText = removeParentheticalContent(trimmedLine);
            
            // Append to previous dialogue line
            if (cleanedText.trim()) {
                lastDialogue.text += ' ' + cleanedText;
            }
        }
        // Everything else is action/description
        else {
            parsedLines.push({
                type: 'action',
                text: trimmedLine,
                character: null,
                shouldSpeak: false
            });
        }
    }
    
    return parsedLines;
}

/**
 * Generate audio for text using ElevenLabs API
 */
async function generateAudioForText(text, voiceId, voiceSettings) {
    // Build voice settings object
    const settings = {
        stability: voiceSettings?.stability !== undefined ? voiceSettings.stability : 1,
        similarity_boost: voiceSettings?.similarityBoost !== undefined ? voiceSettings.similarityBoost : 1,
        style: voiceSettings?.styleExaggeration !== undefined ? voiceSettings.styleExaggeration : 0,
        use_speaker_boost: voiceSettings?.speakerBoost !== undefined ? voiceSettings.speakerBoost : true
    };
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
            text: text,
            model_id: voiceSettings?.model || 'eleven_multilingual_v2',
            voice_settings: settings
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.arrayBuffer();
}

/**
 * Estimate audio duration from text
 */
function estimateAudioDuration(text) {
    // Rough estimate: ~150 words per minute, ~5 characters per word
    const wordsPerMinute = 150;
    const charactersPerWord = 5;
    const estimatedWords = text.length / charactersPerWord;
    return (estimatedWords / wordsPerMinute) * 60; // Convert to seconds
}

/**
 * Remove parenthetical content from dialogue
 */
function removeParentheticalContent(text) {
    // Remove anything in parentheses (stage directions, whispers, etc.)
    let cleanedText = text;
    
    // Remove parenthetical content like (laughing), (to John), (whispered), etc.
    cleanedText = cleanedText.replace(/\([^)]*\)/g, '');
    
    // Clean up any double spaces and trim
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    return cleanedText;
}

/**
 * Get available voices from ElevenLabs API
 */
async function getAvailableVoices() {
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY
            }
        });
        
        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data.voices || [];
    } catch (error) {
        console.error('Failed to fetch available voices:', error);
        return [];
    }
}

/**
 * Extract character names from dialogue text
 */
function extractCharactersFromDialogue(dialogueText) {
    const lines = dialogueText.split('\n');
    const characters = new Set();
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        // Look for character names (all caps at start of line)
        if (trimmedLine.match(/^[A-Z][A-Z\s\.\(\)]+$/)) {
            // Extract character name (remove parentheticals like (V.O.))
            const characterName = trimmedLine.replace(/\s*\([^)]*\)\s*$/, '').trim();
            if (characterName.length > 1 && characterName.length < 30) {
                characters.add(characterName);
            }
        }
    }
    
    return Array.from(characters);
}

/**
 * Create a pause audio buffer (silence)
 */
function createPauseBuffer(durationSeconds) {
    // Create a simple silence buffer
    // This is a placeholder - you might want to use a more sophisticated approach
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * durationSeconds);
    const buffer = Buffer.alloc(samples * 2); // 16-bit audio
    return buffer;
}

module.exports = {
    parseDialogueIntoLines,
    generateAudioForText,
    estimateAudioDuration,
    removeParentheticalContent,
    getAvailableVoices,
    extractCharactersFromDialogue,
    createPauseBuffer
}; 