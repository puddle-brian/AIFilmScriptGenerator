/**
 * PROMPT TEMPLATE SYSTEM TEST
 * 
 * This script tests our new template-based prompt system to make sure
 * everything is working before we integrate it into the main server.
 */

const promptBuilders = require('./prompt-builders');

console.log('🧪 Testing Prompt Template System...\n');

// Test 1: Validate that all templates exist
console.log('📋 Test 1: Template Validation');
try {
    const isValid = promptBuilders.validateTemplates();
    if (isValid) {
        console.log('✅ All templates loaded successfully!\n');
    } else {
        console.log('❌ Some templates are missing\n');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Template validation failed:', error.message);
    process.exit(1);
}

// Test 2: Test Structure Prompt Building  
console.log('📋 Test 2: Structure Prompt Building');
try {
    const testStoryInput = {
        title: "Test Movie",
        logline: "A test story about testing systems.",
        characters: "Protagonist: A dedicated tester; Supporting: The helpful AI",
        tone: "Comedy",
        totalScenes: 50,
        influencePrompt: "In the style of great comedy filmmakers, ",
        influences: {
            directors: ["Billy Wilder", "Charlie Chaplin"],
            screenwriters: ["Woody Allen"],
            films: ["Some Like It Hot", "The Apartment"]
        }
    };
    
    const testTemplateData = {
        name: "Three Act Structure",
        description: "Classic beginning, middle, end structure"
    };
    
    const structurePrompt = promptBuilders.buildStructurePrompt(testStoryInput, testTemplateData);
    
    // Check that placeholders were replaced
    if (structurePrompt.includes('{{PROJECT_TITLE}}')) {
        console.log('❌ Structure prompt still contains unreplaced placeholders');
        console.log('Found:', structurePrompt.substring(0, 200) + '...');
        process.exit(1);
    }
    
    if (structurePrompt.includes('Test Movie') && structurePrompt.includes('Three Act Structure')) {
        console.log('✅ Structure prompt built successfully!');
        console.log('   • Contains project title ✓');
        console.log('   • Contains template name ✓');
        console.log('   • Placeholders replaced ✓\n');
    } else {
        console.log('❌ Structure prompt missing expected content');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Structure prompt test failed:', error.message);
    process.exit(1);
}

// Test 3: Test Plot Points Prompt Building
console.log('📋 Test 3: Plot Points Prompt Building');
try {
    const testProjectContext = {
        title: "Test Movie",
        logline: "A test story about testing systems.",
        characters: "Protagonist: A dedicated tester",
        tone: "Comedy",
        totalScenes: 50,
        templateData: { name: "Three Act Structure" }
    };
    
    const testActData = {
        name: "Act 1: Setup",
        description: "Introducing the characters and world",
        key_events: ["Character introduction", "World establishment", "Inciting incident"],
        character_development: "Protagonist shows dedication to testing"
    };
    
    const plotPointsPrompt = promptBuilders.buildPlotPointsPrompt(
        testProjectContext, 
        'act1', 
        testActData, 
        { scenesPerAct: 10 }
    );
    
    if (plotPointsPrompt.includes('{{PROJECT_TITLE}}')) {
        console.log('❌ Plot points prompt still contains unreplaced placeholders');
        process.exit(1);
    }
    
    if (plotPointsPrompt.includes('Test Movie') && plotPointsPrompt.includes('Act 1: Setup')) {
        console.log('✅ Plot points prompt built successfully!');
        console.log('   • Contains project title ✓');
        console.log('   • Contains act information ✓');
        console.log('   • Placeholders replaced ✓\n');
    } else {
        console.log('❌ Plot points prompt missing expected content');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Plot points prompt test failed:', error.message);
    process.exit(1);
}

// Test 4: Test Scene Prompt Building
console.log('📋 Test 4: Scene Prompt Building');
try {
    // Create a test hierarchical context (simulating what the server provides)
    const testHierarchicalContext = `STORY CONTEXT:
Title: Test Movie
Logline: A test story about testing systems.
Characters: Protagonist: A dedicated tester
Genre: Comedy

STRUCTURAL ELEMENT TO DEVELOP:
Name: Act 1: Setup
Description: Character discovers a bug in the system and shows problem-solving skills

Previous scenes established the character's routine.`;
    
    const scenePrompt = promptBuilders.buildScenePrompt(testHierarchicalContext, 3);
    
    if (scenePrompt.includes('{{')) {
        console.log('❌ Scene prompt still contains unreplaced placeholders');
        // Show which placeholders are missing
        const matches = scenePrompt.match(/\{\{[^}]+\}\}/g);
        if (matches) {
            console.log('   Missing placeholders:', matches);
        }
        console.log('   Scene prompt preview:', scenePrompt.substring(0, 300) + '...');
        process.exit(1);
    }
    
    if (scenePrompt.includes('Test Movie') && scenePrompt.includes('3 scenes')) {
        console.log('✅ Scene prompt built successfully!');
        console.log('   • Contains hierarchical context ✓');
        console.log('   • Contains scene count ✓');
        console.log('   • Placeholders replaced ✓\n');
    } else {
        console.log('❌ Scene prompt missing expected content');
        console.log('   Preview:', scenePrompt.substring(0, 300) + '...');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Scene prompt test failed:', error.message);
    process.exit(1);
}

// Test 4b: Test Individual Scene Prompt Building
console.log('📋 Test 4b: Individual Scene Prompt Building');
try {
    // Create a test hierarchical context for individual scene
    const testHierarchicalContext = `STORY CONTEXT:
Title: Test Movie
Logline: A test story about testing systems.
Characters: Protagonist: A dedicated tester
Genre: Comedy

STRUCTURAL ELEMENT TO DEVELOP:
Name: Act 1: Setup
Description: Character discovers a bug in the system

SCENE TO REGENERATE:
Position: Scene 2 in this structural element
Current title: Bug Discovery Scene`;
    
    const individualScenePrompt = promptBuilders.buildIndividualScenePrompt(testHierarchicalContext);
    
    if (individualScenePrompt.includes('{{')) {
        console.log('❌ Individual scene prompt still contains unreplaced placeholders');
        // Show which placeholders are missing
        const matches = individualScenePrompt.match(/\{\{[^}]+\}\}/g);
        if (matches) {
            console.log('   Missing placeholders:', matches);
        }
        console.log('   Individual scene prompt preview:', individualScenePrompt.substring(0, 300) + '...');
        process.exit(1);
    }
    
    if (individualScenePrompt.includes('Test Movie') && individualScenePrompt.includes('"title": "Scene Title"')) {
        console.log('✅ Individual scene prompt built successfully!');
        console.log('   • Contains hierarchical context ✓');
        console.log('   • Contains individual scene JSON format ✓');
        console.log('   • Placeholders replaced ✓\n');
    } else {
        console.log('❌ Individual scene prompt missing expected content');
        console.log('   Preview:', individualScenePrompt.substring(0, 300) + '...');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Individual scene prompt test failed:', error.message);
    process.exit(1);
}

// Test 5: Test Dialogue Prompt Building
console.log('📋 Test 5: Dialogue Prompt Building');
try {
    const testProjectContext = {
        title: "Test Movie",
        logline: "A test story about testing systems.",
        characters: "Protagonist: A dedicated tester",
        tone: "Comedy"
    };
    
    const testSceneContent = "INT. TESTING LAB - DAY\n\nThe protagonist stares at a screen showing error messages.";
    
    const dialoguePrompt = promptBuilders.buildDialoguePrompt(
        testProjectContext, 
        testSceneContent, 
        { 
            dialogueStyle: "witty and technical",
            characterProfiles: "Protagonist speaks in tech jargon but with humor"
        }
    );
    
    if (dialoguePrompt.includes('{{PROJECT_TITLE}}')) {
        console.log('❌ Dialogue prompt still contains unreplaced placeholders');
        process.exit(1);
    }
    
    if (dialoguePrompt.includes('Test Movie') && dialoguePrompt.includes('TESTING LAB')) {
        console.log('✅ Dialogue prompt built successfully!');
        console.log('   • Contains project title ✓');
        console.log('   • Contains scene content ✓');
        console.log('   • Placeholders replaced ✓\n');
    } else {
        console.log('❌ Dialogue prompt missing expected content');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ Dialogue prompt test failed:', error.message);
    process.exit(1);
}

console.log('🎉 ALL TESTS PASSED!');
console.log('✅ Template system is working correctly');
console.log('✅ All placeholders are being replaced properly');
console.log('✅ Ready to integrate into server endpoints');
console.log('\n📝 NEXT STEPS:');
console.log('   1. Update structure generation endpoint to use buildStructurePrompt()');
console.log('   2. Update preview endpoints to use the same shared functions');
console.log('   3. Test end-to-end to verify preview matches generation');
console.log('   4. Extract and update plot points, scene, and dialogue prompts'); 