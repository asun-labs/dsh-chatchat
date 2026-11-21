// Read exact installed native declarations without depending on bundle spacing,
// quote style or region comments. The code under test is never rewritten.
import assert from 'node:assert/strict'
import { desktopRequire } from './test-environment.mjs'

const ts = desktopRequire('typescript')

export function nativeCode(source) {
  const file = ts.createSourceFile('native.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  assert.equal(file.parseDiagnostics.length, 0, 'installed native JavaScript must parse')
  function find(predicate, label) {
    const matches = []
    function visit(node) {
      if (predicate(node)) matches.push(node)
      ts.forEachChild(node, visit)
    }
    visit(file)
    assert.equal(matches.length, 1, `expected exactly one installed ${label}, found ${matches.length}`)
    return matches[0]
  }
  const functionNode = name => find(node => ts.isFunctionDeclaration(node) && node.name?.text === name, `function ${name}`)
  return {
    function: name => functionNode(name).getText(file),
    prefix(name, until) {
      const node = functionNode(name)
      const statements = [...node.body.statements]
      const at = statements.findIndex(statement => until(statement.getText(file)))
      assert(at >= 0, `native ${name} prefix boundary exists`)
      return source.slice(node.getStart(file), node.body.getStart(file) + 1)
        + statements.slice(0, at).map(statement => statement.getText(file)).join('\n')
    },
    value: name => find(node => ts.isVariableDeclaration(node) && node.name.getText(file) === name,
      `variable ${name}`).initializer.getText(file),
    method: name => find(node => ts.isMethodDeclaration(node) && node.name.getText(file) === name,
      `method ${name}`).getText(file),
    css(marker) {
      return find(node => ts.isVariableDeclaration(node)
        && node.initializer && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
        && node.initializer.text.includes(marker), `CSS containing ${marker}`).initializer.text
    },
  }
}
