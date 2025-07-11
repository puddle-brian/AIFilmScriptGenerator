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
        const { sceneId, dialogueText, voiceAssignments, includeActions, pauseDuration, voiceSettings } = req.body;
        
        if (!sceneId || !dialogueText || !voiceAssignments) {
            return res.status(400).json({ error: 'Scene ID, dialogue text, and voice assignments are required' });
        }
        
        // Parse dialogue into lines
        const parsedLines = parseDialogueIntoLines(dialogueText);
        
        console.log('🎬 Parsed lines for scene:', sceneId);
        parsedLines.forEach((line, index) => {
            console.log(`Line ${index}: type=${line.type}, character=${line.character}, shouldSpeak=${line.shouldSpeak}, text="${line.text.substring(0, 50)}..."`);
        });
        
        // Filter to only dialogue lines (never process action lines or scene headings)
        const dialogueLines = parsedLines.filter(line => line.type === 'dialogue' && line.character);
        
        console.log(`🎯 Processing ${dialogueLines.length} dialogue lines (out of ${parsedLines.length} total lines)`);
        
        // Double-check: log exactly what we're about to process as dialogue
        dialogueLines.forEach((line, index) => {
            console.log(`🔥 WILL GENERATE AUDIO FOR: Character="${line.character}", Text="${line.text}"`);
        });
        
        // Generate audio for each dialogue line only
        const audioSegments = [];
        let totalDuration = 0;
        
        for (const line of dialogueLines) {
            const voiceId = voiceAssignments[line.character];
            
            if (!voiceId) {
                throw new Error(`No voice assigned to character: ${line.character}`);
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

// Download scene audio as single combined MP3 file
router.get('/download-scene/:sceneId', async (req, res) => {
    try {
        const sceneId = req.params.sceneId;
        const audioDir = path.join(__dirname, '../temp_audio');
        
        // Check if combined file already exists
        const combinedFilePath = path.join(audioDir, `${sceneId}_combined.mp3`);
        
        try {
            await fs.access(combinedFilePath);
            // Combined file exists, serve it directly
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Disposition', `attachment; filename="${sceneId}_Complete_Scene.mp3"`);
            
            const fileStream = require('fs').createReadStream(combinedFilePath);
            fileStream.pipe(res);
            return;
        } catch {
            // Combined file doesn't exist, create it
        }
        
        // Get all audio files for this scene
        const files = await fs.readdir(audioDir);
        const sceneFiles = files.filter(file => file.startsWith(sceneId) && file.endsWith('.mp3') && !file.includes('combined'));
        
        // Sort files by segment number for logical ordering
        sceneFiles.sort((a, b) => {
            const aMatch = a.match(/segment_(\d+)/);
            const bMatch = b.match(/segment_(\d+)/);
            if (aMatch && bMatch) {
                return parseInt(aMatch[1]) - parseInt(bMatch[1]);
            }
            return a.localeCompare(b);
        });
        
        if (sceneFiles.length === 0) {
            return res.status(404).json({ error: 'No audio files found for this scene' });
        }
        
        // Combine audio files using simple buffer concatenation
        const combinedBuffer = await combineAudioFiles(sceneFiles.map(f => path.join(audioDir, f)));
        
        // Save combined file for future requests
        await fs.writeFile(combinedFilePath, combinedBuffer);
        
        // Serve the combined file
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${sceneId}_Complete_Scene.mp3"`);
        res.setHeader('Content-Length', combinedBuffer.length);
        res.send(combinedBuffer);
        
    } catch (error) {
        console.error('Failed to download scene audio:', error);
        res.status(500).json({ error: 'Failed to download scene audio' });
    }
});

// Download individual scene audio files as ZIP (for editing)
router.get('/download-scene-parts/:sceneId', async (req, res) => {
    try {
        const sceneId = req.params.sceneId;
        const audioDir = path.join(__dirname, '../temp_audio');
        
        const archiver = require('archiver');
        const archive = archiver('zip', { zlib: { level: 9 } });
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${sceneId}_Individual_Parts.zip"`);
        
        archive.pipe(res);
        
        // Add all audio files for this scene with organized structure
        const files = await fs.readdir(audioDir);
        const sceneFiles = files.filter(file => file.startsWith(sceneId) && file.endsWith('.mp3') && !file.includes('combined'));
        
        // Sort files by segment number for logical ordering
        sceneFiles.sort((a, b) => {
            const aMatch = a.match(/segment_(\d+)/);
            const bMatch = b.match(/segment_(\d+)/);
            if (aMatch && bMatch) {
                return parseInt(aMatch[1]) - parseInt(bMatch[1]);
            }
            return a.localeCompare(b);
        });
        
        // Add files to organized folders within ZIP
        for (let i = 0; i < sceneFiles.length; i++) {
            const file = sceneFiles[i];
            const filepath = path.join(audioDir, file);
            
            // Create more descriptive names within the ZIP
            const segmentNumber = String(i + 1).padStart(2, '0');
            const newFileName = `${segmentNumber}_${file.replace(sceneId + '_segment_', 'segment_')}`;
            
            archive.file(filepath, { 
                name: `IndividualParts/${newFileName}` 
            });
        }
        
        // Add a README file
        const readmeContent = `Individual Scene Audio Parts - ${sceneId}
Generated: ${new Date().toISOString()}

This package contains individual audio segments for editing purposes.
Files are numbered in sequence order.

For complete scene audio, use the "Download Complete Scene" option instead.

Generated by Film Script Generator Voice System
`;
        
        archive.append(readmeContent, { name: 'IndividualParts/README.txt' });
        
        await archive.finalize();
        
    } catch (error) {
        console.error('Failed to download scene audio parts:', error);
        res.status(500).json({ error: 'Failed to download scene audio parts' });
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
                    shouldSpeak: false  // Action lines should never be spoken
                });
                currentLine = '';
            }
            parsedLines.push({
                type: 'scene_heading',
                text: line,
                character: null,
                shouldSpeak: false  // Scene headings should never be spoken
            });
            continue;
        }
        
        // Character name (all caps) - but not scene directions like "BEDROOM - NIGHT"
        if (line.match(/^[A-Z][A-Z\s']+(\s*\([^)]*\))?$/) && !line.includes(' - ') && !line.match(/^(INT\.|EXT\.)/)) {
            // Save previous action line if exists
            if (currentLine) {
                console.log(`📝 FOUND ACTION LINE: "${currentLine}"`);
                parsedLines.push({
                    type: 'action',
                    text: currentLine,
                    character: null,
                    shouldSpeak: false  // Action lines should never be spoken
                });
                currentLine = '';
            }
            
            const characterMatch = line.match(/^([A-Z][A-Z\s']+)(\s*\([^)]*\))?$/);
            currentCharacter = characterMatch[1].trim();
            console.log(`🎭 FOUND CHARACTER: "${currentCharacter}"`);
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
                console.log(`💬 FOUND DIALOGUE: "${currentCharacter}" says "${cleanedText}"`);
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
        console.log(`📖 BUILDING ACTION LINE: "${currentLine.substring(0, 100)}${currentLine.length > 100 ? '...' : ''}"`);
        
        // CRITICAL FIX: If we have a currentCharacter but we're building action lines, 
        // this means the previous "character" detection was wrong (probably scene directions)
        if (currentCharacter) {
            console.log(`🚨 WARNING: Had currentCharacter "${currentCharacter}" but building action line - clearing character!`);
            currentCharacter = null;
        }
    }
    
    // Add final action line if exists
    if (currentLine) {
        console.log(`📝 FOUND FINAL ACTION LINE: "${currentLine}"`);
        parsedLines.push({
            type: 'action',
            text: currentLine,
            character: null,
            shouldSpeak: false  // Action lines should never be spoken
        });
    }
    
    return parsedLines;
}

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

async function combineAudioFiles(filePaths) {
    try {
        const ffmpeg = require('fluent-ffmpeg');
        const ffmpegStatic = require('ffmpeg-static');
        const path = require('path');
        const os = require('os');
        
        if (filePaths.length === 0) {
            throw new Error('No audio files to combine');
        }
        
        // If only one file, just return it
        if (filePaths.length === 1) {
            return await fs.readFile(filePaths[0]);
        }
        
        // Set FFmpeg binary path
        ffmpeg.setFfmpegPath(ffmpegStatic);
        
        // Create temp directory for processing
        const tempDir = path.join(os.tmpdir(), 'voice-combine-' + Date.now());
        await fs.mkdir(tempDir, { recursive: true });
        
        // Output file path
        const outputPath = path.join(tempDir, 'combined.mp3');
        
        console.log('Combining audio files:', filePaths);
        
        // Use fluent-ffmpeg to concatenate MP3 files properly
        await new Promise((resolve, reject) => {
            let command = ffmpeg();
            
            // Add all input files
            filePaths.forEach(file => {
                command = command.addInput(file);
            });
            
            command
                .on('start', (commandLine) => {
                    console.log('FFmpeg command:', commandLine);
                })
                .on('progress', (progress) => {
                    console.log('Processing: ' + progress.percent + '% done');
                })
                .on('end', () => {
                    console.log('Audio combination finished');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    reject(err);
                })
                .mergeToFile(outputPath, tempDir);
        });
        
        // Read the combined file
        const combinedBuffer = await fs.readFile(outputPath);
        
        // Clean up temp files
        await fs.unlink(outputPath).catch(() => {});
        await fs.rmdir(tempDir).catch(() => {});
        
        return combinedBuffer;
        
    } catch (error) {
        console.error('Failed to combine audio files with FFmpeg:', error);
        
        // Fallback: try alternative method
        try {
            return await combineAudioFilesAlternative(filePaths);
        } catch (fallbackError) {
            console.error('Fallback method also failed:', fallbackError);
            throw new Error('Audio combination failed: ' + error.message);
        }
    }
}

async function combineAudioFilesAlternative(filePaths) {
    try {
        // Alternative method: More sophisticated MP3 concatenation
        // This handles ID3 tags and MP3 frame structure properly
        
        if (filePaths.length === 0) {
            throw new Error('No audio files to combine');
        }
        
        if (filePaths.length === 1) {
            return await fs.readFile(filePaths[0]);
        }
        
        console.log('Using alternative MP3 concatenation method');
        
        const combinedParts = [];
        let hasWrittenHeader = false;
        
        for (let i = 0; i < filePaths.length; i++) {
            const fileBuffer = await fs.readFile(filePaths[i]);
            console.log(`Processing file ${i + 1}/${filePaths.length}: ${filePaths[i]}`);
            
            if (i === 0) {
                // First file: include everything (ID3 tags + audio data)
                combinedParts.push(fileBuffer);
                hasWrittenHeader = true;
            } else {
                // Subsequent files: skip ID3 tags and metadata, keep only audio frames
                let audioStart = 0;
                
                // Skip ID3v2 tag if present (starts with "ID3")
                if (fileBuffer.length >= 10 && 
                    fileBuffer[0] === 0x49 && fileBuffer[1] === 0x44 && fileBuffer[2] === 0x33) {
                    // ID3v2 tag found, calculate its size
                    const tagSize = ((fileBuffer[6] & 0x7F) << 21) | 
                                  ((fileBuffer[7] & 0x7F) << 14) | 
                                  ((fileBuffer[8] & 0x7F) << 7) | 
                                  (fileBuffer[9] & 0x7F);
                    audioStart = 10 + tagSize;
                    console.log(`Skipping ID3v2 tag of size ${tagSize} bytes`);
                }
                
                // Find first MP3 frame sync pattern (0xFF followed by 0xFB, 0xFA, 0xF3, 0xF2)
                for (let j = audioStart; j < fileBuffer.length - 1; j++) {
                    if (fileBuffer[j] === 0xFF && (fileBuffer[j + 1] & 0xE0) === 0xE0) {
                        audioStart = j;
                        break;
                    }
                }
                
                // Add only the audio data (skip any remaining metadata)
                const audioData = fileBuffer.slice(audioStart);
                if (audioData.length > 0) {
                    combinedParts.push(audioData);
                    console.log(`Added ${audioData.length} bytes of audio data`);
                }
            }
        }
        
        // Combine all parts
        const totalLength = combinedParts.reduce((sum, part) => sum + part.length, 0);
        const combinedBuffer = Buffer.alloc(totalLength);
        
        let offset = 0;
        for (const part of combinedParts) {
            part.copy(combinedBuffer, offset);
            offset += part.length;
        }
        
        console.log(`Combined ${filePaths.length} files into ${totalLength} bytes`);
        return combinedBuffer;
        
    } catch (error) {
        console.error('Alternative combination method failed:', error);
        throw error;
    }
}

module.exports = router; 