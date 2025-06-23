# 🎯 Simple Integration Example

## ✅ Issues Fixed
- **Duplicate widgets removed**: Now integrates with your existing credits display
- **Demo page accessible**: http://localhost:3000/credit-integration-demo  
- **Clean integration**: No visual conflicts

## 🔧 Integration: Just 2 Lines Per Function

Here's exactly what to add to your existing generation functions:

### Example: Structure Generation

**File**: `public/script.js`  
**Function**: `generateStructure()` (around line 1055)

```javascript
async function generateStructure() {
    // 🔥 ADD THIS LINE: Pre-generation credit check
    if (!await window.creditWidget.canAfford(25)) return;
    
    showLoading('Generating structure...');
    
    try {
        // ... your existing API call code (no changes) ...
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
            
            // 🔥 ADD THIS LINE: Refresh credits after success
            window.creditWidget.refreshAfterOperation();
            
            // ... your existing success handling (no changes) ...
            displayStructure(data);
            goToStep(3);
        }
        
    } catch (error) {
        // ... your existing error handling (no changes) ...
    } finally {
        hideLoading();
    }
}
```

### Required Integration Points

**3 functions need 2 lines each** (6 lines total):

1. **`generateStructure()`** - Add credit check + refresh  
2. **`generateAllScenes()`** - Add credit check + refresh
3. **`generateAllDialogue()`** - Add credit check + refresh

### Test It Out

1. **Visit**: http://localhost:3000/credit-integration-demo
2. **Enter API key**: `admin_bfc0179645e270e4b8806c7206ee36a09b4625305cba978b73e6e45d2c416028`
3. **Click "Setup API Key"** - You'll see credits in top-right
4. **Test generation buttons** - See how credit checks work

### How It Works

- **Before generation**: `canAfford()` checks if user has enough credits
- **If insufficient**: Shows error message, blocks operation  
- **If sufficient**: Operation proceeds normally
- **After success**: `refreshAfterOperation()` updates balance

### Benefits

✅ **Zero complexity**: Your existing code stays exactly the same  
✅ **Fail-safe**: If credit system fails, operations continue normally  
✅ **Clean separation**: Credit logic completely isolated  
✅ **Easy debugging**: Credit issues don't affect generation logic

## 🚀 Ready to Implement?

The integration is **super minimal** - just 6 lines of code total. The credit widget automatically:

- Shows current balance in your existing credits display
- Updates in real-time  
- Changes color based on balance (red = low, green = high)
- Handles all the API communication

**Want me to implement these 6 lines for you, or would you prefer to do it yourself?** 