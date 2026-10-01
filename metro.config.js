const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;

const sharedRoot = fs.realpathSync(path.resolve(projectRoot, 'shared'));

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  ...(config.watchFolders || []),
  sharedRoot,
];

config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@shared/')) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(sharedRoot, moduleName.slice('@shared/'.length)),
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
