# Prompt Templates - Non-Programmer Editing Guide

## 🎯 What Are These Files?

The files in this `prompts/` directory contain the **exact text** that gets sent to the AI when generating different parts of your film scripts. Think of them as **templates** or **form letters** that get filled in with your specific project details.

## 📝 How to Edit Prompts Safely

### ✅ What You CAN Edit:
- **Regular text**: Any normal sentences and instructions
- **Structure and formatting**: Add bullets, numbers, sections
- **Instructions to the AI**: Tell it what you want differently
- **Examples**: Add or modify examples to guide the AI

### ⚠️ What You MUST NOT Edit:
- **Placeholders**: Anything inside `{{double curly braces}}`
- **These are replaced automatically with your project data**
- **Examples**: `{{PROJECT_TITLE}}`, `{{SCENE_DESCRIPTION}}`, `{{CHARACTER_NAMES}}`

## 📋 Template Files Explained

### 📄 `structure-generation.txt`
- **Purpose**: Creates the overall story structure (acts, themes, progression)
- **When used**: When you click "Generate Structure" in the app
- **Key placeholders**: `{{PROJECT_TITLE}}`, `{{PROJECT_LOGLINE}}`, `{{TEMPLATE_NAME}}`

### 📄 `plot-points-generation.txt`  
- **Purpose**: Breaks down story acts into specific plot points
- **When used**: When generating plot points for each act
- **Key placeholders**: `{{ACT_NAME}}`, `{{ACT_DESCRIPTION}}`, `{{TOTAL_SCENES}}`

### 📄 `scene-generation.txt`
- **Purpose**: Creates individual scenes based on plot points
- **When used**: When generating scenes from plot points
- **Key placeholders**: `{{SCENE_DESCRIPTION}}`, `{{CHARACTER_DEVELOPMENT}}`, `{{PREVIOUS_SCENES}}`

### 📄 `dialogue-generation.txt`
- **Purpose**: Writes screenplay dialogue for scenes
- **When used**: When generating dialogue for completed scenes
- **Key placeholders**: `{{SCENE_CONTENT}}`, `{{CHARACTER_PROFILES}}`, `{{TONE}}`

## 🔧 Editing Examples

### ❌ WRONG - Don't change placeholders:
```
// BAD - This will break the system
You are creating a story called PROJECT_TITLE_HERE
```

### ✅ RIGHT - Keep placeholders, edit instructions:
```
// GOOD - Placeholders intact, instructions improved
You are an expert screenwriter creating a compelling story called "{{PROJECT_TITLE}}".

Focus on creating emotionally resonant characters and unexpected plot twists.
```

## 💡 Common Edits You Might Want to Make

### Make the AI More Creative:
Add instructions like:
```
- Surprise the audience with unexpected character choices
- Include unique dialogue that feels natural and memorable
- Avoid clichés and predictable plot developments
```

### Change the Writing Style:
```
Write in a more cinematic style with vivid action descriptions.
Focus on visual storytelling rather than exposition.
```

### Add Specific Requirements:
```
Ensure each scene:
1. Advances the main plot
2. Develops at least one character
3. Contains visual or emotional impact
4. Connects naturally to the next scene
```

## 🚨 Emergency Restoration

If you accidentally break a template file:
1. **Don't panic!** Your project data is safe
2. **Look at the other template files** for examples of correct format
3. **Check that all placeholders** use `{{PLACEHOLDER_NAME}}` format
4. **Test with a small project** before using on important work

## 🔍 Testing Your Changes

After editing a template:
1. **Use the preview feature** in the app to see what gets sent to AI
2. **Compare before/after** to make sure it looks right
3. **Test with a simple project first**
4. **Generate a small piece** (like one scene) to verify it works

## 📞 Getting Help

If something goes wrong:
- **Check that placeholders** are still in `{{CURLY_BRACES}}`
- **Look at working templates** for correct format examples
- **Try reverting to simpler language** if the AI doesn't understand
- **Test one change at a time** rather than making many changes at once

## 🎨 Advanced Tips

### Making Instructions Clearer:
Instead of: "Write good dialogue"
Try: "Write dialogue that sounds natural when spoken aloud, with each character having a distinct voice"

### Adding Context:
```
// This helps the AI understand your project better
IMPORTANT CONTEXT:
- This is a {{GENRE}} film
- Target audience: {{TARGET_AUDIENCE}}  
- Tone should be: {{DESIRED_TONE}}
```

### Formatting for Readability:
```
STEP 1: Read the story context carefully
STEP 2: Consider the character development goals
STEP 3: Write the scene with these elements:
   • Clear visual action
   • Character-revealing dialogue  
   • Forward plot momentum
```

---

**Remember**: These templates control what your AI assistant creates. Take time to read them, understand them, and modify them thoughtfully to get the exact results you want! 