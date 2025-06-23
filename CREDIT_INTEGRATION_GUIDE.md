# Credit System Integration Guide

## 🎯 Philosophy: Minimal Complexity, Maximum Isolation

The credit system is designed to be **completely separate** from your creative logic. You only need to add **3 simple checks** to your existing generation functions.

## 📋 Integration Checklist

### ✅ Already Done
- [x] Credit widget files created (`credits-widget.js`, `credits-widget.css`)
- [x] Widget included in `index.html`
- [x] Widget auto-initializes and shows credit balance

### 🔧 Simple Integration (3 Steps)

#### Step 1: Add Pre-Generation Check
Add this **one line** before your API calls:

```javascript
// BEFORE (your existing function)
async function generateStructure() {
    showLoading('Generating structure...');
    // ... your existing logic
}

// AFTER (with credit check)
async function generateStructure() {
    // Add this one line:
    if (!await window.creditWidget.canAfford(25)) return;
    
    showLoading('Generating structure...');
    // ... your existing logic (unchanged)
}
```

#### Step 2: Add Post-Generation Refresh
Add this **one line** after successful API calls:

```javascript
// BEFORE (your existing success handler)
if (response.ok) {
    const data = await response.json();
    // ... handle success
}

// AFTER (with credit refresh)
if (response.ok) {
    const data = await response.json();
    // Add this one line:
    window.creditWidget.refreshAfterOperation();
    // ... handle success (unchanged)
}
```

#### Step 3: Optional Cost Estimates
For premium UX, add cost estimates before expensive operations:

```javascript
// Optional: Show cost estimate for large operations
async function generateAllScenes() {
    const prompt = buildScenePrompt(); // your existing logic
    
    // Optional cost estimate:
    if (!await window.creditWidget.showCostEstimate(prompt, 'scene generation')) {
        return; // User cancelled due to cost
    }
    
    // ... your existing logic (unchanged)
}
```

## 🔌 Integration Points

### Required Integration Points (Minimal)
1. **Structure Generation** - `generateStructure()` function
2. **Scene Generation** - `generateAllScenes()` function  
3. **Dialogue Generation** - `generateAllDialogue()` function

### Example Integration for One Function

```javascript
// File: public/script.js
// Function: generateStructure() (around line 1055)

async function generateStructure() {
    // 🔥 ADD THIS: Pre-generation credit check
    if (!await window.creditWidget.canAfford(25)) {
        showToast('Insufficient credits for structure generation', 'error');
        return;
    }
    
    showLoading('Generating structure...');
    
    try {
        // ... your existing API call logic (unchanged)
        const response = await fetch('/api/generate-structure', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            body: JSON.stringify(requestData)
        });

        if (response.ok) {
            const data = await response.json();
            
            // 🔥 ADD THIS: Post-generation refresh
            window.creditWidget.refreshAfterOperation();
            
            // ... your existing success handling (unchanged)
            displayStructure(data);
            showToast('Structure generated successfully!', 'success');
        }
        
    } catch (error) {
        // ... your existing error handling (unchanged)
    } finally {
        hideLoading();
    }
}
```

## 🚀 Benefits of This Approach

### ✅ Clean Separation
- **Credit logic**: Contained in `credits-widget.js`
- **Creative logic**: Stays in your existing files
- **No mixing**: Credit system can be removed without breaking anything

### ✅ Minimal Changes
- **3 functions** need 2 lines each (6 lines total)
- **No refactoring** of existing logic
- **No new dependencies** in your creative code

### ✅ Fail-Safe Design
- **Credit check fails**: User gets clear message, operation cancelled
- **Credit widget fails**: Operations continue normally (no blocking)
- **API key missing**: System gracefully degrades

### ✅ Easy Debugging
- **Credit issues**: Check `credits-widget.js` and browser console
- **Generation issues**: Same as before, no new complexity
- **Clear separation**: Each system can be debugged independently

## 🎛️ Configuration

The widget is self-configuring, but you can customize:

```javascript
// Optional: Custom initialization
window.creditWidget = CreditWidget.init('your-api-key');

// Optional: Custom cost estimates
window.creditWidget.showCostEstimate(prompt, 'custom-operation');

// Optional: Manual refresh
window.creditWidget.refreshAfterOperation();
```

## 🔍 Testing

1. **Test without API key**: Widget shows "0" credits, operations blocked
2. **Test with low credits**: Widget shows red badge, operations blocked  
3. **Test with sufficient credits**: Operations work normally, balance updates

## 📈 Next Steps

1. **Implement the 3 integration points** above
2. **Test with admin API key** 
3. **Create user registration flow** (separate from main app)
4. **Add usage analytics** (optional, separate service)

The beauty of this approach: **Your creative app stays simple, the credit system stays isolated.** 