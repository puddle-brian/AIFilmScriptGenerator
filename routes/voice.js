/**
 * Voice Generation API Routes
 * Handles scene-based voice generation with line-by-line audio assembly
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Get available voices from ElevenLabs
router.get('/available-voices', async (req, res) => {
    try {
        if (!process.env.ELEVENLABS_API_KEY) {
            return res.status(500).json({ error: 'ElevenLabs API key not configured' });
        }
        
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY
            }
        });
        
        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        const voices = data.voices.map(voice => ({
            id: voice.voice_id,
            name: voice.name,
            category: voice.category,
            description: voice.description
        }));
        
        res.json({ voices });
        
    } catch (error) {
        console.error('Failed to get available voices:', error);
        res.status(500).json({ error: 'Failed to get available voices' });
    }
});

// Preview voice with sample text
router.post('/preview', async (req, res) => {
    try {
        const { text, voiceId, voiceSettings } = req.body;
        
        if (!text || !voiceId) {
            return res.status(400).json({ error: 'Text and voiceId are required' });
        }
        
        // Build voice settings object
        const settings = {
            stability: voiceSettings?.stability !== undefined ? voiceSettings.stability : 0,
            similarity_boost: voiceSettings?.similarityBoost !== undefined ? voiceSettings.similarityBoost : 1,
            style: voiceSettings?.styleExaggeration !== undefined ? voiceSettings.styleExaggeration : 1,
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
            throw new Error(`ElevenLabs API error: ${response.statusText}`);
        }
        
        const audioBuffer = await response.arrayBuffer();
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.byteLength);
        res.send(Buffer.from(audioBuffer));
        
    } catch (error) {
        console.error('Failed to preview voice:', error);
        res.status(500).json({ error: 'Failed to preview voice' });
    }
});

// Generate line-by-line audio for a scene
router.post('/generate-scene-audio', async (req, res) => {
    try {
        const { sceneId, dialogueText, voiceAssignments, narratorVoiceId, includeActions, pauseDuration, voiceSettings } = req.body;
        
        if (!sceneId || !dialogueText || !voiceAssignments) {
            return res.status(400).json({ error: 'Scene ID, dialogue text, and voice assignments are required' });
        }
        
        // Parse dialogue into lines
        const parsedLines = parseDialogueIntoLines(dialogueText);
        
        // Generate audio for each line
        const audioSegments = [];
        let totalDuration = 0;
        
        for (const line of parsedLines) {
            if (!line.shouldSpeak) continue;
            
            const voiceId = line.character ? voiceAssignments[line.character] : narratorVoiceId;
            
            if (!voiceId) {
                if (line.character) {
                    throw new Error(`No voice assigned to character: ${line.character}`);
                } else if (includeActions) {
                    throw new Error('No narrator voice assigned');
                }
                continue;
            }
            
            try {
                const audioBuffer = await generateAudioForText(line.text, voiceId, voiceSettings);
                const duration = estimateAudioDuration(line.text);
                
                audioSegments.push({
                    type: line.type,
                    character: line.character,
                    text: line.text,
                    audioBuffer: audioBuffer,
                    duration: duration
                });
                
                totalDuration += duration;
                
                // Add pause between segments
                if (pauseDuration > 0) {
                    audioSegments.push({
                        type: 'pause',
                        duration: pauseDuration
                    });
                    totalDuration += pauseDuration;
                }
                
            } catch (error) {
                console.error(`Failed to generate audio for line: ${line.text}`, error);
                // Continue with other lines
            }
        }
        
        // Save audio segments to temporary files
        const audioDir = path.join(__dirname, '../temp_audio');
        await fs.mkdir(audioDir, { recursive: true });
        
        const audioUrls = [];
        for (let i = 0; i < audioSegments.length; i++) {
            const segment = audioSegments[i];
            if (segment.type === 'pause') continue;
            
            const filename = `${sceneId}_segment_${i}.mp3`;
            const filepath = path.join(audioDir, filename);
            
            await fs.writeFile(filepath, Buffer.from(segment.audioBuffer));
            
            segment.audioUrl = `/api/voice/temp-audio/${filename}`;
            audioUrls.push(segment.audioUrl);
        }
        
        res.json({
            sceneId: sceneId,
            audioSegments: audioSegments.map(segment => ({
                type: segment.type,
                character: segment.character,
                text: segment.text,
                duration: segment.duration,
                audioUrl: segment.audioUrl
            })),
            estimatedDuration: totalDuration,
            audioUrls: audioUrls
        });
        
    } catch (error) {
        console.error('Failed to generate scene audio:', error);
        res.status(500).json({ error: `Failed to generate scene audio: ${error.message}` });
    }
});

// Serve temporary audio files
router.get('/temp-audio/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const filepath = path.join(__dirname, '../temp_audio', filename);
        
        // Check if file exists
        try {
            await fs.access(filepath);
        } catch {
            return res.status(404).json({ error: 'Audio file not found' });
        }
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        
        const fileStream = require('fs').createReadStream(filepath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Failed to serve audio file:', error);
        res.status(500).json({ error: 'Failed to serve audio file' });
    }
});

// Download scene audio (combined)
router.get('/download-scene/:sceneId', async (req, res) => {
    try {
        const sceneId = req.params.sceneId;
        const audioDir = path.join(__dirname, '../temp_audio');
        
        // This would ideally combine all segments into one file
        // For now, we'll just return a zip of all segments
        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${sceneId}_audio.zip"`);
        
        archive.pipe(res);
        
        // Add all audio files for this scene
        const files = await fs.readdir(audioDir);
        const sceneFiles = files.filter(file => file.startsWith(sceneId));
        
        for (const file of sceneFiles) {
            const filepath = path.join(audioDir, file);
            archive.file(filepath, { name: file });
        }
        
        await archive.finalize();
        
    } catch (error) {
        console.error('Failed to download scene audio:', error);
        res.status(500).json({ error: 'Failed to download scene audio' });
    }
});

// Clean up temporary audio files
router.delete('/cleanup/:sceneId', async (req, res) => {
    try {
        const sceneId = req.params.sceneId;
        const audioDir = path.join(__dirname, '../temp_audio');
        
        const files = await fs.readdir(audioDir);
        const sceneFiles = files.filter(file => file.startsWith(sceneId));
        
        for (const file of sceneFiles) {
            const filepath = path.join(audioDir, file);
            await fs.unlink(filepath);
        }
        
        res.json({ message: `Cleaned up ${sceneFiles.length} audio files for scene ${sceneId}` });
        
    } catch (error) {
        console.error('Failed to cleanup audio files:', error);
        res.status(500).json({ error: 'Failed to cleanup audio files' });
    }
});

// Helper functions
function parseDialogueIntoLines(dialogueText) {
    const lines = dialogueText.split('\n');
    const parsedLines = [];
    let currentCharacter = null;
    let currentLine = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Scene heading
        if (line.match(/^(INT\.|EXT\.)/)) {
            if (currentLine) {
                parsedLines.push({
                    type: 'action',
                    text: currentLine,
                    character: null,
                    shouldSpeak: true
                });
                currentLine = '';
            }
            parsedLines.push({
                type: 'scene_heading',
                text: line,
                character: null,
                shouldSpeak: true
            });
            continue;
        }
        
        // Character name (all caps)
        if (line.match(/^[A-Z][A-Z\s']+(\s*\([^)]*\))?$/)) {
            // Save previous action line if exists
            if (currentLine) {
                parsedLines.push({
                    type: 'action',
                    text: currentLine,
                    character: null,
                    shouldSpeak: true
                });
                currentLine = '';
            }
            
            const characterMatch = line.match(/^([A-Z][A-Z\s']+)(\s*\([^)]*\))?$/);
            currentCharacter = characterMatch[1].trim();
            continue;
        }
        
        // Check if this is a standalone parenthetical line (skip it)
        if (currentCharacter && line.match(/^\([^)]*\)$/)) {
            // This is a standalone parenthetical - skip it but keep currentCharacter
            continue;
        }
        
        // Dialogue line
        if (currentCharacter && !line.match(/^[A-Z][A-Z\s']+$/)) {
            // Remove any remaining parenthetical content (inline stage directions)
            const cleanedText = removeParentheticalContent(line);
            
            // Only add if there's actual dialogue content after cleaning
            if (cleanedText.trim()) {
                parsedLines.push({
                    type: 'dialogue',
                    text: cleanedText,
                    character: currentCharacter,
                    shouldSpeak: true
                });
            }
            currentCharacter = null; // Reset after dialogue
            continue;
        }
        
        // Action line
        if (currentLine) {
            currentLine += ' ' + line;
        } else {
            currentLine = line;
        }
    }
    
    // Add final action line if exists
    if (currentLine) {
        parsedLines.push({
            type: 'action',
            text: currentLine,
            character: null,
            shouldSpeak: true
        });
    }
    
    return parsedLines;
}

async function generateAudioForText(text, voiceId, voiceSettings) {
    // Build voice settings object
    const settings = {
        stability: voiceSettings?.stability !== undefined ? voiceSettings.stability : 0,
        similarity_boost: voiceSettings?.similarityBoost !== undefined ? voiceSettings.similarityBoost : 1,
        style: voiceSettings?.styleExaggeration !== undefined ? voiceSettings.styleExaggeration : 1,
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
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }
    
    return await response.arrayBuffer();
}

function estimateAudioDuration(text) {
    // Rough estimate: ~150 words per minute, ~5 characters per word
    const wordsPerMinute = 150;
    const charactersPerWord = 5;
    const estimatedWords = text.length / charactersPerWord;
    return (estimatedWords / wordsPerMinute) * 60; // Convert to seconds
}

function removeParentheticalContent(text) {
    // Remove anything in parentheses (stage directions, whispers, etc.)
    // This handles nested parentheses and multiple parenthetical expressions
    let cleanedText = text;
    
    // Remove parenthetical content like (laughing), (to John), (whispered), etc.
    cleanedText = cleanedText.replace(/\([^)]*\)/g, '');
    
    // Clean up any double spaces and trim
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
    
    return cleanedText;
}

module.exports = router; 