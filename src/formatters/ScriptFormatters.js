// Script formatting functions for different output formats

function generateBasicScript(data) {
  let script = `${data.storyInput.title}\n`;
  script += `Written by: [Author Name]\n\n`;
  script += `LOGLINE: ${data.storyInput.logline}\n\n`;
  script += `GENRE: ${data.storyInput.genre || data.storyInput.tone || 'Drama'}\n\n`;
  
  // Handle characters - could be array or string
  if (data.storyInput.characters) {
    if (Array.isArray(data.storyInput.characters)) {
      script += `CHARACTERS: ${data.storyInput.characters.join(', ')}\n\n`;
    } else {
      script += `CHARACTERS: ${data.storyInput.characters}\n\n`;
    }
  }
  
  // Handle projectCharacters array from v2.0 format
  if (data.projectCharacters && Array.isArray(data.projectCharacters)) {
    script += `MAIN CHARACTERS:\n`;
    data.projectCharacters.forEach(char => {
      script += `${char.name} - ${char.description}\n`;
    });
    script += '\n';
  }
  
  script += `FADE IN:\n\n`;
  
  // Add scenes and dialogue from v2.0 database format
  script += generateContentFromV2Format(data);
  
  script += '\n\nFADE OUT.\n\nTHE END';
  return script;
}

function generateProfessionalScreenplay(data) {
  let script = generateTitlePage(data);
  script += '\n\n\nFADE IN:\n\n';
  
  // Add content from v2.0 database format
  script += generateContentFromV2Format(data);
  
  script += '\n\nFADE OUT.\n\nTHE END';
  return script;
}

function generateContentFromV2Format(data) {
  let content = '';
  let sceneNumber = 1;
  
  console.log('🎬 Processing v2.0 format:', {
    hasStructure: !!data.generatedStructure,
    hasScenes: !!data.generatedScenes,
    hasDialogues: !!data.generatedDialogues,
    dialogueKeys: Object.keys(data.generatedDialogues || {})
  });
  
  // Use the same logic as frontend assembleScript() function
  if (data.generatedScenes) {
    let structureKeys = Object.keys(data.generatedScenes);
    
    // If we have template data, use its order (same as frontend)
    if (data.templateData && data.templateData.structure) {
      const templateKeys = Object.keys(data.templateData.structure);
      structureKeys = templateKeys.filter(key => data.generatedScenes[key]);
      console.log('📋 Using template structure order:', structureKeys);
    }
    
    structureKeys.forEach(structureKey => {
      const sceneGroup = data.generatedScenes[structureKey];
      const act = data.generatedStructure ? data.generatedStructure[structureKey] : null;
      
      if (act) {
        content += `\n\n=== ${act.name.toUpperCase()} ===\n\n`;
      }
      
      if (sceneGroup && Array.isArray(sceneGroup)) {
        sceneGroup.forEach((scene, index) => {
          // Use exact same sceneId format as frontend: structureKey-index
          const sceneId = `${structureKey}-${index}`;
          
          console.log(`🔍 Checking scene ${sceneId} for dialogue`);
          
          // Check if dialogue exists (same logic as frontend)
          let dialogueFound = false;
          let dialogueContent = null;
          
          if (data.generatedDialogues && data.generatedDialogues[sceneId]) {
            dialogueContent = data.generatedDialogues[sceneId];
            dialogueFound = true;
            console.log(`✅ Found dialogue for ${sceneId}`);
          }
          
          if (dialogueFound) {
            // Format the same way as frontend formatSceneForScreenplay
            content += formatSceneForScreenplay(dialogueContent, sceneNumber);
          } else {
            // No dialogue - show placeholder (same as frontend)
            content += formatPlaceholderScene(scene, sceneNumber);
          }
          
          sceneNumber++;
        });
      }
    });
  }
  
  return content;
}

function formatSceneForScreenplay(dialogueContent, sceneNumber) {
  // Format dialogue professionally (similar to frontend)
  return `\n\n${formatDialogueForScreenplay(dialogueContent)}\n\n`;
}

function formatPlaceholderScene(scene, sceneNumber) {
  // Create placeholder for scenes without dialogue (same as frontend)
  let placeholder = `\n\n${sceneNumber}. `;
  
  if (scene.location && scene.time_of_day) {
    placeholder += `${scene.location.toUpperCase()} - ${scene.time_of_day.toUpperCase()}\n\n`;
  } else if (scene.location) {
    placeholder += `${scene.location.toUpperCase()}\n\n`;
  } else {
    placeholder += `SCENE ${sceneNumber}\n\n`;
  }
  
  if (scene.description) {
    placeholder += `${scene.description}\n\n`;
  }
  
  placeholder += `[DIALOGUE TO BE WRITTEN FOR: ${scene.title || 'Untitled Scene'}]\n\n`;
  
  return placeholder;
}

function generateTitlePage(data) {
  const title = data.storyInput?.title || 'UNTITLED';
  const author = '[Author Name]';
  const date = new Date().toLocaleDateString();
  
  return `




                                    ${title.toUpperCase()}


                                      by

                                   ${author}




                                Based on a true story
                                    (if applicable)




                                     ${date}




                              Contact Information:
                              [Your Name]
                              [Your Address]
                              [Your Phone]
                              [Your Email]




                                   FIRST DRAFT`;
}

function formatDialogueForScreenplay(dialogue) {
  const lines = dialogue.split('\n');
  let formatted = '';
  let inDialogue = false;
  
  for (let line of lines) {
    line = line.trim();
    if (!line) {
      formatted += '\n';
      continue;
    }
    
    // Scene headings (INT./EXT.)
    if (line.match(/^(INT\.|EXT\.)/i)) {
      formatted += `\n${line.toUpperCase()}\n\n`;
    }
    // Character names (all caps, no colon)
    else if (line.match(/^[A-Z][A-Z\s]+:?$/)) {
      const character = line.replace(':', '').trim();
      formatted += `                    ${character}\n`;
      inDialogue = true;
    }
    // Parentheticals
    else if (line.match(/^\(.+\)$/)) {
      formatted += `                  ${line}\n`;
    }
    // Dialogue lines
    else if (inDialogue && !line.match(/^(INT\.|EXT\.)/i)) {
      formatted += `          ${line}\n`;
    }
    // Action lines
    else {
      formatted += `${line}\n`;
      inDialogue = false;
    }
  }
  
  return formatted + '\n\n';
}

function generateFountainFormat(data) {
  let fountain = `Title: ${data.storyInput?.title || 'UNTITLED'}\n`;
  fountain += `Author: [Author Name]\n`;
  fountain += `Draft date: ${new Date().toLocaleDateString()}\n\n`;
  fountain += 'FADE IN:\n\n';
  
  // Use the same content generation as other formats for v2.0 database format
  const scriptContent = generateContentFromV2Format(data);
  if (scriptContent && scriptContent.trim()) {
    fountain += convertToFountain(scriptContent) + '\n\n';
  }
  
  fountain += 'FADE OUT.\n\nTHE END';
  return fountain;
}

function convertToFountain(dialogue) {
  const lines = dialogue.split('\n');
  let fountain = '';
  
  for (let line of lines) {
    line = line.trim();
    if (!line) {
      fountain += '\n';
      continue;
    }
    
    // Scene headings - Fountain auto-detects INT./EXT.
    if (line.match(/^(INT\.|EXT\.)/)) {
      fountain += line + '\n\n';
    }
    // Character names - no special formatting needed
    else if (line.match(/^[A-Z][A-Z\s]+:?$/)) {
      fountain += line.replace(':', '') + '\n';
    }
    // Everything else
    else {
      fountain += line + '\n';
    }
  }
  
  return fountain;
}

function generateFinalDraftFormat(data) {
  const title = data.storyInput?.title || 'UNTITLED';
  
  let fdx = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
    <Content>
        <Paragraph Type="Scene Heading">
            <Text>${title}</Text>
        </Paragraph>
`;
  
  // Use the same content generation as other formats for v2.0 database format
  const scriptContent = generateContentFromV2Format(data);
  if (scriptContent && scriptContent.trim()) {
    fdx += convertToFinalDraft(scriptContent);
  }
  
  fdx += `    </Content>
</FinalDraft>`;
  
  return fdx;
}

function convertToFinalDraft(dialogue) {
  const lines = dialogue.split('\n');
  let fdx = '';
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    if (line.match(/^(INT\.|EXT\.)/)) {
      fdx += `        <Paragraph Type="Scene Heading">
            <Text>${line}</Text>
        </Paragraph>\n`;
    } else if (line.match(/^[A-Z][A-Z\s]+:?$/)) {
      fdx += `        <Paragraph Type="Character">
            <Text>${line.replace(':', '')}</Text>
        </Paragraph>\n`;
    } else if (line.match(/^\(.+\)$/)) {
      fdx += `        <Paragraph Type="Parenthetical">
            <Text>${line}</Text>
        </Paragraph>\n`;
    } else if (line.length > 0) {
      const type = line.match(/^[A-Z]/) ? 'Action' : 'Dialogue';
      fdx += `        <Paragraph Type="${type}">
            <Text>${line}</Text>
        </Paragraph>\n`;
    }
  }
  
  return fdx;
}

function generatePDFReadyFormat(data) {
  let pdfScript = `PDF CONVERSION INSTRUCTIONS:
============================
1. Use Courier 12pt font
2. Set margins: Left 1.5", Right 1", Top/Bottom 1"
3. Page numbers top-right
4. Page breaks at [PAGE BREAK] markers

============================

${generateProfessionalScreenplay(data)}

============================
END OF SCREENPLAY
============================`;
  
  return pdfScript;
}

function generateProductionPackage(data) {
  const title = data.storyInput?.title || 'UNTITLED';
  
  let productionScript = `PRODUCTION PACKAGE: ${title.toUpperCase()}
${'='.repeat(50)}

SCRIPT STATISTICS:
• Genre: ${data.storyInput?.genre || data.storyInput?.tone || 'Not specified'}
• Estimated Pages: ${Math.ceil((data.dialogueContent?.length || 0) * 3)}
• Total Scenes: ${data.dialogueContent?.length || 0}

CHARACTER BREAKDOWN:
${data.storyInput?.characters || 'Characters not specified'}

LOGLINE:
${data.storyInput?.logline || 'Logline not provided'}

PRODUCTION NOTES:
• This script was generated using AI assistance
• Review all dialogue for consistency and character voice
• Consider script coverage and professional review
• Verify all scene locations and time requirements
• Check for continuity and pacing issues

${'='.repeat(50)}
SCREENPLAY BEGINS BELOW
${'='.repeat(50)}

${generateProfessionalScreenplay(data)}

${'='.repeat(50)}
END OF PRODUCTION PACKAGE
${'='.repeat(50)}`;

  return productionScript;
}

module.exports = {
  generateBasicScript,
  generateProfessionalScreenplay,
  generateContentFromV2Format,
  formatSceneForScreenplay,
  formatPlaceholderScene,
  generateTitlePage,
  formatDialogueForScreenplay,
  generateFountainFormat,
  convertToFountain,
  generateFinalDraftFormat,
  convertToFinalDraft,
  generatePDFReadyFormat,
  generateProductionPackage
}; 