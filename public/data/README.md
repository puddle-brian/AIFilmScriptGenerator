# Data Files

This directory contains JSON files that define the dropdown options and influences used throughout the Film Script Generator. These files are served to the web application and can be edited to customize the available options.

## Files

### `directors.json`
Contains the list of directors available for influence selection.
- Add new directors by inserting them into the array
- Remove directors by deleting their entries
- Each entry should be a simple string with the director's name

### `screenwriters.json` 
Contains the list of screenwriters available for influence selection.
- Format: `"Name (Notable Work 1, Notable Work 2)"`
- Include notable works in parentheses for context
- Each entry should be a simple string

### `films.json`
Contains the list of films available for influence selection.
- Format: `"Film Title (Year)"`
- Include the year in parentheses
- Each entry should be a simple string

### `tones.json`
Contains the list of tones/moods available in the tone dropdown.
- Each entry should be a descriptive tone or mood
- Can include compound descriptions like "Contemplative/Meditative"

## How to Edit

1. **Open any JSON file** in a text editor
2. **Add new entries** by inserting them into the array:
   ```json
   [
       "Existing Entry",
       "New Entry You're Adding",
       "Another Entry"
   ]
   ```
3. **Remove entries** by deleting the line (don't forget to remove the comma if it's the last item)
4. **Save the file** and deploy to production to see changes

## Important Notes

- **JSON Format**: Make sure to maintain proper JSON formatting
- **Commas**: Each entry except the last one should end with a comma
- **Quotes**: All entries must be wrapped in double quotes
- **No trailing commas**: The last entry in the array should NOT have a comma
- **Deployment**: After making changes, deploy to production to see updates

## Example Edit

To add a new director:

**Before:**
```json
[
    "Ingmar Bergman",
    "Akira Kurosawa"
]
```

**After:**
```json
[
    "Ingmar Bergman", 
    "Akira Kurosawa",
    "Chloé Zhao"
]
```

## Validation

If you make a syntax error, check the browser console for error messages. Common issues:
- Missing quotes around entries
- Missing or extra commas
- Unclosed brackets

The app will fall back to empty arrays if it can't load a file due to syntax errors.

## Location

These files are located in the `public/data/` directory so they can be served by the web server at:
- `https://yourdomain.com/data/directors.json`
- `https://yourdomain.com/data/screenwriters.json`
- `https://yourdomain.com/data/films.json`
- `https://yourdomain.com/data/tones.json` 