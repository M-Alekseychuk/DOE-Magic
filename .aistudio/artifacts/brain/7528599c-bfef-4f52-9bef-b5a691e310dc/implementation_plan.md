# Multi-Language Localization System (English & Simplified Chinese)

Comprehensive internationalization (i18n) engine for DOE Magic with a sidebar footer dropdown popup menu, supporting English and Simplified Chinese (zh-CN) across all views, statistical metrics, tooltips, guidance, and exports, built with an extensible schema ready for future language additions (German, Spanish, French, Italian).

## User Review & Critical Decisions

> [!IMPORTANT]
> The following design and architectural choices have been confirmed and incorporated into this plan:
> - **Language Standard**: Simplified Chinese (`zh-CN`) optimized for pharmaceutical research and process development teams.
> - **Sidebar Switcher UI**: Sleek dropdown popup menu anchored at the bottom of the sidebar, displaying the current language with a globe icon, chevron, and popup list showing active checkmarks and native language names.
> - **Terminology Handling**: Preserves universally recognized statistical and chemical acronyms (e.g., DOE, ANOVA, OLS, $R^2$, Adj $R^2$, RMSE, Cpk, DSD, CCD, BBD) alongside clear, professional Chinese technical terminology.
> - **Extensibility**: Modular dictionary architecture (`en`, `zh`, and extensible interfaces for `de`, `es`, `fr`, `it`) with automatic fallback to English for missing keys.

---

## 1. Overview & Core Concept

DOE Magic is designed for pharmaceutical and chemical formulation scientists at Jiuzhou Pharmaceutical and global research teams. While English is the primary international scientific standard, providing first-class Simplified Chinese localization lowers cognitive load for Chinese colleagues conducting experimental design, factor screening, regression modeling, and response surface optimization.

### Key Capabilities
- **Universal UI Localization**: Complete translation of navigation, project setup, factor/response definitions, design generator and matrix tables, regression modeling, ANOVA, Pareto/Half-normal diagnostic plots, multi-response desirability optimization, robustness simulations, and the step-by-step tutorial guide.
- **Sidebar Footer Selector**: A dedicated language switcher button at the bottom of the sidebar above/alongside the Dark Mode toggle, opening an accessible dropdown popup.
- **Persistent Preference**: Stores language selection in `localStorage` (`app_language`) so the user's preference persists across browser refreshes and sessions.
- **Future-Ready Language Registry**: A structured locale registry supporting quick addition of languages (German, Spanish, French, Italian) by registering new dictionary objects without refactoring component code.

---

## 2. User Experience & Visual Design

### Sidebar Footer Language Selector UI
- **Positioning**: Bottom of the left navigation sidebar, directly beside the theme toggle.
- **Trigger Element**: A subtle, styled button matching the dark sidebar gradient (`hover:bg-slate-800/60 rounded px-2.5 py-1.5 flex items-center justify-between text-slate-300`).
  - Left side: Globe icon (`lucide-react/Globe`) + current language code or name (`English` / `简体中文`).
  - Right side: Subtle upward chevron icon (`ChevronUp` or `Languages`).
- **Popup Menu (Dropup)**:
  - Opens upwards cleanly with a crisp hairline border (`border border-slate-700 bg-slate-900 shadow-xl rounded-lg p-1 w-48 mb-1`).
  - Lists supported languages:
    - `🇬🇧 English (English)`
    - `🇨🇳 简体中文 (Simplified Chinese)`
    - *Divider* with preview tags for upcoming languages: `🇩🇪 Deutsch`, `🇪🇸 Español`, `🇫🇷 Français`, `🇮🇹 Italiano` marked as coming soon.
  - Active language highlighted with brand accent color and checkmark icon (`Check`).
  - Accessible click-outside listener to dismiss popup seamlessly.

### Visual Polish & Anti-Slop Discipline
- No oversized colorful flags or jarring banners.
- Clean typography pairing: Sans-serif UI labels with tabular monospace fonts for numeric values and statistical notation ($R^2$, $p$-values, $t$-ratios).
- Responsive spacing ensuring Chinese characters (which are more compact horizontally) fit naturally without awkward line breaks or misaligned grid cells.

---

## 3. Key Product Decisions & Trade-Offs

- **Custom Lightweight React Context vs Heavy External i18n Libraries**:
  - *Decision*: Build a strongly typed, zero-overhead `LanguageContext` (`useTranslation` hook) rather than pulling in `i18next` or heavy bundle dependencies.
  - *Rationale*: Zero extra bundle weight, instant switching without asynchronous asset-fetching flashes, full TypeScript autocompletion for translation keys, and guaranteed offline/hermetic execution.
- **Terminology Preservation**:
  - *Decision*: Maintain standard DOE acronyms (ANOVA, OLS, DOE, $R^2$, RMSE, Cpk, Maximize/Minimize targets, D-Optimal, CCD, BBD).
  - *Rationale*: In Chinese biopharma labs (such as Jiuzhou Pharmaceutical), analytical chemists and process engineers routinely use English acronyms in reports, ensuring natural readability without awkward hyper-translations.
- **Dynamic Text Interpolation**:
  - *Decision*: Implement parametric template substitution (e.g., `t('factors_count', { count: 3 })`) for plurals, project names, and numerical summaries.

---

## 4. Technical Architecture & Data Strategy

### Component & Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       App.tsx Root                          │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │               LanguageProvider Context              │   │
│   │   - currentLocale: 'en' | 'zh'                      │   │
│   │   - setLocale(locale)                               │   │
│   │   - t(key, fallback?, params?)                      │   │
│   │   - locales registry: [{ id, name, nativeName }]    │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  ProjectProvider                    │   │
│   └──────────────────────────┬──────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    Layout.tsx                       │   │
│   │   ┌───────────────────────────────────────────────┐ │   │
│   │   │  Sidebar Footer                               │ │   │
│   │   │  ├── LanguageSelector Dropdown (Globe + Menu) │ │   │
│   │   │  └── DarkMode Toggle                          │ │   │
│   │   └───────────────────────────────────────────────┘ │   │
│   │                                                     │   │
│   │   ┌───────────────────────────────────────────────┐ │   │
│   │   │  Routed Pages (useTranslation)                │ │   │
│   │   │  ├── Dashboard.tsx                            │ │   │
│   │   │  ├── ProjectView.tsx                          │ │   │
│   │   │  ├── GuideView.tsx                            │ │   │
│   │   │  └── Child Tabs (Setup, Design, Analysis,     │ │   │
│   │   │      Optimization, Simulation, Compare)       │ │   │
│   │   └───────────────────────────────────────────────┘ │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Module Breakdown

1. **`src/i18n/translations.ts`**:
   - Master translation dictionary containing `en` and `zh` translations structured across logical domains:
     - `common`: Save, Cancel, Delete, Edit, Export, Back, Close, Add, Reset, Loading, Confirm.
     - `nav`: All Experiments, Folders, Design Construction, Experiment Setup & Matrix, Step-by-Step Guide, Dark Mode, Current Experiment.
     - `dashboard`: New Experiment, Search, Sort by, Import Project, Delete confirmation, Empty states, Quick Stats.
     - `setup`: Experiment info, Factor table, Response table, Factor types (Continuous, Discrete, Categorical), Ranges, Design generator picker, Run count.
     - `design`: Experiment Matrix, Add Run, Exclude Run, Randomize, Standard Order, Export Excel/JSON/HTML, Replicate, Diagnostics.
     - `analysis`: Model Term Selection, Pareto Chart of Effects, Half-Normal Plot, Regression Coefficients, ANOVA Table, Model Summary ($R^2$, Adjusted $R^2$, RMSE), Residual Diagnostics.
     - `optimization`: Desirability Profiler, Goal targets (Maximize, Minimize, Target, Range), Optimal Formulation Finder, Simulation.
     - `robustness`: Monte Carlo Simulation, Process Capability (Cpk/Ppk), Defect Rate, Tolerance sliders.
     - `guide`: Full educational guide sections, DOE methodology, glossary, and guidelines.
2. **`src/context/LanguageContext.tsx`**:
   - Context providing `locale`, `setLocale`, `t`, and `supportedLanguages`.
   - Automatic synchronization with `localStorage` and `document.documentElement.lang`.
3. **`src/components/LanguageSelector.tsx`**:
   - Modern dropup menu for the sidebar footer with globe icon, current language label, clean dropdown panel, active indicator checkmark, and preview for future languages.
4. **Integration across Views**:
   - `Layout.tsx`, `Dashboard.tsx`, `ProjectView.tsx`, `ProjectSetup.tsx`, `ProjectDesign.tsx`, `ProjectAnalysis.tsx`, `ProjectOptimization.tsx`, `RobustnessSimulation.tsx`, `CompareResponses.tsx`, `GuideView.tsx`.

---

## 5. Verification & Test Plan

- **Compilation Check**: Run `compile_applet` to verify TypeScript typing, JSX syntax, and imports.
- **Interactive Switching**: Test switching back and forth between English and Simplified Chinese; verify all UI elements change dynamically without requiring page reload.
- **Persistence Verification**: Verify that the selected language is saved to `localStorage` and restored upon reload.
- **Layout & Visual Inspection**: Verify that Chinese text does not cause overflow or broken styling in tables, dropdowns, chart legends, or the sidebar.
- **Export Verification**: Verify that export dialogs and summaries reflect the active language properly.
