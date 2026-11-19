const assetsSuffix = 'svg|png|css|scss';

export default {
  arrowParens: 'always',
  singleQuote: true,
  trailingComma: 'all',
  tabWidth: 2,
  semi: true,
  printWidth: 100,
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  importOrder: [
    `^(?!((\\.)|(\\..)[a-z@])).(?!.*\\.(${assetsSuffix})$)`, // All imports from node_modules
    `^\\..(?!.*\\.(${assetsSuffix})$)|^\\.$`, // All imports starts with "."
    `^(?!((\\.)|(\\..)[a-z@])).*\\.(${assetsSuffix})$`, // All assets imports from node_modules
    `\\.(${assetsSuffix})$`, // All assets imports starts with "."
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ['classProperties', 'decorators-legacy', 'typescript'],
};
