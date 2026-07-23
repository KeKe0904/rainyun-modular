import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleList = JSON.parse(await readFile(resolve(projectRoot, 'modules/module-list.json'), 'utf8'));
const managerSource = await readFile(resolve(projectRoot, 'rainyun-modular.user.js'), 'utf8');
const versionInfo = JSON.parse(await readFile(resolve(projectRoot, 'version.json'), 'utf8'));
const errors = [];
const ids = new Set();
const allowedConfigTypes = new Set(['text', 'password', 'select']);

const managerVersion = managerSource.match(/^\/\/ @version\s+(.+)$/m)?.[1].trim();
if (managerVersion !== versionInfo.version) {
    errors.push(`管理器版本不一致: userscript=${managerVersion}, version.json=${versionInfo.version}`);
}

for (const module of moduleList) {
    const requiredFields = ['id', 'name', 'description', 'version', 'path', 'script'];
    if (requiredFields.some(field => typeof module[field] !== 'string' || !module[field])) {
        errors.push(`模块清单包含无效条目: ${module.id || '(unknown)'}`);
        continue;
    }
    if (ids.has(module.id)) errors.push(`模块 ID 重复: ${module.id}`);
    ids.add(module.id);

    const scriptPath = resolve(projectRoot, 'modules', module.path, module.script);
    if (module.script !== `${module.version}.user.js`) {
        errors.push(`模块版本与脚本文件名不一致: ${module.id}`);
    }
    try {
        await access(scriptPath, constants.R_OK);
    } catch {
        errors.push(`模块脚本不存在: modules/${module.path}/${module.script}`);
        continue;
    }

    const syntaxCheck = spawnSync(process.execPath, ['--check', scriptPath], { encoding: 'utf8' });
    if (syntaxCheck.status !== 0) {
        errors.push(`模块脚本语法错误: ${module.id}\n${syntaxCheck.stderr.trim()}`);
    }

    for (const item of module.configSchema || []) {
        if (!allowedConfigTypes.has(item.type)) {
            errors.push(`模块 ${module.id} 使用未知配置类型: ${item.type}`);
        }
        if (item.type === 'select' && !Array.isArray(item.options)) {
            errors.push(`模块 ${module.id} 的 select 配置缺少 options: ${item.key}`);
        }
    }
}

const managerSyntax = spawnSync(process.execPath, ['--check', resolve(projectRoot, 'rainyun-modular.user.js')], { encoding: 'utf8' });
if (managerSyntax.status !== 0) errors.push(`管理器脚本语法错误:\n${managerSyntax.stderr.trim()}`);

if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`校验通过: 管理器 ${managerVersion}，${moduleList.length} 个模块`);
}
