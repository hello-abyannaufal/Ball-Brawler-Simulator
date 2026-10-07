# Requirements Document

## Introduction

This document covers Phase 1 (Scaffold) of the Ball Battle Simulator project. Phase 1 establishes the project foundation only: a Nuxt 3 + TypeScript application with Tailwind CSS, Pinia (with persistence), a folder structure that matches the long-term architecture rules, and routable placeholder pages for every planned feature area.

Phase 1 deliberately excludes feature behavior. Authentication, database (Drizzle/PostgreSQL), the simulation engine internals, skills, weapons, versus canvas rendering, roulette logic, recording, and settings behavior all belong to later phases. In Phase 1, pages exist and are directly navigable, but render placeholder content only.

The scaffold must honor the architecture rules from the project brief so later phases can build on it without restructuring: the `engine/` directory is framework-free pure TypeScript, server permission utilities live under `server/utils/`, and skill/weapon definition directories exist as empty, ready-to-fill locations.

## Glossary

- **Scaffold_App**: The Nuxt 3 application produced in Phase 1, including configuration, folder structure, and placeholder pages.
- **Build_System**: The Nuxt 3 build and dev tooling configured in Phase 1.
- **TypeScript_Config**: The project TypeScript configuration governing type checking strictness.
- **Lint_System**: The configured linter and its ruleset for the project.
- **Engine_Directory**: The `engine/` directory, reserved for framework-free pure TypeScript with zero Vue/Nuxt imports.
- **Placeholder_Page**: A route-backed Vue page that renders static identifying content and no feature behavior.
- **Home_Menu**: The placeholder page served at route `/`, providing navigation entry points to other pages.
- **Navigation_Menu**: The keyboard-accessible menu component that links to the application's pages.
- **Pinia_Store_Layer**: The Pinia instance with its persistence plugin configured in Phase 1.
- **Styling_System**: The Tailwind CSS integration configured in Phase 1.
- **Responsive_Layout**: The full-viewport layout baseline that fills the available screen on phones, tablets, and desktops.

## Requirements

### Requirement 1: Nuxt 3 + TypeScript Project Setup

**User Story:** As a developer, I want a Nuxt 3 project configured with Vue 3 Composition API and TypeScript, so that I have a modern, type-safe foundation to build the simulator on.

#### Acceptance Criteria

1. THE Scaffold_App SHALL be a Nuxt 3 project configured for Vue 3 with the Composition API.
2. THE Scaffold_App SHALL author Vue components using the `<script setup>` syntax.
3. THE Scaffold_App SHALL include TypeScript as the project language.
4. WHEN a developer runs the project's defined development script, THE Build_System SHALL start a local development server that becomes reachable at a local URL and SHALL report zero startup errors.
5. IF the development server fails to start, THEN THE Build_System SHALL exit with a non-success status and SHALL output an error indication describing the failure.
6. WHEN a developer runs the project's defined production build script, THE Build_System SHALL complete the build, produce build output, and report zero build errors, and SHALL judge build success solely on the build script's own output, exit status, and error count, independent of dev server state.
7. IF the production build fails, THEN THE Build_System SHALL exit with a non-success status, SHALL output an error indication describing the failure, and SHALL NOT report the build as successful.

### Requirement 2: Strict TypeScript Configuration

**User Story:** As a developer, I want strict TypeScript settings, so that type errors are caught early and the codebase stays type-safe as it grows.

#### Acceptance Criteria

1. THE TypeScript_Config SHALL enable TypeScript strict type-checking for all TypeScript and Vue source files in the Scaffold_App.
2. WHEN a developer runs the project's type-check command, THE Build_System SHALL check all TypeScript and Vue source files for type errors.
3. IF the type-check command detects one or more type errors, THEN THE Build_System SHALL report the type errors and terminate the command with a non-zero exit status.
4. WHEN the type-check command completes with zero type errors, THE Build_System SHALL terminate the command with a zero (success) exit status.
5. WHEN the scaffold is first created, THE Scaffold_App SHALL pass the type-check command with zero type errors.

### Requirement 3: Lint Setup

**User Story:** As a developer, I want a configured linter, so that code style and common errors are enforced consistently across the project.

#### Acceptance Criteria

1. THE Lint_System SHALL be configured with a ruleset that inspects every TypeScript (`.ts`) and Vue (`.vue`) source file in the project and flags both code-style violations and common correctness errors (including unused variables and references to undefined identifiers).
2. WHEN a developer runs the project's lint command and at least one lint violation exists, THE Lint_System SHALL report each violation with its file path, line number, and triggered rule, and SHALL terminate with a non-zero exit status.
3. WHEN a developer runs the project's lint command on the newly created scaffold, THE Lint_System SHALL report zero violations and SHALL terminate with a zero (success) exit status.
4. IF the lint command is invoked while the Lint_System is not configured or cannot be executed, THEN THE Lint_System SHALL terminate with a non-zero exit status and emit an error indicating that the lint configuration is missing or invalid.

### Requirement 4: Tailwind CSS Integration

**User Story:** As a developer, I want Tailwind CSS integrated, so that I can style pages with utility classes from the start.

#### Acceptance Criteria

1. THE Styling_System SHALL integrate Tailwind CSS into the Scaffold_App such that Tailwind utility classes are available to every Placeholder_Page without additional per-page configuration.
2. WHEN the Build_System processes the Scaffold_App during a development run or a production build, THE Styling_System SHALL generate the Tailwind stylesheet without error.
3. WHEN a Placeholder_Page applies a defined Tailwind utility class and the Scaffold_App is rendered, THE Styling_System SHALL produce the CSS declarations defined by that utility class in the rendered output.
4. IF a Placeholder_Page references a class name that is not a defined Tailwind utility class, THEN THE Styling_System SHALL emit no CSS declarations for that class name and SHALL complete the build without error.

### Requirement 5: Pinia and Persistence Setup

**User Story:** As a developer, I want Pinia with a persistence plugin configured, so that later phases can add stores that persist state without reconfiguring state management.

#### Acceptance Criteria

1. THE Pinia_Store_Layer SHALL register Pinia as the Scaffold_App state management library.
2. THE Pinia_Store_Layer SHALL register a persistence plugin for Pinia.
3. WHERE a store is defined with persistence enabled, WHEN that store's state changes, THE Pinia_Store_Layer SHALL write the store's state to browser local storage.
4. WHERE a store is defined with persistence enabled, WHEN the Scaffold_App loads, THE Pinia_Store_Layer SHALL restore the store's previously written state from browser local storage.
5. IF writing a persisted store's state to browser local storage fails, THEN THE Pinia_Store_Layer SHALL retain the current in-memory store state and SHALL surface a user-visible notification or UI element indicating the persistence write failed.

### Requirement 6: Architecture-Compliant Folder Structure

**User Story:** As a developer, I want the project folder structure to match the architecture rules, so that later phases add engine code, skills, weapons, and server utilities in the correct locations without restructuring.

#### Acceptance Criteria

1. THE Scaffold_App SHALL contain an `engine/` directory, and the directory SHALL exist even when it holds no source files.
2. THE Engine_Directory SHALL contain zero Vue imports and zero Nuxt imports across every TypeScript source file located at any depth within it.
3. THE Scaffold_App SHALL contain an `engine/skills/` directory, and the directory SHALL exist even when it holds no source files.
4. THE Scaffold_App SHALL contain an `engine/weapons/` directory, and the directory SHALL exist even when it holds no source files.
5. THE Scaffold_App SHALL contain a `server/utils/` directory, and the directory SHALL exist even when it holds no source files.
6. THE Scaffold_App SHALL contain a `pages/` directory, and the directory SHALL exist even when it holds no source files.
7. THE Scaffold_App SHALL contain a `stores/` directory, and the directory SHALL exist even when it holds no source files.

### Requirement 7: Routable Placeholder Pages

**User Story:** As a developer, I want placeholder pages for every planned feature area, so that navigation and routing work end to end before feature behavior is built.

#### Acceptance Criteria

1. THE Scaffold_App SHALL serve a Placeholder_Page at route `/`.
2. THE Scaffold_App SHALL serve a Placeholder_Page at route `/login`.
3. THE Scaffold_App SHALL serve a Placeholder_Page at route `/register`.
4. THE Scaffold_App SHALL serve a Placeholder_Page at route `/roulette`.
5. THE Scaffold_App SHALL serve a Placeholder_Page at route `/versus`.
6. THE Scaffold_App SHALL serve a Placeholder_Page at route `/library`.
7. THE Scaffold_App SHALL serve a Placeholder_Page at route `/recordings`.
8. THE Scaffold_App SHALL serve a Placeholder_Page at route `/settings`.
9. WHEN a user navigates directly to any of the defined routes, THE Scaffold_App SHALL render that route's Placeholder_Page.
10. WHEN a Placeholder_Page is rendered, THE Placeholder_Page SHALL display a visible heading whose text uniquely identifies its route and SHALL issue no outbound data or network requests.
11. IF a user navigates to a route that is not one of the eight defined routes, THEN THE Scaffold_App SHALL render a placeholder not-found view indicating the route does not exist and SHALL NOT display any defined route's Placeholder_Page.

### Requirement 8: Menu-Based Non-Linear Navigation

**User Story:** As a user, I want a menu that links to every page, so that I can reach any area of the app directly without following a fixed sequence.

#### Acceptance Criteria

1. THE Home_Menu SHALL present exactly one navigation link to each of the `/login`, `/register`, `/roulette`, `/versus`, `/library`, `/recordings`, and `/settings` routes.
2. WHEN a user activates a navigation link in the Home_Menu, THE Scaffold_App SHALL navigate to that link's target route and render that route's Placeholder_Page.
3. THE Navigation_Menu SHALL expose a direct navigation link to every defined route such that reaching any route requires no prior visit to any other specific route.
4. IF a navigation attempt targets a route that does not resolve to a defined Placeholder_Page, whether activated from a menu link or entered directly as a URL, THEN THE Scaffold_App SHALL display a visible indication that the target route is unavailable.

### Requirement 9: Keyboard-Accessible Menus with Visible Focus

**User Story:** As a keyboard user, I want to operate the menus with the keyboard and see where focus is, so that I can navigate the app without a pointer.

#### Acceptance Criteria

1. WHEN a user presses the Tab key with focus inside the Navigation_Menu, THE Navigation_Menu SHALL move keyboard focus to the next navigation link in visual order, and WHEN the user presses Shift+Tab, THE Navigation_Menu SHALL move keyboard focus to the previous navigation link in visual order.
2. WHILE a navigation link holds keyboard focus, THE Navigation_Menu SHALL display a focus indicator on that link that is visually distinct from every unfocused link, and SHALL display the focus indicator on exactly one navigation link at a time.
3. WHEN a user presses the Enter key or the Space key on a navigation link that holds keyboard focus, THE Scaffold_App SHALL navigate to that link's route.

### Requirement 10: Responsive Full-Viewport Layout Baseline

**User Story:** As a user on any device, I want the layout to fill the available screen, so that the app uses the full viewport on phones, tablets, and desktops.

#### Acceptance Criteria

1. THE Responsive_Layout SHALL fill the full width and height of the viewport on every supported device.
2. THE Responsive_Layout SHALL apply as the baseline layout for every Placeholder_Page.
3. WHILE the viewport is taller than it is wide, THE Scaffold_App SHALL render every Placeholder_Page with its content fitting within the visible viewport width and SHALL present no horizontal scrolling.
4. WHILE the viewport is wider than it is tall, THE Scaffold_App SHALL render every Placeholder_Page across the full viewport width, SHALL clip no content, and SHALL keep every navigation link activatable.
5. WHILE a Placeholder_Page is displayed on any supported viewport, THE Scaffold_App SHALL keep its heading text and navigation links legible without content overlapping.
6. IF a Placeholder_Page's content exceeds the viewport height, THEN THE Scaffold_App SHALL make the overflowing content reachable by vertical scrolling and SHALL present no horizontal scrolling.
