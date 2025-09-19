// scripts/patch_logs.js
// Node 16+
// Usage: node scripts/patch_logs.js
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");

function walk(dir, fileList = []) {
  return fs.readdir(dir, { withFileTypes: true }).then((ents) => {
    const promises = ents.map((ent) => {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".git") return Promise.resolve();
        return walk(full, fileList);
      }
      if (ent.isFile() && full.endsWith(".js")) fileList.push(full);
      return Promise.resolve();
    });
    return Promise.all(promises).then(() => fileList);
  });
}

function computeLoggerImportPath(filePath) {
  // relative path from filePath to src/services/logger.js
  const fileDir = path.dirname(filePath);
  const loggerPath = path.join(ROOT, "src", "services", "logger.js");
  let rel = path.relative(fileDir, loggerPath);
  // normalize for import: use posix slashes
  rel = rel.split(path.sep).join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

function makeModuleName(filePath) {
  const bn = path.basename(filePath, ".js");
  // sanitize to safe module string (uppercase, replace nonalnum with _)
  return bn.replace(/[^A-Za-z0-9]/g, "_").toUpperCase();
}

async function backupFile(fp) {
  const bak = fp + ".bak";
  try {
    await fs.copyFile(fp, bak, fs.constants.COPYFILE_EXCL);
    console.log(`  backup created: ${path.relative(ROOT, bak)}`);
  } catch (e) {
    // if exists, skip
    if (e.code === "EEXIST") {
      console.log(`  backup already exists: ${path.relative(ROOT, bak)}`);
    } else {
      throw e;
    }
  }
}

async function processFile(fp) {
  const rel = path.relative(ROOT, fp);
  const src = await fs.readFile(fp, "utf8");
  if (!/console\.(debug|info|warn|error|log)\b/.test(src)) {
    return false; // nothing to do
  }
  console.log(`Patching: ${rel}`);
  await backupFile(fp);

  let out = src;

  // 1) ensure import createLogger exists
  const hasCreateLoggerImport = /import\s+createLogger\s+from\s+['"].*services\/logger\.js['"]/.test(out)
    || /require\(['"].*services\/logger\.js['"]\)/.test(out);
  if (!hasCreateLoggerImport) {
    const importPath = computeLoggerImportPath(fp);
    // find last import statement to insert after
    const importRegex = /(^\s*import .+;?$)/mg;
    let insertAt = 0;
    let lastMatch;
    let m;
    while ((m = importRegex.exec(out)) !== null) {
      lastMatch = m;
      insertAt = importRegex.lastIndex;
    }
    const importStmt = `import createLogger from "${importPath}";\n`;
    if (lastMatch) {
      // insert after last import
      out = out.slice(0, insertAt) + "\n" + importStmt + out.slice(insertAt);
    } else {
      // insert at top
      out = importStmt + out;
    }
    console.log(`  inserted import: ${importPath}`);
  } else {
    console.log("  createLogger import already present");
  }

  // 2) ensure const log = createLogger("MODULE"); exists
  const moduleName = makeModuleName(fp);
  const logDeclRegex = /(?:const|let|var)\s+log\s*=\s*createLogger\s*\(/;
  if (!logDeclRegex.test(out)) {
    // after the createLogger import line, insert declaration
    const createLoggerLineRegex = /import\s+createLogger\s+from\s+['"].*services\/logger\.js['"].*\n/;
    const match = createLoggerLineRegex.exec(out);
    const decl = `const log = createLogger("${moduleName}");\n`;
    if (match) {
      const idx = match.index + match[0].length;
      out = out.slice(0, idx) + decl + out.slice(idx);
    } else {
      // fallback: insert at top
      out = decl + out;
    }
    console.log(`  inserted log declaration: const log = createLogger("${moduleName}")`);
  } else {
    console.log("  log declaration already present");
  }

  // 3) replace console.* -> log.* with mapping console.log -> log.info
  // Use function to preserve exact method mapping
  out = out.replace(/\bconsole\.(debug|info|warn|error|log)\b/g, (m, p1) => {
    if (p1 === "log") return "log.info";
    return `log.${p1}`;
  });

  // 4) write file back
  await fs.writeFile(fp, out, "utf8");
  console.log(`  patched ${rel}`);
  return true;
}

(async () => {
  try {
    const files = await walk(SRC_DIR, []);
    console.log(`Found ${files.length} .js files under src/`);
    let patched = 0;
    for (const f of files) {
      try {
        const did = await processFile(f);
        if (did) patched++;
      } catch (e) {
        console.error(`Error processing ${f}:`, e);
      }
    }
    console.log(`\nDone. Patched ${patched} files. Backups (*.bak) created beside originals.`);
    console.log("Please review changes, run tests, and commit when satisfied.");
  } catch (e) {
    console.error("Fatal error:", e);
    process.exit(1);
  }
})();
