'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      className="btn"
      style={{ padding: '4px 10px', fontSize: 10.5 }}
      onClick={() => signOut({ callbackUrl: '/signin' })}
    >
      Sign out
    </button>
  );
}
