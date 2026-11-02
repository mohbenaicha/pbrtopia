// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, IconButton, Icon } from '../../src/ui-kit';

afterEach(cleanup);

describe('Button: pressed', () => {
  it('a button given pressed reports it as aria-pressed; without it the attribute is absent', () => {
    render(
      <>
        <Button pressed>On</Button>
        <Button pressed={false}>Off</Button>
        <Button>Plain</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'On' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Off' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Plain' }).hasAttribute('aria-pressed')).toBe(false);
  });
});

describe('Button', () => {
  it('R22 a button calls onClick on click and on Enter and Space', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Generate</Button>);
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('R22 a disabled button is not focusable and ignores click and Enter', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button disabled onClick={onClick}>Generate</Button>);
    const button = screen.getByRole('button', { name: 'Generate' });
    await user.click(button);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onClick).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(button);
  });

  it('R22 a loading button ignores click, is announced as busy and keeps its name', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button loading onClick={onClick}>Generate</Button>);
    const button = screen.getByRole('button', { name: 'Generate' });
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('R1 and R22 the primary, secondary and ghost variants are marked for styling and the accent belongs to primary only', () => {
    render(
      <>
        <Button variant="primary">A</Button>
        <Button variant="secondary">B</Button>
        <Button variant="ghost">C</Button>
        <Button>D</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'A' }).dataset['variant']).toBe('primary');
    expect(screen.getByRole('button', { name: 'B' }).dataset['variant']).toBe('secondary');
    expect(screen.getByRole('button', { name: 'C' }).dataset['variant']).toBe('ghost');
    expect(screen.getByRole('button', { name: 'D' }).dataset['variant']).toBe('secondary'); // the default is not the accent
  });

  it('R22 a button can carry a tooltip', () => {
    render(<Button title="Import project">Import</Button>);
    expect(screen.getByRole('button', { name: 'Import' }).getAttribute('title')).toBe('Import project');
  });

  it('R22 a large button is marked for styling and the default size is not', () => {
    render(
      <>
        <Button size="large">Big</Button>
        <Button>Plain</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Big' }).dataset['size']).toBe('large');
    expect(screen.getByRole('button', { name: 'Plain' }).dataset['size']).toBeUndefined();
  });
});

describe('IconButton', () => {
  it('R22 an icon button has its label as its accessible name and calls onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<IconButton label="Viewport settings" icon={<Icon name="gear" />} onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: 'Viewport settings' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('R22 a toggle icon button reports its pressed state', () => {
    render(<IconButton label="Wireframe" icon={<Icon name="gear" />} pressed onClick={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Wireframe' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('R22 a disabled icon button ignores clicks', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<IconButton label="Reset" icon={<Icon name="reset" />} disabled onClick={onClick} />);
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('R22 a disabled icon button with a reason keeps its name and gives the reason as tooltip and description', () => {
    render(<IconButton label="Export project" icon={<Icon name="download" />} disabled disabledReason="Exit projection mode to export." onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Export project' });
    expect(button.getAttribute('title')).toBe('Export project: Exit projection mode to export.');
    expect(button.getAttribute('aria-description')).toBe('Exit projection mode to export.');
  });

  it('R22 an enabled icon button ignores a reason it was given', () => {
    render(<IconButton label="Export project" icon={<Icon name="download" />} disabledReason="Exit projection mode to export." onClick={() => undefined} />);
    const button = screen.getByRole('button', { name: 'Export project' });
    expect(button.getAttribute('title')).toBe('Export project');
    expect(button.getAttribute('aria-description')).toBeNull();
  });

  it('R22 a loading icon button ignores clicks, is announced as busy and keeps its name', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<IconButton label="Export project" icon={<Icon name="download" />} loading onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Export project' });
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button.getAttribute('aria-busy')).toBe('true');
  });
});

describe('Icon', () => {
  it('R3 the camera icons are the supplied image files and every icon is hidden from assistive technology', () => {
    const { container } = render(
      <>
        <Icon name="perspective" />
        <Icon name="orthographic" />
        <Icon name="gear" />
      </>,
    );
    const icons = Array.from(container.querySelectorAll('[data-icon]'));
    expect(icons.map((icon) => icon.getAttribute('data-icon'))).toEqual(['perspective', 'orthographic', 'gear']);
    expect((icons[0] as HTMLElement).style.getPropertyValue('--icon-url')).toContain('perspective');
    expect((icons[1] as HTMLElement).style.getPropertyValue('--icon-url')).toContain('orthographic');
    icons.forEach((icon) => expect(icon.getAttribute('aria-hidden')).toBe('true'));
  });
});
