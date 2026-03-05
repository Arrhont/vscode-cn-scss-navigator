# Инструкция по установке и использованию

## Быстрый старт

### 1. Установка зависимостей

Перейдите в директорию расширения и установите зависимости:

```bash
cd vscode-cn-scss-navigator
npm install
```

### 2. Компиляция расширения

```bash
npm run compile
```

### 3. Запуск в режиме разработки

Откройте папку `vscode-cn-scss-navigator` в VSCode и нажмите `F5`. Это откроет новое окно VSCode с активированным расширением.

### 4. Тестирование

В новом окне VSCode откройте ваш проект (например, `/home/evgender/www/arcadia/frontend/services/webmaster`) и откройте файл с использованием `cn()`:

```typescript
import { cn } from '@bem-react/classname';
import './403Page.scss';

const cn403Page = cn('403Page');
```

Теперь:
- Наведите курсор на `'403Page'` в строке `cn('403Page')`
- Зажмите `Ctrl` (или `Cmd` на Mac) и кликните
- Откроется файл `403Page.scss`

## Установка как постоянное расширение

### Вариант 1: Через VSIX пакет

1. Установите инструмент для упаковки:
```bash
npm install -g @vscode/vsce
```

2. Упакуйте расширение:
```bash
cd vscode-cn-scss-navigator
vsce package
```

3. Установите созданный `.vsix` файл:
   - Откройте VSCode
   - Нажмите `Ctrl+Shift+P` (или `Cmd+Shift+P` на Mac)
   - Введите "Extensions: Install from VSIX..."
   - Выберите созданный файл `cn-scss-navigator-1.0.0.vsix`

### Вариант 2: Копирование в директорию расширений

```bash
# Для Linux/Mac
cp -r vscode-cn-scss-navigator ~/.vscode/extensions/

# Для Windows
xcopy vscode-cn-scss-navigator %USERPROFILE%\.vscode\extensions\ /E /I
```

После этого перезапустите VSCode.

## Примеры использования

### Пример 1: Базовое использование

**Файл:** `src/pages/403Page/403Page.tsx`

```typescript
import { cn } from '@bem-react/classname';
import './403Page.scss';

const cn403Page = cn('403Page'); // Ctrl+Click на '403Page'
```

**Результат:** Откроется `src/pages/403Page/403Page.scss`

### Пример 2: Использование в JSX

```typescript
const cnButton = cn('Button'); // Ctrl+Click на 'Button'

return (
  <button className={cnButton()}>
    Click me
  </button>
);
```

**Результат:** Откроется `Button.scss` в той же директории

### Пример 3: Навигация к элементам (НОВОЕ!)

```typescript
const cnComponent = cn('Component');

return (
  <div className={cnComponent('Element')}>
    {/* Ctrl+Click на 'Element' → откроет SCSS и перейдет к &-Element */}
    Content
  </div>
);
```

**Результат:** Откроется `Component.scss` на строке с `&-Element`

### Пример 4: Навигация к модификаторам (НОВОЕ!)

```typescript
const cnCard = cn('Card');

return (
  <div className={cnCard({ theme: 'dark' })}>
    {/* Ctrl+Click на 'theme' → откроет SCSS и перейдет к &_theme */}
    Content
  </div>
);
```

**Результат:** Откроется `Card.scss` на строке с `&_theme`

### Пример 5: Следование по импортам (НОВОЕ!)

```typescript
// DateRange.cn.ts
import { cn } from '@bem-react/classname';
import './DateRange.scss';
export const cnDateRange = cn('DateRange');

// DateRange.tsx
import { cnDateRange } from './DateRange.cn';

return (
  <div className={cnDateRange(null, [className])}>
    {/* Ctrl+Click на 'null' → откроет DateRange.scss из DateRange.cn.ts! */}
    Content
  </div>
);
```

**Результат:** Расширение автоматически следует по импорту и открывает `DateRange.scss`

## Настройка

Вы можете настроить паттерн имени файла стилей в настройках VSCode:

1. Откройте настройки (`Ctrl+,` или `Cmd+,`)
2. Найдите "CN SCSS Navigator"
3. Измените параметр `cnScssNavigator.scssFilePattern`

### Примеры паттернов

```json
{
  // По умолчанию
  "cnScssNavigator.scssFilePattern": "{componentName}.scss",
  
  // Для CSS модулей
  "cnScssNavigator.scssFilePattern": "{componentName}.module.scss",
  
  // Для вложенной структуры
  "cnScssNavigator.scssFilePattern": "styles/{componentName}.scss"
}
```

## Устранение неполадок

### Расширение не работает

1. Убедитесь, что расширение скомпилировано:
```bash
npm run compile
```

2. Проверьте, что расширение активировано:
   - Откройте палитру команд (`Ctrl+Shift+P`)
   - Введите "Developer: Show Running Extensions"
   - Найдите "CN SCSS Navigator" в списке

### SCSS файл не открывается

1. Убедитесь, что файл существует в той же директории или импортирован в файле с определением `cn`
2. Проверьте имя файла (должно совпадать с именем в `cn()`)
3. Проверьте настройку `cnScssNavigator.scssFilePattern`
4. Если используется импорт, убедитесь что:
   - Используется именованный экспорт (`export const cnName = ...`)
   - Путь импорта относительный (начинается с `./` или `../`)
   - В файле с определением есть импорт SCSS

### Ошибки TypeScript

Если видите ошибку "Cannot find module 'vscode'", это нормально для разработки. Расширение будет работать при запуске через `F5` или после установки.

## Разработка

### Структура проекта

```
vscode-cn-scss-navigator/
├── .vscode/              # Конфигурация VSCode для разработки
│   ├── launch.json       # Настройки запуска
│   ├── tasks.json        # Задачи сборки
│   └── extensions.json   # Рекомендуемые расширения
├── src/
│   └── extension.ts      # Основной код расширения
├── out/                  # Скомпилированные файлы (создается автоматически)
├── package.json          # Манифест расширения
├── tsconfig.json         # Конфигурация TypeScript
├── .eslintrc.json        # Конфигурация ESLint
├── .vscodeignore         # Файлы, игнорируемые при упаковке
├── .gitignore            # Git ignore
├── README.md             # Документация
├── INSTALLATION.md       # Эта инструкция
├── CHANGELOG.md          # История изменений
└── LICENSE               # Лицензия
```

### Команды для разработки

```bash
# Установка зависимостей
npm install

# Компиляция
npm run compile

# Компиляция с отслеживанием изменений
npm run watch

# Проверка кода
npm run lint

# Упаковка расширения
vsce package
```

### Отладка

1. Откройте папку расширения в VSCode
2. Нажмите `F5` для запуска в режиме отладки
3. В новом окне откройте ваш проект
4. Установите точки останова в `src/extension.ts`
5. Используйте расширение - выполнение остановится на точках останова

## Публикация

Если хотите опубликовать расширение в VSCode Marketplace:

1. Создайте аккаунт на [Visual Studio Marketplace](https://marketplace.visualstudio.com/)
2. Получите Personal Access Token
3. Войдите через vsce:
```bash
vsce login <publisher-name>
```
4. Опубликуйте:
```bash
vsce publish
```

## Поддержка

Если у вас возникли проблемы или есть предложения по улучшению, создайте issue в репозитории проекта.
