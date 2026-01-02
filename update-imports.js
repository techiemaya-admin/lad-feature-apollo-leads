// Script to update all imports in apollo-leads feature
const fs = require('fs');
const path = require('path');

const replacements = [
  {
    from: /require\(['"]\.\.\/\.\.\/\.\.\/core\/utils\/logger['"]\)/g,
    to: "require('./utils/logger')"
  },
  {
    from: /require\(['"]\.\.\/\.\.\/\.\.\/core\/utils\/schemaHelper['"]\)/g,
    to: "require('./utils/schema')"
  },
  {
    from: /require\(['"]\.\.\/\.\.\/\.\.\/core\/utils\/tenantHelper['"]\)/g,
    to: "require('./utils/schema')"
  },
  {
    from: /require\(['"]\.\.\/\.\.\/\.\.\/core\/config\/constants['"]\)/g,
    to: "require('./utils/constants')"
  },
  {
    from: /require\(['"]\.\.\/\.\.\/\.\.\/shared\/database\/connection['"]\)/g,
    to: "require('./utils/database')"
  },
  {
    from: /require\(['"]\.\.\/\.\.\/\.\.\/shared\/utils\/logger['"]\)/g,
    to: "require('./utils/logger')"
  },
  {
    from: /require\(['"]\.\.\/\.\.\/\.\.\/shared\/middleware\/feature_guard['"]\)/g,
    to: "require('./middleware/apollo-leads.middleware')"
  },
  {
    from: /require\(['"]\.\.\/\.\.\/\.\.\/shared\/middleware\/credit_guard['"]\)/g,
    to: "require('./middleware/apollo-leads.middleware')"
  }
];

function updateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(({ from, to }) => {
    if (from.test(content)) {
      content = content.replace(from, to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      updateFile(fullPath);
    }
  });
}

// Update apollo-leads feature
const featureDir = path.join(__dirname, 'backend', 'features', 'apollo-leads');
scanDirectory(featureDir);

console.log('Import updates complete!');
