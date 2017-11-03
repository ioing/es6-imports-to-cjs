// import to require

class ES6ModulesToCJSTransformer {
  constructor() {
    this.REGEXP_IMPORT_LINE = new RegExp("^\\s*import(?:\\s+(.*)\\s+from\\s+|\\s+)(?:\'|\")([^\\s;]+)(?:\'|\");?$")
    this.REGEXP_EXPORT_LINE = new RegExp("^\\s*export(?:\\s+(\\{(.*)\\}|[\\w]+))\\s?([\\w]+)?\\s?(\\=)?", "g")
    this.REGEXP_SUB_IMPORT = new RegExp("(.*)\\s*\\{(.*)\\}\\s*(.*)")
    this.REGEXP_ALIAS = new RegExp("(\\S+)\\s+as\\s+(\\S+)")
    this.REGEXP_BEFORE = new RegExp("\\s*([^\\s,]+)\\s*,")
    this.REGEXP_AFTER = new RegExp(",\\s*([^\\s,]+)\\s*")
    this.REGEXP_PATH = new RegExp("(?:\\.{0,2}(?:\\/|\\.))+(\\w)", "g")
    this.REGEXP_IMPORT_GROUP_SPLIT = new RegExp("\\s?,\\s?")
    this.REGEXP_NEW_LINE = new RegExp("\\n|\\r")
    this.variableDeclarationWord = 'const'
  }

  getStructure(subImport) {
    let alias = subImport && subImport.match(this.REGEXP_ALIAS)
    let structure = alias ? alias.slice(1) : [subImport, subImport]
    return structure.map((name) => {
      return name ? name.trim() : name
    })
  }

  getAssignment(structure, requireName) {

    if (structure[0] === '*') {
      return ''
    }
    return this.variableDeclarationWord + ' ' + structure[0] + ' = ' + requireName + '[\'' + structure[1] + '\'];';

  }

  getRequireName(path) {

    return path ? path.replace(this.REGEXP_PATH, (match, firstLetter, offset) => {
      return offset ? firstLetter.toUpperCase() : firstLetter
    }) : path

  }

  transform(sourceContent) {

    let lines = sourceContent.split(this.REGEXP_NEW_LINE)
    let exports = []

    let self = this

    let getStructure = this.getStructure.bind(this)

    lines = lines.map((line) => {
      let match = line.match(self.REGEXP_IMPORT_LINE)

      if (!match) {
        return line
      }

      let allStructures = []
      let requireName = ''

      let importsString = match[1]
      let path = match[2]

      let allImports = importsString && importsString.match(self.REGEXP_SUB_IMPORT) || []
      let structure = null

      let requirePart = ''
      let importParts = []

      if (allImports.length > 1) {
        let subImportMatch = allImports[2].split(self.REGEXP_IMPORT_GROUP_SPLIT)
        allStructures = allStructures.concat(subImportMatch.map(getStructure))

        if (allImports[1]) {
          let beforeImports = allImports[1].match(self.REGEXP_BEFORE)
          if (beforeImports) {
            structure = getStructure(beforeImports[1])
            allStructures.push(structure)
          }
        }

        if (allImports[3]) {
          let afterImports = allImports[3].match(self.REGEXP_AFTER)
          if (afterImports) {
            structure = getStructure(afterImports[1])
            allStructures.push(structure)
          }
        }

        if (!allImports[1] && !allImports[3]) {
          structure = [path, path]
        }

      } else {
        structure = getStructure(importsString)
        allStructures.push(getStructure(importsString))
      }

      requireName = structure[1]

      if (requireName) {
        requireName = self.getRequireName(requireName)
        requirePart = self.variableDeclarationWord + ' ___' + requireName + ' = '
        importParts.push(self.variableDeclarationWord + ' ' + requireName + ' = ___' + requireName + '[\'default\'] || ___' + requireName + ';')
      }

      requirePart += 'require(\'' + path + '\')'

      allStructures.forEach(function(structure) {
        if (structure && requireName === structure[0] && structure[0] === structure[1]) {
          return
        }
        let assignment = self.getAssignment(structure, '_' + requireName)
        if (assignment) {
          importParts.push(assignment)
        }
      })

      line.replace(self.REGEXP_EXPORT_LINE, (c, n, v, l, k) => {
        let slin = v.split(' ')
        if (n.indexOf('{') === 0) {
          let exports = []
          let spl = n.split(',')
          for (let i = 0, l = spl.length; i < l; i++) {
            let s = spl[i].split(' ')
            exports.push('module.exports[' + s[0] + '] = ' + s[s[1] === 'as' ? 2 : 0])
          }
          return exports.join('\n')
        } else if (n === 'default') {
          return 'module.exports.default = '
        } else if (k === '=') {
          return n + ' ' + l + ' = module.exports[' + n + '] = '
        }
      })

      return requirePart + (importParts.length ? '\n' + importParts.join('\n') : '')
    })

    return lines.join('\n')

  }
}

module.exports = ES6ModulesToCJSTransformer;
