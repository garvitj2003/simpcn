'use strict';
const path = require('node:path');
// Run in Program.enter before presets lower imports/JSX. Rewrite only supported
// consumers; preserve every binding use that still needs its local asset module.
module.exports = function simpcnImages({ types: t }, { entries, runtime }) {
  return {
    name: 'simpcn-native-images-proof',
    visitor: {
      Program(program, state) {
        const filename = state.filename;
        if (!filename || filename.split(path.sep).includes('node_modules')) return;
        const imageBindings = new Map();
        let helper;
        program.traverse({
          JSXOpeningElement(element) {
            const name = element.node.name;
            if (!t.isJSXIdentifier(name)) return;
            const binding = element.scope.getBinding(name.name);
            if (!binding?.constant || !binding.path.isImportSpecifier()) return;
            const declaration = binding.path.parentPath;
            const imported = binding.path.node.imported;
            if (!declaration.isImportDeclaration() || declaration.node.importKind === 'type' || binding.path.node.importKind === 'type' || !t.isIdentifier(imported)) return;
            const source = declaration.node.source.value;
            if (!(source === 'react-native' && ['Image', 'ImageBackground'].includes(imported.name) || source === 'expo-image' && imported.name === 'Image')) return;
            const attributes = element.get('attributes');
            const sources = attributes.filter(attr => attr.isJSXAttribute() && t.isJSXIdentifier(attr.node.name, { name: 'source' }));
            if (sources.length !== 1 || attributes.some(attr => attr.isJSXSpreadAttribute())) return;
            const value = sources[0].get('value');
            if (!value.isJSXExpressionContainer()) return;
            const expression = value.get('expression');
            let request, assetBinding;
            if (expression.isCallExpression() && t.isIdentifier(expression.node.callee, { name: 'require' }) && !expression.scope.getBinding('require') && expression.node.arguments.length === 1 && t.isStringLiteral(expression.node.arguments[0])) {
              request = expression.node.arguments[0].value;
            } else if (expression.isIdentifier()) {
              assetBinding = expression.scope.getBinding(expression.node.name);
              if (!assetBinding?.constant || !assetBinding.path.isImportDefaultSpecifier()) return;
              const assetImport = assetBinding.path.parentPath;
              if (!assetImport.isImportDeclaration() || assetImport.node.importKind === 'type') return;
              request = assetImport.node.source.value;
            } else return;
            if (!request.startsWith('./') && !request.startsWith('../')) return;
            const entry = entries[path.resolve(path.dirname(filename), request)];
            if (!entry) return;
            if (entry.error) throw expression.buildCodeFrameError(`Simpcn: ${entry.error}`);
            let replacement;
            if (entry.sources) {
              helper ??= program.scope.generateUidIdentifier('simpcnImageSource');
              replacement = t.callExpression(t.cloneNode(helper), [t.valueToNode(entry.sources)]);
            } else replacement = t.valueToNode(entry.source);
            if (assetBinding) {
              if (!imageBindings.has(assetBinding)) imageBindings.set(assetBinding, new Set(assetBinding.referencePaths.map(ref => ref.node)));
              imageBindings.get(assetBinding).delete(expression.node);
            }
            t.inherits(replacement, expression.node);
            expression.replaceWith(replacement);
          },
        });
        for (const [binding, remaining] of imageBindings) {
          if (remaining.size) continue;
          const declaration = binding.path.parentPath;
          binding.path.remove();
          if (!declaration.node.specifiers.length) declaration.remove();
        }
        if (helper) program.unshiftContainer('body', t.importDeclaration([
          t.importSpecifier(helper, t.identifier('selectImageSource')),
        ], t.stringLiteral(runtime)));
      },
    },
  };
};
