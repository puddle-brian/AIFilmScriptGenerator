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
        
        // Always use template structure as foundation if available
        if (appState.templateData && appState.templateData.structure) {
            console.log('✅ Using template structure with enhanced dialogue lookup');
            const templateStructure = appState.templateData.structure;
            console.log('Template structure keys:', Object.keys(templateStructure));
            
            // 🎯 CONTENT-FIRST PROCESSING: Process acts with dialogue first
            const allActKeys = Object.keys(templateStructure);
            const dialogueKeys = Object.keys(appState.generatedDialogues || {});
            
            // Separate acts with dialogue from acts without dialogue
            const actsWithDialogue = allActKeys.filter(actKey => {
                const actDialogueKeys = dialogueKeys.filter(key => key.startsWith(actKey + '-'));
                return actDialogueKeys.length > 0;
            });
            
            const actsWithoutDialogue = allActKeys.filter(actKey => {
                const actDialogueKeys = dialogueKeys.filter(key => key.startsWith(actKey + '-'));
                return actDialogueKeys.length === 0;
            });
            
            console.log('🎯 Content-first processing:');
            console.log('- Acts with dialogue (processed first):', actsWithDialogue);
            console.log('- Acts without dialogue (processed after):', actsWithoutDialogue);
            
            // Process acts with dialogue first, then acts without dialogue
            const orderedActKeys = [...actsWithDialogue, ...actsWithoutDialogue];
            console.log('🎯 Final processing order:', orderedActKeys);
            
            orderedActKeys.forEach((actKey) => {
                const act = templateStructure[actKey];
                console.log(`\n🎭 Processing act: ${actKey}`);
                
                // Check if we have plot points for this act
                const plotPoints = appState.plotPoints && appState.plotPoints[actKey];
                console.log(`📋 Plot points for ${actKey}:`, plotPoints ? plotPoints.length : 'none');
                
                // 🔍 DETAILED PLOT POINT DEBUGGING
                if (appState.plotPoints && appState.plotPoints[actKey]) {
                    console.log(`🔍 Plot points structure for ${actKey}:`, appState.plotPoints[actKey]);
                    console.log(`🔍 Plot points type for ${actKey}:`, typeof appState.plotPoints[actKey]);
                    console.log(`🔍 Plot points Array.isArray for ${actKey}:`, Array.isArray(appState.plotPoints[actKey]));
                } else {
                    console.log(`🔍 No plot points found for ${actKey}`);
                    console.log(`🔍 appState.plotPoints[${actKey}]:`, appState.plotPoints ? appState.plotPoints[actKey] : 'plotPoints object missing');
                    console.log(`🔍 Available plotPoints keys:`, appState.plotPoints ? Object.keys(appState.plotPoints) : 'none');
                    if (appState.plotPoints && Object.keys(appState.plotPoints).includes(actKey)) {
                        console.log(`🔍 Key "${actKey}" exists but value is:`, appState.plotPoints[actKey]);
                    }
                }
                
                // 🔍 DETAILED DEBUGGING: Check what dialogue keys exist for this act
                const actDialogueKeys = dialogueKeys.filter(key => key.startsWith(actKey + '-'));
                console.log(`🎬 Available dialogue keys for ${actKey}:`, actDialogueKeys);
                
                // 🎯 SKIP EMPTY ACTS: Skip acts that have no content at all
                const hasScenes = appState.generatedScenes && appState.generatedScenes[actKey];
                const hasDialogue = actDialogueKeys.length > 0;
                const hasPlotPoints = plotPoints && Array.isArray(plotPoints) && plotPoints.length > 0;
                
                if (!hasScenes && !hasDialogue && !hasPlotPoints) {
                    console.log(`⏭️ Skipping empty act: ${actKey} (no scenes, dialogue, or plot points)`);
                    return; // Skip this act entirely
                }
                
                console.log(`✅ Processing act: ${actKey} (has content: scenes=${!!hasScenes}, dialogue=${hasDialogue}, plotPoints=${hasPlotPoints})`);
                
                if (plotPoints && Array.isArray(plotPoints)) {
                    // Track overall scene count for this act (for old dialogue key fallback)
                    let actSceneCount = 0;
                    
                    // Process each plot point
                    plotPoints.forEach((plotPoint, plotIndex) => {
                        const plotPointKey = `${actKey}-${plotIndex}`;
                        
                        // Check if we have scenes for this plot point
                        const scenes = appState.generatedScenes && appState.generatedScenes[plotPointKey];
                        console.log(`🔍 Looking for scenes with key: ${plotPointKey}`, scenes ? `Found ${scenes.length} scenes` : 'No scenes');
                        
                        if (scenes && Array.isArray(scenes)) {
                            // Process each scene
                            scenes.forEach((scene, sceneIndex) => {
                                const sceneId = `${plotPointKey}-${sceneIndex}`;
                                totalScenes++;
                                
                                // Enhanced dialogue lookup with multiple fallback strategies
                                let dialogueFound = false;
                                let dialogueContent = null;
                                let lookupMethod = '';
                                
                                console.log(`🎬 Scene ${sceneNumber}: "${scene.title || 'Untitled'}" (${sceneId})`);
                                
                                // Strategy 1: Try exact scene ID (plot-point-based)
                                if (appState.generatedDialogues && appState.generatedDialogues[sceneId]) {
                                    dialogueContent = appState.generatedDialogues[sceneId];
                                    dialogueFound = true;
                                    lookupMethod = `exact sceneId: ${sceneId}`;
                                }
                                // Strategy 2: Try scene title
                                else if (appState.generatedDialogues && scene.title && appState.generatedDialogues[scene.title]) {
                                    dialogueContent = appState.generatedDialogues[scene.title];
                                    dialogueFound = true;
                                    lookupMethod = `scene title: ${scene.title}`;
                                }
                                // Strategy 3: Try normalized scene title
                                else if (appState.generatedDialogues && scene.title) {
                                    const normalizedTitle = scene.title.replace(/\s+/g, '_');
                                    if (appState.generatedDialogues[normalizedTitle]) {
                                        dialogueContent = appState.generatedDialogues[normalizedTitle];
                                        dialogueFound = true;
                                        lookupMethod = `normalized title: ${normalizedTitle}`;
                                    }
                                }
                                // Strategy 4: Try act-based key (common format: actKey-sceneIndex)
                                else {
                                    const actBasedKey = `${actKey}-${actSceneCount}`;
                                    if (appState.generatedDialogues && appState.generatedDialogues[actBasedKey]) {
                                        dialogueContent = appState.generatedDialogues[actBasedKey];
                                        dialogueFound = true;
                                        lookupMethod = `act-based key: ${actBasedKey}`;
                                    }
                                    // Strategy 5: Try simple scene index
                                    else {
                                        const simpleKey = `${actKey}-${sceneIndex}`;
                                        if (appState.generatedDialogues && appState.generatedDialogues[simpleKey]) {
                                            dialogueContent = appState.generatedDialogues[simpleKey];
                                            dialogueFound = true;
                                            lookupMethod = `simple key: ${simpleKey}`;
                                        }
                                    }
                                }
                                
                                if (dialogueFound) {
                                    console.log(`✅ Found dialogue using ${lookupMethod}`);
                                    script += this.formatSceneForScreenplay(dialogueContent, sceneNumber);
                                    totalGeneratedScenes++;
                                } else {
                                    console.log(`❌ No dialogue found - checked: ${sceneId}, ${scene.title}, ${actKey}-${actSceneCount}, ${actKey}-${sceneIndex}`);
                                    script += this.formatPlaceholderScene(scene, sceneNumber);
                                }
                                
                                actSceneCount++;
                                sceneNumber++;
                            });
                        } else {
                            // No scenes for this plot point - check for dialogue anyway
                            console.log(`🔍 No scenes for ${plotPointKey}, checking for dialogue...`);
                            
                            let dialogueFound = false;
                            let dialogueContent = null;
                            let lookupMethod = '';
                            
                            if (appState.generatedDialogues) {
                                // Try various key formats
                                const possibleKeys = [
                                    `${actKey}-${plotIndex}`,
                                    `${actKey}-0`,
                                    `${actKey}-${sceneNumber-1}`
                                ];
                                
                                for (const key of possibleKeys) {
                                    if (appState.generatedDialogues[key]) {
                                        dialogueContent = appState.generatedDialogues[key];
                                        dialogueFound = true;
                                        lookupMethod = `fallback key: ${key}`;
                                        console.log(`✅ Found dialogue using ${lookupMethod}`);
                                        break;
                                    }
                                }
                            }
                            
                            totalScenes++;
                            if (dialogueFound) {
                                script += this.formatSceneForScreenplay(dialogueContent, sceneNumber);
                                totalGeneratedScenes++;
                            } else {
                                console.log(`❌ No dialogue found for plot point ${plotPointKey}`);
                                script += this.formatPlotPointFallback(plotPoint, actKey, plotIndex, sceneNumber);
                            }
                            sceneNumber++;
                        }
                    });
                } else {
                    // No plot points - enhanced fallback with better dialogue detection
                    console.log(`📝 No plot points for ${actKey}, using enhanced act fallback`);
                    console.log(`🔍 Checking for dialogue keys starting with "${actKey}-":`, actDialogueKeys);
                    
                    // Check for ANY dialogue that starts with this actKey
                    let foundDialogue = false;
                    if (appState.generatedDialogues && actDialogueKeys.length > 0) {
                        console.log(`✅ Found ${actDialogueKeys.length} dialogue entries for ${actKey}:`, actDialogueKeys);
                        
                        // Sort keys to ensure proper order (act1-0, act1-1, etc.)
                        actDialogueKeys.sort();
                        
                        // Add each dialogue as a scene
                        actDialogueKeys.forEach((dialogueKey, index) => {
                            const dialogueContent = appState.generatedDialogues[dialogueKey];
                            console.log(`📝 Adding scene ${sceneNumber} with dialogue from key: ${dialogueKey}`);
                            script += this.formatSceneForScreenplay(dialogueContent, sceneNumber);
                            totalGeneratedScenes++;
                            totalScenes++;
                            sceneNumber++;
                            console.log(`✅ Added dialogue from key: ${dialogueKey}`);
                        });
                        foundDialogue = true;
                    }
                    
                    if (!foundDialogue) {
                        console.log(`❌ No dialogue found for ${actKey} (checked ${actDialogueKeys.length} keys)`);
                        script += this.formatActFallback(act, actKey, sceneNumber);
                        totalScenes++;
                        sceneNumber++;
                    }
                }
            });
        }
        // Legacy fallback: if no template structure, try to use existing generated content
        else if (appState.generatedScenes && Object.keys(appState.generatedScenes).length > 0) {
            console.log('📄 No template structure, using existing generated scenes');
            let structureKeys = Object.keys(appState.generatedScenes);
            
            structureKeys.forEach((structureKey) => {
                const sceneGroup = appState.generatedScenes[structureKey];
                if (sceneGroup && Array.isArray(sceneGroup)) {
                    sceneGroup.forEach((scene, index) => {
                        const sceneId = `${structureKey}-${index}`;
                        totalScenes++;
                        
                        // Check for dialogue
                        let dialogueFound = false;
                        let dialogueContent = null;
                        
                        if (appState.generatedDialogues && appState.generatedDialogues[sceneId]) {
                            dialogueContent = appState.generatedDialogues[sceneId];
                            dialogueFound = true;
                            console.log(`✅ Found dialogue for ${sceneId}`);
                        }
                        else if (appState.generatedDialogues && scene.title && appState.generatedDialogues[scene.title]) {
                            dialogueContent = appState.generatedDialogues[scene.title];
                            dialogueFound = true;
                            console.log(`✅ Found dialogue by title: ${scene.title}`);
                        }
                        
                        if (dialogueFound) {
                            script += this.formatSceneForScreenplay(dialogueContent, sceneNumber);
                            totalGeneratedScenes++;
                        } else {
                            console.log(`❌ No dialogue found for ${sceneId}`);
                            script += this.formatPlaceholderScene(scene, sceneNumber);
                        }
                        
                        sceneNumber++;
                    });
                }
            });
        } else {
            // Final fallback: if no structure at all, just add generated dialogues
            console.log('🔄 No structure, using fallback dialogue method');
            console.log('Available dialogues in fallback:', Object.keys(appState.generatedDialogues || {}));
            Object.values(appState.generatedDialogues || {}).forEach(dialogue => {
                script += this.formatSceneForScreenplay(dialogue, sceneNumber);
                totalGeneratedScenes++;
                sceneNumber++;
            });
            totalScenes = totalGeneratedScenes;
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
        formatted += `${scene.description || 'Scene description not available.'}\n\n`;
        formatted += `                    [DIALOGUE NOT GENERATED]\n\n`;
        formatted += `          This scene requires dialogue generation\n`;
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
        formatted += `                    [SCENES NOT GENERATED]\n\n`;
        formatted += `          This plot point requires scene generation\n`;
        formatted += `          to break down into specific scenes.\n\n\n`;
        
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
        formatted += `                    [PLOT POINTS NOT GENERATED]\n\n`;
        formatted += `          This act requires plot point generation\n`;
        formatted += `          to break down into specific story beats.\n\n\n`;
        
        console.log(`🚨 formatActFallback called for ${actKey} - this should not happen if plot points exist!`);
        console.log(`🔍 appState.plotPoints:`, appState.plotPoints);
        console.log(`🔍 Available plot point keys:`, Object.keys(appState.plotPoints || {}));
        
        return formatted;
    }

    // Export script in various formats
    async exportScript(format = 'text') {
        if (!appState.storyInput || Object.keys(appState.generatedDialogues).length === 0) {
            window.uiManagerInstance.showToast('No script to export.', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectData: appState,
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