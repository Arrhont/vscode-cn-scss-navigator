import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Провайдер определений для навигации от cn() к SCSS файлам
 */
class CnScssDefinitionProvider implements vscode.DefinitionProvider {
    /**
     * Предоставляет определение для символа в позиции курсора
     */
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        const line = document.lineAt(position.line).text;
        
        // Проверяем, находимся ли мы на ключе объекта в аргументе функции
        const objectKeyMatch = this.findObjectKeyAtPosition(document, line, position.character);
        if (objectKeyMatch) {
            return this.handleCnCall(document, objectKeyMatch);
        }

        // Проверяем, находимся ли мы внутри строки (аргумента функции)
        const stringMatch = this.findStringAtPosition(line, position.character);
        if (stringMatch) {
            // Ищем вызов cn функции, содержащий эту строку
            const cnCallMatch = this.findCnCallWithString(line, stringMatch.value, position.character);
            if (cnCallMatch) {
                return this.handleCnCall(document, cnCallMatch);
            }
        }

        // Проверяем, находимся ли мы на null в вызове cn функции
        const nullMatch = this.findNullAtPosition(line, position.character);
        if (nullMatch) {
            const cnCallMatch = this.findCnCallWithNull(line, position.character);
            if (cnCallMatch) {
                return this.handleCnCall(document, cnCallMatch);
            }
        }

        // Старая логика для обратной совместимости
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return null;
        }

        const word = document.getText(wordRange);

        // Сначала проверяем текущую строку
        let cnMatch = this.findCnDeclaration(line, word);

        // Если не нашли на текущей строке, ищем объявление переменной в файле
        if (!cnMatch && word.startsWith('cn')) {
            cnMatch = this.findCnVariableDeclaration(document, word);
        }

        if (!cnMatch) {
            return null;
        }

        // Ищем соответствующий SCSS файл
        const scssFile = this.findScssFile(document.uri.fsPath, cnMatch.componentName);
        if (!scssFile) {
            return null;
        }

        return new vscode.Location(
            vscode.Uri.file(scssFile),
            new vscode.Position(0, 0)
        );
    }

    /**
     * Ищет ключ объекта в позиции курсора
     */
    private findObjectKeyAtPosition(
        document: vscode.TextDocument,
        line: string,
        charPosition: number
    ): { componentName: string; elementName: string | null; modifierName: string; isFirstArg: boolean; scssFilePath?: string } | null {
        // Находим слово под курсором
        const wordPattern = /\b\w+\b/g;
        let match;
        let currentWord: string | null = null;
        let wordStart = -1;
        
        while ((match = wordPattern.exec(line)) !== null) {
            if (charPosition >= match.index && charPosition <= match.index + match[0].length) {
                currentWord = match[0];
                wordStart = match.index;
                break;
            }
        }

        if (!currentWord || wordStart === -1) {
            return null;
        }

        // Ищем вызов cn функции, содержащий текущую позицию
        const callPattern = /(cn\w+)\s*\(/g;
        let callMatch;

        while ((callMatch = callPattern.exec(line)) !== null) {
            const variableName = callMatch[1];
            const callStart = callMatch.index;
            
            // Находим закрывающую скобку для этого вызова
            let depth = 0;
            let callEnd = -1;
            for (let i = callMatch.index + callMatch[0].length; i < line.length; i++) {
                if (line[i] === '(') depth++;
                if (line[i] === ')') {
                    if (depth === 0) {
                        callEnd = i;
                        break;
                    }
                    depth--;
                }
            }
            
            if (callEnd === -1 || charPosition < callStart || charPosition > callEnd) {
                continue;
            }

            // Извлекаем строку аргументов
            const argsStart = callMatch.index + callMatch[0].length;
            const argsString = line.substring(argsStart, callEnd);
            
            // Проверяем, находится ли слово внутри объекта
            // Ищем ближайший объект, содержащий наше слово
            let inObject = false;
            let objectDepth = 0;
            let currentPos = argsStart;
            let firstArgIsObject = false;
            let firstArgEnd = -1;
            
            for (let i = 0; i < argsString.length; i++) {
                const char = argsString[i];
                const absPos = argsStart + i;
                
                if (char === '{') {
                    if (objectDepth === 0 && firstArgEnd === -1) {
                        firstArgIsObject = true;
                    }
                    objectDepth++;
                    if (absPos <= wordStart) {
                        inObject = true;
                    }
                } else if (char === '}') {
                    objectDepth--;
                    if (objectDepth === 0 && absPos > wordStart && inObject) {
                        // Нашли объект, содержащий наше слово
                        break;
                    }
                } else if (char === ',' && objectDepth === 0 && firstArgEnd === -1) {
                    firstArgEnd = absPos;
                }
            }
            
            // Проверяем, что слово находится внутри объекта
            if (inObject && objectDepth >= 0) {
                const afterWord = line.substring(wordStart + currentWord.length).trim();
                
                // Проверяем, что это ключ объекта:
                // 1. После слова идет двоеточие: { key: value }
                // 2. После слова идет запятая или закрывающая скобка: { key } (ES6 shorthand)
                const isObjectKey = afterWord.startsWith(':') ||
                                   afterWord.startsWith(',') ||
                                   afterWord.startsWith('}');
                
                if (isObjectKey) {
                    // Ищем объявление переменной
                    const declaration = this.findCnVariableDeclarationInDocument(document, variableName);
                    if (declaration) {
                        // Определяем, в каком аргументе находится объект
                        const isFirstArg = firstArgIsObject && (firstArgEnd === -1 || wordStart < firstArgEnd);
                        
                        // Если во втором аргументе, нужно найти имя элемента из первого
                        let elementName: string | null = null;
                        if (!isFirstArg) {
                            const firstArg = firstArgEnd !== -1 ?
                                argsString.substring(0, firstArgEnd - argsStart).trim() :
                                argsString.split(',')[0].trim();
                            const elementNameMatch = firstArg.match(/['"`]([^'"`]+)['"`]/);
                            elementName = elementNameMatch ? elementNameMatch[1] : null;
                        }
                        
                        return {
                            componentName: declaration.componentName,
                            elementName,
                            modifierName: currentWord,
                            isFirstArg,
                            scssFilePath: declaration.scssFilePath
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Парсит аргументы функции
     */
    private parseArguments(argsString: string): string[] {
        const args: string[] = [];
        let currentArg = '';
        let depth = 0;
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < argsString.length; i++) {
            const char = argsString[i];
            
            if (!inString) {
                if (char === '"' || char === "'" || char === '`') {
                    inString = true;
                    stringChar = char;
                    currentArg += char;
                } else if (char === '{' || char === '[') {
                    depth++;
                    currentArg += char;
                } else if (char === '}' || char === ']') {
                    depth--;
                    currentArg += char;
                } else if (char === ',' && depth === 0) {
                    args.push(currentArg);
                    currentArg = '';
                } else {
                    currentArg += char;
                }
            } else {
                currentArg += char;
                if (char === stringChar && argsString[i - 1] !== '\\') {
                    inString = false;
                }
            }
        }

        if (currentArg.trim()) {
            args.push(currentArg);
        }

        return args;
    }

    /**
     * Ищет ключ в объекте
     */
    private findKeyInObject(objectString: string, key: string, relativePosition: number): boolean {
        const keyPattern = new RegExp(`\\b${key}\\b\\s*:`, 'g');
        let match;
        
        while ((match = keyPattern.exec(objectString)) !== null) {
            const keyStart = match.index;
            const keyEnd = match.index + key.length;
            
            if (relativePosition >= keyStart && relativePosition <= keyEnd) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Обрабатывает вызов cn функции
     */
    private handleCnCall(
        document: vscode.TextDocument,
        cnCall: { componentName: string; elementName: string | null; modifierName?: string; isFirstArg?: boolean; scssFilePath?: string }
    ): vscode.Location | null {
        // Используем scssFilePath из cnCall если он есть (из импорта), иначе ищем файл
        const scssFile = cnCall.scssFilePath || this.findScssFile(document.uri.fsPath, cnCall.componentName);
        if (!scssFile) {
            return null;
        }

        // Если есть имя модификатора (из объекта)
        if (cnCall.modifierName) {
            const lineNumber = this.findModifierInScss(
                scssFile,
                cnCall.componentName,
                cnCall.elementName,
                cnCall.modifierName
            );
            // Всегда возвращаем Location, даже если не нашли (lineNumber будет 0)
            return new vscode.Location(
                vscode.Uri.file(scssFile),
                new vscode.Position(lineNumber, 0)
            );
        }

        // Если есть имя элемента, ищем его в SCSS файле
        if (cnCall.elementName) {
            const lineNumber = this.findElementInScss(scssFile, cnCall.componentName, cnCall.elementName);
            // Всегда возвращаем Location, даже если не нашли (lineNumber будет 0)
            return new vscode.Location(
                vscode.Uri.file(scssFile),
                new vscode.Position(lineNumber, 0)
            );
        }

        // Если элемента нет (null), просто открываем файл
        return new vscode.Location(
            vscode.Uri.file(scssFile),
            new vscode.Position(0, 0)
        );
    }

    /**
     * Ищет модификатор в SCSS файле
     */
    private findModifierInScss(
        scssFilePath: string,
        componentName: string,
        elementName: string | null,
        modifierName: string
    ): number {
        try {
            const content = fs.readFileSync(scssFilePath, 'utf-8');
            const lines = content.split('\n');

            if (elementName) {
                // Ищем модификатор внутри элемента: &-Element { &_modifier { } }
                let insideElement = false;
                let elementDepth = 0;
                let currentDepth = 0;
                let elementLineNumber = -1;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Проверяем, вошли ли мы в элемент
                    if (new RegExp(`&-${elementName}\\b`).test(line) ||
                        new RegExp(`\\.${componentName}-${elementName}\\b`).test(line)) {
                        insideElement = true;
                        elementDepth = currentDepth;
                        if (elementLineNumber === -1) {
                            elementLineNumber = i; // Запоминаем строку элемента для fallback
                        }
                    }

                    // Отслеживаем глубину вложенности
                    const openBraces = (line.match(/{/g) || []).length;
                    const closeBraces = (line.match(/}/g) || []).length;
                    currentDepth += openBraces - closeBraces;

                    // Если вышли из элемента
                    if (insideElement && currentDepth <= elementDepth && closeBraces > 0) {
                        insideElement = false;
                    }

                    // Ищем модификатор внутри элемента
                    if (insideElement) {
                        const modifierPatterns = [
                            new RegExp(`^\\s*&_${modifierName}\\b`),
                            new RegExp(`^\\.${componentName}-${elementName}_${modifierName}\\b`)
                        ];

                        for (const pattern of modifierPatterns) {
                            if (pattern.test(line)) {
                                return i; // Нашли модификатор!
                            }
                        }
                    }
                }

                // Fallback: если модификатор не найден, возвращаем строку элемента
                if (elementLineNumber !== -1) {
                    return elementLineNumber;
                }
            } else {
                // Ищем модификатор на уровне компонента: .Component { &_modifier { } }
                const patterns = [
                    new RegExp(`^\\s*&_${modifierName}\\b`),
                    new RegExp(`^\\.${componentName}_${modifierName}\\b`)
                ];

                for (let i = 0; i < lines.length; i++) {
                    for (const pattern of patterns) {
                        if (pattern.test(lines[i])) {
                            return i;
                        }
                    }
                }
            }
        } catch (error) {
            // Если произошла ошибка, возвращаем начало файла
        }

        // Fallback: если ничего не найдено, возвращаем начало файла
        return 0;
    }

    /**
     * Ищет строку в позиции курсора
     */
    private findStringAtPosition(line: string, charPosition: number): { value: string; start: number; end: number } | null {
        // Ищем все строки в кавычках
        const stringPatterns = [
            /'([^']*)'/g,
            /"([^"]*)"/g,
            /`([^`]*)`/g
        ];

        for (const pattern of stringPatterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                const start = match.index + 1; // +1 чтобы пропустить открывающую кавычку
                const end = match.index + match[0].length - 1; // -1 чтобы не включать закрывающую кавычку
                
                if (charPosition >= start && charPosition <= end) {
                    return {
                        value: match[1],
                        start,
                        end
                    };
                }
            }
        }

        return null;
    }

    /**
     * Ищет null в позиции курсора
     */
    private findNullAtPosition(line: string, charPosition: number): boolean {
        const nullPattern = /\bnull\b/g;
        let match;
        
        while ((match = nullPattern.exec(line)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;
            
            if (charPosition >= start && charPosition < end) {
                return true;
            }
        }

        return false;
    }

    /**
     * Ищет вызов cn функции, содержащий строку
     */
    private findCnCallWithString(
        line: string,
        stringValue: string,
        charPosition: number
    ): { componentName: string; elementName: string; variableName?: string; scssFilePath?: string } | null {
        // Паттерн для cnVariableName('ElementName', ...)
        const variableCallPattern = /(cn\w+)\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match;

        while ((match = variableCallPattern.exec(line)) !== null) {
            const matchStart = match.index;
            const matchEnd = match.index + match[0].length;
            
            if (charPosition >= matchStart && charPosition <= matchEnd) {
                // Нашли вызов, теперь ищем объявление переменной
                const variableName = match[1];
                const elementName = match[2];
                
                // Ищем объявление переменной в документе
                const declaration = this.findCnVariableDeclarationInDocument(
                    vscode.window.activeTextEditor?.document,
                    variableName
                );
                
                if (declaration) {
                    return {
                        componentName: declaration.componentName,
                        elementName,
                        variableName,
                        scssFilePath: declaration.scssFilePath
                    };
                }
            }
        }

        return null;
    }

    /**
     * Ищет вызов cn функции с null
     */
    private findCnCallWithNull(
        line: string,
        charPosition: number
    ): { componentName: string; elementName: null; variableName?: string; scssFilePath?: string } | null {
        // Паттерн для cnVariableName(null, ...)
        const variableCallPattern = /(cn\w+)\s*\(\s*null/g;
        let match;

        while ((match = variableCallPattern.exec(line)) !== null) {
            const matchStart = match.index;
            const matchEnd = match.index + match[0].length;
            
            if (charPosition >= matchStart && charPosition <= matchEnd) {
                const variableName = match[1];
                
                // Ищем объявление переменной в документе
                const declaration = this.findCnVariableDeclarationInDocument(
                    vscode.window.activeTextEditor?.document,
                    variableName
                );
                
                if (declaration) {
                    return {
                        componentName: declaration.componentName,
                        elementName: null,
                        variableName,
                        scssFilePath: declaration.scssFilePath
                    };
                }
            }
        }

        return null;
    }

    /**
     * Ищет элемент в SCSS файле
     */
    private findElementInScss(scssFilePath: string, componentName: string, elementName: string): number {
        try {
            const content = fs.readFileSync(scssFilePath, 'utf-8');
            const lines = content.split('\n');

            // Ищем паттерны:
            // 1. &-ElementName
            // 2. .ComponentName-ElementName
            const patterns = [
                new RegExp(`^\\s*&-${elementName}\\b`),
                new RegExp(`^\\.${componentName}-${elementName}\\b`)
            ];

            for (let i = 0; i < lines.length; i++) {
                for (const pattern of patterns) {
                    if (pattern.test(lines[i])) {
                        return i;
                    }
                }
            }
        } catch (error) {
            // Если не удалось найти, возвращаем начало файла
        }

        return 0;
    }

    /**
     * Ищет объявление переменной cn в документе
     */
    private findCnVariableDeclarationInDocument(
        document: vscode.TextDocument | undefined,
        variableName: string
    ): { componentName: string; scssFilePath?: string } | null {
        if (!document) {
            return null;
        }

        const text = document.getText();
        
        // Сначала проверяем, определена ли переменная в этом файле
        const variablePattern = new RegExp(
            `const\\s+${variableName}\\s*=\\s*cn\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)`,
            'g'
        );
        const match = variablePattern.exec(text);
        
        if (match && match[1]) {
            // Переменная определена в этом файле, ищем SCSS импорт
            const scssImport = this.findScssImportInDocument(document, match[1]);
            return {
                componentName: match[1],
                scssFilePath: scssImport || undefined
            };
        }

        // Если не найдена, проверяем импорты
        const importInfo = this.findVariableImport(document, variableName);
        if (importInfo) {
            // Следуем по импорту
            return this.followImportChain(document, importInfo);
        }

        return null;
    }

    /**
     * Ищет SCSS импорт в документе для заданного компонента
     */
    private findScssImportInDocument(document: vscode.TextDocument, componentName: string): string | null {
        const text = document.getText();
        const currentDir = path.dirname(document.uri.fsPath);
        
        // Ищем импорты вида: import './ComponentName.scss'
        const scssImportPattern = /import\s+['"]([^'"]+\.(?:scss|sass|css))['"]/g;
        let match;
        
        while ((match = scssImportPattern.exec(text)) !== null) {
            const importPath = match[1];
            const fileName = path.basename(importPath, path.extname(importPath));
            
            // Проверяем, совпадает ли имя файла с именем компонента
            if (fileName === componentName) {
                // Резолвим относительный путь
                const resolvedPath = path.resolve(currentDir, importPath);
                if (fs.existsSync(resolvedPath)) {
                    return resolvedPath;
                }
            }
        }
        
        return null;
    }

    /**
     * Ищет импорт переменной в документе
     */
    private findVariableImport(
        document: vscode.TextDocument,
        variableName: string
    ): { importPath: string; exportName: string } | null {
        const text = document.getText();
        
        // Паттерны импортов:
        // import { cnVariable } from './path'
        // import { cnVariable as alias } from './path'
        const namedImportPattern = new RegExp(
            `import\\s*{[^}]*\\b${variableName}\\b[^}]*}\\s*from\\s*['"]([^'"]+)['"]`,
            'g'
        );
        
        let match = namedImportPattern.exec(text);
        if (match) {
            return {
                importPath: match[1],
                exportName: variableName
            };
        }
        
        return null;
    }

    /**
     * Следует по цепочке импортов для поиска определения cn и SCSS файла
     */
    private followImportChain(
        currentDocument: vscode.TextDocument,
        importInfo: { importPath: string; exportName: string },
        visited: Set<string> = new Set()
    ): { componentName: string; scssFilePath?: string } | null {
        const currentDir = path.dirname(currentDocument.uri.fsPath);
        
        // Резолвим путь импорта
        let resolvedPath = this.resolveImportPath(currentDir, importInfo.importPath);
        if (!resolvedPath || visited.has(resolvedPath)) {
            return null; // Избегаем циклических импортов
        }
        
        visited.add(resolvedPath);
        
        try {
            const importedContent = fs.readFileSync(resolvedPath, 'utf-8');
            
            // Ищем определение переменной в импортированном файле
            const variablePattern = new RegExp(
                `export\\s+const\\s+${importInfo.exportName}\\s*=\\s*cn\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)`,
                'g'
            );
            const match = variablePattern.exec(importedContent);
            
            if (match && match[1]) {
                const componentName = match[1];
                
                // Ищем SCSS импорт в этом файле
                const scssImport = this.findScssImportInFile(resolvedPath, componentName);
                
                return {
                    componentName,
                    scssFilePath: scssImport || undefined
                };
            }
            
            // Если не найдено, проверяем реэкспорты
            const reexportPattern = new RegExp(
                `export\\s*{[^}]*\\b${importInfo.exportName}\\b[^}]*}\\s*from\\s*['"]([^'"]+)['"]`,
                'g'
            );
            const reexportMatch = reexportPattern.exec(importedContent);
            
            if (reexportMatch) {
                // Создаем временный документ для рекурсии
                const tempDoc = {
                    uri: { fsPath: resolvedPath },
                    getText: () => importedContent
                } as vscode.TextDocument;
                
                return this.followImportChain(
                    tempDoc,
                    { importPath: reexportMatch[1], exportName: importInfo.exportName },
                    visited
                );
            }
        } catch (error) {
            // Файл не найден или ошибка чтения
        }
        
        return null;
    }

    /**
     * Резолвит путь импорта относительно текущей директории
     */
    private resolveImportPath(currentDir: string, importPath: string): string | null {
        // Обрабатываем относительные пути
        if (importPath.startsWith('.')) {
            const extensions = ['.ts', '.tsx', '.js', '.jsx'];
            
            // Пробуем с расширениями
            for (const ext of extensions) {
                const withExt = path.resolve(currentDir, importPath + ext);
                if (fs.existsSync(withExt)) {
                    return withExt;
                }
            }
            
            // Пробуем как есть
            const asIs = path.resolve(currentDir, importPath);
            if (fs.existsSync(asIs)) {
                return asIs;
            }
        }
        
        return null;
    }

    /**
     * Ищет SCSS импорт в файле
     */
    private findScssImportInFile(filePath: string, componentName: string): string | null {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const currentDir = path.dirname(filePath);
            
            const scssImportPattern = /import\s+['"]([^'"]+\.(?:scss|sass|css))['"]/g;
            let match;
            
            while ((match = scssImportPattern.exec(content)) !== null) {
                const importPath = match[1];
                const fileName = path.basename(importPath, path.extname(importPath));
                
                if (fileName === componentName) {
                    const resolvedPath = path.resolve(currentDir, importPath);
                    if (fs.existsSync(resolvedPath)) {
                        return resolvedPath;
                    }
                }
            }
        } catch (error) {
            // Ошибка чтения файла
        }
        
        return null;
    }

    /**
     * Ищет объявление переменной cn в файле
     */
    private findCnVariableDeclaration(document: vscode.TextDocument, variableName: string): { componentName: string } | null {
        const text = document.getText();
        
        // Паттерн для поиска const cnVariableName = cn('ComponentName')
        const variablePattern = new RegExp(`const\\s+${variableName}\\s*=\\s*cn\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)`, 'g');
        const match = variablePattern.exec(text);
        
        if (match && match[1]) {
            return { componentName: match[1] };
        }

        return null;
    }

    /**
     * Проверяет, находится ли курсор на имени компонента в cn()
     */
    private findCnDeclaration(line: string, word: string): { componentName: string } | null {
        // Паттерны для поиска cn('ComponentName') или cn("ComponentName")
        const patterns = [
            /cn\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
            /cn\s*\(\s*`([^`]+)`\s*\)/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                const componentName = match[1];
                // Проверяем, что курсор находится на имени компонента
                if (componentName === word || line.includes(`cn${word}`) || line.includes(`const ${word}`)) {
                    return { componentName };
                }
            }
        }

        // Также проверяем паттерн const cnComponentName = cn('ComponentName')
        const constPattern = /const\s+(cn\w+)\s*=\s*cn\s*\(\s*['"]([^'"]+)['"]\s*\)/;
        const constMatch = line.match(constPattern);
        if (constMatch && constMatch[1] === word) {
            return { componentName: constMatch[2] };
        }

        return null;
    }

    /**
     * Ищет SCSS файл в той же директории, что и текущий файл
     */
    private findScssFile(currentFilePath: string, componentName: string): string | null {
        const currentDir = path.dirname(currentFilePath);

        // Получаем паттерн из конфигурации
        const config = vscode.workspace.getConfiguration('cnScssNavigator');
        const pattern = config.get<string>('scssFilePattern', '{componentName}.scss');

        // Заменяем плейсхолдер на имя компонента
        const scssFileName = pattern.replace('{componentName}', componentName);
        const scssFilePath = path.join(currentDir, scssFileName);

        // Проверяем существование файла
        if (fs.existsSync(scssFilePath)) {
            return scssFilePath;
        }

        // Также проверяем варианты с .sass
        const sassFilePath = scssFilePath.replace('.scss', '.sass');
        if (fs.existsSync(sassFilePath)) {
            return sassFilePath;
        }

        // Проверяем вариант с .css
        const cssFilePath = scssFilePath.replace('.scss', '.css');
        if (fs.existsSync(cssFilePath)) {
            return cssFilePath;
        }

        // Fallback: если файл не найден, пробуем использовать имя текущего файла
        // Например, для Modal.tsx ищем Modal.scss (даже если компонент называется Modal2)
        const currentFileName = path.basename(currentFilePath, path.extname(currentFilePath));
        if (currentFileName !== componentName) {
            const fallbackScssPath = path.join(currentDir, `${currentFileName}.scss`);
            if (fs.existsSync(fallbackScssPath)) {
                return fallbackScssPath;
            }

            const fallbackSassPath = path.join(currentDir, `${currentFileName}.sass`);
            if (fs.existsSync(fallbackSassPath)) {
                return fallbackSassPath;
            }

            const fallbackCssPath = path.join(currentDir, `${currentFileName}.css`);
            if (fs.existsSync(fallbackCssPath)) {
                return fallbackCssPath;
            }
        }

        return null;
    }
}

/**
 * Активация расширения
 */
export function activate(context: vscode.ExtensionContext) {
    // Регистрируем провайдер определений для TypeScript/JavaScript файлов
    const selector: vscode.DocumentSelector = [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' }
    ];

    const provider = new CnScssDefinitionProvider();
    const disposable = vscode.languages.registerDefinitionProvider(selector, provider);

    context.subscriptions.push(disposable);
}

/**
 * Деактивация расширения
 */
export function deactivate() {}
