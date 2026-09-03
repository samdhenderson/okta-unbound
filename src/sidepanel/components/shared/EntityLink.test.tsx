import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityLink from './EntityLink';
import { NavigationProvider } from '../../contexts/NavigationContext';

/**
 * Replace the clipboard *after* `userEvent.setup()`, which installs a stub of its own.
 * Returns the spy the component's copy will land on.
 */
const stubClipboard = (): ReturnType<typeof vi.fn> => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  return writeText;
};

describe('EntityLink copyId', () => {
  it('offers open and copy as two separate controls', () => {
    render(
      <NavigationProvider handlers={{ group: vi.fn() }}>
        <EntityLink type="group" id="00gFAKEGROUP0001" name="Sales — West" copyId />
      </NavigationProvider>,
    );

    expect(screen.getByRole('button', { name: 'Open group Sales — West' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy group id for Sales — West (00gFAKEGROUP0001)' }),
    ).toBeInTheDocument();
  });

  it('copies the raw id and confirms, without navigating', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    const onNavigate = vi.fn();

    render(
      <NavigationProvider handlers={{ group: onNavigate }}>
        <EntityLink type="group" id="00gFAKEGROUP0001" name="Sales — West" copyId />
      </NavigationProvider>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Copy group id for Sales — West (00gFAKEGROUP0001)' }),
    );

    expect(writeText).toHaveBeenCalledWith('00gFAKEGROUP0001');
    expect(onNavigate).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('names the copy control after the entity, so several on a screen stay distinct', () => {
    render(
      <NavigationProvider handlers={{ user: vi.fn() }}>
        <EntityLink type="user" id="00uFAKEUSER00001" name="Jane Doe" copyId />
        <EntityLink
          type="user"
          id="00uFAKEUSER00002"
          name="John Roe"
          copyId
          copyIdLabel="Copy John Roe's user id"
        />
      </NavigationProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Copy user id for Jane Doe (00uFAKEUSER00001)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Copy John Roe's user id" })).toBeInTheDocument();
  });

  // I-009: two entities can legitimately share a display name (the same "one
  // name can match groups from more than one source" case this module's own
  // header calls out). The **copy control** folds the id in — the one part
  // guaranteed unique — so no caller has to pass an override to keep two
  // same-named entities apart.
  //
  // The **chip** deliberately does not. Folding the id into every "Open …"
  // name made a screen reader read ~20 opaque characters on every row of every
  // list, to disambiguate a collision that is usually absent. That trade was
  // reversed on 2026-09-02; the residual ambiguity is real and filed as
  // `D-107`, so this test pins the decision rather than pretending it is fixed.
  it('disambiguates the copy control when two entities share a name (I-009)', () => {
    render(
      <NavigationProvider handlers={{ group: vi.fn() }}>
        <EntityLink type="group" id="00gFAKEGROUP0001" name="Engineering" copyId />
        <EntityLink type="group" id="00gFAKEGROUP0002" name="Engineering" copyId />
      </NavigationProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Copy group id for Engineering (00gFAKEGROUP0001)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy group id for Engineering (00gFAKEGROUP0002)' }),
    ).toBeInTheDocument();
    // Known and accepted: the two chips still share one accessible name.
    expect(screen.getAllByRole('button', { name: 'Open group Engineering' })).toHaveLength(2);
  });

  it('renders no copy control when there is no id to copy', () => {
    render(<EntityLink type="group" name="sales" copyId />);

    expect(screen.getByText('sales')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('still copies an id that cannot be navigated to', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();

    render(
      <NavigationProvider handlers={{}}>
        <EntityLink type="policy" id="00pFAKEPOLICY001" name="Contractor MFA" copyId />
      </NavigationProvider>,
    );

    expect(
      screen.queryByRole('button', { name: /^Open policy Contractor MFA/ }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Copy policy id for Contractor MFA (00pFAKEPOLICY001)' }),
    );
    expect(writeText).toHaveBeenCalledWith('00pFAKEPOLICY001');
  });

  it('omits the copy control unless copyId is set', () => {
    render(
      <NavigationProvider handlers={{ group: vi.fn() }}>
        <EntityLink type="group" id="00gFAKEGROUP0001" name="Sales — West" />
      </NavigationProvider>,
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Open group Sales — West' })).toBeInTheDocument();
  });
});

/*
  I-017: three views had each grown a local chip for "this reference is known only
  by an id", and none of them could open the entity — a capability regression
  against the resolved chip sitting beside it in the same list. Omitting `name`
  is now the one way to say it, and the id still opens.
*/
describe('EntityLink with an id and no name', () => {
  it('states the absence rather than putting the id where a name goes', () => {
    render(
      <NavigationProvider handlers={{ group: vi.fn() }}>
        <EntityLink type="group" id="00gFAKEGROUP0001" />
      </NavigationProvider>,
    );

    expect(screen.getByText('Group name not loaded')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy group id 00gFAKEGROUP0001' }),
    ).toBeInTheDocument();
  });

  it('opens the entity by id, which the local chips it replaced could not', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <NavigationProvider handlers={{ group: onNavigate }}>
        <EntityLink type="group" id="00gFAKEGROUP0001" />
      </NavigationProvider>,
    );

    await user.click(
      screen.getByRole('button', { name: 'Group name not loaded — open group 00gFAKEGROUP0001' }),
    );

    expect(onNavigate).toHaveBeenCalledWith('00gFAKEGROUP0001');
  });

  it('offers no open control when the kind cannot be reached, but still copies', async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();

    render(
      <NavigationProvider handlers={{}}>
        <EntityLink type="app" id="0oaFAKEAPP000001" />
      </NavigationProvider>,
    );

    expect(screen.getByText('App name not loaded')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open app/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copy app id 0oaFAKEAPP000001' }));
    expect(writeText).toHaveBeenCalledWith('0oaFAKEAPP000001');
  });

  // There is no name to tell two unresolved references apart, so the id carries
  // that job here — the case D-107's argument for dropping the id from the
  // *resolved* chip's accessible name does not reach.
  it('keeps two unresolved references on one screen distinguishable', () => {
    render(
      <NavigationProvider handlers={{ group: vi.fn() }}>
        <EntityLink type="group" id="00gFAKEGROUP0001" />
        <EntityLink type="group" id="00gFAKEGROUP0002" />
      </NavigationProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Group name not loaded — open group 00gFAKEGROUP0001' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Group name not loaded — open group 00gFAKEGROUP0002' }),
    ).toBeInTheDocument();
  });

  it('lets a caller sharpen the wording and the reason', () => {
    render(
      <NavigationProvider handlers={{ app: vi.fn() }}>
        <EntityLink
          type="app"
          id="0oaFAKEAPP000001"
          unresolvedLabel="Name not returned by Okta"
          unresolvedReason="Okta returned no name for this application."
          copyIdLabel="Copy application id 0oaFAKEAPP000001"
        />
      </NavigationProvider>,
    );

    expect(screen.getByText('Name not returned by Okta')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy application id 0oaFAKEAPP000001' }),
    ).toBeInTheDocument();
  });

  it('degrades to the stated absence alone when neither a name nor an id is known', () => {
    render(
      <NavigationProvider handlers={{ user: vi.fn() }}>
        <EntityLink type="user" />
      </NavigationProvider>,
    );

    expect(screen.getByText('User name not loaded')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
