import type { Meta, StoryObj } from '@storybook/react-vite';
import JsonViewer from './JsonViewer';
import { redactJson } from '../../../shared/utils/redact';
import { shapeOutline } from '../../../shared/utils/shapeInference';

const OKTA_ORIGIN = 'https://acme.okta.com';

/** A realistic app-users response shape: `_embedded` users nested under an app. */
const SAMPLE_RESPONSE = {
  id: '0oa1a2b3c4d5e6f7g8h9',
  status: 'ACTIVE',
  label: 'Acme Expense Reports',
  _links: {
    self: { href: 'https://acme.okta.com/api/v1/apps/0oa1a2b3c4d5e6f7g8h9' },
  },
  _embedded: {
    users: [
      {
        id: '00u1a2b3c4d5e6f7g8h9',
        status: 'ACTIVE',
        profile: {
          email: 'jane.doe@acme.com',
          firstName: 'Jane',
          lastName: 'Doe',
          mobilePhone: '555-123-4567',
        },
      },
      {
        id: '00u9z8y7x6w5v4u3t2s1',
        status: 'ACTIVE',
        profile: {
          email: 'john.smith@acme.com',
          firstName: 'John',
          lastName: 'Smith',
        },
      },
    ],
  },
};

const { data: redacted, redactedCount } = redactJson(SAMPLE_RESPONSE, OKTA_ORIGIN);
const shape = shapeOutline(SAMPLE_RESPONSE);

/**
 * Switches between a values-free Shape outline, a PII/id-redacted value tree, and
 * the raw response — with a copy button on whichever view is active.
 */
const meta = {
  title: 'Shared/JsonViewer',
  component: JsonViewer,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Response viewer for the API Explorer. Opens on the values-free **Shape** view ' +
          '(immune to any redaction gap) rather than Redacted or Raw. Raw carries an explicit ' +
          'warning strip since it is fully unredacted.',
      },
    },
  },
  args: {
    raw: SAMPLE_RESPONSE,
    redacted,
    redactedCount,
    shape,
  },
} satisfies Meta<typeof JsonViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default: opens on the Shape view. */
export const Default: Story = {};

/** A response with nothing to redact — the Redacted tab shows no count badge. */
export const NothingToRedact: Story = {
  args: {
    raw: { status: 'ACTIVE', count: 3 },
    redacted: { status: 'ACTIVE', count: 3 },
    redactedCount: 0,
    shape: shapeOutline({ status: 'ACTIVE', count: 3 }),
  },
};
