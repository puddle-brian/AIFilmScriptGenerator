/**
 * Script Assembly System Component
 * Handles final script assembly, formatting, and export functionality
 * 
 * Functions extracted from script.js:
 * - finalizeScript() - Main script assembly trigger
 * - assembleScript() - Core script assembly logic
 * - generateTitlePage() - Professional title page creation
 * - formatSceneForScreenplay() - Scene formatting for screenplay
 * - formatPlaceholderScene() - Placeholder scene formatting
 * - formatPlotPointFallback() - Plot point fallback formatting
 * - formatActFallback() - Act fallback formatting
 * - exportScript() - Script export functionality
 * - downloadFile() - File download utility
 * - addSceneNavigation() - Script navigation dropdown
 */

class ScriptAssemblyManager {
    constructor() {
        console.log('🎬 ScriptAssemblyManager initialized');
    }

    // Finalize script - main entry point
    finalizeScript() {
        if (Object.keys(appState.generatedDialogues).length === 0) {
            window.uiManagerInstance.showToast('Please generate dialogue for at least one scene.', 'error');
            return;
        }
        
        this.assembleScript();
        window.uiManagerInstance.goToNextStep(); // Go to final script step (now step 7)
        window.uiManagerInstance.showToast('Script assembled with your generated scenes!', 'success');
    }

    // Assemble final script in professional format
    assembleScript() {
        let script = '';
        let sceneNumber = 1;
        let totalGeneratedScenes = 0;
        let totalScenes = 0;
        
        // Debug logging (enhanced for troubleshooting)
        console.log('=== ASSEMBLE SCRIPT DEBUG ===');
        console.log('📊 Current appState overview:');
        console.log('- generatedDialogues keys:', Object.keys(appState.generatedDialogues || {}));
        console.log('- generatedScenes keys:', Object.keys(appState.generatedScenes || {}));
        console.log('- plotPoints keys:', Object.keys(appState.plotPoints || {}));
        console.log('- templateData structure keys:', appState.templateData?.structure ? Object.keys(appState.templateData.structure) : 'No template structure');
        
        // Professional title page
        script += this.generateTitlePage();
        
        // Start screenplay content
        script += '\n\n\nFADE IN:\n\n';
        
        // Count total available dialogues first
        const totalDialogues = Object.keys(appState.generatedDialogues || {}).length;
        console.log('Total dialogues available:', totalDialogues);
        
        // 🔧 FIX: Always use dialogue generation order for scene assembly
        // This ensures scenes appear in the same order as they were generated
        if (appState.generatedDialogues && Object.keys(appState.generatedDialogues).length > 0) {
            console.log('✅ Using dialogue generation order for consistent scene assembly');
            
            // Get all dialogue keys in their EXACT generation order (no sorting!)
            const dialogueKeys = Object.keys(appState.generatedDialogues);
            console.log('📋 Dialogue keys in exact generation order:', dialogueKeys);
            
            // Process each dialogue in the exact order they were generated
            dialogueKeys.forEach((dialogueKey) => {
                const dialogueContent = appState.generatedDialogues[dialogueKey];
                console.log(`📝 Adding scene ${sceneNumber} with dialogue from key: ${dialogueKey}`);
                script += this.formatSceneForScreenplay(dialogueContent, sceneNumber);
                totalGeneratedScenes++;
                totalScenes++;
                sceneNumber++;
                console.log(`✅ Added dialogue from key: ${dialogueKey}`);
            });
        }
        // Fallback: if no dialogues, use the old template-based approach
        else if (appState.templateData && appState.templateData.structure) {
            console.log('📄 No dialogues found, using template structure fallback');
            const templateStructure = appState.templateData.structure;
            console.log('Template structure keys:', Object.keys(templateStructure));
            
            // Process template structure for scenes without dialogue
            const orderedActKeys = Object.keys(templateStructure);
            
            orderedActKeys.forEach((actKey) => {
                const act = templateStructure[actKey];
                console.log(`\n🎭 Processing act: ${actKey} (fallback mode)`);
                
                // Check if we have scenes for this act (without dialogue)
                const actScenes = appState.generatedScenes && appState.generatedScenes[actKey];
                if (actScenes && Array.isArray(actScenes) && actScenes.length > 0) {
                    console.log(`⬇️ Found ${actScenes.length} scenes for ${actKey} (no dialogue)`);
                    // Process scenes without dialogue
                    actScenes.forEach((scene, index) => {
                        console.log(`📝 Adding scene ${sceneNumber} with scene info: "${scene.title || 'Untitled'}"`);
                        script += this.formatPlaceholderScene(scene, sceneNumber);
                        totalScenes++;
                        sceneNumber++;
                    });
                } else {
                    console.log(`⬇️ No scenes found for ${actKey}, using act info`);
                    script += this.formatActFallback(act, actKey, sceneNumber);
                    totalScenes++;
                    sceneNumber++;
                }
            });
        }
        // Final fallback: if no structure at all, just add what we have
        else {
            console.log('🔄 No structure or dialogues, using basic fallback');
            script += '\n\nNo content available for script assembly.\n\nPlease generate scenes and dialogue first.\n\n';
            totalScenes = 1;
        }
        
        script += '\n\nFADE OUT.\n\nTHE END';
        
        // Display script preview
        document.getElementById('scriptPreview').textContent = script;
        
        // Add scene navigation
        this.addSceneNavigation();
        
        // Update statistics with better page estimation
        const estimatedPages = Math.ceil(script.split('\n').length / 55); // ~55 lines per page
        
        console.log(`\n📊 Final assembly stats:`);
        console.log(`- Generated scenes with dialogue: ${totalGeneratedScenes}`);
        console.log(`- Total scenes: ${totalScenes}`);
        console.log(`- Estimated pages: ${estimatedPages}`);
        
        // Update DOM elements with correct IDs for final script display
        const totalScenesElement = document.getElementById('totalScenesDisplay');
        const estimatedPagesElement = document.getElementById('estimatedPagesDisplay');
        
        if (totalScenesElement) {
            totalScenesElement.textContent = `${totalGeneratedScenes}/${totalScenes} scenes`;
            console.log(`✅ Updated totalScenesDisplay to: ${totalGeneratedScenes}/${totalScenes} scenes`);
        } else {
            console.error('❌ totalScenesDisplay element not found!');
        }
        
        if (estimatedPagesElement) {
            estimatedPagesElement.textContent = estimatedPages;
            console.log(`✅ Updated estimatedPagesDisplay to: ${estimatedPages}`);
        } else {
            console.error('❌ estimatedPagesDisplay element not found!');
        }
        
        saveToLocalStorage();
    }

    // Generate professional title page
    generateTitlePage() {
        const title = appState.storyInput?.title || 'UNTITLED';
        
        // Use actual username if available, otherwise generic
        const author = appState.user?.username || 'Writer';
        
        // Contact info in bottom right corner (just email is sufficient for spec scripts)
        const contactInfo = appState.user?.email || 'writer@example.com';
        
        return `




                                        ${title.toUpperCase()}


                                       written by

                                        ${author}
























                                                         ${contactInfo}`;
    }

    // Format scene for professional screenplay layout
    formatSceneForScreenplay(dialogue, sceneNumber) {
        // Add page break suggestion every few scenes
        let formatted = '';
        
        if (sceneNumber > 1 && (sceneNumber - 1) % 3 === 0) {
            formatted += '\n\n                         [PAGE BREAK]\n\n';
        }
        
        // Clean up and format the dialogue
        const lines = dialogue.split('\n');
        let inDialogue = false;
        let currentCharacter = '';
        
        for (let line of lines) {
            line = line.trim();
            if (!line) {
                formatted += '\n';
                continue;
            }
            
            // Scene headings (INT./EXT.)
            if (line.match(/^(INT\.|EXT\.)/i)) {
                formatted += `\nSCENE ${sceneNumber}\n\n${line.toUpperCase()}\n\n`;
            }
            // Character names (all caps, no colon)
            else if (line.match(/^[A-Z][A-Z\s]+:?$/)) {
                currentCharacter = line.replace(':', '').trim();
                formatted += `                    ${currentCharacter}\n`;
                inDialogue = true;
            }
            // Parentheticals
            else if (line.match(/^\(.+\)$/)) {
                formatted += `                  ${line}\n`;
            }
            // Dialogue lines
            else if (inDialogue && !line.match(/^(INT\.|EXT\.)/i)) {
                // Center dialogue text
                formatted += `          ${line}\n`;
            }
            // Action lines
            else {
                formatted += `${line}\n`;
                inDialogue = false;
            }
        }
        
        formatted += '\n\n';
        return formatted;
    }

    // Format placeholder scene professionally
    formatPlaceholderScene(scene, sceneNumber) {
        const location = scene.location || 'LOCATION NOT SPECIFIED';
        const time = scene.time_of_day || scene.time || 'TIME NOT SPECIFIED';
        const sceneHeading = `INT. ${location.toUpperCase()} - ${time.toUpperCase()}`;
        
        let formatted = '';
        
        if (sceneNumber > 1 && (sceneNumber - 1) % 3 === 0) {
            formatted += '\n\n                         [PAGE BREAK]\n\n';
        }
        
        formatted += `SCENE ${sceneNumber}\n\n${sceneHeading}\n\n`;
        
        // Show scene title if available
        if (scene.title) {
            formatted += `${scene.title}\n\n`;
        }
        
        formatted += `${scene.description || 'Scene description not available.'}\n\n`;
        formatted += `                    [LEVEL 2: SCENE OUTLINE]\n\n`;
        formatted += `          This scene needs dialogue generation\n`;
        formatted += `          to complete the screenplay.\n\n\n`;
        
        return formatted;
    }

    // Format plot point fallback when no scenes exist
    formatPlotPointFallback(plotPoint, actKey, plotIndex, sceneNumber) {
        let formatted = '';
        
        if (sceneNumber > 1 && (sceneNumber - 1) % 3 === 0) {
            formatted += '\n\n                         [PAGE BREAK]\n\n';
        }
        
        formatted += `SCENE ${sceneNumber}\n\n`;
        formatted += `INT. LOCATION TO BE DETERMINED - DAY\n\n`;
        formatted += `${plotPoint.description || plotPoint.title || 'Plot point description not available.'}\n\n`;
        formatted += `                    [LEVEL 3: PLOT POINT OUTLINE]\n\n`;
        formatted += `          This plot point needs scenes and dialogue\n`;
        formatted += `          to be fully developed.\n\n\n`;
        
        return formatted;
    }

    // Format act fallback when no plot points exist
    formatActFallback(act, actKey, sceneNumber) {
        let formatted = '';
        
        if (sceneNumber > 1 && (sceneNumber - 1) % 3 === 0) {
            formatted += '\n\n                         [PAGE BREAK]\n\n';
        }
        
        formatted += `SCENE ${sceneNumber}\n\n`;
        formatted += `INT. LOCATION TO BE DETERMINED - DAY\n\n`;
        
        // Try to get the generated act title first, then fall back to template
        let actContent = '';
        const generatedAct = appState.generatedStructure && appState.generatedStructure[actKey];
        
        if (generatedAct && generatedAct.name) {
            // Use generated act title
            actContent = generatedAct.name;
        } else if (generatedAct && generatedAct.description) {
            // Use generated act description
            actContent = generatedAct.description;
        } else {
            // Fall back to template
            actContent = act.description || act.title || 'Act description not available.';
        }
        
        formatted += `${actContent}\n\n`;
        formatted += `                    [LEVEL 4: ACT OUTLINE ONLY]\n\n`;
        formatted += `          This act needs plot points, scenes, and dialogue\n`;
        formatted += `          to be fully developed.\n\n\n`;
        
        return formatted;
    }

    // Export script in various formats
    async exportScript(format = 'text') {
        if (!appState.storyInput || Object.keys(appState.generatedDialogues).length === 0) {
            window.uiManagerInstance.showToast('No script to export.', 'error');
            return;
        }
        
        try {
            // Get dialogue keys in the same order as frontend assembly
            const dialogueKeys = Object.keys(appState.generatedDialogues);
            console.log('📋 Sending dialogue keys order to server:', dialogueKeys);
            console.log('🔧 EXPORT FIX DEPLOYED - v2.1 - dialogue order preservation active');
            
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectData: appState,
                    dialogueKeysOrder: dialogueKeys,  // 🔧 Send explicit order
                    format: format,
                    projectPath: appState.projectPath
                })
            });
            
            if (format === 'json') {
                const data = await response.json();
                this.downloadFile(JSON.stringify(data, null, 2), `${appState.storyInput.title || 'script'}.json`, 'application/json');
            } else {
                // Let the browser handle the download using server's headers (preserves correct filename and content-type)
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // Extract filename from server response headers if available
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = `${appState.storyInput.title || 'script'}.txt`; // fallback
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                    }
                }
                
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
            
            // Mark as exported and update step indicators
            appState.hasExported = true;
            updateStepIndicators();
            updateUniversalNavigation();
            updateBreadcrumbNavigation();
            saveToLocalStorage();
            
            window.uiManagerInstance.showToast('Script exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting script:', error);
            window.uiManagerInstance.showToast('Error exporting script. Please try again.', 'error');
        }
    }

    // Utility function to download files
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Add scene navigation dropdown to script preview
    addSceneNavigation() {
        const scriptPreview = document.getElementById('scriptPreview');
        if (!scriptPreview) return;
        
        const scriptText = scriptPreview.textContent;
        const lines = scriptText.split('\n');
        const scenes = [];
        
        // Build scene titles from appState data
        const sceneData = [];
        if (appState.generatedScenes) {
            let structureKeys = Object.keys(appState.generatedScenes);
            
            // Use template order if available
            if (appState.templateData && appState.templateData.structure) {
                const templateKeys = Object.keys(appState.templateData.structure);
                structureKeys = templateKeys.filter(key => appState.generatedScenes[key]);
            }
            
            structureKeys.forEach((structureKey) => {
                const sceneGroup = appState.generatedScenes[structureKey];
                if (sceneGroup && Array.isArray(sceneGroup)) {
                    sceneGroup.forEach((scene, index) => {
                        sceneData.push({
                            title: scene.title || `Scene ${structureKey}-${index}`,
                            location: scene.location || 'Unknown Location'
                        });
                    });
                }
            });
        }
        
        // Find scene headers and match with scene data
        let sceneIndex = 0;
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.match(/^(INT\.|EXT\.)/i)) {
                const sceneTitle = sceneData[sceneIndex] ? sceneData[sceneIndex].title : trimmed;
                scenes.push({
                    title: sceneTitle,
                    lineNumber: index
                });
                sceneIndex++;
            }
        });
        
        if (scenes.length === 0) return;
        
        // Add dropdown if it doesn't exist
        let navDropdown = document.getElementById('sceneNavDropdown');
        if (!navDropdown) {
            const navContainer = document.createElement('div');
            navContainer.className = 'scene-nav';
            navContainer.innerHTML = `
                <select id="sceneNavDropdown">
                    <option value="">Jump to scene...</option>
                    ${scenes.map((scene, index) => `
                        <option value="${scene.lineNumber}">Scene ${index + 1}: ${scene.title}</option>
                    `).join('')}
                </select>
            `;
            scriptPreview.parentNode.insertBefore(navContainer, scriptPreview);
            navDropdown = document.getElementById('sceneNavDropdown');
        }
        
        // Navigation handler
        navDropdown.addEventListener('change', function() {
            const lineNumber = parseInt(this.value);
            if (!lineNumber) return;
            
            // Calculate approximate scroll position
            const totalLines = lines.length;
            const percentage = lineNumber / totalLines;
            const scrollPosition = scriptPreview.scrollHeight * percentage;
            
            scriptPreview.scrollTop = scrollPosition;
            this.value = ''; // Reset dropdown
        });
    }

    // Debug function to help troubleshoot dialogue lookup issues
    debugDialogueLookup() {
        console.log('\n🔍 DIALOGUE LOOKUP DIAGNOSTIC');
        console.log('==============================');
        
        console.log('\n📊 Project Overview:');
        console.log('- Project authenticated:', !!appState.isAuthenticated);
        console.log('- Project path:', appState.projectPath || 'No project path');
        console.log('- Story title:', appState.storyInput?.title || 'No title');
        
        console.log('\n📚 Generated Content:');
        console.log('- Dialogue entries:', Object.keys(appState.generatedDialogues || {}).length);
        console.log('- Scene groups:', Object.keys(appState.generatedScenes || {}).length);
        console.log('- Plot point groups:', Object.keys(appState.plotPoints || {}).length);
        
        console.log('\n🎬 Dialogue Keys (what we have):');
        const dialogueKeys = Object.keys(appState.generatedDialogues || {});
        dialogueKeys.forEach(key => {
            const preview = appState.generatedDialogues[key]?.substring(0, 100) || '';
            console.log(`- "${key}": "${preview}${preview.length >= 100 ? '...' : ''}"`);
        });
        
        console.log('\n🎭 Template Structure:');
        if (appState.templateData?.structure) {
            Object.keys(appState.templateData.structure).forEach(actKey => {
                const act = appState.templateData.structure[actKey];
                const plotPoints = appState.plotPoints?.[actKey];
                const scenes = appState.generatedScenes?.[actKey];
                
                console.log(`\n Act: ${actKey} ("${act.title || act.description || 'Unnamed'}")`);
                console.log(`  - Plot points: ${plotPoints?.length || 0}`);
                console.log(`  - Scenes: ${scenes?.length || 0}`);
                
                // Check if dialogue exists for this act
                const actDialogueKeys = dialogueKeys.filter(key => key.startsWith(actKey));
                console.log(`  - Dialogue keys: ${actDialogueKeys.length} (${actDialogueKeys.join(', ')})`);
            });
        } else {
            console.log('- No template structure found');
        }
        
        console.log('\n💡 Recommendations:');
        if (dialogueKeys.length === 0) {
            console.log('❌ No dialogue generated yet. Generate dialogue in Step 6 first.');
        } else if (!appState.templateData?.structure) {
            console.log('⚠️ No template structure. This might cause assembly issues.');
        } else {
            console.log('✅ You have dialogue and structure. Assembly should work.');
            
            // Check for common issues
            const hasActBasedKeys = dialogueKeys.some(key => key.match(/^[^-]+-\d+$/));
            const hasPlotPointBasedKeys = dialogueKeys.some(key => key.match(/^[^-]+-\d+-\d+$/));
            
            if (hasActBasedKeys && !hasPlotPointBasedKeys) {
                console.log('ℹ️ Dialogue uses act-based keys (e.g., "act1-0"). This is normal.');
            } else if (hasPlotPointBasedKeys) {
                console.log('ℹ️ Dialogue uses plot-point-based keys (e.g., "act1-0-0"). This is also normal.');
            }
        }
        
        console.log('\n🔧 Next Steps:');
        console.log('1. If dialogue is missing, generate it in Step 6');
        console.log('2. Try refreshing the script assembly in Step 7');
        console.log('3. Check browser console for detailed assembly logs');
        
        return {
            dialogueCount: dialogueKeys.length,
            sceneCount: Object.keys(appState.generatedScenes || {}).length,
            plotPointCount: Object.keys(appState.plotPoints || {}).length,
            hasStructure: !!appState.templateData?.structure,
            dialogueKeys: dialogueKeys
        };
    }
}

// Create global instance
const scriptAssemblyManager = new ScriptAssemblyManager();
window.scriptAssemblyManagerInstance = scriptAssemblyManager;

// Legacy wrapper functions for backward compatibility
function finalizeScript() {
    return scriptAssemblyManager.finalizeScript();
}

function assembleScript() {
    return scriptAssemblyManager.assembleScript();
}

function generateTitlePage() {
    return scriptAssemblyManager.generateTitlePage();
}

function formatSceneForScreenplay(dialogue, sceneNumber) {
    return scriptAssemblyManager.formatSceneForScreenplay(dialogue, sceneNumber);
}

function formatPlaceholderScene(scene, sceneNumber) {
    return scriptAssemblyManager.formatPlaceholderScene(scene, sceneNumber);
}

function formatPlotPointFallback(plotPoint, actKey, plotIndex, sceneNumber) {
    return scriptAssemblyManager.formatPlotPointFallback(plotPoint, actKey, plotIndex, sceneNumber);
}

function formatActFallback(act, actKey, sceneNumber) {
    return scriptAssemblyManager.formatActFallback(act, actKey, sceneNumber);
}

async function exportScript(format = 'text') {
    return await scriptAssemblyManager.exportScript(format);
}

function downloadFile(content, filename, contentType) {
    return scriptAssemblyManager.downloadFile(content, filename, contentType);
}

function addSceneNavigation() {
    return scriptAssemblyManager.addSceneNavigation();
}

// Legacy wrapper function for debug assistance
function debugDialogueLookup() {
    return window.scriptAssemblyManagerInstance.debugDialogueLookup();
}

console.log('✅ Script Assembly Manager component loaded successfully'); 