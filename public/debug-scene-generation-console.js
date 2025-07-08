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

// 🔍 DEBUG SCENE GENERATION ISSUE
// Run this in the console to diagnose the "generating 0 scenes for 0 acts" problem

console.log('🔍 DEBUGGING SCENE GENERATION ISSUE');
console.log('=====================================');

// 1. Check if appState exists and what's in it
console.log('1. AppState Check:');
console.log('  appState exists:', !!window.appState);
console.log('  appState.generatedStructure:', window.appState?.generatedStructure ? Object.keys(window.appState.generatedStructure) : 'NOT FOUND');
console.log('  appState.plotPoints:', window.appState?.plotPoints ? Object.keys(window.appState.plotPoints) : 'NOT FOUND');
console.log('  appState.projectPath:', window.appState?.projectPath);

// 2. Check plot points data structure
if (window.appState?.plotPoints) {
    console.log('\n2. Plot Points Data Structure:');
    Object.entries(window.appState.plotPoints).forEach(([actKey, plotData]) => {
        console.log(`  ${actKey}:`, {
            type: typeof plotData,
            isArray: Array.isArray(plotData),
            hasPlotPointsProperty: plotData?.plotPoints ? 'YES' : 'NO',
            length: Array.isArray(plotData) ? plotData.length : (plotData?.plotPoints?.length || 'N/A'),
            sample: Array.isArray(plotData) ? plotData[0] : plotData?.plotPoints?.[0]
        });
    });
} else {
    console.log('\n2. ❌ NO PLOT POINTS FOUND IN appState');
}

// 3. Check if generationHelperManager exists
console.log('\n3. Generation Helper Manager:');
console.log('  window.generationHelperManager exists:', !!window.generationHelperManager);

// 4. Test hasPlotPointsForElement function for each act
if (window.appState?.generatedStructure) {
    console.log('\n4. Testing hasPlotPointsForElement for each act:');
    Object.keys(window.appState.generatedStructure).forEach(actKey => {
        const hasPlotPoints = window.hasPlotPointsForElement ? window.hasPlotPointsForElement(actKey) : 'FUNCTION NOT FOUND';
        console.log(`  ${actKey}: ${hasPlotPoints}`);
    });
} else {
    console.log('\n4. ❌ NO GENERATED STRUCTURE FOUND');
}

// 5. Test the filtering logic directly
if (window.appState?.generatedStructure) {
    console.log('\n5. Testing Scene Generation Filter Logic:');
    const structureKeys = Object.keys(window.appState.generatedStructure);
    console.log('  Structure keys:', structureKeys);
    
    const actsWithPlotPoints = structureKeys.filter(key => {
        const hasPlots = window.hasPlotPointsForElement ? window.hasPlotPointsForElement(key) : false;
        console.log(`    ${key} has plot points:`, hasPlots);
        return hasPlots;
    });
    
    console.log('  Acts with plot points:', actsWithPlotPoints);
    console.log('  Count:', actsWithPlotPoints.length);
}

// 6. Check if we're in the right step
console.log('\n6. Current Step Check:');
console.log('  currentStep:', window.appState?.currentStep);
console.log('  Should be step 5 for scene generation');

// 🚨 NEW: Targeted scene generation debugging
console.log('\n7. Scene Generation Prerequisites:');
console.log('  appState.isAuthenticated:', window.appState?.isAuthenticated);
console.log('  appState.apiKey exists:', !!window.appState?.apiKey);
console.log('  creditWidget exists:', !!window.creditWidget);

// 8. Test the actual scene generation logic step by step
console.log('\n8. Manual Scene Generation Test:');
try {
    if (window.sceneGenerationManager) {
        console.log('  sceneGenerationManager exists: ✅');
        
        // Test the exact logic from generateAllScenes
        const structureKeys = Object.keys(window.appState.generatedStructure || {});
        console.log('  Structure keys count:', structureKeys.length);
        
        if (structureKeys.length === 0) {
            console.log('  ❌ ERROR: No structural elements found');
        } else {
            // Filter to only acts that have plot points
            const actsWithPlotPoints = structureKeys.filter(key => window.hasPlotPointsForElement(key));
            console.log('  Acts with plot points count:', actsWithPlotPoints.length);
            console.log('  Acts with plot points:', actsWithPlotPoints);
            
            if (actsWithPlotPoints.length === 0) {
                console.log('  ❌ ERROR: No acts have plot points - This is the bug!');
            } else {
                console.log('  ✅ Ready for scene generation!');
            }
        }
    } else {
        console.log('  ❌ sceneGenerationManager not found');
    }
} catch (error) {
    console.log('  ❌ Error in manual test:', error);
}

// 9. Check progress tracker
console.log('\n9. Progress Tracker Check:');
console.log('  progressTracker exists:', !!window.progressTracker);

console.log('\n=====================================');
console.log('🔍 DEBUG COMPLETE - Check the output above for issues'); 