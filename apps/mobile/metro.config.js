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

/**
 * `merge-options` ships both a CJS and an ESM entry. Metro picks the ESM one
 * through package exports, and `@react-native-async-storage/async-storage`'s
 * web build then reads `.default` off it and crashes on load. Pinning the CJS
 * entry keeps the interop wrapper that the consumer expects.
 */
const mergeOptionsCjs = require.resolve('merge-options', { paths: [projectRoot, workspaceRoot] });

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'merge-options') {
    return { type: 'sourceFile', filePath: mergeOptionsCjs };
  }
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
