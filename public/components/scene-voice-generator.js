/**
 * Scene Voice Generator
 * Handles voice generation for individual dialogue scenes with line-by-line audio assembly
 */

class SceneVoiceGenerator {
    constructor() {
        this.availableVoices = [];
        this.characterVoices = new Map();
        this.isInitialized = false;
        this.currentSceneAudio = null;
        this.audioContext = null;
        this.audioElements = [];
        
        console.log('🎙️ Scene Voice Generator initialized');
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            const response = await fetch('/api/voice/available-voices', {
                method: 'GET',
                headers: {
                    'X-API-Key': appState.apiKey
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch voices');
            }
            
            const data = await response.json();
            this.availableVoices = data.voices || [];
            this.isInitialized = true;
            
            console.log(`🎙️ Loaded ${this.availableVoices.length} voices`);
            
        } catch (error) {
            console.error('Voice generation not available:', error);
            // Silently fail - voice generation is optional
        }
    }

    /**
     * Parse dialogue text into line-by-line structure
     */
    parseDialogueIntoLines(dialogueText) {
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
                
                const parenthetical = characterMatch[2];
                if (parenthetical) {
                    parsedLines.push({
                        type: 'parenthetical',
                        text: parenthetical,
                        character: currentCharacter,
                        shouldSpeak: false
                    });
                }
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
                const cleanedText = this.removeParentheticalContent(line);
                
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
                shouldSpeak: false  // Action lines should never be spoken
            });
        }
        
        return parsedLines;
    }

    /**
     * Show voice assignment modal for a scene
     */
    async showVoiceAssignmentModal(sceneId, dialogueText) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        if (this.availableVoices.length === 0) {
            showToast('Voice generation not available. Check your ElevenLabs API key.', 'error');
            return;
        }
        
        const parsedLines = this.parseDialogueIntoLines(dialogueText);
        const characters = [...new Set(parsedLines.filter(line => line.character).map(line => line.character))];
        
        if (characters.length === 0) {
            showToast('No characters found in dialogue', 'warning');
            return;
        }
        
        const modalContent = `
            <div class="voice-assignment-modal">
                <div class="scene-info">
                    <h5>🎬 Generate Audio for Scene</h5>
                    <p><strong>Characters:</strong> ${characters.join(', ')}</p>
                    <p><strong>Dialogue Lines:</strong> ${parsedLines.filter(line => line.type === 'dialogue').length}</p>
                </div>
                
                <div class="voice-assignments">
                    <h6>Voice Assignments</h6>
                    ${characters.map(character => `
                        <div class="voice-assignment-row">
                            <label><strong>${character}</strong></label>
                            <div class="voice-controls">
                                <select id="voice-${character}" class="form-control">
                                    <option value="">Select voice...</option>
                                    ${this.availableVoices.map(voice => `
                                        <option value="${voice.id}">${voice.name} (${voice.category || 'General'})</option>
                                    `).join('')}
                                </select>
                                <button class="btn btn-sm btn-outline" onclick="sceneVoiceGenerator.previewVoice('${character}', '${sceneId}')">
                                    🔊 Preview
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                

                
                <div class="generation-options">
                    <label>Pause between dialogue lines (seconds):</label>
                    <input type="number" id="pause-duration" class="form-control" value="0" min="0" max="3" step="0.1">
                    
                    <div class="advanced-settings" style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <h6>ElevenLabs Voice Settings</h6>
                        
                        <div class="form-group">
                            <label>Model:</label>
                            <select id="voice-model" class="form-control">
                                <option value="eleven_monolingual_v1">Eleven Monolingual v1 (Original)</option>
                                <option value="eleven_multilingual_v1">Eleven Multilingual v1</option>
                                <option value="eleven_multilingual_v2" selected>Eleven Multilingual v2 (Recommended)</option>
                                <option value="eleven_turbo_v2">Eleven Turbo v2 (Fast)</option>
                                <option value="eleven_turbo_v2_5">Eleven Turbo v2.5 (Latest)</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Stability: <span id="stability-value">1</span></label>
                            <input type="range" id="stability" class="form-control-range" value="1" min="0" max="1" step="0.05" oninput="document.getElementById('stability-value').textContent = this.value">
                            <small>Lower = more expressive but less stable</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Similarity Boost: <span id="similarity-value">1</span></label>
                            <input type="range" id="similarity-boost" class="form-control-range" value="1" min="0" max="1" step="0.05" oninput="document.getElementById('similarity-value').textContent = this.value">
                            <small>Higher = sticks closer to original voice</small>
                        </div>
                        
                        <div class="form-group">
                            <label>Style Exaggeration: <span id="style-value">0</span></label>
                            <input type="range" id="style-exaggeration" class="form-control-range" value="0" min="0" max="1" step="0.05" oninput="document.getElementById('style-value').textContent = this.value">
                            <small>Higher = more dramatic/expressive</small>
                        </div>
                        
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="speaker-boost" checked>
                                Speaker Boost (enhances similarity)
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        window.modalSystem.createModal({
            title: 'Voice Generation',
            content: modalContent,
            size: 'medium',
            primaryButton: {
                text: 'Generate Audio',
                action: () => this.generateSceneAudio(sceneId, dialogueText, characters)
            },
            secondaryButton: {
                text: 'Auto-Assign Voices',
                action: () => this.autoAssignVoices(characters)
            }
        });
    }

    /**
     * Auto-assign voices to characters
     */
    autoAssignVoices(characters) {
        let matchedCount = 0;
        const usedVoices = new Set();
        
        characters.forEach((character, index) => {
            const characterLower = character.toLowerCase();
            
            // First, try to find an exact or close match by name
            let matchedVoice = null;
            
            // Look for exact match first
            matchedVoice = this.availableVoices.find(voice => 
                voice.name.toLowerCase() === characterLower && !usedVoices.has(voice.id)
            );
            
            // If no exact match, try partial match (character name contains voice name or vice versa)
            if (!matchedVoice) {
                matchedVoice = this.availableVoices.find(voice => {
                    const voiceLower = voice.name.toLowerCase();
                    return (
                        (characterLower.includes(voiceLower) || voiceLower.includes(characterLower)) &&
                        voiceLower.length >= 3 && // Avoid matching very short names
                        !usedVoices.has(voice.id)
                    );
                });
            }
            
            // If still no match, use round-robin for remaining characters
            if (!matchedVoice) {
                const availableVoices = this.availableVoices.filter(voice => !usedVoices.has(voice.id));
                if (availableVoices.length > 0) {
                    const voiceIndex = (index - matchedCount) % availableVoices.length;
                    matchedVoice = availableVoices[voiceIndex];
                }
            } else {
                matchedCount++;
            }
            
            // Fallback to any voice if all else fails
            if (!matchedVoice) {
                const voiceIndex = index % this.availableVoices.length;
                matchedVoice = this.availableVoices[voiceIndex];
            }
            
            if (matchedVoice) {
                document.getElementById(`voice-${character}`).value = matchedVoice.id;
                usedVoices.add(matchedVoice.id);
            }
        });
        

        
        const message = matchedCount > 0 ? 
            `Voices auto-assigned! (${matchedCount} name matches found)` : 
            'Voices auto-assigned!';
        showToast(message, 'success');
    }

    /**
     * Preview voice for character
     */
    async previewVoice(character, sceneId) {
        const voiceId = document.getElementById(`voice-${character}`).value;
        if (!voiceId) {
            showToast('Please select a voice first', 'warning');
            return;
        }
        
        const sampleText = `Hello, I'm ${character}. This is how I sound in the scene.`;
        
        // Get current voice settings from the modal
        const voiceSettings = {
            model: document.getElementById('voice-model').value,
            stability: parseFloat(document.getElementById('stability').value),
            similarityBoost: parseFloat(document.getElementById('similarity-boost').value),
            styleExaggeration: parseFloat(document.getElementById('style-exaggeration').value),
            speakerBoost: document.getElementById('speaker-boost').checked
        };
        
        try {
            const response = await fetch('/api/voice/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    text: sampleText,
                    voiceId: voiceId,
                    voiceSettings: voiceSettings
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate voice preview');
            }
            
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const audio = new Audio(audioUrl);
            audio.play();
            
            audio.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
            });
            
        } catch (error) {
            console.error('Preview failed:', error);
            showToast('Voice preview failed', 'error');
        }
    }

    /**
     * Generate line-by-line audio for the scene
     */
    async generateSceneAudio(sceneId, dialogueText, characters) {
        // Get voice assignments
        const voiceAssignments = {};
        for (const character of characters) {
            const voiceId = document.getElementById(`voice-${character}`).value;
            if (!voiceId) {
                showToast(`Please assign a voice to ${character}`, 'warning');
                return;
            }
            voiceAssignments[character] = voiceId;
        }
        
        const pauseDuration = parseFloat(document.getElementById('pause-duration').value);
        
        // Get advanced voice settings
        const voiceSettings = {
            model: document.getElementById('voice-model').value,
            stability: parseFloat(document.getElementById('stability').value),
            similarityBoost: parseFloat(document.getElementById('similarity-boost').value),
            styleExaggeration: parseFloat(document.getElementById('style-exaggeration').value),
            speakerBoost: document.getElementById('speaker-boost').checked
        };
        
        window.modalSystem.hideModal();
        
        try {
            showLoading('Generating scene audio...');
            
            const response = await fetch('/api/voice/generate-scene-audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': appState.apiKey
                },
                body: JSON.stringify({
                    sceneId: sceneId,
                    dialogueText: dialogueText,
                    voiceAssignments: voiceAssignments,
                    includeActions: false,  // Always false since action lines should never be spoken
                    pauseDuration: pauseDuration,
                    voiceSettings: voiceSettings
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to generate scene audio');
            }
            
            const result = await response.json();
            
            // Show the audio player
            this.showAudioPlayer(sceneId, result);
            
            hideLoading();
            showToast('Scene audio generated successfully!', 'success');
            
        } catch (error) {
            console.error('Audio generation failed:', error);
            showToast('Audio generation failed', 'error');
            hideLoading();
        }
    }

    /**
     * Show audio player for the generated scene
     */
    showAudioPlayer(sceneId, audioResult) {
        const modalContent = `
            <div class="scene-audio-player">
                <h5>🎙️ Scene Audio Generated</h5>
                <div class="audio-info">
                    <p><strong>Scene:</strong> ${sceneId}</p>
                    <p><strong>Duration:</strong> ${audioResult.estimatedDuration?.toFixed(1) || 'Unknown'}s</p>
                    <p><strong>Audio Segments:</strong> ${audioResult.audioSegments?.length || 0}</p>
                </div>
                
                <div class="audio-controls">
                    <button class="btn btn-primary" onclick="sceneVoiceGenerator.playSceneAudio('${sceneId}', ${JSON.stringify(audioResult).replace(/"/g, '&quot;')})">
                        ▶️ Play Scene Audio
                    </button>
                    <button class="btn btn-success" onclick="sceneVoiceGenerator.downloadSceneAudio('${sceneId}')">
                        🎵 Download Complete Scene MP3
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="sceneVoiceGenerator.downloadSceneParts('${sceneId}')">
                        📁 Download Individual Parts (ZIP)
                    </button>
                </div>
                
                <div class="download-info" style="margin: 15px 0; padding: 10px; background: #d4edda; border-radius: 6px; border-left: 4px solid #28a745;">
                    <small><strong>🎵 Complete Scene:</strong> Single MP3 file with all dialogue combined in sequence - perfect for listening.<br>
                    <strong>📁 Individual Parts:</strong> Separate audio files for each line - ideal for editing and remixing.</small>
                </div>
                
                <div class="audio-segments">
                    <h6>Audio Segments</h6>
                    <div class="segments-list">
                        ${audioResult.audioSegments?.map((segment, index) => `
                            <div class="segment-item">
                                <strong>${segment.character || 'Narrator'}:</strong> 
                                <span class="segment-text">${segment.text?.substring(0, 50) || 'Audio segment'}...</span>
                                <button class="btn btn-sm btn-outline" onclick="sceneVoiceGenerator.playSegment(${index})">
                                    ▶️ Play
                                </button>
                            </div>
                        `).join('') || '<p>No segments available</p>'}
                    </div>
                </div>
            </div>
        `;
        
        window.modalSystem.createModal({
            title: 'Scene Audio Player',
            content: modalContent,
            size: 'large',
            closable: true
        });
        
        // Store audio result for playback
        this.currentSceneAudio = audioResult;
    }

    /**
     * Play the complete scene audio
     */
    async playSceneAudio(sceneId, audioResult) {
        try {
            // Stop any currently playing audio
            this.stopAllAudio();
            
            // Play each segment in sequence
            for (let i = 0; i < audioResult.audioSegments.length; i++) {
                const segment = audioResult.audioSegments[i];
                
                if (segment.type === 'pause') {
                    await this.sleep(segment.duration * 1000);
                } else if (segment.audioUrl) {
                    await this.playAudioSegment(segment.audioUrl);
                }
            }
            
            showToast('Scene audio finished playing', 'success');
            
        } catch (error) {
            console.error('Audio playback failed:', error);
            showToast('Audio playback failed', 'error');
        }
    }

    /**
     * Play individual audio segment
     */
    async playAudioSegment(audioUrl) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(audioUrl);
            this.audioElements.push(audio);
            
            audio.addEventListener('ended', resolve);
            audio.addEventListener('error', reject);
            
            audio.play().catch(reject);
        });
    }

    /**
     * Download complete scene audio as single MP3 file
     */
    async downloadSceneAudio(sceneId) {
        try {
            // Get project title for better file naming
            const projectTitle = appState.storyInput?.title || appState.currentStoryConcept?.title || 'Unnamed Project';
            console.log('🎬 Voice download - Project title debug:', {
                storyInputTitle: appState.storyInput?.title,
                storyConceptTitle: appState.currentStoryConcept?.title,
                finalTitle: projectTitle
            });
            // Clean project title but preserve spaces and common characters
            const cleanProjectTitle = projectTitle.replace(/[<>:"/\\|?*]/g, '').trim();
            
            // Clean scene ID - only convert underscores to dots for hierarchical numbering (1_2_3 -> 1.2.3)
            let cleanSceneId = sceneId.replace(/[<>:"/\\|?*]/g, '');
            
            // Check if it's a hierarchical pattern (numbers separated by underscores)
            if (/^\d+_\d+(?:_\d+)?$/.test(cleanSceneId)) {
                // Convert numeric hierarchical pattern to dots (1_2_3 -> 1.2.3)
                cleanSceneId = cleanSceneId.replace(/_/g, '.');
            }
            // Otherwise keep descriptive names as-is (opening_image-0 stays opening_image-0)
            
            const response = await fetch(`/api/voice/download-scene/${sceneId}`, {
                headers: {
                    'X-API-Key': appState.apiKey
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to download audio');
            }
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            // Simple filename: ProjectName_SceneID.mp3
            const filename = `${cleanProjectTitle}_${cleanSceneId}.mp3`;
            
            // Create download link and trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            
            // Add to downloads folder automatically (browser handles this)
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            showToast(`Downloaded: ${filename}`, 'success');
            
        } catch (error) {
            console.error('Download failed:', error);
            showToast('Complete scene download failed', 'error');
        }
    }

    /**
     * Download individual scene audio parts as ZIP file
     */
    async downloadSceneParts(sceneId) {
        try {
            // Get project title for better file naming
            const projectTitle = appState.storyInput?.title || appState.currentStoryConcept?.title || 'Unnamed Project';
            // Clean project title but preserve spaces and common characters
            const cleanProjectTitle = projectTitle.replace(/[<>:"/\\|?*]/g, '').trim();
            
            // Clean scene ID - only convert underscores to dots for hierarchical numbering (1_2_3 -> 1.2.3)
            let cleanSceneId = sceneId.replace(/[<>:"/\\|?*]/g, '');
            
            // Check if it's a hierarchical pattern (numbers separated by underscores)
            if (/^\d+_\d+(?:_\d+)?$/.test(cleanSceneId)) {
                // Convert numeric hierarchical pattern to dots (1_2_3 -> 1.2.3)
                cleanSceneId = cleanSceneId.replace(/_/g, '.');
            }
            // Otherwise keep descriptive names as-is (opening_image-0 stays opening_image-0)
            
            const response = await fetch(`/api/voice/download-scene-parts/${sceneId}`, {
                headers: {
                    'X-API-Key': appState.apiKey
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to download audio parts');
            }
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            // Simple filename: ProjectName_SceneID_Parts.zip
            const filename = `${cleanProjectTitle}_${cleanSceneId}_Parts.zip`;
            
            // Create download link and trigger download
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            
            // Add to downloads folder automatically (browser handles this)
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
            showToast(`Downloaded: ${filename}`, 'success');
            
        } catch (error) {
            console.error('Parts download failed:', error);
            showToast('Individual parts download failed', 'error');
        }
    }

    /**
     * Utility functions
     */
    stopAllAudio() {
        this.audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.audioElements = [];
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Remove parenthetical content from dialogue text
     */
    removeParentheticalContent(text) {
        // Remove anything in parentheses (stage directions, whispers, etc.)
        // This handles nested parentheses and multiple parenthetical expressions
        let cleanedText = text;
        
        // Remove parenthetical content like (laughing), (to John), (whispered), etc.
        cleanedText = cleanedText.replace(/\([^)]*\)/g, '');
        
        // Clean up any double spaces and trim
        cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
        
        return cleanedText;
    }

    /**
     * Check if voice generation is available
     */
    isVoiceGenerationAvailable() {
        return this.isInitialized && this.availableVoices.length > 0;
    }
}

// Initialize global instance
const sceneVoiceGenerator = new SceneVoiceGenerator();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    sceneVoiceGenerator.initialize();
});

// Add to window for global access
window.sceneVoiceGenerator = sceneVoiceGenerator; 