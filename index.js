"use strict";

function ES6ModulesToCJSTransformer() {}

ES6ModulesToCJSTransformer.prototype.REGEXP_IMPORT_LINE = new RegExp("^\\s*import(?:\\s+(.*)\\s+from\\s+|\\s+)(?:\'|\")([^\\s;]+)(?:\'|\");?$");
ES6ModulesToCJSTransformer.prototype.REGEXP_SUB_IMPORT = new RegExp("(.*)\\s*\\{(.*)\\}\\s*(.*)");
ES6ModulesToCJSTransformer.prototype.REGEXP_ALIAS = new RegExp("(\\S+)\\s+as\\s+(\\S+)");
ES6ModulesToCJSTransformer.prototype.REGEXP_BEFORE = new RegExp("\\s*([^\\s,]+)\\s*,");
ES6ModulesToCJSTransformer.prototype.REGEXP_AFTER = new RegExp(",\\s*([^\\s,]+)\\s*");
ES6ModulesToCJSTransformer.prototype.REGEXP_PATH = new RegExp("(?:\\.{0,2}\\/)+(\\w)", "g");
ES6ModulesToCJSTransformer.prototype.REGEXP_IMPORT_GROUP_SPLIT = new RegExp("\\s?,\\s?");
ES6ModulesToCJSTransformer.prototype.REGEXP_NEW_LINE = new RegExp("\\n|\\r");

ES6ModulesToCJSTransformer.prototype.getStructure = function getStructure(subImport) {
    var alias = subImport && subImport.match(this.REGEXP_ALIAS);
    var structure = alias ? alias.slice(1) : [subImport, subImport];
    return structure.map(function(name) {
        return name ? name.trim() : name;
    });
};

ES6ModulesToCJSTransformer.prototype.variableDeclarationWord = 'const';

ES6ModulesToCJSTransformer.prototype.getAssignment = function(structure, requireName) {

    if (structure[0] === '*') {
        return '';
    }
    return this.variableDeclarationWord + ' ' + structure[0] + ' = ' + requireName + '[\'' + structure[1] + '\'];';

};

ES6ModulesToCJSTransformer.prototype.getRequireName = function(path) {

    return path ? path.replace(this.REGEXP_PATH, function(match, firstLetter, offset) {
        return offset ? firstLetter.toUpperCase() : firstLetter;
    }) : path;

};

ES6ModulesToCJSTransformer.prototype.transform = function(sourceContent) {

    var lines = sourceContent.split(this.REGEXP_NEW_LINE);

    var self = this;

    var getStructure = this.getStructure.bind(this);

    lines = lines.map(function(line) {
        var match = line.match(self.REGEXP_IMPORT_LINE);

        if (!match) {
            return line;
        }

        var allStructures = [];
        var requireName = '';

        var importsString = match[1];
        var path = match[2];

        var allImports = importsString && importsString.match(self.REGEXP_SUB_IMPORT) || [];
        var structure = null;

        var requirePart = '';
        var importParts = [];

        if (allImports.length > 1) {
            var subImportMatch = allImports[2].split(self.REGEXP_IMPORT_GROUP_SPLIT);
            allStructures = allStructures.concat(subImportMatch.map(getStructure));

            if (allImports[1]) {
                var beforeImports = allImports[1].match(self.REGEXP_BEFORE);
                if (beforeImports) {
                    structure = getStructure(beforeImports[1]);
                    allStructures.push(structure);
                }
            }

            if (allImports[3]) {
                var afterImports = allImports[3].match(self.REGEXP_AFTER);
                if (afterImports) {
                    structure = getStructure(afterImports[1]);
                    allStructures.push(structure);
                }
            }

            if (!allImports[1] && !allImports[3]) {
                structure = [path, path];
            }

        } else {
            structure = getStructure(importsString);
            allStructures.push(getStructure(importsString));
        }

        requireName = structure[1];

        if (requireName) {
            requireName = self.getRequireName(requireName);
            requirePart = self.variableDeclarationWord + ' ' + requireName + ' = ';
        }

        requirePart += '(function(module) { return module && typeof module[\'default\'] !== \'undefined\' ? module[\'default\'] : module; })(require(\'' + path + '\'))';

        allStructures.forEach(function(structure) {
            if (structure && requireName === structure[0] && structure[0] === structure[1]) {
                return;
            }
            var assignment = self.getAssignment(structure, requireName);
            if (assignment) {
                importParts.push(assignment);
            }
        });

        return requirePart + (importParts.length ? '\n' + importParts.join('\n') : '');
    });

    return lines.join('\n');

};


module.exports = ES6ModulesToCJSTransformer;
