const fs = require('fs');
const path = require('path');
const tsConfig = require('./tsconfig.json');

const paths = tsConfig.compilerOptions.paths;

function getAllTsFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllTsFiles(fullPath, fileList);
    } else if (fullPath.endsWith('.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const srcDir = path.join(__dirname, 'src');
const apiDir = path.join(__dirname, 'api');
const allFiles = [...getAllTsFiles(srcDir), ...getAllTsFiles(apiDir)];

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  let original = content;
  
  for (const [alias, targets] of Object.entries(paths)) {
    const prefix = alias.replace('/*', '');
    // e.g. targetDir = "src/core"
    const targetDir = targets[0].replace('/*', '');
    const absoluteTargetDir = path.join(__dirname, targetDir);
    
    // Using RegExp to find all variants of imports (import { .. } from '@...', import .. from '@...', or export ... from '@...')
    // Look for matching strings starting with the alias prefix
    const regex = new RegExp(`(import|export)\\s+(.*?)\\s+from\\s+['"]${prefix}(.*?)['"]`, 'g');
    content = content.replace(regex, (match, verb, imports, suffix) => {
      // absolute path to the target file/dir being imported
      const absoluteTarget = path.join(absoluteTargetDir, suffix);
      
      // compute relative path from the current file's directory to the target path
      let relativePath = path.relative(path.dirname(file), absoluteTarget);
      
      // Fix Windows backslashes to forward slashes for imports
      relativePath = relativePath.split(path.sep).join('/');
      
      if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
      }
      
      return `${verb} ${imports} from '${relativePath}'`;
    });
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Fixed aliases in:', file);
  }
}
console.log('Done fixing paths.');
