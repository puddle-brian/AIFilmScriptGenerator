const fs = require('fs');

const content = fs.readFileSync('server.js', 'utf8');
const lines = content.split('\n');

let openBraces = 0;
let openParens = 0;
let openBrackets = 0;
let issues = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inString = false;
  let inComment = false;
  let stringChar = '';
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    const nextChar = line[j + 1];
    
    // Handle comments
    if (!inString && char === '/' && nextChar === '/') {
      inComment = true;
      break;
    }
    
    if (inComment) continue;
    
    // Handle strings
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (inString && char === stringChar && line[j-1] !== '\\') {
      inString = false;
      stringChar = '';
      continue;
    }
    
    if (inString) continue;
    
    // Count braces, parens, brackets
    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '(') openParens++;
    if (char === ')') openParens--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
    
    // Check for negative counts (closing before opening)
    if (openBraces < 0 || openParens < 0 || openBrackets < 0) {
      issues.push(`Line ${i + 1}: Closing without opening - braces: ${openBraces}, parens: ${openParens}, brackets: ${openBrackets}`);
    }
  }
}

console.log('Final counts:');
console.log(`Braces: ${openBraces}`);
console.log(`Parentheses: ${openParens}`);
console.log(`Brackets: ${openBrackets}`);
console.log(`Total lines: ${lines.length}`);

if (issues.length > 0) {
  console.log('\nIssues found:');
  issues.forEach(issue => console.log(issue));
}

if (openBraces !== 0 || openParens !== 0 || openBrackets !== 0) {
  console.log('\n❌ SYNTAX ERROR: Unbalanced brackets detected!');
} else {
  console.log('\n✅ All brackets are balanced');
} 