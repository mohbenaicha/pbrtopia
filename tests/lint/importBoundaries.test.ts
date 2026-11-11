import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

async function lintImport(filePath: string, importLine: string): Promise<string[]> {
  const results = await eslint.lintText(`${importLine}\nexport {};\n`, { filePath });
  const messages = results[0]?.messages ?? [];
  return messages.map((message) => message.ruleId ?? 'parse-error');
}

describe('import boundaries (specs/architecture.md)', () => {
  it('A5 rejects an engine import of React', async () => {
    const rules = await lintImport('src/projection/engine/model/loadModel.ts', "import React from 'react';");
    expect(rules).toContain('no-restricted-imports');
  });

  it('A5 rejects an engine import of storage, keys, generation, viewport, app and ui-kit', async () => {
    const targets = ['projects', 'keys', 'generation', 'viewport', 'app', 'ui-kit', 'projection/mode'];
    for (const target of targets) {
      const rules = await lintImport(
        'src/projection/engine/model/loadModel.ts',
        `import * as x from '../../../${target}/index';`,
      );
      expect(rules, target).toContain('no-restricted-imports');
    }
  });

  it('A5 allows an engine import of three', async () => {
    const rules = await lintImport('src/projection/engine/model/loadModel.ts', "import * as THREE from 'three';");
    expect(rules).not.toContain('no-restricted-imports');
  });

  it('A3 rejects a generation import of the engine and of projects', async () => {
    const engineRules = await lintImport('src/generation/imageGenerator.ts', "import * as e from '../projection/engine/index';");
    const projectRules = await lintImport('src/generation/imageGenerator.ts', "import * as p from '../projects/index';");
    expect(engineRules).toContain('no-restricted-imports');
    expect(projectRules).toContain('no-restricted-imports');
  });

  it('A4 rejects a projects import of the engine and of generation', async () => {
    const engineRules = await lintImport('src/projects/projectStore.ts', "import * as e from '../projection/engine/index';");
    const generationRules = await lintImport('src/projects/projectStore.ts', "import * as g from '../generation/index';");
    expect(engineRules).toContain('@typescript-eslint/no-restricted-imports');
    expect(generationRules).toContain('no-restricted-imports');
  });

  it('A4 allows a projects import of engine record types only, never engine code', async () => {
    const typeRules = await lintImport('src/projects/records/projectRecords.ts', "import type { MeshRecord } from '../../projection/engine';");
    const valueRules = await lintImport('src/projects/records/projectRecords.ts', "import { createProjectionSession } from '../../projection/engine';");
    expect(typeRules).not.toContain('@typescript-eslint/no-restricted-imports');
    expect(valueRules).toContain('@typescript-eslint/no-restricted-imports');
  });

  it('A2 A6 rejects deep engine imports from mode and viewport (only index.ts is public)', async () => {
    const modeRules = await lintImport('src/projection/mode/modeStore.ts', "import * as w from '../engine/weights/layerValues';");
    const viewportRules = await lintImport('src/viewport/createViewport.ts', "import * as w from '../projection/engine/index';");
    expect(modeRules).toContain('no-restricted-imports');
    expect(viewportRules).toContain('no-restricted-imports');
  });

  it('R21 rejects a feature import of a ui-kit file, and allows the ui-kit entry point', async () => {
    const features = ['src/viewport/Corner.tsx', 'src/app/Shell.tsx', 'src/keys/KeyForm.tsx', 'src/generation/Panel.tsx', 'src/projects/List.tsx', 'src/projection/mode/Panel.tsx'];
    for (const file of features) {
      const depth = file.split('/').length - 1;
      const up = '../'.repeat(depth);
      expect(await lintImport(file, `import { Button } from '${up}ui-kit/Button';`), file).toContain('no-restricted-imports');
      expect(await lintImport(file, `import { Button } from '${up}ui-kit';`), file).not.toContain('no-restricted-imports');
    }
  });

  it('shared/materialgen-prep R31 rejects a viewport import of meshEdit and allows hiddenMarks', async () => {
    const rules = await lintImport('src/viewport/loadModelAsset.ts', "import * as x from '../meshEdit/model/idPixels';");
    expect(rules).toContain('no-restricted-imports');
    expect(await lintImport('src/viewport/loadModelAsset.ts', "import * as x from '../hiddenMarks';")).not.toContain('no-restricted-imports');
  });

  it('shared/materialgen-prep R54 A9 rejects a shell import of app, projection, meshEdit, materialgen, hiddenMarks and appId', async () => {
    for (const target of ['app/App', 'projection/mode', 'projection/engine/model/loadModel', 'meshEdit/model/idPixels', 'materialgen/maps/mapKinds', 'hiddenMarks', 'appId']) {
      const rules = await lintImport('src/shell/AppShell.tsx', `import * as x from '../${target}';`);
      expect(rules, target).toContain('no-restricted-imports');
    }
  });

  it('shared/materialgen-prep R54 A9 allows a shell import of ui-kit, keys, generation, projects and viewport', async () => {
    for (const target of ['ui-kit', 'keys', 'generation', 'projects/ProjectStore', 'viewport']) {
      const rules = await lintImport('src/shell/AppShell.tsx', `import * as x from '../${target}';`);
      expect(rules, target).not.toContain('no-restricted-imports');
    }
  });

  it('R21 rejects a ui-kit import of any other src folder', async () => {
    for (const target of ['viewport', 'app', 'keys', 'generation', 'projects', 'projection/engine']) {
      const rules = await lintImport('src/ui-kit/Button.tsx', `import * as x from '../${target}/index';`);
      expect(rules, target).toContain('no-restricted-imports');
    }
  });
});
