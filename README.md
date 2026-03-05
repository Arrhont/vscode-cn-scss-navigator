# CN SCSS Navigator

Расширение для VSCode, которое позволяет быстро переходить от селектора в конструкторе `cn()` к соответствующему SCSS файлу.

## Возможности

- **Навигация по Ctrl+Click (Cmd+Click на Mac)**: Кликните на название компонента в `cn()` с зажатой клавишей Ctrl/Cmd, чтобы открыть соответствующий SCSS файл
- **Поддержка различных паттернов**: Работает с `cn('ComponentName')`, `cn("ComponentName")` и `cn(\`ComponentName\`)`
- **Автоматический поиск**: Ищет файлы `.scss`, `.sass` и `.css` в той же директории
- **Настраиваемый паттерн**: Можно настроить шаблон имени файла стилей

## Использование

### Пример 1: Прямой вызов cn()

```typescript
import { cn } from '@bem-react/classname';
import './403Page.scss';

const cn403Page = cn('403Page'); // Ctrl+Click на '403Page' откроет 403Page.scss
```

### Пример 2: Клик на переменную cn

```typescript
const cnMyComponent = cn('MyComponent'); // Ctrl+Click на 'cnMyComponent' откроет MyComponent.scss

// Теперь работает и в местах использования!
return (
  <div className={cnMyComponent()}> {/* Ctrl+Click на 'cnMyComponent' тоже откроет MyComponent.scss */}
    <span className={cnMyComponent('Element')}> {/* И здесь тоже! */}
      Content
    </span>
  </div>
);
```

### Пример 3: Использование в JSX

```typescript
const cnAonPage = cn('AonPage');

return (
  <Paper className={cnAonPage(null, [className])}> {/* Ctrl+Click на 'cnAonPage' откроет AonPage.scss */}
    <iframe className={cnAonPage('Iframe')} /> {/* И здесь тоже работает! */}
  </Paper>
);
```

### Пример 4: Навигация к элементам в SCSS (НОВОЕ!)

```typescript
const cnSearchQueryMonitoringIndicators = cn('SearchQueryMonitoringIndicators');

return (
  <div className={cnSearchQueryMonitoringIndicators(null, [className])}> {/* Ctrl+Click на 'null' → откроет SCSS файл */}
    <div className={cnSearchQueryMonitoringIndicators('IndicatorWrapper', { indicator })}> {/* Ctrl+Click на 'IndicatorWrapper' → откроет SCSS и перейдет к строке &-IndicatorWrapper */}
      Content
    </div>
  </div>
);
```

**В SCSS файле:**
```scss
.SearchQueryMonitoringIndicators {
    display: flex;
    
    &-IndicatorWrapper {  // ← Ctrl+Click на 'IndicatorWrapper' приведет сюда!
        display: flex;
    }
}
```

### Пример 5: Навигация по модификаторам в объектах (НОВОЕ!)

```typescript
const cnSearchQueryMonitoringTableHeaderSortCell = cn('SearchQueryMonitoringTableHeaderSortCell');

return (
  <span className={cnSearchQueryMonitoringTableHeaderSortCell({ active: Boolean(monitoringSort) }, [className])}>
    {/* Ctrl+Click на 'active' → откроет SCSS и перейдет к строке &_active */}
    {dateStr}
    <SortIcon className={cnSearchQueryMonitoringTableHeaderSortCell('Icon')} />
    {/* Ctrl+Click на 'Icon' → откроет SCSS и перейдет к строке &-Icon */}
  </span>
);
```

**В SCSS файле:**
```scss
.SearchQueryMonitoringTableHeaderSortCell {
    color: var(--wm-redesign-palette-hint);
    
    &_active {  // ← Ctrl+Click на 'active' в объекте приведет сюда!
        color: var(--wm-redesign-palette-foreground);
        font-weight: bold;
    }
    
    &-Icon {  // ← Ctrl+Click на 'Icon' приведет сюда!
        width: 16px;
    }
}
```

### Пример 6: Модификаторы элементов

```typescript
const cnComponent = cn('Component');

return (
  <div className={cnComponent('Element', { modifier: true })}>
    {/* Ctrl+Click на 'modifier' → откроет SCSS и перейдет к &_modifier внутри &-Element */}
    Content
  </div>
);
```

**В SCSS файле:**
```scss
.Component {
    &-Element {
        display: flex;
        
        &_modifier {  // ← Ctrl+Click на 'modifier' во втором аргументе приведет сюда!
            font-weight: bold;
        }
    }
}
```

### Пример 7: Следование по импортам (НОВОЕ!)

```typescript
// DateRange.cn.ts
import { cn } from '@bem-react/classname';
import './DateRange.scss';

export const cnDateRange = cn('DateRange');
```

```typescript
// DateRange.tsx
import { cnDateRange } from './DateRange.cn';

export const DateRange: FC<Props> = ({ className }) => {
    return (
        <div className={cnDateRange(null, [className])}>
            {/* Ctrl+Click на 'null' → откроет DateRange.scss из DateRange.cn.ts! */}
            {/* Расширение автоматически следует по импорту и находит SCSS файл */}
            Content
        </div>
    );
};
```

**Как это работает:**
- Расширение обнаруживает, что `cnDateRange` импортирован из другого файла
- Следует по импорту в `DateRange.cn.ts`
- Находит там определение `cn('DateRange')` и импорт `./DateRange.scss`
- Открывает найденный SCSS файл

Это особенно полезно, когда вы выносите определения `cn` в отдельные файлы для переиспользования!

## Установка

### Из исходников

1. Клонируйте репозиторий или скопируйте папку `vscode-cn-scss-navigator`
2. Откройте папку в терминале
3. Установите зависимости:
   ```bash
   npm install
   ```
4. Скомпилируйте расширение:
   ```bash
   npm run compile
   ```
5. Нажмите `F5` в VSCode для запуска расширения в режиме разработки

### Установка как расширение

1. Упакуйте расширение:
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```
2. Установите созданный `.vsix` файл через VSCode:
   - Откройте палитру команд (`Ctrl+Shift+P` / `Cmd+Shift+P`)
   - Выберите "Extensions: Install from VSIX..."
   - Выберите созданный `.vsix` файл

## Настройки

Расширение можно настроить через настройки VSCode:

```json
{
  "cnScssNavigator.scssFilePattern": "{componentName}.scss"
}
```

- `{componentName}` - будет заменен на имя компонента из `cn()`

### Примеры паттернов

- `{componentName}.scss` (по умолчанию)
- `{componentName}.module.scss`
- `styles/{componentName}.scss`

## Поддерживаемые языки

- TypeScript (`.ts`)
- TypeScript React (`.tsx`)
- JavaScript (`.js`)
- JavaScript React (`.jsx`)

## Поддерживаемые форматы стилей

- SCSS (`.scss`)
- Sass (`.sass`)
- CSS (`.css`)

## Как это работает

1. Расширение регистрирует провайдер определений для TypeScript/JavaScript файлов
2. При клике с Ctrl/Cmd на слово, расширение проверяет контекст:
   - Находится ли курсор на имени компонента в `cn()`
   - Находится ли курсор на строке с именем элемента
   - Находится ли курсор на `null` в вызове cn
   - Находится ли курсор на ключе объекта (модификаторе)
3. Если переменная `cn` импортирована, расширение следует по цепочке импортов
4. Ищет соответствующий файл стилей (в текущей директории или по импорту)
5. Если указан элемент или модификатор, ищет соответствующую строку в SCSS
6. Открывает найденный файл на нужной строке

## Требования

- VSCode версии 1.75.0 или выше

## Известные ограничения

- Не поддерживает динамические имена компонентов (переменные в `cn()`)
- Следование по импортам работает только для относительных путей (начинающихся с `./` или `../`)
- Поддерживает только именованные экспорты (`export const cnName = ...`)

## Разработка

### Структура проекта

```
vscode-cn-scss-navigator/
├── src/
│   └── extension.ts      # Основной код расширения
├── package.json          # Манифест расширения
├── tsconfig.json         # Конфигурация TypeScript
└── README.md            # Документация
```

### Команды для разработки

- `npm run compile` - Компиляция TypeScript
- `npm run watch` - Компиляция в режиме наблюдения
- `npm run lint` - Проверка кода

## Лицензия

MIT

## Автор

Создано для упрощения навигации в проектах, использующих `@bem-react/classname`.
