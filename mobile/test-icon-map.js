const fs = require('fs');
const path = require('path');

let iconMap = {};
try {
  const filePath = require.resolve('lucide-react-native/dist/esm/lucide-react-native.js');
  console.log("Resolved path:", filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = /export\s+\{\s*([^}]+)\s*\}\s*from\s*'([^']+)'/g;
  let match;
  let count = 0;
  while ((match = regex.exec(content)) !== null) {
    const exportsList = match[1];
    const sourceFile = match[2];
    const baseName = path.basename(sourceFile, '.js');
    
    const exports = exportsList.split(',').map(e => e.trim());
    for (const exp of exports) {
      const parts = exp.split(/\s+as\s+/);
      const exportName = parts[parts.length - 1];
      iconMap[exportName] = baseName;
      count++;
    }
  }
  console.log("Successfully mapped icons. Total exports mapped:", count);
  console.log("Sample mappings:");
  console.log("ArrowLeft ->", iconMap["ArrowLeft"]);
  console.log("CheckCircle2 ->", iconMap["CheckCircle2"]);
  console.log("AlertCircle ->", iconMap["AlertCircle"]);
  console.log("CalendarDays ->", iconMap["CalendarDays"]);
} catch (e) {
  console.error("Failed to build dynamic lucide icon map:", e);
}
