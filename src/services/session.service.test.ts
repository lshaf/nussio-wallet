import { describe, expect, it } from 'vitest';
import { PrivateKey } from '@wharfkit/antelope';
import {
  AnchorLinkSessionManagerSession,
  AnchorLinkSessionManagerStorage,
} from '@greymass/anchor-link-session-manager';
import { stateFromSerialized } from './session.service';

describe('stateFromSerialized', () => {
  it('maps the manager storage into the persisted schema', () => {
    const key = PrivateKey.generate('K1');
    const storage = new AnchorLinkSessionManagerStorage({
      linkId: 'link-1',
      linkUrl: 'cb.anchor.link',
      requestKey: key.toWif(),
      sessions: [
        new AnchorLinkSessionManagerSession(
          '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
          'alice',
          'active',
          String(key.toPublic()),
          'demoapp',
          1,
          2,
        ),
      ],
    });
    const state = stateFromSerialized(storage.serialize());
    expect(state.linkId).toBe('link-1');
    expect(state.requestKey).toBe(key.toWif());
    expect(state.sessions).toEqual([
      {
        network: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
        actor: 'alice',
        permission: 'active',
        publicKey: String(key.toPublic()),
        name: 'demoapp',
        created: 1,
        lastUsed: 2,
      },
    ]);
  });
});
