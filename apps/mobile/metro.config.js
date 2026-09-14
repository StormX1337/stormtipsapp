const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so changes in packages/* trigger a rebuild.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm uses symlinks; Metro must not resolve a package twice through them.
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;

/**
 * Workspace packages are ESM TypeScript and import their siblings with an
 * explicit `.js` extension (required by Node ESM). Metro resolves from source,
 * so the extension is rewritten back to the TypeScript file.
 */
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return (defaultResolveRequest ?? context.resolveRequest)(
        context,
        moduleName.replace(/\.js$/, ''),
        platform,
      );
    } catch {
      // Fall through to the default resolution below.
    }
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
