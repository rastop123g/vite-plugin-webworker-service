export function getExports(ast) {
  const res = []
  if(ast.type === "Program") {
    const nodes = ast.body
    for(const node of nodes) {
      if(node.type === "ExportNamedDeclaration") {
        if(node.declaration.type === "FunctionDeclaration") {
          res.push(node.declaration.id.name)
        }
      }
    }
  }
  return res
}
