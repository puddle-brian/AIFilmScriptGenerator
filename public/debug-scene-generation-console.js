// Scene Generation Debug Console Functions
// Copy and paste these functions into your browser console while your app is running

// 🔍 Debug scene generation issues
function debugSceneGeneration() {
    console.log('🔍 === SCENE GENERATION DEBUG REPORT ===');
    
    // Check if we're in the main app context
    if (typeof window.appState === 'undefined' || !window.appState) {
        console.error('❌ Error: appState not found. Make sure you run this from your main application.');
        return;
    }

    const appState = window.appState;
    
    // Check basic requirements
    console.log('📋 Basic Requirements Check:');
    console.log(`  ✅ appState exists: ${!!appState}`);
    console.log(`  ✅ projectPath: ${appState.projectPath || 'NOT SET'}`);
    console.log(`  ✅ generatedStructure: ${appState.generatedStructure ? Object.keys(appState.generatedStructure).length + ' acts' : 'NOT SET'}`);
    console.log(`  ✅ plotPoints: ${appState.plotPoints ? Object.keys(appState.plotPoints).length + ' acts with plot points' : 'NOT SET'}`);
    
    if (!appState.generatedStructure || !appState.plotPoints) {
        console.error('❌ Missing basic requirements. Please ensure you have generated story structure and plot points first.');
        return;
    }

    // Check each act
    console.log('\n🎭 Act-by-Act Analysis:');
    const structureKeys = Object.keys(appState.generatedStructure);
    
    for (const structureKey of structureKeys) {
        console.log(`\n📖 Act: ${structureKey}`);
        
        // Check if plot points exist for this act
        const plotPointsData = appState.plotPoints[structureKey];
        
        if (!plotPointsData) {
            console.error(`  ❌ No plot points found for ${structureKey}`);
        } else {
            console.log(`  ✅ Plot points found for ${structureKey}`);
            
            // Check the format
            console.log(`  📊 Data Type: ${typeof plotPointsData} ${Array.isArray(plotPointsData) ? '(Array)' : '(Object)'}`);
            
            if (Array.isArray(plotPointsData)) {
                console.log(`  📊 Format: Direct array format`);
                console.log(`  📊 Count: ${plotPointsData.length} plot points`);
                console.log(`  📊 hasPlotPointsForElement result: ${window.generationHelperManager ? window.generationHelperManager.hasPlotPointsForElement(structureKey) : 'generationHelperManager not available'}`);
            } else if (typeof plotPointsData === 'object' && plotPointsData !== null) {
                console.log(`  📊 Format: Object format`);
                console.log(`  📊 Keys: ${Object.keys(plotPointsData).join(', ')}`);
                
                if (plotPointsData.plotPoints && Array.isArray(plotPointsData.plotPoints)) {
                    console.log(`  📊 Contains plotPoints array: Yes (${plotPointsData.plotPoints.length} items)`);
                } else {
                    console.log(`  📊 Contains plotPoints array: No`);
                }
                
                console.log(`  📊 hasPlotPointsForElement result: ${window.generationHelperManager ? window.generationHelperManager.hasPlotPointsForElement(structureKey) : 'generationHelperManager not available'}`);
            }
            
            // Show the actual data structure
            console.log(`  📋 Full Data Structure:`, plotPointsData);
        }
    }
    
    // Check the hasPlotPointsForElement function
    console.log('\n🔧 Function Analysis:');
    if (window.generationHelperManager) {
        console.log('  ✅ generationHelperManager available');
        
        const actsWithPlotPoints = structureKeys.filter(key => 
            window.generationHelperManager.hasPlotPointsForElement(key)
        );
        
        console.log(`  📊 Acts with plot points detected: ${actsWithPlotPoints.length} out of ${structureKeys.length}`);
        console.log(`  📊 Acts detected: ${actsWithPlotPoints.join(', ')}`);
        
        if (actsWithPlotPoints.length === 0) {
            console.error('  ❌ No acts detected with plot points - This is the root cause of the scene generation failure!');
        } else if (actsWithPlotPoints.length < structureKeys.length) {
            console.warn('  ⚠️ Some acts not detected with plot points - This may cause partial scene generation failure');
        } else {
            console.log('  ✅ All acts detected with plot points');
        }
    } else {
        console.error('  ❌ generationHelperManager not available');
    }
    
    console.log('\n✅ Debug report complete!');
}

// 🔧 Fix plot points format
function fixPlotPointsFormat() {
    console.log('🔧 === FIXING PLOT POINTS FORMAT ===');
    
    if (typeof window.appState === 'undefined' || !window.appState || !window.appState.plotPoints) {
        console.error('❌ No plot points data available for fixing');
        return;
    }
    
    const plotPoints = window.appState.plotPoints;
    let fixedCount = 0;
    let totalCount = 0;
    
    console.log('🔧 Fixing Plot Points Format...');
    
    for (const [structureKey, plotPointsData] of Object.entries(plotPoints)) {
        totalCount++;
        console.log(`\n🔧 Processing Act: ${structureKey}`);
        
        if (!plotPointsData) {
            console.error(`  ❌ No data to fix`);
        } else if (Array.isArray(plotPointsData)) {
            console.log(`  ✅ Already in correct format (direct array)`);
        } else if (typeof plotPointsData === 'object' && plotPointsData !== null) {
            if (plotPointsData.plotPoints && Array.isArray(plotPointsData.plotPoints)) {
                // Fix: Convert to direct array format
                window.appState.plotPoints[structureKey] = plotPointsData.plotPoints;
                fixedCount++;
                console.log(`  ✅ Fixed: Converted object format to direct array (${plotPointsData.plotPoints.length} plot points)`);
            } else {
                console.error(`  ❌ Cannot fix: Object format without plotPoints array`);
            }
        } else {
            console.error(`  ❌ Cannot fix: Unknown format`);
        }
    }
    
    console.log(`\n📊 Summary: Fixed ${fixedCount} out of ${totalCount} acts`);
    if (fixedCount > 0) {
        console.log('✅ Plot points format has been fixed! Try scene generation again.');
        console.log('💡 Remember to save your project to persist these changes.');
        
        // Save the changes
        if (typeof saveToLocalStorage === 'function') {
            saveToLocalStorage();
            console.log('💾 Changes saved to localStorage');
        }
    } else {
        console.log('⚠️ No fixes were needed or possible.');
    }
}

// 🧪 Test specific act
function testActPlotPoints(actKey) {
    console.log(`🧪 === TESTING ACT: ${actKey} ===`);
    
    if (typeof window.appState === 'undefined' || !window.appState || !window.appState.plotPoints) {
        console.error('❌ No plot points data available for testing');
        return;
    }
    
    const plotPointsData = window.appState.plotPoints[actKey];
    
    if (!plotPointsData) {
        console.error(`❌ No plot points found for ${actKey}`);
        return;
    }
    
    console.log(`📊 Data Type: ${typeof plotPointsData} ${Array.isArray(plotPointsData) ? '(Array)' : '(Object)'}`);
    console.log(`📊 Raw Data:`, plotPointsData);
    
    if (window.generationHelperManager) {
        const hasPlotPoints = window.generationHelperManager.hasPlotPointsForElement(actKey);
        console.log(`📊 hasPlotPointsForElement result: ${hasPlotPoints}`);
    }
}

// Display help
function debugHelp() {
    console.log('🔍 === SCENE GENERATION DEBUG HELP ===');
    console.log('Available debug functions:');
    console.log('  debugSceneGeneration()     - Full debug report');
    console.log('  fixPlotPointsFormat()      - Fix plot points format issues');
    console.log('  testActPlotPoints(actKey)  - Test specific act (e.g., testActPlotPoints("act_1"))');
    console.log('  debugHelp()                - Show this help');
    console.log('');
    console.log('Instructions:');
    console.log('1. Make sure you are on your main application page');
    console.log('2. Open browser console (F12)');
    console.log('3. Copy and paste the debug functions from debug-scene-generation-console.js');
    console.log('4. Run debugSceneGeneration() to see the full report');
    console.log('5. Run fixPlotPointsFormat() if issues are found');
}

// Export functions for global access
window.debugSceneGeneration = debugSceneGeneration;
window.fixPlotPointsFormat = fixPlotPointsFormat;
window.testActPlotPoints = testActPlotPoints;
window.debugHelp = debugHelp;

console.log('🔧 Scene Generation Debug Functions Loaded!');
console.log('Type debugHelp() for available commands.'); 